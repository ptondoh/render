"""
Router pour les données de référence (unités de mesure, catégories, permissions, rôles).
Accès protégé par authentification JWT et RBAC.
"""
# Auto-reload trigger

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
from backend.middleware.rbac import require_role, require_permission
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
            symbole=unite["symbole"]
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
    current_user: dict = Depends(require_permission("admin:manage"))
):
    """
    Créer une nouvelle unité de mesure.
    Réservé aux décideurs.
    """
    # Vérifier si l'unité ou le symbole existe déjà
    existing = await db.unites_mesure.find_one({
        "$or": [
            {"unite": unite.unite},
            {"symbole": unite.symbole}
        ]
    })
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"L'unité '{unite.unite}' ou le symbole '{unite.symbole}' existe déjà"
        )

    unite_dict = unite.model_dump()
    unite_dict["created_at"] = datetime.utcnow()

    result = await db.unites_mesure.insert_one(unite_dict)
    created_unite = await db.unites_mesure.find_one({"_id": result.inserted_id})

    return UniteMesureResponse(
        id=str(created_unite["_id"]),
        unite=created_unite["unite"],
        symbole=created_unite["symbole"]
    )


@router.put("/unites-mesure/{unite_id}", response_model=UniteMesureResponse)
async def update_unite_mesure(
    unite_id: str,
    unite: UniteMesureCreate,
    current_user: dict = Depends(require_permission("admin:manage"))
):
    """
    Mettre à jour une unité de mesure.
    Réservé aux décideurs.
    """
    from bson import ObjectId

    if not ObjectId.is_valid(unite_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID d'unité invalide"
        )

    existing = await db.unites_mesure.find_one({"_id": ObjectId(unite_id)})
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Unité non trouvée"
        )

    # Vérifier si le nouveau nom ou symbole n'existe pas déjà
    duplicate = await db.unites_mesure.find_one({
        "$or": [
            {"unite": unite.unite},
            {"symbole": unite.symbole}
        ],
        "_id": {"$ne": ObjectId(unite_id)}
    })
    if duplicate:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"L'unité '{unite.unite}' ou le symbole '{unite.symbole}' existe déjà"
        )

    unite_dict = unite.model_dump()
    unite_dict["updated_at"] = datetime.utcnow()

    await db.unites_mesure.update_one(
        {"_id": ObjectId(unite_id)},
        {"$set": unite_dict}
    )

    updated_unite = await db.unites_mesure.find_one({"_id": ObjectId(unite_id)})

    return UniteMesureResponse(
        id=str(updated_unite["_id"]),
        unite=updated_unite["unite"],
        symbole=updated_unite["symbole"]
    )


@router.delete("/unites-mesure/{unite_id}", response_model=MessageResponse)
async def delete_unite_mesure(
    unite_id: str,
    current_user: dict = Depends(require_permission("admin:manage"))
):
    """
    Supprimer une unité de mesure.
    Réservé aux décideurs.
    """
    from bson import ObjectId

    if not ObjectId.is_valid(unite_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID d'unité invalide"
        )

    existing = await db.unites_mesure.find_one({"_id": ObjectId(unite_id)})
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Unité non trouvée"
        )

    # Vérifier si l'unité est utilisée
    produits_using = await db.produits.count_documents({"id_unite_mesure": unite_id})
    if produits_using > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Impossible de supprimer : {produits_using} produit(s) utilisent cette unité"
        )

    await db.unites_mesure.delete_one({"_id": ObjectId(unite_id)})

    return MessageResponse(message="Unité supprimée avec succès")


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
    current_user: dict = Depends(require_permission("admin:manage"))
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


@router.put("/categories-produit/{categorie_id}", response_model=CategorieProduitResponse)
async def update_categorie_produit(
    categorie_id: str,
    categorie: CategorieProduitCreate,
    current_user: dict = Depends(require_permission("admin:manage"))
):
    """
    Mettre à jour une catégorie de produit.
    Réservé aux décideurs.
    """
    from bson import ObjectId

    if not ObjectId.is_valid(categorie_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID de catégorie invalide"
        )

    existing = await db.categories_produit.find_one({"_id": ObjectId(categorie_id)})
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Catégorie non trouvée"
        )

    # Vérifier si le nouveau nom n'existe pas déjà
    duplicate = await db.categories_produit.find_one({
        "nom": categorie.nom,
        "_id": {"$ne": ObjectId(categorie_id)}
    })
    if duplicate:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"La catégorie '{categorie.nom}' existe déjà"
        )

    categorie_dict = categorie.model_dump()
    categorie_dict["updated_at"] = datetime.utcnow()

    await db.categories_produit.update_one(
        {"_id": ObjectId(categorie_id)},
        {"$set": categorie_dict}
    )

    updated_cat = await db.categories_produit.find_one({"_id": ObjectId(categorie_id)})

    return CategorieProduitResponse(
        id=str(updated_cat["_id"]),
        nom=updated_cat["nom"],
        nom_creole=updated_cat.get("nom_creole"),
        description=updated_cat.get("description")
    )


@router.delete("/categories-produit/{categorie_id}", response_model=MessageResponse)
async def delete_categorie_produit(
    categorie_id: str,
    current_user: dict = Depends(require_permission("admin:manage"))
):
    """
    Supprimer une catégorie de produit.
    Réservé aux décideurs.
    """
    from bson import ObjectId

    if not ObjectId.is_valid(categorie_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID de catégorie invalide"
        )

    existing = await db.categories_produit.find_one({"_id": ObjectId(categorie_id)})
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Catégorie non trouvée"
        )

    # Vérifier si la catégorie est utilisée
    produits_using = await db.produits.count_documents({"id_categorie": categorie_id})
    if produits_using > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Impossible de supprimer : {produits_using} produit(s) utilisent cette catégorie"
        )

    await db.categories_produit.delete_one({"_id": ObjectId(categorie_id)})

    return MessageResponse(message="Catégorie supprimée avec succès")


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
    current_user: dict = Depends(require_permission("admin:manage"))
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
async def get_permissions(current_user: dict = Depends(require_permission("admin:permissions:read"))):
    """
    Liste toutes les permissions.
    Accès via permission admin:permissions:read.
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
    current_user: dict = Depends(require_permission("admin:permissions:create"))
):
    """
    Créer une nouvelle permission.
    Accès via permission admin:permissions:create.
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
async def get_roles(current_user: dict = Depends(require_permission("admin:roles:read"))):
    """
    Liste tous les rôles avec leurs permissions.
    Accès via permission admin:roles:read.
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
    current_user: dict = Depends(require_permission("admin:roles:create"))
):
    """
    Créer un nouveau rôle.
    Accès via permission admin:roles:create.
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


@router.put("/roles/{role_id}", response_model=RoleResponse)
async def update_role(
    role_id: str,
    role_data: RoleCreate,
    current_user: dict = Depends(require_permission("admin:roles:update"))
):
    """
    Modifier un rôle existant.
    Accès via permission admin:roles:update.
    """
    from bson import ObjectId

    if not ObjectId.is_valid(role_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID de rôle invalide"
        )

    # Vérifier que le rôle existe
    existing = await db.roles.find_one({"_id": ObjectId(role_id)})
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Rôle avec ID {role_id} introuvable"
        )

    # Vérifier unicité du nom (si changé)
    if role_data.nom != existing.get("nom"):
        name_exists = await db.roles.find_one({"nom": role_data.nom})
        if name_exists:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Le rôle '{role_data.nom}' existe déjà"
            )

    # Vérifier que les permissions existent
    if role_data.id_permissions:
        perm_ids = [ObjectId(pid) for pid in role_data.id_permissions if ObjectId.is_valid(pid)]
        perm_count = await db.permissions.count_documents({"_id": {"$in": perm_ids}})
        if perm_count != len(role_data.id_permissions):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Une ou plusieurs permissions n'existent pas"
            )

    # Mettre à jour
    role_dict = role_data.model_dump()
    role_dict["updated_at"] = datetime.utcnow()

    await db.roles.update_one(
        {"_id": ObjectId(role_id)},
        {"$set": role_dict}
    )

    # Récupérer le rôle mis à jour
    updated_role = await db.roles.find_one({"_id": ObjectId(role_id)})

    # Récupérer les permissions
    permissions_list = []
    if updated_role.get("id_permissions"):
        perm_ids = [ObjectId(pid) for pid in updated_role["id_permissions"] if ObjectId.is_valid(pid)]
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
        id=str(updated_role["_id"]),
        nom=updated_role["nom"],
        id_permissions=updated_role.get("id_permissions", []),
        description=updated_role.get("description"),
        permissions=permissions_list
    )


@router.delete("/roles/{role_id}", response_model=MessageResponse)
async def delete_role(
    role_id: str,
    current_user: dict = Depends(require_permission("admin:roles:delete"))
):
    """
    Supprimer un rôle.
    Accès via permission admin:roles:delete.
    """
    from bson import ObjectId

    if not ObjectId.is_valid(role_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID de rôle invalide"
        )

    # Vérifier que le rôle existe
    role = await db.roles.find_one({"_id": ObjectId(role_id)})
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Rôle avec ID {role_id} introuvable"
        )

    # Vérifier qu'aucun utilisateur n'a ce rôle
    users_with_role = await db.users.count_documents({"roles": role_id})
    if users_with_role > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Impossible de supprimer le rôle '{role['nom']}': {users_with_role} utilisateur(s) l'utilisent encore"
        )

    # Supprimer le rôle
    await db.roles.delete_one({"_id": ObjectId(role_id)})

    return MessageResponse(
        message=f"Rôle '{role['nom']}' supprimé avec succès"
    )


@router.put("/permissions/{permission_id}", response_model=PermissionResponse)
async def update_permission(
    permission_id: str,
    permission_data: PermissionCreate,
    current_user: dict = Depends(require_permission("admin:permissions:update"))
):
    """
    Modifier une permission existante.
    Réservé aux décideurs (bientôt: require_permission("admin:permissions:update")).
    """
    from bson import ObjectId

    if not ObjectId.is_valid(permission_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID de permission invalide"
        )

    # Vérifier que la permission existe
    existing = await db.permissions.find_one({"_id": ObjectId(permission_id)})
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Permission avec ID {permission_id} introuvable"
        )

    # Vérifier unicité (nom + action)
    name_exists = await db.permissions.find_one({
        "nom": permission_data.nom,
        "action": permission_data.action,
        "_id": {"$ne": ObjectId(permission_id)}
    })
    if name_exists:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"La permission '{permission_data.nom}:{permission_data.action}' existe déjà"
        )

    # Mettre à jour
    perm_dict = permission_data.model_dump()
    perm_dict["updated_at"] = datetime.utcnow()

    await db.permissions.update_one(
        {"_id": ObjectId(permission_id)},
        {"$set": perm_dict}
    )

    # Récupérer la permission mise à jour
    updated_perm = await db.permissions.find_one({"_id": ObjectId(permission_id)})

    return PermissionResponse(
        id=str(updated_perm["_id"]),
        nom=updated_perm["nom"],
        action=updated_perm["action"],
        description=updated_perm.get("description")
    )


@router.delete("/permissions/{permission_id}", response_model=MessageResponse)
async def delete_permission(
    permission_id: str,
    current_user: dict = Depends(require_permission("admin:permissions:delete"))
):
    """
    Supprimer une permission.
    Réservé aux décideurs (bientôt: require_permission("admin:permissions:delete")).
    """
    from bson import ObjectId

    if not ObjectId.is_valid(permission_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID de permission invalide"
        )

    # Vérifier que la permission existe
    permission = await db.permissions.find_one({"_id": ObjectId(permission_id)})
    if not permission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Permission avec ID {permission_id} introuvable"
        )

    # Vérifier qu'aucun rôle n'utilise cette permission
    roles_with_perm = await db.roles.count_documents({"id_permissions": permission_id})
    if roles_with_perm > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Impossible de supprimer la permission '{permission['nom']}': {roles_with_perm} rôle(s) l'utilisent encore"
        )

    # Supprimer la permission
    await db.permissions.delete_one({"_id": ObjectId(permission_id)})

    return MessageResponse(
        message=f"Permission '{permission['nom']}' supprimée avec succès"
    )
