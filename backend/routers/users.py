"""
Router pour la gestion des utilisateurs (User Management).
Endpoints CRUD pour les administrateurs (rôle bailleur uniquement).
"""

from fastapi import APIRouter, Depends, HTTPException, status
from typing import Optional, List
from datetime import datetime
import secrets

from bson import ObjectId

from backend.database import get_database
from backend.models import (
    UserCreate,
    UserUpdate,
    UserResponse,
    UserListResponse,
    PasswordResetResponse,
    MessageResponse
)
from backend.middleware.security import get_current_user
from backend.middleware.rbac import require_bailleur, require_permission
from backend.middleware.audit import log_action
from backend.services.auth import hash_password

router = APIRouter(prefix="/api", tags=["Users Management"])


# ============================================================================
# Helper Functions
# ============================================================================

async def enrich_user_with_department(db, user_doc: dict) -> dict:
    """
    Enrichir un document utilisateur avec le nom du département.

    Args:
        db: Instance de la base de données
        user_doc: Document utilisateur depuis MongoDB

    Returns:
        Document enrichi avec departement_nom
    """
    departement_nom = None
    if user_doc.get("departement_id"):
        try:
            dept = await db.departements.find_one({"_id": ObjectId(user_doc["departement_id"])})
            if dept:
                departement_nom = dept.get("nom")
        except Exception:
            pass  # Si ObjectId invalide, laisser None

    return {
        "id": str(user_doc["_id"]),
        "email": user_doc["email"],
        "roles": user_doc.get("roles", []),
        "nom": user_doc.get("nom"),
        "prenom": user_doc.get("prenom"),
        "departement_id": user_doc.get("departement_id"),
        "departement_nom": departement_nom,
        "telephone": user_doc.get("telephone"),
        "actif": user_doc.get("actif", True),
        "mfa_enabled": user_doc.get("mfa_enabled", False),
        "created_at": user_doc.get("created_at"),
        "updated_at": user_doc.get("updated_at")
    }


def validate_self_modification(current_user_id: str, target_user_id: str, operation: str):
    """
    Valider qu'un admin ne modifie pas son propre compte (prévention lockout).

    Args:
        current_user_id: ID de l'utilisateur actuel
        target_user_id: ID de l'utilisateur cible
        operation: Nom de l'opération (pour le message d'erreur)

    Raises:
        HTTPException: Si tentative de self-modification
    """
    if str(current_user_id) == str(target_user_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Vous ne pouvez pas {operation} votre propre compte"
        )


# ============================================================================
# Endpoints
# ============================================================================

@router.get("/users", response_model=List[UserListResponse])
async def list_users(
    role: Optional[str] = None,
    departement_id: Optional[str] = None,
    actif: Optional[bool] = None,
    search: Optional[str] = None,
    current_user: dict = Depends(require_permission("admin:users:read"))
):
    """
    Lister tous les utilisateurs avec filtres optionnels.

    **Sécurité**: Réservé aux bailleurs uniquement.

    **Filtres disponibles**:
    - `role`: Filtrer par rôle (agent, décideur, bailleur)
    - `departement_id`: Filtrer par département
    - `actif`: Filtrer par statut (true/false)
    - `search`: Recherche textuelle dans email, nom, prenom
    """
    db = get_database()
    query = {}

    # Apply filters
    if role:
        query["roles"] = role

    if departement_id:
        query["departement_id"] = departement_id

    if actif is not None:
        query["actif"] = actif

    if search:
        query["$or"] = [
            {"email": {"$regex": search, "$options": "i"}},
            {"nom": {"$regex": search, "$options": "i"}},
            {"prenom": {"$regex": search, "$options": "i"}}
        ]

    # Fetch users
    users = await db.users.find(query).to_list(None)

    # Enrich with department names
    enriched_users = []
    for user in users:
        enriched_user = await enrich_user_with_department(db, user)
        enriched_users.append(UserListResponse(**enriched_user))

    # Audit log
    await log_action(str(current_user.id), "users_list", "user")

    return enriched_users


@router.get("/users/{user_id}", response_model=UserListResponse)
async def get_user(
    user_id: str,
    current_user: dict = Depends(require_bailleur)
):
    """
    Obtenir les détails d'un utilisateur spécifique.

    **Sécurité**: Réservé aux bailleurs uniquement.
    """
    db = get_database()

    # Validate ObjectId
    if not ObjectId.is_valid(user_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID utilisateur invalide"
        )

    # Fetch user
    user = await db.users.find_one({"_id": ObjectId(user_id)})

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utilisateur non trouvé"
        )

    # Enrich and return
    enriched_user = await enrich_user_with_department(db, user)
    return UserListResponse(**enriched_user)


@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_data: UserCreate,
    current_user: dict = Depends(require_bailleur)
):
    """
    Créer un nouvel utilisateur.

    **Sécurité**: Réservé aux bailleurs uniquement.

    **Validations**:
    - Email unique
    - Au moins un rôle
    - Mot de passe min 8 caractères (validé par Pydantic)
    """
    db = get_database()

    # Check email uniqueness
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Un utilisateur avec cet email existe déjà"
        )

    # Validate at least one role
    if not user_data.roles or len(user_data.roles) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Au moins un rôle doit être spécifié"
        )

    # Validate department if provided
    if user_data.departement_id:
        if not ObjectId.is_valid(user_data.departement_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="ID département invalide"
            )
        dept = await db.departements.find_one({"_id": ObjectId(user_data.departement_id)})
        if not dept:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Le département spécifié n'existe pas"
            )

    # Hash password
    password_hash = hash_password(user_data.password)

    # Prepare user document
    user_doc = {
        "email": user_data.email,
        "password_hash": password_hash,
        "roles": user_data.roles,
        "nom": user_data.nom,
        "prenom": user_data.prenom,
        "departement_id": user_data.departement_id,
        "telephone": user_data.telephone,
        "actif": user_data.actif,
        "mfa_enabled": False,
        "mfa_secret": None,
        "mfa_backup_codes": [],
        "created_at": datetime.utcnow(),
        "updated_at": None
    }

    # Insert user
    result = await db.users.insert_one(user_doc)

    # Audit log
    await log_action(
        str(current_user.id),
        "user_created",
        "user",
        str(result.inserted_id),
        details={"email": user_data.email, "roles": user_data.roles}
    )

    # Return created user
    created_user = await db.users.find_one({"_id": result.inserted_id})
    return UserResponse(
        id=str(created_user["_id"]),
        email=created_user["email"],
        roles=created_user["roles"],
        nom=created_user.get("nom"),
        prenom=created_user.get("prenom"),
        departement_id=created_user.get("departement_id"),
        telephone=created_user.get("telephone"),
        actif=created_user["actif"],
        mfa_enabled=created_user["mfa_enabled"],
        created_at=created_user["created_at"]
    )


@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    user_data: UserUpdate,
    current_user: dict = Depends(require_bailleur)
):
    """
    Mettre à jour un utilisateur existant.

    **Sécurité**: Réservé aux bailleurs uniquement.

    **Restrictions**:
    - Ne peut pas modifier l'email (identifiant)
    - Ne peut pas modifier le mot de passe (utiliser reset-password)
    - Ne peut pas se désactiver soi-même (prévention lockout)

    **Validations**:
    - Au moins un rôle requis
    """
    db = get_database()

    # Validate ObjectId
    if not ObjectId.is_valid(user_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID utilisateur invalide"
        )

    # Prevent self-modification if deactivating
    if not user_data.actif:
        validate_self_modification(str(current_user.id), user_id, "désactiver")

    # Fetch existing user
    existing_user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not existing_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utilisateur non trouvé"
        )

    # Validate at least one role
    if not user_data.roles or len(user_data.roles) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Au moins un rôle doit être spécifié"
        )

    # Validate department if provided
    if user_data.departement_id:
        if not ObjectId.is_valid(user_data.departement_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="ID département invalide"
            )
        dept = await db.departements.find_one({"_id": ObjectId(user_data.departement_id)})
        if not dept:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Le département spécifié n'existe pas"
            )

    # Prepare update document
    update_doc = {
        "roles": user_data.roles,
        "nom": user_data.nom,
        "prenom": user_data.prenom,
        "departement_id": user_data.departement_id,
        "telephone": user_data.telephone,
        "actif": user_data.actif,
        "updated_at": datetime.utcnow()
    }

    # Clear MFA if user is deactivated
    if not user_data.actif:
        update_doc["mfa_enabled"] = False
        update_doc["mfa_secret"] = None
        update_doc["mfa_backup_codes"] = []
        update_doc["two_fa_method"] = "none"

    # Reset 2FA method if explicitly provided
    if user_data.two_fa_method is not None:
        update_doc["two_fa_method"] = user_data.two_fa_method
        if user_data.two_fa_method == "none":
            update_doc["mfa_enabled"] = False
            update_doc["mfa_secret"] = None
            update_doc["mfa_backup_codes"] = []
            update_doc["email_otp_hash"] = None
            update_doc["email_otp_expires_at"] = None

    # Update user
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": update_doc}
    )

    # Audit log
    await log_action(
        str(current_user.id),
        "user_updated",
        "user",
        user_id,
        details={
            "old_values": {
                "roles": existing_user.get("roles"),
                "actif": existing_user.get("actif")
            },
            "new_values": {
                "roles": user_data.roles,
                "actif": user_data.actif
            }
        }
    )

    # Return updated user
    updated_user = await db.users.find_one({"_id": ObjectId(user_id)})
    return UserResponse(
        id=str(updated_user["_id"]),
        email=updated_user["email"],
        roles=updated_user["roles"],
        nom=updated_user.get("nom"),
        prenom=updated_user.get("prenom"),
        departement_id=updated_user.get("departement_id"),
        telephone=updated_user.get("telephone"),
        actif=updated_user["actif"],
        mfa_enabled=updated_user.get("mfa_enabled", False),
        two_fa_method=updated_user.get("two_fa_method", "none"),
        created_at=updated_user["created_at"]
    )


@router.delete("/users/{user_id}", response_model=MessageResponse)
async def delete_user(
    user_id: str,
    current_user: dict = Depends(require_bailleur)
):
    """
    Désactiver un utilisateur (soft delete).

    **Sécurité**: Réservé aux bailleurs uniquement.

    **Note**: L'utilisateur n'est pas supprimé physiquement, mais désactivé (actif=False).
    Cela préserve l'intégrité des données (collectes, audit logs, etc.).

    **Restrictions**:
    - Ne peut pas supprimer son propre compte (prévention lockout)
    """
    db = get_database()

    # Validate ObjectId
    if not ObjectId.is_valid(user_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID utilisateur invalide"
        )

    # Prevent self-deletion
    validate_self_modification(str(current_user.id), user_id, "supprimer")

    # Fetch user
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utilisateur non trouvé"
        )

    # Soft delete: set actif=False, clear MFA
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {
            "$set": {
                "actif": False,
                "mfa_enabled": False,
                "mfa_secret": None,
                "mfa_backup_codes": [],
                "updated_at": datetime.utcnow()
            }
        }
    )

    # Audit log
    await log_action(
        str(current_user.id),
        "user_deleted",
        "user",
        user_id,
        details={"email": user["email"]}
    )

    return MessageResponse(message=f"Utilisateur {user['email']} désactivé avec succès")


@router.post("/users/{user_id}/reset-password", response_model=PasswordResetResponse)
async def reset_password(
    user_id: str,
    current_user: dict = Depends(require_bailleur)
):
    """
    Réinitialiser le mot de passe d'un utilisateur (génération d'un mot de passe temporaire).

    **Sécurité**: Réservé aux bailleurs uniquement.

    **Fonctionnement**:
    1. Génération d'un mot de passe temporaire sécurisé (12 caractères)
    2. Hachage bcrypt et mise à jour dans la base
    3. Clear du MFA pour sécurité
    4. Retour du mot de passe temporaire (affichage unique côté frontend)

    **Note**: Sans système d'email, le mot de passe est retourné à l'admin qui doit le
    transmettre manuellement à l'utilisateur (téléphone, en personne, messagerie sécurisée).
    """
    db = get_database()

    # Validate ObjectId
    if not ObjectId.is_valid(user_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID utilisateur invalide"
        )

    # Fetch user
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utilisateur non trouvé"
        )

    # Generate secure temporary password (12 chars)
    temp_password = secrets.token_urlsafe(12)

    # Hash password
    password_hash = hash_password(temp_password)

    # Update user: reset password, clear MFA
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {
            "$set": {
                "password_hash": password_hash,
                "mfa_enabled": False,
                "mfa_secret": None,
                "mfa_backup_codes": [],
                "updated_at": datetime.utcnow()
            }
        }
    )

    # Audit log
    await log_action(
        str(current_user.id),
        "password_reset",
        "user",
        user_id,
        details={
            "user_email": user["email"],
            "reset_by": current_user.email
        }
    )

    return PasswordResetResponse(
        temporary_password=temp_password,
        message="Mot de passe temporaire généré. Afficher une seule fois à l'utilisateur."
    )


@router.patch("/users/{user_id}/toggle-status", response_model=UserResponse)
async def toggle_status(
    user_id: str,
    current_user: dict = Depends(require_bailleur)
):
    """
    Basculer le statut actif/inactif d'un utilisateur.

    **Sécurité**: Réservé aux bailleurs uniquement.

    **Fonctionnement**: Inverse le champ `actif` (True ↔ False).
    Si désactivation, clear du MFA pour sécurité.

    **Restrictions**:
    - Ne peut pas désactiver son propre compte (prévention lockout)
    """
    db = get_database()

    # Validate ObjectId
    if not ObjectId.is_valid(user_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID utilisateur invalide"
        )

    # Fetch user
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utilisateur non trouvé"
        )

    # New status (toggle)
    new_status = not user.get("actif", True)

    # Prevent self-deactivation
    if not new_status:
        validate_self_modification(str(current_user.id), user_id, "désactiver")

    # Prepare update
    update_doc = {
        "actif": new_status,
        "updated_at": datetime.utcnow()
    }

    # Clear MFA if deactivating
    if not new_status:
        update_doc["mfa_enabled"] = False
        update_doc["mfa_secret"] = None
        update_doc["mfa_backup_codes"] = []

    # Update user
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": update_doc}
    )

    # Audit log
    await log_action(
        str(current_user.id),
        "user_status_changed",
        "user",
        user_id,
        details={
            "email": user["email"],
            "old_status": user.get("actif", True),
            "new_status": new_status
        }
    )

    # Return updated user
    updated_user = await db.users.find_one({"_id": ObjectId(user_id)})
    return UserResponse(
        id=str(updated_user["_id"]),
        email=updated_user["email"],
        roles=updated_user["roles"],
        nom=updated_user.get("nom"),
        prenom=updated_user.get("prenom"),
        departement_id=updated_user.get("departement_id"),
        telephone=updated_user.get("telephone"),
        actif=updated_user["actif"],
        mfa_enabled=updated_user["mfa_enabled"],
        created_at=updated_user["created_at"]
    )
