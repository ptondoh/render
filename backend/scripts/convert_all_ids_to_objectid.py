"""
Script pour convertir tous les _id string en ObjectId dans la table users
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId

# Configuration MongoDB LOCAL
MONGODB_URL = "mongodb://localhost:27017"
DATABASE_NAME = "sap_db"


async def convert_all_ids_to_objectid():
    """Convertir tous les _id string en ObjectId dans users"""

    # Connexion à MongoDB
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    users_collection = db.users

    print(f"[INFO] Connexion a MongoDB: {DATABASE_NAME}")
    print("=" * 60)

    # Récupérer tous les utilisateurs
    all_users = await users_collection.find().to_list(None)
    print(f"[INFO] Total utilisateurs trouves: {len(all_users)}")
    print("=" * 60)

    converted = 0
    already_objectid = 0

    for user in all_users:
        email = user.get('email', 'N/A')
        current_id = user.get('_id')

        if isinstance(current_id, ObjectId):
            print(f"[SKIP] {email}: _id est deja ObjectId")
            already_objectid += 1
            continue

        if isinstance(current_id, str):
            # Vérifier si c'est un ObjectId valide
            if not ObjectId.is_valid(current_id):
                print(f"[ERROR] {email}: _id '{current_id}' n'est pas un ObjectId valide!")
                continue

            # Créer un nouveau document avec ObjectId
            new_doc = user.copy()
            new_doc["_id"] = ObjectId(current_id)

            # Supprimer l'ancien document
            await users_collection.delete_one({"_id": current_id})

            # Insérer le nouveau document
            await users_collection.insert_one(new_doc)

            print(f"[CONVERT] {email}: '{current_id}' (str) -> ObjectId('{current_id}')")
            converted += 1

    print("=" * 60)
    print(f"[INFO] Utilisateurs deja avec ObjectId: {already_objectid}")
    print(f"[INFO] Utilisateurs convertis: {converted}")
    print("=" * 60)

    # Vérification finale
    print("\n[VERIFICATION] Verification finale...")
    print("=" * 60)

    all_users_after = await users_collection.find().to_list(None)

    for user in all_users_after:
        email = user.get('email', 'N/A')
        _id = user.get('_id')
        _id_type = type(_id).__name__

        if isinstance(_id, ObjectId):
            print(f"  [OK] {email}: _id={_id}, type={_id_type}")
        else:
            print(f"  [ERROR] {email}: _id={_id}, type={_id_type} (devrait etre ObjectId!)")

    print("=" * 60)
    print("[SUCCESS] Conversion terminee!")
    print("=" * 60)

    # Fermer la connexion
    client.close()


if __name__ == "__main__":
    print("[START] Conversion des _id en ObjectId")
    print("=" * 60)
    asyncio.run(convert_all_ids_to_objectid())
    print("[DONE]")
