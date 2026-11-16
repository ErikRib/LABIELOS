"""Materiais para doação (doc §6.2)."""
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from contexto import organizacao_ativa
from database import materiais_collection, organizacoes_collection
from deps import exigir_fabricante
from models.schemas import MaterialEntrada, MaterialParcial
from sessions import usuario_atual
from utilitarios import calcular_situacao

router = APIRouter(prefix="/api/materiais", tags=["Materiais"])


def _cidade_organizacao(org: dict) -> str:
    enderecos = org.get("enderecos", [])
    if not enderecos:
        return ""
    e = enderecos[0]
    return f"{e.get('cidade', '')} - {e.get('uf', '')}".strip(" -")


def material_publico(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]), "material": doc["material"], "tipo": doc["tipo"], "cor": doc.get("cor", ""),
        "quantidade": doc["quantidade"], "unidade": doc["unidade"], "estoque_minimo": doc.get("estoque_minimo"),
        "observacoes": doc.get("observacoes", ""), "situacao": doc["situacao"],
        "parceiro": doc.get("org_nome", ""), "cidade": doc.get("org_cidade", ""),
        "atualizado_em": doc["atualizado_em"],
    }


@router.get("")
async def listar_materiais(usuario: dict = Depends(usuario_atual)):
    ctx_fab = await organizacao_ativa(usuario["_id"], tipo="fabricante")
    if ctx_fab:
        cursor = materiais_collection.find({"org_id": ctx_fab["org"]["_id"]})
    else:
        ctx_sol = await organizacao_ativa(usuario["_id"], tipo="organizacao")
        if not ctx_sol:
            raise HTTPException(status_code=403, detail="Nenhuma organização ativa associada à sua conta.")
        ids_fabricantes_ativos = [
            o["_id"] async for o in organizacoes_collection.find({"tipo": "fabricante", "status": "active"}, {"_id": 1})
        ]
        cursor = materiais_collection.find({"org_id": {"$in": ids_fabricantes_ativos}})
    return [material_publico(d) async for d in cursor.sort("material", 1)]


@router.post("", status_code=201)
async def criar_material(dados: MaterialEntrada, contexto=Depends(exigir_fabricante)):
    _, org, _ = contexto
    doc = dados.model_dump()
    doc.update({
        "org_id": org["_id"], "org_nome": org["nome"], "org_cidade": _cidade_organizacao(org),
        "situacao": calcular_situacao(doc["quantidade"], doc.get("estoque_minimo")),
        "atualizado_em": datetime.now(timezone.utc).isoformat(),
    })
    novo = await materiais_collection.insert_one(doc)
    criado = await materiais_collection.find_one({"_id": novo.inserted_id})
    return material_publico(criado)


@router.patch("/{id}")
async def editar_material(id: str, dados: MaterialParcial, contexto=Depends(exigir_fabricante)):
    _, org, _ = contexto
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=404, detail="Material não encontrado.")
    item = await materiais_collection.find_one({"_id": ObjectId(id), "org_id": org["_id"]})
    if not item:
        raise HTTPException(status_code=404, detail="Material não encontrado.")

    campos = dados.model_dump(exclude_unset=True)
    nova_quantidade = campos.get("quantidade", item["quantidade"])
    novo_estoque_minimo = campos.get("estoque_minimo", item.get("estoque_minimo"))
    campos["situacao"] = calcular_situacao(nova_quantidade, novo_estoque_minimo)
    campos["atualizado_em"] = datetime.now(timezone.utc).isoformat()

    await materiais_collection.update_one({"_id": item["_id"]}, {"$set": campos})
    atualizado = await materiais_collection.find_one({"_id": item["_id"]})
    return material_publico(atualizado)


@router.delete("/{id}", status_code=204)
async def remover_material(id: str, contexto=Depends(exigir_fabricante)):
    _, org, _ = contexto
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=404, detail="Material não encontrado.")
    resultado = await materiais_collection.delete_one({"_id": ObjectId(id), "org_id": org["_id"]})
    if resultado.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Material não encontrado.")
    return None
