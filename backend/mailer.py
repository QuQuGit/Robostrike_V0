"""Transactional emails (account confirmation, password reset) via the Resend API."""
import logging
import os
from html import escape

import httpx

logger = logging.getLogger("robostrike.mail")

RESEND_URL = "https://api.resend.com/emails"

TEXTS = {
    "fr": {
        "verify_subject": "Confirmez votre compte Robostrike",
        "verify_title": "Bienvenue {name} !",
        "verify_body": "Cliquez sur le bouton ci-dessous pour confirmer votre adresse email et activer votre compte. Le lien est valable 24 heures.",
        "verify_cta": "Confirmer mon email",
        "reset_subject": "Réinitialisation de votre mot de passe Robostrike",
        "reset_title": "Bonjour {name},",
        "reset_body": "Vous avez demandé à changer votre mot de passe. Cliquez sur le bouton ci-dessous pour en choisir un nouveau. Le lien est valable 1 heure. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.",
        "reset_cta": "Choisir un nouveau mot de passe",
        "footer": "Email envoyé par Robostrike. Nous ne vous demanderons jamais votre mot de passe par email.",
    },
    "en": {
        "verify_subject": "Confirm your Robostrike account",
        "verify_title": "Welcome {name}!",
        "verify_body": "Click the button below to confirm your email address and activate your account. The link is valid for 24 hours.",
        "verify_cta": "Confirm my email",
        "reset_subject": "Reset your Robostrike password",
        "reset_title": "Hello {name},",
        "reset_body": "You asked to change your password. Click the button below to choose a new one. The link is valid for 1 hour. If you did not request this, just ignore this email.",
        "reset_cta": "Choose a new password",
        "footer": "Sent by Robostrike. We will never ask for your password by email.",
    },
    "es": {
        "verify_subject": "Confirma tu cuenta de Robostrike",
        "verify_title": "¡Bienvenido {name}!",
        "verify_body": "Haz clic en el botón de abajo para confirmar tu correo y activar tu cuenta. El enlace es válido durante 24 horas.",
        "verify_cta": "Confirmar mi correo",
        "reset_subject": "Restablece tu contraseña de Robostrike",
        "reset_title": "Hola {name}:",
        "reset_body": "Has pedido cambiar tu contraseña. Haz clic en el botón de abajo para elegir una nueva. El enlace es válido durante 1 hora. Si no lo has pedido tú, ignora este correo.",
        "reset_cta": "Elegir una nueva contraseña",
        "footer": "Enviado por Robostrike. Nunca te pediremos tu contraseña por correo.",
    },
}


def _html(title, body, cta, link, footer):
    return (
        '<table role="presentation" width="100%" style="background:#0b0b0d;padding:24px 0">'
        '<tr><td align="center"><table role="presentation" width="480" style="background:#1d1e22;border:1px solid #33353a;'
        'border-radius:8px;font-family:Arial,sans-serif;color:#e4e4e7">'
        '<tr><td style="padding:20px 24px;font-size:22px;font-weight:bold;color:#ff9a1f;letter-spacing:2px">ROBOSTRIKE</td></tr>'
        f'<tr><td style="padding:0 24px 8px;font-size:16px;font-weight:bold">{escape(title)}</td></tr>'
        f'<tr><td style="padding:0 24px 20px;font-size:14px;line-height:1.5;color:#c4c4cc">{escape(body)}</td></tr>'
        f'<tr><td style="padding:0 24px 24px"><a href="{escape(link, quote=True)}" style="display:inline-block;background:#ff8a00;'
        f'color:#1a0c00;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:6px">{escape(cta)}</a></td></tr>'
        f'<tr><td style="padding:12px 24px;font-size:11px;color:#71717a;border-top:1px solid #33353a">{escape(footer)}</td></tr>'
        "</table></td></tr></table>"
    )


async def _send(to: str, subject: str, html: str, link: str):
    key = os.environ.get("RESEND_API_KEY")
    if not key:
        # local/dev without Resend: the link is only written to the server log
        logger.warning("RESEND_API_KEY not set, email to %s not sent. Link: %s", to, link)
        return
    payload = {"from": os.environ["EMAIL_FROM"], "to": [to], "subject": subject, "html": html}
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.post(RESEND_URL, headers={"Authorization": f"Bearer {key}"}, json=payload)
        if r.status_code >= 300:
            logger.error("Resend error %s: %s", r.status_code, r.text)
    except httpx.HTTPError as e:
        logger.error("Resend request failed: %s", e)


def _lang(lang):
    return lang if lang in TEXTS else "fr"


async def send_verification(to, name, lang, token):
    tx = TEXTS[_lang(lang)]
    link = f"{os.environ['FRONTEND_URL'].rstrip('/')}/verify-email?token={token}"
    html = _html(tx["verify_title"].format(name=name), tx["verify_body"], tx["verify_cta"], link, tx["footer"])
    await _send(to, tx["verify_subject"], html, link)


async def send_reset(to, name, lang, token):
    tx = TEXTS[_lang(lang)]
    link = f"{os.environ['FRONTEND_URL'].rstrip('/')}/reset-password?token={token}"
    html = _html(tx["reset_title"].format(name=name), tx["reset_body"], tx["reset_cta"], link, tx["footer"])
    await _send(to, tx["reset_subject"], html, link)
