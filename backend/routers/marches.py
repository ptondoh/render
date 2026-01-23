"""
Router pour la gestion des marchés locaux.
Accès protégé par authentification JWT et RBAC.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional
from datetime import datetime
from bson import ObjectId

from backend.models import (
    MarcheCreate, MarcheResponse,
    MessageResponse
)
from backend.middleware.security import get_current_user
from backend.middleware.rbac import require_role
from backend.database import db

router = APIRouter(prefix="/api/marches", tags=["Marchés"])


@router.get("", response_model=List[MarcheResponse])
async def get_marches(
    commune_id: Optional[str] = Query(None, description="Filtrer par commune"),
    departement_id: Optional[str] = Query(None, description="Filtrer par département"),
    actif: Optional[bool] = Query(True, description="Filtrer par statut actif"),
    current_user: dict = Depends(get_current_user)
):
    """
    Liste tous les marchés.
    Accessible à tous les rôles authentifiés.
    """
    query = {}
    if actif is not None:
        query["actif"] = actif
    if commune_id:
        query["commune_id"] = commune_id

    marches = await db.marches.find(query).to_list(None)
    result = []

    for marche in marches:
        # Récupérer le nom de la commune
        commune_nom = None
        departement_nom = None
        if marche.get("commune_id"):
            commune = await db.communes.find_one({
                "_id": ObjectId(marche["commune_id"])
            })
            if commune:
                commune_nom = commune["nom"]

                # Récupérer le nom du département
                if commune.get("departement_id"):
                    dept = await db.departements.find_one({
                        "_id": ObjectId(commune["departement_id"])
                    })
                    if dept:
                        departement_nom = dept["nom"]

                        # Filtrer par département si spécifié
                        if departement_id and commune["departement_id"] != departement_id:
                            continue

        result.append(
            MarcheResponse(
                id=str(marche["_id"]),
                nom=marche["nom"],
                nom_creole=marche.get("nom_creole"),
                code=marche["code"],
                commune_id=marche["commune_id"],
                type_marche=marche["type_marche"],
                latitude=marche.get("latitude"),
                longitude=marche.get("longitude"),
                jours_ouverture=marche.get("jours_ouverture"),
                specialites=marche.get("specialites"),
                telephone=marche.get("telephone"),
                email=marche.get("email"),
                actif=marche.get("actif", True),
                commune_nom=commune_nom,
                departement_nom=departement_nom
            )
        )

    return result


@router.get("/{marche_id}", response_model=MarcheResponse)
async def get_marche(
    marche_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Récupérer un marché par son ID.
    """
    if not ObjectId.is_valid(marche_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID de marché invalide"
        )

    marche = await db.marches.find_one({"_id": ObjectId(marche_id)})
    if not marche:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Marché non trouvé"
        )

    # Récupérer le nom de la commune et du département
    commune_nom = None
    departement_nom = None
    if marche.get("commune_id"):
        commune = await db.communes.find_one({
            "_id": ObjectId(marche["commune_id"])
        })
        if commune:
            commune_nom = commune["nom"]

            if commune.get("departement_id"):
                dept = await db.departements.find_one({
                    "_id": ObjectId(commune["departement_id"])
                })
                if dept:
                    departement_nom = dept["nom"]

    return MarcheResponse(
        id=str(marche["_id"]),
        nom=marche["nom"],
        nom_creole=marche.get("nom_creole"),
        code=marche["code"],
        commune_id=marche["commune_id"],
        type_marche=marche["type_marche"],
        latitude=marche.get("latitude"),
        longitude=marche.get("longitude"),
        jours_ouverture=marche.get("jours_ouverture"),
        specialites=marche.get("specialites"),
        telephone=marche.get("telephone"),
        email=marche.get("email"),
        actif=marche.get("actif", True),
        commune_nom=commune_nom,
        departement_nom=departement_nom
    )


@router.post(
    "",
    response_model=MarcheResponse,
    status_code=status.HTTP_201_CREATED
)
async def create_marche(
    marche: MarcheCreate,
    current_user: dict = Depends(require_role(["décideur"]))
):
    """
    Créer un nouveau marché.
    Réservé aux décideurs.
    """
    # Vérifier si le code existe déjà
    existing = await db.marches.find_one({"code": marche.code})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Le marché avec le code '{marche.code}' existe déjà"
        )

    # Vérifier que la commune existe
    if not ObjectId.is_valid(marche.commune_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID de commune invalide"
        )

    commune = await db.communes.find_one({"_id": ObjectId(marche.commune_id)})
    if not commune:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La commune spécifiée n'existe pas"
        )

    marche_dict = marche.model_dump()
    marche_dict["actif"] = True
    marche_dict["created_at"] = datetime.utcnow()

    # Créer l'objet GeoJSON pour l'index géospatial si lat/lon fournis
    if marche.latitude is not None and marche.longitude is not None:
        marche_dict["location"] = {
            "type": "Point",
            "coordinates": [marche.longitude, marche.latitude]
        }

    result = await db.marches.insert_one(marche_dict)
    created_marche = await db.marches.find_one({"_id": result.inserted_id})

    # Récupérer le nom du département
    departement_nom = None
    if commune.get("departement_id"):
        dept = await db.departements.find_one({
            "_id": ObjectId(commune["departement_id"])
        })
        if dept:
            departement_nom = dept["nom"]

    return MarcheResponse(
        id=str(created_marche["_id"]),
        nom=created_marche["nom"],
        nom_creole=created_marche.get("nom_creole"),
        code=created_marche["code"],
        commune_id=created_marche["commune_id"],
        type_marche=created_marche["type_marche"],
        latitude=created_marche.get("latitude"),
        longitude=created_marche.get("longitude"),
        jours_ouverture=created_marche.get("jours_ouverture"),
        specialites=created_marche.get("specialites"),
        telephone=created_marche.get("telephone"),
        email=created_marche.get("email"),
        actif=created_marche.get("actif", True),
        commune_nom=commune["nom"],
        departement_nom=departement_nom
    )


@router.put("/{marche_id}", response_model=MarcheResponse)
async def update_marche(
    marche_id: str,
    marche: MarcheCreate,
    current_user: dict = Depends(require_role(["décideur"]))
):
    """
    Mettre à jour un marché.
    Réservé aux décideurs.
    """
    if not ObjectId.is_valid(marche_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID de marché invalide"
        )

    existing = await db.marches.find_one({"_id": ObjectId(marche_id)})
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Marché non trouvé"
        )

    # Vérifier si le nouveau code existe déjà (pour un autre marché)
    code_exists = await db.marches.find_one({
        "code": marche.code,
        "_id": {"$ne": ObjectId(marche_id)}
    })
    if code_exists:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Le code '{marche.code}' est déjà utilisé par un autre marché"
        )

    # Vérifier que la commune existe
    if not ObjectId.is_valid(marche.commune_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID de commune invalide"
        )

    commune = await db.communes.find_one({"_id": ObjectId(marche.commune_id)})
    if not commune:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La commune spécifiée n'existe pas"
        )

    marche_dict = marche.model_dump()
    marche_dict["updated_at"] = datetime.utcnow()

    # Mettre à jour l'objet GeoJSON
    if marche.latitude is not None and marche.longitude is not None:
        marche_dict["location"] = {
            "type": "Point",
            "coordinates": [marche.longitude, marche.latitude]
        }
    else:
        marche_dict["location"] = None

    await db.marches.update_one(
        {"_id": ObjectId(marche_id)},
        {"$set": marche_dict}
    )

    updated_marche = await db.marches.find_one({"_id": ObjectId(marche_id)})

    # Récupérer le nom du département
    departement_nom = None
    if commune.get("departement_id"):
        dept = await db.departements.find_one({
            "_id": ObjectId(commune["departement_id"])
        })
        if dept:
            departement_nom = dept["nom"]

    return MarcheResponse(
        id=str(updated_marche["_id"]),
        nom=updated_marche["nom"],
        nom_creole=updated_marche.get("nom_creole"),
        code=updated_marche["code"],
        commune_id=updated_marche["commune_id"],
        type_marche=updated_marche["type_marche"],
        latitude=updated_marche.get("latitude"),
        longitude=updated_marche.get("longitude"),
        jours_ouverture=updated_marche.get("jours_ouverture"),
        specialites=updated_marche.get("specialites"),
        telephone=updated_marche.get("telephone"),
        email=updated_marche.get("email"),
        actif=updated_marche.get("actif", True),
        commune_nom=commune["nom"],
        departement_nom=departement_nom
    )


@router.delete("/{marche_id}", response_model=MessageResponse)
async def delete_marche(
    marche_id: str,
    current_user: dict = Depends(require_role(["décideur"]))
):
    """
    Supprimer (désactiver) un marché.
    Réservé aux décideurs.
    """
    if not ObjectId.is_valid(marche_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID de marché invalide"
        )

    # Vérifier s'il y a des collectes de prix liées
    collectes_count = await db.collectes_prix.count_documents({
        "marche_id": marche_id
    })

    if collectes_count > 0:
        # Désactiver le marché plutôt que de le supprimer
        result = await db.marches.update_one(
            {"_id": ObjectId(marche_id)},
            {"$set": {"actif": False, "updated_at": datetime.utcnow()}}
        )

        if result.modified_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Marché non trouvé"
            )

        return MessageResponse(
            message="Marché désactivé avec succès",
            detail=f"{collectes_count} collecte(s) de prix liée(s) conservée(s)"
        )
    else:
        # Aucune collecte liée, on peut supprimer
        result = await db.marches.delete_one({"_id": ObjectId(marche_id)})

        if result.deleted_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Marché non trouvé"
            )

        return MessageResponse(message="Marché supprimé avec succès")


@router.get("/communes/{commune_id}/marches", response_model=List[MarcheResponse])
async def get_marches_by_commune(
    commune_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Liste tous les marchés d'une commune.
    """
    if not ObjectId.is_valid(commune_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID de commune invalide"
        )

    # Vérifier que la commune existe
    commune = await db.communes.find_one({"_id": ObjectId(commune_id)})
    if not commune:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Commune non trouvée"
        )

    return await get_marches(commune_id=commune_id, current_user=current_user)
