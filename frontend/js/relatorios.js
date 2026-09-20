/* =========================================================
   RELATÓRIOS — PAPPER

   Depende de js/api.js, carregado antes deste arquivo.

   Rotas que implementaremos no backend:

   GET  /igrejas/{igreja_id}/relatorios/opcoes
   POST /igrejas/{igreja_id}/relatorios/consultar
   POST /igrejas/{igreja_id}/relatorios/pdf

   O backend deverá validar igreja, perfil, filtros e campos.
========================================================= */

(() => {
    "use strict";

    const buscar = (id) => document.getElementById(id);

    const elementos = {
        formulario: buscar("form-relatorio"),
        tipo: buscar("relatorio-tipo"),
        titulo: buscar("relatorio-titulo"),
        descricao: buscar("relatorio-tipo-descricao"),

        usuarioNome: buscar("usuario-nome"),
        usuarioPerfil: buscar("usuario-perfil"),
        usuarioAvatar: buscar("usuario-avatar"),
        igrejaNome: buscar("relatorio-igreja-nome"),
        sair: buscar("botao-sair"),

        consultar: buscar("botao-consultar-relatorio"),
        limpar: buscar("botao-limpar-filtros"),
        pdf: buscar("botao-gerar-pdf"),
        mensagem: buscar("mensagem-relatorios"),

        periodo: buscar("filtros-periodo"),
        camposPeriodo: buscar("campos-periodo"),
        atalhoPeriodo: buscar("periodo-atalho"),
        dataInicio: buscar("relatorio-data-inicio"),
        dataFim: buscar("relatorio-data-fim"),
        ajudaPeriodo: buscar("ajuda-periodo"),

        resultado: buscar("resultado-relatorio"),
        resultadoTitulo: buscar("resultado-relatorio-titulo"),
        resultadoContexto: buscar("resultado-relatorio-contexto"),
        resultadoQuantidade: buscar("resultado-relatorio-quantidade"),
        filtrosAplicados: buscar("resultado-filtros-aplicados"),
        indicadores: buscar("resultado-indicadores"),
        notas: buscar("resultado-notas"),
        legenda: buscar("resultado-tabela-legenda"),
        cabecalhoTabela: buscar("resultado-tabela-cabecalho"),
        corpoTabela: buscar("resultado-tabela-corpo"),
        vazio: buscar("resultado-vazio"),
        desatualizado: buscar("aviso-resultado-desatualizado"),

        paginacao: buscar("paginacao-relatorio"),
        anterior: buscar("botao-pagina-anterior"),
        proxima: buscar("botao-proxima-pagina"),
        paginaAtual: buscar("resultado-pagina-atual")
    };

    const tipos = {
        membros: {
            titulo: "Relatório de membros",
            descricao:
                "Consulte membros por situação, função, grupo e localização.",
            periodo: false
        },

        financeiro: {
            titulo: "Relatório financeiro",
            descricao:
                "Consulte entradas, saídas e fluxo de caixa registrado.",
            periodo: true
        },

        atividades: {
            titulo: "Relatório de atividades",
            descricao:
                "Consulte atividades e eventos por período, tipo e situação.",
            periodo: true
        },

        frequencia: {
            titulo: "Relatório de frequência",
            descricao:
                "Consulte registros de participação sem confundir confirmação com presença.",
            periodo: true
        },

        funcoes: {
            titulo: "Relatório de funções",
            descricao:
                "Consulte funções e seus membros vinculados.",
            periodo: false
        },

        grupos: {
            titulo: "Relatório de grupos",
            descricao:
                "Consulte grupos, liderança e integrantes.",
            periodo: false
        }
    };

    const estado = {
        usuario: null,
        igrejaId: null,
        pronto: false,
        ocupado: false,
        resultado: null,
        assinaturaConsulta: null,
        pagina: 1,
        tamanhoPagina: 25,
        revisaoFormulario: 0,
        opcoes: null
    };

    /* =====================================================
       UTILITÁRIOS
    ===================================================== */

    function mostrar(elemento, visivel) {
        elemento.hidden = !visivel;
        elemento.classList.toggle("oculto", !visivel);
    }

    function avisar(texto = "", sucesso = false) {
        elementos.mensagem.textContent = texto;

        elementos.mensagem.classList.remove(
            "mensagem-sucesso",
            "mensagem-erro"
        );

        if (texto) {
            elementos.mensagem.classList.add(
                sucesso ? "mensagem-sucesso" : "mensagem-erro"
            );
        }
    }

    function sair() {
        sessionStorage.removeItem("access_token");
        sessionStorage.removeItem("igreja_id");
  sessionStorage.removeItem("perfil");

        window.location.href = "./login.html";
    }

    function rota(sufixo) {
        return `/igrejas/${estado.igrejaId}/relatorios/${sufixo}`;
    }

    function textoSeguro(valor) {
        if (valor === null || valor === undefined) {
            return "—";
        }

        if (typeof valor === "boolean") {
            return valor ? "Sim" : "Não";
        }

        return String(valor);
    }

    function dataLocal(data) {
        const ano = data.getFullYear();
        const mes = String(data.getMonth() + 1).padStart(2, "0");
        const dia = String(data.getDate()).padStart(2, "0");

        return `${ano}-${mes}-${dia}`;
    }

    function formatarDataHora(valor) {
        const data = new Date(valor);

        if (Number.isNaN(data.getTime())) {
            return textoSeguro(valor);
        }

        return data.toLocaleString("pt-BR");
    }

    /* =====================================================
       COMUNICAÇÃO COM A API
    ===================================================== */

    async function requisitar(
        caminho,
        { metodo = "GET", dados, arquivo = false } = {}
    ) {
        const token = obterToken();

        if (!token) {
            sair();
            throw new Error("Faça login para continuar.");
        }

        const headers = {
            Authorization: `Bearer ${token}`,
            Accept: arquivo ? "application/pdf" : "application/json"
        };

        const configuracao = {
            method: metodo,
            headers
        };

        if (dados !== undefined) {
            headers["Content-Type"] = "application/json";
            configuracao.body = JSON.stringify(dados);
        }

        const resposta = await fetch(
            `${API_URL}${caminho}`,
            configuracao
        );

        if (resposta.status === 401) {
            sair();
            throw new Error("Sua sessão expirou.");
        }

        if (!resposta.ok) {
            let detalhe = null;

            try {
                const corpo = await resposta.json();
                detalhe = corpo.detail;
            } catch {
                // A resposta de erro pode não conter JSON.
            }

            if (
                resposta.status === 404 &&
                caminho.includes("/relatorios/")
            ) {
                throw new Error(
                    "As rotas de relatórios ainda não estão disponíveis. " +
                    "Precisamos implementar o backend de relatórios e PDF."
                );
            }

            if (Array.isArray(detalhe)) {
                detalhe = detalhe.map((item) => {
                    const campo = (item.loc || [])
                        .filter((parte) => parte !== "body")
                        .join(".");

                    return `${campo}: ${item.msg}`;
                }).join(" | ");
            }

            throw new Error(
                typeof detalhe === "string"
                    ? detalhe
                    : `A operação falhou (${resposta.status}).`
            );
        }

        if (arquivo) {
            const tipoConteudo =
                resposta.headers.get("Content-Type") || "";

            if (!tipoConteudo.toLowerCase().includes("application/pdf")) {
                throw new Error(
                    "O servidor não retornou um PDF válido."
                );
            }

            return resposta.blob();
        }

        return resposta.json();
    }

    /* =====================================================
       CONTROLE DOS FILTROS
    ===================================================== */

    function configurarSecoes(alterarTitulo = true) {
        const tipo = elementos.tipo.value;
        const configuracao = tipos[tipo];

        if (!configuracao) {
            return;
        }

        for (const nome of Object.keys(tipos)) {
            const secao = buscar(`filtros-${nome}`);
            const ativa = nome === tipo;

            mostrar(secao, ativa);

            // Campos ocultos não participam da consulta ou validação.
            for (const campo of secao.querySelectorAll(
                "input, select, textarea, fieldset"
            )) {
                campo.disabled = !ativa;
            }
        }

        mostrar(elementos.periodo, configuracao.periodo);
        elementos.camposPeriodo.disabled = !configuracao.periodo;

        elementos.descricao.textContent = configuracao.descricao;

        if (alterarTitulo) {
            elementos.titulo.value = configuracao.titulo;
        }

        elementos.ajudaPeriodo.textContent =
            tipo === "financeiro"
                ? "O período considera a data da movimentação, incluindo as duas datas."
                : "O período considera a data de início da atividade, incluindo as duas datas.";

        configurarModeloFinanceiro();
        aplicarPermissoesCampos();
    }

    function configurarModeloFinanceiro() {
        const modelo = buscar("financeiro-modelo");
        const agrupamento = buscar("financeiro-agrupamento");
        const campo = agrupamento.closest(".campo");

        const mostrarAgrupamento =
            elementos.tipo.value === "financeiro" &&
            modelo.value === "fluxo";

        mostrar(campo, mostrarAgrupamento);
        agrupamento.disabled = !mostrarAgrupamento;
    }

    function aplicarPermissoesCampos() {
        const permissoes = estado.opcoes?.permissoes || {};

        const camposProtegidos = [
            ["financeiro-identificar-membros", "identificar_membros_financeiro"],
            ["atividades-incluir-observacoes", "observacoes_internas"]
        ];

        for (const [id, permissao] of camposProtegidos) {
            const campo = buscar(id);
            const autorizado = permissoes[permissao] === true;

            if (!autorizado) {
                campo.checked = false;
                campo.disabled = true;
            }
        }

        const cpf = buscar("membros-exibicao-cpf");
        const opcaoCompleto = cpf.querySelector(
            'option[value="completo"]'
        );

        const permiteCpf = permissoes.cpf_completo === true;

        opcaoCompleto.disabled = !permiteCpf;

        if (!permiteCpf && cpf.value === "completo") {
            cpf.value = "oculto";
        }
    }

    function aplicarPeriodoRapido() {
        const escolha = elementos.atalhoPeriodo.value;

        if (escolha === "personalizado") {
            return;
        }

        const hoje = new Date();
        const ano = hoje.getFullYear();
        const mes = hoje.getMonth();

        let inicio;
        let fim;

        switch (escolha) {
            case "mes_atual":
                inicio = new Date(ano, mes, 1);
                fim = new Date(ano, mes + 1, 0);
                break;

            case "mes_anterior":
                inicio = new Date(ano, mes - 1, 1);
                fim = new Date(ano, mes, 0);
                break;

            case "trimestre_atual": {
                const primeiroMes = Math.floor(mes / 3) * 3;

                inicio = new Date(ano, primeiroMes, 1);
                fim = new Date(ano, primeiroMes + 3, 0);
                break;
            }

            case "ano_atual":
                inicio = new Date(ano, 0, 1);
                fim = new Date(ano, 11, 31);
                break;

            default:
                return;
        }

        elementos.dataInicio.value = dataLocal(inicio);
        elementos.dataFim.value = dataLocal(fim);
    }

    function obterConfiguracao() {
        const dados = {};

        for (const [nome, valor] of new FormData(
            elementos.formulario
        ).entries()) {
            dados[nome] = typeof valor === "string"
                ? valor.trim()
                : valor;
        }

        // Checkboxes desmarcados não são enviados pelo FormData.
        for (const campo of elementos.formulario.querySelectorAll(
            'input[type="checkbox"]'
        )) {
            if (!campo.disabled) {
                dados[campo.name] = campo.checked;
            }
        }

        // É apenas um atalho visual, não um filtro do backend.
        delete dados.periodo_atalho;

        return dados;
    }

    function assinaturaAtual() {
        return JSON.stringify(obterConfiguracao());
    }

    function marcarAlteracao() {
        estado.revisaoFormulario += 1;

        if (estado.resultado) {
            mostrar(elementos.desatualizado, true);
        }

        estado.assinaturaConsulta = null;
        atualizarBotoes();
    }

    function atualizarBotoes() {
        elementos.tipo.disabled = !estado.pronto || estado.ocupado;
        elementos.consultar.disabled = !estado.pronto || estado.ocupado;
        elementos.limpar.disabled = estado.ocupado;

        const consultaAtual =
            estado.assinaturaConsulta !== null &&
            estado.assinaturaConsulta === assinaturaAtual();

        elementos.pdf.disabled =
            estado.ocupado ||
            !estado.resultado?.consulta_id ||
            !consultaAtual ||
            estado.resultado?.pdf_disponivel !== true;

        elementos.resultado.setAttribute(
            "aria-busy",
            String(estado.ocupado)
        );

        elementos.anterior.disabled =
            estado.ocupado || estado.pagina <= 1;

        const totalPaginas = Math.max(
            1,
            Math.ceil(
                (estado.resultado?.linhas.length || 0) /
                estado.tamanhoPagina
            )
        );

        elementos.proxima.disabled =
            estado.ocupado || estado.pagina >= totalPaginas;
    }

    function validarFiltros() {
        if (!elementos.formulario.reportValidity()) {
            return false;
        }

        if (!elementos.titulo.value.trim()) {
            throw new Error("Informe o título do relatório.");
        }

        if (tipos[elementos.tipo.value].periodo) {
            if (elementos.dataInicio.value > elementos.dataFim.value) {
                throw new Error(
                    "A data inicial não pode ser maior que a data final."
                );
            }
        }

        if (elementos.tipo.value === "membros") {
            const minima = buscar("membros-idade-minima").value;
            const maxima = buscar("membros-idade-maxima").value;

            if (
                minima !== "" &&
                maxima !== "" &&
                Number(minima) > Number(maxima)
            ) {
                throw new Error(
                    "A idade mínima não pode ser maior que a máxima."
                );
            }
        }

        return true;
    }

    /* =====================================================
       OPÇÕES DOS SELETORES
    ===================================================== */

    function preencherSeletor(id, itens, fixos) {
        const seletor = buscar(id);
        seletor.replaceChildren();

        for (const item of [...fixos, ...itens]) {
            const opcao = document.createElement("option");

            opcao.value = String(item.valor);
            opcao.textContent = item.rotulo;

            seletor.append(opcao);
        }
    }

    function aplicarOpcoes(opcoes) {
        const permitidos = opcoes.tipos_permitidos;

        if (!Array.isArray(permitidos)) {
            throw new Error(
                "A API não informou os tipos de relatório permitidos."
            );
        }

        for (const opcao of elementos.tipo.options) {
            const permitido = permitidos.includes(opcao.value);

            opcao.disabled = !permitido;
            opcao.hidden = !permitido;
        }

        const primeiroPermitido = Array.from(
            elementos.tipo.options
        ).find((opcao) => !opcao.disabled);

        if (!primeiroPermitido) {
            throw new Error(
                "Seu perfil não possui relatórios disponíveis."
            );
        }

        elementos.tipo.value = primeiroPermitido.value;

        const converter = (lista, campo = "nome") =>
            (lista || []).map((item) => ({
                valor: item.id,
                rotulo: `${item[campo]} — ID ${item.id}`
            }));

        const funcoes = converter(opcoes.funcoes);
        const grupos = converter(opcoes.grupos);
        const membros = converter(opcoes.membros);
        const atividades = converter(opcoes.atividades, "titulo");

        preencherSeletor("membros-funcao", funcoes, [
            { valor: "", rotulo: "Todas as funções" },
            { valor: "sem_funcao", rotulo: "Sem função vinculada" }
        ]);

        preencherSeletor("membros-grupo", grupos, [
            { valor: "", rotulo: "Todos os grupos" },
            { valor: "sem_grupo", rotulo: "Sem grupo vinculado" }
        ]);

        for (const id of ["frequencia-funcao", "funcoes-selecao"]) {
            preencherSeletor(id, funcoes, [
                { valor: "", rotulo: "Todas as funções" }
            ]);
        }

        for (const id of ["frequencia-grupo", "grupos-selecao"]) {
            preencherSeletor(id, grupos, [
                { valor: "", rotulo: "Todos os grupos" }
            ]);
        }

        preencherSeletor("financeiro-membro", membros, [
            { valor: "", rotulo: "Todos" },
            { valor: "sem_vinculo", rotulo: "Sem vínculo com membro" }
        ]);

        preencherSeletor("frequencia-membro", membros, [
            { valor: "", rotulo: "Todos os membros" }
        ]);

        preencherSeletor("financeiro-atividade", atividades, [
            { valor: "", rotulo: "Todas" },
            { valor: "sem_vinculo", rotulo: "Sem vínculo com atividade" }
        ]);

        preencherSeletor("frequencia-atividade", atividades, [
            { valor: "", rotulo: "Todas no período" }
        ]);

        preencherSeletor(
            "financeiro-forma-pagamento",
            (opcoes.formas_pagamento || []).map((valor) => ({
                valor,
                rotulo: valor
            })),
            [
                { valor: "", rotulo: "Todas" },
                { valor: "sem_informacao", rotulo: "Não informada" }
            ]
        );

        preencherSeletor(
            "atividades-tipo",
            (opcoes.tipos_atividade || []).map((valor) => ({
                valor,
                rotulo: valor
            })),
            [{ valor: "", rotulo: "Todos os tipos" }]
        );

        preencherSeletor(
            "atividades-status",
            (opcoes.status_atividade || []).map((valor) => ({
                valor,
                rotulo: valor
            })),
            [{ valor: "", rotulo: "Todas as situações" }]
        );
    }

    /* =====================================================
       CONSULTA
    ===================================================== */

    async function consultar(evento) {
        evento.preventDefault();

        if (!estado.pronto || estado.ocupado) {
            return;
        }

        try {
            if (!validarFiltros()) {
                return;
            }
        } catch (erro) {
            avisar(erro.message);
            return;
        }

        const configuracao = obterConfiguracao();
        const assinatura = JSON.stringify(configuracao);
        const revisao = estado.revisaoFormulario;

        estado.ocupado = true;
        estado.assinaturaConsulta = null;

        avisar();
        atualizarBotoes();
        elementos.consultar.textContent = "Consultando...";

        try {
            const resultado = await requisitar(
                rota("consultar"),
                {
                    metodo: "POST",
                    dados: configuracao
                }
            );

            if (
                !resultado ||
                !Array.isArray(resultado.colunas) ||
                !Array.isArray(resultado.linhas) ||
                !resultado.consulta_id
            ) {
                throw new Error(
                    "O formato retornado pelo relatório é inválido."
                );
            }

            // Não mostra um resultado de filtros que já foram alterados.
            if (revisao !== estado.revisaoFormulario) {
                avisar(
                    "Os filtros mudaram durante a consulta. Consulte novamente."
                );
                return;
            }

            estado.resultado = resultado;
            estado.assinaturaConsulta = assinatura;
            estado.pagina = 1;

            renderizarResultado();

            avisar("Relatório consultado com sucesso.", true);
        } catch (erro) {
            if (estado.resultado) {
                mostrar(elementos.desatualizado, true);
            }

            avisar(erro.message);
        } finally {
            estado.ocupado = false;
            elementos.consultar.textContent = "Consultar relatório";
            atualizarBotoes();
        }
    }

    /* =====================================================
       RESULTADOS
    ===================================================== */

    function renderizarResultado() {
        const resultado = estado.resultado;

        mostrar(elementos.resultado, true);
        mostrar(elementos.desatualizado, false);

        elementos.resultadoTitulo.textContent = resultado.titulo;

        elementos.resultadoContexto.textContent =
            `${resultado.igreja_nome} • ` +
            `Emitido em ${formatarDataHora(resultado.gerado_em)} • ` +
            `Responsável: ${resultado.responsavel}`;

        elementos.resultadoQuantidade.textContent =
            `${resultado.total_registros} registro(s)`;

        elementos.legenda.textContent =
            resultado.legenda || "Resultados da consulta";

        elementos.notas.textContent = Array.isArray(resultado.notas)
            ? resultado.notas.join("\n")
            : resultado.notas || "";

        elementos.filtrosAplicados.replaceChildren();

        for (const filtro of resultado.filtros_aplicados || []) {
            const marcador = document.createElement("span");
            const nome = document.createElement("strong");

            marcador.className = "filtro-aplicado";
            nome.textContent = `${filtro.rotulo}: `;

            marcador.append(
                nome,
                document.createTextNode(textoSeguro(filtro.valor))
            );

            elementos.filtrosAplicados.append(marcador);
        }

        elementos.indicadores.replaceChildren();

        const classesPermitidas = [
            "entrada",
            "saida",
            "saldo",
            "negativo"
        ];

        for (const indicador of resultado.indicadores || []) {
            const cartao = document.createElement("article");
            const rotulo = document.createElement("span");
            const valor = document.createElement("strong");

            cartao.className = "indicador-relatorio";

            if (classesPermitidas.includes(indicador.classe)) {
                cartao.classList.add(indicador.classe);
            }

            rotulo.textContent = indicador.rotulo;
            valor.textContent = textoSeguro(indicador.valor);

            cartao.append(rotulo, valor);

            if (indicador.descricao) {
                const descricao = document.createElement("small");

                descricao.textContent = indicador.descricao;
                cartao.append(descricao);
            }

            elementos.indicadores.append(cartao);
        }

        renderizarTabela();

        elementos.resultado.scrollIntoView({
            behavior: window.matchMedia(
                "(prefers-reduced-motion: reduce)"
            ).matches ? "auto" : "smooth",
            block: "start"
        });
    }

    function renderizarTabela() {
        const resultado = estado.resultado;

        if (!resultado) {
            return;
        }

        elementos.cabecalhoTabela.replaceChildren();
        elementos.corpoTabela.replaceChildren();

        const cabecalho = document.createElement("tr");

        for (const coluna of resultado.colunas) {
            const celula = document.createElement("th");

            celula.scope = "col";
            celula.textContent = coluna.rotulo;

            if (coluna.alinhamento === "direita") {
                celula.classList.add("coluna-numero");
            }

            cabecalho.append(celula);
        }

        elementos.cabecalhoTabela.append(cabecalho);

        const inicio =
            (estado.pagina - 1) * estado.tamanhoPagina;

        const linhas = resultado.linhas.slice(
            inicio,
            inicio + estado.tamanhoPagina
        );

        for (const registro of linhas) {
            const linha = document.createElement("tr");

            for (const coluna of resultado.colunas) {
                const celula = document.createElement("td");

                /*
                   O backend enviará os valores já formatados:
                   datas, moeda, CPF mascarado etc.
                   textContent evita executar HTML vindo dos dados.
                */
                celula.textContent = textoSeguro(
                    registro[coluna.chave]
                );

                if (coluna.alinhamento === "direita") {
                    celula.classList.add("coluna-numero");
                }

                linha.append(celula);
            }

            elementos.corpoTabela.append(linha);
        }

        const possuiLinhas = resultado.linhas.length > 0;

        mostrar(elementos.vazio, !possuiLinhas);

        const totalPaginas = Math.max(
            1,
            Math.ceil(
                resultado.linhas.length / estado.tamanhoPagina
            )
        );

        mostrar(elementos.paginacao, totalPaginas > 1);

        elementos.paginaAtual.textContent =
            `Página ${estado.pagina} de ${totalPaginas}`;

        atualizarBotoes();
    }

    /* =====================================================
       PDF
    ===================================================== */

    async function baixarPDF() {
        if (
            estado.ocupado ||
            !estado.resultado?.consulta_id ||
            estado.assinaturaConsulta !== assinaturaAtual()
        ) {
            avisar("Consulte novamente antes de gerar o PDF.");
            return;
        }

        estado.ocupado = true;
        atualizarBotoes();

        elementos.pdf.textContent = "Gerando PDF...";
        avisar();

        try {
            /*
               O identificador deverá apontar para a consulta
               autorizada no servidor. O backend precisa conferir
               novamente o usuário, a igreja e a validade da consulta.
            */
            const arquivo = await requisitar(rota("pdf"), {
                metodo: "POST",
                dados: {
                    consulta_id: estado.resultado.consulta_id
                },
                arquivo: true
            });

            const url = URL.createObjectURL(arquivo);
            const link = document.createElement("a");

            link.href = url;
            link.download =
                `papper-relatorio-${dataLocal(new Date())}.pdf`;

            document.body.append(link);
            link.click();
            link.remove();

            setTimeout(() => URL.revokeObjectURL(url), 30000);

            avisar("PDF gerado. O download foi solicitado.", true);
        } catch (erro) {
            avisar(erro.message);
        } finally {
            estado.ocupado = false;
            elementos.pdf.textContent = "Baixar PDF";
            atualizarBotoes();
        }
    }

    /* =====================================================
       LIMPAR FILTROS
    ===================================================== */

    function limparFiltros() {
        const tipoAtual = elementos.tipo.value;

        elementos.formulario.reset();
        elementos.tipo.value = tipoAtual;

        elementos.atalhoPeriodo.value = "mes_atual";
        aplicarPeriodoRapido();
        configurarSecoes();

        estado.resultado = null;
        estado.assinaturaConsulta = null;
        estado.pagina = 1;
        estado.revisaoFormulario += 1;

        mostrar(elementos.resultado, false);
        mostrar(elementos.desatualizado, false);

        avisar();
        atualizarBotoes();
    }

    /* =====================================================
       EVENTOS
    ===================================================== */

    function registrarEventos() {
        elementos.sair.addEventListener("click", sair);

        elementos.formulario.addEventListener("submit", consultar);
        elementos.pdf.addEventListener("click", baixarPDF);
        elementos.limpar.addEventListener("click", limparFiltros);

        elementos.tipo.addEventListener("change", () => {
            configurarSecoes();
            marcarAlteracao();
        });

        elementos.atalhoPeriodo.addEventListener("change", () => {
            aplicarPeriodoRapido();
        });

        for (const campo of [
            elementos.dataInicio,
            elementos.dataFim
        ]) {
            campo.addEventListener("input", () => {
                elementos.atalhoPeriodo.value = "personalizado";
            });
        }

        buscar("financeiro-modelo").addEventListener(
            "change",
            configurarModeloFinanceiro
        );

        elementos.formulario.addEventListener(
            "input",
            marcarAlteracao
        );

        elementos.formulario.addEventListener(
            "change",
            marcarAlteracao
        );

        elementos.anterior.addEventListener("click", () => {
            if (estado.pagina > 1) {
                estado.pagina -= 1;
                renderizarTabela();
            }
        });

        elementos.proxima.addEventListener("click", () => {
            const total = Math.ceil(
                (estado.resultado?.linhas.length || 0) /
                estado.tamanhoPagina
            );

            if (estado.pagina < total) {
                estado.pagina += 1;
                renderizarTabela();
            }
        });
    }

    /* =====================================================
       INICIALIZAÇÃO
    ===================================================== */

    async function iniciar() {
        try {
            const ausentes = Object.entries(elementos)
                .filter(([, elemento]) => !elemento)
                .map(([nome]) => nome);

            if (ausentes.length) {
                throw new Error(
                    "HTML incompleto. Elementos ausentes: " +
                    ausentes.join(", ")
                );
            }

            if (
                typeof API_URL === "undefined" ||
                typeof obterToken !== "function"
            ) {
                throw new Error(
                    "Carregue js/api.js antes de js/relatorios.js."
                );
            }

            registrarEventos();

            estado.usuario = await requisitar("/usuarios/eu");
            estado.igrejaId = obterIgrejaDoUsuario(estado.usuario);

            elementos.usuarioNome.textContent = estado.usuario.nome;
            elementos.usuarioPerfil.textContent = estado.usuario.perfil;

            elementos.usuarioAvatar.textContent = (
                estado.usuario.nome || "U"
            ).charAt(0).toUpperCase();

            estado.opcoes = await requisitar(rota("opcoes"));

            if (
                Number(estado.opcoes.igreja?.id) !==
                Number(estado.igrejaId)
            ) {
                throw new Error(
                    "A identificação da igreja retornada é incompatível."
                );
            }

            elementos.igrejaNome.textContent =
                estado.opcoes.igreja.nome;

            aplicarOpcoes(estado.opcoes);

            elementos.atalhoPeriodo.value = "mes_atual";
            aplicarPeriodoRapido();
            configurarSecoes();

            estado.pronto = true;
            atualizarBotoes();
        } catch (erro) {
            console.error(erro);

            if (elementos.mensagem) {
                avisar(erro.message);
            }
        }
    }

    iniciar();
})();