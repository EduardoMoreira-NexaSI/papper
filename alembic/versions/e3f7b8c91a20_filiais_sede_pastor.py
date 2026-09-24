"""filiais: sede e pastor responsavel por unidade

Revision ID: e3f7b8c91a20
Revises: d91f0a6b4c32
Create Date: 2026-09-24 15:05:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "e3f7b8c91a20"
down_revision: Union[str, Sequence[str], None] = "d91f0a6b4c32"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("igrejas") as batch_op:
        batch_op.add_column(sa.Column("igreja_sede_id", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("pastor_responsavel_id", sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            "fk_igrejas_igreja_sede",
            "igrejas",
            ["igreja_sede_id"],
            ["id"],
        )
        batch_op.create_foreign_key(
            "fk_igrejas_pastor_responsavel",
            "usuarios",
            ["pastor_responsavel_id"],
            ["id"],
        )
        batch_op.create_index("ix_igrejas_igreja_sede_id", ["igreja_sede_id"], unique=False)
        batch_op.create_index("ix_igrejas_pastor_responsavel_id", ["pastor_responsavel_id"], unique=True)


def downgrade() -> None:
    with op.batch_alter_table("igrejas") as batch_op:
        batch_op.drop_index("ix_igrejas_pastor_responsavel_id")
        batch_op.drop_index("ix_igrejas_igreja_sede_id")
        batch_op.drop_constraint("fk_igrejas_pastor_responsavel", type_="foreignkey")
        batch_op.drop_constraint("fk_igrejas_igreja_sede", type_="foreignkey")
        batch_op.drop_column("pastor_responsavel_id")
        batch_op.drop_column("igreja_sede_id")
