"""Impressoras do parque de cada fabricante (doc §6.3)."""
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from database import impressoras_collection
from deps import exigir_fabricante
from models.schemas import ImpressoraEntrada, ImpressoraParcial

router = APIRouter(prefix="/api/impressoras", tags=["Impressoras"])


def impressora_publica(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]), "nome": doc["nome"], "modelo": doc.get("modelo", ""), "tecnologia": doc["tecnologia"],
        "largura_mm": doc.get("largura_mm"), "profundidade_mm": doc.get("profundidade_mm"), "altura_mm": doc.get("altura_mm"),
        "materiais": doc.get("materiais", ""), "status": doc["status"], "observacoes": doc.get("observacoes", ""),
        "atualizado_em": doc["atualizado_em"],
    }


@router.get("")
async def listar_impressoras(contexto=Depends(exigir_fabricante)):
    _, org, _ = contexto
    cursor = impressoras_collection.find({"org_id": org["_id"]}).sort("nome", 1)
    return [impressora_publica(d) async for d in cursor]


@router.post("", status_code=201)
async def criar_impressora(dados: ImpressoraEntrada, contexto=Depends(exigir_fabricante)):
    _, org, _ = contexto
    doc = dados.model_dump()
    doc.update({"org_id": org["_id"], "atualizado_em": datetime.now(timezone.utc).isoformat()})
    novo = await impressoras_collection.insert_one(doc)
    criado = await impressoras_collection.find_one({"_id": novo.inserted_id})
    return impressora_publica(criado)


@router.patch("/{id}")
async def editar_impressora(id: str, dados: ImpressoraParcial, contexto=Depends(exigir_fabricante)):
    _, org, _ = contexto
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=404, detail="Impressora não encontrada.")
    item = await impressoras_collection.find_one({"_id": ObjectId(id), "org_id": org["_id"]})
    if not item:
        raise HTTPException(status_code=404, detail="Impressora não encontrada.")

    campos = dados.model_dump(exclude_unset=True)
    campos["atualizado_em"] = datetime.now(timezone.utc).isoformat()
    await impressoras_collection.update_one({"_id": item["_id"]}, {"$set": campos})
    atualizado = await impressoras_collection.find_one({"_id": item["_id"]})
    return impressora_publica(atualizado)


@router.delete("/{id}", status_code=204)
async def remover_impressora(id: str, contexto=Depends(exigir_fabricante)):
    _, org, _ = contexto
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=404, detail="Impressora não encontrada.")
    resultado = await impressoras_collection.delete_one({"_id": ObjectId(id), "org_id": org["_id"]})
    if resultado.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Impressora não encontrada.")
    return None
