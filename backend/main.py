"""Compatibilidade com o comando usado até agora (`uvicorn main:app --reload`,
rodando de dentro da pasta backend/). O app "de verdade" está em app.py —
ver esse arquivo e backend/README.md para a arquitetura completa."""
from app import app  # noqa: F401
