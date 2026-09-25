"""manutencao v3.1: integridade, anexos, token e historico de vinculo

Revision ID: f41a0d2b3c77
Revises: e3f7b8c91a20
Create Date: 2026-09-25 10:20:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "f41a0d2b3c77"
down_revision: Union[str, Sequence[str], None] = "e3f7b8c91a20"
branch_labels = None
depends_on = None

USUARIOS_TESTE = tuple(f"user{i:02d}" for i in range(1, 11))


def upgrade() -> None:
    with op.batch_alter_table("movimentacoes_financeiras") as batch_op:
        batch_op.add_column(sa.Column("anexo_nome", sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column("anexo_mime", sa.String(length=100), nullable=True))
        batch_op.add_column(sa.Column("anexo_dados", sa.LargeBinary(), nullable=True))

    with op.batch_alter_table("usuarios") as batch_op:
        batch_op.add_column(
            sa.Column("token_version", sa.Integer(), server_default="0", nullable=False)
        )

    op.create_table(
        "historico_vinculo_membros",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("membro_id", sa.Integer(), nullable=False),
        sa.Column("igreja_origem_id", sa.Integer(), nullable=True),
        sa.Column("igreja_destino_id", sa.Integer(), nullable=False),
        sa.Column("usuario_executor_id", sa.Integer(), nullable=True),
        sa.Column("motivo", sa.String(length=80), server_default="transferencia", nullable=False),
        sa.Column("observacao", sa.String(length=500), nullable=True),
        sa.Column("transferido_em", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["membro_id"], ["membros.id"]),
        sa.ForeignKeyConstraint(["igreja_origem_id"], ["igrejas.id"]),
        sa.ForeignKeyConstraint(["igreja_destino_id"], ["igrejas.id"]),
        sa.ForeignKeyConstraint(["usuario_executor_id"], ["usuarios.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_historico_vinculo_membros_membro_id",
        "historico_vinculo_membros",
        ["membro_id"],
    )
    op.create_index(
        "ix_historico_vinculo_membros_origem",
        "historico_vinculo_membros",
        ["igreja_origem_id"],
    )
    op.create_index(
        "ix_historico_vinculo_membros_destino",
        "historico_vinculo_membros",
        ["igreja_destino_id"],
    )

    # Remove somente as contas genéricas antigas. Lembretes pessoais dessas
    # contas podem ser descartados. Se houver auditoria financeira/pastoral
    # vinculada a uma conta, ela é preservada e apenas desativada.
    bind = op.get_bind()
    placeholders = ", ".join(f":u{i}" for i in range(len(USUARIOS_TESTE)))
    params = {f"u{i}": username for i, username in enumerate(USUARIOS_TESTE)}

    bind.execute(
        sa.text(
            f"DELETE FROM lembretes WHERE usuario_id IN "
            f"(SELECT id FROM usuarios WHERE username IN ({placeholders}))"
        ),
        params,
    )

    protegidos_sql = f"""
        SELECT DISTINCT id FROM usuarios
        WHERE username IN ({placeholders})
          AND (
            id IN (SELECT criado_por_id FROM depositos_envelope)
            OR id IN (SELECT aprovado_por_id FROM depositos_envelope WHERE aprovado_por_id IS NOT NULL)
            OR id IN (SELECT pastor_responsavel_id FROM igrejas WHERE pastor_responsavel_id IS NOT NULL)
          )
    """
    protegidos = {
        row[0] for row in bind.execute(sa.text(protegidos_sql), params).fetchall()
    }

    ids = [
        row[0]
        for row in bind.execute(
            sa.text(f"SELECT id FROM usuarios WHERE username IN ({placeholders})"),
            params,
        ).fetchall()
    ]

    for usuario_id in ids:
        if usuario_id in protegidos:
            bind.execute(
                sa.text("UPDATE usuarios SET ativo = :ativo WHERE id = :id"),
                {"ativo": False, "id": usuario_id},
            )
        else:
            bind.execute(
                sa.text("DELETE FROM usuarios WHERE id = :id"),
                {"id": usuario_id},
            )


def downgrade() -> None:
    # Contas genéricas removidas não são recriadas no downgrade.
    op.drop_index(
        "ix_historico_vinculo_membros_destino",
        table_name="historico_vinculo_membros",
    )
    op.drop_index(
        "ix_historico_vinculo_membros_origem",
        table_name="historico_vinculo_membros",
    )
    op.drop_index(
        "ix_historico_vinculo_membros_membro_id",
        table_name="historico_vinculo_membros",
    )
    op.drop_table("historico_vinculo_membros")

    with op.batch_alter_table("usuarios") as batch_op:
        batch_op.drop_column("token_version")

    with op.batch_alter_table("movimentacoes_financeiras") as batch_op:
        batch_op.drop_column("anexo_dados")
        batch_op.drop_column("anexo_mime")
        batch_op.drop_column("anexo_nome")
