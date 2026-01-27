"""
Gestion de la connexion à MongoDB avec Motor (driver asynchrone).
Fournit une instance singleton de la base de données.
"""

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from typing import Optional
import logging

from backend.config import settings

logger = logging.getLogger(__name__)


class Database:
    """
    Classe singleton pour gérer la connexion MongoDB.
    """
    client: Optional[AsyncIOMotorClient] = None
    db: Optional[AsyncIOMotorDatabase] = None


# Instance globale
database = Database()


async def connect_to_mongo() -> None:
    """
    Établir la connexion à MongoDB au démarrage de l'application.
    Lève une exception si la connexion échoue.
    """
    try:
        logger.info(f"Connexion à MongoDB: {settings.mongodb_url}")

        # Créer le client Motor
        database.client = AsyncIOMotorClient(
            settings.mongodb_url,
            serverSelectionTimeoutMS=5000,  # Timeout de 5 secondes
            connectTimeoutMS=5000
        )

        # Sélectionner la base de données
        database.db = database.client[settings.mongodb_db_name]

        # Ping pour vérifier la connexion
        await database.client.admin.command('ping')

        logger.info(f"✅ Connecté à MongoDB: {settings.mongodb_db_name}")

        # Créer les index au démarrage
        await create_indexes()

    except Exception as e:
        logger.error(f"❌ Erreur de connexion à MongoDB: {e}")
        raise


async def close_mongo_connection() -> None:
    """
    Fermer proprement la connexion MongoDB au shutdown de l'application.
    """
    try:
        if database.client:
            database.client.close()
            logger.info("❌ Connexion MongoDB fermée")
    except Exception as e:
        logger.error(f"Erreur lors de la fermeture de MongoDB: {e}")


async def create_indexes() -> None:
    """
    Créer les index MongoDB nécessaires pour les performances.
    Appelé automatiquement au démarrage.
    """
    try:
        db = get_database()

        # Index pour la collection users
        await db.users.create_index("email", unique=True)
        await db.users.create_index("role")

        # Index pour la collection collectes
        await db.collectes.create_index("marche_id")
        await db.collectes.create_index("produit_id")
        await db.collectes.create_index("date")
        await db.collectes.create_index("agent_id")
        await db.collectes.create_index("statut")
        await db.collectes.create_index("periode")

        # Index pour la collection audit_logs
        await db.audit_logs.create_index("user_id")
        await db.audit_logs.create_index("timestamp")
        await db.audit_logs.create_index("action")

        # Index pour la collection produits
        await db.produits.create_index("code", unique=True)
        await db.produits.create_index("actif")

        # Index pour la collection marches
        await db.marches.create_index("code", unique=True)
        await db.marches.create_index("commune_id")
        await db.marches.create_index("actif")
        # Index géospatial pour la recherche par proximité
        await db.marches.create_index([("location", "2dsphere")])

        # Index pour la collection unites_mesure
        await db.unites_mesure.create_index("unite", unique=True)

        # Index pour la collection categories_produit
        await db.categories_produit.create_index("nom")

        # Index pour la collection categories_user
        await db.categories_user.create_index("nom")

        # Index pour la collection permissions
        await db.permissions.create_index([("nom", 1), ("action", 1)], unique=True)

        # Index pour la collection roles
        await db.roles.create_index("nom", unique=True)

        # Index pour la collection departements
        await db.departements.create_index("code", unique=True)
        await db.departements.create_index("actif")

        # Index pour la collection communes
        await db.communes.create_index("code", unique=True)
        await db.communes.create_index("departement_id")
        await db.communes.create_index("actif")

        logger.info("✅ Index MongoDB créés avec succès")

    except Exception as e:
        logger.warning(f"⚠️  Erreur lors de la création des index: {e}")


def get_database() -> AsyncIOMotorDatabase:
    """
    Obtenir l'instance de la base de données MongoDB.

    Returns:
        AsyncIOMotorDatabase: Instance de la base de données

    Raises:
        RuntimeError: Si la connexion n'est pas établie
    """
    if database.db is None:
        raise RuntimeError(
            "La connexion à MongoDB n'est pas établie. "
            "Assurez-vous d'appeler connect_to_mongo() au démarrage de l'application."
        )
    return database.db


async def ping_database() -> bool:
    """
    Vérifier que la connexion à MongoDB est active.

    Returns:
        bool: True si la connexion est active, False sinon
    """
    try:
        if database.client:
            await database.client.admin.command('ping')
            return True
        return False
    except Exception as e:
        logger.error(f"Ping MongoDB échoué: {e}")
        return False


# Helper pour obtenir une collection
def get_collection(collection_name: str):
    """
    Helper pour obtenir une collection MongoDB.

    Args:
        collection_name: Nom de la collection

    Returns:
        Collection MongoDB
    """
    db = get_database()
    return db[collection_name]


# Alias pour compatibilité avec les routers
# Utiliser db.collection au lieu de get_database().collection
class DatabaseProxy:
    """Proxy pour accéder à la base de données de manière plus concise"""
    def __getattr__(self, name):
        return getattr(get_database(), name)

db = DatabaseProxy()
