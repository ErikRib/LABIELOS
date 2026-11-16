"""Organizações, busca para cadastro e administração (doc §6.1)."""
import re
import uuid

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from contexto import organizacao_ativa
from database import (
    impressoras_collection, materiais_collection, memberships_collection,
    organizacoes_collection, solicitacoes_collection, usuarios_collection,
)
from deps import exigir_admin
from models.schemas import AlterarPapel, DecisaoPedido, OrganizacaoParcial
from sessions import revogar_sessoes_usuario, usuario_atual
from utilitarios import agora_utc_naive

router = APIRouter(prefix="/api", tags=["Organizações"])


@router.get("/organizations")
async def listar_organizacoes(q: str = "", tipo: str = ""):
    filtro: dict = {"status": "active"}
    if tipo:
        filtro["tipo"] = tipo
    if q:
        filtro["nome"] = {"$regex": re.escape(q), "$options": "i"}
    itens = [{"id": str(org["_id"]), "nome": org["nome"]} async for org in organizacoes_collection.find(filtro).limit(20)]
    return {"items": itens}


def organizacao_publica(org: dict) -> dict:
    return {
        "id": str(org["_id"]),
        "nome": org["nome"],
        "tipo": org["tipo"],
        "status": org["status"],
        "cnpj": org.get("cnpj", ""),
        "email_institucional": org.get("email_institucional", ""),
        "telefone_institucional": org.get("telefone_institucional", ""),
        "enderecos": org.get("enderecos", []) if org["tipo"] == "fabricante" else [],
    }


@router.get("/organizations/{org_id}")
async def obter_organizacao(contexto=Depends(exigir_admin)):
    _, org, _ = contexto
    return organizacao_publica(org)


@router.patch("/organizations/{org_id}")
async def editar_organizacao(dados: OrganizacaoParcial, contexto=Depends(exigir_admin)):
    _, org, _ = contexto
    campos: dict = {}

    if dados.nome is not None:
        if not dados.nome.strip():
            raise HTTPException(status_code=422, detail="Nome não pode ser vazio.")
        campos["nome"] = dados.nome.strip()

    if dados.cnpj is not None:
        digitos = re.sub(r"\D", "", dados.cnpj)
        if len(digitos) != 14:
            raise HTTPException(status_code=422, detail="CNPJ inválido.")
        existente = await organizacoes_collection.find_one(
            {"cnpj": digitos, "status": {"$ne": "removed"}, "_id": {"$ne": org["_id"]}}
        )
        if existente:
            raise HTTPException(status_code=409, detail="Já existe uma organização com este CNPJ.")
        campos["cnpj"] = digitos

    if dados.email_institucional is not None:
        campos["email_institucional"] = dados.email_institucional.lower()

    if dados.telefone_institucional is not None:
        if not dados.telefone_institucional.strip():
            raise HTTPException(status_code=422, detail="Telefone institucional não pode ser vazio.")
        campos["telefone_institucional"] = dados.telefone_institucional.strip()

    if dados.enderecos is not None and org["tipo"] == "fabricante":
        if not dados.enderecos:
            raise HTTPException(status_code=422, detail="A organização precisa de pelo menos um endereço de retirada.")
        nomes = [e.nome.strip() for e in dados.enderecos]
        if len(nomes) != len(set(nomes)):
            raise HTTPException(status_code=422, detail="Os endereços não podem ter nomes repetidos.")
        novos = []
        for endereco in dados.enderecos:
            item = endereco.model_dump()
            item["id"] = item.get("id") or str(uuid.uuid4())
            novos.append(item)
        campos["enderecos"] = novos

    if campos:
        await organizacoes_collection.update_one({"_id": org["_id"]}, {"$set": campos})
        org = await organizacoes_collection.find_one({"_id": org["_id"]})
    return organizacao_publica(org)


@router.delete("/organizations/{org_id}", status_code=204)
async def remover_organizacao(contexto=Depends(exigir_admin)):
    _, org, _ = contexto

    if org["tipo"] == "organizacao":
        pendentes = [s async for s in solicitacoes_collection.find(
            {"requerente_org_id": org["_id"], "status": {"$ne": "Concluída"}}
        )]
    else:
        pendentes = [s async for s in solicitacoes_collection.find({
            "atribuido_org_id": org["_id"],
            "status": {"$in": ["Em análise", "Aguardando material", "Em produção", "Pronta para retirada"]},
        })]
    if pendentes:
        protocolos = ", ".join(s["protocolo"] for s in pendentes)
        raise HTTPException(
            status_code=409,
            detail=f"Não é possível remover: há {len(pendentes)} solicitação(ões) em andamento ({protocolos}). Conclua ou devolva à fila antes.",
        )

    # Hard delete: o usuário decidiu apagar de vez, em vez de soft-delete
    # (status="removed"). Trade-off aceito: solicitações antigas já
    # concluídas com esta organização passam a mostrar "Organização
    # removida" no lugar do nome (ver solicitacao_helper em
    # routes/solicitacoes.py), já que o nome não é mais resolvível.
    usuarios_afetados = [m["user_id"] async for m in memberships_collection.find({"org_id": org["_id"], "status": "active"})]
    await memberships_collection.delete_many({"org_id": org["_id"]})
    await impressoras_collection.delete_many({"org_id": org["_id"]})
    await materiais_collection.delete_many({"org_id": org["_id"]})
    await organizacoes_collection.delete_one({"_id": org["_id"]})
    for user_id in usuarios_afetados:
        restam = await memberships_collection.count_documents({"user_id": user_id, "status": "active"})
        if restam == 0:
            await revogar_sessoes_usuario(user_id)
    return None


@router.get("/organizations/{org_id}/requests")
async def pedidos_pendentes(contexto=Depends(exigir_admin)):
    _, org, _ = contexto
    itens = []
    async for membership in memberships_collection.find({"org_id": org["_id"], "status": "pending"}):
        usuario = await usuarios_collection.find_one({"_id": membership["user_id"]})
        if not usuario:
            continue
        itens.append({
            "membership_id": str(membership["_id"]),
            "user_id": str(usuario["_id"]),
            "nome": usuario.get("nome", ""),
            "sobrenome": usuario.get("sobrenome", ""),
            "email": usuario.get("email", ""),
            "job_title": membership.get("job_title", ""),
            "justification": membership.get("justification", ""),
            "role": membership.get("role", "member"),
            "created_at": membership["created_at"].isoformat(),
        })
    return itens


@router.post("/organizations/{org_id}/requests/{membership_id}")
async def decidir_pedido(membership_id: str, dados: DecisaoPedido, contexto=Depends(exigir_admin)):
    usuario, org, _ = contexto
    if not ObjectId.is_valid(membership_id):
        raise HTTPException(status_code=404, detail="Pedido não encontrado.")
    membership = await memberships_collection.find_one(
        {"_id": ObjectId(membership_id), "org_id": org["_id"], "status": "pending"}
    )
    if not membership:
        raise HTTPException(status_code=404, detail="Pedido não encontrado.")

    agora = agora_utc_naive()
    if dados.approve:
        await memberships_collection.update_one(
            {"_id": membership["_id"]},
            {"$set": {"status": "active", "approved_by": usuario["_id"], "approved_at": agora, "joined_at": agora}},
        )
        return {"message": "Pedido aprovado."}
    await memberships_collection.update_one(
        {"_id": membership["_id"]},
        {"$set": {"status": "rejected", "approved_by": usuario["_id"], "approved_at": agora}},
    )
    return {"message": "Pedido recusado."}


def _membro_publico(membership: dict, usuario: dict) -> dict:
    return {
        "membership_id": str(membership["_id"]),
        "user_id": str(usuario["_id"]),
        "nome": usuario.get("nome", ""),
        "sobrenome": usuario.get("sobrenome", ""),
        "email": usuario.get("email", ""),
        "job_title": membership.get("job_title", ""),
        "role": membership["role"],
        "membership_status": membership["status"],
        "joined_at": (membership.get("joined_at") or membership["created_at"]).isoformat(),
    }


@router.get("/organizations/{org_id}/members")
async def listar_membros(contexto=Depends(exigir_admin)):
    _, org, _ = contexto
    itens = []
    async for membership in memberships_collection.find({"org_id": org["_id"], "status": "active"}):
        usuario = await usuarios_collection.find_one({"_id": membership["user_id"]})
        if usuario:
            itens.append(_membro_publico(membership, usuario))
    return itens


@router.patch("/organizations/{org_id}/members/{membership_id}")
async def alterar_papel(membership_id: str, dados: AlterarPapel, contexto=Depends(exigir_admin)):
    _, org, membership_admin = contexto
    if not ObjectId.is_valid(membership_id):
        raise HTTPException(status_code=404, detail="Membro não encontrado.")
    if str(membership_admin["_id"]) == membership_id:
        raise HTTPException(status_code=400, detail="Você não pode alterar o próprio vínculo.")

    alvo = await memberships_collection.find_one(
        {"_id": ObjectId(membership_id), "org_id": org["_id"], "status": "active"}
    )
    if not alvo:
        raise HTTPException(status_code=404, detail="Membro não encontrado.")
    if alvo["role"] == "admin" and dados.role == "member":
        restantes = await memberships_collection.count_documents(
            {"org_id": org["_id"], "role": "admin", "status": "active"}
        )
        if restantes <= 1:
            raise HTTPException(status_code=409, detail="A organização precisa de pelo menos um administrador.")

    await memberships_collection.update_one({"_id": alvo["_id"]}, {"$set": {"role": dados.role}})
    atualizado = await memberships_collection.find_one({"_id": alvo["_id"]})
    usuario_alvo = await usuarios_collection.find_one({"_id": atualizado["user_id"]})
    return _membro_publico(atualizado, usuario_alvo)


@router.delete("/organizations/{org_id}/members/{membership_id}", status_code=204)
async def remover_membro(membership_id: str, contexto=Depends(exigir_admin)):
    _, org, membership_admin = contexto
    if not ObjectId.is_valid(membership_id):
        raise HTTPException(status_code=404, detail="Membro não encontrado.")
    if str(membership_admin["_id"]) == membership_id:
        raise HTTPException(status_code=400, detail="Você não pode remover o próprio vínculo.")

    alvo = await memberships_collection.find_one(
        {"_id": ObjectId(membership_id), "org_id": org["_id"], "status": "active"}
    )
    if not alvo:
        raise HTTPException(status_code=404, detail="Membro não encontrado.")
    if alvo["role"] == "admin":
        restantes = await memberships_collection.count_documents(
            {"org_id": org["_id"], "role": "admin", "status": "active"}
        )
        if restantes <= 1:
            raise HTTPException(status_code=409, detail="A organização precisa de pelo menos um administrador.")

    await memberships_collection.update_one({"_id": alvo["_id"]}, {"$set": {"status": "removed"}})
    restam_ativos = await memberships_collection.count_documents({"user_id": alvo["user_id"], "status": "active"})
    if restam_ativos == 0:
        await revogar_sessoes_usuario(alvo["user_id"])
    return None


@router.get("/organizacao/enderecos")
async def enderecos_organizacao_ativa(usuario: dict = Depends(usuario_atual)):
    ctx = await organizacao_ativa(usuario["_id"])
    if not ctx:
        raise HTTPException(status_code=403, detail="Nenhuma organização ativa associada à sua conta.")
    return ctx["org"].get("enderecos", [])
