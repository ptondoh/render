"""
Script pour ajouter created_at et updated_at aux unités de mesure existantes.
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime

MONGO_URI = "mongodb://localhost:27017"
DB_NAME = "sap_db"


async def add_timestamps():
    """
    Ajoute created_at et updated_at aux unités qui n'en ont pas.
    """
    print("=" * 70)
    print("AJOUT DES TIMESTAMPS created_at ET updated_at")
    print("=" * 70)

    # Connexion à MongoDB
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DB_NAME]

    print(f"\nBase de donnees: {DB_NAME}")
    print(f"Collection: unites_mesure\n")

    # Compter les documents
    total = await db.unites_mesure.count_documents({})
    print(f"Nombre total d'unites: {total}\n")

    # Compter ceux sans created_at
    without_created = await db.unites_mesure.count_documents({"created_at": {"$exists": False}})
    without_updated = await db.unites_mesure.count_documents({"updated_at": {"$exists": False}})

    print(f"Unites sans created_at: {without_created}")
    print(f"Unites sans updated_at: {without_updated}\n")

    if without_created == 0 and without_updated == 0:
        print("[INFO] Tous les documents ont deja les timestamps")
        client.close()
        return

    # Ajouter created_at aux documents qui n'en ont pas
    if without_created > 0:
        print("Ajout de created_at...")
        now = datetime.utcnow()
        result = await db.unites_mesure.update_many(
            {"created_at": {"$exists": False}},
            {"$set": {"created_at": now}}
        )
        print(f"  [OK] {result.modified_count} documents mis a jour avec created_at")

    # Ajouter updated_at aux documents qui n'en ont pas (optionnel)
    if without_updated > 0:
        print("\nAjout de updated_at...")
        # Pour updated_at, on peut soit ne rien mettre (null), soit mettre la même date
        # Je vais le laisser null pour l'instant, il sera ajouté lors de la prochaine modification
        print(f"  [INFO] updated_at sera ajoute lors de la prochaine modification")

    # Vérifier le résultat
    print("\nVerification...")
    sample = await db.unites_mesure.find_one()

    if sample:
        has_created = "created_at" in sample
        has_updated = "updated_at" in sample

        print(f"  created_at present: {has_created}")
        print(f"  updated_at present: {has_updated}")

        print("\nExemple de document:")
        print(f"  _id: {sample['_id']}")
        print(f"  unite: {sample.get('unite')}")
        print(f"  symbole: {sample.get('symbole')}")
        print(f"  created_at: {sample.get('created_at')}")
        print(f"  updated_at: {sample.get('updated_at', 'null')}")

    print("\n" + "=" * 70)
    print("TERMINE!")
    print("=" * 70)

    client.close()


if __name__ == "__main__":
    asyncio.run(add_timestamps())
