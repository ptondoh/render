"""
Middleware RBAC (Role-Based Access Control) pour SAP.
Gère les permissions basées sur les rôles des utilisateurs.
Support système de permissions dynamiques depuis MongoDB.
"""

from fastapi import Depends, HTTPException, status
from typing import List, Set
from bson import ObjectId

from backend.middleware.security import get_current_user
from backend.models import UserInDB
from backend.database import get_database


# ============================================================================
# Système de Permissions Dynamiques
# ============================================================================

async def get_user_permissions(user: UserInDB) -> Set[str]:
    """
    Charge toutes les permissions d'un utilisateur depuis la BDD.

    Args:
        user: Utilisateur authentifié

    Returns:
        Set de noms de permissions (ex: {"collectes:read", "marches:create"})

    Note:
        Cache les permissions pour éviter les requêtes répétées.
        Les permissions sont chargées depuis: user.roles -> roles.id_permissions -> permissions.nom
    """
    db = get_database()
    permissions_set = set()

    # Si l'utilisateur n'a pas de rôles, retourner vide
    if not user.roles:
        return permissions_set

    # Convertir les role IDs en ObjectId (supporter à la fois ancien et nouveau format)
    role_ids = []
    for role in user.roles:
        if isinstance(role, str):
            # Nouveau format (ObjectId string) ou ancien format (nom de rôle)
            if ObjectId.is_valid(role):
                role_ids.append(ObjectId(role))
            else:
                # Ancien format : chercher le rôle par nom
                legacy_role = await db.roles.find_one({"nom": role})
                if legacy_role:
                    role_ids.append(legacy_role["_id"])
        elif isinstance(role, ObjectId):
            role_ids.append(role)

    if not role_ids:
        return permissions_set

    # Charger les rôles de l'utilisateur
    roles = await db.roles.find({"_id": {"$in": role_ids}}).to_list(None)

    # Collecter tous les IDs de permissions
    permission_ids = []
    for role in roles:
        if "id_permissions" in role:
            for perm_id in role["id_permissions"]:
                if isinstance(perm_id, str) and ObjectId.is_valid(perm_id):
                    permission_ids.append(ObjectId(perm_id))
                elif isinstance(perm_id, ObjectId):
                    permission_ids.append(perm_id)

    if not permission_ids:
        return permissions_set

    # Charger les permissions
    permissions = await db.permissions.find({"_id": {"$in": permission_ids}}).to_list(None)

    # Extraire les noms de permissions
    for perm in permissions:
        if "nom" in perm:
            permissions_set.add(perm["nom"])

    return permissions_set


class PermissionChecker:
    """
    Classe pour vérifier les permissions des utilisateurs.
    Utilisable comme dépendance FastAPI.
    Charge dynamiquement les permissions depuis MongoDB.
    """

    def __init__(self, required_permissions: List[str]):
        """
        Initialiser le vérificateur de permissions.

        Args:
            required_permissions: Liste des permissions requises (ex: ["collectes:create"])
        """
        self.required_permissions = required_permissions

    async def __call__(self, user: UserInDB = Depends(get_current_user)) -> UserInDB:
        """
        Vérifier que l'utilisateur a toutes les permissions requises.

        Args:
            user: Utilisateur authentifié

        Returns:
            Utilisateur si a toutes les permissions

        Raises:
            HTTPException: Si l'utilisateur n'a pas les permissions requises
        """
        # Charger les permissions de l'utilisateur
        user_permissions = await get_user_permissions(user)

        # Vérifier si l'utilisateur a toutes les permissions requises
        missing_permissions = set(self.required_permissions) - user_permissions

        if missing_permissions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permissions manquantes: {', '.join(missing_permissions)}"
            )

        return user


def require_permission(permission: str):
    """
    Factory function pour créer une dépendance qui vérifie UNE permission.

    Args:
        permission: Nom de la permission requise (ex: "collectes:create")

    Returns:
        PermissionChecker configuré avec la permission

    Usage:
        @router.post("/collectes")
        async def create_collecte(user: UserInDB = Depends(require_permission("collectes:create"))):
            ...
    """
    return PermissionChecker([permission])


def require_permissions(permissions: List[str]):
    """
    Factory function pour créer une dépendance qui vérifie PLUSIEURS permissions.
    L'utilisateur doit avoir TOUTES les permissions listées.

    Args:
        permissions: Liste des permissions requises (ex: ["collectes:read", "marches:read"])

    Returns:
        PermissionChecker configuré avec les permissions

    Usage:
        @router.get("/analytics")
        async def analytics(user: UserInDB = Depends(require_permissions(["collectes:read", "analyse:vue-nationale"]))):
            ...
    """
    return PermissionChecker(permissions)


async def has_permission(user: UserInDB, permission: str) -> bool:
    """
    Helper pour vérifier si un utilisateur a une permission spécifique.
    Utile pour les vérifications conditionnelles dans le code.

    Args:
        user: Utilisateur à vérifier
        permission: Nom de la permission (ex: "collectes:delete")

    Returns:
        True si l'utilisateur a la permission

    Usage:
        if await has_permission(user, "collectes:delete"):
            # Allow delete
    """
    user_permissions = await get_user_permissions(user)
    return permission in user_permissions


async def has_any_permission(user: UserInDB, permissions: List[str]) -> bool:
    """
    Vérifier si l'utilisateur a AU MOINS UNE des permissions listées.

    Args:
        user: Utilisateur à vérifier
        permissions: Liste de permissions

    Returns:
        True si l'utilisateur a au moins une des permissions
    """
    user_permissions = await get_user_permissions(user)
    return any(perm in user_permissions for perm in permissions)


async def has_all_permissions(user: UserInDB, permissions: List[str]) -> bool:
    """
    Vérifier si l'utilisateur a TOUTES les permissions listées.

    Args:
        user: Utilisateur à vérifier
        permissions: Liste de permissions

    Returns:
        True si l'utilisateur a toutes les permissions
    """
    user_permissions = await get_user_permissions(user)
    return all(perm in user_permissions for perm in permissions)


# ============================================================================
# Système Legacy - Vérification par Nom de Rôle (Deprecated)
# ============================================================================
# Ces fonctions sont conservées pour compatibilité avec le code existant.
# Elles seront progressivement remplacées par le système de permissions.
# ============================================================================

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
        # Utiliser role_names (noms résolus) si disponibles, sinon roles (ancien format)
        effective_roles = user.role_names if user.role_names else user.roles
        if not any(role in self.allowed_roles for role in effective_roles):
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
    effective_roles = user.role_names if user.role_names else user.roles
    if "agent" not in effective_roles:
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
    effective_roles = user.role_names if user.role_names else user.roles
    if "décideur" not in effective_roles:
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
    effective_roles = user.role_names if user.role_names else user.roles
    if "bailleur" not in effective_roles:
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
    effective_roles = user.role_names if user.role_names else user.roles
    if not any(role in effective_roles for role in ["décideur", "bailleur"]):
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
