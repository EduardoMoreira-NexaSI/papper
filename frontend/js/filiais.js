(() => {
  "use strict";

  const estado = { usuario: null, igrejaId: null, contexto: null, pastores: [] };

  const el = {
    nome: document.querySelector("#usuario-nome"),
    perfil: document.querySelector("#usuario-perfil"),
    avatar: document.querySelector("#usuario-avatar"),
    mensagem: document.querySelector("#mensagem-filiais"),
    sair: document.querySelector("#botao-sair"),
    unidadeAtual: document.querySelector("#unidade-atual"),
    tipoUnidade: document.querySelector("#tipo-unidade"),
    nomeSede: document.querySelector("#nome-sede"),
    presidenteSede: document.querySelector("#presidente-sede"),
    totalFiliais: document.querySelector("#total-filiais"),
    estrutura: document.querySelector("#estrutura-filiais"),
    painelPresidente: document.querySelector("#painel-configurar-presidente"),
    formPresidente: document.querySelector("#form-presidente"),
    presidenteUsuario: document.querySelector("#presidente-usuario"),
    painelFilial: document.querySelector("#painel-nova-filial"),
    formFilial: document.querySelector("#form-filial"),
    filialPastor: document.querySelector("#filial-pastor")
  };

  function escapar(valor) {
    const div = document.createElement("div");
    div.textContent = valor == null ? "" : valor;
    return div.innerHTML;
  }

  function avisar(texto = "", sucesso = false) {
    el.mensagem.textContent = texto;
    el.mensagem.className = "mensagem-filiais";
    if (texto) el.mensagem.classList.add(sucesso ? "sucesso" : "erro");
  }

  function nomePastor(unidade) {
    return unidade?.pastor_responsavel?.nome || "Não definido";
  }

  function cardUnidade(unidade, tipo) {
    const rotulo = tipo === "sede" ? "Pastor presidente" : "Pastor responsável";
    return `<article class="unidade-card ${tipo}">
      <span class="unidade-tipo">${tipo.toUpperCase()}</span>
      <h3>${escapar(unidade.nome)}</h3>
      <p>${escapar(unidade.endereco)}</p>
      <strong>${rotulo}: ${escapar(nomePastor(unidade))}</strong>
    </article>`;
  }

  function renderizarEstrutura() {
    const c = estado.contexto;
    const sede = c.sede;
    const filiais = c.filiais || [];

    el.unidadeAtual.textContent = c.unidade_atual.nome;
    el.tipoUnidade.textContent = c.unidade_atual.tipo === "sede" ? "Igreja sede" : "Igreja filial";
    el.nomeSede.textContent = sede.nome;
    el.presidenteSede.textContent = `Pr. ${nomePastor(sede)}`;
    el.totalFiliais.textContent = filiais.length;

    el.estrutura.innerHTML = cardUnidade(sede, "sede") +
      filiais.map((filial) => cardUnidade(filial, "filial")).join("");
  }

  async function carregarPastores() {
    estado.pastores = await requisicaoAutenticada(
      `/igrejas/${estado.contexto.sede.id}/filiais/pastores-disponiveis`
    );
    el.filialPastor.innerHTML = estado.pastores.map((pastor) =>
      `<option value="${pastor.id}">${escapar(pastor.nome)} (${escapar(pastor.username)})</option>`
    ).join("") || '<option value="">Nenhum pastor disponível na sede</option>';
    el.filialPastor.disabled = !estado.pastores.length;
  }

  async function carregarCandidatosPresidente() {
    const usuarios = await requisicaoAutenticada(
      `/admin/usuarios?igreja_id=${encodeURIComponent(estado.contexto.sede.id)}`
    );
    const pastores = usuarios.filter((usuario) => usuario.ativo && usuario.perfil === "pastor");
    el.presidenteUsuario.innerHTML = pastores.map((pastor) =>
      `<option value="${pastor.id}">${escapar(pastor.nome)} (${escapar(pastor.username)})</option>`
    ).join("") || '<option value="">Crie primeiro um usuário com perfil pastor</option>';
    el.presidenteUsuario.disabled = !pastores.length;
  }

  async function carregarContexto() {
    estado.contexto = await requisicaoAutenticada(`/igrejas/${estado.igrejaId}/filiais/contexto`);
    renderizarEstrutura();

    const ehMaster = estado.usuario.perfil === "master";
    const sedeAtual = estado.contexto.unidade_atual.id === estado.contexto.sede.id;

    el.painelPresidente.classList.toggle(
      "oculto",
      !(ehMaster && sedeAtual && estado.contexto.precisa_configurar_presidente)
    );

    el.painelFilial.classList.toggle(
      "oculto",
      !(sedeAtual && estado.contexto.pode_gerenciar && !estado.contexto.precisa_configurar_presidente)
    );

    if (ehMaster && estado.contexto.precisa_configurar_presidente) {
      await carregarCandidatosPresidente();
    }
    if (estado.contexto.pode_gerenciar && !estado.contexto.precisa_configurar_presidente) {
      await carregarPastores();
    }
  }

  el.formPresidente.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    try {
      const pastorId = Number(el.presidenteUsuario.value);
      if (!pastorId) throw new Error("Selecione um usuário com perfil pastor.");
      await requisicaoAutenticada(
        `/igrejas/${estado.contexto.sede.id}/filiais/configurar-presidente`,
        {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({pastor_usuario_id: pastorId})
        }
      );
      avisar("Pastor presidente definido com sucesso.", true);
      await carregarContexto();
    } catch (erro) {
      avisar(erro.message);
    }
  });

  el.formFilial.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    try {
      const pastorId = Number(el.filialPastor.value);
      if (!pastorId) throw new Error("Cadastre ou selecione um pastor disponível.");
      await requisicaoAutenticada(
        `/igrejas/${estado.contexto.sede.id}/filiais`,
        {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({
            nome: document.querySelector("#filial-nome").value.trim(),
            endereco: document.querySelector("#filial-endereco").value.trim(),
            pastor_responsavel_id: pastorId
          })
        }
      );
      el.formFilial.reset();
      avisar("Filial criada e pastor designado com sucesso.", true);
      await carregarContexto();
    } catch (erro) {
      avisar(erro.message);
    }
  });

  el.sair.addEventListener("click", () => {
    sessionStorage.clear();
    window.location.href = "login.html";
  });

  async function iniciar() {
    try {
      estado.usuario = await requisicaoAutenticada("/usuarios/eu");
      if (!["master", "pastor"].includes(estado.usuario.perfil)) {
        window.location.href = "dashboard.html";
        return;
      }
      estado.igrejaId = obterIgrejaDoUsuario(estado.usuario);
      if (!estado.igrejaId) throw new Error("Selecione uma igreja antes de abrir Filiais.");
      el.nome.textContent = estado.usuario.nome;
      el.perfil.textContent = estado.usuario.perfil;
      el.avatar.textContent = (estado.usuario.nome || "P").charAt(0).toUpperCase();
      await carregarContexto();
    } catch (erro) {
      avisar(erro.message);
    }
  }

  iniciar();
})();
