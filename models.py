from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    LargeBinary,
    Numeric,
    String,
    Table,
    Text,
    UniqueConstraint,
    func,
    true,
    false
)

from sqlalchemy.orm import (
    Mapped,
    mapped_column,
    relationship
)

from database import Base


# =========================================================
# TABELAS INTERMEDIÁRIAS
# =========================================================

membro_funcoes = Table(
    "membro_funcoes",
    Base.metadata,

    Column(
        "membro_id",
        ForeignKey("membros.id"),
        primary_key=True
    ),

    Column(
        "funcao_id",
        ForeignKey("funcoes.id"),
        primary_key=True
    )
)


membro_grupos = Table(
    "membro_grupos",
    Base.metadata,

    Column(
        "membro_id",
        ForeignKey("membros.id"),
        primary_key=True
    ),

    Column(
        "grupo_id",
        ForeignKey("grupos.id"),
        primary_key=True
    )
)


# =========================================================
# IGREJAS
# =========================================================

class IgrejaBanco(Base):
    __tablename__ = "igrejas"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True
    )

    nome: Mapped[str] = mapped_column(
        String(150),
        nullable=False
    )

    presidente: Mapped[str] = mapped_column(
        String(150),
        nullable=False
    )

    endereco: Mapped[str] = mapped_column(
        String(250),
        nullable=False
    )

    logo_dados: Mapped[bytes | None] = mapped_column(
        LargeBinary,
        nullable=True
    )

    logo_mime: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True
    )

    igreja_sede_id: Mapped[int | None] = mapped_column(
        ForeignKey("igrejas.id"),
        nullable=True,
        index=True
    )

    pastor_responsavel_id: Mapped[int | None] = mapped_column(
        ForeignKey("usuarios.id"),
        nullable=True,
        unique=True,
        index=True
    )

    membros: Mapped[list["MembroBanco"]] = relationship(
        back_populates="igreja"
    )

    funcoes: Mapped[list["FuncaoBanco"]] = relationship(
        back_populates="igreja"
    )

    grupos: Mapped[list["GrupoBanco"]] = relationship(
        back_populates="igreja"
    )

    tarefas: Mapped[list["TarefaBanco"]] = relationship(
        back_populates="igreja"
    )


# =========================================================
# MEMBROS
# =========================================================

class MembroBanco(Base):
    __tablename__ = "membros"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True
    )

    nome: Mapped[str] = mapped_column(
        String(150),
        nullable=False
    )

    cpf: Mapped[str] = mapped_column(
        String(11),
        nullable=False,
        unique=True
    )

    data_nascimento: Mapped[date | None] = mapped_column(
        Date,
        nullable=True
    )

    contato: Mapped[str] = mapped_column(
        String(20),
        nullable=False
    )

    cep: Mapped[str | None] = mapped_column(
        String(8),
        nullable=True
    )

    logradouro: Mapped[str | None] = mapped_column(
        String(180),
        nullable=True
    )

    numero: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True
    )

    complemento: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True
    )

    bairro: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True
    )

    cidade: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True
    )

    estado: Mapped[str | None] = mapped_column(
        String(2),
        nullable=True
    )

    referencia: Mapped[str | None] = mapped_column(
        String(200),
        nullable=True
    )

    cargo: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True
    )

    status: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False
    )

    criado_em: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
        default=func.now()
    )

    igreja_id: Mapped[int] = mapped_column(
        ForeignKey("igrejas.id"),
        nullable=False
    )

    igreja: Mapped["IgrejaBanco"] = relationship(
        back_populates="membros"
    )

    funcoes: Mapped[list["FuncaoBanco"]] = relationship(
        secondary=membro_funcoes,
        back_populates="membros"
    )

    grupos: Mapped[list["GrupoBanco"]] = relationship(
        secondary=membro_grupos,
        back_populates="membros"
    )

    tarefas_responsaveis: Mapped[
        list["TarefaBanco"]
    ] = relationship(
        back_populates="membro_responsavel",
        foreign_keys="TarefaBanco.membro_id"
    )


# =========================================================
# FUNÇÕES
# =========================================================

class FuncaoBanco(Base):
    __tablename__ = "funcoes"

    __table_args__ = (
        UniqueConstraint(
            "igreja_id",
            "nome",
            name="uq_funcao_igreja_nome"
        ),
    )

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True
    )

    nome: Mapped[str] = mapped_column(
        String(100),
        nullable=False
    )

    descricao: Mapped[str | None] = mapped_column(
        String(250),
        nullable=True
    )

    ativo: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        server_default=true(),
        nullable=False
    )

    igreja_id: Mapped[int] = mapped_column(
        ForeignKey("igrejas.id"),
        nullable=False
    )

    igreja: Mapped["IgrejaBanco"] = relationship(
        back_populates="funcoes"
    )

    membros: Mapped[list["MembroBanco"]] = relationship(
        secondary=membro_funcoes,
        back_populates="funcoes"
    )

    tarefas: Mapped[list["TarefaBanco"]] = relationship(
        back_populates="funcao_responsavel"
    )


# =========================================================
# GRUPOS
# =========================================================

class GrupoBanco(Base):
    __tablename__ = "grupos"

    __table_args__ = (
        UniqueConstraint(
            "igreja_id",
            "nome",
            name="uq_grupo_igreja_nome"
        ),
    )

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True
    )

    nome: Mapped[str] = mapped_column(
        String(100),
        nullable=False
    )

    descricao: Mapped[str | None] = mapped_column(
        String(250),
        nullable=True
    )

    ativo: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        server_default=true(),
        nullable=False
    )

    igreja_id: Mapped[int] = mapped_column(
        ForeignKey("igrejas.id"),
        nullable=False
    )

    lider_id: Mapped[int | None] = mapped_column(
        ForeignKey("membros.id"),
        nullable=True
    )

    igreja: Mapped["IgrejaBanco"] = relationship(
        back_populates="grupos"
    )

    lider: Mapped["MembroBanco | None"] = relationship(
        foreign_keys=[lider_id]
    )

    membros: Mapped[list["MembroBanco"]] = relationship(
        secondary=membro_grupos,
        back_populates="grupos"
    )

    tarefas: Mapped[list["TarefaBanco"]] = relationship(
        back_populates="grupo_responsavel"
    )


# =========================================================
# ATIVIDADES
# =========================================================

class AtividadeBanco(Base):
    __tablename__ = "atividades"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True
    )

    titulo: Mapped[str] = mapped_column(
        String(150),
        nullable=False
    )

    tipo: Mapped[str] = mapped_column(
        String(50),
        nullable=False
    )

    descricao: Mapped[str | None] = mapped_column(
        Text,
        nullable=True
    )

    data_hora_inicio: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False
    )

    data_hora_fim: Mapped[
        datetime | None
    ] = mapped_column(
        DateTime,
        nullable=True
    )

    local: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True
    )

    status: Mapped[str] = mapped_column(
        String(30),
        default="agendado",
        nullable=False
    )

    observacoes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True
    )

    serie_recorrencia_id: Mapped[str | None] = mapped_column(
        String(36),
        nullable=True,
        index=True
    )

    igreja_id: Mapped[int] = mapped_column(
        ForeignKey("igrejas.id"),
        nullable=False
    )


# =========================================================
# TAREFAS
# =========================================================

class TarefaBanco(Base):
    __tablename__ = "tarefas"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True
    )

    titulo: Mapped[str] = mapped_column(
        String(150),
        nullable=False
    )

    descricao: Mapped[str | None] = mapped_column(
        Text,
        nullable=True
    )

    prioridade: Mapped[str] = mapped_column(
        String(20),
        default="normal",
        server_default="normal",
        nullable=False
    )

    status: Mapped[str] = mapped_column(
        String(30),
        default="pendente",
        server_default="pendente",
        nullable=False
    )

    data_hora_inicio: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False
    )

    data_hora_fim: Mapped[
        datetime | None
    ] = mapped_column(
        DateTime,
        nullable=True
    )

    local: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True
    )

    gerar_atividade: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        server_default=false(),
        nullable=False
    )

    criado_em: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.now(),
        nullable=False
    )

    concluido_em: Mapped[
        datetime | None
    ] = mapped_column(
        DateTime,
        nullable=True
    )

    igreja_id: Mapped[int] = mapped_column(
        ForeignKey("igrejas.id"),
        nullable=False
    )

    funcao_id: Mapped[int | None] = mapped_column(
        ForeignKey("funcoes.id"),
        nullable=True
    )

    grupo_id: Mapped[int | None] = mapped_column(
        ForeignKey("grupos.id"),
        nullable=True
    )

    membro_id: Mapped[int | None] = mapped_column(
        ForeignKey("membros.id"),
        nullable=True
    )

    atividade_id: Mapped[int | None] = mapped_column(
        ForeignKey("atividades.id"),
        nullable=True,
        unique=True
    )

    igreja: Mapped["IgrejaBanco"] = relationship(
        back_populates="tarefas"
    )

    funcao_responsavel: Mapped[
        "FuncaoBanco | None"
    ] = relationship(
        back_populates="tarefas"
    )

    grupo_responsavel: Mapped[
        "GrupoBanco | None"
    ] = relationship(
        back_populates="tarefas"
    )

    membro_responsavel: Mapped[
        "MembroBanco | None"
    ] = relationship(
        back_populates="tarefas_responsaveis",
        foreign_keys=[membro_id]
    )

    atividade: Mapped[
        "AtividadeBanco | None"
    ] = relationship()


# =========================================================
# PRESENÇAS
# =========================================================

class PresencaBanco(Base):
    __tablename__ = "presencas"

    __table_args__ = (
        UniqueConstraint(
            "membro_id",
            "atividade_id",
            name="uq_presenca_membro_atividade"
        ),
    )

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True
    )

    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="presente"
    )

    observacao: Mapped[str | None] = mapped_column(
        Text,
        nullable=True
    )

    registrado_em: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.now()
    )

    membro_id: Mapped[int] = mapped_column(
        ForeignKey("membros.id"),
        nullable=False
    )

    atividade_id: Mapped[int] = mapped_column(
        ForeignKey("atividades.id"),
        nullable=False
    )


# =========================================================
# MOVIMENTAÇÕES FINANCEIRAS
# =========================================================

class MovimentacaoFinanceiraBanco(Base):
    __tablename__ = "movimentacoes_financeiras"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True
    )

    tipo: Mapped[str] = mapped_column(
        String(20),
        nullable=False
    )

    categoria: Mapped[str] = mapped_column(
        String(50),
        nullable=False
    )

    descricao: Mapped[str | None] = mapped_column(
        String(250),
        nullable=True
    )

    valor: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False
    )

    forma_pagamento: Mapped[str | None] = mapped_column(
        String(30),
        nullable=True
    )

    data_movimentacao: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.now()
    )

    igreja_id: Mapped[int] = mapped_column(
        ForeignKey("igrejas.id"),
        nullable=False
    )

    membro_id: Mapped[int | None] = mapped_column(
        ForeignKey("membros.id"),
        nullable=True
    )

    atividade_id: Mapped[int | None] = mapped_column(
        ForeignKey("atividades.id"),
        nullable=True
    )


# =========================================================
# DEPÓSITOS EM ENVELOPE / TRANSFERÊNCIAS INTERNAS
# =========================================================

class DepositoEnvelopeBanco(Base):
    __tablename__ = "depositos_envelope"

    __table_args__ = (
        UniqueConstraint(
            "igreja_id",
            "numero",
            name="uq_envelope_igreja_numero"
        ),
    )

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True
    )

    numero: Mapped[int] = mapped_column(
        Integer,
        nullable=False
    )

    valor: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False
    )

    data_deposito: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False
    )

    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="aguardando_visto",
        server_default="aguardando_visto"
    )

    observacao: Mapped[str | None] = mapped_column(
        Text,
        nullable=True
    )

    visto_observacao: Mapped[str | None] = mapped_column(
        Text,
        nullable=True
    )

    comprovante_nome: Mapped[str] = mapped_column(
        String(255),
        nullable=False
    )

    comprovante_mime: Mapped[str] = mapped_column(
        String(100),
        nullable=False
    )

    comprovante_dados: Mapped[bytes] = mapped_column(
        LargeBinary,
        nullable=False
    )

    criado_em: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.now()
    )

    aprovado_em: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True
    )

    igreja_id: Mapped[int] = mapped_column(
        ForeignKey("igrejas.id"),
        nullable=False
    )

    criado_por_id: Mapped[int] = mapped_column(
        ForeignKey("usuarios.id"),
        nullable=False
    )

    aprovado_por_id: Mapped[int | None] = mapped_column(
        ForeignKey("usuarios.id"),
        nullable=True
    )


# =========================================================
# LEMBRETES DO USUÁRIO
# =========================================================

class LembreteBanco(Base):
    __tablename__ = "lembretes"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True
    )

    titulo: Mapped[str] = mapped_column(
        String(150),
        nullable=False
    )

    descricao: Mapped[str | None] = mapped_column(
        Text,
        nullable=True
    )

    lembrar_em: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False
    )

    ativo: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default=true()
    )

    criado_em: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.now()
    )

    desativado_em: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True
    )

    igreja_id: Mapped[int] = mapped_column(
        ForeignKey("igrejas.id"),
        nullable=False
    )

    usuario_id: Mapped[int] = mapped_column(
        ForeignKey("usuarios.id"),
        nullable=False
    )


# =========================================================
# USUÁRIOS
# =========================================================

class UsuarioBanco(Base):
    __tablename__ = "usuarios"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True
    )

    nome: Mapped[str] = mapped_column(
        String(150),
        nullable=False
    )

    username: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        unique=True,
        index=True
    )

    email: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        unique=True,
        index=True
    )

    senha_hash: Mapped[str] = mapped_column(
        String(255),
        nullable=False
    )

    perfil: Mapped[str] = mapped_column(
        String(30),
        nullable=False
    )

    ativo: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default=true()
    )

    criado_em: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.now()
    )

    igreja_id: Mapped[int | None] = mapped_column(
        ForeignKey("igrejas.id"),
        nullable=True
    )

    membro_id: Mapped[int | None] = mapped_column(
        ForeignKey("membros.id"),
        nullable=True,
        unique=True
    )
