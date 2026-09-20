import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

load_dotenv()

URL_BANCO = os.getenv("DATABASE_URL", "sqlite:///./igreja.db").strip()

# Compatibilidade com URLs antigas de alguns provedores.
if URL_BANCO.startswith("postgres://"):
    URL_BANCO = URL_BANCO.replace("postgres://", "postgresql://", 1)

# O projeto usa psycopg 3 no deploy.
if URL_BANCO.startswith("postgresql://"):
    URL_BANCO = URL_BANCO.replace("postgresql://", "postgresql+psycopg://", 1)

opcoes_engine = {
    "pool_pre_ping": True,
}

if URL_BANCO.startswith("sqlite"):
    opcoes_engine["connect_args"] = {"check_same_thread": False}

engine = create_engine(
    URL_BANCO,
    **opcoes_engine,
)

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
)


class Base(DeclarativeBase):
    pass


def obter_banco():
    banco = SessionLocal()

    try:
        yield banco
    finally:
        banco.close()
