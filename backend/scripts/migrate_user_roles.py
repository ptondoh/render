"""
Script de migration pour convertir le champ 'role' (string) en 'roles' (liste) pour tous les utilisateurs.

Usage:
    python backend/scripts/migrate_user_roles.py
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

# Charger les variables d'environnement
load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "sap")


async def migrate_users():
    """Migrer les utilisateurs de 'role' vers 'roles'"""

    # Connexion à MongoDB
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    users_collection = db.users

    print(f"[INFO] Connexion a MongoDB: {DATABASE_NAME}")

    # Récupérer tous les utilisateurs
    users = await users_collection.find().to_list(None)
    print(f"[INFO] Nombre d'utilisateurs trouves: {len(users)}")

    migrated_count = 0
    skipped_count = 0

    for user in users:
        user_id = user["_id"]
        email = user.get("email", "N/A")

        # Cas 1: L'utilisateur a déjà 'roles' (liste) - skip
        if "roles" in user and isinstance(user["roles"], list):
            print(f"  [SKIP] {email} - a deja le champ 'roles'")
            skipped_count += 1
            continue

        # Cas 2: L'utilisateur a 'role' (string) - migrer
        if "role" in user and isinstance(user["role"], str):
            old_role = user["role"]
            new_roles = [old_role]

            # Mettre à jour l'utilisateur
            await users_collection.update_one(
                {"_id": user_id},
                {
                    "$set": {"roles": new_roles},
                    "$unset": {"role": ""}
                }
            )

            print(f"  [OK] Migre {email}: '{old_role}' -> {new_roles}")
            migrated_count += 1

        # Cas 3: L'utilisateur n'a ni 'role' ni 'roles' - créer roles vide
        else:
            await users_collection.update_one(
                {"_id": user_id},
                {"$set": {"roles": []}}
            )
            print(f"  [WARN] {email} - aucun role, defini a []")
            migrated_count += 1

    print(f"\n[SUCCESS] Migration terminee!")
    print(f"   - Migres: {migrated_count}")
    print(f"   - Ignores: {skipped_count}")
    print(f"   - Total: {len(users)}")

    # Fermer la connexion
    client.close()


if __name__ == "__main__":
    print("[START] Demarrage de la migration des roles utilisateurs...")
    print("=" * 60)
    asyncio.run(migrate_users())
    print("=" * 60)
    print("[SUCCESS] Migration terminee avec succes!")
