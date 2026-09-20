const formularioLogin = document.querySelector("#form-login");
const mensagemLogin = document.querySelector("#mensagem-login");
const botaoEntrar = document.querySelector("#botao-entrar");

formularioLogin.addEventListener("submit", async function (evento) {
  evento.preventDefault();

  const credencial = document.querySelector("#credencial").value.trim();
  const senha = document.querySelector("#senha").value;

  mensagemLogin.textContent = "";
  mensagemLogin.className = "mensagem-login";

  botaoEntrar.disabled = true;
  botaoEntrar.textContent = "Entrando...";

  try {
    const resposta = await fazerLogin(credencial, senha);

    sessionStorage.setItem("access_token", resposta.access_token);

    const usuario = await requisicaoAutenticada("/usuarios/eu");
    sessionStorage.setItem("igreja_id", String(usuario.igreja_id ?? ""));
    sessionStorage.setItem("perfil", usuario.perfil);

    mensagemLogin.textContent = "Login realizado com sucesso!";
    mensagemLogin.classList.add("mensagem-sucesso");

    window.location.href = usuario.perfil === "master"
      ? "admin.html"
      : "dashboard.html";
  } catch (erro) {
    sessionStorage.removeItem("access_token");
    sessionStorage.removeItem("igreja_id");
    sessionStorage.removeItem("perfil");
    mensagemLogin.textContent = erro.message;
    mensagemLogin.classList.add("mensagem-erro");
  } finally {
    botaoEntrar.disabled = false;
    botaoEntrar.textContent = "Entrar no painel";
  }
});
