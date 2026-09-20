"""Aplica a baseline/migrações do banco e cria as contas iniciais."""

from alembic import command
from alembic.config import Config

from seed import semear_dados_iniciais


def main() -> None:
    config = Config("alembic.ini")

    print("Aplicando migrações do banco...")
    command.upgrade(config, "head")

    print("Verificando dados iniciais...")
    resultado = semear_dados_iniciais()

    print(
        "Banco pronto. "
        f"Igreja de teste: {resultado['igreja_id']} | "
        f"Usuários: {resultado['usuarios']}"
    )


if __name__ == "__main__":
    main()
