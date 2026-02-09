"""
Vérifier les données dans MongoDB Atlas.
"""

import asyncio
import sys
from pathlib import Path

# Fix encoding
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from motor.motor_asyncio import AsyncIOMotorClient

MONGODB_URL = "mongodb+srv://sap_mobile:Sapsap2025@cluster-clickcollect.wxb71.mongodb.net/"
MONGODB_DB_NAME = "test_sap_db"


async def check_data():
    """Vérifier le contenu de la base."""

    print("Connexion à MongoDB Atlas...")
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[MONGODB_DB_NAME]

    try:
        await client.admin.command('ping')
        print("✅ Connecté\n")
    except Exception as e:
        print(f"❌ Erreur: {e}")
        return

    # Lister toutes les collections
    collections = await db.list_collection_names()
    print(f"📊 Collections trouvées ({len(collections)}):")
    for coll in collections:
        count = await db[coll].count_documents({})
        print(f"  - {coll}: {count} documents")

    # Si pas de collectes, c'est normal qu'on ait des 401
    collectes_count = await db.collectes.count_documents({})
    if collectes_count == 0:
        print("\n⚠️  Aucune collecte trouvée - c'est normal de ne pas avoir de statistiques")

    client.close()


if __name__ == "__main__":
    asyncio.run(check_data())
