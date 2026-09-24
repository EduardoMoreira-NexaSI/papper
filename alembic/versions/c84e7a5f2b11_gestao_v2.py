"""gestao v2: recorrencia, logo, membros e envelopes

Revision ID: c84e7a5f2b11
Revises: a13c9cd7e7fb
Create Date: 2026-09-24 13:20:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "c84e7a5f2b11"
down_revision: Union[str, Sequence[str], None] = "a13c9cd7e7fb"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("igrejas") as batch_op:
        batch_op.add_column(sa.Column("logo_dados", sa.LargeBinary(), nullable=True))
        batch_op.add_column(sa.Column("logo_mime", sa.String(length=100), nullable=True))

    with op.batch_alter_table("membros") as batch_op:
        batch_op.add_column(
            sa.Column(
                "criado_em",
                sa.DateTime(),
                nullable=True,
            )
        )

    with op.batch_alter_table("atividades") as batch_op:
        batch_op.add_column(sa.Column("serie_recorrencia_id", sa.String(length=36), nullable=True))
        batch_op.create_index("ix_atividades_serie_recorrencia_id", ["serie_recorrencia_id"], unique=False)

    op.create_table(
        "depositos_envelope",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("numero", sa.Integer(), nullable=False),
        sa.Column("valor", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("data_deposito", sa.DateTime(), nullable=False),
        sa.Column("status", sa.String(length=30), server_default="aguardando_visto", nullable=False),
        sa.Column("observacao", sa.Text(), nullable=True),
        sa.Column("visto_observacao", sa.Text(), nullable=True),
        sa.Column("comprovante_nome", sa.String(length=255), nullable=False),
        sa.Column("comprovante_mime", sa.String(length=100), nullable=False),
        sa.Column("comprovante_dados", sa.LargeBinary(), nullable=False),
        sa.Column("criado_em", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("aprovado_em", sa.DateTime(), nullable=True),
        sa.Column("igreja_id", sa.Integer(), nullable=False),
        sa.Column("criado_por_id", sa.Integer(), nullable=False),
        sa.Column("aprovado_por_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["igreja_id"], ["igrejas.id"]),
        sa.ForeignKeyConstraint(["criado_por_id"], ["usuarios.id"]),
        sa.ForeignKeyConstraint(["aprovado_por_id"], ["usuarios.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("igreja_id", "numero", name="uq_envelope_igreja_numero"),
    )
    op.create_index("ix_depositos_envelope_igreja_status", "depositos_envelope", ["igreja_id", "status"])


def downgrade() -> None:
    op.drop_index("ix_depositos_envelope_igreja_status", table_name="depositos_envelope")
    op.drop_table("depositos_envelope")

    with op.batch_alter_table("atividades") as batch_op:
        batch_op.drop_index("ix_atividades_serie_recorrencia_id")
        batch_op.drop_column("serie_recorrencia_id")

    with op.batch_alter_table("membros") as batch_op:
        batch_op.drop_column("criado_em")

    with op.batch_alter_table("igrejas") as batch_op:
        batch_op.drop_column("logo_mime")
        batch_op.drop_column("logo_dados")
