"""
Router Module 6 - Tableau de bord pour décideurs.
Fournit les KPIs nationaux, indicateurs détaillés et drill-down géographique.
Accès réservé aux rôles 'décideur' et 'bailleur'.

Optimisations :
- Les endpoints utilisent des requêtes batch (asyncio.gather) au lieu de boucles N+1.
  Le nombre de requêtes MongoDB passe de ~30-100 à 4-6 par endpoint.
"""

import asyncio
from fastapi import APIRouter, Depends, Query, HTTPException, status
from typing import Optional
from datetime import datetime, timedelta
from bson import ObjectId

from backend.middleware.security import get_current_user
from backend.middleware.rbac import require_role
from backend.database import db

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])

# Rôles autorisés pour ce module
ROLES_DASHBOARD = ["décideur", "bailleur"]

# Seuils d'alerte (mêmes que dans alertes.py)
SEUILS = {"surveillance": 15, "alerte": 30, "urgence": 50}

# Ordre de priorité des niveaux (pour tri et comparaison)
NIVEAUX_PRIORITE = {"urgence": 4, "alerte": 3, "surveillance": 2, "normal": 1}

# Libellé couleur carte
COULEURS_NIVEAU = {
    "normal":       "vert",
    "surveillance": "jaune",
    "alerte":       "orange",
    "urgence":      "rouge"
}


# ─────────────────────────────────────────────────────────────────────────────
# Helpers internes
# ─────────────────────────────────────────────────────────────────────────────

def _sid(doc: dict) -> str:
    """Retourne l'_id ObjectId d'un document converti en str."""
    return str(doc["_id"])


def _niveau_max(alertes: list) -> str:
    """Retourne le niveau d'alerte le plus élevé parmi une liste d'alertes."""
    if not alertes:
        return "normal"
    return max(
        (a.get("niveau", "normal") for a in alertes),
        key=lambda n: NIVEAUX_PRIORITE.get(n, 1)
    )


def _build_lookup(docs: list, key_field: str) -> dict:
    """Construit un dictionnaire {key_field_value → [doc, …]} depuis une liste."""
    index: dict = {}
    for doc in docs:
        k = doc.get(key_field, "")
        index.setdefault(k, []).append(doc)
    return index


def _build_id_map(docs: list) -> dict:
    """Construit un dictionnaire {str(_id) → doc}."""
    return {_sid(doc): doc for doc in docs}


async def _batch_fetch_by_ids(collection, ids: list) -> dict:
    """Récupère des documents par leurs _id (ObjectId) et retourne un dict {str_id → doc}."""
    valid_ids = [ObjectId(i) for i in ids if ObjectId.is_valid(i)]
    if not valid_ids:
        return {}
    docs = await collection.find({"_id": {"$in": valid_ids}}).to_list(None)
    return _build_id_map(docs)


# ─────────────────────────────────────────────────────────────────────────────
# 6.1  Vue d'ensemble nationale
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/national", response_model=dict)
async def get_vue_nationale(
    current_user: dict = Depends(require_role(ROLES_DASHBOARD))
):
    """
    Vue d'ensemble nationale pour décideurs.

    Retourne :
    - Carte : niveaux d'alerte par département (couleur)
    - KPI 1 : Zones par niveau
    - KPI 2 : Population à risque estimée
    - KPI 3 : Évolution 6 mois
    - KPI 4 : Alertes actives
    - KPI 5 : Collectes des 7 derniers jours
    - KPI 6 : Top 5 variations de prix

    Optimisation : 5 requêtes parallèles au lieu de ~30 en séquence.
    """

    maintenant = datetime.utcnow()
    date_6_mois = maintenant - timedelta(days=180)
    date_3_mois = maintenant - timedelta(days=90)
    date_7j     = maintenant - timedelta(days=7)

    # ── 1. Fetch parallèle ────────────────────────────────────────────────
    (
        departements,
        communes_all,
        marches_all,
        alertes_actives_all,
        collectes_recentes
    ) = await asyncio.gather(
        db.departements.find({"actif": True}).to_list(None),
        db.communes.find({"actif": True}).to_list(None),
        db.marches.find({"actif": True}).to_list(None),
        db.alertes.find({"statut": "active"}).to_list(None),
        db.collectes_prix.count_documents({"created_at": {"$gte": date_7j}})
    )

    # ── 2. Index en mémoire ───────────────────────────────────────────────
    communes_by_dept   = _build_lookup(communes_all,     "departement_id")
    marches_by_commune = _build_lookup(marches_all,      "commune_id")
    alertes_by_marche  = _build_lookup(alertes_actives_all, "marche_id")

    # ── 3. Calcul par département (zéro requête BD supplémentaire) ─────────
    carte_departements = []
    zones_par_niveau   = {"normal": 0, "surveillance": 0, "alerte": 0, "urgence": 0}
    population_a_risque = 0

    for dept in departements:
        dept_id  = _sid(dept)
        communes = communes_by_dept.get(dept_id, [])

        marche_ids = [
            _sid(m)
            for c in communes
            for m in marches_by_commune.get(_sid(c), [])
        ]

        alertes_dept = [
            a
            for mid in marche_ids
            for a in alertes_by_marche.get(mid, [])
        ]

        niveau_dept = _niveau_max(alertes_dept)
        zones_par_niveau[niveau_dept] = zones_par_niveau.get(niveau_dept, 0) + 1

        pop_dept = dept.get("population", 0) or 0
        if niveau_dept != "normal":
            population_a_risque += pop_dept

        carte_departements.append({
            "id":          dept_id,
            "code":        dept.get("code", ""),
            "nom":         dept.get("nom", ""),
            "niveau":      niveau_dept,
            "couleur":     COULEURS_NIVEAU.get(niveau_dept, "vert"),
            "nb_alertes":  len(alertes_dept),
            "nb_communes": len(communes),
            "nb_marches":  len(marche_ids),
            "population":  pop_dept
        })

    # ── 4. KPI : Alertes actives ──────────────────────────────────────────
    total_alertes_actives = len(alertes_actives_all)

    # ── 5. KPI : Évolution 6 mois ─────────────────────────────────────────
    alertes_debut, alertes_fin = await asyncio.gather(
        db.alertes.count_documents({
            "created_at": {"$gte": date_6_mois, "$lt": date_3_mois},
            "statut": "active"
        }),
        db.alertes.count_documents({
            "created_at": {"$gte": date_3_mois},
            "statut": "active"
        })
    )

    if alertes_debut > 0:
        tendance_pct = round(((alertes_fin - alertes_debut) / alertes_debut) * 100, 1)
    else:
        tendance_pct = 0.0
    tendance = (
        "dégradation" if tendance_pct > 0
        else "amélioration" if tendance_pct < 0
        else "stable"
    )

    # ── 6. KPI : Prix clés (top 5) ───────────────────────────────────────
    alertes_top5 = sorted(
        alertes_actives_all,
        key=lambda a: a.get("ecart_pourcentage", 0),
        reverse=True
    )[:5]

    prod_ids_top5   = list({a["produit_id"] for a in alertes_top5})
    marche_ids_top5 = list({a["marche_id"]  for a in alertes_top5})

    produits_map, marches_map = await asyncio.gather(
        _batch_fetch_by_ids(db.produits, prod_ids_top5),
        _batch_fetch_by_ids(db.marches,  marche_ids_top5)
    )

    prix_cles = [
        {
            "produit":         produits_map.get(a["produit_id"], {}).get("nom", "Inconnu"),
            "marche":          marches_map.get(a["marche_id"],   {}).get("nom", "Inconnu"),
            "prix_actuel":     round(a.get("prix_actuel",     0), 2),
            "prix_reference":  round(a.get("prix_reference",  0), 2),
            "variation_pct":   round(a.get("ecart_pourcentage", 0), 1),
            "niveau":          a.get("niveau", "normal")
        }
        for a in alertes_top5
    ]

    return {
        "carte": {
            "departements": carte_departements,
            "legende": {
                "vert":   "Situation normale",
                "jaune":  "Surveillance nécessaire",
                "orange": "Alerte active",
                "rouge":  "Urgence critique"
            }
        },
        "kpis": {
            "zones_par_niveau":   zones_par_niveau,
            "population_a_risque": population_a_risque,
            "evolution_6_mois": {
                "tendance":      tendance,
                "variation_pct": tendance_pct
            },
            "alertes_actives":    total_alertes_actives,
            "interventions_actives": collectes_recentes,
            "prix_cles":          prix_cles
        },
        "meta": {
            "genere_a":       maintenant.isoformat(),
            "nb_departements": len(departements)
        }
    }


# ─────────────────────────────────────────────────────────────────────────────
# 6.2  Indicateurs détaillés
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/indicateurs", response_model=dict)
async def get_indicateurs(
    type_indicateur: str = Query(
        "top10",
        description="Type: top10 | prix | pluviometrie | historique"
    ),
    produit_ids: Optional[str] = Query(None, description="IDs produits séparés par virgule"),
    marche_ids:  Optional[str] = Query(None, description="IDs marchés séparés par virgule"),
    periode: Optional[str] = Query("mois", description="Période: semaine | mois | trimestre | annee"),
    current_user: dict = Depends(require_role(ROLES_DASHBOARD))
):
    """
    Indicateurs détaillés pour analyse approfondie.

    Types disponibles :
    - top10       : Top 10 zones à risque classées par gravité
    - prix        : Évolution des prix par produit et marché
    - pluviometrie: Situation pluviométrique (données proxy)
    - historique  : Timeline historique des alertes

    Optimisation : requêtes batch — 4 à 6 requêtes par type.
    """

    maintenant = datetime.utcnow()
    periodes = {
        "semaine":   timedelta(days=7),
        "mois":      timedelta(days=30),
        "trimestre": timedelta(days=90),
        "annee":     timedelta(days=365)
    }
    delta      = periodes.get(periode, timedelta(days=30))
    date_debut = maintenant - delta

    # ── TOP 10 ZONES À RISQUE ─────────────────────────────────────────────
    if type_indicateur == "top10":
        date_30j = maintenant - timedelta(days=30)

        alertes_actives_all, alertes_hist_all = await asyncio.gather(
            db.alertes.find({"statut": "active"}).sort("ecart_pourcentage", -1).to_list(None),
            db.alertes.find({"created_at": {"$gte": date_30j}}).sort("created_at", 1).to_list(None)
        )

        # Batch fetch de toutes les entités nécessaires
        all_marche_ids  = list({a["marche_id"]  for a in alertes_actives_all + alertes_hist_all})
        all_produit_ids = list({a["produit_id"] for a in alertes_actives_all + alertes_hist_all})

        marches_map, produits_map = await asyncio.gather(
            _batch_fetch_by_ids(db.marches,  all_marche_ids),
            _batch_fetch_by_ids(db.produits, all_produit_ids)
        )

        # Enrichir avec communes et départements
        commune_ids = list({
            m.get("commune_id", "")
            for m in marches_map.values()
            if m.get("commune_id")
        })
        communes_map = await _batch_fetch_by_ids(db.communes, commune_ids)

        dept_ids = list({
            c.get("departement_id", "")
            for c in communes_map.values()
            if c.get("departement_id")
        })
        depts_map = await _batch_fetch_by_ids(db.departements, dept_ids)

        # Construire le classement par marché
        marches_score: dict = {}
        for a in alertes_actives_all:
            mid    = a["marche_id"]
            marche = marches_map.get(mid, {})

            if mid not in marches_score:
                commune = communes_map.get(marche.get("commune_id", ""), {})
                dept    = depts_map.get(commune.get("departement_id", ""), {})

                marches_score[mid] = {
                    "marche_id":  mid,
                    "marche_nom": marche.get("nom", "Inconnu"),
                    "commune":    commune.get("nom", "Inconnu"),
                    "departement": dept.get("nom", "Inconnu"),
                    "latitude":   marche.get("latitude"),
                    "longitude":  marche.get("longitude"),
                    "score_max":  0,
                    "niveau_max": "normal",
                    "nb_alertes": 0,
                    "alertes":    []
                }

            score = a.get("ecart_pourcentage", 0)
            entry = marches_score[mid]
            entry["nb_alertes"] += 1
            if score > entry["score_max"]:
                entry["score_max"]  = round(score, 1)
                entry["niveau_max"] = a.get("niveau", "normal")

            entry["alertes"].append({
                "produit":    produits_map.get(a["produit_id"], {}).get("nom", "Inconnu"),
                "variation":  round(a.get("ecart_pourcentage", 0), 1),
                "niveau":     a.get("niveau", "normal"),
                "prix_actuel": round(a.get("prix_actuel", 0), 2)
            })

        top10 = sorted(marches_score.values(), key=lambda x: x["score_max"], reverse=True)[:10]
        for i, z in enumerate(top10):
            z["rang"] = i + 1

        # Timeline 30 jours
        timeline = [
            {
                "date":      a["created_at"].isoformat(),
                "marche":    marches_map.get(a["marche_id"],  {}).get("nom", "Inconnu"),
                "produit":   produits_map.get(a["produit_id"],{}).get("nom", "Inconnu"),
                "niveau":    a.get("niveau", "normal"),
                "statut":    a.get("statut", "active"),
                "variation": round(a.get("ecart_pourcentage", 0), 1)
            }
            for a in alertes_hist_all
        ]

        return {
            "type":        "top10",
            "top10_zones": top10,
            "timeline":    timeline,
            "periode":     periode,
            "date_debut":  date_debut.isoformat(),
            "date_fin":    maintenant.isoformat()
        }

    # ── ÉVOLUTION DES PRIX ────────────────────────────────────────────────
    elif type_indicateur == "prix":
        query_collectes: dict = {
            "statut": "validee",
            "date":   {"$gte": date_debut}
        }

        if produit_ids:
            prod_list = [p.strip() for p in produit_ids.split(",") if p.strip()]
            query_collectes["produit_id"] = {"$in": prod_list}

        if marche_ids:
            marche_list = [m.strip() for m in marche_ids.split(",") if m.strip()]
            query_collectes["marche_id"] = {"$in": marche_list}

        pipeline = [
            {"$match": query_collectes},
            {"$group": {
                "_id": {
                    "produit_id": "$produit_id",
                    "marche_id":  "$marche_id",
                    "jour":       {"$dateToString": {"format": "%Y-%m-%d", "date": "$date"}}
                },
                "prix_moyen":   {"$avg": "$prix"},
                "prix_min":     {"$min": "$prix"},
                "prix_max":     {"$max": "$prix"},
                "nb_collectes": {"$sum": 1}
            }},
            {"$sort": {"_id.jour": 1}}
        ]

        resultats, tous_produits, tous_marches = await asyncio.gather(
            db.collectes_prix.aggregate(pipeline).to_list(None),
            db.produits.find({"actif": True}).to_list(None),
            db.marches.find({"actif": True}).to_list(None)
        )

        # Batch fetch des noms de produits / marchés référencés
        needed_prod_ids   = list({r["_id"]["produit_id"] for r in resultats})
        needed_marche_ids = list({r["_id"]["marche_id"]  for r in resultats})
        produits_map, marches_map = await asyncio.gather(
            _batch_fetch_by_ids(db.produits, needed_prod_ids),
            _batch_fetch_by_ids(db.marches,  needed_marche_ids)
        )

        series: dict = {}
        for r in resultats:
            pid = r["_id"]["produit_id"]
            mid = r["_id"]["marche_id"]
            cle = f"{pid}_{mid}"

            if cle not in series:
                series[cle] = {
                    "produit_id": pid,
                    "produit":    produits_map.get(pid, {}).get("nom", "Inconnu"),
                    "marche_id":  mid,
                    "marche":     marches_map.get(mid, {}).get("nom", "Inconnu"),
                    "donnees":    []
                }

            series[cle]["donnees"].append({
                "date":         r["_id"]["jour"],
                "prix_moyen":   round(r["prix_moyen"], 2),
                "prix_min":     round(r["prix_min"],   2),
                "prix_max":     round(r["prix_max"],   2),
                "nb_collectes": r["nb_collectes"]
            })

        return {
            "type":    "prix",
            "series":  list(series.values()),
            "produits_disponibles": [{"id": str(p["_id"]), "nom": p["nom"]} for p in tous_produits],
            "marches_disponibles":  [{"id": str(m["_id"]), "nom": m["nom"]} for m in tous_marches],
            "periode":    periode,
            "date_debut": date_debut.isoformat(),
            "date_fin":   maintenant.isoformat()
        }

    # ── SITUATION PLUVIOMÉTRIQUE (données proxy) ───────────────────────────
    elif type_indicateur == "pluviometrie":
        date_7j = maintenant - timedelta(days=7)

        departements, communes_all, marches_all = await asyncio.gather(
            db.departements.find({"actif": True}).to_list(None),
            db.communes.find({"actif": True}).to_list(None),
            db.marches.find({"actif": True}).to_list(None)
        )

        communes_by_dept   = _build_lookup(communes_all, "departement_id")
        marches_by_commune = _build_lookup(marches_all,  "commune_id")

        # Récupérer toutes les alertes actives et collectes récentes en une fois
        all_marche_ids = [_sid(m) for m in marches_all]

        alertes_count_map: dict = {}
        collectes_count_map: dict = {}

        if all_marche_ids:
            alertes_active_all = await db.alertes.find(
                {"marche_id": {"$in": all_marche_ids}, "statut": "active"}
            ).to_list(None)
            collectes_7j_all = await db.collectes_prix.find(
                {"marche_id": {"$in": all_marche_ids}, "date": {"$gte": date_7j}}
            ).to_list(None)

            for a in alertes_active_all:
                mid = a.get("marche_id", "")
                alertes_count_map[mid] = alertes_count_map.get(mid, 0) + 1
            for c in collectes_7j_all:
                mid = c.get("marche_id", "")
                collectes_count_map[mid] = collectes_count_map.get(mid, 0) + 1

        zones_meteo = []
        for dept in departements:
            dept_id  = _sid(dept)
            communes = communes_by_dept.get(dept_id, [])

            dept_marche_ids = [
                _sid(m)
                for c in communes
                for m in marches_by_commune.get(_sid(c), [])
            ]

            nb_alertes  = sum(alertes_count_map.get(mid, 0)  for mid in dept_marche_ids)
            collectes_7 = sum(collectes_count_map.get(mid, 0) for mid in dept_marche_ids)

            nb_marches   = len(dept_marche_ids) or 1
            score_stress = min(100, round((nb_alertes / nb_marches) * 100, 1))
            spi_proxy    = round(-score_stress / 20, 2)
            jours_sans   = max(0, 7 - min(7, collectes_7))

            zones_meteo.append({
                "departement_id":  dept_id,
                "departement":     dept.get("nom", ""),
                "code":            dept.get("code", ""),
                "score_stress":    score_stress,
                "spi":             spi_proxy,
                "jours_sans_activite": jours_sans,
                "nb_alertes":      nb_alertes,
                "nb_marches":      nb_marches,
                "statut": (
                    "urgence"     if score_stress >= 50
                    else "alerte"      if score_stress >= 30
                    else "surveillance" if score_stress >= 15
                    else "normal"
                )
            })

        zones_meteo.sort(key=lambda z: z["score_stress"], reverse=True)

        return {
            "type":  "pluviometrie",
            "note":  "Données proxy basées sur l'activité des marchés (données météo réelles à intégrer)",
            "zones": zones_meteo,
            "date_calcul": maintenant.isoformat()
        }

    # ── HISTORIQUE DES ALERTES (timeline) ────────────────────────────────
    elif type_indicateur == "historique":
        alertes_hist = await db.alertes.find(
            {"created_at": {"$gte": date_debut}}
        ).sort("created_at", -1).to_list(None)

        # Batch fetch
        marche_ids_h  = list({a["marche_id"]  for a in alertes_hist})
        produit_ids_h = list({a["produit_id"] for a in alertes_hist})

        marches_map, produits_map = await asyncio.gather(
            _batch_fetch_by_ids(db.marches,  marche_ids_h),
            _batch_fetch_by_ids(db.produits, produit_ids_h)
        )

        # Enrichir communes / depts
        commune_ids = list({
            marches_map.get(mid, {}).get("commune_id", "")
            for mid in marche_ids_h
            if marches_map.get(mid, {}).get("commune_id")
        })
        communes_map = await _batch_fetch_by_ids(db.communes, commune_ids)

        dept_ids_h = list({
            communes_map.get(cid, {}).get("departement_id", "")
            for cid in commune_ids
            if communes_map.get(cid, {}).get("departement_id")
        })
        depts_map = await _batch_fetch_by_ids(db.departements, dept_ids_h)

        events = []
        for a in alertes_hist:
            marche  = marches_map.get(a["marche_id"],  {})
            produit = produits_map.get(a["produit_id"],{})
            commune = communes_map.get(marche.get("commune_id", ""), {})
            dept    = depts_map.get(commune.get("departement_id", ""), {})

            events.append({
                "id":             str(a["_id"]),
                "date":           a["created_at"].isoformat(),
                "resolved_at":    a.get("resolved_at").isoformat() if a.get("resolved_at") else None,
                "produit":        produit.get("nom", "Inconnu"),
                "marche":         marche.get("nom",  "Inconnu"),
                "commune":        commune.get("nom"),
                "departement":    dept.get("nom"),
                "niveau":         a.get("niveau", "normal"),
                "statut":         a.get("statut", "active"),
                "variation":      round(a.get("ecart_pourcentage", 0), 1),
                "prix_actuel":    round(a.get("prix_actuel",    0), 2),
                "prix_reference": round(a.get("prix_reference", 0), 2)
            })

        par_niveau: dict = {}
        par_statut: dict = {}
        for e in events:
            par_niveau[e["niveau"]] = par_niveau.get(e["niveau"], 0) + 1
            par_statut[e["statut"]] = par_statut.get(e["statut"], 0) + 1

        return {
            "type":   "historique",
            "events": events,
            "statistiques": {
                "total":      len(events),
                "par_niveau": par_niveau,
                "par_statut": par_statut
            },
            "periode":    periode,
            "date_debut": date_debut.isoformat(),
            "date_fin":   maintenant.isoformat()
        }

    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Type invalide. Valeurs acceptées : top10, prix, pluviometrie, historique"
        )


# ─────────────────────────────────────────────────────────────────────────────
# 6.3  Drill-down géographique
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/drilldown", response_model=dict)
async def get_drilldown(
    niveau: str = Query(
        "national",
        description="Niveau: national | departement | commune | section"
    ),
    zone_id: Optional[str] = Query(None, description="ID de la zone à zoomer"),
    current_user: dict = Depends(require_role(ROLES_DASHBOARD))
):
    """
    Drill-down géographique à 4 niveaux.

    Niveaux :
    1. national    → Liste des 10 départements avec alertes
    2. departement → Liste des communes du département (zone_id = id département)
    3. commune     → Profil complet d'une commune (zone_id = id commune)
    4. section     → Réservé pour extension future

    Optimisation : requêtes batch — 4 à 6 requêtes au lieu de ~50+.
    """

    maintenant = datetime.utcnow()

    # ── NIVEAU NATIONAL ──────────────────────────────────────────────────
    if niveau == "national":
        departements, communes_all, marches_all, alertes_all = await asyncio.gather(
            db.departements.find({"actif": True}).to_list(None),
            db.communes.find({"actif": True}).to_list(None),
            db.marches.find({"actif": True}).to_list(None),
            db.alertes.find({"statut": "active"}).to_list(None)
        )

        communes_by_dept   = _build_lookup(communes_all, "departement_id")
        marches_by_commune = _build_lookup(marches_all,  "commune_id")
        alertes_by_marche  = _build_lookup(alertes_all,  "marche_id")

        zones = []
        for dept in departements:
            dept_id  = _sid(dept)
            communes = communes_by_dept.get(dept_id, [])

            marche_ids = [
                _sid(m)
                for c in communes
                for m in marches_by_commune.get(_sid(c), [])
            ]
            alertes_dept = [a for mid in marche_ids for a in alertes_by_marche.get(mid, [])]

            niveau_dept = _niveau_max(alertes_dept)

            zones.append({
                "id":           dept_id,
                "code":         dept.get("code", ""),
                "nom":          dept.get("nom", ""),
                "type":         "departement",
                "niveau":       niveau_dept,
                "couleur":      COULEURS_NIVEAU.get(niveau_dept, "vert"),
                "nb_alertes":   len(alertes_dept),
                "nb_communes":  len(communes),
                "nb_marches":   len(marche_ids),
                "population":   dept.get("population", 0),
                "peut_descendre": True,
                "niveau_suivant": "departement"
            })

        zones.sort(
            key=lambda z: NIVEAUX_PRIORITE.get(z["niveau"], 1),
            reverse=True
        )

        return {
            "niveau_actuel": "national",
            "zones": zones,
            "navigation": {"peut_remonter": False, "niveau_parent": None, "parent_id": None}
        }

    # ── NIVEAU DÉPARTEMENT ───────────────────────────────────────────────
    elif niveau == "departement":
        if not zone_id:
            raise HTTPException(status_code=400, detail="zone_id requis pour le niveau département")
        if not ObjectId.is_valid(zone_id):
            raise HTTPException(status_code=400, detail="zone_id invalide")

        dept, communes_dept_all, marches_all, alertes_all = await asyncio.gather(
            db.departements.find_one({"_id": ObjectId(zone_id)}),
            db.communes.find({"departement_id": zone_id, "actif": True}).to_list(None),
            db.marches.find({"actif": True}).to_list(None),
            db.alertes.find({"statut": "active"}).to_list(None)
        )

        if not dept:
            raise HTTPException(status_code=404, detail="Département non trouvé")

        marches_by_commune = _build_lookup(marches_all, "commune_id")
        alertes_by_marche  = _build_lookup(alertes_all, "marche_id")

        zones = []
        for commune in communes_dept_all:
            commune_id = _sid(commune)
            marches    = marches_by_commune.get(commune_id, [])
            marche_ids = [_sid(m) for m in marches]
            alertes_c  = [a for mid in marche_ids for a in alertes_by_marche.get(mid, [])]
            niveau_c   = _niveau_max(alertes_c)

            zones.append({
                "id":           commune_id,
                "nom":          commune.get("nom", ""),
                "type":         "commune",
                "niveau":       niveau_c,
                "couleur":      COULEURS_NIVEAU.get(niveau_c, "vert"),
                "nb_alertes":   len(alertes_c),
                "nb_marches":   len(marche_ids),
                "population":   commune.get("population", 0),
                "peut_descendre": True,
                "niveau_suivant": "commune"
            })

        zones.sort(key=lambda z: NIVEAUX_PRIORITE.get(z["niveau"], 1), reverse=True)

        return {
            "niveau_actuel": "departement",
            "zone_parent": {
                "id":   zone_id,
                "nom":  dept.get("nom", ""),
                "code": dept.get("code", "")
            },
            "zones": zones,
            "navigation": {
                "peut_remonter": True,
                "niveau_parent": "national",
                "parent_id":     None
            }
        }

    # ── NIVEAU COMMUNE (profil complet) ───────────────────────────────────
    elif niveau == "commune":
        if not zone_id:
            raise HTTPException(status_code=400, detail="zone_id requis pour le niveau commune")
        if not ObjectId.is_valid(zone_id):
            raise HTTPException(status_code=400, detail="zone_id invalide")

        commune = await db.communes.find_one({"_id": ObjectId(zone_id)})
        if not commune:
            raise HTTPException(status_code=404, detail="Commune non trouvée")

        commune_id = _sid(commune)
        dept_id    = commune.get("departement_id")

        date_30j = maintenant - timedelta(days=30)
        date_7j  = maintenant - timedelta(days=7)

        dept, marches_commune = await asyncio.gather(
            db.departements.find_one({"_id": ObjectId(dept_id)}) if dept_id else asyncio.sleep(0),
            db.marches.find({"commune_id": commune_id, "actif": True}).to_list(None)
        )

        marche_ids = [_sid(m) for m in marches_commune]

        if marche_ids:
            alertes_raw, hist_raw, collectes_raw = await asyncio.gather(
                db.alertes.find(
                    {"marche_id": {"$in": marche_ids}, "statut": "active"}
                ).sort("ecart_pourcentage", -1).to_list(None),
                db.alertes.find(
                    {"marche_id": {"$in": marche_ids}, "created_at": {"$gte": date_30j}}
                ).sort("created_at", -1).to_list(None),
                db.collectes_prix.find(
                    {"marche_id": {"$in": marche_ids}, "created_at": {"$gte": date_7j}}
                ).sort("created_at", -1).limit(20).to_list(None)
            )
        else:
            alertes_raw = hist_raw = collectes_raw = []

        # Batch fetch produits pour alertes actives + historique + collectes
        all_prod_ids   = list({a["produit_id"] for a in alertes_raw + hist_raw + collectes_raw})
        all_marche_ids = list({a.get("marche_id", a.get("marche_id", "")) for a in alertes_raw + hist_raw + collectes_raw})

        produits_map, marches_map = await asyncio.gather(
            _batch_fetch_by_ids(db.produits, all_prod_ids),
            _batch_fetch_by_ids(db.marches,  all_marche_ids)
        )

        # Alertes actives
        alertes_actives = [
            {
                "id":             str(a["_id"]),
                "produit":        produits_map.get(a["produit_id"], {}).get("nom", "Inconnu"),
                "marche":         marches_map.get(a["marche_id"],   {}).get("nom", "Inconnu"),
                "niveau":         a.get("niveau", "normal"),
                "variation":      round(a.get("ecart_pourcentage", 0), 1),
                "prix_actuel":    round(a.get("prix_actuel",    0), 2),
                "prix_reference": round(a.get("prix_reference", 0), 2),
                "date":           a["created_at"].isoformat()
            }
            for a in alertes_raw
        ]

        # Historique 30 jours
        historique_alertes = [
            {
                "id":        str(a["_id"]),
                "date":      a["created_at"].isoformat(),
                "produit":   produits_map.get(a["produit_id"], {}).get("nom", "Inconnu"),
                "niveau":    a.get("niveau", "normal"),
                "statut":    a.get("statut", "active"),
                "variation": round(a.get("ecart_pourcentage", 0), 1)
            }
            for a in hist_raw
        ]

        # Interventions (collectes récentes)
        interventions = [
            {
                "date":    c["created_at"].isoformat(),
                "type":    "collecte_prix",
                "produit": produits_map.get(c["produit_id"], {}).get("nom", "Inconnu"),
                "marche":  marches_map.get(c["marche_id"],   {}).get("nom", "Inconnu"),
                "statut":  c.get("statut", "soumise")
            }
            for c in collectes_raw
        ]

        niveau_commune = _niveau_max(alertes_actives)

        profil = {
            "localisation": {
                "commune_id":         commune_id,
                "commune":            commune.get("nom", ""),
                "departement":        dept.get("nom", "") if dept else "Inconnu",
                "departement_id":     dept_id,
                "code_departement":   dept.get("code", "") if dept else ""
            },
            "demographie": {
                "population": commune.get("population", 0),
                "nb_menages": commune.get("nb_menages",  0),
                "densite":    commune.get("densite",     0)
            },
            "situation_securite_alimentaire": {
                "niveau_global":      niveau_commune,
                "couleur":            COULEURS_NIVEAU.get(niveau_commune, "vert"),
                "nb_alertes_actives": len(alertes_actives),
                "nb_marches":         len(marches_commune),
                "alertes_actives":    alertes_actives
            },
            "marches": [
                {
                    "id":        _sid(m),
                    "nom":       m.get("nom", ""),
                    "latitude":  m.get("latitude"),
                    "longitude": m.get("longitude")
                }
                for m in marches_commune
            ],
            "historique_alertes":  historique_alertes,
            "interventions_actives": interventions,
            "notes": commune.get("notes", "")
        }

        return {
            "niveau_actuel": "commune",
            "profil":        profil,
            "navigation": {
                "peut_remonter": True,
                "niveau_parent": "departement",
                "parent_id":     dept_id
            }
        }

    # ── SECTION COMMUNALE (extension future) ─────────────────────────────
    elif niveau == "section":
        return {
            "niveau_actuel": "section",
            "message": "Les sections communales seront disponibles dans une prochaine version.",
            "zones":   [],
            "navigation": {
                "peut_remonter": True,
                "niveau_parent": "commune",
                "parent_id":     zone_id
            }
        }

    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Niveau invalide. Valeurs : national, departement, commune, section"
        )
