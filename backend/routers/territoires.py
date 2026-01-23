"""
Router pour la hiérarchie territoriale (Départements > Communes > Marchés).
Accès protégé par authentification JWT et RBAC.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from datetime import datetime
from bson import ObjectId

from backend.models import (
    DepartementCreate, DepartementResponse,
    CommuneCreate, CommuneResponse,
    MessageResponse
)
from backend.middleware.security import get_current_user
from backend.middleware.rbac import require_role
from backend.database import db

router = APIRouter(prefix="/api", tags=["Territoires"])


# ============================================================================
# Départements
# ============================================================================

@router.get("/departements", response_model=List[DepartementResponse])
async def get_departements(current_user: dict = Depends(get_current_user)):
    """
    Liste tous les départements.
    Accessible à tous les rôles authentifiés.
    """
    departements = await db.departements.find({"actif": True}).to_list(None)
    result = []

    for dept in departements:
        # Compter les communes dans ce département
        nombre_communes = await db.communes.count_documents({
            "departement_id": str(dept["_id"]),
            "actif": True
        })

        result.append(
            DepartementResponse(
                id=str(dept["_id"]),
                code=dept["code"],
                nom=dept["nom"],
                nom_creole=dept.get("nom_creole"),
                actif=dept.get("actif", True),
                nombre_communes=nombre_communes
            )
        )

    return result


@router.get("/departements/{departement_id}", response_model=DepartementResponse)
async def get_departement(
    departement_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Récupérer un département par son ID.
    """
    if not ObjectId.is_valid(departement_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID de département invalide"
        )

    dept = await db.departements.find_one({"_id": ObjectId(departement_id)})
    if not dept:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Département non trouvé"
        )

    nombre_communes = await db.communes.count_documents({
        "departement_id": departement_id,
        "actif": True
    })

    return DepartementResponse(
        id=str(dept["_id"]),
        code=dept["code"],
        nom=dept["nom"],
        nom_creole=dept.get("nom_creole"),
        actif=dept.get("actif", True),
        nombre_communes=nombre_communes
    )


@router.post(
    "/departements",
    response_model=DepartementResponse,
    status_code=status.HTTP_201_CREATED
)
async def create_departement(
    departement: DepartementCreate,
    current_user: dict = Depends(require_role(["décideur"]))
):
    """
    Créer un nouveau département.
    Réservé aux décideurs.
    """
    # Vérifier si le code existe déjà
    existing = await db.departements.find_one({"code": departement.code})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Le département avec le code '{departement.code}' existe déjà"
        )

    dept_dict = departement.model_dump()
    dept_dict["actif"] = True
    dept_dict["created_at"] = datetime.utcnow()

    result = await db.departements.insert_one(dept_dict)
    created_dept = await db.departements.find_one({"_id": result.inserted_id})

    return DepartementResponse(
        id=str(created_dept["_id"]),
        code=created_dept["code"],
        nom=created_dept["nom"],
        nom_creole=created_dept.get("nom_creole"),
        actif=created_dept.get("actif", True),
        nombre_communes=0
    )


@router.put("/departements/{departement_id}", response_model=DepartementResponse)
async def update_departement(
    departement_id: str,
    departement: DepartementCreate,
    current_user: dict = Depends(require_role(["décideur"]))
):
    """
    Mettre à jour un département.
    Réservé aux décideurs.
    """
    if not ObjectId.is_valid(departement_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID de département invalide"
        )

    existing = await db.departements.find_one({"_id": ObjectId(departement_id)})
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Département non trouvé"
        )

    dept_dict = departement.model_dump()
    dept_dict["updated_at"] = datetime.utcnow()

    await db.departements.update_one(
        {"_id": ObjectId(departement_id)},
        {"$set": dept_dict}
    )

    updated_dept = await db.departements.find_one({"_id": ObjectId(departement_id)})
    nombre_communes = await db.communes.count_documents({
        "departement_id": departement_id,
        "actif": True
    })

    return DepartementResponse(
        id=str(updated_dept["_id"]),
        code=updated_dept["code"],
        nom=updated_dept["nom"],
        nom_creole=updated_dept.get("nom_creole"),
        actif=updated_dept.get("actif", True),
        nombre_communes=nombre_communes
    )


@router.delete("/departements/{departement_id}", response_model=MessageResponse)
async def delete_departement(
    departement_id: str,
    current_user: dict = Depends(require_role(["décideur"]))
):
    """
    Supprimer (désactiver) un département.
    Réservé aux décideurs.
    """
    if not ObjectId.is_valid(departement_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID de département invalide"
        )

    # Vérifier s'il y a des communes liées
    communes_count = await db.communes.count_documents({
        "departement_id": departement_id,
        "actif": True
    })

    if communes_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Impossible de supprimer : {communes_count} commune(s) sont liées à ce département"
        )

    result = await db.departements.update_one(
        {"_id": ObjectId(departement_id)},
        {"$set": {"actif": False, "updated_at": datetime.utcnow()}}
    )

    if result.modified_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Département non trouvé"
        )

    return MessageResponse(message="Département désactivé avec succès")


# ============================================================================
# Communes
# ============================================================================

@router.get("/communes", response_model=List[CommuneResponse])
async def get_communes(
    departement_id: str = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Liste toutes les communes (optionnellement filtrées par département).
    Accessible à tous les rôles authentifiés.
    """
    query = {"actif": True}
    if departement_id:
        query["departement_id"] = departement_id

    communes = await db.communes.find(query).to_list(None)
    result = []

    for commune in communes:
        # Récupérer le nom du département
        dept_nom = None
        if commune.get("departement_id"):
            dept = await db.departements.find_one({
                "_id": ObjectId(commune["departement_id"])
            })
            if dept:
                dept_nom = dept["nom"]

        # Compter les marchés dans cette commune
        nombre_marches = await db.marches.count_documents({
            "commune_id": str(commune["_id"]),
            "actif": True
        })

        result.append(
            CommuneResponse(
                id=str(commune["_id"]),
                code=commune["code"],
                nom=commune["nom"],
                nom_creole=commune.get("nom_creole"),
                departement_id=commune["departement_id"],
                type_zone=commune["type_zone"],
                population=commune.get("population"),
                actif=commune.get("actif", True),
                departement_nom=dept_nom,
                nombre_marches=nombre_marches
            )
        )

    return result


@router.get("/communes/{commune_id}", response_model=CommuneResponse)
async def get_commune(
    commune_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Récupérer une commune par son ID.
    """
    if not ObjectId.is_valid(commune_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID de commune invalide"
        )

    commune = await db.communes.find_one({"_id": ObjectId(commune_id)})
    if not commune:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Commune non trouvée"
        )

    # Récupérer le nom du département
    dept_nom = None
    if commune.get("departement_id"):
        dept = await db.departements.find_one({
            "_id": ObjectId(commune["departement_id"])
        })
        if dept:
            dept_nom = dept["nom"]

    nombre_marches = await db.marches.count_documents({
        "commune_id": commune_id,
        "actif": True
    })

    return CommuneResponse(
        id=str(commune["_id"]),
        code=commune["code"],
        nom=commune["nom"],
        nom_creole=commune.get("nom_creole"),
        departement_id=commune["departement_id"],
        type_zone=commune["type_zone"],
        population=commune.get("population"),
        actif=commune.get("actif", True),
        departement_nom=dept_nom,
        nombre_marches=nombre_marches
    )


@router.post(
    "/communes",
    response_model=CommuneResponse,
    status_code=status.HTTP_201_CREATED
)
async def create_commune(
    commune: CommuneCreate,
    current_user: dict = Depends(require_role(["décideur"]))
):
    """
    Créer une nouvelle commune.
    Réservé aux décideurs.
    """
    # Vérifier si le code existe déjà
    existing = await db.communes.find_one({"code": commune.code})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"La commune avec le code '{commune.code}' existe déjà"
        )

    # Vérifier que le département existe
    if not ObjectId.is_valid(commune.departement_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID de département invalide"
        )

    dept = await db.departements.find_one({"_id": ObjectId(commune.departement_id)})
    if not dept:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le département spécifié n'existe pas"
        )

    commune_dict = commune.model_dump()
    commune_dict["actif"] = True
    commune_dict["created_at"] = datetime.utcnow()

    result = await db.communes.insert_one(commune_dict)
    created_commune = await db.communes.find_one({"_id": result.inserted_id})

    return CommuneResponse(
        id=str(created_commune["_id"]),
        code=created_commune["code"],
        nom=created_commune["nom"],
        nom_creole=created_commune.get("nom_creole"),
        departement_id=created_commune["departement_id"],
        type_zone=created_commune["type_zone"],
        population=created_commune.get("population"),
        actif=created_commune.get("actif", True),
        departement_nom=dept["nom"],
        nombre_marches=0
    )


@router.put("/communes/{commune_id}", response_model=CommuneResponse)
async def update_commune(
    commune_id: str,
    commune: CommuneCreate,
    current_user: dict = Depends(require_role(["décideur"]))
):
    """
    Mettre à jour une commune.
    Réservé aux décideurs.
    """
    if not ObjectId.is_valid(commune_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID de commune invalide"
        )

    existing = await db.communes.find_one({"_id": ObjectId(commune_id)})
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Commune non trouvée"
        )

    # Vérifier que le département existe
    if not ObjectId.is_valid(commune.departement_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID de département invalide"
        )

    dept = await db.departements.find_one({"_id": ObjectId(commune.departement_id)})
    if not dept:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le département spécifié n'existe pas"
        )

    commune_dict = commune.model_dump()
    commune_dict["updated_at"] = datetime.utcnow()

    await db.communes.update_one(
        {"_id": ObjectId(commune_id)},
        {"$set": commune_dict}
    )

    updated_commune = await db.communes.find_one({"_id": ObjectId(commune_id)})
    nombre_marches = await db.marches.count_documents({
        "commune_id": commune_id,
        "actif": True
    })

    return CommuneResponse(
        id=str(updated_commune["_id"]),
        code=updated_commune["code"],
        nom=updated_commune["nom"],
        nom_creole=updated_commune.get("nom_creole"),
        departement_id=updated_commune["departement_id"],
        type_zone=updated_commune["type_zone"],
        population=updated_commune.get("population"),
        actif=updated_commune.get("actif", True),
        departement_nom=dept["nom"],
        nombre_marches=nombre_marches
    )


@router.delete("/communes/{commune_id}", response_model=MessageResponse)
async def delete_commune(
    commune_id: str,
    current_user: dict = Depends(require_role(["décideur"]))
):
    """
    Supprimer (désactiver) une commune.
    Réservé aux décideurs.
    """
    if not ObjectId.is_valid(commune_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID de commune invalide"
        )

    # Vérifier s'il y a des marchés liés
    marches_count = await db.marches.count_documents({
        "commune_id": commune_id,
        "actif": True
    })

    if marches_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Impossible de supprimer : {marches_count} marché(s) sont liés à cette commune"
        )

    result = await db.communes.update_one(
        {"_id": ObjectId(commune_id)},
        {"$set": {"actif": False, "updated_at": datetime.utcnow()}}
    )

    if result.modified_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Commune non trouvée"
        )

    return MessageResponse(message="Commune désactivée avec succès")


@router.get("/departements/{departement_id}/communes", response_model=List[CommuneResponse])
async def get_communes_by_departement(
    departement_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Liste toutes les communes d'un département.
    """
    if not ObjectId.is_valid(departement_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID de département invalide"
        )

    # Vérifier que le département existe
    dept = await db.departements.find_one({"_id": ObjectId(departement_id)})
    if not dept:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Département non trouvé"
        )

    return await get_communes(departement_id=departement_id, current_user=current_user)
