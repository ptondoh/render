"""
Router pour le système d'alertes de sécurité alimentaire.
Calcul automatique basé sur les variations de prix et seuils.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional
from datetime import datetime, timedelta
from bson import ObjectId

from backend.models import MessageResponse
from backend.middleware.security import get_current_user
from backend.middleware.rbac import require_role
from backend.database import db

router = APIRouter(prefix="/api/alertes", tags=["Alertes"])


# Seuils de variation de prix pour déclenchement des alertes
SEUILS_ALERTES = {
    "surveillance": 15,  # +15% par rapport au prix de référence
    "alerte": 30,        # +30%
    "urgence": 50        # +50%
}


async def calculer_prix_reference(produit_id: str, marche_id: Optional[str] = None) -> Optional[float]:
    """
    Calculer le prix de référence pour un produit.
    Utilise la moyenne des 30 derniers jours de collectes validées.
    """
    date_limite = datetime.utcnow() - timedelta(days=30)

    query = {
        "produit_id": produit_id,
        "statut": "validee",
        "date": {"$gte": date_limite}
    }

    if marche_id:
        query["marche_id"] = marche_id

    pipeline = [
        {"$match": query},
        {"$group": {
            "_id": None,
            "prix_moyen": {"$avg": "$prix"},
            "prix_min": {"$min": "$prix"},
            "prix_max": {"$max": "$prix"},
            "count": {"$sum": 1}
        }}
    ]

    result = await db.collectes_prix.aggregate(pipeline).to_list(None)

    if result and result[0]["count"] >= 3:  # Minimum 3 collectes pour calculer
        return result[0]["prix_moyen"]

    return None


def determiner_niveau_alerte(prix_actuel: float, prix_reference: float) -> str:
    """
    Déterminer le niveau d'alerte basé sur l'écart entre prix actuel et référence.
    """
    if prix_reference <= 0:
        return "normal"

    ecart_pourcent = ((prix_actuel - prix_reference) / prix_reference) * 100

    if ecart_pourcent >= SEUILS_ALERTES["urgence"]:
        return "urgence"
    elif ecart_pourcent >= SEUILS_ALERTES["alerte"]:
        return "alerte"
    elif ecart_pourcent >= SEUILS_ALERTES["surveillance"]:
        return "surveillance"
    else:
        return "normal"


async def generer_alertes_pour_collecte(collecte_id: str):
    """
    Générer des alertes automatiquement après validation d'une collecte.
    Appelé par le endpoint de validation des collectes.
    """
    collecte = await db.collectes_prix.find_one({"_id": ObjectId(collecte_id)})
    if not collecte or collecte["statut"] != "validée":
        return

    # Calculer le prix de référence
    prix_ref = await calculer_prix_reference(
        collecte["produit_id"],
        collecte["marche_id"]
    )

    if not prix_ref:
        return  # Pas assez de données historiques

    # Déterminer le niveau d'alerte
    niveau = determiner_niveau_alerte(collecte["prix"], prix_ref)

    if niveau == "normal":
        # Prix revenu à la normale : fermer l'alerte existante si elle existe
        existing_alerte = await db.alertes.find_one({
            "marche_id": collecte["marche_id"],
            "produit_id": collecte["produit_id"],
            "statut": "active"
        })

        if existing_alerte:
            await db.alertes.update_one(
                {"_id": existing_alerte["_id"]},
                {
                    "$set": {
                        "statut": "resolue",
                        "resolved_at": datetime.utcnow(),
                        "updated_at": datetime.utcnow()
                    }
                }
            )

        return  # Pas besoin de créer une nouvelle alerte

    # Calculer l'écart en pourcentage
    ecart_pourcent = ((collecte["prix"] - prix_ref) / prix_ref) * 100

    # Vérifier si une alerte existe déjà pour ce marché/produit (active)
    # On ne filtre PAS par niveau pour éviter les doublons si le niveau change
    existing_alerte = await db.alertes.find_one({
        "marche_id": collecte["marche_id"],
        "produit_id": collecte["produit_id"],
        "statut": "active"
    })

    if existing_alerte:
        # Mettre à jour l'alerte existante avec le nouveau niveau et prix
        await db.alertes.update_one(
            {"_id": existing_alerte["_id"]},
            {
                "$set": {
                    "niveau": niveau,  # IMPORTANT: mettre à jour le niveau aussi
                    "prix_actuel": collecte["prix"],
                    "prix_reference": prix_ref,
                    "ecart_pourcentage": ecart_pourcent,
                    "updated_at": datetime.utcnow()
                }
            }
        )
    else:
        # Créer une nouvelle alerte
        alerte = {
            "niveau": niveau,
            "type_alerte": "prix_eleve",
            "marche_id": collecte["marche_id"],
            "produit_id": collecte["produit_id"],
            "prix_actuel": collecte["prix"],
            "prix_reference": prix_ref,
            "ecart_pourcentage": ecart_pourcent,
            "statut": "active",
            "vue_par": [],
            "created_at": datetime.utcnow()
        }

        await db.alertes.insert_one(alerte)


@router.get("", response_model=List[dict])
async def get_alertes(
    niveau: Optional[str] = Query(None, description="Filtrer par niveau (surveillance, alerte, urgence)"),
    statut: Optional[str] = Query(None, description="Filtrer par statut (active, resolue, fermee)"),
    marche_id: Optional[str] = Query(None, description="Filtrer par marché"),
    produit_id: Optional[str] = Query(None, description="Filtrer par produit"),
    limit: int = Query(50, le=200, description="Nombre max de résultats"),
    current_user: dict = Depends(get_current_user)
):
    """
    Liste les alertes avec filtres optionnels.
    Accessible à tous les rôles authentifiés.
    """
    query = {}

    if niveau:
        query["niveau"] = niveau
    if statut:
        query["statut"] = statut
    else:
        query["statut"] = "active"  # Par défaut, alertes actives uniquement

    if marche_id:
        query["marche_id"] = marche_id
    if produit_id:
        query["produit_id"] = produit_id

    alertes = await db.alertes.find(query).sort("created_at", -1).limit(limit).to_list(None)

    # Enrichir avec les noms de marché et produit
    result = []
    for alerte in alertes:
        # Récupérer le nom du marché
        marche = await db.marches.find_one({"_id": ObjectId(alerte["marche_id"])})
        marche_nom = marche["nom"] if marche else "Inconnu"

        # Récupérer le nom du produit
        produit = await db.produits.find_one({"_id": ObjectId(alerte["produit_id"])})
        produit_nom = produit["nom"] if produit else "Inconnu"

        # Récupérer la commune via le marché
        commune_nom = None
        departement_nom = None
        if marche and marche.get("commune_id"):
            commune = await db.communes.find_one({"_id": ObjectId(marche["commune_id"])})
            if commune:
                commune_nom = commune["nom"]
                if commune.get("departement_id"):
                    dept = await db.departements.find_one({"_id": ObjectId(commune["departement_id"])})
                    if dept:
                        departement_nom = dept["nom"]

        # Extraire les coordonnées GPS du marché
        marche_gps = None
        if marche:
            if marche.get("latitude") and marche.get("longitude"):
                marche_gps = {
                    "latitude": marche["latitude"],
                    "longitude": marche["longitude"]
                }
            elif marche.get("location") and marche["location"].get("coordinates"):
                # Format GeoJSON: coordinates = [longitude, latitude]
                coords = marche["location"]["coordinates"]
                marche_gps = {
                    "latitude": coords[1],
                    "longitude": coords[0]
                }

        result.append({
            "id": str(alerte["_id"]),
            "niveau": alerte["niveau"],
            "type_alerte": alerte["type_alerte"],
            "marche_id": alerte["marche_id"],
            "marche_nom": marche_nom,
            "marche_gps": marche_gps,
            "commune_id": marche.get('commune_id') if marche else None,
            "commune_nom": commune_nom,
            "departement_id": commune.get('departement_id') if commune else None,
            "departement_nom": departement_nom,
            "produit_id": alerte["produit_id"],
            "produit_nom": produit_nom,
            "prix_actuel": alerte["prix_actuel"],
            "prix_reference": alerte["prix_reference"],
            "ecart_pourcentage": alerte["ecart_pourcentage"],
            "statut": alerte["statut"],
            "created_at": alerte["created_at"],
            "vue": current_user.id in alerte.get("vue_par", [])
        })

    return result


@router.get("/{alerte_id}", response_model=dict)
async def get_alerte(
    alerte_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Récupérer une alerte par son ID.
    """
    if not ObjectId.is_valid(alerte_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID d'alerte invalide"
        )

    alerte = await db.alertes.find_one({"_id": ObjectId(alerte_id)})
    if not alerte:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alerte non trouvée"
        )

    # Enrichir avec les noms
    marche = await db.marches.find_one({"_id": ObjectId(alerte["marche_id"])})
    produit = await db.produits.find_one({"_id": ObjectId(alerte["produit_id"])})

    return {
        "id": str(alerte["_id"]),
        "niveau": alerte["niveau"],
        "type_alerte": alerte["type_alerte"],
        "marche_id": alerte["marche_id"],
        "marche_nom": marche["nom"] if marche else "Inconnu",
        "produit_id": alerte["produit_id"],
        "produit_nom": produit["nom"] if produit else "Inconnu",
        "prix_actuel": alerte["prix_actuel"],
        "prix_reference": alerte["prix_reference"],
        "ecart_pourcentage": alerte["ecart_pourcentage"],
        "statut": alerte["statut"],
        "vue_par": alerte.get("vue_par", []),
        "created_at": alerte["created_at"],
        "resolved_at": alerte.get("resolved_at")
    }


@router.post("/{alerte_id}/marquer-vue", response_model=MessageResponse)
async def marquer_alerte_vue(
    alerte_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Marquer une alerte comme vue par l'utilisateur actuel.
    """
    if not ObjectId.is_valid(alerte_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID d'alerte invalide"
        )

    alerte = await db.alertes.find_one({"_id": ObjectId(alerte_id)})
    if not alerte:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alerte non trouvée"
        )

    # Ajouter l'utilisateur à la liste vue_par s'il n'y est pas déjà
    if current_user.id not in alerte.get("vue_par", []):
        await db.alertes.update_one(
            {"_id": ObjectId(alerte_id)},
            {"$addToSet": {"vue_par": current_user.id}}
        )

    return MessageResponse(message="Alerte marquée comme vue")


@router.post("/{alerte_id}/resoudre", response_model=MessageResponse)
async def resoudre_alerte(
    alerte_id: str,
    current_user: dict = Depends(require_role(["décideur"]))
):
    """
    Marquer une alerte comme résolue.
    Réservé aux décideurs.
    """
    if not ObjectId.is_valid(alerte_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID d'alerte invalide"
        )

    alerte = await db.alertes.find_one({"_id": ObjectId(alerte_id)})
    if not alerte:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alerte non trouvée"
        )

    if alerte["statut"] == "resolue":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cette alerte est déjà résolue"
        )

    await db.alertes.update_one(
        {"_id": ObjectId(alerte_id)},
        {
            "$set": {
                "statut": "resolue",
                "resolved_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
        }
    )

    return MessageResponse(message="Alerte résolue avec succès")


@router.get("/statistiques/resume", response_model=dict)
async def get_statistiques_alertes(
    date_debut: Optional[str] = Query(None, description="Date début (YYYY-MM-DD)"),
    date_fin: Optional[str] = Query(None, description="Date fin (YYYY-MM-DD)"),
    current_user: dict = Depends(get_current_user)
):
    """
    Obtenir des statistiques sur les alertes.

    Retourne:
    - Nombre total d'alertes actives
    - Répartition par niveau (surveillance, alerte, urgence)
    - Répartition par département
    - Tendances sur la période
    """
    query = {"statut": "active"}

    # Filtre par période
    if date_debut or date_fin:
        date_query = {}
        if date_debut:
            date_query["$gte"] = datetime.fromisoformat(date_debut)
        if date_fin:
            date_query["$lte"] = datetime.fromisoformat(date_fin)
        query["created_at"] = date_query

    # Compter total
    total = await db.alertes.count_documents(query)

    # Répartition par niveau
    pipeline_niveau = [
        {"$match": query},
        {"$group": {"_id": "$niveau", "count": {"$sum": 1}}}
    ]
    niveaux = await db.alertes.aggregate(pipeline_niveau).to_list(None)

    # Répartition par type
    pipeline_type = [
        {"$match": query},
        {"$group": {"_id": "$type_alerte", "count": {"$sum": 1}}}
    ]
    types = await db.alertes.aggregate(pipeline_type).to_list(None)

    stats = {
        "total_alertes_actives": total,
        "par_niveau": {n["_id"]: n["count"] for n in niveaux},
        "par_type": {t["_id"]: t["count"] for t in types},
        "periode": {
            "debut": date_debut,
            "fin": date_fin
        }
    }

    return stats


@router.post("/generer", response_model=MessageResponse)
async def generer_alertes_manuellement(
    current_user: dict = Depends(require_role(["décideur"]))
):
    """
    Générer des alertes manuellement en analysant toutes les collectes récentes.
    Réservé aux décideurs.
    Utile pour recalculer les alertes ou initialiser le système.
    """
    # Récupérer les collectes validées des 7 derniers jours
    date_limite = datetime.utcnow() - timedelta(days=7)

    collectes = await db.collectes_prix.find({
        "statut": "validee",
        "date": {"$gte": date_limite}
    }).to_list(None)

    alertes_creees = 0

    for collecte in collectes:
        # Calculer le prix de référence
        prix_ref = await calculer_prix_reference(
            collecte["produit_id"],
            collecte["marche_id"]
        )

        if not prix_ref:
            continue

        # Déterminer le niveau d'alerte
        niveau = determiner_niveau_alerte(collecte["prix"], prix_ref)

        if niveau == "normal":
            continue

        # Calculer l'écart
        ecart_pourcent = ((collecte["prix"] - prix_ref) / prix_ref) * 100

        # Vérifier si une alerte existe déjà pour ce marché/produit (active)
        # On ne filtre PAS par niveau pour éviter les doublons
        existing = await db.alertes.find_one({
            "marche_id": collecte["marche_id"],
            "produit_id": collecte["produit_id"],
            "statut": "active"
        })

        if existing:
            # Mettre à jour l'alerte existante avec les nouvelles données
            await db.alertes.update_one(
                {"_id": existing["_id"]},
                {
                    "$set": {
                        "niveau": niveau,
                        "prix_actuel": collecte["prix"],
                        "prix_reference": prix_ref,
                        "ecart_pourcentage": ecart_pourcent,
                        "updated_at": datetime.utcnow()
                    }
                }
            )
        else:
            # Créer une nouvelle alerte
            alerte = {
                "niveau": niveau,
                "type_alerte": "prix_eleve",
                "marche_id": collecte["marche_id"],
                "produit_id": collecte["produit_id"],
                "prix_actuel": collecte["prix"],
                "prix_reference": prix_ref,
                "ecart_pourcentage": ecart_pourcent,
                "statut": "active",
                "vue_par": [],
                "created_at": datetime.utcnow()
            }

            await db.alertes.insert_one(alerte)
            alertes_creees += 1

    return MessageResponse(
        message=f"{alertes_creees} alerte(s) générée(s) avec succès"
    )
