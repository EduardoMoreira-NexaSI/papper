"""Utilidades de data/hora do domínio do Papper.

O banco histórico usa DateTime sem timezone. Para manter compatibilidade,
horários operacionais são convertidos para o fuso configurado e persistidos
como valores locais sem tzinfo. JWT continua usando UTC em seguranca.py.
"""

import os
from datetime import datetime
from zoneinfo import ZoneInfo

APP_TIMEZONE = os.getenv("APP_TIMEZONE", "America/Sao_Paulo")
FUSO_APP = ZoneInfo(APP_TIMEZONE)


def agora_local() -> datetime:
    return datetime.now(FUSO_APP)


def agora_local_naive() -> datetime:
    return agora_local().replace(tzinfo=None)
