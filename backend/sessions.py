"""Sessão por cookie HttpOnly (ver §4 de docs/integracao-backend.md).

Cada sessão é um token opaco guardado na coleção `sessoes`, associado ao
usuário. O cookie nunca carrega dados, só o token — por isso não é preciso
assinar/decodificar nada (mais simples que JWT para este projeto)."""
import secrets
from datetime import timedelta

from bson import ObjectId
from fastapi import HTTPException, Request, Response

from database import sessoes_collection, usuarios_collection
from utilitarios import agora_utc_naive

NOME_COOKIE = "labielos_session"
DIAS_EXPIRACAO = 30


def _oid(valor):
    return valor if isinstance(valor, ObjectId) else ObjectId(valor)


async def criar_sessao(response: Response, user_id, lembrar: bool = True) -> str:
    token = secrets.token_urlsafe(32)
    agora = agora_utc_naive()
    await sessoes_collection.insert_one({
        "_id": token,
        "user_id": _oid(user_id),
        "criado_em": agora,
        "expira_em": agora + timedelta(days=DIAS_EXPIRACAO),
    })
    # "Lembrar de mim" desmarcado: cookie de sessão (sem max_age), some
    # quando o navegador fecha. Marcado (ou em fluxos sem a opção, como
    # cadastro): cookie persistente pelos mesmos 30 dias da sessão no banco.
    response.set_cookie(
        NOME_COOKIE, token, httponly=True, samesite="lax", path="/",
        max_age=DIAS_EXPIRACAO * 24 * 3600 if lembrar else None,
    )
    return token


async def destruir_sessao(request: Request, response: Response) -> None:
    token = request.cookies.get(NOME_COOKIE)
    if token:
        await sessoes_collection.delete_one({"_id": token})
    response.delete_cookie(NOME_COOKIE, path="/")


async def revogar_sessoes_usuario(user_id) -> None:
    await sessoes_collection.delete_many({"user_id": _oid(user_id)})


async def usuario_atual(request: Request) -> dict:
    """Dependência do FastAPI: resolve o usuário logado a partir do cookie
    de sessão, ou devolve 401 (é isso que o front usa para saber que
    precisa mandar o usuário para /html/login.html)."""
    token = request.cookies.get(NOME_COOKIE)
    if not token:
        raise HTTPException(status_code=401, detail="Sessão não encontrada. Faça login novamente.")
    sessao = await sessoes_collection.find_one({"_id": token})
    if not sessao:
        raise HTTPException(status_code=401, detail="Sessão inválida ou expirada. Faça login novamente.")
    if sessao["expira_em"] < agora_utc_naive():
        await sessoes_collection.delete_one({"_id": token})
        raise HTTPException(status_code=401, detail="Sessão expirada. Faça login novamente.")
    usuario = await usuarios_collection.find_one({"_id": sessao["user_id"]})
    if not usuario:
        raise HTTPException(status_code=401, detail="Usuário não encontrado.")
    return usuario
