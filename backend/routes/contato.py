"""Formulário de contato do site público: repassa a mensagem por e-mail
para a equipe do LABIELOS."""
import html
import os
import re

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from email_util import tentar_enviar_email

router = APIRouter(prefix="/api", tags=["Contato"])

EMAIL_VALIDO = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class ContatoEntrada(BaseModel):
    primeiroNome: str = Field(min_length=1, max_length=80)
    segundoNome: str = Field(min_length=1, max_length=80)
    email: str = Field(max_length=200)
    assunto: str = Field(min_length=1, max_length=150)
    mensagem: str = Field(min_length=1, max_length=5000)


@router.post("/contato")
async def enviar_contato(dados: ContatoEntrada):
    if not EMAIL_VALIDO.match(dados.email.strip()):
        raise HTTPException(status_code=422, detail="Informe um e-mail válido.")

    # Para onde vão as mensagens: CONTATO_EMAIL no .env, ou o próprio
    # remetente do sistema se ela não estiver definida.
    destino = os.getenv("CONTATO_EMAIL") or os.getenv("SMTP_FROM") or os.getenv("SMTP_USER")
    if not destino:
        raise HTTPException(status_code=503, detail="O envio de mensagens não está configurado.")

    nome = f"{dados.primeiroNome.strip()} {dados.segundoNome.strip()}"
    email = dados.email.strip()
    corpo = (
        "Nova mensagem pelo formulário de contato do LABIELOS\n\n"
        f"Nome: {nome}\nE-mail: {email}\nAssunto: {dados.assunto}\n\n{dados.mensagem}"
    )
    e = html.escape
    corpo_html = f"""<div style="font-family:Arial,sans-serif;color:#1c2430;max-width:600px">
<h2 style="color:#0B2740">Nova mensagem de contato</h2>
<p><b>Nome:</b> {e(nome)}<br><b>E-mail:</b> <a href="mailto:{e(email)}">{e(email)}</a><br><b>Assunto:</b> {e(dados.assunto)}</p>
<div style="white-space:pre-wrap;border-left:3px solid #0B2740;padding:8px 12px;background:#f5f7fa">{e(dados.mensagem)}</div>
<p style="color:#5b6472;font-size:12px">Responda este e-mail para falar direto com {e(nome)}.</p></div>"""

    enviado = tentar_enviar_email(
        destino, f"[Contato LABIELOS] {dados.assunto}", corpo, corpo_html, responder_para=email
    )
    if not enviado:
        raise HTTPException(status_code=502, detail="Não foi possível enviar sua mensagem agora. Tente novamente mais tarde.")
    return {"message": "Mensagem enviada! Responderemos no seu e-mail em breve."}
