import os
from datetime import datetime, timedelta, timezone

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError
from dotenv import load_dotenv

load_dotenv()

_hash_senhas = PasswordHasher()

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./igreja.db").strip()
ACCESS_TOKEN_EXPIRE_MINUTES = int(
    os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "120")
)

if not SECRET_KEY:
    if DATABASE_URL.startswith("sqlite"):
        # Apenas desenvolvimento local. No PostgreSQL o segredo é obrigatório.
        SECRET_KEY = "papper-dev-only-change-before-production-2026"
    else:
        raise RuntimeError(
            "A variável SECRET_KEY precisa ser configurada no ambiente de hospedagem."
        )


def criar_hash_senha(senha: str) -> str:
    return _hash_senhas.hash(senha)


def verificar_senha(senha_digitada: str, senha_hash: str) -> bool:
    try:
        return _hash_senhas.verify(senha_hash, senha_digitada)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def criar_token_acesso(
    usuario_id: int,
    igreja_id: int | None,
    perfil: str,
) -> str:
    expiracao = datetime.now(timezone.utc) + timedelta(
        minutes=ACCESS_TOKEN_EXPIRE_MINUTES
    )

    dados_token = {
        "sub": str(usuario_id),
        "igreja_id": igreja_id,
        "perfil": perfil,
        "exp": expiracao,
    }

    return jwt.encode(
        dados_token,
        SECRET_KEY,
        algorithm=ALGORITHM,
    )


def decodificar_token(token: str) -> dict:
    return jwt.decode(
        token,
        SECRET_KEY,
        algorithms=[ALGORITHM],
    )
