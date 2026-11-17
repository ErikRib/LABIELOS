"""Ponto de entrada da API. Pode ser importado de duas formas:

- `uvicorn main:app` rodando de dentro de backend/ (jeito "clássico" deste
  projeto) — backend/main.py só reexporta este módulo;
- `uvicorn backend.app:app` rodando da raiz do repositório (é o que
  run.py usa). Para isso funcionar, o primeiro bloco abaixo garante que
  backend/ esteja no sys.path, porque os módulos deste pacote (database,
  routes, models...) são importados de forma absoluta ("from database
  import ..."), e não relativa.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from routes import auth, contato, impressoras, materiais, organizations, parceiros, solicitacoes

app = FastAPI(
    title="LABIELOS API",
    description="Backend do Hub de Manufatura Aditiva para a Saúde (Instituto Mauá de Tecnologia & AACD)",
    version="2.0.0",
)


@app.exception_handler(RequestValidationError)
async def validacao_legivel(request: Request, exc: RequestValidationError):
    """Achata o 422 padrão do FastAPI (lista de erros) numa única string
    legível, porque é isso que o front mostra para o usuário (doc §1.1)."""
    erro = exc.errors()[0]
    campo = ".".join(str(p) for p in erro["loc"] if p not in ("body", "query", "path"))
    mensagem = f"Campo '{campo}': {erro['msg']}" if campo else erro["msg"]
    return JSONResponse(status_code=422, content={"detail": mensagem})


app.include_router(auth.router)
app.include_router(organizations.router)
app.include_router(solicitacoes.router)
app.include_router(materiais.router)
app.include_router(impressoras.router)
app.include_router(parceiros.router)
app.include_router(contato.router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}


# Estáticos (HTML/CSS/JS do front) servidos pela própria API, na mesma
# origem — ver doc §7. Precisa vir DEPOIS das rotas /api, senão o
# StaticFiles "engoliria" as rotas da API.
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
app.mount("/", StaticFiles(directory=PROJECT_ROOT, html=True), name="site")
