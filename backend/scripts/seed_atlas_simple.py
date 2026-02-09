"""
Script pour créer les utilisateurs dans MongoDB Atlas (production).
Utilise le service d'authentification existant.
"""

import asyncio
import sys
from pathlib import Path

# Fix encoding pour Windows
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

# Ajouter le répertoire parent au path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime, timezone
from backend.services.auth import hash_password

# Configuration MongoDB Atlas
MONGODB_URL = "mongodb+srv://sap_mobile:Sapsap2025@cluster-clickcollect.wxb71.mongodb.net/"
MONGODB_DB_NAME = "test_sap_db"


async def seed_users():
    """Créer les 4 utilisateurs de test dans MongoDB Atlas."""

    print("Connexion à MongoDB Atlas...")
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[MONGODB_DB_NAME]
    users_collection = db.users

    # Vérifier la connexion
    try:
        await client.admin.command('ping')
        print("✅ Connecté à MongoDB Atlas")
    except Exception as e:
        print(f"❌ Erreur de connexion: {e}")
        return

    # Les 4 utilisateurs à créer
    users_data = [
        {
            "email": "agent@sap.ht",
            "nom": "Dupont",
            "prenom": "Jean",
            "roles": ["agent"],
            "password": "Admin@2025"
        },
        {
            "email": "decideur@sap.ht",
            "nom": "Martin",
            "prenom": "Marie",
            "roles": ["decideur"],
            "password": "Admin@2025"
        },
        {
            "email": "admin@sap.ht",
            "nom": "Administrateur",
            "prenom": "Système",
            "roles": ["bailleur"],
            "password": "Admin@2025"
        },
        {
            "email": "adminmulti@sap.ht",
            "nom": "Super",
            "prenom": "Admin",
            "roles": ["decideur", "bailleur"],
            "password": "Admin@2025"
        }
    ]

    print("\n📝 Création des utilisateurs...")

    for user_data in users_data:
        # Vérifier si l'utilisateur existe déjà
        existing = await users_collection.find_one({"email": user_data["email"]})

        if existing:
            print(f"⚠️  {user_data['email']} existe déjà (roles: {existing.get('roles', [])})")
            # Mettre à jour le mot de passe et les rôles
            password_hash = hash_password(user_data["password"])
            await users_collection.update_one(
                {"email": user_data["email"]},
                {"$set": {
                    "password_hash": password_hash,
                    "roles": user_data["roles"],
                    "actif": True
                }}
            )
            print(f"   ✅ Mot de passe et rôles mis à jour")
        else:
            # Créer le document utilisateur
            user_doc = {
                "_id": ObjectId(),
                "email": user_data["email"],
                "nom": user_data["nom"],
                "prenom": user_data["prenom"],
                "roles": user_data["roles"],
                "actif": True,
                "password_hash": hash_password(user_data["password"]),
                "mfa_enabled": False,
                "mfa_secret": None,
                "mfa_backup_codes": [],
                "created_at": datetime.now(timezone.utc),
                "updated_at": None
            }
            await users_collection.insert_one(user_doc)
            print(f"✅ {user_data['email']} créé (roles: {user_data['roles']})")

    # Vérifier le résultat final
    print("\n📊 Utilisateurs dans MongoDB Atlas:")
    async for user in users_collection.find():
        print(f"  - {user['email']}: roles={user.get('roles', [])} (id={user['_id']})")

    print("\n✅ Tous les utilisateurs sont prêts!")
    print("\n🔑 Credentials:")
    print("  Emails: agent@sap.ht, decideur@sap.ht, admin@sap.ht, adminmulti@sap.ht")
    print("  Mot de passe: Admin@2025")

    client.close()


if __name__ == "__main__":
    asyncio.run(seed_users())
