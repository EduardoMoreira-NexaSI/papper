const usuarioNome = document.querySelector("#usuario-nome");
const usuarioPerfil = document.querySelector("#usuario-perfil");
const usuarioAvatar = document.querySelector("#usuario-avatar");
const botaoSair = document.querySelector("#botao-sair");

const pesquisaAtividade = document.querySelector(
    "#pesquisa-atividade"
);

const filtroTipoAtividade = document.querySelector(
    "#filtro-tipo-atividade"
);

const filtroStatusAtividade = document.querySelector(
    "#filtro-status-atividade"
);

const botaoNovaAtividade = document.querySelector(
    "#botao-nova-atividade"
);

const formularioContainer = document.querySelector(
    "#formulario-atividade-container"
);

const tituloFormulario = document.querySelector(
    "#titulo-formulario-atividade"
);

const botaoFecharFormulario = document.querySelector(
    "#botao-fechar-formulario-atividade"
);

const botaoCancelarFormulario = document.querySelector(
    "#botao-cancelar-formulario-atividade"
);

const botaoSalvarAtividade = document.querySelector(
    "#botao-salvar-atividade"
);

const formularioAtividade = document.querySelector(
    "#form-atividade"
);

const mensagemFormulario = document.querySelector(
    "#mensagem-formulario-atividade"
);

const campoTitulo = document.querySelector(
    "#atividade-titulo"
);

const campoTipo = document.querySelector(
    "#atividade-tipo"
);

const campoLocal = document.querySelector(
    "#atividade-local"
);

const campoInicio = document.querySelector(
    "#atividade-inicio"
);

const campoFim = document.querySelector(
    "#atividade-fim"
);

const campoDescricao = document.querySelector(
    "#atividade-descricao"
);

const campoObservacoes = document.querySelector(
    "#atividade-observacoes"
);

const corpoTabela = document.querySelector(
    "#corpo-tabela-atividades"
);

const quantidadeAtividades = document.querySelector(
    "#quantidade-atividades"
);

const mensagemPagina = document.querySelector(
    "#mensagem-pagina-atividades"
);

const totalAtividadesPagina = document.querySelector(
    "#total-atividades-pagina"
);

const totalAtividadesAgendadas = document.querySelector(
    "#total-atividades-agendadas"
);

const totalAtividadesRealizadas = document.querySelector(
    "#total-atividades-realizadas"
);

const totalAtividadesCanceladas = document.querySelector(
    "#total-atividades-canceladas"
);

const modalAtividade = document.querySelector(
    "#modal-atividade"
);

const botaoFecharModal = document.querySelector(
    "#botao-fechar-atividade"
);

const botaoFecharModalRodape = document.querySelector(
    "#botao-fechar-atividade-rodape"
);

const botaoEditarAtividade = document.querySelector(
    "#botao-editar-atividade"
);

const botaoCancelarAtividade = document.querySelector(
    "#botao-cancelar-atividade"
);

const botaoListaPresenca = document.querySelector(
    "#botao-lista-presenca"
);

const detalheTitulo = document.querySelector(
    "#detalhe-atividade-titulo"
);

const detalheTipo = document.querySelector(
    "#detalhe-atividade-tipo"
);

const detalheStatus = document.querySelector(
    "#detalhe-atividade-status"
);

const detalheInicio = document.querySelector(
    "#detalhe-atividade-inicio"
);

const detalheFim = document.querySelector(
    "#detalhe-atividade-fim"
);

const detalheLocal = document.querySelector(
    "#detalhe-atividade-local"
);

const detalheDescricao = document.querySelector(
    "#detalhe-atividade-descricao"
);

const detalheObservacoes = document.querySelector(
    "#detalhe-atividade-observacoes"
);


let igrejaId = null;
let atividades = [];
let atividadeSelecionada = null;
let atividadeEmEdicaoId = null;


/*
    Evita que textos vindos do banco sejam
    interpretados como código HTML.
*/
function escaparHTML(valor) {
    const elemento = document.createElement("div");

    elemento.textContent = valor ?? "";

    return elemento.innerHTML;
}


/*
    Remove acentos e transforma o texto em minúsculo.
    É utilizado nos filtros e pesquisas.
*/
function normalizarTexto(valor) {
    return String(valor ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}


/*
    Formata palavras como:
    agendado -> Agendado
    estudo_biblico -> Estudo biblico
*/
function formatarTexto(valor) {
    if (!valor) {
        return "Não informado";
    }

    return String(valor)
        .replaceAll("_", " ")
        .replace(/^./, function (letra) {
            return letra.toUpperCase();
        });
}


/*
    Formata uma data para o padrão brasileiro.
*/
function formatarDataHora(valor) {
    if (!valor) {
        return "Não informada";
    }

    const data = new Date(valor);

    if (Number.isNaN(data.getTime())) {
        return valor;
    }

    return data.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}


/*
    Converte a data da API para o formato
    aceito pelo input datetime-local.
*/
function formatarParaCampoData(valor) {
    if (!valor) {
        return "";
    }

    return String(valor).slice(0, 16);
}


/*
    Retorna a classe CSS correspondente
    ao status da atividade.
*/
function classeStatus(statusAtividade) {
    const statusNormalizado = normalizarTexto(
        statusAtividade
    );

    if (statusNormalizado === "realizado") {
        return "status-realizado";
    }

    if (statusNormalizado === "cancelado") {
        return "status-cancelado";
    }

    return "status-agendado";
}


/*
    Mostra mensagens de sucesso ou erro.
*/
function mostrarMensagemPagina(
    mensagem,
    tipo = "erro"
) {
    mensagemPagina.textContent = mensagem;
    mensagemPagina.className = tipo;

    if (mensagem) {
        setTimeout(function () {
            mensagemPagina.textContent = "";
            mensagemPagina.className = "";
        }, 5000);
    }
}


/*
    Busca os dados do usuário autenticado.
*/
async function carregarUsuario() {
    const usuario = await requisicaoAutenticada(
        "/usuarios/eu"
    );

    usuarioNome.textContent = usuario.nome;
    usuarioPerfil.textContent = formatarTexto(
        usuario.perfil
    );

    usuarioAvatar.textContent = usuario.nome
        .charAt(0)
        .toUpperCase();

    igrejaId = obterIgrejaDoUsuario(usuario);

    sessionStorage.setItem(
        "igreja_id",
        String(igrejaId)
    );

    return usuario;
}


/*
    Busca as atividades da igreja.
*/
async function carregarAtividades() {
    corpoTabela.innerHTML = `
        <tr>
            <td colspan="6">
                Carregando atividades...
            </td>
        </tr>
    `;

    atividades = await requisicaoAutenticada(
        `/igrejas/${igrejaId}/atividades`
    );

    atualizarResumo();
    filtrarAtividades();
}


/*
    Atualiza os contadores da página.
*/
function atualizarResumo() {
    const agendadas = atividades.filter(
        function (atividade) {
            return (
                normalizarTexto(atividade.status) ===
                "agendado"
            );
        }
    );

    const realizadas = atividades.filter(
        function (atividade) {
            return (
                normalizarTexto(atividade.status) ===
                "realizado"
            );
        }
    );

    const canceladas = atividades.filter(
        function (atividade) {
            return (
                normalizarTexto(atividade.status) ===
                "cancelado"
            );
        }
    );

    totalAtividadesPagina.textContent =
        atividades.length;

    totalAtividadesAgendadas.textContent =
        agendadas.length;

    totalAtividadesRealizadas.textContent =
        realizadas.length;

    totalAtividadesCanceladas.textContent =
        canceladas.length;
}


/*
    Filtra as atividades por pesquisa, tipo e status.
*/
function filtrarAtividades() {
    const pesquisa = normalizarTexto(
        pesquisaAtividade.value
    );

    const tipoSelecionado = normalizarTexto(
        filtroTipoAtividade.value
    );

    const statusSelecionado = normalizarTexto(
        filtroStatusAtividade.value
    );

    const atividadesFiltradas = atividades.filter(
        function (atividade) {
            const textoAtividade = normalizarTexto(
                `${atividade.titulo} ` +
                `${atividade.tipo} ` +
                `${atividade.local ?? ""}`
            );

            const correspondePesquisa =
                pesquisa === "" ||
                textoAtividade.includes(pesquisa);

            const correspondeTipo =
                tipoSelecionado === "" ||
                tipoSelecionado === "todos" ||
                normalizarTexto(atividade.tipo) ===
                    tipoSelecionado;

            const correspondeStatus =
                statusSelecionado === "" ||
                statusSelecionado === "todos" ||
                normalizarTexto(atividade.status) ===
                    statusSelecionado;

            return (
                correspondePesquisa &&
                correspondeTipo &&
                correspondeStatus
            );
        }
    );

    renderizarAtividades(atividadesFiltradas);
}


/*
    Monta as linhas da tabela.
*/
function renderizarAtividades(listaAtividades) {
    quantidadeAtividades.textContent =
        `${listaAtividades.length} atividade(s) encontrada(s)`;

    if (listaAtividades.length === 0) {
        corpoTabela.innerHTML = `
            <tr>
                <td colspan="6">
                    Nenhuma atividade encontrada.
                </td>
            </tr>
        `;

        return;
    }

    corpoTabela.innerHTML = listaAtividades
        .map(function (atividade) {
            return `
                <tr>
                    <td>
                        <strong>
                            ${escaparHTML(atividade.titulo)}
                        </strong>
                    </td>

                    <td>
                        ${escaparHTML(
                            formatarTexto(atividade.tipo)
                        )}
                    </td>

                    <td>
                        ${escaparHTML(
                            formatarDataHora(
                                atividade.data_hora_inicio
                            )
                        )}
                    </td>

                    <td>
                        ${escaparHTML(
                            atividade.local ||
                            "Não informado"
                        )}
                    </td>

                    <td>
                        <span
                            class="status-atividade
                            ${classeStatus(atividade.status)}"
                        >
                            ${escaparHTML(
                                formatarTexto(
                                    atividade.status
                                )
                            )}
                        </span>
                    </td>

                    <td>
                        <button
                            type="button"
                            class="botao-acao-tabela"
                            data-acao="visualizar"
                            data-id="${atividade.id}"
                        >
                            Ver detalhes
                        </button>
                    </td>
                </tr>
            `;
        })
        .join("");
}


/*
    Abre o formulário para cadastrar
    uma nova atividade.
*/
function abrirFormularioNovaAtividade() {
    atividadeEmEdicaoId = null;

    formularioAtividade.reset();

    tituloFormulario.textContent =
        "Nova atividade";

    botaoSalvarAtividade.textContent =
        "Salvar atividade";

    mensagemFormulario.textContent = "";
    mensagemFormulario.className = "";

    formularioContainer.classList.remove(
        "oculto"
    );

    campoTitulo.focus();
}


/*
    Abre o formulário preenchido para edição.
*/
function abrirFormularioEdicao(atividade) {
    atividadeEmEdicaoId = atividade.id;

    campoTitulo.value =
        atividade.titulo ?? "";

    campoTipo.value =
        atividade.tipo ?? "";

    campoLocal.value =
        atividade.local ?? "";

    campoInicio.value = formatarParaCampoData(
        atividade.data_hora_inicio
    );

    campoFim.value = formatarParaCampoData(
        atividade.data_hora_fim
    );

    campoDescricao.value =
        atividade.descricao ?? "";

    campoObservacoes.value =
        atividade.observacoes ?? "";

    tituloFormulario.textContent =
        "Editar atividade";

    botaoSalvarAtividade.textContent =
        "Salvar alterações";

    mensagemFormulario.textContent = "";
    mensagemFormulario.className = "";

    fecharModal();

    formularioContainer.classList.remove(
        "oculto"
    );

    window.scrollTo({
        top: formularioContainer.offsetTop - 20,
        behavior: "smooth"
    });

    campoTitulo.focus();
}


/*
    Fecha e limpa o formulário.
*/
function fecharFormulario() {
    formularioAtividade.reset();

    formularioContainer.classList.add(
        "oculto"
    );

    mensagemFormulario.textContent = "";
    mensagemFormulario.className = "";

    atividadeEmEdicaoId = null;
}


/*
    Obtém os valores digitados no formulário.
*/
function obterDadosFormulario() {
    return {
        titulo: campoTitulo.value.trim(),

        tipo: campoTipo.value,

        descricao:
            campoDescricao.value.trim() || null,

        data_hora_inicio:
            campoInicio.value,

        data_hora_fim:
            campoFim.value || null,

        local:
            campoLocal.value.trim() || null,

        observacoes:
            campoObservacoes.value.trim() || null
    };
}


/*
    Valida as datas antes de enviar para a API.
*/
function validarDatas(dados) {
    if (!dados.data_hora_inicio) {
        throw new Error(
            "Informe a data e o horário de início."
        );
    }

    if (
        dados.data_hora_fim &&
        new Date(dados.data_hora_fim) <
            new Date(dados.data_hora_inicio)
    ) {
        throw new Error(
            "A data final não pode ser anterior à data inicial."
        );
    }
}


/*
    Cadastra ou atualiza a atividade.
*/
async function salvarAtividade(evento) {
    evento.preventDefault();

    const estavaEditando =
        atividadeEmEdicaoId !== null;

    const idAtividadeEditada =
        atividadeEmEdicaoId;

    mensagemFormulario.textContent = "";
    mensagemFormulario.className = "";

    botaoSalvarAtividade.disabled = true;
    botaoSalvarAtividade.textContent =
        "Salvando...";

    try {
        const dados = obterDadosFormulario();

        validarDatas(dados);

        if (!estavaEditando) {
            await requisicaoAutenticada(
                "/atividades",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        ...dados,
                        igreja_id: igrejaId
                    })
                }
            );

            fecharFormulario();
            await carregarAtividades();

            mostrarMensagemPagina(
                "Atividade cadastrada com sucesso!",
                "sucesso"
            );
        } else {
            await requisicaoAutenticada(
                `/igrejas/${igrejaId}/atividades/` +
                `${idAtividadeEditada}`,
                {
                    method: "PATCH",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify(dados)
                }
            );

            fecharFormulario();
            await carregarAtividades();

            mostrarMensagemPagina(
                "Atividade atualizada com sucesso!",
                "sucesso"
            );
        }
    } catch (erro) {
        mensagemFormulario.textContent =
            erro.message;

        mensagemFormulario.className =
            "erro";
    } finally {
        botaoSalvarAtividade.disabled = false;

        botaoSalvarAtividade.textContent =
            estavaEditando
                ? "Salvar alterações"
                : "Salvar atividade";
    }
}


/*
    Abre o modal com os detalhes da atividade.
*/
function abrirDetalhesAtividade(atividadeId) {
    const atividade = atividades.find(
        function (item) {
            return item.id === atividadeId;
        }
    );

    if (!atividade) {
        mostrarMensagemPagina(
            "Atividade não encontrada.",
            "erro"
        );

        return;
    }

    atividadeSelecionada = atividade;

    detalheTitulo.textContent =
        atividade.titulo;

    detalheTipo.textContent =
        formatarTexto(atividade.tipo);

    detalheStatus.textContent =
        formatarTexto(atividade.status);

    detalheInicio.textContent =
        formatarDataHora(
            atividade.data_hora_inicio
        );

    detalheFim.textContent =
        formatarDataHora(
            atividade.data_hora_fim
        );

    detalheLocal.textContent =
        atividade.local || "Não informado";

    detalheDescricao.textContent =
        atividade.descricao || "Não informada";

    detalheObservacoes.textContent =
        atividade.observacoes || "Não informadas";

    detalheStatus.className =
        `status-atividade ` +
        `${classeStatus(atividade.status)}`;

    const estaCancelada =
        normalizarTexto(atividade.status) ===
        "cancelado";

    botaoCancelarAtividade.disabled =
        estaCancelada;

    botaoCancelarAtividade.textContent =
        estaCancelada
            ? "Atividade cancelada"
            : "Cancelar atividade";

    modalAtividade.classList.remove("oculto");
}


/*
    Fecha o modal de detalhes.
*/
function fecharModal() {
    modalAtividade.classList.add("oculto");

    atividadeSelecionada = null;
}


/*
    Cancela a atividade selecionada.
*/
async function cancelarAtividadeSelecionada() {
    if (!atividadeSelecionada) {
        return;
    }

    const idAtividade =
        atividadeSelecionada.id;

    const tituloAtividade =
        atividadeSelecionada.titulo;

    const confirmou = window.confirm(
        `Deseja cancelar a atividade ` +
        `"${tituloAtividade}"?`
    );

    if (!confirmou) {
        return;
    }

    botaoCancelarAtividade.disabled = true;

    botaoCancelarAtividade.textContent =
        "Cancelando...";

    try {
        await requisicaoAutenticada(
            `/igrejas/${igrejaId}/atividades/` +
            `${idAtividade}/cancelar`,
            {
                method: "PATCH"
            }
        );

        fecharModal();
        await carregarAtividades();

        mostrarMensagemPagina(
            "Atividade cancelada com sucesso!",
            "sucesso"
        );
    } catch (erro) {
        botaoCancelarAtividade.disabled = false;

        botaoCancelarAtividade.textContent =
            "Cancelar atividade";

        mostrarMensagemPagina(
            erro.message,
            "erro"
        );
    }
}


/*
    Abre a página de frequência da atividade.
*/
function abrirListaPresenca() {
    if (!atividadeSelecionada) {
        mostrarMensagemPagina(
            "Selecione uma atividade.",
            "erro"
        );

        return;
    }

    const idAtividade =
        atividadeSelecionada.id;

    sessionStorage.setItem(
        "atividade_id",
        String(idAtividade)
    );

    window.location.href =
        `frequencia.html?atividade_id=${idAtividade}`;
}


/*
    Encerra a sessão do usuário.
*/
function sairDoSistema() {
    sessionStorage.removeItem("access_token");
    sessionStorage.removeItem("igreja_id");
    sessionStorage.removeItem("perfil");
    sessionStorage.removeItem("atividade_id");

    window.location.href = "login.html";
}


/*
    Inicia a página.
*/
async function iniciarPaginaAtividades() {
    mensagemPagina.textContent = "";

    try {
        await carregarUsuario();
        await carregarAtividades();
    } catch (erro) {
        mostrarMensagemPagina(
            erro.message,
            "erro"
        );

        corpoTabela.innerHTML = `
            <tr>
                <td colspan="6">
                    Não foi possível carregar
                    as atividades.
                </td>
            </tr>
        `;
    }
}


/*
    Eventos dos botões e campos.
*/
botaoNovaAtividade.addEventListener(
    "click",
    abrirFormularioNovaAtividade
);

botaoFecharFormulario.addEventListener(
    "click",
    fecharFormulario
);

botaoCancelarFormulario.addEventListener(
    "click",
    fecharFormulario
);

formularioAtividade.addEventListener(
    "submit",
    salvarAtividade
);

pesquisaAtividade.addEventListener(
    "input",
    filtrarAtividades
);

filtroTipoAtividade.addEventListener(
    "change",
    filtrarAtividades
);

filtroStatusAtividade.addEventListener(
    "change",
    filtrarAtividades
);

corpoTabela.addEventListener(
    "click",
    function (evento) {
        const botao = evento.target.closest(
            "[data-acao='visualizar']"
        );

        if (!botao) {
            return;
        }

        abrirDetalhesAtividade(
            Number(botao.dataset.id)
        );
    }
);

botaoFecharModal.addEventListener(
    "click",
    fecharModal
);

botaoFecharModalRodape.addEventListener(
    "click",
    fecharModal
);

botaoEditarAtividade.addEventListener(
    "click",
    function () {
        if (atividadeSelecionada) {
            abrirFormularioEdicao(
                atividadeSelecionada
            );
        }
    }
);

botaoCancelarAtividade.addEventListener(
    "click",
    cancelarAtividadeSelecionada
);

botaoListaPresenca.addEventListener(
    "click",
    abrirListaPresenca
);

botaoSair.addEventListener(
    "click",
    sairDoSistema
);


/*
    Fecha o modal clicando fora dele.
*/
modalAtividade.addEventListener(
    "click",
    function (evento) {
        if (evento.target === modalAtividade) {
            fecharModal();
        }
    }
);


/*
    Fecha o modal com a tecla Escape.
*/
document.addEventListener(
    "keydown",
    function (evento) {
        if (
            evento.key === "Escape" &&
            !modalAtividade.classList.contains(
                "oculto"
            )
        ) {
            fecharModal();
        }
    }
);


iniciarPaginaAtividades();