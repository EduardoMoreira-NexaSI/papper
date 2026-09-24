(() => {
  const painel = document.querySelector("#painel-recorrencia-atividade");
  const botaoAbrir = document.querySelector("#botao-nova-recorrencia");
  const botaoFechar = document.querySelector("#botao-fechar-recorrencia");
  const botaoCancelar = document.querySelector("#botao-cancelar-recorrencia");
  const form = document.querySelector("#form-atividade-recorrente");
  const mensagem = document.querySelector("#mensagem-recorrencia");
  const botaoSalvar = document.querySelector("#botao-salvar-recorrencia");
  const botaoRealizar = document.querySelector("#botao-realizar-atividade");

  if (!painel || !form) return;

  const campo = id => document.querySelector(id);

  function dataLocalInput(data) {
    const deslocamento = data.getTimezoneOffset() * 60000;
    return new Date(data.getTime() - deslocamento).toISOString().slice(0, 16);
  }

  function abrir() {
    form.reset();
    mensagem.textContent = "";
    const inicio = new Date();
    inicio.setMinutes(Math.ceil(inicio.getMinutes() / 30) * 30, 0, 0);
    campo("#recorrencia-inicio").value = dataLocalInput(inicio);
    const fim = new Date(inicio.getTime() + 90 * 60000);
    campo("#recorrencia-fim-hora").value = dataLocalInput(fim);
    const limite = new Date(inicio);
    limite.setMonth(limite.getMonth() + 1);
    campo("#recorrencia-data-fim").value = limite.toISOString().slice(0, 10);
    painel.classList.remove("oculto");
    painel.scrollIntoView({behavior: "smooth", block: "start"});
  }

  function fechar() {
    painel.classList.add("oculto");
    form.reset();
    mensagem.textContent = "";
  }

  async function salvar(evento) {
    evento.preventDefault();
    const dias = [...document.querySelectorAll("#dias-recorrencia input:checked")].map(i => i.value);
    if (!dias.length) {
      mensagem.textContent = "Selecione pelo menos um dia da semana.";
      mensagem.className = "erro";
      return;
    }
    const inicio = campo("#recorrencia-inicio").value;
    const fim = campo("#recorrencia-fim-hora").value || null;
    if (fim && new Date(fim) < new Date(inicio)) {
      mensagem.textContent = "O término da ocorrência não pode ser anterior ao início.";
      mensagem.className = "erro";
      return;
    }

    botaoSalvar.disabled = true;
    botaoSalvar.textContent = "Criando...";
    try {
      const resposta = await requisicaoAutenticada("/atividades/recorrentes", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          titulo: campo("#recorrencia-titulo").value.trim(),
          tipo: campo("#recorrencia-tipo").value,
          local: campo("#recorrencia-local").value.trim() || null,
          data_hora_inicio: inicio,
          data_hora_fim: fim,
          data_fim_recorrencia: campo("#recorrencia-data-fim").value,
          dias_semana: dias,
          descricao: campo("#recorrencia-descricao").value.trim() || null,
          observacoes: campo("#recorrencia-observacoes").value.trim() || null,
          igreja_id: igrejaId
        })
      });
      fechar();
      await carregarAtividades();
      mostrarMensagemPagina(`${resposta.quantidade} atividades criadas na recorrência.`, "sucesso");
    } catch (erro) {
      mensagem.textContent = erro.message;
      mensagem.className = "erro";
    } finally {
      botaoSalvar.disabled = false;
      botaoSalvar.textContent = "Criar recorrência";
    }
  }

  async function realizarSelecionada() {
    if (!atividadeSelecionada) return;
    if (atividadeSelecionada.status === "realizado") {
      mostrarMensagemPagina("Esta atividade já está marcada como realizada.", "sucesso");
      return;
    }
    if (atividadeSelecionada.status === "cancelado") {
      mostrarMensagemPagina("Uma atividade cancelada não pode ser marcada como realizada.", "erro");
      return;
    }
    botaoRealizar.disabled = true;
    botaoRealizar.textContent = "Salvando...";
    try {
      await requisicaoAutenticada(
        `/igrejas/${igrejaId}/atividades/${atividadeSelecionada.id}/realizar`,
        {method: "PATCH"}
      );
      fecharModal();
      await carregarAtividades();
      mostrarMensagemPagina("Atividade marcada como realizada.", "sucesso");
    } catch (erro) {
      mostrarMensagemPagina(erro.message, "erro");
    } finally {
      botaoRealizar.disabled = false;
      botaoRealizar.textContent = "Marcar como realizada";
    }
  }

  botaoAbrir.addEventListener("click", abrir);
  botaoFechar.addEventListener("click", fechar);
  botaoCancelar.addEventListener("click", fechar);
  form.addEventListener("submit", salvar);
  botaoRealizar?.addEventListener("click", realizarSelecionada);
})();
