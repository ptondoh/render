"""
Application principale FastAPI pour le Système d'Alerte Précoce (SAP).
Point d'entrée de l'API backend.
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import logging
from datetime import datetime

from backend.config import settings
from backend.database import (
    connect_to_mongo,
    close_mongo_connection,
    ping_database
)
from backend.models import HealthCheckResponse, MessageResponse
from backend.routers import auth as auth_router

# Configuration du logging
logging.basicConfig(
    level=logging.INFO if settings.is_development else logging.WARNING,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# ============================================================================
# Gestion du cycle de vie de l'application
# ============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Gestionnaire de contexte pour le cycle de vie de l'application.
    Exécuté au démarrage et à l'arrêt de l'application.
    """
    # Startup
    logger.info("🚀 Démarrage de l'application SAP...")
    try:
        await connect_to_mongo()
        logger.info("✅ Application SAP démarrée avec succès")
    except Exception as e:
        logger.error(f"❌ Erreur au démarrage: {e}")
        raise

    yield

    # Shutdown
    logger.info("⏹️  Arrêt de l'application SAP...")
    await close_mongo_connection()
    logger.info("✅ Application SAP arrêtée proprement")


# ============================================================================
# Création de l'application FastAPI
# ============================================================================

app = FastAPI(
    title="SAP - Système d'Alerte Précoce",
    description="""
    API pour le Système d'Alerte Précoce (SAP) pour la sécurité alimentaire.

    ## Fonctionnalités Phase 0:

    * **Authentification** - Gestion des utilisateurs avec MFA
    * **Collecte de prix** - Collecte de prix sur les marchés (mode hors-ligne supporté)
    * **Hiérarchie territoriale** - Gestion Département > Commune > Marché
    * **Produits** - Référentiel des produits alimentaires
    * **Alertes** - Système d'alertes à 4 niveaux (Normal, Surveillance, Alerte, Urgence)

    ## Stack Technique:

    * **Backend**: FastAPI + Python 3.13
    * **Base de données**: MongoDB 8.23
    * **Authentification**: JWT + MFA (TOTP)
    * **Notifications**: SendGrid (email)
    """,
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
    contact={
        "name": "SAP Team",
        "email": "support@sap.ht"
    },
    license_info={
        "name": "MIT",
    }
)


# ============================================================================
# Configuration CORS
# ============================================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)


# ============================================================================
# Inclusion des routers
# ============================================================================

app.include_router(auth_router.router)


# ============================================================================
# Gestionnaire d'erreurs global
# ============================================================================

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Gestionnaire d'erreurs global pour capturer les exceptions non gérées.
    """
    logger.error(f"Erreur non gérée: {exc}", exc_info=True)

    return JSONResponse(
        status_code=500,
        content={
            "message": "Une erreur interne s'est produite",
            "detail": str(exc) if settings.is_development else "Contactez l'administrateur",
            "timestamp": datetime.utcnow().isoformat()
        }
    )


# ============================================================================
# Routes de base
# ============================================================================

@app.get(
    "/",
    response_model=MessageResponse,
    tags=["Root"],
    summary="Point d'entrée de l'API"
)
async def root():
    """
    Point d'entrée de l'API.
    Retourne les informations de base sur l'application.
    """
    return MessageResponse(
        message="SAP API - Système d'Alerte Précoce",
        detail=f"Version {app.version} - Environnement: {settings.app_env}"
    )


@app.get(
    "/health",
    response_model=HealthCheckResponse,
    tags=["Health"],
    summary="Vérification de santé de l'API"
)
async def health_check():
    """
    Endpoint de santé pour vérifier que l'application fonctionne correctement.

    Vérifie:
    - Le statut de l'application
    - La connexion à MongoDB
    - L'environnement d'exécution

    Utilisé par les outils de monitoring et d'orchestration (Docker, Kubernetes, etc.)
    """
    # Vérifier la connexion à MongoDB
    db_status = "connected" if await ping_database() else "disconnected"

    return HealthCheckResponse(
        status="healthy" if db_status == "connected" else "degraded",
        database=db_status,
        environment=settings.app_env
    )


@app.get(
    "/version",
    response_model=dict,
    tags=["Root"],
    summary="Informations sur la version"
)
async def version_info():
    """
    Retourne les informations détaillées sur la version de l'application.
    """
    return {
        "version": app.version,
        "title": app.title,
        "environment": settings.app_env,
        "python_version": "3.13.2",
        "fastapi_version": "0.115.5",
        "mongodb_version": "8.23",
        "phase": "0 - MVP",
        "features": [
            "Authentification JWT + MFA",
            "Collecte de prix (mode hors-ligne)",
            "Hiérarchie territoriale",
            "Gestion produits",
            "Système d'alertes 4 niveaux",
            "Internationalisation FR/HT"
        ]
    }


# ============================================================================
# Point d'entrée pour démarrage direct
# ============================================================================

if __name__ == "__main__":
    import uvicorn

    logger.info("🚀 Démarrage du serveur Uvicorn...")

    uvicorn.run(
        "backend.main:app",
        host=settings.app_host,
        port=settings.app_port,
        reload=settings.is_development,
        log_level="info" if settings.is_development else "warning"
    )
