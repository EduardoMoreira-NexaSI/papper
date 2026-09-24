const usuarioNome = document.querySelector("#usuario-nome");
const usuarioPerfil = document.querySelector("#usuario-perfil");
const usuarioAvatar = document.querySelector("#usuario-avatar");
const mensagemDashboard = document.querySelector("#mensagem-dashboard");
const botaoSair = document.querySelector("#botao-sair");
const logoIgreja = document.querySelector("#logo-igreja");
const logoPlaceholder = document.querySelector("#logo-igreja-placeholder");
const arquivoLogo = document.querySelector("#arquivo-logo-igreja");
const acaoLogo = document.querySelector("#acao-logo-igreja");
let igrejaId = null;
let perfilUsuario = null;
let logoObjectUrl = null;

function dinheiro(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {style: "currency", currency: "BRL"});
}
function dataHora(valor) {
  if (!valor) return "—";
  const d = new Date(valor);
  return d.toLocaleString("pt-BR", {day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit"});
}
function texto(valor) {
  const el = document.createElement("span");
  el.textContent = valor ?? "";
  return el.innerHTML;
}
function statusClasse(status) {
  return String(status || "").toLowerCase().replaceAll("_", "-");
}

async function carregarUsuario() {
  const usuario = await requisicaoAutenticada("/usuarios/eu");
  usuarioNome.textContent = usuario.nome;
  usuarioPerfil.textContent = usuario.perfil;
  usuarioAvatar.textContent = (usuario.nome || "U").charAt(0).toUpperCase();
  igrejaId = obterIgrejaDoUsuario(usuario);
  perfilUsuario = usuario.perfil;
  sessionStorage.setItem("igreja_id", String(igrejaId));
  return usuario;
}

async function carregarLogo() {
  const token = obterToken();
  const resposta = await fetch(`${API_URL}/igrejas/${igrejaId}/logo`, {
    headers: {Authorization: `Bearer ${token}`}
  });
  if (resposta.status === 404) return;
  if (!resposta.ok) return;
  const blob = await resposta.blob();
  if (logoObjectUrl) URL.revokeObjectURL(logoObjectUrl);
  logoObjectUrl = URL.createObjectURL(blob);
  logoIgreja.src = logoObjectUrl;
  logoIgreja.classList.remove("oculto");
  logoPlaceholder.classList.add("oculto");
}

async function atualizarLogo() {
  const arquivo = arquivoLogo.files[0];
  if (!arquivo) return;
  if (arquivo.size > 2 * 1024 * 1024) {
    mensagemDashboard.textContent = "A logo deve possuir no máximo 2 MB.";
    arquivoLogo.value = "";
    return;
  }
  const form = new FormData();
  form.append("arquivo", arquivo);
  try {
    await requisicaoAutenticada(`/igrejas/${igrejaId}/logo`, {method:"POST", body:form});
    await carregarLogo();
    mensagemDashboard.textContent = "Logo atualizada com sucesso.";
  } catch (erro) {
    mensagemDashboard.textContent = erro.message;
  } finally {
    arquivoLogo.value = "";
  }
}

function renderizarFluxo(pontos) {
  const alvo = document.querySelector("#grafico-fluxo");
  if (!pontos?.length) {
    alvo.innerHTML = '<p class="estado-vazio-dashboard">Sem movimentações nos últimos 30 dias.</p>';
    return;
  }
  const maximo = Math.max(1, ...pontos.flatMap(p => [Number(p.entradas), Number(p.saidas)]));
  alvo.innerHTML = pontos.map(p => {
    const entrada = Math.max(2, Number(p.entradas) / maximo * 100);
    const saida = Math.max(2, Number(p.saidas) / maximo * 100);
    const rotulo = new Date(`${p.data}T12:00:00`).toLocaleDateString("pt-BR", {day:"2-digit", month:"2-digit"});
    return `<div class="coluna-fluxo" title="${rotulo} — Entradas ${dinheiro(p.entradas)} | Saídas ${dinheiro(p.saidas)}">
      <div class="barras-fluxo"><span class="barra-entrada" style="height:${entrada}%"></span><span class="barra-saida" style="height:${saida}%"></span></div>
      <small>${rotulo}</small>
    </div>`;
  }).join("");
}

function renderizarLista(id, itens, montar) {
  const alvo = document.querySelector(id);
  alvo.innerHTML = itens?.length ? itens.map(montar).join("") : '<p class="estado-vazio-dashboard">Nenhum registro neste período.</p>';
}

function renderizarDashboard(dados) {
  document.querySelector("#nome-igreja-dashboard").textContent = dados.igreja.nome;
  document.querySelector("#presidente-igreja-dashboard").textContent = `Presidente: ${dados.igreja.presidente}`;
  document.querySelector("#total-membros").textContent = dados.membros_ativos;
  document.querySelector("#membros-novos-mes").textContent = dados.membros_novos_mes;
  document.querySelector("#total-atividades").textContent = dados.proximas_atividades.length;
  document.querySelector("#visitas-agendadas").textContent = dados.visitas_agendadas_mes;
  document.querySelector("#visitas-realizadas").textContent = dados.visitas_realizadas_mes;

  const f = dados.financeiro;
  document.querySelector("#total-entradas").textContent = dinheiro(f.entradas_mes);
  document.querySelector("#total-saidas").textContent = dinheiro(f.saidas_mes);
  document.querySelector("#saldo-atual").textContent = dinheiro(f.resultado_mes);
  document.querySelector("#caixa-fisico").textContent = dinheiro(f.caixa_fisico_estimado);
  document.querySelector("#cofre-estimado").textContent = dinheiro(f.cofre_estimado);
  document.querySelector("#envelopes-pendentes").textContent = dinheiro(f.envelopes_aguardando_visto);
  renderizarFluxo(f.fluxo_30_dias);

  renderizarLista("#calendario-atividades", dados.calendario.slice(0, 12), a =>
    `<a class="item-lista-dashboard" href="atividades.html"><span><strong>${texto(a.titulo)}</strong><small>${texto(a.tipo)} · ${texto(a.local || "Local não informado")}</small></span><time>${dataHora(a.data_hora_inicio)}</time></a>`
  );
  renderizarLista("#lista-novos-membros", dados.novos_membros, m =>
    `<a class="item-lista-dashboard" href="membros.html"><span><strong>${texto(m.nome)}</strong><small>${texto(m.contato || "Contato não informado")}</small></span><time>${dataHora(m.criado_em)}</time></a>`
  );

  const visitas = document.querySelector("#tabela-visitas-dashboard");
  visitas.innerHTML = dados.visitas.length ? dados.visitas.map(v =>
    `<tr><td>${texto(v.titulo)}</td><td>${dataHora(v.data_hora_inicio)}</td><td><span class="status-dashboard status-${statusClasse(v.status)}">${texto(v.status)}</span></td></tr>`
  ).join("") : '<tr><td colspan="3">Nenhuma visita registrada no mês.</td></tr>';

  const mov = document.querySelector("#tabela-movimentacoes-dashboard");
  if (!dados.financeiro_permitido) {
    document.querySelector("#painel-movimentacoes-recentes").classList.add("oculto");
  } else {
    mov.innerHTML = f.movimentacoes_recentes.length ? f.movimentacoes_recentes.map(m =>
      `<tr><td>${dataHora(m.data)}</td><td>${texto(m.descricao || m.categoria)}</td><td class="valor-${texto(m.tipo)}">${m.tipo === "saida" ? "−" : "+"} ${dinheiro(m.valor)}</td></tr>`
    ).join("") : '<tr><td colspan="3">Sem movimentações no mês.</td></tr>';
  }
}

async function iniciarDashboard() {
  try {
    await carregarUsuario();
    acaoLogo.classList.toggle("oculto", !["master","administrador","pastor"].includes(perfilUsuario));
    const dados = await requisicaoAutenticada(`/igrejas/${igrejaId}/dashboard`);
    renderizarDashboard(dados);
    if (dados.igreja.tem_logo) await carregarLogo();
  } catch (erro) {
    mensagemDashboard.textContent = erro.message;
  }
}

arquivoLogo.addEventListener("change", atualizarLogo);
botaoSair.addEventListener("click", () => {
  sessionStorage.clear();
  window.location.href = "login.html";
});
window.addEventListener("beforeunload", () => { if (logoObjectUrl) URL.revokeObjectURL(logoObjectUrl); });
iniciarDashboard();
