"""
Service d'envoi d'emails.
Mode développement : affiche le code OTP dans les logs console (print).
En production : remplacer l'implémentation par SendGrid, SMTP, etc.
"""

import logging
from datetime import datetime

logger = logging.getLogger("sap.email")


async def send_otp_email(to_email: str, otp_code: str) -> None:
    """
    Envoie un code OTP de vérification par email.

    Mode développement — le code est affiché dans la console du serveur.
    L'administrateur doit transmettre le code à l'utilisateur via un autre canal.

    En production, remplacer cette implémentation par un vrai envoi d'email.
    """
    timestamp = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')

    logger.info("OTP email sent (dev mode): to=%s code=%s", to_email, otp_code)

    # Affichage console lisible pour le développement
    print(f"""
{'=' * 52}
[CODE OTP] Destinataire : {to_email}
[CODE OTP] Code         : {otp_code}
[CODE OTP] Expire dans  : 10 minutes
[CODE OTP] Horodatage   : {timestamp}
{'=' * 52}
""")
