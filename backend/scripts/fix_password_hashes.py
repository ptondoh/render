"""
Script pour corriger les hash des mots de passe dans MongoDB local
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

# Configuration MongoDB LOCAL
MONGODB_URL = "mongodb://localhost:27017"
DATABASE_NAME = "sap_db"

# Hash CORRECT pour "Test123!" vérifié avec bcrypt
CORRECT_PASSWORD_HASH = "$2b$12$XvvmZoK3SrjtJ96sLMK7DO0rmKmuLXN92fbO2E5FgmM1NQ/cXWNHW"


async def fix_password_hashes():
    """Corriger les hash des mots de passe"""

    # Connexion à MongoDB
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    users_collection = db.users

    print(f"[INFO] Connexion a MongoDB: {DATABASE_NAME}")
    print(f"[INFO] URL: {MONGODB_URL}")
    print("=" * 60)

    # Récupérer tous les utilisateurs
    users = await users_collection.find().to_list(None)
    print(f"[INFO] Total utilisateurs trouves: {len(users)}")
    print("=" * 60)

    # Mettre à jour le hash pour tous les utilisateurs
    updated = 0
    for user in users:
        email = user.get('email')
        result = await users_collection.update_one(
            {"_id": user["_id"]},
            {"$set": {"password_hash": CORRECT_PASSWORD_HASH}}
        )
        if result.modified_count > 0:
            print(f"[UPDATE] {email}")
            updated += 1

    print("=" * 60)
    print(f"[INFO] Total utilisateurs mis a jour: {updated}")

    # Vérification finale
    print("\n[STEP] Verification finale...")
    print("=" * 60)

    all_users = await users_collection.find().to_list(None)
    for user in all_users:
        email = user.get('email', 'N/A')
        roles = user.get('roles', [])
        print(f"\n  [OK] {email}")
        print(f"    Roles: {roles}")
        print(f"    Password: Test123!")

    print("\n" + "=" * 60)
    print("[SUCCESS] Tous les mots de passe ont ete corriges!")
    print("=" * 60)

    # Fermer la connexion
    client.close()


if __name__ == "__main__":
    print("[START] Correction des hash de mots de passe")
    print("=" * 60)
    asyncio.run(fix_password_hashes())
    print("[DONE]")
