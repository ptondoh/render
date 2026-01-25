"""
Script de migration pour mettre à jour la structure des unités de mesure.

Ancienne structure:
- unite: "kg" (symbole)
- description: "Kilogramme" (nom complet)

Nouvelle structure:
- unite: "kilogramme" (nom complet)
- symbole: "kg" (symbole)
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime

MONGO_URI = "mongodb://localhost:27017"
DB_NAME = "sap_db"

# Mapping des anciennes unités vers la nouvelle structure
UNITE_MAPPING = {
    "kg": {"unite": "kilogramme", "symbole": "kg"},
    "g": {"unite": "gramme", "symbole": "g"},
    "lb": {"unite": "livre", "symbole": "lb"},
    "L": {"unite": "litre", "symbole": "L"},
    "mL": {"unite": "millilitre", "symbole": "mL"},
    "gal": {"unite": "gallon", "symbole": "gal"},
    "u": {"unite": "unité", "symbole": "u"},
    "dz": {"unite": "douzaine", "symbole": "dz"},
    "sac": {"unite": "sac", "symbole": "sac"},
    "marm": {"unite": "marmite", "symbole": "marm"},
    "boîte": {"unite": "boîte", "symbole": "boîte"},
    "TEST-FINAL": {"unite": "test final automatique", "symbole": "TEST-FINAL"},
}


async def migrate_unites():
    """
    Migre les unités de mesure vers la nouvelle structure.
    """
    print("=" * 70)
    print("MIGRATION STRUCTURE UNITES DE MESURE")
    print("=" * 70)

    # Connexion à MongoDB
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DB_NAME]

    print(f"\nBase de donnees: {DB_NAME}")
    print(f"URI: {MONGO_URI}\n")

    # Récupérer toutes les unités
    unites = await db.unites_mesure.find().to_list(None)

    if not unites:
        print("  [WARN] Aucune unite trouvee")
        client.close()
        return

    migrated = 0
    skipped = 0
    errors = 0

    for unite in unites:
        unite_id = unite["_id"]
        old_unite = unite.get("unite", "")
        old_symbole = unite.get("symbole", "")

        # Si l'unité a déjà le bon format (symbole existe dans mapping et unite correspond), ignorer
        if old_symbole in UNITE_MAPPING and old_unite == UNITE_MAPPING[old_symbole]["unite"]:
            skipped += 1
            continue

        # Déterminer la nouvelle structure basée sur le symbole actuel
        if old_symbole in UNITE_MAPPING:
            # Mapping connu
            new_data = UNITE_MAPPING[old_symbole]
        elif old_unite in UNITE_MAPPING:
            # Essayer avec l'ancien champ unite
            new_data = UNITE_MAPPING[old_unite]
        else:
            # Si pas de mapping, on utilise le symbole comme nom aussi
            new_data = {
                "unite": old_symbole if old_symbole else old_unite,
                "symbole": old_symbole if old_symbole else old_unite
            }

        try:
            # Mettre à jour le document
            await db.unites_mesure.update_one(
                {"_id": unite_id},
                {
                    "$set": {
                        "unite": new_data["unite"],
                        "symbole": new_data["symbole"],
                        "updated_at": datetime.utcnow()
                    },
                    "$unset": {"description": ""}  # Supprimer le champ description
                }
            )

            print(f"  [OK] {old_symbole} -> unite='{new_data['unite']}', symbole='{new_data['symbole']}'")
            migrated += 1
        except Exception as e:
            print(f"  [ERROR] Erreur pour {old_symbole}: {e}")
            errors += 1

    print("\n" + "=" * 70)
    print("RESULTATS")
    print("=" * 70)
    print(f"Unites migrees: {migrated}")
    print(f"Unites ignorees (deja migrees): {skipped}")
    print(f"Erreurs: {errors}")
    print("=" * 70)

    client.close()


if __name__ == "__main__":
    asyncio.run(migrate_unites())
