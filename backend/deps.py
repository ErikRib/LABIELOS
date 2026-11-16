"""Dependências do FastAPI usadas pelas rotas para checar quem pode fazer o quê."""
from bson import ObjectId
from fastapi import Depends, HTTPException

from contexto import organizacao_ativa
from database import memberships_collection, organizacoes_collection
from sessions import usuario_atual


async def exigir_fabricante(usuario: dict = Depends(usuario_atual)):
    """Usuário precisa ter vínculo ativo com uma organização fabricante ativa."""
    ctx = await organizacao_ativa(usuario["_id"], tipo="fabricante")
    if not ctx:
        raise HTTPException(status_code=403, detail="Ação disponível apenas para organizações fabricantes.")
    return usuario, ctx["org"], ctx["membership"]


async def exigir_organizacao_solicitante(usuario: dict = Depends(usuario_atual)):
    """Usuário precisa ter vínculo ativo com uma organização solicitante ativa."""
    ctx = await organizacao_ativa(usuario["_id"], tipo="organizacao")
    if not ctx:
        raise HTTPException(status_code=403, detail="Ação disponível apenas para organizações solicitantes.")
    return usuario, ctx["org"], ctx["membership"]


async def exigir_admin(org_id: str, usuario: dict = Depends(usuario_atual)):
    """Usuário precisa ser admin ativo da organização {org_id} (rota deve
    ter esse parâmetro no caminho) e a organização precisa estar ativa."""
    if not ObjectId.is_valid(org_id):
        raise HTTPException(status_code=403, detail="Organização inválida.")
    org_oid = ObjectId(org_id)
    membership = await memberships_collection.find_one({
        "user_id": usuario["_id"], "org_id": org_oid, "role": "admin", "status": "active",
    })
    org = await organizacoes_collection.find_one({"_id": org_oid, "status": "active"})
    if not membership or not org:
        raise HTTPException(status_code=403, detail="Apenas administradores ativos da organização podem fazer isso.")
    return usuario, org, membership
