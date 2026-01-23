"""
Router pour la gestion des collectes de prix sur les marchés.
Support du mode hors-ligne avec synchronisation.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional
from datetime import datetime, timedelta
from bson import ObjectId

from backend.models import (
    CollecteCreate, CollecteResponse,
    MessageResponse
)
from backend.middleware.security import get_current_user
from backend.middleware.rbac import require_role, can_submit_collectes, can_validate_collectes
from backend.database import db

router = APIRouter(prefix="/api/collectes", tags=["Collectes de Prix"])


@router.get("", response_model=List[CollecteResponse])
async def get_collectes(
    marche_id: Optional[str] = Query(None, description="Filtrer par marché"),
    produit_id: Optional[str] = Query(None, description="Filtrer par produit"),
    agent_id: Optional[str] = Query(None, description="Filtrer par agent"),
    statut: Optional[str] = Query(None, description="Filtrer par statut"),
    date_debut: Optional[str] = Query(None, description="Date début (YYYY-MM-DD)"),
    date_fin: Optional[str] = Query(None, description="Date fin (YYYY-MM-DD)"),
    limit: int = Query(100, le=1000, description="Nombre max de résultats"),
    current_user: dict = Depends(get_current_user)
):
    """
    Liste les collectes de prix avec filtres optionnels.

    - Agents: voient uniquement leurs propres collectes
    - Décideurs/Bailleurs: voient toutes les collectes
    """
    query = {}

    # Les agents ne voient que leurs collectes
    if current_user.role == "agent":
        query["agent_id"] = current_user.id
    elif agent_id:
        query["agent_id"] = agent_id

    # Filtres optionnels
    if marche_id:
        query["marche_id"] = marche_id
    if produit_id:
        query["produit_id"] = produit_id
    if statut:
        query["statut"] = statut

    # Filtre par période
    if date_debut or date_fin:
        date_query = {}
        if date_debut:
            date_query["$gte"] = datetime.fromisoformat(date_debut)
        if date_fin:
            date_query["$lte"] = datetime.fromisoformat(date_fin)
        query["date"] = date_query

    collectes = await db.collectes_prix.find(query).sort("date", -1).limit(limit).to_list(None)

    return [
        CollecteResponse(
            id=str(collecte["_id"]),
            marche_id=collecte["marche_id"],
            produit_id=collecte["produit_id"],
            prix=collecte["prix"],
            date=collecte["date"],
            commentaire=collecte.get("commentaire"),
            agent_id=collecte["agent_id"],
            statut=collecte["statut"],
            created_at=collecte["created_at"]
        )
        for collecte in collectes
    ]


@router.get("/{collecte_id}", response_model=CollecteResponse)
async def get_collecte(
    collecte_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Récupérer une collecte par son ID.
    """
    if not ObjectId.is_valid(collecte_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID de collecte invalide"
        )

    collecte = await db.collectes_prix.find_one({"_id": ObjectId(collecte_id)})
    if not collecte:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Collecte non trouvée"
        )

    # Les agents ne peuvent voir que leurs collectes
    if current_user.role == "agent" and collecte["agent_id"] != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès non autorisé à cette collecte"
        )

    return CollecteResponse(
        id=str(collecte["_id"]),
        marche_id=collecte["marche_id"],
        produit_id=collecte["produit_id"],
        prix=collecte["prix"],
        date=collecte["date"],
        commentaire=collecte.get("commentaire"),
        agent_id=collecte["agent_id"],
        statut=collecte["statut"],
        created_at=collecte["created_at"]
    )


@router.post("", response_model=CollecteResponse, status_code=status.HTTP_201_CREATED)
async def create_collecte(
    collecte: CollecteCreate,
    current_user: dict = Depends(get_current_user)
):
    """
    Créer une nouvelle collecte de prix.

    Accessible aux agents uniquement.
    Support du mode hors-ligne avec synchronisation différée.
    """
    # Vérifier que l'utilisateur est un agent
    if not can_submit_collectes(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seuls les agents peuvent soumettre des collectes"
        )

    # Vérifier que le marché existe
    if not ObjectId.is_valid(collecte.marche_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID de marché invalide"
        )

    marche = await db.marches.find_one({"_id": ObjectId(collecte.marche_id)})
    if not marche:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le marché spécifié n'existe pas"
        )

    # Vérifier que le produit existe
    if not ObjectId.is_valid(collecte.produit_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID de produit invalide"
        )

    produit = await db.produits.find_one({"_id": ObjectId(collecte.produit_id)})
    if not produit:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le produit spécifié n'existe pas"
        )

    # Vérifier les doublons (même marché, produit, date)
    existing = await db.collectes_prix.find_one({
        "marche_id": collecte.marche_id,
        "produit_id": collecte.produit_id,
        "date": collecte.date,
        "agent_id": current_user.id
    })

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Une collecte existe déjà pour ce marché/produit/date"
        )

    collecte_dict = collecte.model_dump()
    collecte_dict["agent_id"] = current_user.id
    collecte_dict["statut"] = "soumise"
    collecte_dict["created_at"] = datetime.utcnow()
    collecte_dict["synced_at"] = datetime.utcnow()

    result = await db.collectes_prix.insert_one(collecte_dict)
    created_collecte = await db.collectes_prix.find_one({"_id": result.inserted_id})

    return CollecteResponse(
        id=str(created_collecte["_id"]),
        marche_id=created_collecte["marche_id"],
        produit_id=created_collecte["produit_id"],
        prix=created_collecte["prix"],
        date=created_collecte["date"],
        commentaire=created_collecte.get("commentaire"),
        agent_id=created_collecte["agent_id"],
        statut=created_collecte["statut"],
        created_at=created_collecte["created_at"]
    )


@router.put("/{collecte_id}", response_model=CollecteResponse)
async def update_collecte(
    collecte_id: str,
    collecte: CollecteCreate,
    current_user: dict = Depends(get_current_user)
):
    """
    Modifier une collecte existante.

    - Agents: peuvent modifier leurs collectes non validées
    - Décideurs: peuvent modifier toutes les collectes
    """
    if not ObjectId.is_valid(collecte_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID de collecte invalide"
        )

    existing = await db.collectes_prix.find_one({"_id": ObjectId(collecte_id)})
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Collecte non trouvée"
        )

    # Vérifier les permissions
    is_agent = current_user.role == "agent"
    is_own_collecte = existing["agent_id"] == current_user.id
    is_validated = existing["statut"] in ["validée", "rejetée"]

    if is_agent and (not is_own_collecte or is_validated):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Impossible de modifier cette collecte"
        )

    collecte_dict = collecte.model_dump()
    collecte_dict["updated_at"] = datetime.utcnow()

    await db.collectes_prix.update_one(
        {"_id": ObjectId(collecte_id)},
        {"$set": collecte_dict}
    )

    updated_collecte = await db.collectes_prix.find_one({"_id": ObjectId(collecte_id)})

    return CollecteResponse(
        id=str(updated_collecte["_id"]),
        marche_id=updated_collecte["marche_id"],
        produit_id=updated_collecte["produit_id"],
        prix=updated_collecte["prix"],
        date=updated_collecte["date"],
        commentaire=updated_collecte.get("commentaire"),
        agent_id=updated_collecte["agent_id"],
        statut=updated_collecte["statut"],
        created_at=updated_collecte["created_at"]
    )


@router.delete("/{collecte_id}", response_model=MessageResponse)
async def delete_collecte(
    collecte_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Supprimer une collecte.

    - Agents: peuvent supprimer leurs collectes non validées
    - Décideurs: peuvent supprimer toutes les collectes
    """
    if not ObjectId.is_valid(collecte_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID de collecte invalide"
        )

    existing = await db.collectes_prix.find_one({"_id": ObjectId(collecte_id)})
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Collecte non trouvée"
        )

    # Vérifier les permissions
    is_agent = current_user.role == "agent"
    is_own_collecte = existing["agent_id"] == current_user.id
    is_validated = existing["statut"] in ["validée", "rejetée"]

    if is_agent and (not is_own_collecte or is_validated):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Impossible de supprimer cette collecte"
        )

    await db.collectes_prix.delete_one({"_id": ObjectId(collecte_id)})

    return MessageResponse(message="Collecte supprimée avec succès")


@router.post("/{collecte_id}/valider", response_model=CollecteResponse)
async def valider_collecte(
    collecte_id: str,
    current_user: dict = Depends(require_role(["décideur"]))
):
    """
    Valider une collecte de prix.
    Réservé aux décideurs.

    Déclenche automatiquement la génération d'alertes si nécessaire.
    """
    if not ObjectId.is_valid(collecte_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID de collecte invalide"
        )

    collecte = await db.collectes_prix.find_one({"_id": ObjectId(collecte_id)})
    if not collecte:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Collecte non trouvée"
        )

    if collecte["statut"] == "validée":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cette collecte est déjà validée"
        )

    await db.collectes_prix.update_one(
        {"_id": ObjectId(collecte_id)},
        {
            "$set": {
                "statut": "validée",
                "validee_par": current_user.id,
                "validee_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
        }
    )

    updated_collecte = await db.collectes_prix.find_one({"_id": ObjectId(collecte_id)})

    # Générer des alertes automatiquement
    try:
        from backend.routers.alertes import generer_alertes_pour_collecte
        await generer_alertes_pour_collecte(collecte_id)
    except Exception as e:
        # Ne pas bloquer la validation si la génération d'alertes échoue
        import logging
        logging.error(f"Erreur lors de la génération d'alertes: {e}")

    return CollecteResponse(
        id=str(updated_collecte["_id"]),
        marche_id=updated_collecte["marche_id"],
        produit_id=updated_collecte["produit_id"],
        prix=updated_collecte["prix"],
        date=updated_collecte["date"],
        commentaire=updated_collecte.get("commentaire"),
        agent_id=updated_collecte["agent_id"],
        statut=updated_collecte["statut"],
        created_at=updated_collecte["created_at"]
    )


@router.post("/{collecte_id}/rejeter", response_model=CollecteResponse)
async def rejeter_collecte(
    collecte_id: str,
    motif: str = Query(..., description="Motif du rejet"),
    current_user: dict = Depends(require_role(["décideur"]))
):
    """
    Rejeter une collecte de prix.
    Réservé aux décideurs.
    """
    if not ObjectId.is_valid(collecte_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID de collecte invalide"
        )

    collecte = await db.collectes_prix.find_one({"_id": ObjectId(collecte_id)})
    if not collecte:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Collecte non trouvée"
        )

    await db.collectes_prix.update_one(
        {"_id": ObjectId(collecte_id)},
        {
            "$set": {
                "statut": "rejetée",
                "motif_rejet": motif,
                "validee_par": current_user.id,
                "validee_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
        }
    )

    updated_collecte = await db.collectes_prix.find_one({"_id": ObjectId(collecte_id)})

    return CollecteResponse(
        id=str(updated_collecte["_id"]),
        marche_id=updated_collecte["marche_id"],
        produit_id=updated_collecte["produit_id"],
        prix=updated_collecte["prix"],
        date=updated_collecte["date"],
        commentaire=updated_collecte.get("commentaire"),
        agent_id=updated_collecte["agent_id"],
        statut=updated_collecte["statut"],
        created_at=updated_collecte["created_at"]
    )


@router.get("/statistiques/resume", response_model=dict)
async def get_statistiques_collectes(
    date_debut: Optional[str] = Query(None, description="Date début (YYYY-MM-DD)"),
    date_fin: Optional[str] = Query(None, description="Date fin (YYYY-MM-DD)"),
    current_user: dict = Depends(get_current_user)
):
    """
    Obtenir des statistiques sur les collectes de prix.

    Retourne:
    - Nombre total de collectes
    - Répartition par statut
    - Nombre de collectes par agent (décideurs uniquement)
    - Moyenne des prix par produit
    """
    query = {}

    # Les agents ne voient que leurs stats
    if current_user.role == "agent":
        query["agent_id"] = current_user.id

    # Filtre par période
    if date_debut or date_fin:
        date_query = {}
        if date_debut:
            date_query["$gte"] = datetime.fromisoformat(date_debut)
        if date_fin:
            date_query["$lte"] = datetime.fromisoformat(date_fin)
        query["date"] = date_query

    # Compter total
    total = await db.collectes_prix.count_documents(query)

    # Répartition par statut
    pipeline_statut = [
        {"$match": query},
        {"$group": {"_id": "$statut", "count": {"$sum": 1}}}
    ]
    statuts = await db.collectes_prix.aggregate(pipeline_statut).to_list(None)

    stats = {
        "total_collectes": total,
        "par_statut": {s["_id"]: s["count"] for s in statuts},
        "periode": {
            "debut": date_debut,
            "fin": date_fin
        }
    }

    # Stats par agent (décideurs uniquement)
    if current_user.role in ["décideur", "bailleur"]:
        pipeline_agent = [
            {"$match": query},
            {"$group": {"_id": "$agent_id", "count": {"$sum": 1}}}
        ]
        agents = await db.collectes_prix.aggregate(pipeline_agent).to_list(None)
        stats["par_agent"] = {a["_id"]: a["count"] for a in agents}

    return stats
