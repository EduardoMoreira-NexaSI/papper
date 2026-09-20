from datetime import datetime, date

from pydantic import BaseModel,EmailStr, Field

from typing import Literal
from decimal import Decimal


class IgrejaCriar(BaseModel):
    nome: str = Field(min_length=3, max_length=150)
    presidente: str = Field(min_length=3, max_length=150)
    endereco: str = Field(min_length=3, max_length=250)

class IgrejaResposta(IgrejaCriar):
    id: int

    model_config = {
        "from_attributes": True
    }

class MembroCriar(BaseModel):
    nome: str = Field(
        min_length=3,
        max_length=150
    )

    cpf: str = Field(
        min_length=11,
        max_length=11,
        pattern=r"^\d{11}$"
    )

    data_nascimento: date | None = None

    contato: str = Field(
        min_length=9,
        max_length=20
    )

    cep: str | None = Field(
        default=None,
        min_length=8,
        max_length=8,
        pattern=r"^\d{8}$"
    )

    logradouro: str | None = Field(
        default=None,
        max_length=180
    )

    numero: str | None = Field(
        default=None,
        max_length=20
    )

    complemento: str | None = Field(
        default=None,
        max_length=100
    )

    bairro: str | None = Field(
        default=None,
        max_length=100
    )

    cidade: str | None = Field(
        default=None,
        max_length=100
    )

    estado: str | None = Field(
        default=None,
        min_length=2,
        max_length=2
    )

    referencia: str | None = Field(
        default=None,
        max_length=200
    )

class MembroAtualizar(BaseModel):
    nome: str | None = Field(
        default=None,
        min_length=3,
        max_length=150
    )

    data_nascimento: date | None = None

    contato: str | None = Field(
        default=None,
        min_length=9,
        max_length=20
    )

    cargo: str | None = Field(
        default=None,
        max_length=100
    )

    status: bool | None = None

    cep: str | None = Field(
        default=None,
        min_length=8,
        max_length=8,
        pattern=r"^\d{8}$"
    )

    logradouro: str | None = Field(
        default=None,
        max_length=180
    )

    numero: str | None = Field(
        default=None,
        max_length=20
    )

    complemento: str | None = Field(
        default=None,
        max_length=100
    )

    bairro: str | None = Field(
        default=None,
        max_length=100
    )

    cidade: str | None = Field(
        default=None,
        max_length=100
    )

    estado: str | None = Field(
        default=None,
        min_length=2,
        max_length=2
    )

    referencia: str | None = Field(
        default=None,
        max_length=200
    )

class MembroResposta(BaseModel):
    id: int
    nome: str
    cpf: str
    data_nascimento: date | None
    contato: str
    status: bool
    cargo: str | None
    igreja_id: int

    cep: str | None
    logradouro: str | None
    numero: str | None
    complemento: str | None
    bairro: str | None
    cidade: str | None
    estado: str | None
    referencia: str | None

    model_config = {
        "from_attributes": True
    }

class AtividadeCriar(BaseModel):
    titulo: str
    tipo: str
    descricao: str | None = None
    data_hora_inicio: datetime
    data_hora_fim: datetime | None = None
    local: str | None = None
    observacoes: str | None = None
    igreja_id: int

class AtividadeResposta(AtividadeCriar):
    id: int
    status: str

    model_config = {
        "from_attributes": True
    }

class AtividadeAtualizar(BaseModel):
    titulo: str | None = None
    tipo: str | None = None
    descricao: str | None = None
    data_hora_inicio: datetime | None = None
    data_hora_fim: datetime | None = None
    local: str | None = None
    observacoes: str | None = None

class PresencaCriar(BaseModel):
    membro_id: int

    status: Literal[
        "confirmado",
        "presente",
        "ausente",
        "justificado"
    ] = "presente"

    observacao: str | None = None

class PresencaResposta(PresencaCriar):
    id: int
    atividade_id: int
    registrado_em: datetime

    model_config = {
        "from_attributes": True
    }

class PresencaDetalhada(PresencaResposta):
    nome_membro: str

class PresencaAtualizar(BaseModel):
    status: Literal[
        "confirmado",
        "presente",
        "ausente",
        "justificado"
    ] | None = None

    observacao: str | None = None

class ResumoPresencas(BaseModel):
    atividade_id: int
    total_registros: int
    presentes: int
    ausentes: int
    confirmados: int
    justificados: int

class HistoricoPresenca(BaseModel):
    atividade_id: int
    titulo_atividade: str
    tipo_atividade: str
    data_hora_inicio: datetime
    status_presenca: str 
    observacao: str | None = None

class ResumoFrequenciaMembro(BaseModel):
    membro_id: int
    nome_membro: str
    total_registros: int
    presentes: int
    ausentes: int
    justificados: int
    confirmados: int
    percentual_comparecimento: float

class MovimentacaoCriar(BaseModel):
    tipo: Literal["entrada", "saida"]

    categoria: Literal[
        "dizimo",
        "oferta",
        "doacao",
        "despesa",
        "outro"
    ]

    descricao: str | None = None

    valor: Decimal = Field(
        gt=0,
        max_digits=12,
        decimal_places=2
    )

    forma_pagamento: str | None=None
    data_movimentacao: datetime

    membro_id: int | None= None
    atividade_id: int | None = None

class MovimentacaoResposta(MovimentacaoCriar):
    id: int
    igreja_id: int
    model_config = {"from_attributes": True}

class ResumoFinanceiro(BaseModel): 
    igreja_id: int
    total_movimentacoes: int
    total_entradas: Decimal
    total_saidas: Decimal
    saldo: Decimal
    total_dizimos: Decimal
    total_ofertas: Decimal
    total_doacoes: Decimal

class UsuarioCriar(BaseModel):
    nome: str = Field(min_length=3, max_length=150)
    username: str = Field(min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9._-]+$")
    email: EmailStr | None = None
    senha: str = Field(min_length=8, max_length=128)
    perfil: Literal[
        "administrador",
        "pastor",
        "secretaria",
        "tesoureiro",
        "lider",
        "membro"
    ]
    igreja_id: int
    membro_id: int | None = None


class UsuarioResposta(BaseModel):
    id: int
    nome: str
    username: str
    email: EmailStr | None = None
    perfil: str
    ativo: bool
    criado_em: datetime
    igreja_id: int | None
    membro_id: int | None = None

    model_config = {"from_attributes": True}


class PrimeiroAdministradorCriar(BaseModel):
    nome: str = Field(min_length=3, max_length=150)
    username: str = Field(min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9._-]+$")
    email: EmailStr | None = None
    senha: str = Field(min_length=8, max_length=128)
    membro_id: int | None = None


class TokenResposta(BaseModel):
    access_token: str
    token_type: str


class AdminStatusUsuarioAtualizar(BaseModel):
    ativo: bool


class AdminSenhaUsuarioAtualizar(BaseModel):
    nova_senha: str = Field(min_length=8, max_length=128)


class AdminIgrejaCriar(BaseModel):
    nome: str = Field(min_length=3, max_length=150)
    presidente: str = Field(min_length=3, max_length=150)
    endereco: str = Field(min_length=3, max_length=250)


class AdminResumo(BaseModel):
    total_igrejas: int
    total_usuarios: int
    usuarios_ativos: int
    total_membros: int
    total_atividades: int
    total_movimentacoes: int
    banco: str


# -----------------------------------------------------------------------------
# FUNÇÕES
# -----------------------------------------------------------------------------

class MembroSimplificado(BaseModel):
    id: int
    nome: str
    status: bool

    model_config = {"from_attributes": True}


class FuncaoCriar(BaseModel):
    nome: str = Field(min_length=2, max_length=100)
    descricao: str | None = Field(default=None, max_length=250)


class FuncaoAtualizar(BaseModel):
    nome: str | None = Field(default=None, min_length=2, max_length=100)
    descricao: str | None = Field(default=None, max_length=250)


class FuncaoResposta(BaseModel):
    id: int
    nome: str
    descricao: str | None
    ativo: bool
    igreja_id: int

    model_config = {"from_attributes": True}


class FuncaoDetalhada(FuncaoResposta):
    membros: list[MembroSimplificado] = Field(default_factory=list)


class VincularMembroFuncao(BaseModel):
    membro_id: int


# -----------------------------------------------------------------------------
# GRUPOS
# -----------------------------------------------------------------------------

class GrupoCriar(BaseModel):
    nome: str = Field(min_length=2, max_length=100)
    descricao: str | None = Field(default=None, max_length=250)
    lider_id: int | None = None


class GrupoAtualizar(BaseModel):
    nome: str | None = Field(default=None, min_length=2, max_length=100)
    descricao: str | None = Field(default=None, max_length=250)


class GrupoResposta(BaseModel):
    id: int
    nome: str
    descricao: str | None
    ativo: bool
    igreja_id: int
    lider_id: int | None

    model_config = {"from_attributes": True}


class GrupoDetalhado(GrupoResposta):
    lider: MembroSimplificado | None = None
    membros: list[MembroSimplificado] = Field(default_factory=list)


class VincularMembroGrupo(BaseModel):
    membro_id: int


class DefinirLiderGrupo(BaseModel):
    lider_id: int | None = None


# -----------------------------------------------------------------------------
# TAREFAS
# -----------------------------------------------------------------------------

class TarefaCriar(BaseModel):
    titulo: str = Field(min_length=3, max_length=150)
    descricao: str | None = None
    prioridade: Literal["baixa", "normal", "alta", "urgente"] = "normal"
    data_hora_inicio: datetime
    data_hora_fim: datetime | None = None
    local: str | None = Field(default=None, max_length=150)
    gerar_atividade: bool = False
    funcao_id: int | None = None
    grupo_id: int | None = None
    membro_id: int | None = None


class TarefaAtualizar(BaseModel):
    titulo: str | None = Field(default=None, min_length=3, max_length=150)
    descricao: str | None = None
    prioridade: Literal["baixa", "normal", "alta", "urgente"] | None = None
    status: Literal["pendente", "em_andamento", "concluida", "cancelada"] | None = None
    data_hora_inicio: datetime | None = None
    data_hora_fim: datetime | None = None
    local: str | None = Field(default=None, max_length=150)
    funcao_id: int | None = None
    grupo_id: int | None = None
    membro_id: int | None = None


class TarefaResposta(BaseModel):
    id: int
    titulo: str
    descricao: str | None
    prioridade: str
    status: str
    data_hora_inicio: datetime
    data_hora_fim: datetime | None
    local: str | None
    gerar_atividade: bool
    criado_em: datetime
    concluido_em: datetime | None
    igreja_id: int
    funcao_id: int | None
    grupo_id: int | None
    membro_id: int | None
    atividade_id: int | None

    model_config = {"from_attributes": True}
