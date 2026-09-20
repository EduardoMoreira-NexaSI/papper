(() => {
  "use strict";

  const estado = { usuario: null, igrejas: [], usuarios: [] };

  const el = {
    nome: document.querySelector("#usuario-nome"),
    perfil: document.querySelector("#usuario-perfil"),
    avatar: document.querySelector("#usuario-avatar"),
    mensagem: document.querySelector("#mensagem-admin"),
    sair: document.querySelector("#botao-sair"),
    totalIgrejas: document.querySelector("#admin-total-igrejas"),
    totalUsuarios: document.querySelector("#admin-total-usuarios"),
    usuariosAtivos: document.querySelector("#admin-usuarios-ativos"),
    totalMembros: document.querySelector("#admin-total-membros"),
    banco: document.querySelector("#admin-banco"),
    corpoIgrejas: document.querySelector("#admin-corpo-igrejas"),
    corpoUsuarios: document.querySelector("#admin-corpo-usuarios"),
    filtroIgreja: document.querySelector("#admin-filtro-igreja"),
    formIgreja: document.querySelector("#form-admin-igreja"),
    formUsuario: document.querySelector("#form-admin-usuario"),
    usuarioIgreja: document.querySelector("#admin-usuario-igreja")
  };

  function escapar(valor) {
    const div = document.createElement("div");
    div.textContent = valor ?? "—";
    return div.innerHTML;
  }

  function avisar(texto = "", sucesso = false) {
    el.mensagem.textContent = texto;
    el.mensagem.className = "mensagem-login";
    if (texto) el.mensagem.classList.add(sucesso ? "mensagem-sucesso" : "mensagem-erro");
  }

  function nomeIgreja(id) {
    return estado.igrejas.find((igreja) => igreja.id === id)?.nome || "—";
  }

  function preencherIgrejas() {
    const opcoes = estado.igrejas.map((igreja) =>
      `<option value="${igreja.id}">${escapar(igreja.nome)}</option>`
    ).join("");

    el.usuarioIgreja.innerHTML = opcoes;
    el.filtroIgreja.innerHTML = `<option value="">Todas as igrejas</option>${opcoes}`;
  }

  function renderizarIgrejas() {
    el.corpoIgrejas.innerHTML = estado.igrejas.map((igreja) => `
      <tr>
        <td>${igreja.id}</td>
        <td><strong>${escapar(igreja.nome)}</strong><br><small>${escapar(igreja.endereco)}</small></td>
        <td>${escapar(igreja.presidente)}</td>
        <td><button type="button" class="admin-botao-secundario" data-abrir-igreja="${igreja.id}">Abrir painel</button></td>
      </tr>
    `).join("") || `<tr><td colspan="4">Nenhuma igreja cadastrada.</td></tr>`;
  }

  function renderizarUsuarios() {
    el.corpoUsuarios.innerHTML = estado.usuarios.map((usuario) => {
      const status = usuario.ativo ? "Ativo" : "Inativo";
      const acao = usuario.ativo ? "Desativar" : "Ativar";
      return `
        <tr>
          <td><strong>${escapar(usuario.username)}</strong><br><small>${escapar(usuario.email || "Sem e-mail")}</small></td>
          <td>${escapar(usuario.nome)}</td>
          <td>${escapar(usuario.perfil)}</td>
          <td>${escapar(nomeIgreja(usuario.igreja_id))}</td>
          <td><span class="admin-status ${usuario.ativo ? "ativo" : "inativo"}">${status}</span></td>
          <td class="admin-acoes-tabela">
            <button type="button" class="admin-botao-secundario" data-status-usuario="${usuario.id}" data-ativo="${usuario.ativo}">${acao}</button>
            <button type="button" class="admin-botao-secundario" data-senha-usuario="${usuario.id}">Redefinir senha</button>
          </td>
        </tr>`;
    }).join("") || `<tr><td colspan="6">Nenhum usuário encontrado.</td></tr>`;
  }

  async function carregarResumo() {
    const resumo = await requisicaoAutenticada("/admin/resumo");
    el.totalIgrejas.textContent = resumo.total_igrejas;
    el.totalUsuarios.textContent = resumo.total_usuarios;
    el.usuariosAtivos.textContent = `${resumo.usuarios_ativos} ativos`;
    el.totalMembros.textContent = resumo.total_membros;
    el.banco.textContent = String(resumo.banco).toUpperCase();
  }

  async function carregarIgrejas() {
    estado.igrejas = await requisicaoAutenticada("/admin/igrejas");
    preencherIgrejas();
    renderizarIgrejas();
  }

  async function carregarUsuarios() {
    const filtro = el.filtroIgreja.value;
    const sufixo = filtro ? `?igreja_id=${encodeURIComponent(filtro)}` : "";
    estado.usuarios = await requisicaoAutenticada(`/admin/usuarios${sufixo}`);
    renderizarUsuarios();
  }

  async function iniciar() {
    try {
      estado.usuario = await requisicaoAutenticada("/usuarios/eu");
      if (estado.usuario.perfil !== "master") {
        window.location.href = "dashboard.html";
        return;
      }

      el.nome.textContent = estado.usuario.nome;
      el.perfil.textContent = "master";
      el.avatar.textContent = estado.usuario.nome.charAt(0).toUpperCase();

      await Promise.all([carregarResumo(), carregarIgrejas()]);
      await carregarUsuarios();
    } catch (erro) {
      avisar(erro.message);
    }
  }

  el.filtroIgreja.addEventListener("change", () => carregarUsuarios().catch((erro) => avisar(erro.message)));

  el.corpoIgrejas.addEventListener("click", (evento) => {
    const botao = evento.target.closest("[data-abrir-igreja]");
    if (!botao) return;
    sessionStorage.setItem("igreja_id", botao.dataset.abrirIgreja);
    window.location.href = "dashboard.html";
  });

  el.corpoUsuarios.addEventListener("click", async (evento) => {
    const statusBotao = evento.target.closest("[data-status-usuario]");
    const senhaBotao = evento.target.closest("[data-senha-usuario]");

    try {
      if (statusBotao) {
        const id = Number(statusBotao.dataset.statusUsuario);
        const ativoAtual = statusBotao.dataset.ativo === "true";
        await requisicaoAutenticada(`/admin/usuarios/${id}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ativo: !ativoAtual })
        });
        await Promise.all([carregarResumo(), carregarUsuarios()]);
        avisar("Status atualizado.", true);
      }

      if (senhaBotao) {
        const id = Number(senhaBotao.dataset.senhaUsuario);
        const novaSenha = window.prompt("Digite a nova senha (mínimo 8 caracteres):");
        if (!novaSenha) return;
        if (novaSenha.length < 8) throw new Error("A nova senha precisa ter pelo menos 8 caracteres.");
        await requisicaoAutenticada(`/admin/usuarios/${id}/redefinir-senha`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nova_senha: novaSenha })
        });
        avisar("Senha redefinida com sucesso.", true);
      }
    } catch (erro) {
      avisar(erro.message);
    }
  });

  el.formIgreja.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    try {
      await requisicaoAutenticada("/admin/igrejas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: document.querySelector("#admin-igreja-nome").value.trim(),
          presidente: document.querySelector("#admin-igreja-presidente").value.trim(),
          endereco: document.querySelector("#admin-igreja-endereco").value.trim()
        })
      });
      el.formIgreja.reset();
      await Promise.all([carregarResumo(), carregarIgrejas()]);
      await carregarUsuarios();
      avisar("Igreja cadastrada com sucesso.", true);
    } catch (erro) {
      avisar(erro.message);
    }
  });

  el.formUsuario.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    try {
      const email = document.querySelector("#admin-usuario-email").value.trim();
      await requisicaoAutenticada("/admin/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: document.querySelector("#admin-usuario-nome").value.trim(),
          username: document.querySelector("#admin-usuario-username").value.trim(),
          email: email || null,
          senha: document.querySelector("#admin-usuario-senha").value,
          perfil: document.querySelector("#admin-usuario-perfil").value,
          igreja_id: Number(el.usuarioIgreja.value),
          membro_id: null
        })
      });
      el.formUsuario.reset();
      await Promise.all([carregarResumo(), carregarUsuarios()]);
      avisar("Usuário criado com sucesso.", true);
    } catch (erro) {
      avisar(erro.message);
    }
  });

  el.sair.addEventListener("click", () => {
    sessionStorage.clear();
    window.location.href = "login.html";
  });

  iniciar();
})();
