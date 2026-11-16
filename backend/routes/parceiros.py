"""GET /api/parceiros — tudo calculado a partir de organizações, impressoras,
materiais e solicitações (doc §5, "Parceiros de manufatura")."""
from fastapi import APIRouter, Depends

from contexto import organizacao_ativa
from database import impressoras_collection, materiais_collection, organizacoes_collection, solicitacoes_collection
from sessions import usuario_atual
from utilitarios import endereco_texto

router = APIRouter(prefix="/api", tags=["Parceiros"])


def _volume_texto(impressora: dict) -> str:
    dims = [impressora.get("largura_mm"), impressora.get("profundidade_mm"), impressora.get("altura_mm")]
    if not all(dims):
        return ""
    return f"{dims[0]} × {dims[1]} × {dims[2]} mm"


@router.get("/parceiros")
async def parceiros(usuario: dict = Depends(usuario_atual)):
    ctx_sol = await organizacao_ativa(usuario["_id"], tipo="organizacao")
    minha_org_id = ctx_sol["org"]["_id"] if ctx_sol else None

    resultado = []
    async for org in organizacoes_collection.find({"tipo": "fabricante", "status": "active"}):
        impressoras = [i async for i in impressoras_collection.find({"org_id": org["_id"]})]
        ativas = [i for i in impressoras if i["status"] != "Inativa"]
        livres = [i for i in ativas if i["status"] == "Disponível"]
        if livres:
            status_parceiro = "Disponível"
        elif ativas:
            status_parceiro = "Capacidade limitada"
        else:
            status_parceiro = "Indisponível"

        materiais = [m async for m in materiais_collection.find({"org_id": org["_id"], "quantidade": {"$gt": 0}})]

        em_producao = await solicitacoes_collection.count_documents({
            "atribuido_org_id": org["_id"],
            "status": {"$in": ["Em análise", "Aguardando material", "Em produção", "Pronta para retirada"]},
        })
        concluidas = await solicitacoes_collection.count_documents({"atribuido_org_id": org["_id"], "status": "Concluída"})
        concluidas_com_voce = 0
        if minha_org_id:
            concluidas_com_voce = await solicitacoes_collection.count_documents({
                "atribuido_org_id": org["_id"], "requerente_org_id": minha_org_id, "status": "Concluída",
            })

        enderecos = org.get("enderecos", [])
        primeiro_endereco = enderecos[0] if enderecos else {}
        cidade = f"{primeiro_endereco.get('cidade', '')} - {primeiro_endereco.get('uf', '')}".strip(" -")

        resultado.append({
            "id": str(org["_id"]), "nome": org["nome"], "cidade": cidade, "status": status_parceiro,
            "impressoras": len(ativas), "impressoras_livres": len(livres),
            "tecnologias": ", ".join(sorted({i["tecnologia"] for i in ativas})),
            "materiais": ", ".join(sorted({m["material"] for m in materiais})),
            "emProducao": em_producao, "concluidas": concluidas, "concluidas_com_voce": concluidas_com_voce,
            "lista_impressoras": [
                {
                    "nome": i["nome"], "modelo": i.get("modelo", ""), "tecnologia": i["tecnologia"],
                    "volume": _volume_texto(i), "materiais": i.get("materiais", ""), "status": i["status"],
                }
                for i in impressoras
            ],
            "materiais_doacao": [
                {
                    "material": m["material"], "tipo": m["tipo"], "cor": m.get("cor", ""),
                    "quantidade": m["quantidade"], "unidade": m["unidade"], "situacao": m["situacao"],
                }
                for m in materiais
            ],
            "enderecos": [
                {"nome": e["nome"], "cidade": f"{e.get('cidade', '')}/{e.get('uf', '')}", "endereco": endereco_texto(e)}
                for e in enderecos
            ],
            "contato": {"email": org.get("email_institucional", ""), "telefone": org.get("telefone_institucional", "")},
        })
    return resultado
