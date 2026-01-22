"""
Configuration centralisée pour l'application SAP.
Charge toutes les variables d'environnement et fournit une validation automatique.
"""

from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """
    Configuration de l'application chargée depuis les variables d'environnement.
    Utilise Pydantic pour la validation automatique.
    """

    # Configuration MongoDB
    mongodb_url: str
    mongodb_db_name: str

    # Configuration JWT
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 1440  # 24 heures
    jwt_refresh_token_expire_days: int = 7

    # Configuration MFA
    mfa_encryption_key: str

    # Configuration Email (SendGrid)
    sendgrid_api_key: str = ""
    sendgrid_from_email: str = "noreply@sap.ht"
    sendgrid_from_name: str = "Système d'Alerte Précoce"

    # Configuration Application
    app_env: str = "development"
    app_debug: bool = True
    app_host: str = "0.0.0.0"
    app_port: int = 8000

    # Configuration CORS
    cors_origins: str = "http://localhost:3000,http://localhost:8000,http://127.0.0.1:3000"

    # Configuration des Tâches Planifiées
    scheduler_enabled: bool = True
    alert_calculation_hour: int = 2

    # Configuration des Seuils d'Alerte (en pourcentage)
    alert_threshold_surveillance: int = 15
    alert_threshold_alerte: int = 30
    alert_threshold_urgence: int = 50

    class Config:
        env_file = ".env"
        case_sensitive = False

    @property
    def cors_origins_list(self) -> List[str]:
        """Convertir la chaîne CORS_ORIGINS en liste"""
        return [origin.strip() for origin in self.cors_origins.split(",")]

    @property
    def is_production(self) -> bool:
        """Vérifier si l'environnement est en production"""
        return self.app_env.lower() == "production"

    @property
    def is_development(self) -> bool:
        """Vérifier si l'environnement est en développement"""
        return self.app_env.lower() == "development"


# Instance singleton de la configuration
settings = Settings()


# Afficher la configuration au démarrage (sans les secrets)
if __name__ == "__main__":
    print("🔧 Configuration SAP:")
    print(f"  Environment: {settings.app_env}")
    print(f"  Debug: {settings.app_debug}")
    print(f"  MongoDB: {settings.mongodb_db_name}")
    print(f"  Host: {settings.app_host}:{settings.app_port}")
    print(f"  CORS Origins: {settings.cors_origins_list}")
    print(f"  Scheduler: {'Enabled' if settings.scheduler_enabled else 'Disabled'}")
