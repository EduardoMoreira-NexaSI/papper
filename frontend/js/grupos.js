/* =========================================================
   GRUPOS — PAPPER
========================================================= */

const usuarioNome = document.querySelector("#usuario-nome");
const usuarioPerfil = document.querySelector("#usuario-perfil");
const usuarioAvatar = document.querySelector("#usuario-avatar");
const botaoSair = document.querySelector("#botao-sair");

const totalGruposAtivos = document.querySelector("#total-grupos-ativos");
const totalIntegrantes = document.querySelector("#total-integrantes");
const totalGruposSemLider = document.querySelector(
    "#total-grupos-sem-lider"
);

const pesquisaGrupo = document.querySelector("#pesquisa-grupo");
const filtroStatusGrupo = document.querySelector(
    "#filtro-status-grupo"
);

const botaoNovoGrupo = document.querySelector("#botao-novo-grupo");
const quantidadeGrupos = document.querySelector("#quantidade-grupos");
const listaGrupos = document.querySelector("#lista-grupos");

const formularioContainer = document.querySelector(
    "#formulario-grupo-container"
);

const formularioGrupo = document.querySelector("#form-grupo");

const tituloFormularioGrupo = document.querySelector(
    "#titulo-formulario-grupo"
);

const campoNomeGrupo = document.querySelector("#grupo-nome");
const campoDescricaoGrupo = document.querySelector("#grupo-descricao");
const campoLiderGrupo = document.querySelector("#grupo-lider");

const botaoFecharFormulario = document.querySelector(
    "#botao-fechar-formulario-grupo"
);

const botaoCancelarGrupo = document.querySelector(
    "#botao-cancelar-grupo"
);

const botaoSalvarGrupo = document.querySelector(
    "#botao-salvar-grupo"
);

const mensagemFormulario = document.querySelector(
    "#mensagem-formulario-grupo"
);

const detalhesContainer = document.querySelector(
    "#detalhes-grupo-container"
);

const detalhesGrupoNome = document.querySelector(
    "#detalhes-grupo-nome"
);

const detalhesGrupoDescricao = document.querySelector(
    "#detalhes-grupo-descricao"
);

const detalhesGrupoLider = document.querySelector(
    "#detalhes-grupo-lider"
);

const selecionarLiderGrupo = document.querySelector(
    "#selecionar-lider-grupo"
);

const selecionarMembroGrupo = document.querySelector(
    "#selecionar-membro-grupo"
);

const botaoDefinirLider = document.querySelector(
    "#botao-definir-lider"
);

const botaoRemoverLider = document.querySelector(
    "#botao-remover-lider"
);

const botaoAdicionarMembro = document.querySelector(
    "#botao-adicionar-membro-grupo"
);

const botaoFecharDetalhes = document.querySelector(
    "#botao-fechar-detalhes-grupo"
);

const corpoTabelaIntegrantes = document.querySelector(
    "#corpo-tabela-integrantes"
);

const mensagemDetalhes = document.querySelector(
    "#mensagem-detalhes-grupo"
);

const mensagemPagina = document.querySelector(
    "#mensagem-pagina-grupos"
);


/* =========================================================
   VARIÁVEIS
========================================================= */

let usuarioAtual = null;
let igrejaId = null;

let membrosCadastrados = [];
let gruposCadastrados = [];

let grupoEmEdicaoId = null;
let grupoSelecionadoId = null;


/* =========================================================
   FUNÇÕES AUXILIARES
========================================================= */

function escaparHTML(valor) {
    const elemento = document.createElement("div");

    elemento.textContent = valor ?? "";

    return elemento.innerHTML;
}


function podeGerenciarGrupos() {
    if (!usuarioAtual) {
        return false;
    }

    return [
        "administrador",
        "pastor"
    ].includes(usuarioAtual.perfil);
}


function exibirMensagem(elemento, texto, tipo = "erro") {
    elemento.textContent = texto;

    elemento.classList.remove(
        "mensagem-sucesso",
        "mensagem-erro"
    );

    if (!texto) {
        return;
    }

    if (tipo === "sucesso") {
        elemento.classList.add("mensagem-sucesso");
    } else {
        elemento.classList.add("mensagem-erro");
    }
}


function obterGrupo(grupoId) {
    return gruposCadastrados.find(function (grupo) {
        return grupo.id === Number(grupoId);
    });
}


function obterMembro(membroId) {
    return membrosCadastrados.find(function (membro) {
        return membro.id === Number(membroId);
    });
}


function obterNomeLider(grupo) {
    if (grupo.lider && grupo.lider.nome) {
        return grupo.lider.nome;
    }

    if (grupo.lider_id) {
        const membro = obterMembro(grupo.lider_id);

        if (membro) {
            return membro.nome;
        }
    }

    return "Não definido";
}


function rolarAte(elemento) {
    elemento.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}


/* =========================================================
   USUÁRIO
========================================================= */

async function carregarUsuario() {
    usuarioAtual = await requisicaoAutenticada(
        "/usuarios/eu"
    );

    igrejaId = obterIgrejaDoUsuario(usuarioAtual);

    usuarioNome.textContent = usuarioAtual.nome;
    usuarioPerfil.textContent = usuarioAtual.perfil;

    usuarioAvatar.textContent = usuarioAtual.nome
        .charAt(0)
        .toUpperCase();

    sessionStorage.setItem(
        "igreja_id",
        String(igrejaId)
    );

    if (!podeGerenciarGrupos()) {
        botaoNovoGrupo.classList.add("oculto");
    }
}


/* =========================================================
   MEMBROS
========================================================= */

async function carregarMembros() {
    membrosCadastrados = await requisicaoAutenticada(
        `/igrejas/${igrejaId}/membros`
    );

    preencherSeletoresMembros();
}


function preencherSeletoresMembros() {
    const membrosAtivos = membrosCadastrados
        .filter(function (membro) {
            return membro.status;
        })
        .sort(function (membroA, membroB) {
            return membroA.nome.localeCompare(
                membroB.nome,
                "pt-BR"
            );
        });

    const opcoes = membrosAtivos.map(function (membro) {
        return `
            <option value="${membro.id}">
                ${escaparHTML(membro.nome)}
            </option>
        `;
    }).join("");

    campoLiderGrupo.innerHTML = `
        <option value="">Sem líder definido</option>
        ${opcoes}
    `;

    selecionarLiderGrupo.innerHTML = `
        <option value="">Escolha um membro</option>
        ${opcoes}
    `;

    selecionarMembroGrupo.innerHTML = `
        <option value="">Selecione um membro</option>
        ${opcoes}
    `;
}


/* =========================================================
   CARREGAR GRUPOS
========================================================= */

async function carregarGrupos() {
    const gruposBasicos = await requisicaoAutenticada(
        `/igrejas/${igrejaId}/grupos?incluir_inativos=true`
    );

    gruposCadastrados = await Promise.all(
        gruposBasicos.map(async function (grupo) {
            try {
                return await requisicaoAutenticada(
                    `/igrejas/${igrejaId}/grupos/${grupo.id}`
                );
            } catch (erro) {
                return {
                    ...grupo,
                    membros: [],
                    lider: null
                };
            }
        })
    );

    atualizarResumo();
    filtrarGrupos();

    if (grupoSelecionadoId !== null) {
        const grupo = obterGrupo(grupoSelecionadoId);

        if (grupo) {
            renderizarDetalhesGrupo(grupo);
        }
    }
}


/* =========================================================
   RESUMO
========================================================= */

function atualizarResumo() {
    const gruposAtivos = gruposCadastrados.filter(
        function (grupo) {
            return grupo.ativo;
        }
    );

    const gruposSemLider = gruposAtivos.filter(
        function (grupo) {
            return !grupo.lider_id;
        }
    );

    const integrantesUnicos = new Set();

    gruposAtivos.forEach(function (grupo) {
        const integrantes = grupo.membros || [];

        integrantes.forEach(function (membro) {
            integrantesUnicos.add(membro.id);
        });
    });

    totalGruposAtivos.textContent = gruposAtivos.length;
    totalIntegrantes.textContent = integrantesUnicos.size;

    totalGruposSemLider.textContent =
        gruposSemLider.length;
}


/* =========================================================
   FILTROS
========================================================= */

function filtrarGrupos() {
    const pesquisa = pesquisaGrupo.value
        .trim()
        .toLowerCase();

    const statusSelecionado = filtroStatusGrupo.value;

    const gruposFiltrados = gruposCadastrados.filter(
        function (grupo) {
            const correspondePesquisa = grupo.nome
                .toLowerCase()
                .includes(pesquisa);

            let correspondeStatus = true;

            if (statusSelecionado === "ativos") {
                correspondeStatus = grupo.ativo;
            }

            if (statusSelecionado === "inativos") {
                correspondeStatus = !grupo.ativo;
            }

            return (
                correspondePesquisa &&
                correspondeStatus
            );
        }
    );

    renderizarGrupos(gruposFiltrados);
}


/* =========================================================
   RENDERIZAR GRUPOS
========================================================= */

function renderizarGrupos(grupos) {
    quantidadeGrupos.textContent =
        `${grupos.length} grupo(s) encontrado(s)`;

    if (grupos.length === 0) {
        listaGrupos.innerHTML = `
            <p class="estado-listagem">
                Nenhum grupo encontrado.
            </p>
        `;

        return;
    }

    listaGrupos.innerHTML = grupos.map(
        function (grupo) {
            const quantidadeIntegrantes =
                grupo.membros?.length || 0;

            const textoStatus = grupo.ativo
                ? "Ativo"
                : "Inativo";

            const classeInativo = grupo.ativo
                ? ""
                : "inativo";

            const textoBotaoStatus = grupo.ativo
                ? "Desativar"
                : "Reativar";

            const classeBotaoStatus = grupo.ativo
                ? ""
                : "reativar";

            let botoesGerenciamento = "";

            if (podeGerenciarGrupos()) {
                botoesGerenciamento = `
                    <button
                        type="button"
                        data-acao="editar"
                        data-grupo-id="${grupo.id}"
                    >
                        Editar
                    </button>

                    <button
                        type="button"
                        class="botao-status-grupo ${classeBotaoStatus}"
                        data-acao="status"
                        data-grupo-id="${grupo.id}"
                    >
                        ${textoBotaoStatus}
                    </button>
                `;
            }

            return `
                <article class="cartao-grupo ${classeInativo}">
                    <div class="cabecalho-cartao-grupo">
                        <h3>
                            ${escaparHTML(grupo.nome)}
                        </h3>

                        <span class="selo-status-grupo ${classeInativo}">
                            ${textoStatus}
                        </span>
                    </div>

                    <p class="descricao-cartao-grupo">
                        ${escaparHTML(
                            grupo.descricao ||
                            "Sem descrição cadastrada."
                        )}
                    </p>

                    <div class="informacoes-cartao-grupo">
                        <div>
                            <span>Líder</span>

                            <strong>
                                ${escaparHTML(
                                    obterNomeLider(grupo)
                                )}
                            </strong>
                        </div>

                        <div>
                            <span>Integrantes</span>

                            <strong>
                                ${quantidadeIntegrantes}
                            </strong>
                        </div>
                    </div>

                    <div class="acoes-cartao-grupo">
                        <button
                            type="button"
                            data-acao="detalhes"
                            data-grupo-id="${grupo.id}"
                        >
                            Ver integrantes
                        </button>

                        ${botoesGerenciamento}
                    </div>
                </article>
            `;
        }
    ).join("");
}


/* =========================================================
   FORMULÁRIO
========================================================= */

function abrirFormularioNovoGrupo() {
    grupoEmEdicaoId = null;

    formularioGrupo.reset();

    tituloFormularioGrupo.textContent =
        "Novo grupo";

    botaoSalvarGrupo.textContent =
        "Salvar grupo";

    exibirMensagem(mensagemFormulario, "");

    formularioContainer.classList.remove("oculto");

    rolarAte(formularioContainer);

    campoNomeGrupo.focus();
}


function abrirFormularioEdicao(grupoId) {
    const grupo = obterGrupo(grupoId);

    if (!grupo) {
        return;
    }

    grupoEmEdicaoId = grupo.id;

    tituloFormularioGrupo.textContent =
        "Editar grupo";

    botaoSalvarGrupo.textContent =
        "Salvar alterações";

    campoNomeGrupo.value = grupo.nome;

    campoDescricaoGrupo.value =
        grupo.descricao || "";

    campoLiderGrupo.value =
        grupo.lider_id || "";

    exibirMensagem(mensagemFormulario, "");

    formularioContainer.classList.remove("oculto");

    rolarAte(formularioContainer);
}


function fecharFormulario() {
    grupoEmEdicaoId = null;

    formularioGrupo.reset();

    formularioContainer.classList.add("oculto");

    exibirMensagem(mensagemFormulario, "");
}


/* =========================================================
   SALVAR GRUPO
========================================================= */

async function salvarGrupo(evento) {
    evento.preventDefault();

    const nome = campoNomeGrupo.value.trim();

    const descricao =
        campoDescricaoGrupo.value.trim() || null;

    const liderId = campoLiderGrupo.value
        ? Number(campoLiderGrupo.value)
        : null;

    if (nome.length < 2) {
        exibirMensagem(
            mensagemFormulario,
            "Informe um nome válido."
        );

        return;
    }

    botaoSalvarGrupo.disabled = true;

    try {
        if (grupoEmEdicaoId === null) {
            await requisicaoAutenticada(
                `/igrejas/${igrejaId}/grupos`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({
                        nome: nome,
                        descricao: descricao,
                        lider_id: liderId
                    })
                }
            );

            exibirMensagem(
                mensagemPagina,
                "Grupo criado com sucesso.",
                "sucesso"
            );
        } else {
            const grupoAnterior =
                obterGrupo(grupoEmEdicaoId);

            await requisicaoAutenticada(
                `/igrejas/${igrejaId}/grupos/${grupoEmEdicaoId}`,
                {
                    method: "PATCH",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({
                        nome: nome,
                        descricao: descricao
                    })
                }
            );

            const liderAnterior =
                grupoAnterior?.lider_id || null;

            if (liderAnterior !== liderId) {
                await requisicaoAutenticada(
                    `/igrejas/${igrejaId}/grupos/${grupoEmEdicaoId}/lider`,
                    {
                        method: "PATCH",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify({
                            lider_id: liderId
                        })
                    }
                );
            }

            exibirMensagem(
                mensagemPagina,
                "Grupo atualizado com sucesso.",
                "sucesso"
            );
        }

        fecharFormulario();

        await carregarGrupos();
    } catch (erro) {
        exibirMensagem(
            mensagemFormulario,
            erro.message
        );
    } finally {
        botaoSalvarGrupo.disabled = false;
    }
}


/* =========================================================
   DETALHES
========================================================= */

async function abrirDetalhes(grupoId) {
    try {
        grupoSelecionadoId = Number(grupoId);

        const grupo = await requisicaoAutenticada(
            `/igrejas/${igrejaId}/grupos/${grupoSelecionadoId}`
        );

        const indice = gruposCadastrados.findIndex(
            function (item) {
                return item.id === grupo.id;
            }
        );

        if (indice >= 0) {
            gruposCadastrados[indice] = grupo;
        }

        renderizarDetalhesGrupo(grupo);

        detalhesContainer.classList.remove("oculto");

        rolarAte(detalhesContainer);
    } catch (erro) {
        exibirMensagem(
            mensagemPagina,
            erro.message
        );
    }
}


function renderizarDetalhesGrupo(grupo) {
    detalhesGrupoNome.textContent = grupo.nome;

    detalhesGrupoDescricao.textContent =
        grupo.descricao ||
        "Sem descrição cadastrada.";

    detalhesGrupoLider.textContent =
        obterNomeLider(grupo);

    selecionarLiderGrupo.value =
        grupo.lider_id || "";

    const integrantes = grupo.membros || [];

    const idsIntegrantes = new Set(
        integrantes.map(function (membro) {
            return membro.id;
        })
    );

    Array.from(
        selecionarMembroGrupo.options
    ).forEach(function (opcao) {
        if (!opcao.value) {
            opcao.hidden = false;
            return;
        }

        opcao.hidden = idsIntegrantes.has(
            Number(opcao.value)
        );
    });

    selecionarMembroGrupo.value = "";

    if (integrantes.length === 0) {
        corpoTabelaIntegrantes.innerHTML = `
            <tr>
                <td colspan="4">
                    Este grupo ainda não possui integrantes.
                </td>
            </tr>
        `;
    } else {
        integrantes.sort(function (a, b) {
            return a.nome.localeCompare(
                b.nome,
                "pt-BR"
            );
        });

        corpoTabelaIntegrantes.innerHTML =
            integrantes.map(function (membro) {
                const membroEhLider =
                    membro.id === grupo.lider_id;

                let participacao = "Integrante";
                let botaoRemover = "—";

                if (membroEhLider) {
                    participacao = `
                        <span class="identificacao-lider">
                            Líder
                        </span>
                    `;
                }

                if (
                    podeGerenciarGrupos() &&
                    !membroEhLider
                ) {
                    botaoRemover = `
                        <button
                            type="button"
                            class="botao-remover-integrante"
                            data-membro-id="${membro.id}"
                        >
                            Remover
                        </button>
                    `;
                }

                return `
                    <tr>
                        <td>
                            <strong>
                                ${escaparHTML(membro.nome)}
                            </strong>
                        </td>

                        <td>
                            ${membro.status
                                ? "Ativo"
                                : "Inativo"
                            }
                        </td>

                        <td>${participacao}</td>

                        <td>${botaoRemover}</td>
                    </tr>
                `;
            }).join("");
    }

    const podeEditar = podeGerenciarGrupos();

    selecionarLiderGrupo.disabled =
        !podeEditar;

    selecionarMembroGrupo.disabled =
        !podeEditar || !grupo.ativo;

    botaoDefinirLider.classList.toggle(
        "oculto",
        !podeEditar
    );

    botaoRemoverLider.classList.toggle(
        "oculto",
        !podeEditar || !grupo.lider_id
    );

    botaoAdicionarMembro.classList.toggle(
        "oculto",
        !podeEditar || !grupo.ativo
    );
}


function fecharDetalhes() {
    grupoSelecionadoId = null;

    detalhesContainer.classList.add("oculto");

    exibirMensagem(mensagemDetalhes, "");
}


/* =========================================================
   DEFINIR LÍDER
========================================================= */

async function definirLider() {
    if (grupoSelecionadoId === null) {
        return;
    }

    const liderId = selecionarLiderGrupo.value;

    if (!liderId) {
        exibirMensagem(
            mensagemDetalhes,
            "Selecione o novo líder."
        );

        return;
    }

    try {
        await requisicaoAutenticada(
            `/igrejas/${igrejaId}/grupos/${grupoSelecionadoId}/lider`,
            {
                method: "PATCH",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    lider_id: Number(liderId)
                })
            }
        );

        exibirMensagem(
            mensagemDetalhes,
            "Líder definido com sucesso.",
            "sucesso"
        );

        await carregarGrupos();
    } catch (erro) {
        exibirMensagem(
            mensagemDetalhes,
            erro.message
        );
    }
}


async function removerLider() {
    if (grupoSelecionadoId === null) {
        return;
    }

    try {
        await requisicaoAutenticada(
            `/igrejas/${igrejaId}/grupos/${grupoSelecionadoId}/lider`,
            {
                method: "PATCH",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    lider_id: null
                })
            }
        );

        exibirMensagem(
            mensagemDetalhes,
            "Liderança removida com sucesso.",
            "sucesso"
        );

        await carregarGrupos();
    } catch (erro) {
        exibirMensagem(
            mensagemDetalhes,
            erro.message
        );
    }
}


/* =========================================================
   ADICIONAR MEMBRO
========================================================= */

async function adicionarMembroAoGrupo() {
    if (grupoSelecionadoId === null) {
        return;
    }

    const membroId =
        selecionarMembroGrupo.value;

    if (!membroId) {
        exibirMensagem(
            mensagemDetalhes,
            "Selecione um membro."
        );

        return;
    }

    try {
        await requisicaoAutenticada(
            `/igrejas/${igrejaId}/grupos/${grupoSelecionadoId}/membros`,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    membro_id: Number(membroId)
                })
            }
        );

        exibirMensagem(
            mensagemDetalhes,
            "Integrante adicionado com sucesso.",
            "sucesso"
        );

        await carregarGrupos();
    } catch (erro) {
        exibirMensagem(
            mensagemDetalhes,
            erro.message
        );
    }
}


/* =========================================================
   REQUISIÇÃO DELETE
========================================================= */

async function requisicaoSemConteudo(
    caminho,
    opcoes = {}
) {
    const token = obterToken();

    const resposta = await fetch(
        `${API_URL}${caminho}`,
        {
            ...opcoes,

            headers: {
                ...opcoes.headers,
                Authorization: `Bearer ${token}`
            }
        }
    );

    if (resposta.status === 401) {
        sessionStorage.removeItem("access_token");
        sessionStorage.removeItem("igreja_id");
  sessionStorage.removeItem("perfil");

        window.location.href = "./login.html";

        throw new Error(
            "Sua sessão expirou."
        );
    }

    if (!resposta.ok) {
        let mensagem =
            "Não foi possível concluir a operação.";

        try {
            const dados = await resposta.json();

            mensagem =
                dados.detail || mensagem;
        } catch (erro) {
            // A resposta não contém JSON.
        }

        throw new Error(mensagem);
    }
}


/* =========================================================
   REMOVER MEMBRO
========================================================= */

async function removerMembroDoGrupo(membroId) {
    if (grupoSelecionadoId === null) {
        return;
    }

    const membro = obterMembro(membroId);

    const confirmou = window.confirm(
        `Deseja remover ${
            membro?.nome || "este membro"
        } do grupo?`
    );

    if (!confirmou) {
        return;
    }

    try {
        await requisicaoSemConteudo(
            `/igrejas/${igrejaId}/grupos/${grupoSelecionadoId}/membros/${membroId}`,
            {
                method: "DELETE"
            }
        );

        exibirMensagem(
            mensagemDetalhes,
            "Integrante removido com sucesso.",
            "sucesso"
        );

        await carregarGrupos();
    } catch (erro) {
        exibirMensagem(
            mensagemDetalhes,
            erro.message
        );
    }
}


/* =========================================================
   ATIVAR OU DESATIVAR
========================================================= */

async function alterarStatusGrupo(grupoId) {
    const grupo = obterGrupo(grupoId);

    if (!grupo) {
        return;
    }

    const acao = grupo.ativo
        ? "desativar"
        : "reativar";

    const confirmou = window.confirm(
        `Deseja ${acao} o grupo ${grupo.nome}?`
    );

    if (!confirmou) {
        return;
    }

    try {
        await requisicaoAutenticada(
            `/igrejas/${igrejaId}/grupos/${grupo.id}/${acao}`,
            {
                method: "PATCH"
            }
        );

        exibirMensagem(
            mensagemPagina,
            grupo.ativo
                ? "Grupo desativado com sucesso."
                : "Grupo reativado com sucesso.",
            "sucesso"
        );

        await carregarGrupos();
    } catch (erro) {
        exibirMensagem(
            mensagemPagina,
            erro.message
        );
    }
}


/* =========================================================
   EVENTOS
========================================================= */

botaoNovoGrupo.addEventListener(
    "click",
    abrirFormularioNovoGrupo
);

botaoFecharFormulario.addEventListener(
    "click",
    fecharFormulario
);

botaoCancelarGrupo.addEventListener(
    "click",
    fecharFormulario
);

formularioGrupo.addEventListener(
    "submit",
    salvarGrupo
);

pesquisaGrupo.addEventListener(
    "input",
    filtrarGrupos
);

filtroStatusGrupo.addEventListener(
    "change",
    filtrarGrupos
);

listaGrupos.addEventListener(
    "click",
    function (evento) {
        const botao = evento.target.closest(
            "button[data-acao]"
        );

        if (!botao) {
            return;
        }

        const grupoId = Number(
            botao.dataset.grupoId
        );

        const acao = botao.dataset.acao;

        if (acao === "detalhes") {
            abrirDetalhes(grupoId);
        }

        if (acao === "editar") {
            abrirFormularioEdicao(grupoId);
        }

        if (acao === "status") {
            alterarStatusGrupo(grupoId);
        }
    }
);

corpoTabelaIntegrantes.addEventListener(
    "click",
    function (evento) {
        const botao = evento.target.closest(
            ".botao-remover-integrante"
        );

        if (!botao) {
            return;
        }

        removerMembroDoGrupo(
            Number(botao.dataset.membroId)
        );
    }
);

botaoDefinirLider.addEventListener(
    "click",
    definirLider
);

botaoRemoverLider.addEventListener(
    "click",
    removerLider
);

botaoAdicionarMembro.addEventListener(
    "click",
    adicionarMembroAoGrupo
);

botaoFecharDetalhes.addEventListener(
    "click",
    fecharDetalhes
);

botaoSair.addEventListener(
    "click",
    function () {
        sessionStorage.removeItem(
            "access_token"
        );

        sessionStorage.removeItem(
            "igreja_id"
        );

        window.location.href =
            "./login.html";
    }
);


/* =========================================================
   INICIAR PÁGINA
========================================================= */

async function iniciarPagina() {
    try {
        await carregarUsuario();
        await carregarMembros();
        await carregarGrupos();
    } catch (erro) {
        exibirMensagem(
            mensagemPagina,
            erro.message
        );

        listaGrupos.innerHTML = `
            <p class="estado-listagem">
                Não foi possível carregar os grupos.
            </p>
        `;
    }
}

iniciarPagina();