"""
Script pour créer un utilisateur de test pour le SAP.

Usage:
    python -m backend.scripts.create_test_user
"""

import asyncio
from datetime import datetime
from bson import ObjectId
import sys
import os

# Ajouter le répertoire parent au PYTHONPATH
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from backend.database import get_collection, connect_to_mongo, close_mongo_connection
from backend.services.auth import hash_password


async def create_test_user():
    """
    Créer un utilisateur de test pour le développement.
    """
    print("=" * 70)
    print("CRÉATION D'UN UTILISATEUR DE TEST")
    print("=" * 70)

    try:
        # Connexion à MongoDB
        print("\nConnexion à MongoDB...")
        await connect_to_mongo()
        print("   -> Connecté à MongoDB")

        users_collection = get_collection("users")

        # Vérifier si l'utilisateur existe déjà
        test_email = "admin@sap.ht"
        existing_user = await users_collection.find_one({"email": test_email})

        if existing_user:
            print(f"\n✓ L'utilisateur {test_email} existe déjà!")
            print("\nVous pouvez vous connecter avec:")
            print(f"   Email: {test_email}")
            print(f"   Mot de passe: admin123")
            return

        # Créer l'utilisateur de test
        print(f"\nCréation de l'utilisateur {test_email}...")

        # Hacher le mot de passe
        password_hash = hash_password("admin123")

        # Obtenir le premier département (Ouest)
        depts_collection = get_collection("departements")
        dept = await depts_collection.find_one({"code": "HT-OU"})
        dept_id = str(dept["_id"]) if dept else None

        # Créer le document utilisateur
        user_doc = {
            "_id": str(ObjectId()),
            "email": test_email,
            "password_hash": password_hash,
            "role": "decideur",
            "nom": "Administrateur Test",
            "prenom": "Admin",
            "departement_id": dept_id,
            "telephone": "+509 1234 5678",
            "actif": True,
            "mfa_enabled": False,
            "mfa_secret": None,
            "backup_codes": [],
            "preferences": {
                "langue": "fr",
                "notifications_email": True,
                "notifications_sms": False
            },
            "last_login": None,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }

        await users_collection.insert_one(user_doc)

        print("   -> Utilisateur créé avec succès!")
        print("\n" + "=" * 70)
        print("UTILISATEUR DE TEST CRÉÉ!")
        print("=" * 70)
        print("\nVous pouvez vous connecter avec:")
        print(f"   Email: {test_email}")
        print(f"   Mot de passe: admin123")
        print(f"   Rôle: decideur")
        print("\n" + "=" * 70)

    except Exception as e:
        print(f"\nERREUR lors de la création de l'utilisateur: {e}")
        import traceback
        traceback.print_exc()
    finally:
        # Fermeture de la connexion
        print("\nFermeture de la connexion MongoDB...")
        await close_mongo_connection()
        print("   -> Connexion fermée")


if __name__ == "__main__":
    asyncio.run(create_test_user())
