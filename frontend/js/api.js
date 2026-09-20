const HOST_LOCAL = ["127.0.0.1", "localhost"].includes(window.location.hostname);
const PORTAS_FRONTEND_SEPARADO = new Set(["3000", "5173", "5500", "5501", "5502", "5503"]);
const FRONTEND_LOCAL_SEPARADO = HOST_LOCAL && PORTAS_FRONTEND_SEPARADO.has(window.location.port);

// Quando o FastAPI serve o frontend (inclusive em 8001, 8002 etc.),
// API e site usam a mesma origem. Live Server/Vite continuam compatíveis
// apontando para o FastAPI padrão em 8000.
const API_URL = FRONTEND_LOCAL_SEPARADO
    ? `${window.location.protocol}//${window.location.hostname}:8000`
    : "";

async function lerRespostaJson(resposta) {
    const texto = await resposta.text();

    if (!texto.trim()) {
        return null;
    }

    try {
        return JSON.parse(texto);
    } catch {
        throw new Error(
            `O servidor respondeu em formato inesperado (${resposta.status}).`
        );
    }
}

/*
    Faz o login enviando os dados no formato
    esperado pelo OAuth2 do FastAPI.
*/
async function fazerLogin(credencial, senha) {
    const formulario = new URLSearchParams();

    formulario.append("username", credencial);
    formulario.append("password", senha);

    const resposta = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: formulario
    });

    const dados = await lerRespostaJson(resposta);

    if (!resposta.ok) {
        throw new Error(
            dados?.detail ||
            `Não foi possível realizar o login (${resposta.status}).`
        );
    }

    if (!dados) {
        throw new Error(
            "O servidor não retornou os dados do login."
        );
    }

    return dados;
}

/*
    Retorna o token que foi salvo depois do login.
*/
function obterToken() {
    return sessionStorage.getItem("access_token");
}

/*
    Faz requisições para rotas protegidas da API.
*/
async function requisicaoAutenticada(caminho, opcoes = {}) {
    const token = obterToken();

    if (!token) {
        window.location.href = "./login.html";
        throw new Error("Usuário não autenticado.");
    }

    const resposta = await fetch(`${API_URL}${caminho}`, {
        ...opcoes,
        headers: {
            ...opcoes.headers,
            Authorization: `Bearer ${token}`
        }
    });

    if (resposta.status === 401) {
        sessionStorage.removeItem("access_token");
        sessionStorage.removeItem("igreja_id");
        sessionStorage.removeItem("perfil");

        window.location.href = "./login.html";

        throw new Error(
            "Sua sessão expirou. Faça login novamente."
        );
    }

    // 204 significa sucesso sem corpo de resposta.
    if (resposta.status === 204) {
        return null;
    }

    const dados = await lerRespostaJson(resposta);

    if (!resposta.ok) {
        throw new Error(
            dados?.detail ||
            `Não foi possível consultar a API (${resposta.status}).`
        );
    }

    return dados;
}
/*
    Define qual igreja será usada nas telas operacionais.
    Usuários comuns ficam presos à própria igreja.
    O master pode escolher outra igreja pela área administrativa.
*/
function obterIgrejaDoUsuario(usuario) {
    if (!usuario) {
        return null;
    }

    if (usuario.perfil === "master") {
        const selecionada = Number(sessionStorage.getItem("igreja_id"));
        return selecionada > 0 ? selecionada : usuario.igreja_id;
    }

    return usuario.igreja_id;
}

function prepararLinkMaster() {
    if (sessionStorage.getItem("perfil") !== "master") {
        return;
    }

    const menu = document.querySelector(".menu-navegacao");
    if (!menu || menu.querySelector('a[href="admin.html"]')) {
        return;
    }

    const link = document.createElement("a");
    link.href = "admin.html";
    link.textContent = "Administração";
    menu.appendChild(link);
}

document.addEventListener("DOMContentLoaded", prepararLinkMaster);
