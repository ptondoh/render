"""
Middleware de sécurité pour SAP.
Gère l'authentification JWT et la protection des routes.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional

from backend.services.auth import decode_token
from backend.database import get_collection
from backend.models import UserInDB

# Schéma de sécurité HTTP Bearer pour Swagger UI
security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> UserInDB:
    """
    Dépendance FastAPI pour obtenir l'utilisateur authentifié actuel.

    Args:
        credentials: Credentials HTTP Bearer (token JWT)

    Returns:
        Utilisateur authentifié

    Raises:
        HTTPException: Si le token est invalide ou l'utilisateur n'existe pas
    """
    # Extraire le token
    token = credentials.credentials

    # Décoder le token
    payload = decode_token(token)

    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalide ou expiré",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Vérifier le type de token
    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Type de token invalide",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Extraire l'ID utilisateur
    user_id: Optional[str] = payload.get("sub")

    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalide",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Récupérer l'utilisateur de la base de données
    users_collection = get_collection("users")
    user_doc = await users_collection.find_one({"_id": user_id})

    if user_doc is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Utilisateur non trouvé",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Convertir en modèle Pydantic
    # Convertir ObjectId en string pour Pydantic
    user_doc["_id"] = str(user_doc["_id"])
    user = UserInDB(**user_doc)

    # Vérifier que l'utilisateur est actif
    if not user.actif:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Compte désactivé"
        )

    return user


async def get_current_active_user(
    current_user: UserInDB = Depends(get_current_user)
) -> UserInDB:
    """
    Dépendance pour obtenir l'utilisateur actif (alias de get_current_user).
    Utile pour clarifier l'intention dans les endpoints.

    Args:
        current_user: Utilisateur authentifié

    Returns:
        Utilisateur actif
    """
    return current_user


def get_optional_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(
        HTTPBearer(auto_error=False)
    )
) -> Optional[UserInDB]:
    """
    Dépendance pour obtenir l'utilisateur actuel si authentifié.
    Ne lève pas d'exception si pas de token (pour routes publiques optionnelles).

    Args:
        credentials: Credentials HTTP Bearer optionnels

    Returns:
        Utilisateur si authentifié, None sinon
    """
    if credentials is None:
        return None

    try:
        token = credentials.credentials
        payload = decode_token(token)

        if payload is None or payload.get("type") != "access":
            return None

        user_id = payload.get("sub")
        if user_id is None:
            return None

        # Récupération synchrone simplifiée
        # En production, utiliser une version async complète
        return None  # Pour l'instant, retourner None

    except Exception:
        return None
