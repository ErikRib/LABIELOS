"""Resolve os vínculos (memberships) de um usuário com as organizações.

Um usuário pode, em tese, ter vínculo com mais de uma organização, mas o
front-end (ver js/api.js → destinoAposEntrar) sempre trabalha com "a
primeira organização ativa" do usuário. Este módulo segue a mesma regra:
é uma simplificação deliberada (ver docs/backend.md)."""
from bson import ObjectId

from database import memberships_collection, organizacoes_collection


def _oid(valor):
    return valor if isinstance(valor, ObjectId) else ObjectId(valor)


async def listar_memberships(user_id) -> list[dict]:
    """Todos os vínculos do usuário (qualquer status), cada um já com a
    organização correspondente carregada."""
    user_id = _oid(user_id)
    itens = []
    async for membership in memberships_collection.find({"user_id": user_id}):
        org = await organizacoes_collection.find_one({"_id": membership["org_id"]})
        if org:
            itens.append({"membership": membership, "org": org})
    return itens


async def memberships_ativos(user_id) -> list[dict]:
    itens = await listar_memberships(user_id)
    return [i for i in itens if i["membership"]["status"] == "active" and i["org"]["status"] == "active"]


async def organizacao_ativa(user_id, tipo: str | None = None):
    """Primeiro vínculo ativo do usuário, opcionalmente filtrando o tipo de
    organização ("organizacao" ou "fabricante"). Devolve None se não houver."""
    itens = await memberships_ativos(user_id)
    if tipo:
        itens = [i for i in itens if i["org"]["tipo"] == tipo]
    return itens[0] if itens else None
