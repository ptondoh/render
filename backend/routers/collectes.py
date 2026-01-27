"""
Router pour la gestion des collectes de prix sur les marchés.
Support du mode hors-ligne avec synchronisation.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional
from datetime import datetime, timedelta
from bson import ObjectId

from backend.models import (
    CollecteCreate, CollecteResponse, CollecteBatchCreate,
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
    periode: Optional[str] = Query(None, description="Filtrer par période (matin1, matin2, soir1, soir2)"),
    date: Optional[str] = Query(None, description="Date exacte (YYYY-MM-DD)"),
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
    if periode:
        query["periode"] = periode

    # Filtre par date
    if date:
        # Date exacte
        date_obj = datetime.fromisoformat(date)
        query["date"] = {
            "$gte": date_obj,
            "$lt": date_obj + timedelta(days=1)
        }
    elif date_debut or date_fin:
        # Plage de dates
        date_query = {}
        if date_debut:
            date_query["$gte"] = datetime.fromisoformat(date_debut)
        if date_fin:
            date_query["$lte"] = datetime.fromisoformat(date_fin)
        query["date"] = date_query

    collectes = await db.collectes.find(query).sort("date", -1).limit(limit).to_list(None)

    # Enrichir les données avec les noms
    result = []
    for collecte in collectes:
        # Récupérer les données associées
        marche = await db.marches.find_one({"_id": ObjectId(collecte["marche_id"])})
        commune = await db.communes.find_one({"_id": ObjectId(marche["commune_id"])}) if marche and marche.get("commune_id") else None
        produit = await db.produits.find_one({"_id": ObjectId(collecte["produit_id"])})
        unite = await db.unites_mesure.find_one({"_id": ObjectId(collecte["unite_id"])}) if collecte.get("unite_id") else None
        agent = await db.users.find_one({"_id": ObjectId(collecte["agent_id"])})

        result.append(CollecteResponse(
            id=str(collecte["_id"]),
            marche_id=collecte["marche_id"],
            produit_id=collecte["produit_id"],
            unite_id=collecte.get("unite_id", ""),
            quantite=collecte.get("quantite", 1),
            prix=collecte["prix"],
            date=collecte["date"],
            periode=collecte.get("periode"),
            commentaire=collecte.get("commentaire"),
            agent_id=collecte["agent_id"],
            statut=collecte["statut"],
            latitude=collecte.get("latitude"),
            longitude=collecte.get("longitude"),
            created_at=collecte["created_at"],
            marche_nom=marche.get("nom") if marche else None,
            commune_nom=commune.get("nom") if commune else None,
            produit_nom=produit.get("nom") if produit else None,
            unite_nom=unite.get("unite") if unite else None,
            agent_nom=f"{agent.get('prenom', '')} {agent.get('nom', '')}".strip() if agent else None
        ))

    return result


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

    collecte = await db.collectes.find_one({"_id": ObjectId(collecte_id)})
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

    # Enrichir avec les noms
    marche = await db.marches.find_one({"_id": ObjectId(collecte["marche_id"])})
    commune = await db.communes.find_one({"_id": ObjectId(marche["commune_id"])}) if marche and marche.get("commune_id") else None
    produit = await db.produits.find_one({"_id": ObjectId(collecte["produit_id"])})
    unite = await db.unites_mesure.find_one({"_id": ObjectId(collecte["unite_id"])}) if collecte.get("unite_id") else None
    agent = await db.users.find_one({"_id": ObjectId(collecte["agent_id"])})

    return CollecteResponse(
        id=str(collecte["_id"]),
        marche_id=collecte["marche_id"],
        produit_id=collecte["produit_id"],
        unite_id=collecte.get("unite_id", ""),
        quantite=collecte.get("quantite", 1),
        prix=collecte["prix"],
        date=collecte["date"],
        periode=collecte.get("periode"),
        commentaire=collecte.get("commentaire"),
        agent_id=collecte["agent_id"],
        statut=collecte["statut"],
        latitude=collecte.get("latitude"),
        longitude=collecte.get("longitude"),
        created_at=collecte["created_at"],
        marche_nom=marche.get("nom") if marche else None,
        commune_nom=commune.get("nom") if commune else None,
        produit_nom=produit.get("nom") if produit else None,
        unite_nom=unite.get("unite") if unite else None,
        agent_nom=f"{agent.get('prenom', '')} {agent.get('nom', '')}".strip() if agent else None
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

    # Vérifier que l'unité de mesure existe
    if not ObjectId.is_valid(collecte.unite_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID d'unité de mesure invalide"
        )

    unite = await db.unites_mesure.find_one({"_id": ObjectId(collecte.unite_id)})
    if not unite:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="L'unité de mesure spécifiée n'existe pas"
        )

    # Vérifier les doublons (même marché, produit, unite, date, periode)
    duplicate_query = {
        "marche_id": collecte.marche_id,
        "produit_id": collecte.produit_id,
        "unite_id": collecte.unite_id,
        "date": collecte.date,
        "agent_id": current_user.id
    }

    # Inclure la période si fournie
    if collecte.periode:
        duplicate_query["periode"] = collecte.periode

    existing = await db.collectes.find_one(duplicate_query)

    if existing:
        detail_msg = "Une collecte existe déjà pour ce marché/produit/unité/date"
        if collecte.periode:
            detail_msg += f"/période ({collecte.periode})"
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail_msg
        )

    collecte_dict = collecte.model_dump(exclude_none=False)
    collecte_dict["agent_id"] = current_user.id
    collecte_dict["statut"] = "soumise"
    collecte_dict["created_at"] = datetime.utcnow()
    collecte_dict["synced_at"] = datetime.utcnow()

    result = await db.collectes.insert_one(collecte_dict)
    created_collecte = await db.collectes.find_one({"_id": result.inserted_id})

    return CollecteResponse(
        id=str(created_collecte["_id"]),
        marche_id=created_collecte["marche_id"],
        produit_id=created_collecte["produit_id"],
        unite_id=created_collecte["unite_id"],
        quantite=created_collecte.get("quantite", 1),
        prix=created_collecte["prix"],
        date=created_collecte["date"],
        periode=created_collecte.get("periode"),
        commentaire=created_collecte.get("commentaire"),
        agent_id=created_collecte["agent_id"],
        statut=created_collecte["statut"],
        latitude=created_collecte.get("latitude"),
        longitude=created_collecte.get("longitude"),
        created_at=created_collecte["created_at"],
        unite_nom=unite.get("unite"),
        marche_nom=marche.get("nom"),
        produit_nom=produit.get("nom")
    )


@router.post("/batch", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_collectes_batch(
    batch: CollecteBatchCreate,
    current_user: dict = Depends(get_current_user)
):
    """
    Créer plusieurs collectes de prix en une seule requête.

    Utile pour le système 4 périodes où l'agent entre plusieurs prix à la fois.
    Accessible aux agents uniquement.
    """
    # Vérifier que l'utilisateur est un agent
    if not can_submit_collectes(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seuls les agents peuvent soumettre des collectes"
        )

    if not batch.collectes or len(batch.collectes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La liste de collectes ne peut pas être vide"
        )

    created_count = 0
    skipped_count = 0
    errors = []

    for idx, collecte in enumerate(batch.collectes):
        try:
            # Vérifier ObjectIds
            if not ObjectId.is_valid(collecte.marche_id):
                errors.append(f"Collecte {idx+1}: ID de marché invalide")
                continue
            if not ObjectId.is_valid(collecte.produit_id):
                errors.append(f"Collecte {idx+1}: ID de produit invalide")
                continue
            if not ObjectId.is_valid(collecte.unite_id):
                errors.append(f"Collecte {idx+1}: ID d'unité invalide")
                continue

            # Vérifier que les entités existent
            marche = await db.marches.find_one({"_id": ObjectId(collecte.marche_id)})
            if not marche:
                errors.append(f"Collecte {idx+1}: Marché non trouvé")
                continue

            produit = await db.produits.find_one({"_id": ObjectId(collecte.produit_id)})
            if not produit:
                errors.append(f"Collecte {idx+1}: Produit non trouvé")
                continue

            unite = await db.unites_mesure.find_one({"_id": ObjectId(collecte.unite_id)})
            if not unite:
                errors.append(f"Collecte {idx+1}: Unité non trouvée")
                continue

            # Vérifier les doublons
            duplicate_query = {
                "marche_id": collecte.marche_id,
                "produit_id": collecte.produit_id,
                "unite_id": collecte.unite_id,
                "date": collecte.date,
                "agent_id": current_user.id
            }
            if collecte.periode:
                duplicate_query["periode"] = collecte.periode

            existing = await db.collectes.find_one(duplicate_query)
            if existing:
                skipped_count += 1
                continue

            # Créer la collecte
            collecte_dict = collecte.model_dump(exclude_none=False)
            collecte_dict["agent_id"] = current_user.id
            collecte_dict["statut"] = "soumise"
            collecte_dict["created_at"] = datetime.utcnow()
            collecte_dict["synced_at"] = datetime.utcnow()

            await db.collectes.insert_one(collecte_dict)
            created_count += 1

        except Exception as e:
            errors.append(f"Collecte {idx+1}: {str(e)}")

    return {
        "message": f"{created_count} collecte(s) créée(s) avec succès",
        "created": created_count,
        "skipped": skipped_count,
        "errors": errors
    }


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

    existing = await db.collectes.find_one({"_id": ObjectId(collecte_id)})
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

    collecte_dict = collecte.model_dump(exclude_none=False)
    collecte_dict["updated_at"] = datetime.utcnow()

    await db.collectes.update_one(
        {"_id": ObjectId(collecte_id)},
        {"$set": collecte_dict}
    )

    updated_collecte = await db.collectes.find_one({"_id": ObjectId(collecte_id)})

    # Enrichir avec les noms
    marche = await db.marches.find_one({"_id": ObjectId(updated_collecte["marche_id"])})
    commune = await db.communes.find_one({"_id": ObjectId(marche["commune_id"])}) if marche and marche.get("commune_id") else None
    produit = await db.produits.find_one({"_id": ObjectId(updated_collecte["produit_id"])})
    unite = await db.unites_mesure.find_one({"_id": ObjectId(updated_collecte["unite_id"])}) if updated_collecte.get("unite_id") else None
    agent = await db.users.find_one({"_id": ObjectId(updated_collecte["agent_id"])})

    return CollecteResponse(
        id=str(updated_collecte["_id"]),
        marche_id=updated_collecte["marche_id"],
        produit_id=updated_collecte["produit_id"],
        unite_id=updated_collecte.get("unite_id", ""),
        quantite=updated_collecte.get("quantite", 1),
        prix=updated_collecte["prix"],
        date=updated_collecte["date"],
        periode=updated_collecte.get("periode"),
        commentaire=updated_collecte.get("commentaire"),
        agent_id=updated_collecte["agent_id"],
        statut=updated_collecte["statut"],
        latitude=updated_collecte.get("latitude"),
        longitude=updated_collecte.get("longitude"),
        created_at=updated_collecte["created_at"],
        marche_nom=marche.get("nom") if marche else None,
        commune_nom=commune.get("nom") if commune else None,
        produit_nom=produit.get("nom") if produit else None,
        unite_nom=unite.get("unite") if unite else None,
        agent_nom=f"{agent.get('prenom', '')} {agent.get('nom', '')}".strip() if agent else None
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

    existing = await db.collectes.find_one({"_id": ObjectId(collecte_id)})
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

    await db.collectes.delete_one({"_id": ObjectId(collecte_id)})

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

    collecte = await db.collectes.find_one({"_id": ObjectId(collecte_id)})
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

    await db.collectes.update_one(
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

    updated_collecte = await db.collectes.find_one({"_id": ObjectId(collecte_id)})

    # Générer des alertes automatiquement
    try:
        from backend.routers.alertes import generer_alertes_pour_collecte
        await generer_alertes_pour_collecte(collecte_id)
    except Exception as e:
        # Ne pas bloquer la validation si la génération d'alertes échoue
        import logging
        logging.error(f"Erreur lors de la génération d'alertes: {e}")

    # Enrichir avec les noms
    marche = await db.marches.find_one({"_id": ObjectId(updated_collecte["marche_id"])})
    commune = await db.communes.find_one({"_id": ObjectId(marche["commune_id"])}) if marche and marche.get("commune_id") else None
    produit = await db.produits.find_one({"_id": ObjectId(updated_collecte["produit_id"])})
    unite = await db.unites_mesure.find_one({"_id": ObjectId(updated_collecte["unite_id"])}) if updated_collecte.get("unite_id") else None
    agent = await db.users.find_one({"_id": ObjectId(updated_collecte["agent_id"])})

    return CollecteResponse(
        id=str(updated_collecte["_id"]),
        marche_id=updated_collecte["marche_id"],
        produit_id=updated_collecte["produit_id"],
        unite_id=updated_collecte.get("unite_id", ""),
        quantite=updated_collecte.get("quantite", 1),
        prix=updated_collecte["prix"],
        date=updated_collecte["date"],
        periode=updated_collecte.get("periode"),
        commentaire=updated_collecte.get("commentaire"),
        agent_id=updated_collecte["agent_id"],
        statut=updated_collecte["statut"],
        latitude=updated_collecte.get("latitude"),
        longitude=updated_collecte.get("longitude"),
        created_at=updated_collecte["created_at"],
        marche_nom=marche.get("nom") if marche else None,
        commune_nom=commune.get("nom") if commune else None,
        produit_nom=produit.get("nom") if produit else None,
        unite_nom=unite.get("unite") if unite else None,
        agent_nom=f"{agent.get('prenom', '')} {agent.get('nom', '')}".strip() if agent else None
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

    collecte = await db.collectes.find_one({"_id": ObjectId(collecte_id)})
    if not collecte:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Collecte non trouvée"
        )

    await db.collectes.update_one(
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

    updated_collecte = await db.collectes.find_one({"_id": ObjectId(collecte_id)})

    # Enrichir avec les noms
    marche = await db.marches.find_one({"_id": ObjectId(updated_collecte["marche_id"])})
    commune = await db.communes.find_one({"_id": ObjectId(marche["commune_id"])}) if marche and marche.get("commune_id") else None
    produit = await db.produits.find_one({"_id": ObjectId(updated_collecte["produit_id"])})
    unite = await db.unites_mesure.find_one({"_id": ObjectId(updated_collecte["unite_id"])}) if updated_collecte.get("unite_id") else None
    agent = await db.users.find_one({"_id": ObjectId(updated_collecte["agent_id"])})

    return CollecteResponse(
        id=str(updated_collecte["_id"]),
        marche_id=updated_collecte["marche_id"],
        produit_id=updated_collecte["produit_id"],
        unite_id=updated_collecte.get("unite_id", ""),
        quantite=updated_collecte.get("quantite", 1),
        prix=updated_collecte["prix"],
        date=updated_collecte["date"],
        periode=updated_collecte.get("periode"),
        commentaire=updated_collecte.get("commentaire"),
        agent_id=updated_collecte["agent_id"],
        statut=updated_collecte["statut"],
        latitude=updated_collecte.get("latitude"),
        longitude=updated_collecte.get("longitude"),
        created_at=updated_collecte["created_at"],
        marche_nom=marche.get("nom") if marche else None,
        commune_nom=commune.get("nom") if commune else None,
        produit_nom=produit.get("nom") if produit else None,
        unite_nom=unite.get("unite") if unite else None,
        agent_nom=f"{agent.get('prenom', '')} {agent.get('nom', '')}".strip() if agent else None
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
    total = await db.collectes.count_documents(query)

    # Répartition par statut
    pipeline_statut = [
        {"$match": query},
        {"$group": {"_id": "$statut", "count": {"$sum": 1}}}
    ]
    statuts = await db.collectes.aggregate(pipeline_statut).to_list(None)

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
        agents = await db.collectes.aggregate(pipeline_agent).to_list(None)
        stats["par_agent"] = {a["_id"]: a["count"] for a in agents}

    return stats
