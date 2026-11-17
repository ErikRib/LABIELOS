"""Envio de e-mail opcional, usado pela recuperação de senha e pela
confirmação de e-mail do cadastro.

Sem nenhuma variável SMTP_* configurada em backend/.env, `tentar_enviar_email`
simplesmente não tenta enviar e devolve False — o chamador então decide o
que fazer (nesses dois casos, mostrar o código na resposta em vez de confiar
no e-mail). Isso é uma simplificação deliberada para a demonstração: ver
docs/backend.md."""
import html
import os
import smtplib
from email.message import EmailMessage

COR_PRIMARIA = "#0B2740"
COR_TEXTO_CLARO = "#ffffff"
COR_TEXTO_SECUNDARIO = "#5b6472"
COR_BORDA = "#e2e5ea"


def smtp_configurado() -> bool:
    return bool(os.getenv("SMTP_HOST") or os.getenv("BREVO_API_KEY"))


def _enviar_via_brevo(destinatario: str, assunto: str, corpo: str, corpo_html: str | None, responder_para: str | None = None) -> None:
    """Envio pela API HTTPS da Brevo (porta 443). Útil em redes/máquinas que
    bloqueiam SMTP (portas 587/465)."""
    import json
    import urllib.request

    remetente = os.getenv("SMTP_FROM") or os.getenv("SMTP_USER") or "no-reply@labielos.local"
    dados = {
        "sender": {"name": "LABIELOS", "email": remetente},
        "to": [{"email": destinatario}],
        "subject": assunto,
        "textContent": corpo,
    }
    if corpo_html:
        dados["htmlContent"] = corpo_html
    if responder_para:
        dados["replyTo"] = {"email": responder_para}
    requisicao = urllib.request.Request(
        "https://api.brevo.com/v3/smtp/email",
        data=json.dumps(dados).encode("utf-8"),
        headers={"api-key": os.environ["BREVO_API_KEY"], "Content-Type": "application/json", "Accept": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(requisicao, timeout=10):
        pass


def montar_email_codigo(titulo: str, nome: str, codigo: str, instrucao: str, rodape: str) -> str:
    """Monta o HTML de um e-mail com um código de 6 dígitos em destaque
    (recuperação de senha, confirmação de cadastro). Usa só CSS inline,
    porque e-mail HTML não roda <style> externo nem variáveis CSS — as
    cores abaixo são as mesmas de --cor-primaria etc. em css/style.css,
    copiadas aqui como valor fixo."""
    codigo_espacado = codigo  # sem espaços: assim copiar e colar o código funciona
    saudacao = f"Olá, {html.escape(nome)}!" if nome else "Olá!"
    return f"""\
<!DOCTYPE html>
<html lang="pt-BR">
<body style="margin:0; padding:0; background-color:#f4f5f7; font-family:Arial, Helvetica, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7; padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:480px; background-color:#ffffff; border-radius:12px; overflow:hidden; border:1px solid {COR_BORDA};">
          <tr>
            <td style="padding:28px 32px 8px;">
              <p style="margin:0; color:{COR_PRIMARIA}; font-size:12px; font-weight:bold; letter-spacing:1.5px; text-transform:uppercase;">
                LABIELOS &middot; {html.escape(titulo.upper())}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 0;">
              <p style="margin:0 0 12px; color:#111827; font-size:20px; font-weight:bold;">{saudacao}</p>
              <p style="margin:0 0 20px; color:{COR_TEXTO_SECUNDARIO}; font-size:15px; line-height:1.5;">{html.escape(instrucao)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="background-color:{COR_PRIMARIA}; border-radius:10px; padding:20px;">
                    <span style="color:{COR_TEXTO_CLARO}; font-size:32px; font-weight:bold; letter-spacing:14px; font-family:'Courier New', monospace;">
                      {codigo_espacado}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 28px;">
              <p style="margin:0; color:{COR_TEXTO_SECUNDARIO}; font-size:13px; line-height:1.5;">{html.escape(rodape)}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""


def tentar_enviar_email(
    destinatario: str, assunto: str, corpo: str, corpo_html: str | None = None, responder_para: str | None = None
) -> bool:
    if not smtp_configurado():
        return False
    try:
        if os.getenv("BREVO_API_KEY"):
            _enviar_via_brevo(destinatario, assunto, corpo, corpo_html, responder_para)
            return True
        host = os.environ["SMTP_HOST"]
        porta = int(os.getenv("SMTP_PORT", "587"))
        usuario = os.getenv("SMTP_USER")
        senha = os.getenv("SMTP_PASSWORD")
        remetente = os.getenv("SMTP_FROM", usuario or "no-reply@labielos.local")

        mensagem = EmailMessage()
        mensagem["Subject"] = assunto
        mensagem["From"] = remetente
        mensagem["To"] = destinatario
        if responder_para:
            mensagem["Reply-To"] = responder_para
        # multipart/alternative: clientes que não mostram HTML (raros hoje em
        # dia) caem para este texto simples automaticamente.
        mensagem.set_content(corpo)
        if corpo_html:
            mensagem.add_alternative(corpo_html, subtype="html")

        with smtplib.SMTP(host, porta, timeout=10) as servidor:
            servidor.starttls()
            if usuario and senha:
                servidor.login(usuario, senha)
            servidor.send_message(mensagem)
        return True
    except Exception as erro:  # qualquer falha de SMTP cai no modo demonstração
        print(f"[LABIELOS] Falha ao enviar e-mail para {destinatario}: {erro}")
        return False
