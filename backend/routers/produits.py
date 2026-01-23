"""
Router pour la gestion des produits alimentaires.
Accès protégé par authentification JWT et RBAC.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional
from datetime import datetime
from bson import ObjectId

from backend.models import (
    ProduitCreate, ProduitResponse,
    MessageResponse
)
from backend.middleware.security import get_current_user
from backend.middleware.rbac import require_role
from backend.database import db

router = APIRouter(prefix="/api/produits", tags=["Produits"])


@router.get("", response_model=List[ProduitResponse])
async def get_produits(
    categorie_id: Optional[str] = Query(None, description="Filtrer par catégorie"),
    actif: Optional[bool] = Query(True, description="Filtrer par statut actif"),
    current_user: dict = Depends(get_current_user)
):
    """
    Liste tous les produits.
    Accessible à tous les rôles authentifiés.
    """
    query = {}
    if actif is not None:
        query["actif"] = actif
    if categorie_id:
        query["id_categorie"] = categorie_id

    produits = await db.produits.find(query).to_list(None)
    result = []

    for produit in produits:
        # Récupérer le nom de la catégorie
        categorie_nom = None
        if produit.get("id_categorie"):
            cat = await db.categories_produit.find_one({
                "_id": ObjectId(produit["id_categorie"])
            })
            if cat:
                categorie_nom = cat["nom"]

        # Récupérer le nom de l'unité de mesure
        unite_nom = None
        if produit.get("id_unite_mesure"):
            unite = await db.unites_mesure.find_one({
                "_id": ObjectId(produit["id_unite_mesure"])
            })
            if unite:
                unite_nom = unite["unite"]

        result.append(
            ProduitResponse(
                id=str(produit["_id"]),
                nom=produit["nom"],
                nom_creole=produit.get("nom_creole"),
                code=produit["code"],
                id_categorie=produit["id_categorie"],
                id_unite_mesure=produit["id_unite_mesure"],
                description=produit.get("description"),
                actif=produit.get("actif", True),
                prix_ref_moyen=produit.get("prix_ref_moyen"),
                categorie_nom=categorie_nom,
                unite_nom=unite_nom
            )
        )

    return result


@router.get("/{produit_id}", response_model=ProduitResponse)
async def get_produit(
    produit_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Récupérer un produit par son ID.
    """
    if not ObjectId.is_valid(produit_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID de produit invalide"
        )

    produit = await db.produits.find_one({"_id": ObjectId(produit_id)})
    if not produit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Produit non trouvé"
        )

    # Récupérer le nom de la catégorie
    categorie_nom = None
    if produit.get("id_categorie"):
        cat = await db.categories_produit.find_one({
            "_id": ObjectId(produit["id_categorie"])
        })
        if cat:
            categorie_nom = cat["nom"]

    # Récupérer le nom de l'unité de mesure
    unite_nom = None
    if produit.get("id_unite_mesure"):
        unite = await db.unites_mesure.find_one({
            "_id": ObjectId(produit["id_unite_mesure"])
        })
        if unite:
            unite_nom = unite["unite"]

    return ProduitResponse(
        id=str(produit["_id"]),
        nom=produit["nom"],
        nom_creole=produit.get("nom_creole"),
        code=produit["code"],
        id_categorie=produit["id_categorie"],
        id_unite_mesure=produit["id_unite_mesure"],
        description=produit.get("description"),
        actif=produit.get("actif", True),
        prix_ref_moyen=produit.get("prix_ref_moyen"),
        categorie_nom=categorie_nom,
        unite_nom=unite_nom
    )


@router.post(
    "",
    response_model=ProduitResponse,
    status_code=status.HTTP_201_CREATED
)
async def create_produit(
    produit: ProduitCreate,
    current_user: dict = Depends(require_role(["décideur"]))
):
    """
    Créer un nouveau produit.
    Réservé aux décideurs.
    """
    # Vérifier si le code existe déjà
    existing = await db.produits.find_one({"code": produit.code})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Le produit avec le code '{produit.code}' existe déjà"
        )

    # Vérifier que la catégorie existe
    if not ObjectId.is_valid(produit.id_categorie):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID de catégorie invalide"
        )

    categorie = await db.categories_produit.find_one({
        "_id": ObjectId(produit.id_categorie)
    })
    if not categorie:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La catégorie spécifiée n'existe pas"
        )

    # Vérifier que l'unité de mesure existe
    if not ObjectId.is_valid(produit.id_unite_mesure):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID d'unité de mesure invalide"
        )

    unite = await db.unites_mesure.find_one({
        "_id": ObjectId(produit.id_unite_mesure)
    })
    if not unite:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="L'unité de mesure spécifiée n'existe pas"
        )

    produit_dict = produit.model_dump()
    produit_dict["actif"] = True
    produit_dict["created_at"] = datetime.utcnow()

    result = await db.produits.insert_one(produit_dict)
    created_produit = await db.produits.find_one({"_id": result.inserted_id})

    return ProduitResponse(
        id=str(created_produit["_id"]),
        nom=created_produit["nom"],
        nom_creole=created_produit.get("nom_creole"),
        code=created_produit["code"],
        id_categorie=created_produit["id_categorie"],
        id_unite_mesure=created_produit["id_unite_mesure"],
        description=created_produit.get("description"),
        actif=created_produit.get("actif", True),
        prix_ref_moyen=created_produit.get("prix_ref_moyen"),
        categorie_nom=categorie["nom"],
        unite_nom=unite["unite"]
    )


@router.put("/{produit_id}", response_model=ProduitResponse)
async def update_produit(
    produit_id: str,
    produit: ProduitCreate,
    current_user: dict = Depends(require_role(["décideur"]))
):
    """
    Mettre à jour un produit.
    Réservé aux décideurs.
    """
    if not ObjectId.is_valid(produit_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID de produit invalide"
        )

    existing = await db.produits.find_one({"_id": ObjectId(produit_id)})
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Produit non trouvé"
        )

    # Vérifier si le nouveau code existe déjà (pour un autre produit)
    code_exists = await db.produits.find_one({
        "code": produit.code,
        "_id": {"$ne": ObjectId(produit_id)}
    })
    if code_exists:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Le code '{produit.code}' est déjà utilisé par un autre produit"
        )

    # Vérifier que la catégorie existe
    if not ObjectId.is_valid(produit.id_categorie):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID de catégorie invalide"
        )

    categorie = await db.categories_produit.find_one({
        "_id": ObjectId(produit.id_categorie)
    })
    if not categorie:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La catégorie spécifiée n'existe pas"
        )

    # Vérifier que l'unité de mesure existe
    if not ObjectId.is_valid(produit.id_unite_mesure):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID d'unité de mesure invalide"
        )

    unite = await db.unites_mesure.find_one({
        "_id": ObjectId(produit.id_unite_mesure)
    })
    if not unite:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="L'unité de mesure spécifiée n'existe pas"
        )

    produit_dict = produit.model_dump()
    produit_dict["updated_at"] = datetime.utcnow()

    await db.produits.update_one(
        {"_id": ObjectId(produit_id)},
        {"$set": produit_dict}
    )

    updated_produit = await db.produits.find_one({"_id": ObjectId(produit_id)})

    return ProduitResponse(
        id=str(updated_produit["_id"]),
        nom=updated_produit["nom"],
        nom_creole=updated_produit.get("nom_creole"),
        code=updated_produit["code"],
        id_categorie=updated_produit["id_categorie"],
        id_unite_mesure=updated_produit["id_unite_mesure"],
        description=updated_produit.get("description"),
        actif=updated_produit.get("actif", True),
        prix_ref_moyen=updated_produit.get("prix_ref_moyen"),
        categorie_nom=categorie["nom"],
        unite_nom=unite["unite"]
    )


@router.delete("/{produit_id}", response_model=MessageResponse)
async def delete_produit(
    produit_id: str,
    current_user: dict = Depends(require_role(["décideur"]))
):
    """
    Supprimer (désactiver) un produit.
    Réservé aux décideurs.
    """
    if not ObjectId.is_valid(produit_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID de produit invalide"
        )

    # Vérifier s'il y a des collectes de prix liées
    collectes_count = await db.collectes_prix.count_documents({
        "produit_id": produit_id
    })

    if collectes_count > 0:
        # Désactiver le produit plutôt que de le supprimer
        result = await db.produits.update_one(
            {"_id": ObjectId(produit_id)},
            {"$set": {"actif": False, "updated_at": datetime.utcnow()}}
        )

        if result.modified_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Produit non trouvé"
            )

        return MessageResponse(
            message="Produit désactivé avec succès",
            detail=f"{collectes_count} collecte(s) de prix liée(s) conservée(s)"
        )
    else:
        # Aucune collecte liée, on peut supprimer
        result = await db.produits.delete_one({"_id": ObjectId(produit_id)})

        if result.deleted_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Produit non trouvé"
            )

        return MessageResponse(message="Produit supprimé avec succès")
