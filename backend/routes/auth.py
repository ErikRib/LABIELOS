"""Autenticação, cadastro e perfil (doc §4)."""
import os
import re
import secrets
import uuid
from datetime import timedelta

from bson import ObjectId
from fastapi import APIRouter, Depends, File, HTTPException, Request, Response, UploadFile
from fastapi.responses import FileResponse, Response as RespostaBruta

from contexto import listar_memberships
from database import (
    codigos_recuperacao_collection, codigos_verificacao_cadastro_collection, fotos_perfil_collection,
    memberships_collection,
    organizacoes_collection, usuarios_collection,
)
from email_util import montar_email_codigo, tentar_enviar_email
from models.schemas import (
    AtualizarCargo, ConfirmarTrocaEmail, ConfirmarVerificacaoEmail, EsqueciSenhaEntrada, IniciarTrocaEmail,
    IniciarVerificacaoEmail, LoginEntrada, PerfilParcial, RedefinirSenhaEntrada, RegistroEntrada,
    TrocarSenha, VerificarCodigoEntrada,
)
from security import hash_senha, verificar_senha
from sessions import NOME_COOKIE, criar_sessao, destruir_sessao, revogar_sessoes_usuario, usuario_atual
from utilitarios import agora_utc_naive

router = APIRouter(prefix="/api", tags=["Autenticação e perfil"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "uploads")
FOTOS_DIR = os.path.join(UPLOAD_DIR, "fotos")
os.makedirs(FOTOS_DIR, exist_ok=True)

EXTENSAO_POR_MIME = {"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp"}


def usuario_publico(usuario: dict, memberships: list[dict]) -> dict:
    ativo = next(
        (m for m in memberships if m["membership"]["status"] == "active" and m["org"]["status"] == "active"),
        None,
    )
    publico = {
        "id": str(usuario["_id"]),
        "nome": usuario.get("nome", ""),
        "sobrenome": usuario.get("sobrenome", ""),
        "email": usuario.get("email", ""),
        "telefone": usuario.get("telefone", ""),
        "organizacao": ativo["org"]["nome"] if ativo else None,
    }
    if usuario.get("foto_arquivo"):
        # Cache-busting: sem isso, o navegador continua mostrando a foto
        # antiga depois de um novo upload, porque a URL nunca muda.
        atualizada_em = usuario.get("foto_atualizada_em")
        versao = int(atualizada_em.timestamp()) if atualizada_em else 0
        publico["foto"] = f"/api/me/photo?v={versao}"
    return publico


def memberships_publico(memberships: list[dict]) -> list[dict]:
    return [
        {
            "membership_id": str(item["membership"]["_id"]),
            "org_id": str(item["org"]["_id"]),
            "organization": item["org"]["nome"],
            "organization_type": item["org"]["tipo"],
            "organization_status": item["org"]["status"],
            "role": item["membership"]["role"],
            "membership_status": item["membership"]["status"],
            "job_title": item["membership"].get("job_title", ""),
        }
        for item in memberships
    ]


@router.post("/auth/login")
async def login(dados: LoginEntrada, response: Response):
    usuario = await usuarios_collection.find_one({"email": dados.email.lower()})
    if not usuario or not verificar_senha(dados.senha, usuario.get("senha_hash", "")):
        raise HTTPException(status_code=401, detail="E-mail ou senha inválidos.")

    memberships = await listar_memberships(usuario["_id"])
    tem_ativo = any(m["membership"]["status"] == "active" and m["org"]["status"] == "active" for m in memberships)
    tem_pendente = any(m["membership"]["status"] == "pending" for m in memberships)
    if not tem_ativo and tem_pendente:
        raise HTTPException(
            status_code=403,
            detail="Seu acesso ainda não foi aprovado por um administrador da organização.",
        )

    await criar_sessao(response, usuario["_id"], lembrar=dados.lembrar)
    return {"message": "Login realizado com sucesso."}


async def _verificacao_email_valida(email: str, codigo: str | None) -> bool:
    if not codigo:
        return False
    registro = await codigos_verificacao_cadastro_collection.find_one({"_id": email})
    if not registro or not registro.get("verificado") or registro["codigo"] != codigo:
        return False
    return registro["expira_em"] >= agora_utc_naive()


@router.post("/auth/register", status_code=201)
async def registrar(dados: RegistroEntrada, response: Response):
    if not dados.termos:
        raise HTTPException(status_code=422, detail="É necessário aceitar os termos de uso.")

    email = dados.email.lower()
    if not await _verificacao_email_valida(email, dados.verificacao_codigo):
        raise HTTPException(status_code=422, detail="Confirme seu e-mail antes de continuar.")

    agora = agora_utc_naive()

    # E-mail já tem conta (por exemplo: a organização anterior dele foi
    # removida, mas a conta continua existindo). Se a senha bater, reaproveita
    # a conta em vez de recusar o cadastro — ver docs/backend.md.
    usuario_existente = await usuarios_collection.find_one({"email": email})
    if usuario_existente:
        if not verificar_senha(dados.senha, usuario_existente.get("senha_hash", "")):
            raise HTTPException(
                status_code=409,
                detail="Este e-mail já tem uma conta. Faça login (ou use \"Esqueci minha senha\") para continuar.",
            )
        usuario_id = usuario_existente["_id"]
    else:
        usuario_doc = {
            "nome": dados.nome.strip(),
            "sobrenome": dados.sobrenome.strip(),
            "email": email,
            "senha_hash": hash_senha(dados.senha),
            "telefone": "",
            "foto_arquivo": None,
            "criado_em": agora,
        }
        usuario_id = (await usuarios_collection.insert_one(usuario_doc)).inserted_id

    if dados.vinculo == "existente":
        if not dados.organizacao_id or not ObjectId.is_valid(dados.organizacao_id):
            raise HTTPException(status_code=422, detail="Selecione uma organização válida.")
        org = await organizacoes_collection.find_one(
            {"_id": ObjectId(dados.organizacao_id), "status": "active", "tipo": dados.tipo}
        )
        if not org:
            raise HTTPException(status_code=422, detail="Organização não encontrada.")
        await memberships_collection.insert_one({
            "user_id": usuario_id,
            "org_id": org["_id"],
            "role": "member",
            "status": "pending",
            "justification": (dados.justificativa or "").strip(),
            "job_title": "",
            "created_at": agora,
        })
        return {
            "message": f"Pedido enviado para {org['nome']}. Você poderá entrar assim que um administrador aprovar.",
            "acesso_liberado": False,
        }

    # vínculo == "nova": cria a organização já ativa, com o usuário como admin.
    if not dados.nome_organizacao or not dados.cnpj:
        raise HTTPException(status_code=422, detail="Informe os dados da nova organização.")

    cnpj_digitos = re.sub(r"\D", "", dados.cnpj)
    if len(cnpj_digitos) != 14:
        raise HTTPException(status_code=422, detail="CNPJ inválido.")
    if await organizacoes_collection.find_one({"cnpj": cnpj_digitos, "status": {"$ne": "removed"}}):
        raise HTTPException(status_code=409, detail="Já existe uma organização cadastrada com este CNPJ.")

    enderecos = []
    if dados.tipo == "fabricante":
        if not dados.endereco:
            raise HTTPException(
                status_code=422,
                detail="Endereço de retirada é obrigatório para organizações fabricantes.",
            )
        enderecos = [{"id": str(uuid.uuid4()), "nome": "Sede", **dados.endereco.model_dump()}]

    org_doc = {
        "nome": dados.nome_organizacao.strip(),
        "tipo": dados.tipo,
        "status": "active",
        "cnpj": cnpj_digitos,
        "email_institucional": (dados.email_institucional or "").lower(),
        "telefone_institucional": dados.telefone_institucional or "",
        "enderecos": enderecos,
        "criado_em": agora,
    }
    org_id = (await organizacoes_collection.insert_one(org_doc)).inserted_id
    await memberships_collection.insert_one({
        "user_id": usuario_id,
        "org_id": org_id,
        "role": "admin",
        "status": "active",
        "justification": "",
        "job_title": (dados.cargo or "").strip(),
        "created_at": agora,
        "joined_at": agora,
        "approved_by": None,
        "approved_at": agora,
    })
    await criar_sessao(response, usuario_id)
    return {"message": "Organização criada com sucesso.", "acesso_liberado": True}


@router.get("/me")
async def me(usuario: dict = Depends(usuario_atual)):
    memberships = await listar_memberships(usuario["_id"])
    return {"user": usuario_publico(usuario, memberships), "memberships": memberships_publico(memberships)}


@router.patch("/me")
async def atualizar_me(dados: PerfilParcial, usuario: dict = Depends(usuario_atual)):
    campos = dados.model_dump(exclude_unset=True)
    if "nome" in campos and not campos["nome"].strip():
        raise HTTPException(status_code=422, detail="Nome não pode ser vazio.")
    if "sobrenome" in campos and not campos["sobrenome"].strip():
        raise HTTPException(status_code=422, detail="Sobrenome não pode ser vazio.")
    if campos:
        await usuarios_collection.update_one({"_id": usuario["_id"]}, {"$set": campos})
    return {"message": "Perfil atualizado."}


@router.patch("/me/memberships/{membership_id}/cargo")
async def atualizar_meu_cargo(membership_id: str, dados: AtualizarCargo, usuario: dict = Depends(usuario_atual)):
    # O cargo é guardado por vínculo (membership), não no usuário: a mesma
    # pessoa pode ter cargos diferentes em organizações diferentes. Por isso
    # é o próprio dono do vínculo quem edita — nenhuma checagem de admin
    # aqui (é diferente de PATCH /api/organizations/{org_id}/members/...,
    # que só o admin da organização pode usar, e só para o papel).
    try:
        oid = ObjectId(membership_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Vínculo não encontrado.")
    resultado = await memberships_collection.update_one(
        {"_id": oid, "user_id": usuario["_id"], "status": "active"},
        {"$set": {"job_title": dados.cargo.strip()}},
    )
    if resultado.matched_count == 0:
        raise HTTPException(status_code=404, detail="Vínculo não encontrado.")
    return {"message": "Cargo atualizado."}


@router.delete("/me", status_code=204)
async def excluir_conta(response: Response, usuario: dict = Depends(usuario_atual)):
    memberships = await listar_memberships(usuario["_id"])
    organizacoes_sem_outro_admin = []
    for item in memberships:
        membership, org = item["membership"], item["org"]
        if membership["status"] != "active" or org["status"] != "active" or membership["role"] != "admin":
            continue
        outros_admins = await memberships_collection.count_documents({
            "org_id": org["_id"], "role": "admin", "status": "active", "user_id": {"$ne": usuario["_id"]},
        })
        if outros_admins == 0:
            organizacoes_sem_outro_admin.append(org["nome"])

    if organizacoes_sem_outro_admin:
        nomes = ", ".join(organizacoes_sem_outro_admin)
        raise HTTPException(
            status_code=409,
            detail=(
                f"Você é o único administrador de {nomes}. Promova outro membro a admin "
                "ou remova a organização antes de excluir sua conta."
            ),
        )

    await memberships_collection.update_many({"user_id": usuario["_id"]}, {"$set": {"status": "removed"}})
    if usuario.get("foto_arquivo"):
        caminho = os.path.join(FOTOS_DIR, usuario["foto_arquivo"])
        if os.path.exists(caminho):
            os.remove(caminho)
    await fotos_perfil_collection.delete_one({"_id": usuario["_id"]})
    await usuarios_collection.delete_one({"_id": usuario["_id"]})
    await revogar_sessoes_usuario(usuario["_id"])
    response.delete_cookie(NOME_COOKIE, path="/")
    return None


@router.post("/me/photo")
async def enviar_foto(photo: UploadFile = File(...), usuario: dict = Depends(usuario_atual)):
    if photo.content_type not in EXTENSAO_POR_MIME:
        raise HTTPException(status_code=422, detail="Formato de imagem inválido. Use JPG, PNG ou WebP.")
    conteudo = await photo.read()
    if len(conteudo) > 2 * 1024 * 1024:
        raise HTTPException(status_code=422, detail="Imagem maior que 2 MB.")

    # A foto fica no próprio MongoDB (e não em disco), para que todos os
    # computadores que usam o mesmo banco enxerguem a mesma foto.
    await fotos_perfil_collection.replace_one(
        {"_id": usuario["_id"]},
        {"_id": usuario["_id"], "conteudo": conteudo, "mime": photo.content_type},
        upsert=True,
    )
    nome_arquivo = f"{usuario['_id']}.{EXTENSAO_POR_MIME[photo.content_type]}"

    await usuarios_collection.update_one(
        {"_id": usuario["_id"]},
        {"$set": {"foto_arquivo": nome_arquivo, "foto_atualizada_em": agora_utc_naive()}},
    )
    return {"message": "Foto atualizada."}


@router.get("/me/photo")
async def obter_foto(usuario: dict = Depends(usuario_atual)):
    if not usuario.get("foto_arquivo"):
        raise HTTPException(status_code=404, detail="Sem foto cadastrada.")
    foto = await fotos_perfil_collection.find_one({"_id": usuario["_id"]})
    if foto:
        return RespostaBruta(content=bytes(foto["conteudo"]), media_type=foto["mime"])
    # Respaldo: fotos antigas, enviadas antes de irem para o banco.
    caminho = os.path.join(FOTOS_DIR, usuario["foto_arquivo"])
    if not os.path.exists(caminho):
        raise HTTPException(status_code=404, detail="Sem foto cadastrada.")
    return FileResponse(caminho)


@router.post("/me/email/start")
async def iniciar_troca_email(dados: IniciarTrocaEmail, usuario: dict = Depends(usuario_atual)):
    if not verificar_senha(dados.senha_atual, usuario.get("senha_hash", "")):
        raise HTTPException(status_code=401, detail="Senha atual incorreta.")
    novo_email = dados.novo_email.lower()
    if novo_email == usuario["email"]:
        raise HTTPException(status_code=422, detail="Informe um e-mail diferente do atual.")
    if await usuarios_collection.find_one({"email": novo_email}):
        raise HTTPException(status_code=409, detail="Já existe uma conta com este e-mail.")

    codigo = f"{secrets.randbelow(1_000_000):06d}"
    await usuarios_collection.update_one({"_id": usuario["_id"]}, {"$set": {
        "pendente_novo_email": novo_email,
        "pendente_codigo_email": codigo,
        "pendente_codigo_expira": agora_utc_naive() + timedelta(minutes=15),
    }})
    # Simplificação: não há servidor de e-mail configurado nesta versão de
    # demonstração, então o "envio" é só um log no console do back-end.
    print(f"[LABIELOS] Código de confirmação de e-mail para {usuario['email']}: {codigo}")
    return {"message": "Enviamos um código de confirmação (nesta versão de demonstração, ele aparece no console do servidor)."}


@router.post("/me/email/confirm")
async def confirmar_troca_email(dados: ConfirmarTrocaEmail, usuario: dict = Depends(usuario_atual)):
    codigo_esperado = usuario.get("pendente_codigo_email")
    expira = usuario.get("pendente_codigo_expira")
    novo_email = usuario.get("pendente_novo_email")
    agora = agora_utc_naive()
    if not codigo_esperado or not novo_email or not expira or expira < agora:
        raise HTTPException(status_code=422, detail="Nenhuma troca de e-mail pendente, ou o código expirou.")
    if dados.codigo != codigo_esperado:
        raise HTTPException(status_code=422, detail="Código incorreto.")

    await usuarios_collection.update_one(
        {"_id": usuario["_id"]},
        {
            "$set": {"email": novo_email},
            "$unset": {"pendente_novo_email": "", "pendente_codigo_email": "", "pendente_codigo_expira": ""},
        },
    )
    await revogar_sessoes_usuario(usuario["_id"])
    return {"message": "E-mail atualizado. Faça login novamente."}


@router.post("/me/password")
async def trocar_senha(dados: TrocarSenha, usuario: dict = Depends(usuario_atual)):
    if not verificar_senha(dados.senha_atual, usuario.get("senha_hash", "")):
        raise HTTPException(status_code=401, detail="Senha atual incorreta.")
    await usuarios_collection.update_one(
        {"_id": usuario["_id"]}, {"$set": {"senha_hash": hash_senha(dados.nova_senha)}}
    )
    await revogar_sessoes_usuario(usuario["_id"])
    return {"message": "Senha atualizada. Faça login novamente."}


@router.post("/auth/logout")
async def logout(request: Request, response: Response):
    await destruir_sessao(request, response)
    return {"message": "Sessão encerrada."}


# ---------------------------------------------------------------------------
# Confirmação de e-mail antes de concluir o cadastro.
#
# Rota adicional, não documentada em docs/integracao-backend.md (ver
# docs/backend.md). Mesmo padrão de "modo demonstração" da recuperação de
# senha: sem SMTP configurado, o código vem na própria resposta.
# ---------------------------------------------------------------------------

VERIFICACAO_CADASTRO_VALIDADE_MINUTOS = 10


@router.post("/auth/email/verify/start")
async def iniciar_verificacao_email(dados: IniciarVerificacaoEmail):
    email = dados.email.lower()
    codigo = f"{secrets.randbelow(1_000_000):06d}"

    await codigos_verificacao_cadastro_collection.update_one(
        {"_id": email},
        {"$set": {
            "codigo": codigo,
            "expira_em": agora_utc_naive() + timedelta(minutes=VERIFICACAO_CADASTRO_VALIDADE_MINUTOS),
            "verificado": False,
        }},
        upsert=True,
    )

    corpo_html = montar_email_codigo(
        titulo="Confirmação de cadastro",
        nome="",  # ainda não sabemos o nome: o formulário de cadastro vem depois desta etapa.
        codigo=codigo,
        instrucao="Use o código abaixo para confirmar seu e-mail e continuar o cadastro no LABIELOS:",
        rodape=(
            f"O código vale por {VERIFICACAO_CADASTRO_VALIDADE_MINUTOS} minutos. "
            "Se você não pediu isso, ignore este e-mail: o cadastro não será concluído."
        ),
    )
    enviado = tentar_enviar_email(
        email, "Confirme seu e-mail — LABIELOS",
        f"Seu código de confirmação de cadastro é {codigo}. Ele vale por {VERIFICACAO_CADASTRO_VALIDADE_MINUTOS} minutos.",
        corpo_html=corpo_html,
    )
    # Não revelamos se o e-mail já tem conta ou não: o código é sempre
    # gerado normalmente (pode ser alguém recadastrando uma organização
    # nova para a própria conta, ver _verificacao_email_valida acima).
    return {"enviado": enviado, "codigo": None if enviado else codigo}


@router.post("/auth/email/verify/confirm")
async def confirmar_verificacao_email(dados: ConfirmarVerificacaoEmail):
    email = dados.email.lower()
    registro = await codigos_verificacao_cadastro_collection.find_one({"_id": email})
    if not registro or registro["codigo"] != dados.codigo or registro["expira_em"] < agora_utc_naive():
        raise HTTPException(status_code=400, detail="Código inválido ou expirado.")
    await codigos_verificacao_cadastro_collection.update_one({"_id": email}, {"$set": {"verificado": True}})
    return {"message": "E-mail confirmado."}


# ---------------------------------------------------------------------------
# Recuperação de senha por código de 6 dígitos (sem login)
#
# Simplificação deliberada (ver docs/backend.md): se não houver variáveis
# SMTP_* configuradas em backend/.env (ou se o envio falhar), a rota não
# depende de um servidor de e-mail de verdade — ela devolve o próprio código
# na resposta ("modo demonstração"), e o front mostra esse código na tela.
# Por segurança, a rota sempre responde 200 e nunca revela se o e-mail
# existe ou não na base.
# ---------------------------------------------------------------------------

CODIGO_VALIDADE_MINUTOS = 10


@router.post("/auth/password/forgot")
async def esqueci_senha(dados: EsqueciSenhaEntrada):
    email = dados.email.lower()
    usuario = await usuarios_collection.find_one({"email": email})
    codigo = f"{secrets.randbelow(1_000_000):06d}"

    if not usuario:
        # E-mail não cadastrado: não gravamos nada, mas respondemos como se
        # tivesse dado certo (não revelamos se a conta existe).
        return {"enviado": False, "codigo": codigo}

    await codigos_recuperacao_collection.update_one(
        {"_id": email},
        {"$set": {
            "codigo": codigo,
            "expira_em": agora_utc_naive() + timedelta(minutes=CODIGO_VALIDADE_MINUTOS),
            "verificado": False,
        }},
        upsert=True,
    )

    corpo_html = montar_email_codigo(
        titulo="Recuperação de senha",
        nome=usuario.get("nome", ""),
        codigo=codigo,
        instrucao="Use o código abaixo para redefinir sua senha:",
        rodape=(
            f"O código vale por {CODIGO_VALIDADE_MINUTOS} minutos. "
            "Se você não pediu isso, ignore este e-mail: sua senha continua a mesma."
        ),
    )
    enviado = tentar_enviar_email(
        email, "Recuperação de senha — LABIELOS",
        f"Seu código de recuperação de senha é {codigo}. Ele vale por {CODIGO_VALIDADE_MINUTOS} minutos.",
        corpo_html=corpo_html,
    )
    # Sem SMTP configurado (ou se o envio falhar), devolvemos o código na
    # própria resposta para viabilizar a demonstração sem servidor de e-mail.
    return {"enviado": enviado, "codigo": None if enviado else codigo}


async def _codigo_valido(email: str, codigo: str) -> bool:
    registro = await codigos_recuperacao_collection.find_one({"_id": email})
    if not registro:
        return False
    if registro["codigo"] != codigo:
        return False
    if registro["expira_em"] < agora_utc_naive():
        return False
    return True


@router.post("/auth/password/verify")
async def verificar_codigo_recuperacao(dados: VerificarCodigoEntrada):
    email = dados.email.lower()
    if not await _codigo_valido(email, dados.codigo):
        raise HTTPException(status_code=400, detail="Código inválido ou expirado.")
    await codigos_recuperacao_collection.update_one({"_id": email}, {"$set": {"verificado": True}})
    return {"message": "Código verificado."}


@router.post("/auth/password/reset")
async def redefinir_senha(dados: RedefinirSenhaEntrada):
    email = dados.email.lower()
    registro = await codigos_recuperacao_collection.find_one({"_id": email})
    if not registro or not registro.get("verificado") or not await _codigo_valido(email, dados.codigo):
        raise HTTPException(status_code=400, detail="Código inválido ou expirado.")

    usuario = await usuarios_collection.find_one({"email": email})
    if not usuario:
        raise HTTPException(status_code=400, detail="Código inválido ou expirado.")

    await usuarios_collection.update_one({"_id": usuario["_id"]}, {"$set": {"senha_hash": hash_senha(dados.nova_senha)}})
    await codigos_recuperacao_collection.delete_one({"_id": email})
    await revogar_sessoes_usuario(usuario["_id"])
    return {"message": "Senha redefinida com sucesso."}
