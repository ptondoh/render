"""
Script pour convertir l'_id d'adminmulti de ObjectId en string
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId

# Configuration MongoDB LOCAL
MONGODB_URL = "mongodb://localhost:27017"
DATABASE_NAME = "sap_db"


async def fix_adminmulti_id():
    """Convertir l'_id d'adminmulti de ObjectId en string"""

    # Connexion à MongoDB
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    users_collection = db.users

    print(f"[INFO] Connexion a MongoDB: {DATABASE_NAME}")
    print("=" * 60)

    # Trouver adminmulti avec ObjectId
    adminmulti_oid = await users_collection.find_one({"email": "adminmulti@sap.ht"})

    if not adminmulti_oid:
        print("[ERROR] adminmulti@sap.ht non trouve!")
        client.close()
        return

    old_id = adminmulti_oid["_id"]
    print(f"[INFO] adminmulti@sap.ht trouve avec _id={old_id}, type={type(old_id).__name__}")

    if isinstance(old_id, str):
        print("[INFO] L'_id est deja une string, rien a faire")
        client.close()
        return

    # Convertir ObjectId en string
    new_id = str(old_id)
    print(f"[INFO] Conversion en string: {new_id}")

    # Créer un nouveau document avec l'_id en string
    new_doc = adminmulti_oid.copy()
    new_doc["_id"] = new_id

    # Supprimer l'ancien document
    await users_collection.delete_one({"_id": old_id})
    print(f"[DELETE] Ancien document supprime")

    # Insérer le nouveau document
    await users_collection.insert_one(new_doc)
    print(f"[INSERT] Nouveau document insere avec _id string")

    # Vérification
    check = await users_collection.find_one({"_id": new_id})
    if check:
        print(f"[OK] Verification: _id={check['_id']}, type={type(check['_id']).__name__}")
    else:
        print(f"[ERROR] Verification echouee!")

    print("=" * 60)

    # Fermer la connexion
    client.close()


if __name__ == "__main__":
    print("[START] Correction de l'_id d'adminmulti")
    print("=" * 60)
    asyncio.run(fix_adminmulti_id())
    print("[DONE]")
