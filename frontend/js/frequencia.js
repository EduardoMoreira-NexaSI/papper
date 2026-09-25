const usuarioNome = document.querySelector("#usuario-nome");
const usuarioPerfil = document.querySelector("#usuario-perfil");
const usuarioAvatar = document.querySelector("#usuario-avatar");
const botaoSair = document.querySelector("#botao-sair");

const atividadeTitulo = document.querySelector(
    "#atividade-presenca-titulo"
);
const atividadeInformacoes = document.querySelector(
    "#atividade-presenca-informacoes"
);
const atividadeStatus = document.querySelector(
    "#atividade-presenca-status"
);

const totalPresencas = document.querySelector("#total-presencas");
const totalPresentes = document.querySelector("#total-presentes");
const totalConfirmados = document.querySelector("#total-confirmados");
const totalAusentes = document.querySelector("#total-ausentes");
const totalJustificados = document.querySelector(
    "#total-justificados"
);

const pesquisaPresenca = document.querySelector(
    "#pesquisa-presenca"
);
const filtroPresenca = document.querySelector("#filtro-presenca");

const quantidadeMembros = document.querySelector(
    "#quantidade-membros-presenca"
);
const corpoTabela = document.querySelector(
    "#corpo-tabela-presencas"
);
const mensagemPagina = document.querySelector(
    "#mensagem-pagina-presencas"
);

const modalPresenca = document.querySelector(
    "#modal-registrar-presenca"
);
const modalPresencaNome = document.querySelector(
    "#modal-presenca-nome"
);
const botaoFecharModal = document.querySelector(
    "#botao-fechar-modal-presenca"
);
const botaoCancelarModal = document.querySelector(
    "#botao-cancelar-modal-presenca"
);
const formularioPresenca = document.querySelector("#form-presenca");
const campoStatus = document.querySelector("#presenca-status");
const campoObservacao = document.querySelector(
    "#presenca-observacao"
);
const botaoSalvarPresenca = document.querySelector(
    "#botao-salvar-presenca"
);
const mensagemFormulario = document.querySelector(
    "#mensagem-formulario-presenca"
);

let igrejaId = null;
let atividadeId = null;

let membros = [];
let presencas = [];

let membroSelecionado = null;
let presencaSelecionada = null;


/*
    Procura o ID da atividade na URL.

    Exemplo:
    frequencia.html?atividade_id=2
*/
function obterAtividadeId() {
    const parametros = new URLSearchParams(
        window.location.search
    );

    const idDaUrl = parametros.get("atividade_id");
    const idSalvo = sessionStorage.getItem("atividade_id");
    const idEncontrado = idDaUrl || idSalvo;

    if (!idEncontrado) {
        return null;
    }

    const idConvertido = Number(idEncontrado);

    if (
        Number.isNaN(idConvertido) ||
        idConvertido <= 0
    ) {
        return null;
    }

    sessionStorage.setItem(
        "atividade_id",
        String(idConvertido)
    );

    return idConvertido;
}


function escaparHTML(valor) {
    const elemento = document.createElement("div");

    elemento.textContent = valor ?? "";

    return elemento.innerHTML;
}


function normalizarTexto(valor) {
    return String(valor ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}


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


function formatarCPF(cpf) {
    const numeros = String(cpf ?? "").replace(/\D/g, "");

    if (numeros.length !== 11) {
        return cpf || "Não informado";
    }

    return numeros.replace(
        /(\d{3})(\d{3})(\d{3})(\d{2})/,
        "$1.$2.$3-$4"
    );
}


function formatarDataHora(valor) {
    if (!valor) {
        return "Data não informada";
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


function classeStatusAtividade(status) {
    const statusNormalizado = normalizarTexto(status);

    if (statusNormalizado === "realizado") {
        return "status-realizado";
    }

    if (statusNormalizado === "cancelado") {
        return "status-cancelado";
    }

    return "status-agendado";
}


function classeStatusPresenca(status) {
    const statusNormalizado = normalizarTexto(status);

    if (statusNormalizado === "presente") {
        return "presente";
    }

    if (statusNormalizado === "confirmado") {
        return "confirmado";
    }

    if (statusNormalizado === "ausente") {
        return "ausente";
    }

    if (statusNormalizado === "justificado") {
        return "justificado";
    }

    return "sem-registro";
}


function mostrarMensagemPagina(mensagem, tipo = "erro") {
    mensagemPagina.textContent = mensagem;
    mensagemPagina.className = tipo;

    if (mensagem) {
        setTimeout(function () {
            mensagemPagina.textContent = "";
            mensagemPagina.className = "";
        }, 5000);
    }
}


function mostrarMensagemFormulario(
    mensagem,
    tipo = "erro"
) {
    mensagemFormulario.textContent = mensagem;
    mensagemFormulario.className = tipo;
}


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
}


async function carregarAtividade() {
    const atividade = await requisicaoAutenticada(
        `/igrejas/${igrejaId}/atividades/${atividadeId}`
    );

    atividadeTitulo.textContent = atividade.titulo;

    const informacoes = [
        formatarDataHora(atividade.data_hora_inicio),
        atividade.local || "Local não informado",
        formatarTexto(atividade.tipo)
    ];

    atividadeInformacoes.textContent =
        informacoes.join(" • ");

    atividadeStatus.textContent = formatarTexto(
        atividade.status
    );

    atividadeStatus.className =
        `status-atividade ` +
        `${classeStatusAtividade(atividade.status)}`;
}


async function carregarMembros() {
    membros = await requisicaoAutenticada(
        `/igrejas/${igrejaId}/membros/resumo`
    );
}


async function carregarPresencas() {
    presencas = await requisicaoAutenticada(
        `/igrejas/${igrejaId}/atividades/` +
        `${atividadeId}/presencas`
    );
}


async function carregarResumo() {
    const resumo = await requisicaoAutenticada(
        `/igrejas/${igrejaId}/atividades/` +
        `${atividadeId}/resumo-presencas`
    );

    totalPresencas.textContent = resumo.total_registros;
    totalPresentes.textContent = resumo.presentes;
    totalConfirmados.textContent = resumo.confirmados;
    totalAusentes.textContent = resumo.ausentes;
    totalJustificados.textContent = resumo.justificados;
}


/*
    Une os dados do membro com o registro de presença.

    Caso o membro ainda não tenha presença registrada,
    a propriedade presenca recebe null.
*/
function juntarMembrosComPresencas() {
    return membros.map(function (membro) {
        const presenca = presencas.find(
            function (registro) {
                return registro.membro_id === membro.id;
            }
        );

        return {
            membro: membro,
            presenca: presenca || null
        };
    });
}


function filtrarRegistros() {
    const pesquisa = normalizarTexto(
        pesquisaPresenca.value
    );

    const situacao = normalizarTexto(
        filtroPresenca.value
    );

    const registros = juntarMembrosComPresencas();

    const registrosFiltrados = registros.filter(
        function (registro) {
            const membro = registro.membro;
            const presenca = registro.presenca;

            const correspondePesquisa =
                pesquisa === "" ||
                normalizarTexto(membro.nome).includes(
                    pesquisa
                ) ||
                String(membro.cpf).includes(pesquisa);

            let correspondeSituacao = true;

            if (
                situacao !== "" &&
                situacao !== "todos"
            ) {
                if (situacao === "sem_registro") {
                    correspondeSituacao =
                        presenca === null;
                } else {
                    correspondeSituacao =
                        presenca !== null &&
                        normalizarTexto(presenca.status) ===
                            situacao;
                }
            }

            return (
                correspondePesquisa &&
                correspondeSituacao
            );
        }
    );

    renderizarTabela(registrosFiltrados);
}


function renderizarTabela(registros) {
    quantidadeMembros.textContent =
        `${registros.length} membro(s) encontrado(s)`;

    if (registros.length === 0) {
        corpoTabela.innerHTML = `
            <tr>
                <td colspan="5">
                    Nenhum membro encontrado.
                </td>
            </tr>
        `;

        return;
    }

    corpoTabela.innerHTML = registros
        .map(function (registro) {
            const membro = registro.membro;
            const presenca = registro.presenca;

            const nomeSeguro = escaparHTML(membro.nome);
            const cpfSeguro = escaparHTML(
                formatarCPF(membro.cpf)
            );

            const status = presenca
                ? presenca.status
                : "sem_registro";

            const textoStatus = presenca
                ? formatarTexto(presenca.status)
                : "Sem registro";

            const observacao = presenca
                ? presenca.observacao || "Sem observação"
                : "—";

            const classeBotao = presenca
                ? "botao-editar-presenca"
                : "botao-registrar-presenca";

            const textoBotao = presenca
                ? "Editar"
                : "Registrar";

            const iniciais = membro.nome
                .trim()
                .charAt(0)
                .toUpperCase();

            return `
                <tr>
                    <td>
                        <div class="membro-presenca">
                            <div class="membro-presenca-avatar">
                                ${escaparHTML(iniciais)}
                            </div>

                            <div
                                class="membro-presenca-informacoes"
                            >
                                <strong>${nomeSeguro}</strong>

                                <span>
                                    ${membro.status
                                        ? "Membro ativo"
                                        : "Membro inativo"
                                    }
                                </span>
                            </div>
                        </div>
                    </td>

                    <td>${cpfSeguro}</td>

                    <td>
                        <span
                            class="status-presenca
                            ${classeStatusPresenca(status)}"
                        >
                            ${escaparHTML(textoStatus)}
                        </span>
                    </td>

                    <td>
                        ${escaparHTML(observacao)}
                    </td>

                    <td>
                        <button
                            type="button"
                            class="${classeBotao}"
                            data-acao="abrir-presenca"
                            data-membro-id="${membro.id}"
                        >
                            ${textoBotao}
                        </button>
                    </td>
                </tr>
            `;
        })
        .join("");
}


function abrirModalPresenca(membroId) {
    membroSelecionado = membros.find(
        function (membro) {
            return membro.id === membroId;
        }
    );

    if (!membroSelecionado) {
        mostrarMensagemPagina(
            "Membro não encontrado.",
            "erro"
        );

        return;
    }

    presencaSelecionada = presencas.find(
        function (presenca) {
            return presenca.membro_id === membroId;
        }
    ) || null;

    modalPresencaNome.textContent =
        membroSelecionado.nome;

    if (presencaSelecionada) {
        campoStatus.value =
            presencaSelecionada.status;

        campoObservacao.value =
            presencaSelecionada.observacao || "";

        botaoSalvarPresenca.textContent =
            "Salvar alteração";
    } else {
        campoStatus.value = "presente";
        campoObservacao.value = "";

        botaoSalvarPresenca.textContent =
            "Salvar frequência";
    }

    mostrarMensagemFormulario("");
    modalPresenca.classList.remove("oculto");
}


function fecharModalPresenca() {
    modalPresenca.classList.add("oculto");

    formularioPresenca.reset();

    membroSelecionado = null;
    presencaSelecionada = null;

    mostrarMensagemFormulario("");
}


async function atualizarDadosFrequencia() {
    await Promise.all([
        carregarPresencas(),
        carregarResumo()
    ]);

    filtrarRegistros();
}


async function salvarPresenca(evento) {
    evento.preventDefault();

    if (!membroSelecionado) {
        mostrarMensagemFormulario(
            "Nenhum membro foi selecionado."
        );

        return;
    }

    botaoSalvarPresenca.disabled = true;
    botaoSalvarPresenca.textContent = "Salvando...";

    mostrarMensagemFormulario("");

    const dados = {
        status: campoStatus.value,
        observacao:
            campoObservacao.value.trim() || null
    };

    try {
        if (presencaSelecionada) {
            await requisicaoAutenticada(
                `/igrejas/${igrejaId}/atividades/` +
                `${atividadeId}/presencas/` +
                `${presencaSelecionada.id}`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type":
                            "application/json"
                    },
                    body: JSON.stringify(dados)
                }
            );

            fecharModalPresenca();

            await atualizarDadosFrequencia();

            mostrarMensagemPagina(
                "Frequência atualizada com sucesso!",
                "sucesso"
            );
        } else {
            await requisicaoAutenticada(
                `/igrejas/${igrejaId}/atividades/` +
                `${atividadeId}/presencas`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/json"
                    },
                    body: JSON.stringify({
                        membro_id:
                            membroSelecionado.id,
                        ...dados
                    })
                }
            );

            fecharModalPresenca();

            await atualizarDadosFrequencia();

            mostrarMensagemPagina(
                "Frequência registrada com sucesso!",
                "sucesso"
            );
        }
    } catch (erro) {
        mostrarMensagemFormulario(
            erro.message,
            "erro"
        );
    } finally {
        botaoSalvarPresenca.disabled = false;

        botaoSalvarPresenca.textContent =
            presencaSelecionada
                ? "Salvar alteração"
                : "Salvar frequência";
    }
}


function sairDoSistema() {
    sessionStorage.removeItem("access_token");
    sessionStorage.removeItem("igreja_id");
    sessionStorage.removeItem("perfil");
    sessionStorage.removeItem("atividade_id");

    window.location.href = "login.html";
}


async function iniciarPaginaFrequencia() {
    atividadeId = obterAtividadeId();

    if (!atividadeId) {
        atividadeTitulo.textContent =
            "Nenhuma atividade selecionada";

        atividadeInformacoes.innerHTML = `
            Selecione uma atividade na página de
            <a href="atividades.html">Atividades</a>
            para controlar sua frequência.
        `;

        atividadeStatus.textContent =
            "Não selecionada";

        atividadeStatus.className =
            "status-atividade status-cancelado";

        corpoTabela.innerHTML = `
            <tr>
                <td colspan="5">
                    Selecione uma atividade para visualizar
                    a lista de frequência.
                </td>
            </tr>
        `;

        return;
    }

    corpoTabela.innerHTML = `
        <tr>
            <td colspan="5">
                Carregando frequência...
            </td>
        </tr>
    `;

    try {
        await carregarUsuario();

        await Promise.all([
            carregarAtividade(),
            carregarMembros(),
            carregarPresencas(),
            carregarResumo()
        ]);

        filtrarRegistros();
    } catch (erro) {
        mostrarMensagemPagina(
            erro.message,
            "erro"
        );

        corpoTabela.innerHTML = `
            <tr>
                <td colspan="5">
                    Não foi possível carregar a frequência.
                </td>
            </tr>
        `;
    }
}


pesquisaPresenca.addEventListener(
    "input",
    filtrarRegistros
);

filtroPresenca.addEventListener(
    "change",
    filtrarRegistros
);

corpoTabela.addEventListener(
    "click",
    function (evento) {
        const botao = evento.target.closest(
            "[data-acao='abrir-presenca']"
        );

        if (!botao) {
            return;
        }

        abrirModalPresenca(
            Number(botao.dataset.membroId)
        );
    }
);

formularioPresenca.addEventListener(
    "submit",
    salvarPresenca
);

botaoFecharModal.addEventListener(
    "click",
    fecharModalPresenca
);

botaoCancelarModal.addEventListener(
    "click",
    fecharModalPresenca
);

modalPresenca.addEventListener(
    "click",
    function (evento) {
        if (evento.target === modalPresenca) {
            fecharModalPresenca();
        }
    }
);

document.addEventListener(
    "keydown",
    function (evento) {
        if (
            evento.key === "Escape" &&
            !modalPresenca.classList.contains("oculto")
        ) {
            fecharModalPresenca();
        }
    }
);

botaoSair.addEventListener(
    "click",
    sairDoSistema
);

iniciarPaginaFrequencia();