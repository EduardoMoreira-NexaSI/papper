(() => {
  const botaoAbrir = document.querySelector("#botao-deposito-envelope");
  const container = document.querySelector("#formulario-envelope-container");
  const form = document.querySelector("#form-envelope");
  const botaoFechar = document.querySelector("#botao-fechar-envelope");
  const botaoCancelar = document.querySelector("#botao-cancelar-envelope");
  const botaoSalvar = document.querySelector("#botao-salvar-envelope");
  const mensagem = document.querySelector("#mensagem-envelope");
  const corpo = document.querySelector("#corpo-tabela-envelopes");
  let igrejaEnvelopeId = null;
  let perfilEnvelope = null;

  if (!botaoAbrir || !container || !form || !corpo) return;

  function dinheiro(valor) {
    return Number(valor || 0).toLocaleString("pt-BR", {style:"currency", currency:"BRL"});
  }
  function dataHora(valor) {
    if (!valor) return "—";
    return new Date(valor).toLocaleString("pt-BR", {day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit"});
  }
  function escapar(valor) {
    const e = document.createElement("div");
    e.textContent = valor ?? "";
    return e.innerHTML;
  }
  function dataLocalInput(data = new Date()) {
    const z = data.getTimezoneOffset() * 60000;
    return new Date(data.getTime() - z).toISOString().slice(0,16);
  }

  function abrir() {
    form.reset();
    document.querySelector("#envelope-data").value = dataLocalInput();
    mensagem.textContent = "";
    container.classList.remove("oculto");
    container.scrollIntoView({behavior:"smooth", block:"start"});
  }
  function fechar() {
    container.classList.add("oculto");
    form.reset();
    mensagem.textContent = "";
  }

  async function carregarResumo() {
    const dados = await requisicaoAutenticada(`/igrejas/${igrejaEnvelopeId}/dashboard`);
    document.querySelector("#resumo-caixa-fisico").textContent = dinheiro(dados.financeiro.caixa_fisico_estimado);
    document.querySelector("#resumo-cofre").textContent = dinheiro(dados.financeiro.cofre_estimado);
    document.querySelector("#resumo-envelope-pendente").textContent = dinheiro(dados.financeiro.envelopes_aguardando_visto);
  }

  function botoes(item) {
    const ver = `<button type="button" data-envelope-acao="comprovante" data-id="${item.id}">Comprovante</button>`;
    if (!["master","pastor"].includes(perfilEnvelope) || item.status !== "aguardando_visto") return ver;
    return `${ver}<button class="aprovar" type="button" data-envelope-acao="aprovar" data-id="${item.id}">Dar visto</button><button class="rejeitar" type="button" data-envelope-acao="rejeitar" data-id="${item.id}">Rejeitar</button>`;
  }

  async function carregarEnvelopes() {
    const itens = await requisicaoAutenticada(`/igrejas/${igrejaEnvelopeId}/financeiro/envelopes`);
    corpo.innerHTML = itens.length ? itens.map(item => `
      <tr>
        <td><strong>${escapar(item.codigo)}</strong></td>
        <td>${dataHora(item.data_deposito)}</td>
        <td>${dinheiro(item.valor)}</td>
        <td><span class="status-dashboard status-${escapar(item.status.replaceAll("_","-"))}">${escapar(item.status.replaceAll("_"," "))}</span></td>
        <td>${escapar(item.aprovado_por || item.criado_por || "—")}</td>
        <td><div class="acoes-envelope">${botoes(item)}</div></td>
      </tr>`).join("") : '<tr><td colspan="6">Nenhum envelope lançado.</td></tr>';
  }

  async function salvar(evento) {
    evento.preventDefault();
    const arquivo = document.querySelector("#envelope-comprovante").files[0];
    if (!arquivo) {
      mensagem.textContent = "O comprovante é obrigatório.";
      mensagem.className = "erro";
      return;
    }
    if (arquivo.size > 5 * 1024 * 1024) {
      mensagem.textContent = "O comprovante deve possuir no máximo 5 MB.";
      mensagem.className = "erro";
      return;
    }
    const fd = new FormData();
    fd.append("valor", document.querySelector("#envelope-valor").value);
    fd.append("data_deposito", document.querySelector("#envelope-data").value);
    fd.append("observacao", document.querySelector("#envelope-observacao").value.trim());
    fd.append("comprovante", arquivo);
    botaoSalvar.disabled = true;
    botaoSalvar.textContent = "Lançando...";
    try {
      const item = await requisicaoAutenticada(`/igrejas/${igrejaEnvelopeId}/financeiro/envelopes`, {method:"POST", body:fd});
      fechar();
      await Promise.all([carregarEnvelopes(), carregarResumo()]);
      if (typeof mostrarMensagemPagina === "function") mostrarMensagemPagina(`${item.codigo} lançado e aguardando visto pastoral.`, "sucesso");
    } catch (erro) {
      mensagem.textContent = erro.message;
      mensagem.className = "erro";
    } finally {
      botaoSalvar.disabled = false;
      botaoSalvar.textContent = "Lançar envelope";
    }
  }

  async function abrirComprovante(id) {
    const resposta = await fetch(`${API_URL}/igrejas/${igrejaEnvelopeId}/financeiro/envelopes/${id}/comprovante`, {
      headers: {Authorization: `Bearer ${obterToken()}`}
    });
    if (!resposta.ok) throw new Error(`Não foi possível abrir o comprovante (${resposta.status}).`);
    const blob = await resposta.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  async function analisar(id, acao) {
    const observacao = window.prompt(acao === "aprovar" ? "Observação do visto (opcional):" : "Motivo da rejeição:", "") ?? null;
    if (observacao === null) return;
    await requisicaoAutenticada(`/igrejas/${igrejaEnvelopeId}/financeiro/envelopes/${id}/${acao}`, {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({observacao: observacao.trim() || null})
    });
    await Promise.all([carregarEnvelopes(), carregarResumo()]);
    if (typeof mostrarMensagemPagina === "function") mostrarMensagemPagina(acao === "aprovar" ? "Visto pastoral registrado." : "Envelope rejeitado.", "sucesso");
  }

  corpo.addEventListener("click", async evento => {
    const botao = evento.target.closest("[data-envelope-acao]");
    if (!botao) return;
    botao.disabled = true;
    try {
      if (botao.dataset.envelopeAcao === "comprovante") await abrirComprovante(botao.dataset.id);
      else await analisar(botao.dataset.id, botao.dataset.envelopeAcao);
    } catch (erro) {
      if (typeof mostrarMensagemPagina === "function") mostrarMensagemPagina(erro.message, "erro");
    } finally { botao.disabled = false; }
  });

  async function iniciar() {
    try {
      const usuario = await requisicaoAutenticada("/usuarios/eu");
      igrejaEnvelopeId = obterIgrejaDoUsuario(usuario);
      perfilEnvelope = usuario.perfil;
      await Promise.all([carregarEnvelopes(), carregarResumo()]);
    } catch (erro) {
      corpo.innerHTML = `<tr><td colspan="6">${escapar(erro.message)}</td></tr>`;
    }
  }

  botaoAbrir.addEventListener("click", abrir);
  botaoFechar.addEventListener("click", fechar);
  botaoCancelar.addEventListener("click", fechar);
  form.addEventListener("submit", salvar);
  iniciar();
})();
