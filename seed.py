"""Inicialização segura do Papper.

A partir da manutenção v3.1 o seed é create-only:
- nunca altera perfis, igrejas ou senhas de usuários existentes;
- não cria contas genéricas user01..user10;
- não cria igreja de demonstração.
Os dados cadastrados manualmente no ambiente de teste são preservados.
"""

import os

from sqlalchemy import func, select

from database import SessionLocal
from models import UsuarioBanco
from seguranca import criar_hash_senha


def _senha_obrigatoria(nome_variavel: str) -> str:
    senha = os.getenv(nome_variavel, "").strip()
    if not senha:
        raise RuntimeError(
            f"{nome_variavel} precisa ser configurada nas variáveis de ambiente."
        )
    if len(senha) < 8:
        raise RuntimeError(
            f"{nome_variavel} deve possuir pelo menos 8 caracteres."
        )
    return senha


def garantir_master_create_only(banco) -> tuple[UsuarioBanco, bool]:
    username = os.getenv("MASTER_USERNAME", "useradm").strip().lower()
    existente = banco.scalar(
        select(UsuarioBanco).where(UsuarioBanco.username == username)
    )

    if existente is not None:
        return existente, False

    email = os.getenv("MASTER_EMAIL", "admin@papperteste.com").strip().lower()
    master = UsuarioBanco(
        nome="Administrador Master",
        username=username,
        email=email or None,
        senha_hash=criar_hash_senha(_senha_obrigatoria("MASTER_PASSWORD")),
        perfil="master",
        igreja_id=None,
        ativo=True,
    )
    banco.add(master)
    banco.flush()
    return master, True


def semear_dados_iniciais() -> dict[str, int | bool | None]:
    banco = SessionLocal()
    try:
        master, criado = garantir_master_create_only(banco)
        banco.commit()

        total_usuarios = banco.scalar(
            select(func.count()).select_from(UsuarioBanco)
        ) or 0

        return {
            "master_id": master.id,
            "master_criado": criado,
            "usuarios": total_usuarios,
        }
    except Exception:
        banco.rollback()
        raise
    finally:
        banco.close()


if __name__ == "__main__":
    resultado = semear_dados_iniciais()
    print(
        "Seed seguro concluído: "
        f"master_id={resultado['master_id']} | "
        f"master_criado={resultado['master_criado']} | "
        f"usuarios={resultado['usuarios']}"
    )
