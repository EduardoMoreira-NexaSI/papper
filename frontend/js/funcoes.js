/* =========================================================
   FUNÇÕES — PAPPER
   Carregar depois de js/api.js.
========================================================= */

(() => {
    "use strict";

    const buscar = (id) => document.getElementById(id);

    const elementos = {
        usuarioNome: buscar("usuario-nome"),
        usuarioPerfil: buscar("usuario-perfil"),
        usuarioAvatar: buscar("usuario-avatar"),
        sair: buscar("botao-sair"),

        totalAtivas: buscar("total-funcoes-ativas"),
        totalMembros: buscar("total-membros-com-funcao"),
        totalSemMembros: buscar("total-funcoes-sem-membros"),

        pesquisa: buscar("pesquisa-funcao"),
        filtro: buscar("filtro-status-funcao"),
        nova: buscar("botao-nova-funcao"),
        quantidade: buscar("quantidade-funcoes"),
        lista: buscar("lista-funcoes"),
        template: buscar("template-cartao-funcao"),

        formularioContainer: buscar("formulario-funcao-container"),
        formulario: buscar("form-funcao"),
        tituloFormulario: buscar("titulo-formulario-funcao"),
        nome: buscar("funcao-nome"),
        descricao: buscar("funcao-descricao"),
        fecharFormulario: buscar("botao-fechar-formulario-funcao"),
        cancelar: buscar("botao-cancelar-funcao"),
        salvar: buscar("botao-salvar-funcao"),
        mensagemFormulario: buscar("mensagem-formulario-funcao"),

        detalhes: buscar("detalhes-funcao-container"),
        detalhesNome: buscar("detalhes-funcao-nome"),
        detalhesDescricao: buscar("detalhes-funcao-descricao"),
        detalhesStatus: buscar("detalhes-funcao-status"),
        fecharDetalhes: buscar("botao-fechar-detalhes-funcao"),
        avisoInativa: buscar("aviso-funcao-inativa"),

        formularioVinculo: buscar("form-vincular-membro-funcao"),
        pesquisaMembro: buscar("pesquisa-membro-funcao"),
        selecionarMembro: buscar("selecionar-membro-funcao"),
        adicionarMembro: buscar("botao-adicionar-membro-funcao"),
        quantidadeMembros: buscar("quantidade-membros-funcao"),
        tabelaMembros: buscar("corpo-tabela-membros-funcao"),

        mensagemDetalhes: buscar("mensagem-detalhes-funcao"),
        mensagemPagina: buscar("mensagem-pagina-funcoes")
    };

    const estado = {
        usuario: null,
        igrejaId: null,
        funcoes: [],
        membros: [],
        edicaoId: null,
        detalhesId: null,
        ocupado: false,
        pronto: false
    };

    /* =====================================================
       UTILITÁRIOS
    ===================================================== */

    function mostrar(elemento, visivel) {
        elemento.hidden = !visivel;
        elemento.classList.toggle("oculto", !visivel);
    }

    function mensagem(elemento, texto = "", sucesso = false) {
        elemento.textContent = texto;
        elemento.classList.remove(
            "mensagem-sucesso",
            "mensagem-erro"
        );

        if (texto) {
            elemento.classList.add(
                sucesso ? "mensagem-sucesso" : "mensagem-erro"
            );
        }
    }

    function normalizar(texto) {
        return String(texto ?? "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .trim();
    }

    function podeGerenciar() {
        return ["administrador", "pastor"].includes(
            estado.usuario?.perfil
        );
    }

    function encontrarFuncao(id) {
        return estado.funcoes.find(
            (funcao) => funcao.id === Number(id)
        );
    }

    function caminhoFuncoes(sufixo = "") {
        return `/igrejas/${estado.igrejaId}/funcoes${sufixo}`;
    }

    function sair() {
        sessionStorage.removeItem("access_token");
        sessionStorage.removeItem("igreja_id");
        sessionStorage.removeItem("perfil");
        window.location.href = "./login.html";
    }

    function rolarAte(elemento) {
        elemento.scrollIntoView({
            behavior: window.matchMedia(
                "(prefers-reduced-motion: reduce)"
            ).matches ? "auto" : "smooth",
            block: "start"
        });
    }

    /*
       Esta função também trata respostas 204 (sem conteúdo).
       Não tenta interpretar JSON quando a resposta está vazia.
    */
    async function requisitar(caminho, metodo = "GET", dados) {
        const token = obterToken();

        if (!token) {
            sair();
            throw new Error("Faça login para continuar.");
        }

        const headers = {
            Authorization: `Bearer ${token}`
        };

        const opcoes = {
            method: metodo,
            headers
        };

        if (dados !== undefined) {
            headers["Content-Type"] = "application/json";
            opcoes.body = JSON.stringify(dados);
        }

        const resposta = await fetch(
            `${API_URL}${caminho}`,
            opcoes
        );

        if (resposta.status === 401) {
            sair();
            throw new Error(
                "Sua sessão expirou. Faça login novamente."
            );
        }

        const texto = resposta.status === 204
            ? ""
            : await resposta.text();

        let resultado = null;

        if (texto) {
            try {
                resultado = JSON.parse(texto);
            } catch {
                if (resposta.ok) {
                    throw new Error(
                        "A API retornou uma resposta inesperada."
                    );
                }
            }
        }

        if (!resposta.ok) {
            let detalhe = resultado?.detail;

            if (Array.isArray(detalhe)) {
                detalhe = detalhe.map((item) => {
                    const campo = (item.loc || [])
                        .filter((parte) => parte !== "body")
                        .join(".");

                    return campo
                        ? `${campo}: ${item.msg}`
                        : item.msg;
                }).join(" | ");
            }

            throw new Error(
                typeof detalhe === "string"
                    ? detalhe
                    : `Não foi possível concluir a operação (${resposta.status}).`
            );
        }

        return resultado;
    }

    /* =====================================================
       CARREGAMENTO
    ===================================================== */

    async function carregarUsuario() {
        estado.usuario = await requisitar("/usuarios/eu");
        estado.igrejaId = obterIgrejaDoUsuario(estado.usuario);

        elementos.usuarioNome.textContent = estado.usuario.nome;
        elementos.usuarioPerfil.textContent = estado.usuario.perfil;
        elementos.usuarioAvatar.textContent = (
            estado.usuario.nome || "U"
        ).charAt(0).toUpperCase();

        sessionStorage.setItem(
            "igreja_id",
            String(estado.igrejaId)
        );
    }

    async function carregarMembros() {
        if (!podeGerenciar()) {
            estado.membros = [];
            return;
        }

        const membros = await requisitar(
            `/igrejas/${estado.igrejaId}/membros/resumo`
        );

        if (!Array.isArray(membros)) {
            throw new Error("A lista de membros é inválida.");
        }

        estado.membros = membros;
    }

    async function carregarFuncoes() {
        const lista = await requisitar(
            caminhoFuncoes("?incluir_inativas=true")
        );

        if (!Array.isArray(lista)) {
            throw new Error("A lista de funções é inválida.");
        }

        /*
           Consulta os detalhes para obter os membros.
           Não substitui falhas por listas vazias, evitando
           apresentar contagens incorretas como se fossem reais.
           Processa até quatro consultas simultaneamente.
        */
        const detalhes = [];

        for (let indice = 0; indice < lista.length; indice += 4) {
            const lote = lista.slice(indice, indice + 4);

            const resultados = await Promise.all(
                lote.map((funcao) =>
                    requisitar(caminhoFuncoes(`/${funcao.id}`))
                )
            );

            for (const funcao of resultados) {
                if (!Array.isArray(funcao.membros)) {
                    throw new Error(
                        "A resposta de detalhes não contém a lista de membros."
                    );
                }

                detalhes.push(funcao);
            }
        }

        estado.funcoes = detalhes.sort((a, b) =>
            a.nome.localeCompare(b.nome, "pt-BR")
        );

        atualizarResumo();
        renderizarFuncoes();

        if (estado.detalhesId !== null) {
            const funcao = encontrarFuncao(estado.detalhesId);

            if (funcao) {
                renderizarDetalhes(funcao);
            } else {
                fecharDetalhes();
            }
        }
    }

    /* =====================================================
       RESUMO E CARTÕES
    ===================================================== */

    function atualizarResumo() {
        const ativas = estado.funcoes.filter(
            (funcao) => funcao.ativo
        );

        const membrosUnicos = new Set();

        for (const funcao of ativas) {
            for (const membro of funcao.membros) {
                membrosUnicos.add(membro.id);
            }
        }

        elementos.totalAtivas.textContent = ativas.length;
        elementos.totalMembros.textContent = membrosUnicos.size;

        elementos.totalSemMembros.textContent = ativas.filter(
            (funcao) => funcao.membros.length === 0
        ).length;
    }

    function renderizarFuncoes() {
        const pesquisa = normalizar(elementos.pesquisa.value);
        const filtro = elementos.filtro.value;

        const filtradas = estado.funcoes.filter((funcao) => {
            const correspondeNome = normalizar(
                funcao.nome
            ).includes(pesquisa);

            const correspondeStatus =
                filtro === "todas" ||
                (filtro === "ativas" && funcao.ativo) ||
                (filtro === "inativas" && !funcao.ativo);

            return correspondeNome && correspondeStatus;
        });

        elementos.quantidade.textContent =
            `${filtradas.length} função(ões) encontrada(s)`;

        elementos.lista.replaceChildren();

        if (filtradas.length === 0) {
            const aviso = document.createElement("p");

            aviso.className = "estado-listagem";
            aviso.textContent = "Nenhuma função encontrada.";

            elementos.lista.append(aviso);
            return;
        }

        for (const funcao of filtradas) {
            const cartao = elementos.template.content
                .firstElementChild.cloneNode(true);

            cartao.classList.toggle("inativa", !funcao.ativo);

            cartao.querySelector('[data-campo="nome"]')
                .textContent = funcao.nome;

            cartao.querySelector('[data-campo="descricao"]')
                .textContent = funcao.descricao ||
                    "Sem descrição cadastrada.";

            cartao.querySelector(
                '[data-campo="quantidade-membros"]'
            ).textContent = funcao.membros.length;

            const selo = cartao.querySelector(
                '[data-campo="status"]'
            );

            selo.textContent = funcao.ativo ? "Ativa" : "Inativa";
            selo.classList.toggle("inativa", !funcao.ativo);

            const botaoStatus = cartao.querySelector(
                '[data-acao="status"]'
            );

            botaoStatus.textContent = funcao.ativo
                ? "Desativar"
                : "Reativar";

            botaoStatus.classList.toggle(
                "reativar",
                !funcao.ativo
            );

            for (const botao of cartao.querySelectorAll(
                "button[data-acao]"
            )) {
                botao.dataset.funcaoId = String(funcao.id);
                botao.disabled = estado.ocupado;
            }

            for (const controle of cartao.querySelectorAll(
                "[data-gerenciamento]"
            )) {
                mostrar(controle, podeGerenciar());
            }

            elementos.lista.append(cartao);
        }
    }

    /* =====================================================
       PERMISSÕES E BLOQUEIO DURANTE OPERAÇÕES
    ===================================================== */

    function atualizarControles() {
        const pode = podeGerenciar();
        const bloqueado = estado.ocupado || !estado.pronto;
        const funcao = encontrarFuncao(estado.detalhesId);

        mostrar(elementos.nova, pode);

        elementos.nova.disabled = bloqueado || !pode;
        elementos.salvar.disabled = bloqueado || !pode;
        elementos.nome.disabled = bloqueado;
        elementos.descricao.disabled = bloqueado;
        elementos.cancelar.disabled = estado.ocupado;
        elementos.fecharFormulario.disabled = estado.ocupado;
        elementos.fecharDetalhes.disabled = estado.ocupado;

        const podeVincular = Boolean(pode && funcao?.ativo);

        mostrar(elementos.formularioVinculo, podeVincular);

        elementos.pesquisaMembro.disabled =
            bloqueado || !podeVincular;

        elementos.selecionarMembro.disabled =
            bloqueado || !podeVincular;

        elementos.adicionarMembro.disabled =
            bloqueado ||
            !podeVincular ||
            !elementos.selecionarMembro.value;

        for (const botao of elementos.lista.querySelectorAll(
            "button"
        )) {
            botao.disabled = bloqueado;
        }

        for (const botao of elementos.tabelaMembros
            .querySelectorAll("button")) {
            botao.disabled = bloqueado || !pode;
        }
    }

    async function executarAlteracao(
        operacao,
        destinoMensagem,
        textoSucesso
    ) {
        if (estado.ocupado || !estado.pronto) {
            return;
        }

        if (!podeGerenciar()) {
            mensagem(
                destinoMensagem,
                "Seu perfil não permite alterar funções."
            );
            return;
        }

        estado.ocupado = true;
        atualizarControles();
        mensagem(destinoMensagem);

        let alteracaoConcluida = false;

        try {
            await operacao();
            alteracaoConcluida = true;

            await carregarFuncoes();

            mensagem(destinoMensagem, textoSucesso, true);
        } catch (erro) {
            mensagem(
                destinoMensagem,
                alteracaoConcluida
                    ? `${textoSucesso} Porém, não foi possível atualizar a tela. Recarregue a página antes de repetir a operação.`
                    : erro.message
            );
        } finally {
            estado.ocupado = false;
            atualizarControles();
        }
    }

    /* =====================================================
       CADASTRO E EDIÇÃO
    ===================================================== */

    function abrirFormulario(id = null) {
        if (!podeGerenciar() || estado.ocupado) {
            return;
        }

        const funcao = id === null
            ? null
            : encontrarFuncao(id);

        if (id !== null && !funcao) {
            return;
        }

        estado.edicaoId = funcao?.id ?? null;

        elementos.formulario.reset();
        elementos.nome.value = funcao?.nome || "";
        elementos.descricao.value = funcao?.descricao || "";

        elementos.tituloFormulario.textContent = funcao
            ? "Editar função"
            : "Nova função";

        elementos.salvar.textContent = funcao
            ? "Salvar alterações"
            : "Salvar função";

        mensagem(elementos.mensagemFormulario);
        mostrar(elementos.formularioContainer, true);
        elementos.nova.setAttribute("aria-expanded", "true");

        rolarAte(elementos.formularioContainer);
        elementos.nome.focus({ preventScroll: true });
    }

    function fecharFormulario() {
        estado.edicaoId = null;
        elementos.formulario.reset();
        mostrar(elementos.formularioContainer, false);
        elementos.nova.setAttribute("aria-expanded", "false");
        mensagem(elementos.mensagemFormulario);
    }

    async function salvarFuncao(evento) {
        evento.preventDefault();

        if (!elementos.formulario.reportValidity()) {
            return;
        }

        const nome = elementos.nome.value.trim();
        const descricao = elementos.descricao.value.trim() || null;

        if (nome.length < 2) {
            mensagem(
                elementos.mensagemFormulario,
                "O nome precisa ter pelo menos dois caracteres."
            );
            return;
        }

        if (estado.ocupado || !podeGerenciar() || !estado.pronto) {
            return;
        }

        const id = estado.edicaoId;
        const editando = id !== null;

        estado.ocupado = true;
        atualizarControles();
        mensagem(elementos.mensagemFormulario);

        try {
            await requisitar(
                caminhoFuncoes(editando ? `/${id}` : ""),
                editando ? "PATCH" : "POST",
                { nome, descricao }
            );
        } catch (erro) {
            mensagem(elementos.mensagemFormulario, erro.message);
            estado.ocupado = false;
            atualizarControles();
            return;
        }

        /*
           O salvamento já foi confirmado.
           Fecha o formulário para evitar cadastro duplicado
           caso apenas a atualização da listagem falhe.
        */
        fecharFormulario();

        const sucesso = editando
            ? "Função atualizada com sucesso."
            : "Função criada com sucesso.";

        try {
            await carregarFuncoes();
            mensagem(elementos.mensagemPagina, sucesso, true);
        } catch {
            mensagem(
                elementos.mensagemPagina,
                `${sucesso} Não foi possível atualizar a listagem. Recarregue a página.`
            );
        } finally {
            estado.ocupado = false;
            atualizarControles();
        }
    }

    /* =====================================================
       DETALHES E LISTA DE MEMBROS
    ===================================================== */

    function abrirDetalhes(id) {
        if (estado.ocupado) {
            return;
        }

        const funcao = encontrarFuncao(id);

        if (!funcao) {
            return;
        }

        estado.detalhesId = funcao.id;
        elementos.pesquisaMembro.value = "";

        mensagem(elementos.mensagemDetalhes);
        renderizarDetalhes(funcao);
        mostrar(elementos.detalhes, true);
        atualizarControles();
        rolarAte(elementos.detalhes);
    }

    function fecharDetalhes() {
        estado.detalhesId = null;
        mostrar(elementos.detalhes, false);
        mensagem(elementos.mensagemDetalhes);
    }

    function renderizarDetalhes(funcao) {
        elementos.detalhesNome.textContent = funcao.nome;
        elementos.detalhesDescricao.textContent =
            funcao.descricao || "Sem descrição cadastrada.";

        elementos.detalhesStatus.textContent =
            funcao.ativo ? "Ativa" : "Inativa";

        elementos.detalhesStatus.classList.toggle(
            "inativa",
            !funcao.ativo
        );

        mostrar(elementos.avisoInativa, !funcao.ativo);

        const membros = [...funcao.membros].sort((a, b) =>
            a.nome.localeCompare(b.nome, "pt-BR")
        );

        elementos.quantidadeMembros.textContent =
            `${membros.length} membro(s) vinculado(s)`;

        elementos.tabelaMembros.replaceChildren();

        if (membros.length === 0) {
            const linha = document.createElement("tr");
            const celula = document.createElement("td");

            celula.colSpan = 3;
            celula.textContent = "Nenhum membro vinculado.";

            linha.append(celula);
            elementos.tabelaMembros.append(linha);
        }

        for (const membro of membros) {
            const linha = document.createElement("tr");
            const nome = document.createElement("td");
            const situacao = document.createElement("td");
            const acoes = document.createElement("td");

            nome.textContent = membro.nome;
            situacao.textContent = membro.status
                ? "Ativo"
                : "Inativo";

            if (podeGerenciar()) {
                const botao = document.createElement("button");

                botao.type = "button";
                botao.className = "botao-remover-membro-funcao";
                botao.dataset.membroId = String(membro.id);
                botao.textContent = "Remover vínculo";
                botao.disabled = estado.ocupado;

                acoes.append(botao);
            } else {
                acoes.textContent = "—";
            }

            linha.append(nome, situacao, acoes);
            elementos.tabelaMembros.append(linha);
        }

        preencherSeletorMembros();
        atualizarControles();
    }

    function preencherSeletorMembros() {
        const funcao = encontrarFuncao(estado.detalhesId);
        const selecionado = elementos.selecionarMembro.value;
        const pesquisa = normalizar(
            elementos.pesquisaMembro.value
        );

        elementos.selecionarMembro.replaceChildren();

        if (!funcao) {
            return;
        }

        const vinculados = new Set(
            funcao.membros.map((membro) => membro.id)
        );

        const disponiveis = estado.membros
            .filter((membro) =>
                !vinculados.has(membro.id) &&
                normalizar(membro.nome).includes(pesquisa)
            )
            .sort((a, b) =>
                a.nome.localeCompare(b.nome, "pt-BR")
            );

        const inicial = document.createElement("option");
        inicial.value = "";
        inicial.textContent = disponiveis.length
            ? "Selecione um membro"
            : "Nenhum membro disponível para esta pesquisa";

        elementos.selecionarMembro.append(inicial);

        for (const membro of disponiveis) {
            const opcao = document.createElement("option");

            opcao.value = String(membro.id);
            opcao.textContent =
                `${membro.nome} — ID ${membro.id}` +
                (membro.status ? "" : " (inativo)");

            elementos.selecionarMembro.append(opcao);
        }

        const aindaDisponivel = disponiveis.some(
            (membro) => String(membro.id) === selecionado
        );

        elementos.selecionarMembro.value =
            aindaDisponivel ? selecionado : "";

        atualizarControles();
    }

    /* =====================================================
       VINCULAR E REMOVER MEMBROS
    ===================================================== */

    async function vincularMembro(evento) {
        evento.preventDefault();

        const funcao = encontrarFuncao(estado.detalhesId);
        const membroId = Number(elementos.selecionarMembro.value);

        if (!funcao?.ativo) {
            mensagem(
                elementos.mensagemDetalhes,
                "Selecione uma função ativa."
            );
            return;
        }

        if (!Number.isInteger(membroId) || membroId <= 0) {
            mensagem(
                elementos.mensagemDetalhes,
                "Selecione o membro que receberá a função."
            );
            return;
        }

        await executarAlteracao(
            () => requisitar(
                caminhoFuncoes(`/${funcao.id}/membros`),
                "POST",
                { membro_id: membroId }
            ),
            elementos.mensagemDetalhes,
            "Função atribuída ao membro."
        );
    }

    async function removerVinculo(membroId) {
        const funcao = encontrarFuncao(estado.detalhesId);
        const membro = funcao?.membros.find(
            (item) => item.id === membroId
        );

        if (!funcao || !membro || estado.ocupado) {
            return;
        }

        const confirmou = window.confirm(
            `Remover a função "${funcao.nome}" de ${membro.nome}?\n\n` +
            "O cadastro do membro será mantido."
        );

        if (!confirmou) {
            return;
        }

        await executarAlteracao(
            () => requisitar(
                caminhoFuncoes(
                    `/${funcao.id}/membros/${membro.id}`
                ),
                "DELETE"
            ),
            elementos.mensagemDetalhes,
            "Vínculo removido. O cadastro do membro foi mantido."
        );
    }

    /* =====================================================
       DESATIVAR E REATIVAR
    ===================================================== */

    async function alterarStatus(id) {
        const funcao = encontrarFuncao(id);

        if (!funcao || estado.ocupado) {
            return;
        }

        const acao = funcao.ativo ? "desativar" : "reativar";

        const confirmou = window.confirm(
            `Deseja ${acao} a função "${funcao.nome}"?` +
            (funcao.ativo
                ? "\n\nOs vínculos existentes serão mantidos."
                : "")
        );

        if (!confirmou) {
            return;
        }

        await executarAlteracao(
            () => requisitar(
                caminhoFuncoes(`/${funcao.id}/${acao}`),
                "PATCH"
            ),
            elementos.mensagemPagina,
            funcao.ativo
                ? "Função desativada."
                : "Função reativada."
        );
    }

    /* =====================================================
       EVENTOS
    ===================================================== */

    function registrarEventos() {
        elementos.sair.addEventListener("click", sair);

        elementos.nova.addEventListener(
            "click",
            () => abrirFormulario()
        );

        elementos.fecharFormulario.addEventListener(
            "click",
            fecharFormulario
        );

        elementos.cancelar.addEventListener(
            "click",
            fecharFormulario
        );

        elementos.formulario.addEventListener(
            "submit",
            salvarFuncao
        );

        elementos.fecharDetalhes.addEventListener(
            "click",
            fecharDetalhes
        );

        elementos.pesquisa.addEventListener(
            "input",
            renderizarFuncoes
        );

        elementos.filtro.addEventListener(
            "change",
            renderizarFuncoes
        );

        elementos.pesquisaMembro.addEventListener(
            "input",
            preencherSeletorMembros
        );

        elementos.selecionarMembro.addEventListener(
            "change",
            atualizarControles
        );

        elementos.formularioVinculo.addEventListener(
            "submit",
            vincularMembro
        );

        elementos.lista.addEventListener("click", (evento) => {
            const botao = evento.target.closest(
                "button[data-acao]"
            );

            if (!botao || estado.ocupado || !estado.pronto) {
                return;
            }

            const id = Number(botao.dataset.funcaoId);

            switch (botao.dataset.acao) {
                case "detalhes":
                    abrirDetalhes(id);
                    break;

                case "editar":
                    abrirFormulario(id);
                    break;

                case "status":
                    alterarStatus(id);
                    break;
            }
        });

        elementos.tabelaMembros.addEventListener(
            "click",
            (evento) => {
                const botao = evento.target.closest(
                    "button[data-membro-id]"
                );

                if (botao) {
                    removerVinculo(
                        Number(botao.dataset.membroId)
                    );
                }
            }
        );
    }

    /* =====================================================
       INICIALIZAÇÃO
    ===================================================== */

    async function iniciar() {
        const ausentes = Object.entries(elementos)
            .filter(([, elemento]) => !elemento)
            .map(([nome]) => nome);

        if (ausentes.length) {
            const texto =
                "O HTML da página está incompleto. Elementos ausentes: " +
                ausentes.join(", ");

            console.error(texto);

            if (elementos.mensagemPagina) {
                mensagem(elementos.mensagemPagina, texto);
            }

            return;
        }

        registrarEventos();
        atualizarControles();

        try {
            if (
                typeof API_URL === "undefined" ||
                typeof obterToken !== "function"
            ) {
                throw new Error(
                    "Carregue js/api.js antes de js/funcoes.js."
                );
            }

            await carregarUsuario();
            await carregarMembros();
            await carregarFuncoes();

            estado.pronto = true;
            atualizarControles();
        } catch (erro) {
            mensagem(elementos.mensagemPagina, erro.message);
            elementos.quantidade.textContent = "Carregamento interrompido.";

            const aviso = document.createElement("p");
            aviso.className = "estado-listagem";
            aviso.textContent =
                "Não foi possível carregar a página. " +
                "Confira a mensagem acima e recarregue após corrigir.";

            elementos.lista.replaceChildren(aviso);
        }
    }

    iniciar();
})();