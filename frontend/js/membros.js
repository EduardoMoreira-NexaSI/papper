/* ==============================
   ELEMENTOS DA PÁGINA
================================= */

const usuarioNome = document.querySelector("#usuario-nome");
const usuarioPerfil = document.querySelector("#usuario-perfil");
const usuarioAvatar = document.querySelector("#usuario-avatar");

const corpoTabela = document.querySelector("#corpo-tabela-membros");
const quantidadeMembros = document.querySelector("#quantidade-membros");
const pesquisaMembro = document.querySelector("#pesquisa-membro");
const filtroStatus = document.querySelector("#filtro-status");

const formularioContainer = document.querySelector(
    "#formulario-membro-container"
);

const formularioMembro = document.querySelector("#form-membro");

const tituloFormularioMembro = document.querySelector(
    "#titulo-formulario-membro"
);

const botaoNovoMembro = document.querySelector("#botao-novo-membro");

const botaoFecharFormulario = document.querySelector(
    "#botao-fechar-formulario"
);

const botaoCancelar = document.querySelector("#botao-cancelar");
const botaoSalvar = document.querySelector("#botao-salvar-membro");
const botaoSair = document.querySelector("#botao-sair");

const mensagemFormulario = document.querySelector(
    "#mensagem-formulario"
);

const mensagemPagina = document.querySelector("#mensagem-pagina");

/* Elementos da ficha */

const modalFicha = document.querySelector("#modal-ficha");

const botaoFecharFicha = document.querySelector(
    "#botao-fechar-ficha"
);

const botaoFecharFichaRodape = document.querySelector(
    "#botao-fechar-ficha-rodape"
);

const botaoEditarFicha = document.querySelector(
    "#botao-editar-ficha"
);

const botaoAlterarStatus = document.querySelector(
    "#botao-alterar-status"
);

/* Campos do formulário */

const campoNome = document.querySelector("#membro-nome");
const campoCPF = document.querySelector("#membro-cpf");
const campoNascimento = document.querySelector("#membro-nascimento");
const campoContato = document.querySelector("#membro-contato");
const campoCEP = document.querySelector("#membro-cep");
const campoLogradouro = document.querySelector("#membro-logradouro");
const campoNumero = document.querySelector("#membro-numero");
const campoComplemento = document.querySelector("#membro-complemento");
const campoBairro = document.querySelector("#membro-bairro");
const campoCidade = document.querySelector("#membro-cidade");
const campoEstado = document.querySelector("#membro-estado");
const campoReferencia = document.querySelector("#membro-referencia");

/* Variáveis de controle */

let membrosCadastrados = [];
let igrejaId = null;
let membroEmEdicaoId = null;
let membroFichaAtual = null;

/* ==============================
   FORMATAÇÃO
================================= */

function escaparHTML(valor) {
    const elemento = document.createElement("div");

    elemento.textContent = valor ?? "—";

    return elemento.innerHTML;
}

function formatarCPF(cpf) {
    const numeros = String(cpf || "").replace(/\D/g, "");

    if (numeros.length !== 11) {
        return cpf || "Não informado";
    }

    return numeros.replace(
        /(\d{3})(\d{3})(\d{3})(\d{2})/,
        "$1.$2.$3-$4"
    );
}

function formatarCEP(cep) {
    const numeros = String(cep || "").replace(/\D/g, "");

    if (numeros.length !== 8) {
        return cep || "Não informado";
    }

    return numeros.replace(
        /(\d{5})(\d{3})/,
        "$1-$2"
    );
}

function formatarData(data) {
    if (!data) {
        return "Não informada";
    }

    const partes = data.split("-");

    if (partes.length !== 3) {
        return data;
    }

    return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function valorOuNulo(valor) {
    const texto = valor.trim();

    return texto || null;
}

function valorOuNaoInformado(valor) {
    return valor || "Não informado";
}

/* ==============================
   USUÁRIO
================================= */

async function carregarUsuario() {
    const usuario = await requisicaoAutenticada("/usuarios/eu");

    usuarioNome.textContent = usuario.nome;
    usuarioPerfil.textContent = usuario.perfil;

    usuarioAvatar.textContent = usuario.nome
        .charAt(0)
        .toUpperCase();

    igrejaId = obterIgrejaDoUsuario(usuario);

    sessionStorage.setItem(
        "igreja_id",
        String(igrejaId)
    );
}

/* ==============================
   LISTAGEM
================================= */

function renderizarMembros(lista) {
    quantidadeMembros.textContent =
        `${lista.length} membro(s) encontrado(s)`;

    if (lista.length === 0) {
        corpoTabela.innerHTML = `
            <tr>
                <td colspan="7">
                    Nenhum membro encontrado.
                </td>
            </tr>
        `;

        return;
    }

    corpoTabela.innerHTML = lista.map(function (membro) {
        const classeStatus = membro.status
            ? "status-ativo"
            : "status-inativo";

        const textoStatus = membro.status
            ? "Ativo"
            : "Inativo";

        return `
            <tr>
                <td>
                    <strong>
                        ${escaparHTML(membro.nome)}
                    </strong>
                </td>

                <td>
                    ${escaparHTML(formatarCPF(membro.cpf))}
                </td>

                <td>
                    ${escaparHTML(
                        formatarData(membro.data_nascimento)
                    )}
                </td>

                <td>
                    ${escaparHTML(membro.contato)}
                </td>

                <td>
                    ${escaparHTML(membro.cargo || "Sem cargo")}
                </td>

                <td>
                    <span class="status-membro ${classeStatus}">
                        ${textoStatus}
                    </span>
                </td>

                <td>
                    <button
                        type="button"
                        class="botao-ver-ficha"
                        data-membro-id="${membro.id}"
                    >
                        Ver ficha
                    </button>
                </td>
            </tr>
        `;
    }).join("");
}

async function carregarMembros() {
    membrosCadastrados = await requisicaoAutenticada(
        `/igrejas/${igrejaId}/membros`
    );

    filtrarMembros();
}

/* ==============================
   PESQUISA E FILTRO
================================= */

function filtrarMembros() {
    const pesquisa = pesquisaMembro.value
        .trim()
        .toLowerCase();

    const pesquisaNumerica = pesquisa.replace(/\D/g, "");
    const statusSelecionado = filtroStatus.value;

    const membrosFiltrados = membrosCadastrados.filter(
        function (membro) {
            const nome = membro.nome.toLowerCase();
            const cpf = String(membro.cpf);

            const encontrouNome = nome.includes(pesquisa);

            const encontrouCPF =
                pesquisaNumerica !== "" &&
                cpf.includes(pesquisaNumerica);

            const correspondePesquisa =
                pesquisa === "" ||
                encontrouNome ||
                encontrouCPF;

            let correspondeStatus = true;

            if (statusSelecionado === "ativos") {
                correspondeStatus = membro.status === true;
            }

            if (statusSelecionado === "inativos") {
                correspondeStatus = membro.status === false;
            }

            return correspondePesquisa && correspondeStatus;
        }
    );

    renderizarMembros(membrosFiltrados);
}

pesquisaMembro.addEventListener("input", filtrarMembros);
filtroStatus.addEventListener("change", filtrarMembros);

/* ==============================
   FORMULÁRIO
================================= */

function abrirFormulario() {
    membroEmEdicaoId = null;

    formularioMembro.reset();

    campoCPF.disabled = false;

    tituloFormularioMembro.textContent = "Novo membro";
    botaoSalvar.textContent = "Salvar membro";

    mensagemFormulario.textContent = "";
    mensagemFormulario.className = "";

    formularioContainer.classList.remove("oculto");

    campoNome.focus();
}

function fecharFormulario() {
    formularioContainer.classList.add("oculto");

    formularioMembro.reset();

    membroEmEdicaoId = null;
    campoCPF.disabled = false;

    tituloFormularioMembro.textContent = "Novo membro";
    botaoSalvar.textContent = "Salvar membro";

    mensagemFormulario.textContent = "";
    mensagemFormulario.className = "";
}

function abrirFormularioEdicao(membro) {
    membroEmEdicaoId = membro.id;

    campoNome.value = membro.nome || "";
    campoCPF.value = membro.cpf || "";
    campoNascimento.value = membro.data_nascimento || "";
    campoContato.value = membro.contato || "";
    campoCEP.value = membro.cep || "";
    campoLogradouro.value = membro.logradouro || "";
    campoNumero.value = membro.numero || "";
    campoComplemento.value = membro.complemento || "";
    campoBairro.value = membro.bairro || "";
    campoCidade.value = membro.cidade || "";
    campoEstado.value = membro.estado || "";
    campoReferencia.value = membro.referencia || "";

    /*
        O CPF não será alterado porque ele é o
        identificador único do membro.
    */
    campoCPF.disabled = true;

    tituloFormularioMembro.textContent = "Editar membro";
    botaoSalvar.textContent = "Salvar alterações";

    mensagemFormulario.textContent = "";
    mensagemFormulario.className = "";

    fecharFicha();

    formularioContainer.classList.remove("oculto");

    formularioContainer.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

    campoNome.focus();
}

botaoNovoMembro.addEventListener(
    "click",
    abrirFormulario
);

botaoFecharFormulario.addEventListener(
    "click",
    fecharFormulario
);

botaoCancelar.addEventListener(
    "click",
    fecharFormulario
);

/* ==============================
   CADASTRAR OU EDITAR
================================= */

formularioMembro.addEventListener(
    "submit",
    async function (evento) {
        evento.preventDefault();

        const nome = campoNome.value.trim();
        const cpf = campoCPF.value.replace(/\D/g, "");
        const dataNascimento = campoNascimento.value;
        const contato = campoContato.value.trim();
        const cep = campoCEP.value.replace(/\D/g, "");
        const logradouro = campoLogradouro.value;
        const numero = campoNumero.value;
        const complemento = campoComplemento.value;
        const bairro = campoBairro.value;
        const cidade = campoCidade.value;

        const estado = campoEstado.value
            .trim()
            .toUpperCase();

        const referencia = campoReferencia.value;

        if (cpf.length !== 11) {
            mensagemFormulario.textContent =
                "O CPF precisa possuir exatamente 11 números.";

            mensagemFormulario.className = "mensagem-erro";
            return;
        }

        if (cep !== "" && cep.length !== 8) {
            mensagemFormulario.textContent =
                "O CEP precisa possuir exatamente 8 números.";

            mensagemFormulario.className = "mensagem-erro";
            return;
        }

        if (estado !== "" && estado.length !== 2) {
            mensagemFormulario.textContent =
                "O estado deve possuir uma sigla com 2 letras.";

            mensagemFormulario.className = "mensagem-erro";
            return;
        }

        const dadosMembro = {
            nome: nome,
            cpf: cpf,
            data_nascimento: dataNascimento || null,
            contato: contato,
            cep: cep || null,
            logradouro: valorOuNulo(logradouro),
            numero: valorOuNulo(numero),
            complemento: valorOuNulo(complemento),
            bairro: valorOuNulo(bairro),
            cidade: valorOuNulo(cidade),
            estado: estado || null,
            referencia: valorOuNulo(referencia)
        };

        const estaEditando = membroEmEdicaoId !== null;

        const endereco = estaEditando
            ? `/igrejas/${igrejaId}/membros/${membroEmEdicaoId}`
            : `/igrejas/${igrejaId}/membros`;

        const metodo = estaEditando
            ? "PATCH"
            : "POST";

        const dadosEnviar = {
            ...dadosMembro
        };

        /*
            O schema MembroAtualizar não recebe o CPF.
        */
        if (estaEditando) {
            delete dadosEnviar.cpf;
        }

        botaoSalvar.disabled = true;

        botaoSalvar.textContent = estaEditando
            ? "Atualizando..."
            : "Salvando...";

        mensagemFormulario.textContent = "";
        mensagemFormulario.className = "";

        try {
            await requisicaoAutenticada(
                endereco,
                {
                    method: metodo,
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(dadosEnviar)
                }
            );

            mensagemFormulario.textContent = estaEditando
                ? "Ficha atualizada com sucesso!"
                : "Membro cadastrado com sucesso!";

            mensagemFormulario.className =
                "mensagem-sucesso";

            await carregarMembros();

            setTimeout(fecharFormulario, 900);
        } catch (erro) {
            mensagemFormulario.textContent = erro.message;
            mensagemFormulario.className = "mensagem-erro";
        } finally {
            botaoSalvar.disabled = false;

            botaoSalvar.textContent = estaEditando
                ? "Salvar alterações"
                : "Salvar membro";
        }
    }
);

/* ==============================
   FICHA DO MEMBRO
================================= */

function montarLogradouro(membro) {
    if (!membro.logradouro) {
        return "Não informado";
    }

    const numero = membro.numero || "s/n";

    return `${membro.logradouro}, ${numero}`;
}

function montarCidade(membro) {
    if (!membro.cidade && !membro.estado) {
        return "Não informada";
    }

    if (membro.cidade && membro.estado) {
        return `${membro.cidade} - ${membro.estado}`;
    }

    return membro.cidade || membro.estado;
}

function fecharFicha() {
    modalFicha.classList.add("oculto");
}

async function abrirFicha(membroId) {
    modalFicha.classList.remove("oculto");

    document.querySelector("#ficha-nome").textContent =
        "Carregando...";

    try {
        const membro = await requisicaoAutenticada(
            `/igrejas/${igrejaId}/membros/${membroId}`
        );

        membroFichaAtual = membro;

        botaoAlterarStatus.textContent = membro.status
            ? "Desativar membro"
            : "Ativar membro";

        document.querySelector("#ficha-avatar").textContent =
            membro.nome.charAt(0).toUpperCase();

        document.querySelector("#ficha-nome").textContent =
            membro.nome;

        const fichaStatus = document.querySelector(
            "#ficha-status"
        );

        fichaStatus.textContent = membro.status
            ? "Membro ativo"
            : "Membro inativo";

        fichaStatus.className = membro.status
            ? "status-membro status-ativo"
            : "status-membro status-inativo";

        document.querySelector("#ficha-cpf").textContent =
            formatarCPF(membro.cpf);

        document.querySelector("#ficha-nascimento").textContent =
            formatarData(membro.data_nascimento);

        document.querySelector("#ficha-contato").textContent =
            valorOuNaoInformado(membro.contato);

        document.querySelector("#ficha-cargo").textContent =
            valorOuNaoInformado(membro.cargo);

        document.querySelector("#ficha-cep").textContent =
            formatarCEP(membro.cep);

        document.querySelector("#ficha-logradouro").textContent =
            montarLogradouro(membro);

        document.querySelector("#ficha-bairro").textContent =
            valorOuNaoInformado(membro.bairro);

        document.querySelector("#ficha-cidade").textContent =
            montarCidade(membro);

        document.querySelector("#ficha-complemento").textContent =
            valorOuNaoInformado(membro.complemento);

        document.querySelector("#ficha-referencia").textContent =
            valorOuNaoInformado(membro.referencia);
    } catch (erro) {
        document.querySelector("#ficha-nome").textContent =
            erro.message;
    }
}

/* Abre a ficha através da tabela */

corpoTabela.addEventListener("click", function (evento) {
    const botao = evento.target.closest(".botao-ver-ficha");

    if (!botao) {
        return;
    }

    const membroId = botao.dataset.membroId;

    abrirFicha(membroId);
});

/* Editar ficha */

botaoEditarFicha.addEventListener("click", function () {
    if (!membroFichaAtual) {
        return;
    }

    abrirFormularioEdicao(membroFichaAtual);
});

/* Ativar ou desativar membro */

botaoAlterarStatus.addEventListener(
    "click",
    async function () {
        if (!membroFichaAtual) {
            return;
        }

        const novoStatus = !membroFichaAtual.status;

        const acao = novoStatus
            ? "ativar"
            : "desativar";

        const confirmou = window.confirm(
            `Deseja realmente ${acao} o membro ${membroFichaAtual.nome}?`
        );

        if (!confirmou) {
            return;
        }

        botaoAlterarStatus.disabled = true;
        botaoAlterarStatus.textContent = "Atualizando...";

        try {
            const membroAtualizado =
                await requisicaoAutenticada(
                    `/igrejas/${igrejaId}/membros/${membroFichaAtual.id}`,
                    {
                        method: "PATCH",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            status: novoStatus
                        })
                    }
                );

            await carregarMembros();
            await abrirFicha(membroAtualizado.id);
        } catch (erro) {
            mensagemPagina.textContent = erro.message;

            botaoAlterarStatus.textContent = novoStatus
                ? "Ativar membro"
                : "Desativar membro";
        } finally {
            botaoAlterarStatus.disabled = false;
        }
    }
);

/* Fechar ficha */

botaoFecharFicha.addEventListener(
    "click",
    fecharFicha
);

botaoFecharFichaRodape.addEventListener(
    "click",
    fecharFicha
);

modalFicha.addEventListener("click", function (evento) {
    if (evento.target === modalFicha) {
        fecharFicha();
    }
});

document.addEventListener("keydown", function (evento) {
    if (evento.key === "Escape") {
        fecharFicha();
    }
});

/* ==============================
   SAIR
================================= */

botaoSair.addEventListener("click", function () {
    sessionStorage.removeItem("access_token");
    sessionStorage.removeItem("igreja_id");
  sessionStorage.removeItem("perfil");

    window.location.href = "./login.html";
});

/* ==============================
   INICIALIZAÇÃO
================================= */

async function iniciarPagina() {
    try {
        await carregarUsuario();
        await carregarMembros();
    } catch (erro) {
        mensagemPagina.textContent = erro.message;

        corpoTabela.innerHTML = `
            <tr>
                <td colspan="7">
                    Não foi possível carregar os membros.
                </td>
            </tr>
        `;
    }
}

iniciarPagina();