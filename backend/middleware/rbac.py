"""
Middleware RBAC (Role-Based Access Control) pour SAP.
Gère les permissions basées sur les rôles des utilisateurs.
"""

from fastapi import Depends, HTTPException, status
from typing import List

from backend.middleware.security import get_current_user
from backend.models import UserInDB


class RoleChecker:
    """
    Classe pour vérifier les rôles des utilisateurs.
    Utilisable comme dépendance FastAPI.
    """

    def __init__(self, allowed_roles: List[str]):
        """
        Initialiser le vérificateur de rôles.

        Args:
            allowed_roles: Liste des rôles autorisés pour accéder à la route
        """
        self.allowed_roles = allowed_roles

    def __call__(self, user: UserInDB = Depends(get_current_user)) -> UserInDB:
        """
        Vérifier que l'utilisateur a au moins un rôle autorisé.

        Args:
            user: Utilisateur authentifié

        Returns:
            Utilisateur si au moins un de ses rôles est autorisé

        Raises:
            HTTPException: Si l'utilisateur n'a aucun des rôles requis
        """
        # Vérifier si l'utilisateur a au moins un des rôles autorisés
        if not any(role in self.allowed_roles for role in user.roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Accès refusé. Rôle requis: {', '.join(self.allowed_roles)}"
            )

        return user


# ============================================================================
# Dépendances préconfigurées pour les rôles communs
# ============================================================================

def require_agent(user: UserInDB = Depends(get_current_user)) -> UserInDB:
    """
    Dépendance qui requiert le rôle 'agent'.

    Args:
        user: Utilisateur authentifié

    Returns:
        Utilisateur si a le rôle agent

    Raises:
        HTTPException: Si n'a pas le rôle agent
    """
    if "agent" not in user.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé aux agents"
        )
    return user


def require_decideur(user: UserInDB = Depends(get_current_user)) -> UserInDB:
    """
    Dépendance qui requiert le rôle 'décideur'.

    Args:
        user: Utilisateur authentifié

    Returns:
        Utilisateur si a le rôle décideur

    Raises:
        HTTPException: Si n'a pas le rôle décideur
    """
    if "décideur" not in user.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé aux décideurs"
        )
    return user


def require_bailleur(user: UserInDB = Depends(get_current_user)) -> UserInDB:
    """
    Dépendance qui requiert le rôle 'bailleur'.

    Args:
        user: Utilisateur authentifié

    Returns:
        Utilisateur si a le rôle bailleur

    Raises:
        HTTPException: Si n'a pas le rôle bailleur
    """
    if "bailleur" not in user.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé aux bailleurs"
        )
    return user


def require_decideur_or_bailleur(
    user: UserInDB = Depends(get_current_user)
) -> UserInDB:
    """
    Dépendance qui requiert le rôle 'décideur' ou 'bailleur'.
    Utile pour les fonctionnalités de consultation des données.

    Args:
        user: Utilisateur authentifié

    Returns:
        Utilisateur si a le rôle décideur ou bailleur

    Raises:
        HTTPException: Si n'a aucun de ces rôles
    """
    if not any(role in user.roles for role in ["décideur", "bailleur"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé aux décideurs et bailleurs"
        )
    return user


# ============================================================================
# Helpers pour vérification de permissions spécifiques
# ============================================================================

def can_create_users(user: UserInDB) -> bool:
    """
    Vérifier si l'utilisateur peut créer d'autres utilisateurs.
    Seuls les décideurs peuvent créer des utilisateurs.

    Args:
        user: Utilisateur à vérifier

    Returns:
        True si l'utilisateur peut créer des utilisateurs
    """
    return "décideur" in user.roles


def can_validate_collectes(user: UserInDB) -> bool:
    """
    Vérifier si l'utilisateur peut valider des collectes de prix.
    Seuls les décideurs peuvent valider.

    Args:
        user: Utilisateur à vérifier

    Returns:
        True si l'utilisateur peut valider des collectes
    """
    return "décideur" in user.roles


def can_submit_collectes(user: UserInDB) -> bool:
    """
    Vérifier si l'utilisateur peut soumettre des collectes de prix.
    Seuls les agents peuvent soumettre.

    Args:
        user: Utilisateur à vérifier

    Returns:
        True si l'utilisateur peut soumettre des collectes
    """
    return "agent" in user.roles


def can_view_all_data(user: UserInDB) -> bool:
    """
    Vérifier si l'utilisateur peut voir toutes les données.
    Les décideurs et bailleurs peuvent voir toutes les données.

    Args:
        user: Utilisateur à vérifier

    Returns:
        True si l'utilisateur peut voir toutes les données
    """
    return any(role in user.roles for role in ["décideur", "bailleur"])


def require_role(allowed_roles: List[str]):
    """
    Factory function pour créer une dépendance qui vérifie les rôles.

    Args:
        allowed_roles: Liste des rôles autorisés

    Returns:
        RoleChecker configuré avec les rôles autorisés

    Usage:
        @router.get("/endpoint", dependencies=[Depends(require_role(["décideur"]))])
        or
        @router.get("/endpoint")
        async def endpoint(user: dict = Depends(require_role(["décideur"]))):
    """
    return RoleChecker(allowed_roles)
