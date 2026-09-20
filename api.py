import os
from pathlib import Path
from fastapi.security import OAuth2PasswordRequestForm, OAuth2PasswordBearer


from fastapi import Depends, FastAPI, HTTPException, status, Header
from sqlalchemy.orm import Session
from sqlalchemy import select, or_
from datetime import datetime, date, time
from decimal import Decimal
from typing import Literal
from database import obter_banco
from relatorios_backend import registrar_relatorios
from admin_backend import registrar_admin


from jwt.exceptions import InvalidTokenError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

from seguranca import(
  criar_hash_senha,
  criar_token_acesso,
  decodificar_token,
  verificar_senha,
)


from models import (
  AtividadeBanco,
  FuncaoBanco,
  GrupoBanco,
  IgrejaBanco,
  MembroBanco,
  MovimentacaoFinanceiraBanco,
  PresencaBanco,
  UsuarioBanco,
)

from schemas import (
    AtividadeAtualizar,
    AtividadeCriar,
    AtividadeResposta,
    FuncaoAtualizar,
    FuncaoCriar,
    FuncaoDetalhada,
    FuncaoResposta,
    GrupoAtualizar,
    GrupoCriar,
    GrupoDetalhado,
    GrupoResposta,
    IgrejaCriar,
    IgrejaResposta,
    MembroCriar,
    MembroResposta,
    PresencaCriar,
    PresencaDetalhada,
    PresencaResposta,
    PresencaAtualizar,
    ResumoPresencas,
    HistoricoPresenca,
    ResumoFrequenciaMembro,
    MovimentacaoCriar,
    MovimentacaoResposta,
    ResumoFinanceiro,
    PrimeiroAdministradorCriar,
    UsuarioResposta,
    UsuarioCriar,
    TokenResposta,
    DefinirLiderGrupo,
    VincularMembroFuncao,
    VincularMembroGrupo,
    MembroAtualizar,
  
)


SETUP_TOKEN = os.getenv("SETUP_TOKEN")


def exigir_token_setup(
    x_setup_token: str | None = Header(default=None)
):
  if not SETUP_TOKEN:
    raise HTTPException(
      status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
      detail="SETUP_TOKEN não configurado no servidor."
    )

  if x_setup_token != SETUP_TOKEN:
    raise HTTPException(
      status_code=status.HTTP_403_FORBIDDEN,
      detail="Token de configuração inválido."
    )

  return True


def validar_igreja_do_usuario(usuario: UsuarioBanco, igreja_id: int):
  if usuario.perfil != "master" and usuario.igreja_id != igreja_id:
    raise HTTPException(
      status_code=status.HTTP_403_FORBIDDEN,
      detail="Você não possui acesso aos dados desta igreja."
    )



app = FastAPI(
  title="Painel Gerencial Pastoral",
  description="Sistema de gerenciamento de igrejas",
  version="1.0.0"
)

app.add_middleware(
  CORSMiddleware,
  allow_origins=[],
  allow_origin_regex=r"^https?://(127\.0\.0\.1|localhost)(:\d+)?$",
  allow_credentials=True,
  allow_methods=["*"],
  allow_headers=["*"]
)

oauth2_scheme = OAuth2PasswordBearer(
  tokenUrl="/login"
)


def obter_usuario_atual(
    token: str = Depends(oauth2_scheme),
    banco: Session = Depends(obter_banco)
):

  erro_credencial = HTTPException(
      status_code=status.HTTP_401_UNAUTHORIZED,
      detail="Não foi possível validar as credenciais",
      headers={"WWW-Authenticate": "Bearer"}
  )

  try:
    dados_token = decodificar_token(token)
    usuario_id = dados_token.get("sub")

    if usuario_id is None:
      raise erro_credencial

    usuario_id= int(usuario_id)

  except (InvalidTokenError, ValueError):
    raise erro_credencial

  usuario = banco.get(UsuarioBanco, usuario_id)

  if usuario is None:
    raise erro_credencial

  if not usuario.ativo:
    raise HTTPException(
      status_code=status.HTTP_403_FORBIDDEN,
      detail="Usuário desativado"
    )

  return usuario
def exigir_perfis(*perfis_permitidos):
  def verificar_perfil(
      usuario: UsuarioBanco = Depends(obter_usuario_atual)
  ):
    if usuario.perfil == "master":
      return usuario

    if usuario.perfil not in perfis_permitidos:
      raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Você não possui permissão para esta operação"
      )

    return usuario
  return verificar_perfil

registrar_relatorios(app, obter_usuario_atual)
registrar_admin(app, obter_usuario_atual)

@app.get("/", include_in_schema=False)
def inicia():
  return RedirectResponse(url="/login.html")

@app.get("/health")
def verifica_saude():
  return {"status": "online"}

@app.post(
    "/igrejas",
    response_model=IgrejaResposta,
    status_code=status.HTTP_201_CREATED
)
def cadastrar_igreja(
  dados: IgrejaCriar,
  banco: Session = Depends(obter_banco),
  _: bool = Depends(exigir_token_setup)
):
  nova_igreja= IgrejaBanco(
    nome=dados.nome,
    presidente=dados.presidente,
    endereco=dados.endereco
  )

  banco.add(nova_igreja)
  banco.commit()
  banco.refresh(nova_igreja)

  return nova_igreja

@app.post(
    "/igrejas/{igreja_id}/membros",
    response_model=MembroResposta,
    status_code=status.HTTP_201_CREATED
)
def cadastrar_membro(
  igreja_id: int,
  dados: MembroCriar,
  banco: Session = Depends(obter_banco),
  usuario: UsuarioBanco = Depends(
    exigir_perfis("administrador", "pastor", "secretaria")
  )
):
  validar_igreja_do_usuario(usuario, igreja_id)

  igreja = banco.get(IgrejaBanco, igreja_id)

  if igreja is None:
    raise HTTPException(
      status_code=status.HTTP_404_NOT_FOUND,
      detail="Igreja não encontrada"
    )

  comando_cpf= (
    select(MembroBanco)
    .where(MembroBanco.cpf == dados.cpf)
  )

  membro_existente = banco.scalar(comando_cpf)

  if membro_existente is not None:
    raise HTTPException(
      status_code=status.HTTP_409_CONFLICT,
      detail="CPF já cadastrado"
    )

  novo_membro = MembroBanco(
    nome=dados.nome,
    cpf=dados.cpf,
    data_nascimento=dados.data_nascimento,
    contato=dados.contato,

    cep=dados.cep,
    logradouro=dados.logradouro,
    numero=dados.numero,
    complemento=dados.complemento,
    bairro=dados.bairro,
    cidade=dados.cidade,

    estado=(
        dados.estado.upper()
        if dados.estado
        else None
    ),

    referencia=dados.referencia,
    igreja_id=igreja_id
)

  banco.add(novo_membro)
  banco.commit()
  banco.refresh(novo_membro)

  return novo_membro

@app.get(
    "/igrejas/{igreja_id}/membros",
    response_model=list[MembroResposta]
)
def listar_membros(
  igreja_id: int,
  banco: Session = Depends(obter_banco),
  usuario: UsuarioBanco = Depends(obter_usuario_atual)
):
  validar_igreja_do_usuario(usuario, igreja_id)

  igreja = banco.get(IgrejaBanco, igreja_id)

  if igreja is None:
    raise HTTPException(
      status_code=status.HTTP_404_NOT_FOUND,
      detail= "Igreja não encontrada."
    )

  comando = (
    select(MembroBanco)
    .where(MembroBanco.igreja_id == igreja_id)
    .order_by(MembroBanco.nome)
  )

  membros = banco.scalars(comando).all()

  return membros

@app.get(
    "/igrejas/{igreja_id}/membros/{membro_id}",
    response_model=MembroResposta
)
def buscar_membro(
    igreja_id: int,
    membro_id: int,
    banco: Session = Depends(obter_banco),
    usuario: UsuarioBanco = Depends(
        exigir_perfis(
            "administrador",
            "pastor"
        )
    )
):
    if usuario.perfil != "master" and usuario.igreja_id != igreja_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Você não pode acessar membros de outra igreja."
        )

    comando = (
        select(MembroBanco)
        .where(
            MembroBanco.id == membro_id,
            MembroBanco.igreja_id == igreja_id
        )
    )

    membro = banco.scalar(comando)

    if membro is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Membro não encontrado nesta igreja."
        )

    return membro

@app.patch(
    "/igrejas/{igreja_id}/membros/{membro_id}",
    response_model=MembroResposta
)
def atualizar_membro(
    igreja_id: int,
    membro_id: int,
    dados: MembroAtualizar,
    banco: Session = Depends(obter_banco),
    usuario: UsuarioBanco = Depends(
        exigir_perfis(
            "administrador",
            "pastor"
        )
    )
):
    if usuario.perfil != "master" and usuario.igreja_id != igreja_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Você não pode editar membros de outra igreja."
        )

    comando = (
        select(MembroBanco)
        .where(
            MembroBanco.id == membro_id,
            MembroBanco.igreja_id == igreja_id
        )
    )

    membro = banco.scalar(comando)

    if membro is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Membro não encontrado nesta igreja."
        )

    dados_recebidos = dados.model_dump(
        exclude_unset=True
    )

    for campo, valor in dados_recebidos.items():
        if campo == "estado" and valor is not None:
            valor = valor.upper()

        setattr(membro, campo, valor)

    banco.commit()
    banco.refresh(membro)

    return membro

@app.post(
    "/atividades",
    response_model=AtividadeResposta,
    status_code=status.HTTP_201_CREATED
)
def cadastrar_atividade(
  dados: AtividadeCriar,
  banco: Session = Depends(obter_banco),
  usuario: UsuarioBanco = Depends(
    exigir_perfis("administrador", "pastor", "secretaria", "lider")
  )
  ):
  validar_igreja_do_usuario(usuario, dados.igreja_id)
  igreja = banco.get(IgrejaBanco,dados.igreja_id)

  if igreja is None:
    raise HTTPException(
      status_code=status.HTTP_404_NOT_FOUND,
      detail= "Igreja não encontrada."
    )

  nova_atividade = AtividadeBanco(
    titulo=dados.titulo,
    tipo=dados.tipo,
    descricao=dados.descricao,
    data_hora_inicio=dados.data_hora_inicio,
    data_hora_fim=dados.data_hora_fim,
    local=dados.local,
    observacoes=dados.observacoes,
    igreja_id=dados.igreja_id
  )

  banco.add(nova_atividade)
  banco.commit()
  banco.refresh(nova_atividade)

  return nova_atividade

@app.get(
  "/igrejas/{igreja_id}/atividades",
  response_model= list[AtividadeResposta]
)
def listar_atividades(
    igreja_id: int,
    banco: Session = Depends(obter_banco),
    usuario: UsuarioBanco = Depends(obter_usuario_atual)
):
  validar_igreja_do_usuario(usuario, igreja_id)

  igreja = banco.get(IgrejaBanco, igreja_id)

  if igreja is None:
    raise HTTPException(
      status_code=status.HTTP_404_NOT_FOUND,
      detail="Igreja não encontrada"
    )

  comando = (
    select(AtividadeBanco)
    .where(AtividadeBanco.igreja_id == igreja_id)
    .order_by(AtividadeBanco.data_hora_inicio)
  )

  atividades = banco.scalars(comando).all()

  return atividades

@app.get(
  "/igrejas/{igreja_id}/atividades/{atividade_id}",
  response_model=AtividadeResposta
)
def buscar_atividade(
  igreja_id: int,
  atividade_id: int,
  banco: Session= Depends(obter_banco),
  usuario: UsuarioBanco = Depends(obter_usuario_atual)
):
  validar_igreja_do_usuario(usuario, igreja_id)

  comando = ( 
    select(AtividadeBanco)
    .where(
      AtividadeBanco.id == atividade_id,
      AtividadeBanco.igreja_id == igreja_id
    ))

  atividade = banco.scalar(comando)

  if atividade is None:
    raise HTTPException(
      status_code=status.HTTP_404_NOT_FOUND,
      detail= "Atividade não encontrada nesta igreja."
    )

  return atividade

@app.patch(
  "/igrejas/{igreja_id}/atividades/{atividade_id}",
  response_model=AtividadeResposta
)
def atualizar_atividade(
  igreja_id:int,
  atividade_id: int,
  dados:AtividadeAtualizar,
  banco:Session= Depends(obter_banco),
  usuario: UsuarioBanco = Depends(
    exigir_perfis("administrador", "pastor", "secretaria", "lider")
  )
):
  validar_igreja_do_usuario(usuario, igreja_id)

  comando = (
    select(AtividadeBanco)
    .where(
      AtividadeBanco.id == atividade_id,
      AtividadeBanco.igreja_id == igreja_id)
  )

  atividade = banco.scalar(comando)

  if atividade is None:
    raise HTTPException(
      status_code=status.HTTP_404_NOT_FOUND,
      detail="Atividade não encontrada nesta igreja."
    )

  dados_recebidos = dados.model_dump(exclude_unset=True)

  for campo, valor in dados_recebidos.items():
    setattr(atividade,campo,valor)

  banco.commit()
  banco.refresh(atividade)

  return atividade

@app.patch(
  "/igrejas/{igreja_id}/atividades/{atividade_id}/cancelar",
  response_model=AtividadeResposta
)
def cancelar_atividade(
  igreja_id: int,
  atividade_id:int,
  banco: Session = Depends(obter_banco),
  usuario: UsuarioBanco = Depends(
    exigir_perfis("administrador", "pastor", "secretaria", "lider")
  )
):
  validar_igreja_do_usuario(usuario, igreja_id)

  comando = (
    select(AtividadeBanco)
    .where(
      AtividadeBanco.id == atividade_id,
      AtividadeBanco.igreja_id == igreja_id
    )
  )

  atividade=banco.scalar(comando)



  if atividade is None:
    raise HTTPException(
      status_code=status.HTTP_404_NOT_FOUND,
      detail="Atividade não encontrada nesta igreja"
    )

  if atividade.status == "cancelado":
    raise HTTPException(
      status_code=status.HTTP_400_BAD_REQUEST,
      detail="Essa atividade já está cancelada."
    )

  atividade.status= "cancelado"

  banco.commit()
  banco.refresh(atividade)

  return atividade

@app.post(
  "/igrejas/{igreja_id}/atividades/{atividade_id}/presencas",
  response_model=PresencaResposta,
  status_code=status.HTTP_201_CREATED
)
def registrar_presenca(
  igreja_id:int,
  atividade_id:int,
  dados: PresencaCriar,
  banco: Session = Depends(obter_banco),
  usuario: UsuarioBanco = Depends(
    exigir_perfis("administrador", "pastor", "secretaria", "lider")
  )
):
  validar_igreja_do_usuario(usuario, igreja_id)

  comando_atividade = (
    select(AtividadeBanco)
    .where(
      AtividadeBanco.id == atividade_id,
      AtividadeBanco.igreja_id == igreja_id
    )
  )

  atividade = banco.scalar(comando_atividade)

  if atividade is None:
    raise HTTPException(
      status_code=status.HTTP_404_NOT_FOUND,
      detail="Atividade não encontrada nesta igreja."
    )

  comando_membro = (
    select(MembroBanco)
    .where(
      MembroBanco.id == dados.membro_id,
      MembroBanco.igreja_id == igreja_id
    )
  )

  membro = banco.scalar(comando_membro)

  if membro is None:
    raise HTTPException(
      status_code=status.HTTP_404_NOT_FOUND,
      detail="Membro não encontrado nesta igreja"
    )

  comando_presenca= (
    select(PresencaBanco)
    .where(
      PresencaBanco.membro_id == dados.membro_id,
      PresencaBanco.atividade_id == atividade_id
    )
  )

  presenca_existente = banco.scalar(comando_presenca)

  if presenca_existente is not None:
    raise HTTPException(
      status_code=status.HTTP_409_CONFLICT,
      detail="A presença deste membro ja foi registrada"
    )

  nova_presenca = PresencaBanco(
    membro_id = dados.membro_id,
    atividade_id = atividade_id,
    status=dados.status,
    observacao=dados.observacao
  )

  banco.add(nova_presenca)
  banco.commit()
  banco.refresh(nova_presenca)

  return nova_presenca

@app.get(
  "/igrejas/{igreja_id}/atividades/{atividade_id}/presencas",
  response_model=list[PresencaDetalhada]
)
def listar_presencas(
  igreja_id: int,
  atividade_id: int,
  banco: Session = Depends(obter_banco),
  usuario: UsuarioBanco = Depends(obter_usuario_atual)
):
  validar_igreja_do_usuario(usuario, igreja_id)

  comando_atividade = (
    select(AtividadeBanco)
    .where(
      AtividadeBanco.id == atividade_id,
      AtividadeBanco.igreja_id == igreja_id
    )
  )

  atividade = banco.scalar(comando_atividade)

  if atividade is None:
    raise HTTPException(
      status_code=status.HTTP_404_NOT_FOUND,
      detail="Atividade não encontrada nesta igreja."
    )

  comando_presencas = (
    select(PresencaBanco, MembroBanco.nome)
    .join(
      MembroBanco,
      PresencaBanco.membro_id == MembroBanco.id
    )
    .where(PresencaBanco.atividade_id == atividade_id)
    .order_by(MembroBanco.nome)
  )

  resultados = banco.execute(comando_presencas).all()

  presencas = []

  for presenca, nome_membro in resultados:
    presencas.append(
      {
        "id": presenca.id,
        "membro_id": presenca.membro_id,
        "nome_membro": nome_membro,
        "atividade_id": presenca.atividade_id,
        "status": presenca.status,
        "observacao": presenca.observacao,
        "registrado_em": presenca.registrado_em
      }
    )

  return presencas

@app.patch(
  "/igrejas/{igreja_id}/atividades/{atividade_id}/presencas/{presenca_id}",
  response_model=PresencaResposta
)
def atualizar_presenca(
  igreja_id: int,
  atividade_id:int,
  presenca_id:int,
  dados: PresencaAtualizar,
  banco: Session = Depends(obter_banco),
  usuario: UsuarioBanco = Depends(
    exigir_perfis("administrador", "pastor", "secretaria", "lider")
  )
):
  validar_igreja_do_usuario(usuario, igreja_id)
  comando_atividade = (
    select(AtividadeBanco)
    .where(
      AtividadeBanco.id == atividade_id,
      AtividadeBanco.igreja_id == igreja_id
    )
  )

  atividade = banco.scalar(comando_atividade)

  if atividade is None:
    raise HTTPException(
      status_code=status.HTTP_404_NOT_FOUND,
      detail="Atividade não encontrada nesta igreja."
    )

  comando_presenca= (
    select(PresencaBanco)
    .where(
      PresencaBanco.id == presenca_id,
      PresencaBanco.atividade_id== atividade_id
    )
  )

  presenca = banco.scalar(comando_presenca)

  if presenca is None:
    raise HTTPException(
      status_code=status.HTTP_404_NOT_FOUND,
      detail="Presença não encontrada nesta atividade."
    )

  dados_recebidos=dados.model_dump(exclude_unset=True)

  for campo, valor in dados_recebidos.items():
    setattr(presenca,campo,valor)

  banco.commit()
  banco.refresh(presenca)

  return presenca

@app.get(
  "/igrejas/{igreja_id}/atividades/{atividade_id}/resumo-presencas",
  response_model=ResumoPresencas
)
def resumo_presencas(
  igreja_id: int,
  atividade_id: int,
  banco: Session = Depends(obter_banco),
  usuario: UsuarioBanco = Depends(obter_usuario_atual)
):
  validar_igreja_do_usuario(usuario, igreja_id)
  comando_atividade = (
    select(AtividadeBanco)
    .where(
      AtividadeBanco.id==atividade_id,
      AtividadeBanco.igreja_id==igreja_id
    )
  )

  atividade= banco.scalar(comando_atividade)

  if atividade is None:
    raise HTTPException(
      status_code=status.HTTP_404_NOT_FOUND,
      detail="Atividade não encontrada nesta igreja."
    )

  comando = (
    select(PresencaBanco.status)
    .where(PresencaBanco.atividade_id==atividade_id)
  )

  registros = banco.scalars(comando).all()

  return{
    "atividade_id": atividade_id,
    "total_registros": len(registros),
    "presentes": registros.count("presente"),
    "ausentes": registros.count("ausente"),
    "confirmados": registros.count("confirmado"),
    "justificados": registros.count("justificado")
  }

@app.get(
  "/igrejas/{igreja_id}/membros/{membro_id}/frequencia",
  response_model=list[HistoricoPresenca]
)
def consultar_frequencia_membro(
  igreja_id: int,
  membro_id: int,
  banco: Session= Depends(obter_banco),
  usuario: UsuarioBanco = Depends(obter_usuario_atual)
):
  validar_igreja_do_usuario(usuario, igreja_id)

  comando_membro = (
    select(MembroBanco)
    .where(
      MembroBanco.id == membro_id,
      MembroBanco.igreja_id == igreja_id
    )
  )

  membro=banco.scalar(comando_membro)

  if membro is None:
    raise HTTPException(
      status_code=status.HTTP_404_NOT_FOUND,
      detail="Membro não encontrado nesta igreja."
    )

  comando_historico = (
    select(PresencaBanco,AtividadeBanco)
    .join(
      AtividadeBanco,
      PresencaBanco.atividade_id == AtividadeBanco.id
    )
    .where(PresencaBanco.membro_id == membro_id, AtividadeBanco.igreja_id == igreja_id)
    .order_by(AtividadeBanco.data_hora_inicio.desc())
  )

  resultados = banco.execute(comando_historico).all()

  historico=[]

  for presenca, atividade in resultados:
    historico.append(
      {
        "atividade_id": atividade.id,
        "titulo_atividade": atividade.titulo,
        "tipo_atividade": atividade.tipo,
        "data_hora_inicio": atividade.data_hora_inicio,
        "status_presenca": presenca.status,
        "observacao": presenca.observacao
      }
    )

  return historico

@app.get(
  "/igrejas/{igreja_id}/membros/{membro_id}/frequencia/resumo",
  response_model=ResumoFrequenciaMembro
)
def resumir_frequencia_membro(
  igreja_id: int,
  membro_id: int,
  banco: Session = Depends(obter_banco),
  usuario: UsuarioBanco = Depends(obter_usuario_atual)
):
  validar_igreja_do_usuario(usuario, igreja_id)

  comando_membro = (
    select(MembroBanco)
    .where(
      MembroBanco.id == membro_id,
      MembroBanco.igreja_id == igreja_id
    )
  )

  membro = banco.scalar(comando_membro)

  if membro is None:
    raise HTTPException(
      status_code=status.HTTP_404_NOT_FOUND,
      detail="Membro não enconteado nesta igreja."
    )

  comando_status= (
    select(PresencaBanco.status)
    .join(
      AtividadeBanco,
      PresencaBanco.atividade_id == AtividadeBanco.id
    )
    .where(
      PresencaBanco.membro_id == membro_id,
      AtividadeBanco.igreja_id == igreja_id
    )
  )

  registros = banco.scalars(comando_status).all()

  presentes = registros.count("presente")
  ausentes = registros.count("ausente")
  justificados = registros.count("justificado")
  confirmados = registros.count("confirmado")

  atividades_finalizadas = (
    presentes
    + ausentes
    +justificados
  )

  if atividades_finalizadas == 0:
    percentual = 0.0
  else:
    percentual = round(
      presentes / atividades_finalizadas*100,2
    )

  return {
      "membro_id": membro.id,
      "nome_membro": membro.nome,
      "total_registros": len(registros),
      "presentes": presentes,
      "ausentes": ausentes,
      "justificados": justificados,
      "confirmados": confirmados,
      "percentual_comparecimento": percentual
  }

@app.post(
  "/igrejas/{igreja_id}/financeiro",
  response_model=MovimentacaoResposta,
  status_code=status.HTTP_201_CREATED
)
def cadastrar_movimentacao(
  igreja_id: int,
  dados: MovimentacaoCriar,
  banco: Session = Depends(obter_banco),
  usuario: UsuarioBanco = Depends(
    exigir_perfis("administrador", "pastor", "tesoureiro")
  )
):
  validar_igreja_do_usuario(usuario, igreja_id)

  igreja = banco.get(IgrejaBanco, igreja_id)

  if igreja is None:
    raise HTTPException(
      status_code=status.HTTP_404_NOT_FOUND,
      detail="Igreja não encontrada"
    )

  if dados.membro_id is not None:
    comando_membro = (
      select(MembroBanco)
      .where(
        MembroBanco.id== dados.membro_id,
        MembroBanco.igreja_id==igreja_id
      )
    )

    membro = banco.scalar(comando_membro)

    if membro is None:
      raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Membro não encontrado nesta igreja."
      )

  if dados.atividade_id is not None:
    comando_atividade = (
      select(AtividadeBanco)
      .where(
        AtividadeBanco.id == dados.atividade_id,
        AtividadeBanco.igreja_id == igreja_id
      )
    )

    atividade = banco.scalar(comando_atividade)

    if atividade is None:
      raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Atividade não encontrada nesta igreja."
      )

  nova_movimentacao = MovimentacaoFinanceiraBanco(
    tipo=dados.tipo,
    categoria=dados.categoria,
    descricao=dados.descricao,
    valor=dados.valor,
    forma_pagamento=dados.forma_pagamento,
    data_movimentacao=dados.data_movimentacao,
    igreja_id= igreja_id,
    membro_id=dados.membro_id,
    atividade_id=dados.atividade_id
  )

  banco.add(nova_movimentacao)
  banco.commit()
  banco.refresh(nova_movimentacao)

  return nova_movimentacao

@app.get(
  "/igrejas/{igreja_id}/financeiro",
  response_model=list[MovimentacaoResposta]
)
def listar_movimentacoes(
  igreja_id: int,
  data_inicio: date | None = None,
  data_fim: date | None = None,
  tipo: Literal["entrada","saida"] | None = None,
  categoria: Literal[
    "dizimo",
    "oferta",
    "doacao",
    "despesa",
    "outro"
  ] | None = None,
  membro_id: int | None = None,
  banco: Session = Depends(obter_banco),
  usuario: UsuarioBanco = Depends(
    exigir_perfis("administrador", "pastor", "tesoureiro")
  )
):

  validar_igreja_do_usuario(usuario, igreja_id)

  igreja = banco.get(IgrejaBanco, igreja_id)

  if igreja is None:
    raise HTTPException (
      status_code=status.HTTP_404_NOT_FOUND,
      detail="Igreja não encontrada"
    )

  if (
    data_inicio is not None and data_fim is not None and data_inicio > data_fim):

    raise HTTPException(
      status_code=status.HTTP_400_BAD_REQUEST,
      detail="A data inicial não pode ser maior que a data final"
    )

  comando = ( 
    select(MovimentacaoFinanceiraBanco)
    .where(
      MovimentacaoFinanceiraBanco.igreja_id== igreja_id
    )
  )

  if data_inicio is not None:
    inicio = datetime.combine(data_inicio, time.min)

    comando = comando.where(
      MovimentacaoFinanceiraBanco.data_movimentacao >= inicio
    )

  if data_fim is not None:
    fim = datetime.combine(data_fim, time.max)

    comando = comando.where(
      MovimentacaoFinanceiraBanco.data_movimentacao <= fim
    )

  if tipo is not None:
    comando = comando.where(
      MovimentacaoFinanceiraBanco.tipo == tipo
    )

  if categoria is not None:
    comando = comando.where(
      MovimentacaoFinanceiraBanco.categoria == categoria
    )

  if membro_id is not None:
    comando = comando.where(
      MovimentacaoFinanceiraBanco.membro_id == membro_id
    )

  comando = comando.order_by(
    MovimentacaoFinanceiraBanco.data_movimentacao.desc()
  )

  movimentacoes = banco.scalars(comando).all()

  return movimentacoes

@app.get(
  "/igrejas/{igreja_id}/financeiro/resumo",
  response_model=ResumoFinanceiro
)
def resumir_financeiro(
  igreja_id:int,
  data_inicio: date | None = None,
  data_fim: date | None = None,
  banco: Session = Depends(obter_banco),
  usuario: UsuarioBanco = Depends(
    exigir_perfis(
      "administrador",
      "pastor",
      "tesoureiro"
    )
  )
):
  if usuario.perfil != "master" and usuario.igreja_id != igreja_id:
    raise HTTPException(
      status_code=status.HTTP_403_FORBIDDEN,
      detail="Você não possui acesso aos dados desta igreja."
    )

  
  igreja = banco.get(IgrejaBanco, igreja_id)

  if igreja is None:
    raise HTTPException(
      status_code=status.HTTP_404_NOT_FOUND,
      detail="Igreja não encontrada"
    )

  if (
    data_inicio is not None
    and data_fim is not None
    and data_inicio > data_fim
  ):
    raise HTTPException(
      status_code=status.HTTP_400_BAD_REQUEST,
      detail="A data inicial não pode ser maior que a data final."
    )

  comando= select(MovimentacaoFinanceiraBanco).where(MovimentacaoFinanceiraBanco.igreja_id == igreja_id)

  if data_inicio is not None:
    inicio= datetime.combine(
      data_inicio,
      time.min
    )
    
    comando = comando.where(MovimentacaoFinanceiraBanco.data_movimentacao >= inicio)

  if data_fim is not None:
    fim = datetime.combine(
      data_fim,
      time.max
    )

    comando = comando.where(
        MovimentacaoFinanceiraBanco.data_movimentacao <= fim
    )


  movimentacoes = banco.scalars(comando).all()

  zero = Decimal("0.00")

  total_entradas = sum(
    (
      movimentacao.valor
      for movimentacao in movimentacoes
      if movimentacao.tipo == "entrada"
    ),
    zero
  )

  total_saidas= sum(
    (
      movimentacao.valor
      for movimentacao in movimentacoes
      if movimentacao.tipo == 'saida'
    ),
    zero
  )

  total_dizimos = sum(
    (
      movimentacao.valor
      for movimentacao in movimentacoes
      if movimentacao.tipo == "entrada"
      and movimentacao.categoria == "dizimo"
    ),
    zero
  )

  total_ofertas = sum(
    (
      movimentacao.valor
      for movimentacao in movimentacoes
      if movimentacao.tipo == "entrada"
      and movimentacao.categoria == "oferta"
    ),
    zero
  )

  total_doacoes = sum(
    (
      movimentacao.valor
      for movimentacao in movimentacoes
      if movimentacao.tipo == "entrada"
      and movimentacao.categoria == "doacao"
    ),
    zero
  )

  saldo = total_entradas - total_saidas

  return{
    "igreja_id": igreja_id,
    "total_movimentacoes": len(movimentacoes),
    "total_entradas": total_entradas,
    "total_saidas": total_saidas,
    "saldo": saldo,
    "total_dizimos": total_dizimos,
    "total_ofertas": total_ofertas,
    "total_doacoes": total_doacoes
  }


# -----------------------------------------------------------------------------
# FUNÇÕES DOS MEMBROS
# -----------------------------------------------------------------------------

@app.post(
  "/igrejas/{igreja_id}/funcoes",
  response_model=FuncaoResposta,
  status_code=status.HTTP_201_CREATED
)
def cadastrar_funcao(
  igreja_id: int,
  dados: FuncaoCriar,
  banco: Session = Depends(obter_banco),
  usuario: UsuarioBanco = Depends(
    exigir_perfis("administrador", "pastor")
  )
):
  if usuario.perfil != "master" and usuario.igreja_id != igreja_id:
    raise HTTPException(
      status_code=status.HTTP_403_FORBIDDEN,
      detail="Você não possui acesso a esta igreja."
    )

  igreja = banco.get(IgrejaBanco, igreja_id)

  if igreja is None:
    raise HTTPException(
      status_code=status.HTTP_404_NOT_FOUND,
      detail="Igreja não encontrada."
    )

  nome_normalizado = dados.nome.strip()
  comando = (
    select(FuncaoBanco)
    .where(
      FuncaoBanco.igreja_id == igreja_id,
      FuncaoBanco.nome.ilike(nome_normalizado)
    )
  )

  if banco.scalar(comando) is not None:
    raise HTTPException(
      status_code=status.HTTP_409_CONFLICT,
      detail="Já existe uma função com esse nome nesta igreja."
    )

  nova_funcao = FuncaoBanco(
    nome=nome_normalizado,
    descricao=dados.descricao,
    igreja_id=igreja_id
  )

  banco.add(nova_funcao)
  banco.commit()
  banco.refresh(nova_funcao)

  return nova_funcao


@app.get(
  "/igrejas/{igreja_id}/funcoes",
  response_model=list[FuncaoResposta]
)
def listar_funcoes(
  igreja_id: int,
  incluir_inativas: bool = False,
  banco: Session = Depends(obter_banco),
  usuario: UsuarioBanco = Depends(obter_usuario_atual)
):
  if usuario.perfil != "master" and usuario.igreja_id != igreja_id:
    raise HTTPException(
      status_code=status.HTTP_403_FORBIDDEN,
      detail="Você não possui acesso a esta igreja."
    )

  igreja = banco.get(IgrejaBanco, igreja_id)

  if igreja is None:
    raise HTTPException(
      status_code=status.HTTP_404_NOT_FOUND,
      detail="Igreja não encontrada."
    )

  comando = select(FuncaoBanco).where(
    FuncaoBanco.igreja_id == igreja_id
  )

  if not incluir_inativas:
    comando = comando.where(FuncaoBanco.ativo.is_(True))

  comando = comando.order_by(FuncaoBanco.nome)

  return banco.scalars(comando).all()


@app.get(
  "/igrejas/{igreja_id}/funcoes/{funcao_id}",
  response_model=FuncaoDetalhada
)
def buscar_funcao(
  igreja_id: int,
  funcao_id: int,
  banco: Session = Depends(obter_banco),
  usuario: UsuarioBanco = Depends(obter_usuario_atual)
):
  if usuario.perfil != "master" and usuario.igreja_id != igreja_id:
    raise HTTPException(
      status_code=status.HTTP_403_FORBIDDEN,
      detail="Você não possui acesso a esta igreja."
    )

  comando = (
    select(FuncaoBanco)
    .where(
      FuncaoBanco.id == funcao_id,
      FuncaoBanco.igreja_id == igreja_id
    )
  )

  funcao = banco.scalar(comando)

  if funcao is None:
    raise HTTPException(
      status_code=status.HTTP_404_NOT_FOUND,
      detail="Função não encontrada nesta igreja."
    )

  return funcao


@app.patch(
  "/igrejas/{igreja_id}/funcoes/{funcao_id}",
  response_model=FuncaoResposta
)
def atualizar_funcao(
  igreja_id: int,
  funcao_id: int,
  dados: FuncaoAtualizar,
  banco: Session = Depends(obter_banco),
  usuario: UsuarioBanco = Depends(
    exigir_perfis("administrador", "pastor")
  )
):
  if usuario.perfil != "master" and usuario.igreja_id != igreja_id:
    raise HTTPException(
      status_code=status.HTTP_403_FORBIDDEN,
      detail="Você não possui acesso a esta igreja."
    )

  comando = (
    select(FuncaoBanco)
    .where(
      FuncaoBanco.id == funcao_id,
      FuncaoBanco.igreja_id == igreja_id
    )
  )

  funcao = banco.scalar(comando)

  if funcao is None:
    raise HTTPException(
      status_code=status.HTTP_404_NOT_FOUND,
      detail="Função não encontrada nesta igreja."
    )

  dados_recebidos = dados.model_dump(exclude_unset=True)

  if "nome" in dados_recebidos:
    novo_nome = dados_recebidos["nome"].strip()
    comando_nome = (
      select(FuncaoBanco)
      .where(
        FuncaoBanco.igreja_id == igreja_id,
        FuncaoBanco.id != funcao_id,
        FuncaoBanco.nome.ilike(novo_nome)
      )
    )

    if banco.scalar(comando_nome) is not None:
      raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="Já existe uma função com esse nome nesta igreja."
      )

    dados_recebidos["nome"] = novo_nome

  for campo, valor in dados_recebidos.items():
    setattr(funcao, campo, valor)

  banco.commit()
  banco.refresh(funcao)

  return funcao


@app.patch(
  "/igrejas/{igreja_id}/funcoes/{funcao_id}/desativar",
  response_model=FuncaoResposta
)
def desativar_funcao(
  igreja_id: int,
  funcao_id: int,
  banco: Session = Depends(obter_banco),
  usuario: UsuarioBanco = Depends(
    exigir_perfis("administrador", "pastor")
  )
):
  if usuario.perfil != "master" and usuario.igreja_id != igreja_id:
    raise HTTPException(
      status_code=status.HTTP_403_FORBIDDEN,
      detail="Você não possui acesso a esta igreja."
    )

  comando = (
    select(FuncaoBanco)
    .where(
      FuncaoBanco.id == funcao_id,
      FuncaoBanco.igreja_id == igreja_id
    )
  )

  funcao = banco.scalar(comando)

  if funcao is None:
    raise HTTPException(
      status_code=status.HTTP_404_NOT_FOUND,
      detail="Função não encontrada nesta igreja."
    )

  if not funcao.ativo:
    raise HTTPException(
      status_code=status.HTTP_400_BAD_REQUEST,
      detail="Esta função já está desativada."
    )

  funcao.ativo = False
  banco.commit()
  banco.refresh(funcao)

  return funcao


@app.patch(
  "/igrejas/{igreja_id}/funcoes/{funcao_id}/reativar",
  response_model=FuncaoResposta
)
def reativar_funcao(
  igreja_id: int,
  funcao_id: int,
  banco: Session = Depends(obter_banco),
  usuario: UsuarioBanco = Depends(
    exigir_perfis("administrador", "pastor")
  )
):
  if usuario.perfil != "master" and usuario.igreja_id != igreja_id:
    raise HTTPException(
      status_code=status.HTTP_403_FORBIDDEN,
      detail="Você não possui acesso a esta igreja."
    )

  comando = (
    select(FuncaoBanco)
    .where(
      FuncaoBanco.id == funcao_id,
      FuncaoBanco.igreja_id == igreja_id
    )
  )

  funcao = banco.scalar(comando)

  if funcao is None:
    raise HTTPException(
      status_code=status.HTTP_404_NOT_FOUND,
      detail="Função não encontrada nesta igreja."
    )

  if funcao.ativo:
    raise HTTPException(
      status_code=status.HTTP_400_BAD_REQUEST,
      detail="Esta função já está ativa."
    )

  funcao.ativo = True
  banco.commit()
  banco.refresh(funcao)

  return funcao


@app.post(
  "/igrejas/{igreja_id}/funcoes/{funcao_id}/membros",
  response_model=FuncaoDetalhada
)
def atribuir_funcao_ao_membro(
  igreja_id: int,
  funcao_id: int,
  dados: VincularMembroFuncao,
  banco: Session = Depends(obter_banco),
  usuario: UsuarioBanco = Depends(
    exigir_perfis("administrador", "pastor")
  )
):
  if usuario.perfil != "master" and usuario.igreja_id != igreja_id:
    raise HTTPException(
      status_code=status.HTTP_403_FORBIDDEN,
      detail="Você não possui acesso a esta igreja."
    )

  comando_funcao = (
    select(FuncaoBanco)
    .where(
      FuncaoBanco.id == funcao_id,
      FuncaoBanco.igreja_id == igreja_id
    )
  )
  funcao = banco.scalar(comando_funcao)

  if funcao is None:
    raise HTTPException(
      status_code=status.HTTP_404_NOT_FOUND,
      detail="Função não encontrada nesta igreja."
    )

  if not funcao.ativo:
    raise HTTPException(
      status_code=status.HTTP_400_BAD_REQUEST,
      detail="Não é possível atribuir uma função desativada."
    )

  comando_membro = (
    select(MembroBanco)
    .where(
      MembroBanco.id == dados.membro_id,
      MembroBanco.igreja_id == igreja_id
    )
  )
  membro = banco.scalar(comando_membro)

  if membro is None:
    raise HTTPException(
      status_code=status.HTTP_404_NOT_FOUND,
      detail="Membro não encontrado nesta igreja."
    )

  if funcao in membro.funcoes:
    raise HTTPException(
      status_code=status.HTTP_409_CONFLICT,
      detail="Este membro já possui esta função."
    )

  membro.funcoes.append(funcao)
  banco.commit()
  banco.refresh(funcao)

  return funcao


@app.delete(
  "/igrejas/{igreja_id}/funcoes/{funcao_id}/membros/{membro_id}",
  status_code=status.HTTP_204_NO_CONTENT
)
def remover_funcao_do_membro(
  igreja_id: int,
  funcao_id: int,
  membro_id: int,
  banco: Session = Depends(obter_banco),
  usuario: UsuarioBanco = Depends(
    exigir_perfis("administrador", "pastor")
  )
):
  if usuario.perfil != "master" and usuario.igreja_id != igreja_id:
    raise HTTPException(
      status_code=status.HTTP_403_FORBIDDEN,
      detail="Você não possui acesso a esta igreja."
    )

  comando_funcao = (
    select(FuncaoBanco)
    .where(
      FuncaoBanco.id == funcao_id,
      FuncaoBanco.igreja_id == igreja_id
    )
  )
  funcao = banco.scalar(comando_funcao)

  if funcao is None:
    raise HTTPException(
      status_code=status.HTTP_404_NOT_FOUND,
      detail="Função não encontrada nesta igreja."
    )

  comando_membro = (
    select(MembroBanco)
    .where(
      MembroBanco.id == membro_id,
      MembroBanco.igreja_id == igreja_id
    )
  )
  membro = banco.scalar(comando_membro)

  if membro is None:
    raise HTTPException(
      status_code=status.HTTP_404_NOT_FOUND,
      detail="Membro não encontrado nesta igreja."
    )

  if funcao not in membro.funcoes:
    raise HTTPException(
      status_code=status.HTTP_404_NOT_FOUND,
      detail="Este membro não possui esta função."
    )

  membro.funcoes.remove(funcao)
  banco.commit()

  return None


# -----------------------------------------------------------------------------
# GRUPOS DA IGREJA
# -----------------------------------------------------------------------------

@app.post(
  "/igrejas/{igreja_id}/grupos",
  response_model=GrupoResposta,
  status_code=status.HTTP_201_CREATED
)
def cadastrar_grupo(
  igreja_id: int,
  dados: GrupoCriar,
  banco: Session = Depends(obter_banco),
  usuario: UsuarioBanco = Depends(
    exigir_perfis("administrador", "pastor")
  )
):
  if usuario.perfil != "master" and usuario.igreja_id != igreja_id:
    raise HTTPException(
      status_code=status.HTTP_403_FORBIDDEN,
      detail="Você não possui acesso a esta igreja."
    )

  igreja = banco.get(IgrejaBanco, igreja_id)

  if igreja is None:
    raise HTTPException(
      status_code=status.HTTP_404_NOT_FOUND,
      detail="Igreja não encontrada."
    )

  nome_normalizado = dados.nome.strip()
  comando_nome = (
    select(GrupoBanco)
    .where(
      GrupoBanco.igreja_id == igreja_id,
      GrupoBanco.nome.ilike(nome_normalizado)
    )
  )

  if banco.scalar(comando_nome) is not None:
    raise HTTPException(
      status_code=status.HTTP_409_CONFLICT,
      detail="Já existe um grupo com esse nome nesta igreja."
    )

  lider = None

  if dados.lider_id is not None:
    comando_lider = (
      select(MembroBanco)
      .where(
        MembroBanco.id == dados.lider_id,
        MembroBanco.igreja_id == igreja_id
      )
    )
    lider = banco.scalar(comando_lider)

    if lider is None:
      raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Líder não encontrado nesta igreja."
      )

  novo_grupo = GrupoBanco(
    nome=nome_normalizado,
    descricao=dados.descricao,
    lider_id=dados.lider_id,
    igreja_id=igreja_id
  )

  if lider is not None:
    novo_grupo.membros.append(lider)

  banco.add(novo_grupo)
  banco.commit()
  banco.refresh(novo_grupo)

  return novo_grupo


@app.get(
  "/igrejas/{igreja_id}/grupos",
  response_model=list[GrupoResposta]
)
def listar_grupos(
  igreja_id: int,
  incluir_inativos: bool = False,
  banco: Session = Depends(obter_banco),
  usuario: UsuarioBanco = Depends(obter_usuario_atual)
):
  if usuario.perfil != "master" and usuario.igreja_id != igreja_id:
    raise HTTPException(
      status_code=status.HTTP_403_FORBIDDEN,
      detail="Você não possui acesso a esta igreja."
    )

  igreja = banco.get(IgrejaBanco, igreja_id)

  if igreja is None:
    raise HTTPException(
      status_code=status.HTTP_404_NOT_FOUND,
      detail="Igreja não encontrada."
    )

  comando = select(GrupoBanco).where(
    GrupoBanco.igreja_id == igreja_id
  )

  if not incluir_inativos:
    comando = comando.where(GrupoBanco.ativo.is_(True))

  comando = comando.order_by(GrupoBanco.nome)

  return banco.scalars(comando).all()


@app.get(
  "/igrejas/{igreja_id}/grupos/{grupo_id}",
  response_model=GrupoDetalhado
)
def buscar_grupo(
  igreja_id: int,
  grupo_id: int,
  banco: Session = Depends(obter_banco),
  usuario: UsuarioBanco = Depends(obter_usuario_atual)
):
  if usuario.perfil != "master" and usuario.igreja_id != igreja_id:
    raise HTTPException(
      status_code=status.HTTP_403_FORBIDDEN,
      detail="Você não possui acesso a esta igreja."
    )

  comando = (
    select(GrupoBanco)
    .where(
      GrupoBanco.id == grupo_id,
      GrupoBanco.igreja_id == igreja_id
    )
  )
  grupo = banco.scalar(comando)

  if grupo is None:
    raise HTTPException(
      status_code=status.HTTP_404_NOT_FOUND,
      detail="Grupo não encontrado nesta igreja."
    )

  return grupo


@app.patch(
  "/igrejas/{igreja_id}/grupos/{grupo_id}",
  response_model=GrupoResposta
)
def atualizar_grupo(
  igreja_id: int,
  grupo_id: int,
  dados: GrupoAtualizar,
  banco: Session = Depends(obter_banco),
  usuario: UsuarioBanco = Depends(
    exigir_perfis("administrador", "pastor")
  )
):
  if usuario.perfil != "master" and usuario.igreja_id != igreja_id:
    raise HTTPException(
      status_code=status.HTTP_403_FORBIDDEN,
      detail="Você não possui acesso a esta igreja."
    )

  comando = (
    select(GrupoBanco)
    .where(
      GrupoBanco.id == grupo_id,
      GrupoBanco.igreja_id == igreja_id
    )
  )
  grupo = banco.scalar(comando)

  if grupo is None:
    raise HTTPException(
      status_code=status.HTTP_404_NOT_FOUND,
      detail="Grupo não encontrado nesta igreja."
    )

  dados_recebidos = dados.model_dump(exclude_unset=True)

  if "nome" in dados_recebidos:
    novo_nome = dados_recebidos["nome"].strip()
    comando_nome = (
      select(GrupoBanco)
      .where(
        GrupoBanco.igreja_id == igreja_id,
        GrupoBanco.id != grupo_id,
        GrupoBanco.nome.ilike(novo_nome)
      )
    )

    if banco.scalar(comando_nome) is not None:
      raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="Já existe um grupo com esse nome nesta igreja."
      )

    dados_recebidos["nome"] = novo_nome

  for campo, valor in dados_recebidos.items():
    setattr(grupo, campo, valor)

  banco.commit()
  banco.refresh(grupo)

  return grupo


@app.patch(
  "/igrejas/{igreja_id}/grupos/{grupo_id}/lider",
  response_model=GrupoDetalhado
)
def definir_lider_grupo(
  igreja_id: int,
  grupo_id: int,
  dados: DefinirLiderGrupo,
  banco: Session = Depends(obter_banco),
  usuario: UsuarioBanco = Depends(
    exigir_perfis("administrador", "pastor")
  )
):
  if usuario.perfil != "master" and usuario.igreja_id != igreja_id:
    raise HTTPException(
      status_code=status.HTTP_403_FORBIDDEN,
      detail="Você não possui acesso a esta igreja."
    )

  comando_grupo = (
    select(GrupoBanco)
    .where(
      GrupoBanco.id == grupo_id,
      GrupoBanco.igreja_id == igreja_id
    )
  )
  grupo = banco.scalar(comando_grupo)

  if grupo is None:
    raise HTTPException(
      status_code=status.HTTP_404_NOT_FOUND,
      detail="Grupo não encontrado nesta igreja."
    )

  if dados.lider_id is None:
    grupo.lider_id = None
  else:
    comando_lider = (
      select(MembroBanco)
      .where(
        MembroBanco.id == dados.lider_id,
        MembroBanco.igreja_id == igreja_id
      )
    )
    lider = banco.scalar(comando_lider)

    if lider is None:
      raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Líder não encontrado nesta igreja."
      )

    grupo.lider_id = lider.id

    if lider not in grupo.membros:
      grupo.membros.append(lider)

  banco.commit()
  banco.refresh(grupo)

  return grupo


@app.post(
  "/igrejas/{igreja_id}/grupos/{grupo_id}/membros",
  response_model=GrupoDetalhado
)
def adicionar_membro_ao_grupo(
  igreja_id: int,
  grupo_id: int,
  dados: VincularMembroGrupo,
  banco: Session = Depends(obter_banco),
  usuario: UsuarioBanco = Depends(
    exigir_perfis("administrador", "pastor")
  )
):
  if usuario.perfil != "master" and usuario.igreja_id != igreja_id:
    raise HTTPException(
      status_code=status.HTTP_403_FORBIDDEN,
      detail="Você não possui acesso a esta igreja."
    )

  comando_grupo = (
    select(GrupoBanco)
    .where(
      GrupoBanco.id == grupo_id,
      GrupoBanco.igreja_id == igreja_id
    )
  )
  grupo = banco.scalar(comando_grupo)

  if grupo is None:
    raise HTTPException(
      status_code=status.HTTP_404_NOT_FOUND,
      detail="Grupo não encontrado nesta igreja."
    )

  if not grupo.ativo:
    raise HTTPException(
      status_code=status.HTTP_400_BAD_REQUEST,
      detail="Não é possível adicionar membros a um grupo desativado."
    )

  comando_membro = (
    select(MembroBanco)
    .where(
      MembroBanco.id == dados.membro_id,
      MembroBanco.igreja_id == igreja_id
    )
  )
  membro = banco.scalar(comando_membro)

  if membro is None:
    raise HTTPException(
      status_code=status.HTTP_404_NOT_FOUND,
      detail="Membro não encontrado nesta igreja."
    )

  if membro in grupo.membros:
    raise HTTPException(
      status_code=status.HTTP_409_CONFLICT,
      detail="Este membro já participa do grupo."
    )

  grupo.membros.append(membro)
  banco.commit()
  banco.refresh(grupo)

  return grupo


@app.delete(
  "/igrejas/{igreja_id}/grupos/{grupo_id}/membros/{membro_id}",
  status_code=status.HTTP_204_NO_CONTENT
)
def remover_membro_do_grupo(
  igreja_id: int,
  grupo_id: int,
  membro_id: int,
  banco: Session = Depends(obter_banco),
  usuario: UsuarioBanco = Depends(
    exigir_perfis("administrador", "pastor")
  )
):
  if usuario.perfil != "master" and usuario.igreja_id != igreja_id:
    raise HTTPException(
      status_code=status.HTTP_403_FORBIDDEN,
      detail="Você não possui acesso a esta igreja."
    )

  comando_grupo = (
    select(GrupoBanco)
    .where(
      GrupoBanco.id == grupo_id,
      GrupoBanco.igreja_id == igreja_id
    )
  )
  grupo = banco.scalar(comando_grupo)

  if grupo is None:
    raise HTTPException(
      status_code=status.HTTP_404_NOT_FOUND,
      detail="Grupo não encontrado nesta igreja."
    )

  comando_membro = (
    select(MembroBanco)
    .where(
      MembroBanco.id == membro_id,
      MembroBanco.igreja_id == igreja_id
    )
  )
  membro = banco.scalar(comando_membro)

  if membro is None or membro not in grupo.membros:
    raise HTTPException(
      status_code=status.HTTP_404_NOT_FOUND,
      detail="Membro não encontrado neste grupo."
    )

  if grupo.lider_id == membro_id:
    raise HTTPException(
      status_code=status.HTTP_400_BAD_REQUEST,
      detail="Troque ou remova o líder antes de retirá-lo do grupo."
    )

  grupo.membros.remove(membro)
  banco.commit()

  return None


@app.patch(
  "/igrejas/{igreja_id}/grupos/{grupo_id}/desativar",
  response_model=GrupoResposta
)
def desativar_grupo(
  igreja_id: int,
  grupo_id: int,
  banco: Session = Depends(obter_banco),
  usuario: UsuarioBanco = Depends(
    exigir_perfis("administrador", "pastor")
  )
):
  if usuario.perfil != "master" and usuario.igreja_id != igreja_id:
    raise HTTPException(
      status_code=status.HTTP_403_FORBIDDEN,
      detail="Você não possui acesso a esta igreja."
    )

  comando = select(GrupoBanco).where(
    GrupoBanco.id == grupo_id,
    GrupoBanco.igreja_id == igreja_id
  )
  grupo = banco.scalar(comando)

  if grupo is None:
    raise HTTPException(
      status_code=status.HTTP_404_NOT_FOUND,
      detail="Grupo não encontrado nesta igreja."
    )

  if not grupo.ativo:
    raise HTTPException(
      status_code=status.HTTP_400_BAD_REQUEST,
      detail="Este grupo já está desativado."
    )

  grupo.ativo = False
  banco.commit()
  banco.refresh(grupo)

  return grupo


@app.patch(
  "/igrejas/{igreja_id}/grupos/{grupo_id}/reativar",
  response_model=GrupoResposta
)
def reativar_grupo(
  igreja_id: int,
  grupo_id: int,
  banco: Session = Depends(obter_banco),
  usuario: UsuarioBanco = Depends(
    exigir_perfis("administrador", "pastor")
  )
):
  if usuario.perfil != "master" and usuario.igreja_id != igreja_id:
    raise HTTPException(
      status_code=status.HTTP_403_FORBIDDEN,
      detail="Você não possui acesso a esta igreja."
    )

  comando = select(GrupoBanco).where(
    GrupoBanco.id == grupo_id,
    GrupoBanco.igreja_id == igreja_id
  )
  grupo = banco.scalar(comando)

  if grupo is None:
    raise HTTPException(
      status_code=status.HTTP_404_NOT_FOUND,
      detail="Grupo não encontrado nesta igreja."
    )

  if grupo.ativo:
    raise HTTPException(
      status_code=status.HTTP_400_BAD_REQUEST,
      detail="Este grupo já está ativo."
    )

  grupo.ativo = True
  banco.commit()
  banco.refresh(grupo)

  return grupo

@app.post(
  "/igrejas/{igreja_id}/usuarios/primeiro-administrador",
  response_model=UsuarioResposta,
  status_code=status.HTTP_201_CREATED
)
def cadastrar_primeiro_administrador(
  igreja_id:int,
  dados: PrimeiroAdministradorCriar,
  banco: Session = Depends(obter_banco),
  _: bool = Depends(exigir_token_setup)
):

  igreja = banco.get(IgrejaBanco, igreja_id)

  if igreja is None:
    raise HTTPException(
      status_code=status.HTTP_404_NOT_FOUND,
      detail="Igreja não encontrada"
    )

  comando_usuario_igreja = (
    select(UsuarioBanco)
    .where(UsuarioBanco.igreja_id == igreja_id)
  )

  usuario_existente = banco.scalar(
    comando_usuario_igreja
  )

  if usuario_existente is not None:
    raise HTTPException(
      status_code=status.HTTP_409_CONFLICT,
      detail="Esta igreja já possui um usuário administrador."
    )

  username_normalizado = dados.username.strip().lower()
  email_normalizado = (
    str(dados.email).strip().lower() if dados.email else None
  )

  comando_credencial = select(UsuarioBanco).where(
    or_(
      UsuarioBanco.username == username_normalizado,
      UsuarioBanco.email == email_normalizado if email_normalizado else False
    )
  )

  credencial_existente = banco.scalar(comando_credencial)

  if credencial_existente is not None:
    raise HTTPException(
      status_code=status.HTTP_409_CONFLICT,
      detail="Usuário ou e-mail já cadastrado."
    )

  if dados.membro_id is not None:
    comando_membro = (
      select(MembroBanco)
      .where(
        MembroBanco.id == dados.membro_id,
        MembroBanco.igreja_id == igreja_id
      )
    )

    membro = banco.scalar(comando_membro)

    if membro is None:
      raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Membro não encontrado nesta igreja."
      )

  novo_usuario = UsuarioBanco(
    nome = dados.nome,
    username = username_normalizado,
    email = email_normalizado,
    senha_hash = criar_hash_senha(dados.senha),
    perfil = "administrador",
    igreja_id=igreja_id,
    membro_id = dados.membro_id
  )

  banco.add(novo_usuario)
  banco.commit()
  banco.refresh(novo_usuario)

  return novo_usuario

@app.post(
  "/login",
  response_model=TokenResposta
)
def realizar_login(
  formulario: OAuth2PasswordRequestForm = Depends(),
  banco: Session = Depends(obter_banco)
):
  credencial = formulario.username.strip().lower()

  comando = select(UsuarioBanco).where(
    or_(
      UsuarioBanco.username == credencial,
      UsuarioBanco.email == credencial
    )
  )

  usuario = banco.scalar(comando)

  if usuario is None:
    raise HTTPException(
      status_code=status.HTTP_401_UNAUTHORIZED,
      detail="Usuário/e-mail ou senha inválidos.",
      headers={"WwW-Authenticate": "Bearer"}
    )

  if not verificar_senha(
    formulario.password,
    usuario.senha_hash
  ):
    raise HTTPException(
      status_code=status.HTTP_401_UNAUTHORIZED,
      detail="Usuário/e-mail ou senha inválidos.",
      headers={"WWW-Authenticate": "Bearer"}
    )

  if not usuario.ativo:
    raise HTTPException(
      status_code=status.HTTP_403_FORBIDDEN,
      detail="Usuário desativado"
    )

  token = criar_token_acesso(
    usuario_id=usuario.id,
    igreja_id=usuario.igreja_id,
    perfil=usuario.perfil
  )

  return {
    "access_token": token,
    "token_type": "bearer"
  }

@app.get(
  "/usuarios/eu",
  response_model=UsuarioResposta
)
def consultar_usuario_atual(
  usuario: UsuarioBanco = Depends(obter_usuario_atual)
):

  return usuario

# O frontend é servido pelo mesmo processo da API.
# Isso evita URLs fixas de localhost e simplifica o deploy.
FRONTEND_DIR = Path(__file__).resolve().parent / "frontend"
app.mount(
  "/",
  StaticFiles(directory=str(FRONTEND_DIR), html=True),
  name="frontend"
)
