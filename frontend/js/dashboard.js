const usuarioNome = document.querySelector("#usuario-nome");
const usuarioPerfil = document.querySelector("#usuario-perfil");
const usuarioAvatar = document.querySelector("#usuario-avatar");
const mensagemDashboard = document.querySelector("#mensagem-dashboard");
const botaoSair = document.querySelector("#botao-sair");


const totalMembrosElemento = document.querySelector("#total-membros");
const totalAtividadesElemento = document.querySelector("#total-atividades");
const totalEntradasElemento = document.querySelector("#total-entradas");
const saldoAtualElemento = document.querySelector("#saldo-atual");


function formatarDinheiro(valor) {
  const numero = Number(valor);

  return numero.toLocaleString("pt-BR",{
    style: "currency",
    currency: "BRL"
  });
}


async function carregarUsuario() {
  const usuario = await requisicaoAutenticada("/usuarios/eu");

  usuarioNome.textContent = usuario.nome;
  usuarioPerfil.textContent = usuario.perfil;

  usuarioAvatar.textContent = usuario.nome
  .charAt(0)
  .toUpperCase();

  sessionStorage.setItem(
    "igreja_id",
    String(obterIgrejaDoUsuario(usuario))
  );
    
  return usuario;
}

async function carregarIndicadores(igrejaId) {
  const [
    membros,
    atividades,
    financeiro
  ] = await Promise.all([
    requisicaoAutenticada(
      `/igrejas/${igrejaId}/membros`
    ),

    requisicaoAutenticada(
      `/igrejas/${igrejaId}/atividades`
    ),

    requisicaoAutenticada(
      `/igrejas/${igrejaId}/financeiro/resumo`
    ),
  ]);

  const membrosAtivos = membros.filter(function(membro){
    return membro.status ===true
  });

  const agora = new Date();

  const proximasAtividades = atividades.filter(function(atividade){
    const dataAtividade = new Date(
      atividade.data_hora_inicio
    );

    return (
      atividade.status !== "cancelado" &&
      dataAtividade >= agora
    );
  });

  totalMembrosElemento.textContent = membrosAtivos.length;
  totalAtividadesElemento.textContent =     proximasAtividades.length;

  totalEntradasElemento.textContent =         formatarDinheiro(
    financeiro.total_entradas
  );

  saldoAtualElemento.textContent = formatarDinheiro(
    financeiro.saldo
  );
}

async function iniciarDashboard() {
  mensagemDashboard.textContent = "";

  try {
    const usuario = await carregarUsuario();
    const igrejaId = obterIgrejaDoUsuario(usuario);
    sessionStorage.setItem("igreja_id", String(igrejaId));
    await carregarIndicadores(igrejaId);
  } catch (erro) {
    mensagemDashboard.textContent = erro.message;
  }
}


botaoSair.addEventListener("click", function(){
  sessionStorage.removeItem("access_token");
  sessionStorage.removeItem("igreja_id");
  sessionStorage.removeItem("perfil");

  window.location.href = "login.html";
});

iniciarDashboard();