"""Cria os dados mínimos de operação/teste do Papper de forma idempotente."""

import os

from sqlalchemy import select
from sqlalchemy.orm import Session

from database import SessionLocal
from models import IgrejaBanco, UsuarioBanco
from seguranca import criar_hash_senha


def _bool_env(nome: str, padrao: bool = False) -> bool:
    valor = os.getenv(nome)
    if valor is None:
        return padrao
    return valor.strip().lower() in {"1", "true", "sim", "yes", "on"}


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


def garantir_igreja_teste(banco: Session) -> IgrejaBanco:
    nome = os.getenv("TEST_CHURCH_NAME", "Igreja de Teste Papper").strip()

    igreja = banco.scalar(
        select(IgrejaBanco).where(IgrejaBanco.nome == nome)
    )
    if igreja is not None:
        return igreja

    igreja = IgrejaBanco(
        nome=nome,
        presidente="Administrador de Teste",
        endereco="Ambiente de demonstração",
    )
    banco.add(igreja)
    banco.flush()
    return igreja


def garantir_usuario(
    banco: Session,
    *,
    nome: str,
    username: str,
    email: str | None,
    senha: str,
    perfil: str,
    igreja_id: int | None,
) -> UsuarioBanco:
    username = username.strip().lower()
    email = email.strip().lower() if email else None

    usuario = banco.scalar(
        select(UsuarioBanco).where(UsuarioBanco.username == username)
    )

    if usuario is None:
        usuario = UsuarioBanco(
            nome=nome,
            username=username,
            email=email,
            senha_hash=criar_hash_senha(senha),
            perfil=perfil,
            igreja_id=igreja_id,
            ativo=True,
        )
        banco.add(usuario)
        banco.flush()
        return usuario

    # Mantém a estrutura dos usuários de seed coerente sem sobrescrever
    # a senha em todo reinício do servidor.
    usuario.nome = nome
    usuario.email = email
    usuario.perfil = perfil
    usuario.igreja_id = igreja_id
    return usuario


def semear_dados_iniciais() -> dict[str, int]:
    banco = SessionLocal()
    try:
        igreja = garantir_igreja_teste(banco)

        garantir_usuario(
            banco,
            nome="Administrador Master",
            username=os.getenv("MASTER_USERNAME", "useradm"),
            email=os.getenv("MASTER_EMAIL", "admin@papperteste.com"),
            senha=_senha_obrigatoria("MASTER_PASSWORD"),
            perfil="master",
            igreja_id=igreja.id,
        )

        criar_testes = _bool_env("SEED_TEST_USERS", True)
        if criar_testes:
            senha_teste = _senha_obrigatoria("TEST_USER_PASSWORD")
            for numero in range(1, 11):
                username = f"user{numero:02d}"
                garantir_usuario(
                    banco,
                    nome=f"Usuário de Teste {numero:02d}",
                    username=username,
                    email=f"{username}@papperteste.com",
                    senha=senha_teste,
                    perfil="administrador",
                    igreja_id=igreja.id,
                )

        banco.commit()

        total_usuarios = len(
            banco.scalars(select(UsuarioBanco)).all()
        )
        return {"igreja_id": igreja.id, "usuarios": total_usuarios}
    except Exception:
        banco.rollback()
        raise
    finally:
        banco.close()


if __name__ == "__main__":
    resultado = semear_dados_iniciais()
    print(
        "Seed concluído: "
        f"igreja_id={resultado['igreja_id']}, "
        f"usuarios={resultado['usuarios']}"
    )
