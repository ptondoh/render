"""
Script d'initialisation des données de référence pour le SAP.
Ce script insère les données de base nécessaires au fonctionnement du système.

Usage:
    python -m backend.scripts.seed_data
"""

import asyncio
from datetime import datetime
from bson import ObjectId
import sys
import os

# Ajouter le répertoire parent au PYTHONPATH
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from backend.database import get_database, connect_to_mongo, close_mongo_connection


# ============================================================================
# Données de référence
# ============================================================================

UNITES_MESURE = [
    {"unite": "kg", "description": "Kilogramme"},
    {"unite": "livre", "description": "Livre (unité haïtienne)"},
    {"unite": "sac", "description": "Sac"},
    {"unite": "marmite", "description": "Marmite"},
    {"unite": "litre", "description": "Litre"},
    {"unite": "gallon", "description": "Gallon"},
    {"unite": "unité", "description": "Pièce unitaire"},
    {"unite": "douzaine", "description": "12 unités"},
]

CATEGORIES_PRODUIT = [
    {
        "nom": "Céréales",
        "nom_creole": "Sereyal",
        "description": "Riz, maïs, blé, mil, sorgho"
    },
    {
        "nom": "Légumineuses",
        "nom_creole": "Leguminèz",
        "description": "Haricots, pois, lentilles"
    },
    {
        "nom": "Huiles et Graisses",
        "nom_creole": "Lwil ak Grès",
        "description": "Huile végétale, beurre, margarine"
    },
    {
        "nom": "Sucre et Édulcorants",
        "nom_creole": "Sik",
        "description": "Sucre blanc, sucre brun, miel"
    },
    {
        "nom": "Tubercules",
        "nom_creole": "Rasin",
        "description": "Patate douce, manioc, igname, pomme de terre"
    },
    {
        "nom": "Produits Animaux",
        "nom_creole": "Pwodui Bèt",
        "description": "Viande, poisson, œufs, lait"
    },
    {
        "nom": "Fruits et Légumes",
        "nom_creole": "Fwi ak Legim",
        "description": "Tomates, oignons, bananes, mangues"
    },
    {
        "nom": "Autres",
        "nom_creole": "Lòt",
        "description": "Sel, épices, condiments"
    }
]

DEPARTEMENTS = [
    {"code": "HT-AR", "nom": "Artibonite", "nom_creole": "Latibonit"},
    {"code": "HT-CE", "nom": "Centre", "nom_creole": "Sant"},
    {"code": "HT-GA", "nom": "Grande-Anse", "nom_creole": "Grandans"},
    {"code": "HT-NI", "nom": "Nippes", "nom_creole": "Nip"},
    {"code": "HT-ND", "nom": "Nord", "nom_creole": "Nò"},
    {"code": "HT-NE", "nom": "Nord-Est", "nom_creole": "Nòdès"},
    {"code": "HT-NO", "nom": "Nord-Ouest", "nom_creole": "Nòdwès"},
    {"code": "HT-OU", "nom": "Ouest", "nom_creole": "Lwès"},
    {"code": "HT-SD", "nom": "Sud", "nom_creole": "Sid"},
    {"code": "HT-SE", "nom": "Sud-Est", "nom_creole": "Sidès"}
]

# Communes principales (échantillon pour le MVP - 30 communes)
COMMUNES = [
    # Ouest
    {"code": "HT-OU-001", "nom": "Port-au-Prince", "nom_creole": "Pòtoprens", "dept_code": "HT-OU", "type_zone": "urbaine", "population": 987310},
    {"code": "HT-OU-002", "nom": "Carrefour", "nom_creole": "Kafou", "dept_code": "HT-OU", "type_zone": "urbaine", "population": 511345},
    {"code": "HT-OU-003", "nom": "Delmas", "nom_creole": "Delma", "dept_code": "HT-OU", "type_zone": "urbaine", "population": 395260},
    {"code": "HT-OU-004", "nom": "Pétion-Ville", "nom_creole": "Petyonvil", "dept_code": "HT-OU", "type_zone": "urbaine", "population": 376834},
    {"code": "HT-OU-005", "nom": "Croix-des-Bouquets", "nom_creole": "Kwadèboukè", "dept_code": "HT-OU", "type_zone": "peri-urbaine", "population": 241117},
    {"code": "HT-OU-006", "nom": "Léogâne", "nom_creole": "Leyogàn", "dept_code": "HT-OU", "type_zone": "urbaine", "population": 199000},

    # Artibonite
    {"code": "HT-AR-001", "nom": "Gonaïves", "nom_creole": "Gonayiv", "dept_code": "HT-AR", "type_zone": "urbaine", "population": 324043},
    {"code": "HT-AR-002", "nom": "Saint-Marc", "nom_creole": "Sen Mak", "dept_code": "HT-AR", "type_zone": "urbaine", "population": 242485},
    {"code": "HT-AR-003", "nom": "Dessalines", "nom_creole": "Desalin", "dept_code": "HT-AR", "type_zone": "rurale", "population": 148638},
    {"code": "HT-AR-004", "nom": "Verrettes", "nom_creole": "Verèt", "dept_code": "HT-AR", "type_zone": "rurale", "population": 104229},

    # Nord
    {"code": "HT-ND-001", "nom": "Cap-Haïtien", "nom_creole": "Okap", "dept_code": "HT-ND", "type_zone": "urbaine", "population": 274404},
    {"code": "HT-ND-002", "nom": "Quartier-Morin", "nom_creole": "Katye Moren", "dept_code": "HT-ND", "type_zone": "rurale", "population": 35000},
    {"code": "HT-ND-003", "nom": "Limonade", "nom_creole": "Limonad", "dept_code": "HT-ND", "type_zone": "rurale", "population": 63000},

    # Nord-Est
    {"code": "HT-NE-001", "nom": "Fort-Liberté", "nom_creole": "Fòlibète", "dept_code": "HT-NE", "type_zone": "urbaine", "population": 40000},
    {"code": "HT-NE-002", "nom": "Ouanaminthe", "nom_creole": "Wanament", "dept_code": "HT-NE", "type_zone": "urbaine", "population": 100000},

    # Nord-Ouest
    {"code": "HT-NO-001", "nom": "Port-de-Paix", "nom_creole": "Pòdepè", "dept_code": "HT-NO", "type_zone": "urbaine", "population": 250208},
    {"code": "HT-NO-002", "nom": "Saint-Louis du Nord", "nom_creole": "Sen Lwi dinò", "dept_code": "HT-NO", "type_zone": "rurale", "population": 85000},

    # Centre
    {"code": "HT-CE-001", "nom": "Hinche", "nom_creole": "Ench", "dept_code": "HT-CE", "type_zone": "urbaine", "population": 100000},
    {"code": "HT-CE-002", "nom": "Mirebalais", "nom_creole": "Mibalè", "dept_code": "HT-CE", "type_zone": "urbaine", "population": 100000},

    # Sud
    {"code": "HT-SD-001", "nom": "Les Cayes", "nom_creole": "Okay", "dept_code": "HT-SD", "type_zone": "urbaine", "population": 126306},
    {"code": "HT-SD-002", "nom": "Camp-Perrin", "nom_creole": "Kanperen", "dept_code": "HT-SD", "type_zone": "rurale", "population": 35000},
    {"code": "HT-SD-003", "nom": "Aquin", "nom_creole": "Aken", "dept_code": "HT-SD", "type_zone": "rurale", "population": 30000},

    # Sud-Est
    {"code": "HT-SE-001", "nom": "Jacmel", "nom_creole": "Jakmèl", "dept_code": "HT-SE", "type_zone": "urbaine", "population": 170289},
    {"code": "HT-SE-002", "nom": "Cayes-Jacmel", "nom_creole": "Kayjakmèl", "dept_code": "HT-SE", "type_zone": "rurale", "population": 40000},

    # Grande-Anse
    {"code": "HT-GA-001", "nom": "Jérémie", "nom_creole": "Jeremi", "dept_code": "HT-GA", "type_zone": "urbaine", "population": 170289},
    {"code": "HT-GA-002", "nom": "Dame-Marie", "nom_creole": "Danmari", "dept_code": "HT-GA", "type_zone": "rurale", "population": 30000},

    # Nippes
    {"code": "HT-NI-001", "nom": "Miragoâne", "nom_creole": "Miragwàn", "dept_code": "HT-NI", "type_zone": "urbaine", "population": 102500},
    {"code": "HT-NI-002", "nom": "Petit-Goâve", "nom_creole": "Tigwav", "dept_code": "HT-NI", "type_zone": "urbaine", "population": 52000},
]

# Produits de base (panier alimentaire)
PRODUITS = [
    # Céréales
    {"nom": "Riz importé", "nom_creole": "Diri etranje", "code": "PROD-RIZ-IMP", "categorie": "Céréales", "unite": "livre"},
    {"nom": "Riz local", "nom_creole": "Diri peyi", "code": "PROD-RIZ-LOC", "categorie": "Céréales", "unite": "livre"},
    {"nom": "Maïs grain", "nom_creole": "Mayi", "code": "PROD-MAIS", "categorie": "Céréales", "unite": "marmite"},
    {"nom": "Farine de blé", "nom_creole": "Farin ble", "code": "PROD-FARINE", "categorie": "Céréales", "unite": "livre"},

    # Légumineuses
    {"nom": "Haricot noir", "nom_creole": "Pwa nwa", "code": "PROD-HARICOT-NOIR", "categorie": "Légumineuses", "unite": "marmite"},
    {"nom": "Haricot rouge", "nom_creole": "Pwa wouj", "code": "PROD-HARICOT-ROUGE", "categorie": "Légumineuses", "unite": "marmite"},
    {"nom": "Pois congo", "nom_creole": "Pwa kongo", "code": "PROD-POIS", "categorie": "Légumineuses", "unite": "marmite"},

    # Huiles
    {"nom": "Huile végétale", "nom_creole": "Lwil", "code": "PROD-HUILE", "categorie": "Huiles et Graisses", "unite": "gallon"},

    # Sucre
    {"nom": "Sucre", "nom_creole": "Sik", "code": "PROD-SUCRE", "categorie": "Sucre et Édulcorants", "unite": "livre"},

    # Tubercules
    {"nom": "Patate douce", "nom_creole": "Patat", "code": "PROD-PATATE", "categorie": "Tubercules", "unite": "livre"},
    {"nom": "Manioc", "nom_creole": "Manyòk", "code": "PROD-MANIOC", "categorie": "Tubercules", "unite": "livre"},
    {"nom": "Igname", "nom_creole": "Yanm", "code": "PROD-IGNAME", "categorie": "Tubercules", "unite": "livre"},

    # Fruits et Légumes
    {"nom": "Banane plantain", "nom_creole": "Bannann", "code": "PROD-BANANE", "categorie": "Fruits et Légumes", "unite": "douzaine"},
    {"nom": "Tomate", "nom_creole": "Tomat", "code": "PROD-TOMATE", "categorie": "Fruits et Légumes", "unite": "marmite"},

    # Autres
    {"nom": "Sel", "nom_creole": "Sèl", "code": "PROD-SEL", "categorie": "Autres", "unite": "livre"},
]


# ============================================================================
# Fonctions d'insertion
# ============================================================================

async def seed_unites_mesure():
    """Initialiser les unités de mesure"""
    print("\n[1/5] Initialisation des unites de mesure...")
    db = get_database()

    count = await db.unites_mesure.count_documents({})
    if count > 0:
        print(f"   -> {count} unite(s) deja presente(s), passage a l'etape suivante")
        return

    for unite in UNITES_MESURE:
        unite["created_at"] = datetime.utcnow()

    result = await db.unites_mesure.insert_many(UNITES_MESURE)
    print(f"   -> {len(result.inserted_ids)} unites de mesure creees")


async def seed_categories_produit():
    """Initialiser les catégories de produits"""
    print("\n[2/5] Initialisation des categories de produits...")
    db = get_database()

    count = await db.categories_produit.count_documents({})
    if count > 0:
        print(f"   -> {count} categorie(s) deja presente(s), passage a l'etape suivante")
        return

    for categorie in CATEGORIES_PRODUIT:
        categorie["created_at"] = datetime.utcnow()

    result = await db.categories_produit.insert_many(CATEGORIES_PRODUIT)
    print(f"   -> {len(result.inserted_ids)} categories de produits creees")

    return result.inserted_ids


async def seed_departements():
    """Initialiser les départements"""
    print("\n[3/5] Initialisation des departements...")
    db = get_database()

    count = await db.departements.count_documents({})
    if count > 0:
        print(f"   -> {count} departement(s) deja present(s), passage a l'etape suivante")
        # Retourner un mapping code -> id
        depts = await db.departements.find().to_list(None)
        return {dept["code"]: str(dept["_id"]) for dept in depts}

    for dept in DEPARTEMENTS:
        dept["actif"] = True
        dept["created_at"] = datetime.utcnow()

    result = await db.departements.insert_many(DEPARTEMENTS)
    print(f"   -> {len(result.inserted_ids)} departements crees")

    # Créer un mapping code -> id
    dept_map = {}
    for i, dept in enumerate(DEPARTEMENTS):
        dept_map[dept["code"]] = str(result.inserted_ids[i])

    return dept_map


async def seed_communes(dept_map):
    """Initialiser les communes"""
    print("\n[4/5] Initialisation des communes...")
    db = get_database()

    count = await db.communes.count_documents({})
    if count > 0:
        print(f"   -> {count} commune(s) deja presente(s), passage a l'etape suivante")
        return

    communes_to_insert = []
    for commune in COMMUNES:
        dept_id = dept_map.get(commune["dept_code"])
        if not dept_id:
            print(f"   WARNING: Departement {commune['dept_code']} non trouve pour {commune['nom']}")
            continue

        commune_doc = {
            "code": commune["code"],
            "nom": commune["nom"],
            "nom_creole": commune.get("nom_creole"),
            "departement_id": dept_id,
            "type_zone": commune.get("type_zone", "rurale"),
            "population": commune.get("population"),
            "actif": True,
            "created_at": datetime.utcnow()
        }
        communes_to_insert.append(commune_doc)

    if communes_to_insert:
        result = await db.communes.insert_many(communes_to_insert)
        print(f"   -> {len(result.inserted_ids)} communes creees")


async def seed_produits():
    """Initialiser les produits"""
    print("\n[5/5] Initialisation des produits...")
    db = get_database()

    count = await db.produits.count_documents({})
    if count > 0:
        print(f"   -> {count} produit(s) deja present(s), passage a l'etape suivante")
        return

    # Récupérer les catégories et unités
    categories = await db.categories_produit.find().to_list(None)
    cat_map = {cat["nom"]: str(cat["_id"]) for cat in categories}

    unites = await db.unites_mesure.find().to_list(None)
    unite_map = {unite["unite"]: str(unite["_id"]) for unite in unites}

    produits_to_insert = []
    for produit in PRODUITS:
        cat_id = cat_map.get(produit["categorie"])
        unite_id = unite_map.get(produit["unite"])

        if not cat_id or not unite_id:
            print(f"   WARNING: Categorie ou unite non trouvee pour {produit['nom']}")
            continue

        produit_doc = {
            "nom": produit["nom"],
            "nom_creole": produit.get("nom_creole"),
            "code": produit["code"],
            "id_categorie": cat_id,
            "id_unite_mesure": unite_id,
            "description": None,
            "actif": True,
            "created_at": datetime.utcnow()
        }
        produits_to_insert.append(produit_doc)

    if produits_to_insert:
        result = await db.produits.insert_many(produits_to_insert)
        print(f"   -> {len(result.inserted_ids)} produits crees")


# ============================================================================
# Fonction principale
# ============================================================================

async def main():
    """
    Fonction principale pour initialiser toutes les données de référence.
    """
    print("=" * 70)
    print("INITIALISATION DES DONNEES DE REFERENCE DU SAP")
    print("=" * 70)

    try:
        # Connexion à MongoDB
        print("\nConnexion a MongoDB...")
        await connect_to_mongo()
        print("   -> Connecte a MongoDB")

        # Insertion des données
        await seed_unites_mesure()
        await seed_categories_produit()
        dept_map = await seed_departements()
        await seed_communes(dept_map)
        await seed_produits()

        print("\n" + "=" * 70)
        print("INITIALISATION TERMINEE AVEC SUCCES!")
        print("=" * 70)

        # Afficher les statistiques
        db = get_database()
        print("\nStatistiques:")
        print(f"   - Unites de mesure: {await db.unites_mesure.count_documents({})}")
        print(f"   - Categories de produits: {await db.categories_produit.count_documents({})}")
        print(f"   - Departements: {await db.departements.count_documents({})}")
        print(f"   - Communes: {await db.communes.count_documents({})}")
        print(f"   - Produits: {await db.produits.count_documents({})}")

    except Exception as e:
        print(f"\nERREUR lors de l'initialisation: {e}")
        import traceback
        traceback.print_exc()
    finally:
        # Fermeture de la connexion
        print("\nFermeture de la connexion MongoDB...")
        await close_mongo_connection()
        print("   -> Connexion fermee")


if __name__ == "__main__":
    asyncio.run(main())
