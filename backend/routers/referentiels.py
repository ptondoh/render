"""
Router pour les données de référence (unités de mesure, catégories, permissions, rôles).
Accès protégé par authentification JWT et RBAC.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from datetime import datetime

from backend.models import (
    UniteMesureCreate, UniteMesureResponse,
    CategorieProduitCreate, CategorieProduitResponse,
    CategorieUserCreate, CategorieUserResponse,
    PermissionCreate, PermissionResponse,
    RoleCreate, RoleResponse,
    MessageResponse
)
from backend.middleware.security import get_current_user
from backend.middleware.rbac import require_role
from backend.database import db

router = APIRouter(prefix="/api", tags=["Référentiels"])


# ============================================================================
# Unités de Mesure
# ============================================================================

@router.get("/unites-mesure", response_model=List[UniteMesureResponse])
async def get_unites_mesure(current_user: dict = Depends(get_current_user)):
    """
    Liste toutes les unités de mesure.
    Accessible à tous les rôles authentifiés.
    """
    unites = await db.unites_mesure.find().to_list(None)
    return [
        UniteMesureResponse(
            id=str(unite["_id"]),
            unite=unite["unite"],
            description=unite.get("description")
        )
        for unite in unites
    ]


@router.post(
    "/unites-mesure",
    response_model=UniteMesureResponse,
    status_code=status.HTTP_201_CREATED
)
async def create_unite_mesure(
    unite: UniteMesureCreate,
    current_user: dict = Depends(require_role(["décideur"]))
):
    """
    Créer une nouvelle unité de mesure.
    Réservé aux décideurs.
    """
    # Vérifier si l'unité existe déjà
    existing = await db.unites_mesure.find_one({"unite": unite.unite})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"L'unité '{unite.unite}' existe déjà"
        )

    unite_dict = unite.model_dump()
    unite_dict["created_at"] = datetime.utcnow()

    result = await db.unites_mesure.insert_one(unite_dict)
    created_unite = await db.unites_mesure.find_one({"_id": result.inserted_id})

    return UniteMesureResponse(
        id=str(created_unite["_id"]),
        unite=created_unite["unite"],
        description=created_unite.get("description")
    )


# ============================================================================
# Catégories de Produits
# ============================================================================

@router.get("/categories-produit", response_model=List[CategorieProduitResponse])
async def get_categories_produit(current_user: dict = Depends(get_current_user)):
    """
    Liste toutes les catégories de produits.
    Accessible à tous les rôles authentifiés.
    """
    categories = await db.categories_produit.find().to_list(None)
    return [
        CategorieProduitResponse(
            id=str(cat["_id"]),
            nom=cat["nom"],
            nom_creole=cat.get("nom_creole"),
            description=cat.get("description")
        )
        for cat in categories
    ]


@router.post(
    "/categories-produit",
    response_model=CategorieProduitResponse,
    status_code=status.HTTP_201_CREATED
)
async def create_categorie_produit(
    categorie: CategorieProduitCreate,
    current_user: dict = Depends(require_role(["décideur"]))
):
    """
    Créer une nouvelle catégorie de produit.
    Réservé aux décideurs.
    """
    # Vérifier si la catégorie existe déjà
    existing = await db.categories_produit.find_one({"nom": categorie.nom})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"La catégorie '{categorie.nom}' existe déjà"
        )

    categorie_dict = categorie.model_dump()
    categorie_dict["created_at"] = datetime.utcnow()

    result = await db.categories_produit.insert_one(categorie_dict)
    created_cat = await db.categories_produit.find_one({"_id": result.inserted_id})

    return CategorieProduitResponse(
        id=str(created_cat["_id"]),
        nom=created_cat["nom"],
        nom_creole=created_cat.get("nom_creole"),
        description=created_cat.get("description")
    )


# ============================================================================
# Catégories d'Utilisateurs
# ============================================================================

@router.get("/categories-user", response_model=List[CategorieUserResponse])
async def get_categories_user(current_user: dict = Depends(get_current_user)):
    """
    Liste toutes les catégories d'utilisateurs.
    Accessible à tous les rôles authentifiés.
    """
    categories = await db.categories_user.find().to_list(None)
    return [
        CategorieUserResponse(
            id=str(cat["_id"]),
            nom=cat["nom"],
            description=cat.get("description")
        )
        for cat in categories
    ]


@router.post(
    "/categories-user",
    response_model=CategorieUserResponse,
    status_code=status.HTTP_201_CREATED
)
async def create_categorie_user(
    categorie: CategorieUserCreate,
    current_user: dict = Depends(require_role(["décideur"]))
):
    """
    Créer une nouvelle catégorie d'utilisateur.
    Réservé aux décideurs.
    """
    existing = await db.categories_user.find_one({"nom": categorie.nom})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"La catégorie '{categorie.nom}' existe déjà"
        )

    categorie_dict = categorie.model_dump()
    categorie_dict["created_at"] = datetime.utcnow()

    result = await db.categories_user.insert_one(categorie_dict)
    created_cat = await db.categories_user.find_one({"_id": result.inserted_id})

    return CategorieUserResponse(
        id=str(created_cat["_id"]),
        nom=created_cat["nom"],
        description=created_cat.get("description")
    )


# ============================================================================
# Permissions
# ============================================================================

@router.get("/permissions", response_model=List[PermissionResponse])
async def get_permissions(current_user: dict = Depends(require_role(["décideur"]))):
    """
    Liste toutes les permissions.
    Réservé aux décideurs.
    """
    permissions = await db.permissions.find().to_list(None)
    return [
        PermissionResponse(
            id=str(perm["_id"]),
            nom=perm["nom"],
            action=perm["action"],
            description=perm.get("description")
        )
        for perm in permissions
    ]


@router.post(
    "/permissions",
    response_model=PermissionResponse,
    status_code=status.HTTP_201_CREATED
)
async def create_permission(
    permission: PermissionCreate,
    current_user: dict = Depends(require_role(["décideur"]))
):
    """
    Créer une nouvelle permission.
    Réservé aux décideurs.
    """
    existing = await db.permissions.find_one({
        "nom": permission.nom,
        "action": permission.action
    })
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"La permission '{permission.nom}:{permission.action}' existe déjà"
        )

    permission_dict = permission.model_dump()
    permission_dict["created_at"] = datetime.utcnow()

    result = await db.permissions.insert_one(permission_dict)
    created_perm = await db.permissions.find_one({"_id": result.inserted_id})

    return PermissionResponse(
        id=str(created_perm["_id"]),
        nom=created_perm["nom"],
        action=created_perm["action"],
        description=created_perm.get("description")
    )


# ============================================================================
# Rôles
# ============================================================================

@router.get("/roles", response_model=List[RoleResponse])
async def get_roles(current_user: dict = Depends(require_role(["décideur"]))):
    """
    Liste tous les rôles avec leurs permissions.
    Réservé aux décideurs.
    """
    roles = await db.roles.find().to_list(None)
    result = []

    for role in roles:
        # Récupérer les permissions du rôle
        permissions_list = []
        if role.get("id_permissions"):
            from bson import ObjectId
            perm_ids = [ObjectId(pid) for pid in role["id_permissions"] if ObjectId.is_valid(pid)]
            permissions = await db.permissions.find({"_id": {"$in": perm_ids}}).to_list(None)
            permissions_list = [
                PermissionResponse(
                    id=str(perm["_id"]),
                    nom=perm["nom"],
                    action=perm["action"],
                    description=perm.get("description")
                )
                for perm in permissions
            ]

        result.append(
            RoleResponse(
                id=str(role["_id"]),
                nom=role["nom"],
                id_permissions=role.get("id_permissions", []),
                description=role.get("description"),
                permissions=permissions_list
            )
        )

    return result


@router.post(
    "/roles",
    response_model=RoleResponse,
    status_code=status.HTTP_201_CREATED
)
async def create_role(
    role: RoleCreate,
    current_user: dict = Depends(require_role(["décideur"]))
):
    """
    Créer un nouveau rôle.
    Réservé aux décideurs.
    """
    existing = await db.roles.find_one({"nom": role.nom})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Le rôle '{role.nom}' existe déjà"
        )

    # Vérifier que les permissions existent
    from bson import ObjectId
    if role.id_permissions:
        perm_ids = [ObjectId(pid) for pid in role.id_permissions if ObjectId.is_valid(pid)]
        perm_count = await db.permissions.count_documents({"_id": {"$in": perm_ids}})
        if perm_count != len(role.id_permissions):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Une ou plusieurs permissions n'existent pas"
            )

    role_dict = role.model_dump()
    role_dict["created_at"] = datetime.utcnow()

    result = await db.roles.insert_one(role_dict)
    created_role = await db.roles.find_one({"_id": result.inserted_id})

    # Récupérer les permissions
    permissions_list = []
    if created_role.get("id_permissions"):
        perm_ids = [ObjectId(pid) for pid in created_role["id_permissions"] if ObjectId.is_valid(pid)]
        permissions = await db.permissions.find({"_id": {"$in": perm_ids}}).to_list(None)
        permissions_list = [
            PermissionResponse(
                id=str(perm["_id"]),
                nom=perm["nom"],
                action=perm["action"],
                description=perm.get("description")
            )
            for perm in permissions
        ]

    return RoleResponse(
        id=str(created_role["_id"]),
        nom=created_role["nom"],
        id_permissions=created_role.get("id_permissions", []),
        description=created_role.get("description"),
        permissions=permissions_list
    )
