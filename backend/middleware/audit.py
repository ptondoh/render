"""
Middleware d'audit pour SAP.
Enregistre les actions des utilisateurs dans la base de données.
"""

from datetime import datetime
from typing import Optional
import logging

from backend.database import get_collection
from backend.models import UserInDB

logger = logging.getLogger(__name__)


async def log_action(
    user_id: str,
    action: str,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    details: Optional[dict] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None
) -> None:
    """
    Enregistrer une action utilisateur dans les logs d'audit.

    Args:
        user_id: ID de l'utilisateur qui effectue l'action
        action: Type d'action (ex: "login", "create_user", "submit_collecte")
        resource_type: Type de ressource affectée (ex: "user", "collecte", "produit")
        resource_id: ID de la ressource affectée
        details: Détails supplémentaires de l'action (dict)
        ip_address: Adresse IP de l'utilisateur
        user_agent: User agent du navigateur
    """
    try:
        audit_collection = get_collection("audit_logs")

        audit_log = {
            "user_id": user_id,
            "action": action,
            "resource_type": resource_type,
            "resource_id": resource_id,
            "details": details or {},
            "ip_address": ip_address,
            "user_agent": user_agent,
            "timestamp": datetime.utcnow(),
            "success": True
        }

        await audit_collection.insert_one(audit_log)

        logger.info(
            f"Audit: user={user_id} action={action} "
            f"resource={resource_type}:{resource_id}"
        )

    except Exception as e:
        logger.error(f"Erreur lors de l'enregistrement de l'audit: {e}")
        # Ne pas lever d'exception pour ne pas bloquer l'action principale


async def log_failed_action(
    user_id: Optional[str],
    action: str,
    reason: str,
    details: Optional[dict] = None,
    ip_address: Optional[str] = None
) -> None:
    """
    Enregistrer une action échouée dans les logs d'audit.

    Args:
        user_id: ID de l'utilisateur (None si pas encore authentifié)
        action: Type d'action tentée
        reason: Raison de l'échec
        details: Détails supplémentaires
        ip_address: Adresse IP de l'utilisateur
    """
    try:
        audit_collection = get_collection("audit_logs")

        audit_log = {
            "user_id": user_id,
            "action": action,
            "reason": reason,
            "details": details or {},
            "ip_address": ip_address,
            "timestamp": datetime.utcnow(),
            "success": False
        }

        await audit_collection.insert_one(audit_log)

        logger.warning(
            f"Audit échec: user={user_id} action={action} reason={reason}"
        )

    except Exception as e:
        logger.error(f"Erreur lors de l'enregistrement de l'audit échec: {e}")


async def log_auth_attempt(
    email: str,
    success: bool,
    ip_address: Optional[str] = None,
    reason: Optional[str] = None
) -> None:
    """
    Enregistrer une tentative d'authentification.

    Args:
        email: Email de l'utilisateur
        success: True si authentification réussie
        ip_address: Adresse IP
        reason: Raison de l'échec si applicable
    """
    try:
        audit_collection = get_collection("audit_logs")

        audit_log = {
            "email": email,
            "action": "login_attempt",
            "success": success,
            "reason": reason,
            "ip_address": ip_address,
            "timestamp": datetime.utcnow()
        }

        await audit_collection.insert_one(audit_log)

        if success:
            logger.info(f"Login réussi: {email} from {ip_address}")
        else:
            logger.warning(f"Login échoué: {email} from {ip_address} - {reason}")

    except Exception as e:
        logger.error(f"Erreur lors de l'enregistrement de la tentative d'auth: {e}")


async def log_mfa_setup(user_id: str, ip_address: Optional[str] = None) -> None:
    """
    Enregistrer l'activation du MFA.

    Args:
        user_id: ID de l'utilisateur
        ip_address: Adresse IP
    """
    await log_action(
        user_id=user_id,
        action="mfa_setup",
        details={"mfa_enabled": True},
        ip_address=ip_address
    )


async def log_mfa_verification(
    user_id: str,
    success: bool,
    method: str = "totp",
    ip_address: Optional[str] = None
) -> None:
    """
    Enregistrer une vérification MFA.

    Args:
        user_id: ID de l'utilisateur
        success: True si vérification réussie
        method: Méthode utilisée ("totp" ou "backup_code")
        ip_address: Adresse IP
    """
    if success:
        await log_action(
            user_id=user_id,
            action="mfa_verified",
            details={"method": method},
            ip_address=ip_address
        )
    else:
        await log_failed_action(
            user_id=user_id,
            action="mfa_verification",
            reason=f"Code {method} invalide",
            ip_address=ip_address
        )


# ============================================================================
# Helpers pour extraire les informations de la requête
# ============================================================================

def get_client_ip(request) -> Optional[str]:
    """
    Extraire l'adresse IP du client depuis la requête.

    Args:
        request: Objet Request FastAPI

    Returns:
        Adresse IP du client
    """
    # Vérifier d'abord les headers de proxy
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()

    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip

    # Sinon utiliser l'adresse directe
    if request.client:
        return request.client.host

    return None


def get_user_agent(request) -> Optional[str]:
    """
    Extraire le user agent depuis la requête.

    Args:
        request: Objet Request FastAPI

    Returns:
        User agent du client
    """
    return request.headers.get("User-Agent")
