#!/usr/bin/env bash
set -e

python inicializar_banco.py
exec uvicorn api:app --host 0.0.0.0 --port "${PORT:-8000}"
