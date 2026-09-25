const usuarioNome = document.querySelector("#usuario-nome");
const usuarioPerfil = document.querySelector("#usuario-perfil");
const usuarioAvatar = document.querySelector("#usuario-avatar");
const botaoSair = document.querySelector("#botao-sair");

const totalEntradas = document.querySelector(
    "#total-entradas-financeiro"
);
const totalSaidas = document.querySelector(
    "#total-saidas-financeiro"
);
const saldoFinanceiro = document.querySelector(
    "#saldo-financeiro"
);
const totalMovimentacoes = document.querySelector(
    "#total-movimentacoes-financeiro"
);
const totalDizimos = document.querySelector(
    "#total-dizimos-financeiro"
);
const totalOfertas = document.querySelector(
    "#total-ofertas-financeiro"
);
const totalDoacoes = document.querySelector(
    "#total-doacoes-financeiro"
);

const formularioFiltros = document.querySelector(
    "#form-filtros-financeiro"
);
const filtroDataInicio = document.querySelector(
    "#filtro-financeiro-data-inicio"
);
const filtroDataFim = document.querySelector(
    "#filtro-financeiro-data-fim"
);
const filtroTipo = document.querySelector(
    "#filtro-financeiro-tipo"
);
const filtroCategoria = document.querySelector(
    "#filtro-financeiro-categoria"
);
const botaoLimparFiltros = document.querySelector(
    "#botao-limpar-filtros-financeiro"
);

const pesquisaMovimentacao = document.querySelector(
    "#pesquisa-movimentacao"
);

const botaoRegistrarDizimo = document.querySelector(
    "#botao-registrar-dizimo"
);
const botaoRegistrarOferta = document.querySelector(
    "#botao-registrar-oferta"
);
const botaoRegistrarDespesa = document.querySelector(
    "#botao-registrar-despesa"
);
const botaoNovaMovimentacao = document.querySelector(
    "#botao-nova-movimentacao"
);

const formularioContainer = document.querySelector(
    "#formulario-movimentacao-container"
);
const tituloFormulario = document.querySelector(
    "#titulo-formulario-movimentacao"
);
const descricaoFormulario = document.querySelector(
    "#descricao-formulario-movimentacao"
);
const botaoFecharFormulario = document.querySelector(
    "#botao-fechar-formulario-movimentacao"
);
const botaoCancelarMovimentacao = document.querySelector(
    "#botao-cancelar-movimentacao"
);
const formularioMovimentacao = document.querySelector(
    "#form-movimentacao"
);
const botaoSalvarMovimentacao = document.querySelector(
    "#botao-salvar-movimentacao"
);
const mensagemFormulario = document.querySelector(
    "#mensagem-formulario-movimentacao"
);

const campoTipo = document.querySelector(
    "#movimentacao-tipo"
);
const campoCategoria = document.querySelector(
    "#movimentacao-categoria"
);
const campoValor = document.querySelector(
    "#movimentacao-valor"
);
const campoData = document.querySelector(
    "#movimentacao-data"
);
const campoPagamento = document.querySelector(
    "#movimentacao-pagamento"
);
const campoAtividade = document.querySelector(
    "#movimentacao-atividade"
);
const campoDescricao = document.querySelector(
    "#movimentacao-descricao"
);

const grupoMembro = document.querySelector(
    "#grupo-membro-movimentacao"
);
const buscaMembro = document.querySelector(
    "#movimentacao-busca-membro"
);
const campoMembro = document.querySelector(
    "#movimentacao-membro"
);
const indicadorMembroObrigatorio = document.querySelector(
    "#indicador-membro-obrigatorio"
);
const ajudaMembro = document.querySelector(
    "#ajuda-membro-movimentacao"
);

const grupoAnexo = document.querySelector(
    "#grupo-anexo-movimentacao"
);
const campoAnexo = document.querySelector(
    "#movimentacao-anexo"
);
const arquivoSelecionado = document.querySelector(
    "#arquivo-selecionado-financeiro"
);
const nomeArquivo = document.querySelector(
    "#nome-arquivo-financeiro"
);
const tamanhoArquivo = document.querySelector(
    "#tamanho-arquivo-financeiro"
);
const botaoRemoverAnexo = document.querySelector(
    "#botao-remover-anexo-financeiro"
);

const corpoTabela = document.querySelector(
    "#corpo-tabela-financeiro"
);
const quantidadeMovimentacoes = document.querySelector(
    "#quantidade-movimentacoes"
);
const mensagemPagina = document.querySelector(
    "#mensagem-pagina-financeiro"
);

let igrejaId = null;
let movimentacoes = [];
let membros = [];
let atividades = [];
let anexoAtual = null;


/* =========================================================
   FUNÇÕES DE FORMATAÇÃO
========================================================= */

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


function formatarDinheiro(valor) {
    const numero = Number(valor ?? 0);

    return numero.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });
}


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


function obterDataHoraAtual() {
    const agora = new Date();

    const ano = agora.getFullYear();

    const mes = String(
        agora.getMonth() + 1
    ).padStart(2, "0");

    const dia = String(
        agora.getDate()
    ).padStart(2, "0");

    const horas = String(
        agora.getHours()
    ).padStart(2, "0");

    const minutos = String(
        agora.getMinutes()
    ).padStart(2, "0");

    return `${ano}-${mes}-${dia}T${horas}:${minutos}`;
}


function formatarTamanhoArquivo(bytes) {
    if (bytes < 1024) {
        return `${bytes} bytes`;
    }

    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(
        bytes / (1024 * 1024)
    ).toFixed(1)} MB`;
}


/* =========================================================
   MENSAGENS
========================================================= */

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


function mostrarMensagemFormulario(
    mensagem,
    tipo = "erro"
) {
    mensagemFormulario.textContent = mensagem;
    mensagemFormulario.className = tipo;
}


/* =========================================================
   USUÁRIO
========================================================= */

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


/* =========================================================
   FILTROS
========================================================= */

function montarParametrosFiltros(
    incluirTipoECategoria = true
) {
    const parametros = new URLSearchParams();

    if (filtroDataInicio.value) {
        parametros.append(
            "data_inicio",
            filtroDataInicio.value
        );
    }

    if (filtroDataFim.value) {
        parametros.append(
            "data_fim",
            filtroDataFim.value
        );
    }

    if (incluirTipoECategoria) {
        if (filtroTipo.value) {
            parametros.append(
                "tipo",
                filtroTipo.value
            );
        }

        if (filtroCategoria.value) {
            parametros.append(
                "categoria",
                filtroCategoria.value
            );
        }
    }

    const consulta = parametros.toString();

    return consulta ? `?${consulta}` : "";
}


function validarPeriodo() {
    if (
        filtroDataInicio.value &&
        filtroDataFim.value &&
        filtroDataInicio.value > filtroDataFim.value
    ) {
        throw new Error(
            "A data inicial não pode ser maior que a data final."
        );
    }
}


/* =========================================================
   RESUMO FINANCEIRO
========================================================= */

async function carregarResumoFinanceiro() {
    const filtros = montarParametrosFiltros(false);

    const resumo = await requisicaoAutenticada(
        `/igrejas/${igrejaId}/financeiro/resumo${filtros}`
    );

    totalEntradas.textContent = formatarDinheiro(
        resumo.total_entradas
    );

    totalSaidas.textContent = formatarDinheiro(
        resumo.total_saidas
    );

    saldoFinanceiro.textContent = formatarDinheiro(
        resumo.saldo
    );

    totalMovimentacoes.textContent =
        resumo.total_movimentacoes;

    totalDizimos.textContent = formatarDinheiro(
        resumo.total_dizimos
    );

    totalOfertas.textContent = formatarDinheiro(
        resumo.total_ofertas
    );

    totalDoacoes.textContent = formatarDinheiro(
        resumo.total_doacoes
    );

    saldoFinanceiro.classList.remove(
        "saldo-positivo",
        "saldo-negativo"
    );

    if (Number(resumo.saldo) < 0) {
        saldoFinanceiro.classList.add(
            "saldo-negativo"
        );
    } else {
        saldoFinanceiro.classList.add(
            "saldo-positivo"
        );
    }
}


/* =========================================================
   MOVIMENTAÇÕES
========================================================= */

async function carregarMovimentacoes() {
    corpoTabela.innerHTML = `
        <tr>
            <td colspan="7">
                Carregando movimentações...
            </td>
        </tr>
    `;

    const filtros = montarParametrosFiltros(true);

    movimentacoes = await requisicaoAutenticada(
        `/igrejas/${igrejaId}/financeiro${filtros}`
    );

    filtrarPesquisaMovimentacoes();
}


function filtrarPesquisaMovimentacoes() {
    const pesquisa = normalizarTexto(
        pesquisaMovimentacao.value
    );

    const listaFiltrada = movimentacoes.filter(
        function (movimentacao) {
            const textoCompleto = normalizarTexto(
                `${movimentacao.descricao ?? ""} ` +
                `${movimentacao.categoria ?? ""} ` +
                `${movimentacao.tipo ?? ""} ` +
                `${movimentacao.forma_pagamento ?? ""} ` +
                `${movimentacao.valor ?? ""}`
            );

            return (
                pesquisa === "" ||
                textoCompleto.includes(pesquisa)
            );
        }
    );

    renderizarMovimentacoes(listaFiltrada);
}


function renderizarMovimentacoes(lista) {
    quantidadeMovimentacoes.textContent =
        `${lista.length} movimentação(ões) encontrada(s)`;

    if (lista.length === 0) {
        corpoTabela.innerHTML = `
            <tr>
                <td colspan="7">
                    Nenhuma movimentação encontrada.
                </td>
            </tr>
        `;

        return;
    }

    corpoTabela.innerHTML = lista
        .map(function (movimentacao) {
            const tipo = normalizarTexto(
                movimentacao.tipo
            );

            const sinal = tipo === "saida"
                ? "-"
                : "+";

            let comprovante = `
                <span class="sem-comprovante">
                    Não anexado
                </span>
            `;

            if (movimentacao.anexo_url) {
                comprovante = `
                    <button
                        type="button"
                        class="comprovante-financeiro"
                        data-anexo-url="${escaparHTML(movimentacao.anexo_url)}"
                    >
                        Baixar arquivo
                    </button>
                `;
            }

            return `
                <tr>
                    <td>
                        ${escaparHTML(
                            formatarDataHora(
                                movimentacao.data_movimentacao
                            )
                        )}
                    </td>

                    <td>
                        <span
                            class="tipo-movimentacao ${tipo}"
                        >
                            ${escaparHTML(
                                formatarTexto(
                                    movimentacao.tipo
                                )
                            )}
                        </span>
                    </td>

                    <td>
                        <span class="categoria-financeira">
                            ${escaparHTML(
                                formatarTexto(
                                    movimentacao.categoria
                                )
                            )}
                        </span>
                    </td>

                    <td>
                        <span
                            class="descricao-financeira"
                            title="${escaparHTML(
                                movimentacao.descricao ||
                                "Sem descrição"
                            )}"
                        >
                            ${escaparHTML(
                                movimentacao.descricao ||
                                "Sem descrição"
                            )}
                        </span>
                    </td>

                    <td>
                        <span class="forma-pagamento">
                            ${escaparHTML(
                                formatarTexto(
                                    movimentacao.forma_pagamento
                                )
                            )}
                        </span>
                    </td>

                    <td>
                        ${comprovante}
                    </td>

                    <td>
                        <strong
                            class="valor-financeiro ${tipo}"
                        >
                            ${sinal}
                            ${escaparHTML(
                                formatarDinheiro(
                                    movimentacao.valor
                                )
                            )}
                        </strong>
                    </td>
                </tr>
            `;
        })
        .join("");
}


/* =========================================================
   MEMBROS
========================================================= */

async function carregarMembros() {
    membros = await requisicaoAutenticada(
        `/igrejas/${igrejaId}/membros/resumo`
    );

    renderizarOpcoesMembros(membros);
}


function renderizarOpcoesMembros(lista) {
    const membroSelecionado = campoMembro.value;

    const opcoes = lista
        .sort(function (primeiro, segundo) {
            return primeiro.nome.localeCompare(
                segundo.nome,
                "pt-BR"
            );
        })
        .map(function (membro) {
            const selecionado =
                String(membro.id) === membroSelecionado
                    ? "selected"
                    : "";

            return `
                <option
                    value="${membro.id}"
                    ${selecionado}
                >
                    ${escaparHTML(membro.nome)}
                </option>
            `;
        })
        .join("");

    campoMembro.innerHTML = `
        <option value="">
            Nenhum membro selecionado
        </option>

        ${opcoes}
    `;
}


function pesquisarMembro() {
    const pesquisa = normalizarTexto(
        buscaMembro.value
    );

    const membrosFiltrados = membros.filter(
        function (membro) {
            return normalizarTexto(membro.nome).includes(
                pesquisa
            );
        }
    );

    renderizarOpcoesMembros(membrosFiltrados);
}


/* =========================================================
   ATIVIDADES
========================================================= */

async function carregarAtividades() {
    atividades = await requisicaoAutenticada(
        `/igrejas/${igrejaId}/atividades`
    );

    const opcoes = atividades
        .sort(function (primeira, segunda) {
            return (
                new Date(segunda.data_hora_inicio) -
                new Date(primeira.data_hora_inicio)
            );
        })
        .map(function (atividade) {
            return `
                <option value="${atividade.id}">
                    ${escaparHTML(atividade.titulo)}
                </option>
            `;
        })
        .join("");

    campoAtividade.innerHTML = `
        <option value="">
            Nenhuma atividade
        </option>

        ${opcoes}
    `;
}


/* =========================================================
   REGRAS DO FORMULÁRIO
========================================================= */

function atualizarCategoriasFormulario(
    categoriaSelecionada = ""
) {
    const tipo = campoTipo.value;

    let opcoes = `
        <option value="">
            Selecione
        </option>
    `;

    if (tipo === "entrada") {
        opcoes += `
            <option value="dizimo">Dízimo</option>
            <option value="oferta">Oferta</option>
            <option value="doacao">Doação</option>
            <option value="outro">Outro</option>
        `;

        campoTipo.classList.add("tipo-entrada");
        campoTipo.classList.remove("tipo-saida");
    } else if (tipo === "saida") {
        opcoes += `
            <option value="despesa">Despesa</option>
            <option value="outro">Outro</option>
        `;

        campoTipo.classList.add("tipo-saida");
        campoTipo.classList.remove("tipo-entrada");
    } else {
        opcoes += `
            <option value="dizimo">Dízimo</option>
            <option value="oferta">Oferta</option>
            <option value="doacao">Doação</option>
            <option value="despesa">Despesa</option>
            <option value="outro">Outro</option>
        `;

        campoTipo.classList.remove(
            "tipo-entrada",
            "tipo-saida"
        );
    }

    campoCategoria.innerHTML = opcoes;

    if (categoriaSelecionada) {
        campoCategoria.value = categoriaSelecionada;
    }

    atualizarRegrasCategoria();
}


function atualizarRegrasCategoria() {
    const categoria = campoCategoria.value;
    const tipo = campoTipo.value;

    const ehDizimo = categoria === "dizimo";

    const permiteMembro =
        tipo === "entrada" ||
        categoria === "dizimo" ||
        categoria === "oferta" ||
        categoria === "doacao";

    const permiteAnexo =
        tipo === "saida" &&
        categoria === "despesa";

    campoMembro.required = ehDizimo;

    if (ehDizimo) {
        grupoMembro.classList.remove("oculto");
        grupoMembro.classList.add(
            "membro-obrigatorio"
        );

        indicadorMembroObrigatorio.classList.remove(
            "oculto"
        );

        ajudaMembro.textContent =
            "Pesquise e selecione o membro que entregou o dízimo.";
    } else {
        grupoMembro.classList.remove(
            "membro-obrigatorio"
        );

        indicadorMembroObrigatorio.classList.add(
            "oculto"
        );

        ajudaMembro.textContent =
            "O membro é opcional para esta movimentação.";

        if (permiteMembro) {
            grupoMembro.classList.remove("oculto");
        } else {
            grupoMembro.classList.add("oculto");
            campoMembro.value = "";
            buscaMembro.value = "";
        }
    }

    if (permiteAnexo) {
        grupoAnexo.classList.remove("oculto");
    } else {
        grupoAnexo.classList.add("oculto");
        removerAnexo();
    }
}


/* =========================================================
   ABERTURA DO FORMULÁRIO
========================================================= */

function abrirFormularioConfigurado(
    tipo = "",
    categoria = ""
) {
    formularioMovimentacao.reset();

    removerAnexo();

    campoTipo.value = tipo;

    atualizarCategoriasFormulario(categoria);

    campoData.value = obterDataHoraAtual();

    renderizarOpcoesMembros(membros);

    buscaMembro.value = "";

    mostrarMensagemFormulario("");

    if (categoria === "dizimo") {
        tituloFormulario.textContent =
            "Registrar dízimo";

        descricaoFormulario.textContent =
            "Selecione o membro e informe os dados do dízimo.";
    } else if (categoria === "oferta") {
        tituloFormulario.textContent =
            "Registrar oferta";

        descricaoFormulario.textContent =
            "O vínculo com um membro é opcional.";
    } else if (categoria === "despesa") {
        tituloFormulario.textContent =
            "Registrar despesa";

        descricaoFormulario.textContent =
            "Você poderá anexar a nota fiscal ou o comprovante.";
    } else {
        tituloFormulario.textContent =
            "Nova movimentação";

        descricaoFormulario.textContent =
            "Selecione o tipo e a categoria da movimentação.";
    }

    formularioContainer.classList.remove("oculto");

    window.scrollTo({
        top: formularioContainer.offsetTop - 20,
        behavior: "smooth"
    });

    if (categoria === "dizimo") {
        buscaMembro.focus();
    } else {
        campoValor.focus();
    }
}


function fecharFormularioMovimentacao() {
    formularioMovimentacao.reset();

    campoTipo.classList.remove(
        "tipo-entrada",
        "tipo-saida"
    );

    removerAnexo();

    grupoMembro.classList.remove(
        "membro-obrigatorio"
    );

    indicadorMembroObrigatorio.classList.add(
        "oculto"
    );

    mostrarMensagemFormulario("");

    formularioContainer.classList.add("oculto");
}


/* =========================================================
   ANEXO
========================================================= */

function validarAnexo(arquivo) {
    const tamanhoMaximo = 5 * 1024 * 1024;

    const tiposPermitidos = [
        "application/pdf",
        "image/png",
        "image/jpeg"
    ];

    if (!tiposPermitidos.includes(arquivo.type)) {
        throw new Error(
            "O comprovante deve ser PDF, PNG, JPG ou JPEG."
        );
    }

    if (arquivo.size > tamanhoMaximo) {
        throw new Error(
            "O comprovante deve possuir no máximo 5 MB."
        );
    }
}


function selecionarAnexo() {
    const arquivo = campoAnexo.files[0];

    if (!arquivo) {
        removerAnexo();
        return;
    }

    try {
        validarAnexo(arquivo);

        anexoAtual = arquivo;

        nomeArquivo.textContent = arquivo.name;

        tamanhoArquivo.textContent =
            formatarTamanhoArquivo(arquivo.size);

        arquivoSelecionado.classList.remove("oculto");

        mostrarMensagemFormulario("");
    } catch (erro) {
        removerAnexo();

        mostrarMensagemFormulario(
            erro.message,
            "erro"
        );
    }
}


function removerAnexo() {
    anexoAtual = null;

    if (campoAnexo) {
        campoAnexo.value = "";
    }

    arquivoSelecionado.classList.add("oculto");

    nomeArquivo.textContent = "Arquivo";
    tamanhoArquivo.textContent = "0 KB";
}


/* =========================================================
   CADASTRO
========================================================= */

function converterIdOpcional(valor) {
    if (!valor) {
        return null;
    }

    return Number(valor);
}


async function salvarMovimentacao(evento) {
    evento.preventDefault();

    mostrarMensagemFormulario("");

    botaoSalvarMovimentacao.disabled = true;
    botaoSalvarMovimentacao.textContent = "Salvando...";

    try {
        const valor = Number(campoValor.value);

        if (!campoTipo.value) {
            throw new Error(
                "Selecione o tipo da movimentação."
            );
        }

        if (!campoCategoria.value) {
            throw new Error(
                "Selecione a categoria."
            );
        }

        if (!Number.isFinite(valor) || valor <= 0) {
            throw new Error(
                "Informe um valor maior que zero."
            );
        }

        if (!campoData.value) {
            throw new Error(
                "Informe a data da movimentação."
            );
        }

        if (
            campoCategoria.value === "dizimo" &&
            !campoMembro.value
        ) {
            throw new Error(
                "Selecione o membro relacionado ao dízimo."
            );
        }

        const dados = {
            tipo: campoTipo.value,
            categoria: campoCategoria.value,
            descricao:
                campoDescricao.value.trim() || null,
            valor: valor.toFixed(2),
            forma_pagamento:
                campoPagamento.value || null,
            data_movimentacao: campoData.value,
            membro_id: converterIdOpcional(
                campoMembro.value
            ),
            atividade_id: converterIdOpcional(
                campoAtividade.value
            )
        };

        if (anexoAtual) {
            const formulario = new FormData();

            for (const [chave, valorDado] of Object.entries(dados)) {
                if (valorDado !== null && valorDado !== undefined) {
                    formulario.append(chave, String(valorDado));
                }
            }

            formulario.append("anexo", anexoAtual);

            await requisicaoAutenticada(
                `/igrejas/${igrejaId}/financeiro/com-anexo`,
                {
                    method: "POST",
                    body: formulario
                }
            );
        } else {
            await requisicaoAutenticada(
                `/igrejas/${igrejaId}/financeiro`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(dados)
                }
            );
        }

        fecharFormularioMovimentacao();

        await Promise.all([
            carregarMovimentacoes(),
            carregarResumoFinanceiro()
        ]);

        mostrarMensagemPagina(
            "Movimentação cadastrada com sucesso!",
            "sucesso"
        );
    } catch (erro) {
        mostrarMensagemFormulario(
            erro.message,
            "erro"
        );
    } finally {
        botaoSalvarMovimentacao.disabled = false;

        botaoSalvarMovimentacao.textContent =
            "Salvar movimentação";
    }
}


async function baixarComprovanteMovimentacao(caminho) {
    try {
        await baixarArquivoAutenticado(
            caminho,
            "papper-comprovante"
        );
    } catch (erro) {
        mostrarMensagemPagina(
            erro.message,
            "erro"
        );
    }
}


corpoTabela.addEventListener("click", function (evento) {
    const botao = evento.target.closest("[data-anexo-url]");

    if (!botao) {
        return;
    }

    baixarComprovanteMovimentacao(
        botao.dataset.anexoUrl
    );
});


/* =========================================================
   APLICAÇÃO DOS FILTROS
========================================================= */

async function aplicarFiltros(evento) {
    evento.preventDefault();

    try {
        validarPeriodo();

        await Promise.all([
            carregarMovimentacoes(),
            carregarResumoFinanceiro()
        ]);
    } catch (erro) {
        mostrarMensagemPagina(
            erro.message,
            "erro"
        );
    }
}


async function limparFiltros() {
    formularioFiltros.reset();
    pesquisaMovimentacao.value = "";

    try {
        await Promise.all([
            carregarMovimentacoes(),
            carregarResumoFinanceiro()
        ]);
    } catch (erro) {
        mostrarMensagemPagina(
            erro.message,
            "erro"
        );
    }
}


/* =========================================================
   SAÍDA
========================================================= */

function sairDoSistema() {
    sessionStorage.removeItem("access_token");
    sessionStorage.removeItem("igreja_id");
    sessionStorage.removeItem("perfil");
    sessionStorage.removeItem("atividade_id");

    window.location.href = "login.html";
}


/* =========================================================
   INICIALIZAÇÃO
========================================================= */

async function iniciarPaginaFinanceiro() {
    try {
        await carregarUsuario();

        await Promise.all([
            carregarResumoFinanceiro(),
            carregarMovimentacoes(),
            carregarMembros(),
            carregarAtividades()
        ]);
    } catch (erro) {
        mostrarMensagemPagina(
            erro.message,
            "erro"
        );

        corpoTabela.innerHTML = `
            <tr>
                <td colspan="7">
                    Não foi possível carregar os dados financeiros.
                </td>
            </tr>
        `;
    }
}


/* =========================================================
   EVENTOS
========================================================= */

botaoRegistrarDizimo.addEventListener(
    "click",
    function () {
        abrirFormularioConfigurado(
            "entrada",
            "dizimo"
        );
    }
);

botaoRegistrarOferta.addEventListener(
    "click",
    function () {
        abrirFormularioConfigurado(
            "entrada",
            "oferta"
        );
    }
);

botaoRegistrarDespesa.addEventListener(
    "click",
    function () {
        abrirFormularioConfigurado(
            "saida",
            "despesa"
        );
    }
);

botaoNovaMovimentacao.addEventListener(
    "click",
    function () {
        abrirFormularioConfigurado();
    }
);

botaoFecharFormulario.addEventListener(
    "click",
    fecharFormularioMovimentacao
);

botaoCancelarMovimentacao.addEventListener(
    "click",
    fecharFormularioMovimentacao
);

campoTipo.addEventListener(
    "change",
    function () {
        atualizarCategoriasFormulario();
    }
);

campoCategoria.addEventListener(
    "change",
    atualizarRegrasCategoria
);

buscaMembro.addEventListener(
    "input",
    pesquisarMembro
);

campoAnexo.addEventListener(
    "change",
    selecionarAnexo
);

botaoRemoverAnexo.addEventListener(
    "click",
    removerAnexo
);

formularioMovimentacao.addEventListener(
    "submit",
    salvarMovimentacao
);

formularioFiltros.addEventListener(
    "submit",
    aplicarFiltros
);

botaoLimparFiltros.addEventListener(
    "click",
    limparFiltros
);

pesquisaMovimentacao.addEventListener(
    "input",
    filtrarPesquisaMovimentacoes
);

botaoSair.addEventListener(
    "click",
    sairDoSistema
);


iniciarPaginaFinanceiro();