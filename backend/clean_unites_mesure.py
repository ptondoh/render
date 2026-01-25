"""
Script de nettoyage pour supprimer les champs inutiles de unites_mesure.

Garde uniquement: _id, unite, symbole
Supprime: code, nom, type, actif, created_at, updated_at
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URI = "mongodb://localhost:27017"
DB_NAME = "sap_db"


async def clean_unites():
    """
    Supprime les champs inutiles de la collection unites_mesure.
    """
    print("=" * 70)
    print("NETTOYAGE COLLECTION UNITES_MESURE")
    print("=" * 70)

    # Connexion à MongoDB
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DB_NAME]

    print(f"\nBase de donnees: {DB_NAME}")
    print(f"Collection: unites_mesure\n")

    # Compter les documents
    total = await db.unites_mesure.count_documents({})
    print(f"Nombre d'unites: {total}\n")

    # Supprimer les champs inutiles
    print("Suppression des champs inutiles...")
    result = await db.unites_mesure.update_many(
        {},
        {
            "$unset": {
                "code": "",
                "nom": "",
                "type": "",
                "actif": "",
                "created_at": "",
                "updated_at": "",
                "description": ""  # Au cas où il reste des anciennes descriptions
            }
        }
    )

    print(f"  [OK] {result.modified_count} documents mis a jour")

    # Vérifier le résultat
    print("\nVerification...")
    sample = await db.unites_mesure.find_one()

    if sample:
        fields = list(sample.keys())
        print(f"  Champs restants: {', '.join(fields)}")

        # Vérifier qu'on a bien que _id, unite, symbole
        expected_fields = {'_id', 'unite', 'symbole'}
        actual_fields = set(fields)

        if actual_fields == expected_fields:
            print("  [OK] Structure correcte!")
        else:
            extra = actual_fields - expected_fields
            missing = expected_fields - actual_fields
            if extra:
                print(f"  [WARN] Champs en trop: {', '.join(extra)}")
            if missing:
                print(f"  [WARN] Champs manquants: {', '.join(missing)}")

    # Afficher exemple
    print("\nExemple de document:")
    examples = await db.unites_mesure.find().limit(3).to_list(3)
    for ex in examples:
        print(f"  - unite='{ex['unite']}', symbole='{ex['symbole']}'")

    print("\n" + "=" * 70)
    print("NETTOYAGE TERMINE!")
    print("=" * 70)

    client.close()


if __name__ == "__main__":
    asyncio.run(clean_unites())
