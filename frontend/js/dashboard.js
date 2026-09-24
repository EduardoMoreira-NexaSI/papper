const usuarioNome = document.querySelector("#usuario-nome");
const usuarioPerfil = document.querySelector("#usuario-perfil");
const usuarioAvatar = document.querySelector("#usuario-avatar");
const mensagemDashboard = document.querySelector("#mensagem-dashboard");
const botaoSair = document.querySelector("#botao-sair");
const logoIgreja = document.querySelector("#logo-igreja");
const logoPlaceholder = document.querySelector("#logo-igreja-placeholder");
const arquivoLogo = document.querySelector("#arquivo-logo-igreja");
const acaoLogo = document.querySelector("#acao-logo-igreja");
const calendarioGrid = document.querySelector("#calendario-grid");
const calendarioTitulo = document.querySelector("#calendario-titulo");
const listaLembretes = document.querySelector("#lista-lembretes");
const formLembrete = document.querySelector("#form-lembrete");

let igrejaId = null;
let perfilUsuario = null;
let logoObjectUrl = null;
let mesCalendario = new Date();
mesCalendario = new Date(mesCalendario.getFullYear(), mesCalendario.getMonth(), 1);

function dinheiro(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {style: "currency", currency: "BRL"});
}

function dataHora(valor) {
  if (!valor) return "—";
  const d = new Date(valor);
  return d.toLocaleString("pt-BR", {day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit"});
}

function texto(valor) {
  const el = document.createElement("span");
  el.textContent = valor ?? "";
  return el.innerHTML;
}

function statusClasse(status) {
  return String(status || "").toLowerCase().replaceAll("_", "-");
}

function avisar(mensagem = "", sucesso = false) {
  mensagemDashboard.textContent = mensagem;
  mensagemDashboard.classList.toggle("sucesso", sucesso && Boolean(mensagem));
}

async function carregarUsuario() {
  const usuario = await requisicaoAutenticada("/usuarios/eu");
  usuarioNome.textContent = usuario.nome;
  usuarioPerfil.textContent = usuario.perfil;
  usuarioAvatar.textContent = (usuario.nome || "U").charAt(0).toUpperCase();
  igrejaId = obterIgrejaDoUsuario(usuario);
  perfilUsuario = usuario.perfil;
  sessionStorage.setItem("igreja_id", String(igrejaId));
  sessionStorage.setItem("perfil", usuario.perfil);
  return usuario;
}

async function carregarLogo() {
  const token = obterToken();
  const resposta = await fetch(`${API_URL}/igrejas/${igrejaId}/logo`, {
    headers: {Authorization: `Bearer ${token}`}
  });
  if (resposta.status === 404 || !resposta.ok) return;
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
    avisar("A logo deve possuir no máximo 2 MB.");
    arquivoLogo.value = "";
    return;
  }
  const form = new FormData();
  form.append("arquivo", arquivo);
  try {
    await requisicaoAutenticada(`/igrejas/${igrejaId}/logo`, {method:"POST", body:form});
    await carregarLogo();
    avisar("Logo atualizada com sucesso.", true);
  } catch (erro) {
    avisar(erro.message);
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
    const entrada = Number(p.entradas) > 0 ? Math.max(4, Number(p.entradas) / maximo * 100) : 0;
    const saida = Number(p.saidas) > 0 ? Math.max(4, Number(p.saidas) / maximo * 100) : 0;
    const rotulo = new Date(`${p.data}T12:00:00`).toLocaleDateString("pt-BR", {day:"2-digit", month:"2-digit"});
    return `<div class="coluna-fluxo" title="${rotulo} — Entradas ${dinheiro(p.entradas)} | Saídas ${dinheiro(p.saidas)}">
      <div class="barras-fluxo"><span class="barra-entrada" style="height:${entrada}%"></span><span class="barra-saida" style="height:${saida}%"></span></div>
      <small>${rotulo}</small>
    </div>`;
  }).join("");
}

function renderizarGraficoMembros(pontos) {
  const alvo = document.querySelector("#grafico-novos-membros");
  const dados = pontos || [];
  const maximo = Math.max(1, ...dados.map(p => Number(p.total || 0)));
  alvo.innerHTML = dados.map(p => {
    const total = Number(p.total || 0);
    const altura = total ? Math.max(10, total / maximo * 100) : 3;
    return `<div class="coluna-membros" title="${texto(p.rotulo)}: ${total} novo(s) membro(s)">
      <strong>${total}</strong>
      <div class="barra-membros-wrap"><span style="height:${altura}%"></span></div>
      <small>Dia ${texto(p.rotulo)}</small>
    </div>`;
  }).join("") || '<p class="estado-vazio-dashboard">Ainda não há histórico de cadastro.</p>';
}

function renderizarLista(id, itens, montar) {
  const alvo = document.querySelector(id);
  alvo.innerHTML = itens?.length ? itens.map(montar).join("") : '<p class="estado-vazio-dashboard">Nenhum registro neste período.</p>';
}

function chaveDataLocal(valor) {
  const d = new Date(valor);
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function renderizarCalendario(ano, mes, atividades) {
  const nomesMeses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  calendarioTitulo.textContent = `${nomesMeses[mes - 1]} ${ano}`;

  const porDia = new Map();
  for (const atividade of atividades || []) {
    const chave = chaveDataLocal(atividade.data_hora_inicio);
    if (!porDia.has(chave)) porDia.set(chave, []);
    porDia.get(chave).push(atividade);
  }

  const primeiro = new Date(ano, mes - 1, 1);
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const inicioSemana = primeiro.getDay();
  const totalCelulas = Math.ceil((inicioSemana + ultimoDia) / 7) * 7;
  const hoje = new Date();
  const chaveHoje = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,"0")}-${String(hoje.getDate()).padStart(2,"0")}`;

  const celulas = [];
  for (let indice = 0; indice < totalCelulas; indice += 1) {
    const dia = indice - inicioSemana + 1;
    if (dia < 1 || dia > ultimoDia) {
      celulas.push('<div class="dia-calendario fora-mes"></div>');
      continue;
    }
    const chave = `${ano}-${String(mes).padStart(2,"0")}-${String(dia).padStart(2,"0")}`;
    const eventos = porDia.get(chave) || [];
    const itens = eventos.slice(0, 3).map(evento => {
      const hora = new Date(evento.data_hora_inicio).toLocaleTimeString("pt-BR", {hour:"2-digit", minute:"2-digit"});
      return `<a href="atividades.html" class="evento-calendario tipo-${statusClasse(evento.tipo)}" title="${texto(evento.titulo)} — ${hora}"><span>${hora}</span>${texto(evento.titulo)}</a>`;
    }).join("");
    const extra = eventos.length > 3 ? `<small class="mais-eventos">+${eventos.length - 3} evento(s)</small>` : "";
    celulas.push(`<div class="dia-calendario ${chave === chaveHoje ? "hoje" : ""}"><div class="numero-dia">${dia}</div>${itens}${extra}</div>`);
  }
  calendarioGrid.innerHTML = celulas.join("");
}

async function carregarCalendario() {
  const ano = mesCalendario.getFullYear();
  const mes = mesCalendario.getMonth() + 1;
  try {
    const dados = await requisicaoAutenticada(`/igrejas/${igrejaId}/dashboard/calendario?ano=${ano}&mes=${mes}`);
    renderizarCalendario(dados.ano, dados.mes, dados.atividades);
  } catch (erro) {
    calendarioGrid.innerHTML = `<p class="estado-vazio-dashboard">${texto(erro.message)}</p>`;
  }
}

function renderizarLembretes(itens) {
  document.querySelector("#total-lembretes").textContent = itens.length;
  if (!itens.length) {
    listaLembretes.innerHTML = '<p class="estado-vazio-dashboard">Você não possui lembretes ativos.</p>';
    return;
  }
  const agora = Date.now();
  listaLembretes.innerHTML = itens.map(item => {
    const vencido = new Date(item.lembrar_em).getTime() < agora;
    return `<article class="item-lembrete ${vencido ? "lembrete-atrasado" : ""}">
      <div>
        <strong>${texto(item.titulo)}</strong>
        <time>${dataHora(item.lembrar_em)}${vencido ? " • vencido" : ""}</time>
        ${item.descricao ? `<p>${texto(item.descricao)}</p>` : ""}
      </div>
      <button type="button" class="botao-desativar-lembrete" data-lembrete-id="${item.id}">Desativar</button>
    </article>`;
  }).join("");
}

async function recarregarLembretes() {
  const itens = await requisicaoAutenticada(`/igrejas/${igrejaId}/lembretes`);
  renderizarLembretes(itens);
}

async function salvarLembrete(evento) {
  evento.preventDefault();
  const titulo = document.querySelector("#lembrete-titulo").value.trim();
  const lembrarEm = document.querySelector("#lembrete-data").value;
  const descricao = document.querySelector("#lembrete-descricao").value.trim();
  if (!titulo || !lembrarEm) return;
  try {
    await requisicaoAutenticada(`/igrejas/${igrejaId}/lembretes`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({titulo, descricao: descricao || null, lembrar_em: lembrarEm})
    });
    formLembrete.reset();
    formLembrete.classList.add("oculto");
    await recarregarLembretes();
    avisar("Lembrete criado com sucesso.", true);
  } catch (erro) {
    avisar(erro.message);
  }
}

async function desativarLembrete(id) {
  try {
    await requisicaoAutenticada(`/igrejas/${igrejaId}/lembretes/${id}/status`, {
      method: "PATCH",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ativo: false})
    });
    await recarregarLembretes();
    avisar("Lembrete desativado.", true);
  } catch (erro) {
    avisar(erro.message);
  }
}

function renderizarDashboard(dados) {
  document.querySelector("#nome-igreja-dashboard").textContent = dados.igreja.nome;
  document.querySelector("#presidente-igreja-dashboard").textContent = `${dados.igreja.rotulo_lider || "Pastor responsável"}: ${dados.igreja.presidente}`;
  document.querySelector("#total-membros").textContent = dados.membros_ativos;
  document.querySelector("#membros-novos-mes").textContent = dados.membros_novos_mes;
  document.querySelector("#total-atividades").textContent = dados.proximas_atividades.length;
  document.querySelector("#visitas-agendadas").textContent = dados.visitas_agendadas_mes;
  document.querySelector("#visitas-realizadas").textContent = dados.visitas_realizadas_mes;
  renderizarLembretes(dados.lembretes || []);
  renderizarGraficoMembros(dados.membros_mes_grafico || []);

  const f = dados.financeiro;
  document.querySelectorAll(".financeiro-dashboard").forEach(el => el.classList.toggle("oculto", !dados.financeiro_permitido));
  if (dados.financeiro_permitido) {
    document.querySelector("#total-entradas").textContent = dinheiro(f.entradas_mes);
    document.querySelector("#total-saidas").textContent = dinheiro(f.saidas_mes);
    document.querySelector("#saldo-atual").textContent = dinheiro(f.resultado_mes);
    document.querySelector("#caixa-fisico").textContent = dinheiro(f.caixa_fisico_estimado);
    document.querySelector("#cofre-estimado").textContent = dinheiro(f.cofre_estimado);
    document.querySelector("#envelopes-pendentes").textContent = dinheiro(f.envelopes_aguardando_visto);
    renderizarFluxo(f.fluxo_30_dias);
  } else {
    document.querySelector("#grafico-fluxo").innerHTML = '<p class="estado-vazio-dashboard">Seu perfil não possui acesso ao financeiro.</p>';
  }

  renderizarLista("#lista-novos-membros", dados.novos_membros, m =>
    `<a class="item-lista-dashboard" href="membros.html"><span><strong>${texto(m.nome)}</strong><small>${texto(m.contato || "Contato não informado")}</small></span><time>${dataHora(m.criado_em)}</time></a>`
  );

  const visitas = document.querySelector("#tabela-visitas-dashboard");
  visitas.innerHTML = dados.visitas.length ? dados.visitas.map(v =>
    `<tr><td>${texto(v.titulo)}</td><td>${dataHora(v.data_hora_inicio)}</td><td><span class="status-dashboard status-${statusClasse(v.status)}">${texto(v.status)}</span></td></tr>`
  ).join("") : '<tr><td colspan="3">Nenhuma visita registrada no mês.</td></tr>';

  const mov = document.querySelector("#tabela-movimentacoes-dashboard");
  if (dados.financeiro_permitido) {
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
    await carregarCalendario();
  } catch (erro) {
    avisar(erro.message);
  }
}

arquivoLogo.addEventListener("change", atualizarLogo);
botaoSair.addEventListener("click", () => {
  sessionStorage.clear();
  window.location.href = "login.html";
});

document.querySelector("#calendario-anterior").addEventListener("click", async () => {
  mesCalendario = new Date(mesCalendario.getFullYear(), mesCalendario.getMonth() - 1, 1);
  await carregarCalendario();
});

document.querySelector("#calendario-proximo").addEventListener("click", async () => {
  mesCalendario = new Date(mesCalendario.getFullYear(), mesCalendario.getMonth() + 1, 1);
  await carregarCalendario();
});

document.querySelector("#botao-novo-lembrete").addEventListener("click", () => {
  formLembrete.classList.remove("oculto");
  document.querySelector("#lembrete-titulo").focus();
});

document.querySelector("#cancelar-lembrete").addEventListener("click", () => {
  formLembrete.reset();
  formLembrete.classList.add("oculto");
});

formLembrete.addEventListener("submit", salvarLembrete);
listaLembretes.addEventListener("click", event => {
  const botao = event.target.closest("[data-lembrete-id]");
  if (!botao) return;
  desativarLembrete(Number(botao.dataset.lembreteId));
});

window.addEventListener("beforeunload", () => {
  if (logoObjectUrl) URL.revokeObjectURL(logoObjectUrl);
});

iniciarDashboard();
