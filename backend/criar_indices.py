"""Cria os índices necessários no MongoDB Atlas.

Rode uma vez depois de apontar o MONGO_URI para um cluster novo (ou sempre
que quiser conferir se os índices existem):

    python criar_indices.py

É seguro rodar mais de uma vez — `create_index` não duplica um índice que já
existe com a mesma definição. Ver backend/README.md, seção "Banco de dados",
para a explicação de cada coleção.
"""
import asyncio

from database import (
    codigos_recuperacao_collection,
    codigos_verificacao_cadastro_collection,
    materiais_collection,
    memberships_collection,
    organizacoes_collection,
    sessoes_collection,
    solicitacoes_collection,
    usuarios_collection,
)


async def main():
    # usuarios: login é sempre por e-mail, então precisa ser único e rápido de achar.
    await usuarios_collection.create_index("email", unique=True)

    # organizacoes: CNPJ não pode se repetir entre organizações não removidas.
    # (Mongo só aceita igualdade em partialFilterExpression, não $ne; como o
    # único outro status é "removed", filtrar por "active" dá o mesmo resultado.)
    await organizacoes_collection.create_index(
        "cnpj", unique=True,
        partialFilterExpression={"status": "active"},
    )

    # memberships: busca comum é "vínculos de um usuário" e "vínculos de uma organização".
    await memberships_collection.create_index("user_id")
    await memberships_collection.create_index("org_id")

    # solicitacoes: protocolo ("#0001") é o identificador público, único.
    await solicitacoes_collection.create_index("protocolo", unique=True)
    await solicitacoes_collection.create_index("requerente_org_id")
    await solicitacoes_collection.create_index("atribuido_org_id")

    # materiais e impressoras: sempre filtrados pela organização dona.
    await materiais_collection.create_index("org_id")
    from database import impressoras_collection
    await impressoras_collection.create_index("org_id")

    # sessoes: expira sozinha (TTL) 0 segundos depois de passar de "expira_em".
    await sessoes_collection.create_index("expira_em", expireAfterSeconds=0)

    # codigos_recuperacao e codigos_verificacao_cadastro: idem, o código some
    # sozinho depois de expirar.
    await codigos_recuperacao_collection.create_index("expira_em", expireAfterSeconds=0)
    await codigos_verificacao_cadastro_collection.create_index("expira_em", expireAfterSeconds=0)

    print("Índices criados/confirmados com sucesso.")


if __name__ == "__main__":
    asyncio.run(main())
