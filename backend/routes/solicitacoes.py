"""Solicitações, fila global e fluxo de produção (doc §5)."""
import os
import uuid
from datetime import datetime
from typing import Optional
from urllib.parse import quote

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse, Response
from pymongo import ReturnDocument

from contexto import organizacao_ativa
from database import (
    arquivos_bucket, contadores_collection, impressoras_collection, materiais_collection, organizacoes_collection,
    solicitacoes_collection, usuarios_collection,
)
from deps import exigir_fabricante, exigir_organizacao_solicitante
from models.schemas import (
    ConcluirProducaoEntrada, HistoricoEntrada, IniciarProducaoEntrada, ReprovarEntrada,
    SolicitacaoEntrada, SolicitacaoParcial,
)
from sessions import usuario_atual
from utilitarios import FUSO_BRASILIA, calcular_situacao, endereco_texto, formatar_tamanho

router = APIRouter(prefix="/api", tags=["Solicitações"])

# Só usada como respaldo para arquivos antigos, enviados antes de os
# arquivos irem para o GridFS (ver database.py).
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "uploads", "arquivos3d")
EXTENSOES_3D = {"stl", "obj", "3mf", "step", "stp", "iges", "igs"}
TAMANHO_MAX_3D = 200 * 1024 * 1024


def agora_texto() -> str:
    return datetime.now(FUSO_BRASILIA).strftime("%d/%m/%Y %H:%M")


def hoje_texto() -> str:
    return datetime.now(FUSO_BRASILIA).strftime("%d/%m/%Y")


def autor_texto(usuario: dict, org_nome: str) -> str:
    nome = f"{usuario.get('nome', '')} {usuario.get('sobrenome', '')}".strip()
    return f"{nome} ({org_nome})" if org_nome else nome


def autor_campos(usuario: dict, org: Optional[dict]) -> dict:
    # Grava o texto pronto (fallback, usado se o usuário/organização forem
    # apagados depois) E os ids (para resolver o nome ATUAL na leitura —
    # ver autor_atual()). Sem isso, trocar o nome do usuário/organização
    # nunca apareceria em eventos já registrados.
    return {
        "autor": autor_texto(usuario, org["nome"] if org else ""),
        "autor_user_id": usuario["_id"],
        "autor_org_id": org["_id"] if org else None,
    }


async def autor_atual(user_id, org_id, fallback: str) -> str:
    """Resolve 'Nome (Organização)' com os dados de AGORA; cai para o texto
    congelado (fallback) só quando o usuário e a organização não existem
    mais — ou, parcialmente, usa o que ainda existir dos dois."""
    usuario_doc = await usuarios_collection.find_one({"_id": user_id}) if user_id else None
    nome_usuario = f"{usuario_doc.get('nome', '')} {usuario_doc.get('sobrenome', '')}".strip() if usuario_doc else None
    org_doc = await organizacoes_collection.find_one({"_id": org_id}) if org_id else None
    nome_org = org_doc.get("nome") if org_doc else None

    if nome_usuario is None and nome_org is None:
        return fallback
    if nome_usuario and nome_org:
        return f"{nome_usuario} ({nome_org})"
    return nome_usuario or nome_org or fallback


async def nome_organizacao_atual(org_id, fallback: Optional[str]) -> Optional[str]:
    if org_id is not None:
        org_doc = await organizacoes_collection.find_one({"_id": org_id})
        if org_doc:
            return org_doc.get("nome", fallback)
    return fallback


async def evento_publico(evento: dict, protocolo: str | None = None) -> dict:
    autor = await autor_atual(evento.get("autor_user_id"), evento.get("autor_org_id"), evento.get("autor", ""))
    publico = {
        "data": evento["data"], "tipo": evento["tipo"], "titulo": evento["titulo"],
        "descricao": evento["descricao"], "autor": autor,
    }
    if evento.get("anexo") and protocolo:
        publico["anexo"] = {
            "nome": evento["anexo"]["nome"],
            "url": f"/api/solicitacoes/{quote(protocolo)}/anexos/{evento['anexo']['id']}",
        }
    return publico


def validar_prazo(prazo: Optional[str]) -> None:
    if prazo and prazo != "A definir":
        try:
            data_prazo = datetime.strptime(prazo, "%d/%m/%Y").date()
        except ValueError:
            raise HTTPException(status_code=422, detail="Prazo inválido. Use o formato dd/mm/aaaa ou 'A definir'.")
        if data_prazo < datetime.now(FUSO_BRASILIA).date():
            raise HTTPException(status_code=422, detail="O prazo não pode ser uma data passada.")


async def proximo_protocolo() -> str:
    doc = await contadores_collection.find_one_and_update(
        {"_id": "solicitacoes"}, {"$inc": {"seq": 1}}, upsert=True, return_document=ReturnDocument.AFTER,
    )
    return f"#{doc['seq']:04d}"


async def ler_corpo_com_arquivo(request: Request, campo_arquivo: str = "arquivo3d"):
    """Lê o corpo tanto em JSON quanto em multipart/form-data (quando há arquivo)."""
    content_type = request.headers.get("content-type", "")
    if content_type.startswith("multipart/form-data"):
        form = await request.form()
        dados = {k: v for k, v in form.items() if k != campo_arquivo}
        arquivo = form.get(campo_arquivo) or None
        if arquivo is not None and not getattr(arquivo, "filename", None):
            arquivo = None
        return dados, arquivo
    return await request.json(), None


async def salvar_arquivo3d(arquivo) -> dict:
    nome_original = arquivo.filename
    extensao = nome_original.rsplit(".", 1)[-1].lower() if "." in nome_original else ""
    if extensao not in EXTENSOES_3D:
        raise HTTPException(status_code=422, detail="Formato de arquivo 3D não suportado. Use STL, OBJ, 3MF, STEP/STP ou IGES/IGS.")
    conteudo = await arquivo.read()
    if len(conteudo) > TAMANHO_MAX_3D:
        raise HTTPException(status_code=422, detail="Arquivo 3D maior que 200 MB.")
    content_type = arquivo.content_type or "application/octet-stream"
    arquivo_id = await arquivos_bucket.upload_from_stream(
        nome_original, conteudo, metadata={"content_type": content_type, "tipo": "arquivo3d"}
    )
    return {
        "nome": nome_original, "formato": extensao.upper(), "tamanho": formatar_tamanho(len(conteudo)),
        "arquivo_id": arquivo_id, "content_type": content_type,
    }


async def apagar_arquivo_gridfs(arquivo_id) -> None:
    if not arquivo_id:
        return
    try:
        await arquivos_bucket.delete(arquivo_id)
    except Exception:  # já apagado: nada a fazer
        pass


async def resposta_arquivo_gridfs(arquivo_id, nome: str, content_type: str) -> Response:
    try:
        fluxo = await arquivos_bucket.open_download_stream(arquivo_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Arquivo não encontrado no servidor.")
    conteudo = await fluxo.read()
    return Response(
        content=conteudo, media_type=content_type,
        headers={"Content-Disposition": "attachment; filename*=UTF-8''" + quote(nome)},
    )


async def solicitacao_publica(doc: dict) -> dict:
    # "requerente"/"atribuido": resolvidos ao vivo pelo id da organização
    # (requerente_org_id/atribuido_org_id); o nome gravado na criação só
    # serve de fallback se a organização tiver sido apagada (hard delete —
    # ver docs/backend.md §11).
    requerente = await nome_organizacao_atual(doc.get("requerente_org_id"), doc["requerente_nome"])
    atribuido = await nome_organizacao_atual(doc.get("atribuido_org_id"), doc.get("atribuido_nome"))

    ajuste = doc.get("ajuste")
    if ajuste:
        ajuste = {
            **ajuste,
            "autor": await autor_atual(ajuste.get("autor_user_id"), ajuste.get("autor_org_id"), ajuste.get("autor", "")),
        }

    saida = {
        "protocolo": doc["protocolo"], "solicitacao": doc["solicitacao"],
        "requerente": requerente, "atribuido": atribuido,
        "prioridade": doc["prioridade"], "status": doc["status"], "categoria": doc["categoria"],
        "abertura": doc["abertura"], "prazo": doc["prazo"], "material": doc["material"],
        "descricao": doc["descricao"], "arquivo3d": None, "ultima_atualizacao": doc["ultima_atualizacao"],
        "producao": doc.get("producao"), "concluida_em": doc.get("concluida_em"),
        "retirada": doc.get("retirada"), "ajuste": ajuste,
    }
    arquivo = doc.get("arquivo3d")
    if arquivo:
        saida["arquivo3d"] = {
            "nome": arquivo["nome"], "tamanho": arquivo["tamanho"], "formato": arquivo["formato"],
            "url": f"/api/solicitacoes/{quote(doc['protocolo'])}/arquivo3d",
        }
    return saida


async def buscar_visivel(protocolo: str, usuario: dict) -> dict:
    doc = await solicitacoes_collection.find_one({"protocolo": protocolo})
    if not doc:
        raise HTTPException(status_code=404, detail="Solicitação não encontrada.")

    ctx_sol = await organizacao_ativa(usuario["_id"], tipo="organizacao")
    if ctx_sol and doc["requerente_org_id"] == ctx_sol["org"]["_id"]:
        return doc

    ctx_fab = await organizacao_ativa(usuario["_id"], tipo="fabricante")
    if ctx_fab:
        if doc.get("atribuido_org_id") == ctx_fab["org"]["_id"]:
            return doc
        if doc["status"] == "Aberta" and not doc.get("atribuido_org_id"):
            return doc

    raise HTTPException(status_code=404, detail="Solicitação não encontrada.")


@router.post("/solicitacoes", status_code=201)
async def criar_solicitacao(request: Request, contexto=Depends(exigir_organizacao_solicitante)):
    usuario, org, _ = contexto
    dados, arquivo = await ler_corpo_com_arquivo(request)
    entrada = SolicitacaoEntrada(**dados)
    validar_prazo(entrada.prazo)

    arquivo3d_doc = await salvar_arquivo3d(arquivo) if arquivo is not None else None

    protocolo = await proximo_protocolo()
    agora = agora_texto()
    doc = {
        "protocolo": protocolo, "solicitacao": entrada.solicitacao, "prioridade": entrada.prioridade,
        "categoria": entrada.categoria, "prazo": entrada.prazo or "A definir",
        "material": entrada.material or "A definir", "descricao": entrada.descricao,
        "requerente_org_id": org["_id"], "requerente_nome": org["nome"],
        "atribuido_org_id": None, "atribuido_nome": None,
        "status": "Aberta", "abertura": hoje_texto(), "ultima_atualizacao": agora,
        "arquivo3d": arquivo3d_doc, "producao": None, "concluida_em": None, "retirada": None, "ajuste": None,
        "historico": [{
            "data": agora, "tipo": "Criação", "titulo": "Solicitação criada",
            "descricao": f"Solicitação registrada por {org['nome']} e enviada para a fila de novas solicitações.",
            **autor_campos(usuario, org),
        }],
    }
    novo = await solicitacoes_collection.insert_one(doc)
    criado = await solicitacoes_collection.find_one({"_id": novo.inserted_id})
    return await solicitacao_publica(criado)


@router.get("/solicitacoes")
async def listar_solicitacoes(usuario: dict = Depends(usuario_atual)):
    ctx_sol = await organizacao_ativa(usuario["_id"], tipo="organizacao")
    if ctx_sol:
        filtro = {"requerente_org_id": ctx_sol["org"]["_id"]}
    else:
        ctx_fab = await organizacao_ativa(usuario["_id"], tipo="fabricante")
        if not ctx_fab:
            raise HTTPException(status_code=403, detail="Nenhuma organização ativa associada à sua conta.")
        filtro = {"atribuido_org_id": ctx_fab["org"]["_id"]}
    cursor = solicitacoes_collection.find(filtro).sort("_id", -1)
    return [await solicitacao_publica(d) async for d in cursor]


@router.get("/fila")
async def fila(contexto=Depends(exigir_fabricante)):
    cursor = solicitacoes_collection.find({"status": "Aberta", "atribuido_org_id": None}).sort("_id", -1)
    return [await solicitacao_publica(d) async for d in cursor]


@router.get("/solicitacoes/{protocolo}")
async def obter_solicitacao(protocolo: str, usuario: dict = Depends(usuario_atual)):
    doc = await buscar_visivel(protocolo, usuario)
    return await solicitacao_publica(doc)


@router.patch("/solicitacoes/{protocolo}")
async def editar_solicitacao(protocolo: str, request: Request, contexto=Depends(exigir_organizacao_solicitante)):
    usuario, org, _ = contexto
    doc = await solicitacoes_collection.find_one({"protocolo": protocolo, "requerente_org_id": org["_id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Solicitação não encontrada.")

    dados, arquivo = await ler_corpo_com_arquivo(request)
    dados.pop("status", None)
    dados.pop("atribuido", None)
    dados.pop("requerente", None)

    entrada = SolicitacaoParcial(**dados)
    campos = entrada.model_dump(exclude_unset=True)
    if "prazo" in campos:
        validar_prazo(campos["prazo"])

    if arquivo is not None:
        campos["arquivo3d"] = await salvar_arquivo3d(arquivo)
        await apagar_arquivo_gridfs((doc.get("arquivo3d") or {}).get("arquivo_id"))

    agora = agora_texto()
    campos["ultima_atualizacao"] = agora
    evento = {
        "data": agora, "tipo": "Edição", "titulo": "Solicitação editada",
        "descricao": "Os dados da solicitação foram atualizados.", **autor_campos(usuario, org),
    }
    await solicitacoes_collection.update_one({"_id": doc["_id"]}, {"$set": campos, "$push": {"historico": evento}})
    atualizado = await solicitacoes_collection.find_one({"_id": doc["_id"]})
    return await solicitacao_publica(atualizado)


@router.post("/solicitacoes/{protocolo}/aceitar")
async def aceitar_solicitacao(protocolo: str, contexto=Depends(exigir_fabricante)):
    usuario, org, _ = contexto
    agora = agora_texto()
    evento = {
        "data": agora, "tipo": "Atribuição", "titulo": f"Aceita por {org['nome']}",
        "descricao": "A solicitação saiu da fila e virou demanda do parceiro.", **autor_campos(usuario, org),
    }
    resultado = await solicitacoes_collection.find_one_and_update(
        {"protocolo": protocolo, "status": "Aberta", "atribuido_org_id": None},
        {"$set": {"atribuido_org_id": org["_id"], "atribuido_nome": org["nome"], "status": "Em análise", "ultima_atualizacao": agora},
         "$push": {"historico": evento}},
        return_document=ReturnDocument.AFTER,
    )
    if resultado is None:
        if not await solicitacoes_collection.find_one({"protocolo": protocolo}):
            raise HTTPException(status_code=404, detail="Solicitação não encontrada.")
        raise HTTPException(status_code=409, detail="Esta solicitação já foi aceita por outro parceiro.")
    return await solicitacao_publica(resultado)


@router.post("/solicitacoes/{protocolo}/devolver")
async def devolver_solicitacao(protocolo: str, contexto=Depends(exigir_fabricante)):
    usuario, org, _ = contexto
    agora = agora_texto()
    evento = {
        "data": agora, "tipo": "Atribuição", "titulo": "Devolvida à fila",
        "descricao": f"{org['nome']} devolveu a solicitação para a fila global.", **autor_campos(usuario, org),
    }
    resultado = await solicitacoes_collection.find_one_and_update(
        {"protocolo": protocolo, "status": "Em análise", "atribuido_org_id": org["_id"]},
        {"$set": {"atribuido_org_id": None, "atribuido_nome": None, "status": "Aberta", "ultima_atualizacao": agora},
         "$push": {"historico": evento}},
        return_document=ReturnDocument.AFTER,
    )
    if resultado is None:
        raise HTTPException(status_code=409, detail="Só é possível devolver uma solicitação que você aceitou e que ainda está em análise.")
    return await solicitacao_publica(resultado)


@router.post("/solicitacoes/{protocolo}/iniciar-producao")
async def iniciar_producao(protocolo: str, dados: IniciarProducaoEntrada, contexto=Depends(exigir_fabricante)):
    usuario, org, _ = contexto
    doc = await solicitacoes_collection.find_one({"protocolo": protocolo, "atribuido_org_id": org["_id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Solicitação não encontrada.")
    if doc["status"] != "Em análise":
        raise HTTPException(status_code=409, detail="Só é possível iniciar a produção de uma solicitação em análise.")

    if not ObjectId.is_valid(dados.impressora_id):
        raise HTTPException(status_code=422, detail="Impressora inválida.")
    impressora = await impressoras_collection.find_one({"_id": ObjectId(dados.impressora_id), "org_id": org["_id"]})
    if not impressora or impressora["status"] in ("Inativa", "Em manutenção"):
        raise HTTPException(status_code=422, detail="Selecione uma impressora da sua organização que não esteja inativa nem em manutenção.")

    producao = {
        "impressora": {
            "id": str(impressora["_id"]), "nome": impressora["nome"],
            "modelo": impressora.get("modelo", ""), "tecnologia": impressora["tecnologia"],
        },
    }
    agora = agora_texto()

    if dados.origem_material == "doacao":
        if not dados.material_id or not ObjectId.is_valid(dados.material_id):
            raise HTTPException(status_code=422, detail="Selecione um material do estoque de doação.")
        material = await materiais_collection.find_one({"_id": ObjectId(dados.material_id), "org_id": org["_id"]})
        if not material or material["quantidade"] <= 0:
            raise HTTPException(status_code=422, detail="Material indisponível no estoque.")
        nome_material = f"{material['material']} · {material['cor']}" if material.get("cor") else material["material"]
        producao["material"] = {
            "origem": "doacao", "id": str(material["_id"]), "nome": nome_material,
            "tipo": material["tipo"], "quantidade_usada": 0,
        }
        evento = {
            "data": agora, "tipo": "Status", "titulo": "Produção iniciada",
            "descricao": f"Produção iniciada na impressora {impressora['nome']} com material doado ({material['material']}).",
            **autor_campos(usuario, org),
        }
        await impressoras_collection.update_one({"_id": impressora["_id"]}, {"$set": {"status": "Em uso"}})
        novo_status = "Em produção"
    else:
        especificacao = (dados.especificacao or "").strip()
        if len(especificacao) < 3:
            raise HTTPException(status_code=422, detail="Descreva o material que precisa ser entregue (mínimo 3 caracteres).")
        enderecos = org.get("enderecos", [])
        endereco = None
        if dados.endereco_id:
            endereco = next((e for e in enderecos if e["id"] == dados.endereco_id), None)
        elif len(enderecos) == 1:
            endereco = enderecos[0]
        if not endereco:
            raise HTTPException(status_code=422, detail="Selecione o endereço de entrega do material.")
        producao["material"] = {
            "origem": "solicitante", "nome": especificacao, "especificacao": especificacao,
            "entrega": {"local": endereco["nome"], "endereco": endereco_texto(endereco)}, "recebido_em": None,
        }
        evento = {
            "data": agora, "tipo": "Status", "titulo": "Aguardando material do solicitante",
            "descricao": f"É necessário entregar: {especificacao}. Local de entrega: {endereco['nome']} — {endereco_texto(endereco)}.",
            **autor_campos(usuario, org),
        }
        novo_status = "Aguardando material"

    await solicitacoes_collection.update_one(
        {"_id": doc["_id"]},
        {"$set": {"status": novo_status, "producao": producao, "ultima_atualizacao": agora}, "$push": {"historico": evento}},
    )
    atualizado = await solicitacoes_collection.find_one({"_id": doc["_id"]})
    return await solicitacao_publica(atualizado)


@router.post("/solicitacoes/{protocolo}/material-recebido")
async def material_recebido(protocolo: str, contexto=Depends(exigir_fabricante)):
    usuario, org, _ = contexto
    doc = await solicitacoes_collection.find_one({"protocolo": protocolo, "atribuido_org_id": org["_id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Solicitação não encontrada.")
    if doc["status"] != "Aguardando material":
        raise HTTPException(status_code=409, detail="A solicitação não está aguardando material.")

    agora = agora_texto()
    producao = doc["producao"]
    producao["material"]["recebido_em"] = agora
    impressora_id = producao.get("impressora", {}).get("id")
    if impressora_id and ObjectId.is_valid(impressora_id):
        await impressoras_collection.update_one({"_id": ObjectId(impressora_id)}, {"$set": {"status": "Em uso"}})

    evento = {
        "data": agora, "tipo": "Status", "titulo": "Material recebido — produção iniciada",
        "descricao": "O material entregue pelo solicitante foi recebido e a produção foi iniciada.",
        **autor_campos(usuario, org),
    }
    await solicitacoes_collection.update_one(
        {"_id": doc["_id"]},
        {"$set": {"status": "Em produção", "producao": producao, "ultima_atualizacao": agora}, "$push": {"historico": evento}},
    )
    atualizado = await solicitacoes_collection.find_one({"_id": doc["_id"]})
    return await solicitacao_publica(atualizado)


@router.post("/solicitacoes/{protocolo}/concluir-producao")
async def concluir_producao(protocolo: str, dados: ConcluirProducaoEntrada, contexto=Depends(exigir_fabricante)):
    usuario, org, _ = contexto
    doc = await solicitacoes_collection.find_one({"protocolo": protocolo, "atribuido_org_id": org["_id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Solicitação não encontrada.")
    if doc["status"] != "Em produção":
        raise HTTPException(status_code=409, detail="Só é possível concluir uma produção em andamento.")

    enderecos = org.get("enderecos", [])
    if not enderecos:
        raise HTTPException(status_code=422, detail="Cadastre um endereço de retirada antes de concluir a produção.")
    endereco = None
    if dados.endereco_id:
        endereco = next((e for e in enderecos if e["id"] == dados.endereco_id), None)
        if not endereco:
            raise HTTPException(status_code=422, detail="Endereço de retirada inválido.")
    elif len(enderecos) == 1:
        endereco = enderecos[0]
    else:
        raise HTTPException(status_code=422, detail="Selecione o endereço de retirada.")

    producao = doc.get("producao") or {}
    material = producao.get("material", {})
    descricao_material = ""
    if material.get("origem") == "doacao":
        if not dados.quantidade_usada or dados.quantidade_usada <= 0:
            raise HTTPException(status_code=422, detail="Informe a quantidade de material usada.")
        item = await materiais_collection.find_one({"_id": ObjectId(material["id"])}) if ObjectId.is_valid(material.get("id", "")) else None
        if item:
            if dados.quantidade_usada > item["quantidade"]:
                raise HTTPException(
                    status_code=422,
                    detail=f"Quantidade maior que o estoque disponível ({item['quantidade']} {item['unidade']}).",
                )
            nova_quantidade = item["quantidade"] - dados.quantidade_usada
            await materiais_collection.update_one({"_id": item["_id"]}, {"$set": {
                "quantidade": nova_quantidade,
                "situacao": calcular_situacao(nova_quantidade, item.get("estoque_minimo")),
            }})
            cor = f" · {item['cor']}" if item.get("cor") else ""
            descricao_material = (
                f" Material usado: {dados.quantidade_usada:g} {item['unidade']} de {item['material']}{cor} "
                "(baixado do estoque de doação)."
            )
        else:
            descricao_material = f" Material usado: {dados.quantidade_usada:g} {material.get('nome', '')} (item removido do estoque)."
        material["quantidade_usada"] = material.get("quantidade_usada", 0) + dados.quantidade_usada
        producao["material"] = material

    agora = agora_texto()
    retirada = {
        "local": endereco["nome"], "endereco": endereco_texto(endereco),
        "instrucoes": dados.instrucoes or "", "parceiro": org["nome"],
        "telefone": org.get("telefone_institucional", ""),
        "email": org.get("email_institucional", ""), "data": agora,
    }
    descricao = f"A produção foi concluída e a peça está disponível para retirada em {endereco['nome']}: {endereco_texto(endereco)}."
    if dados.instrucoes:
        descricao += f" Instruções: {dados.instrucoes}."
    descricao += descricao_material
    evento = {
        "data": agora, "tipo": "Retirada", "titulo": "Disponível para retirada", "descricao": descricao,
        **autor_campos(usuario, org),
    }

    await solicitacoes_collection.update_one(
        {"_id": doc["_id"]},
        {"$set": {"status": "Pronta para retirada", "retirada": retirada, "ajuste": None, "producao": producao, "ultima_atualizacao": agora},
         "$push": {"historico": evento}},
    )

    # A impressora só volta a ficar "Disponível" se não estiver sendo usada
    # em outra demanda "Em produção" no momento (doc §5).
    impressora_id = producao.get("impressora", {}).get("id")
    if impressora_id and ObjectId.is_valid(impressora_id):
        em_uso_em_outra = await solicitacoes_collection.count_documents({
            "_id": {"$ne": doc["_id"]}, "status": "Em produção", "producao.impressora.id": impressora_id,
        })
        if em_uso_em_outra == 0:
            await impressoras_collection.update_one({"_id": ObjectId(impressora_id)}, {"$set": {"status": "Disponível"}})

    atualizado = await solicitacoes_collection.find_one({"_id": doc["_id"]})
    return await solicitacao_publica(atualizado)


@router.post("/solicitacoes/{protocolo}/aprovar")
async def aprovar_solicitacao(protocolo: str, contexto=Depends(exigir_organizacao_solicitante)):
    usuario, org, _ = contexto
    agora = agora_texto()
    evento = {
        "data": agora, "tipo": "Aprovação", "titulo": "Peça aprovada",
        "descricao": "A organização solicitante aprovou a peça recebida.", **autor_campos(usuario, org),
    }
    resultado = await solicitacoes_collection.find_one_and_update(
        {"protocolo": protocolo, "requerente_org_id": org["_id"], "status": "Pronta para retirada"},
        {"$set": {"status": "Concluída", "concluida_em": agora, "ultima_atualizacao": agora}, "$push": {"historico": evento}},
        return_document=ReturnDocument.AFTER,
    )
    if resultado is None:
        raise HTTPException(status_code=409, detail="Só é possível aprovar uma peça que esteja pronta para retirada.")
    return await solicitacao_publica(resultado)


@router.post("/solicitacoes/{protocolo}/reprovar")
async def reprovar_solicitacao(protocolo: str, dados: ReprovarEntrada, contexto=Depends(exigir_organizacao_solicitante)):
    usuario, org, _ = contexto
    agora = agora_texto()
    ajuste = {"motivo": dados.motivo, "data": agora, **autor_campos(usuario, org)}
    evento = {
        "data": agora, "tipo": "Devolução", "titulo": "Devolvida para ajuste",
        "descricao": f"Motivo: {dados.motivo}", **autor_campos(usuario, org),
    }
    resultado = await solicitacoes_collection.find_one_and_update(
        {"protocolo": protocolo, "requerente_org_id": org["_id"], "status": "Pronta para retirada"},
        {"$set": {"status": "Em produção", "retirada": None, "ajuste": ajuste, "ultima_atualizacao": agora}, "$push": {"historico": evento}},
        return_document=ReturnDocument.AFTER,
    )
    if resultado is None:
        raise HTTPException(status_code=409, detail="Só é possível devolver para ajuste uma peça que esteja pronta para retirada.")

    impressora_id = (resultado.get("producao") or {}).get("impressora", {}).get("id")
    if impressora_id and ObjectId.is_valid(impressora_id):
        await impressoras_collection.update_one({"_id": ObjectId(impressora_id)}, {"$set": {"status": "Em uso"}})

    return await solicitacao_publica(resultado)


@router.get("/solicitacoes/{protocolo}/historico")
async def historico_solicitacao(protocolo: str, usuario: dict = Depends(usuario_atual)):
    doc = await buscar_visivel(protocolo, usuario)
    return [await evento_publico(e, doc["protocolo"]) for e in doc.get("historico", [])]


@router.post("/solicitacoes/{protocolo}/historico")
async def adicionar_historico(protocolo: str, request: Request, usuario: dict = Depends(usuario_atual)):
    doc = await buscar_visivel(protocolo, usuario)
    dados, arquivo = await ler_corpo_com_arquivo(request, campo_arquivo="arquivo")

    if arquivo is not None:
        mensagem = (dados.get("mensagem") or "").strip()
    else:
        entrada = HistoricoEntrada(**dados)
        mensagem = entrada.mensagem.strip()
    if not mensagem and arquivo is None:
        raise HTTPException(status_code=422, detail="Escreva uma mensagem ou anexe um arquivo.")

    ctx_sol = await organizacao_ativa(usuario["_id"], tipo="organizacao")
    org_ativa = None
    if ctx_sol and doc["requerente_org_id"] == ctx_sol["org"]["_id"]:
        org_ativa = ctx_sol["org"]
    else:
        ctx_fab = await organizacao_ativa(usuario["_id"], tipo="fabricante")
        if ctx_fab:
            org_ativa = ctx_fab["org"]

    tipo = "Comentário"
    descricao = mensagem
    if arquivo is not None:
        tipo = "Anexo"
        conteudo = await arquivo.read()
        if len(conteudo) > TAMANHO_MAX_3D:
            raise HTTPException(status_code=422, detail="Anexo maior que 200 MB.")
        content_type = arquivo.content_type or "application/octet-stream"
        anexo = {
            "id": await arquivos_bucket.upload_from_stream(
                arquivo.filename, conteudo, metadata={"content_type": content_type, "tipo": "anexo"}
            ),
            "nome": arquivo.filename,
            "content_type": content_type,
        }
        descricao = f"{mensagem} (anexo: {arquivo.filename})".strip()

    evento = {
        "data": agora_texto(), "tipo": tipo,
        "titulo": "Comentário" if tipo == "Comentário" else "Anexo adicionado",
        "descricao": descricao, **autor_campos(usuario, org_ativa),
    }
    if arquivo is not None:
        evento["anexo"] = anexo
    await solicitacoes_collection.update_one({"_id": doc["_id"]}, {"$push": {"historico": evento}})
    return await evento_publico(evento, doc["protocolo"])


@router.get("/solicitacoes/{protocolo}/arquivo3d")
async def baixar_arquivo3d(protocolo: str, usuario: dict = Depends(usuario_atual)):
    doc = await buscar_visivel(protocolo, usuario)
    arquivo = doc.get("arquivo3d")
    if not arquivo:
        raise HTTPException(status_code=404, detail="Esta solicitação não tem arquivo 3D.")
    content_type = arquivo.get("content_type", "application/octet-stream")
    if arquivo.get("arquivo_id"):
        return await resposta_arquivo_gridfs(arquivo["arquivo_id"], arquivo["nome"], content_type)
    # Respaldo: arquivos antigos, gravados em disco antes do GridFS.
    caminho = os.path.join(UPLOAD_DIR, arquivo.get("arquivo_disco") or "")
    if not arquivo.get("arquivo_disco") or not os.path.exists(caminho):
        raise HTTPException(status_code=404, detail="Arquivo não encontrado no servidor.")
    return FileResponse(caminho, media_type=content_type, filename=arquivo["nome"])


@router.get("/solicitacoes/{protocolo}/anexos/{anexo_id}")
async def baixar_anexo(protocolo: str, anexo_id: str, usuario: dict = Depends(usuario_atual)):
    doc = await buscar_visivel(protocolo, usuario)
    anexo = next(
        (ev["anexo"] for ev in doc.get("historico", []) if ev.get("anexo") and str(ev["anexo"]["id"]) == anexo_id),
        None,
    )
    if not anexo:
        raise HTTPException(status_code=404, detail="Anexo não encontrado.")
    return await resposta_arquivo_gridfs(anexo["id"], anexo["nome"], anexo["content_type"])
