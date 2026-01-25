"""
Script de migration pour convertir les _id de type string en ObjectId dans MongoDB.

Ce script doit être exécuté une seule fois pour corriger les données importées
avec des IDs string au lieu d'ObjectId.
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId

MONGO_URI = "mongodb://localhost:27017"
DB_NAME = "sap_db"

# Collections à migrer
COLLECTIONS = [
    "unites_mesure",
    "categories_produit",
    "produits",
    "marches",
    "collectes",
    "alertes",
    "utilisateurs",
    "roles",
    "permissions"
]


async def migrate_collection(db, collection_name: str):
    """
    Migre une collection: convertit les _id string en ObjectId.
    """
    collection = db[collection_name]

    # Récupérer tous les documents
    documents = await collection.find().to_list(None)

    if not documents:
        print(f"  [WARN] Collection '{collection_name}' vide - ignoree")
        return 0

    migrated = 0
    skipped = 0

    for doc in documents:
        doc_id = doc["_id"]

        # Si l'ID est déjà un ObjectId, ignorer
        if isinstance(doc_id, ObjectId):
            skipped += 1
            continue

        # Si l'ID est une string valide pour ObjectId
        if isinstance(doc_id, str) and ObjectId.is_valid(doc_id):
            # Créer un nouvel ObjectId à partir de la string
            new_id = ObjectId(doc_id)

            # Supprimer l'ancien document
            await collection.delete_one({"_id": doc_id})

            # Insérer le document avec le nouvel ObjectId
            doc["_id"] = new_id
            await collection.insert_one(doc)

            migrated += 1
        else:
            print(f"  [WARN]  ID invalide dans '{collection_name}': {doc_id}")

    if migrated > 0:
        print(f"  [OK] Collection '{collection_name}': {migrated} documents migrés, {skipped} déjà corrects")
    else:
        print(f"  [INFO]  Collection '{collection_name}': {skipped} documents déjà corrects")

    return migrated


async def main():
    print("=" * 70)
    print("MIGRATION DES IDs STRING VERS OBJECTID")
    print("=" * 70)

    # Connexion à MongoDB
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DB_NAME]

    print(f"\nBase de donnees: {DB_NAME}")
    print(f"URI: {MONGO_URI}\n")

    total_migrated = 0

    for collection_name in COLLECTIONS:
        try:
            migrated = await migrate_collection(db, collection_name)
            total_migrated += migrated
        except Exception as e:
            print(f"  [ERROR] Erreur lors de la migration de '{collection_name}': {e}")

    print("\n" + "=" * 70)
    print(f"[OK] Migration terminée: {total_migrated} documents migrés au total")
    print("=" * 70)

    client.close()


if __name__ == "__main__":
    asyncio.run(main())
