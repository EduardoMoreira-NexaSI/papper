"""dashboard v3: lembretes por usuario

Revision ID: d91f0a6b4c32
Revises: c84e7a5f2b11
Create Date: 2026-09-24 14:25:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "d91f0a6b4c32"
down_revision: Union[str, Sequence[str], None] = "c84e7a5f2b11"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "lembretes",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("titulo", sa.String(length=150), nullable=False),
        sa.Column("descricao", sa.Text(), nullable=True),
        sa.Column("lembrar_em", sa.DateTime(), nullable=False),
        sa.Column("ativo", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("criado_em", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("desativado_em", sa.DateTime(), nullable=True),
        sa.Column("igreja_id", sa.Integer(), nullable=False),
        sa.Column("usuario_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["igreja_id"], ["igrejas.id"]),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_lembretes_usuario_ativo_data",
        "lembretes",
        ["usuario_id", "ativo", "lembrar_em"],
    )
    op.create_index(
        "ix_lembretes_igreja_usuario",
        "lembretes",
        ["igreja_id", "usuario_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_lembretes_igreja_usuario", table_name="lembretes")
    op.drop_index("ix_lembretes_usuario_ativo_data", table_name="lembretes")
    op.drop_table("lembretes")
