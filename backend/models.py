"""
Modèles Pydantic pour la validation et la sérialisation des données.
Utilisés pour la documentation automatique et la validation des requêtes/réponses.
"""

from pydantic import BaseModel, Field, EmailStr, field_validator
from typing import Optional, Literal
from datetime import datetime
from bson import ObjectId


# ============================================================================
# Helper pour ObjectId MongoDB
# ============================================================================

class PyObjectId(str):
    """
    Type personnalisé pour gérer les ObjectId MongoDB dans Pydantic.
    """

    @classmethod
    def __get_pydantic_core_schema__(cls, source_type, handler):
        from pydantic_core import core_schema
        return core_schema.union_schema([
            core_schema.is_instance_schema(ObjectId),
            core_schema.chain_schema([
                core_schema.str_schema(),
                core_schema.no_info_plain_validator_function(cls.validate),
            ])
        ])

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid ObjectId")
        return str(v)


# ============================================================================
# Modèles User (Utilisateur)
# ============================================================================

class UserBase(BaseModel):
    """Modèle de base pour un utilisateur"""
    email: EmailStr = Field(..., description="Email de l'utilisateur")
    role: Literal["agent", "décideur", "bailleur"] = Field(..., description="Rôle de l'utilisateur")
    nom: Optional[str] = Field(None, description="Nom complet")
    region_id: Optional[str] = Field(None, description="ID de la région d'affectation")
    telephone: Optional[str] = Field(None, description="Numéro de téléphone")
    actif: bool = Field(True, description="Compte actif ou non")


class UserCreate(UserBase):
    """Modèle pour la création d'un utilisateur"""
    password: str = Field(..., min_length=8, description="Mot de passe (min 8 caractères)")


class UserInDB(UserBase):
    """Modèle pour un utilisateur en base de données"""
    id: str = Field(alias="_id")
    password_hash: str
    mfa_secret: Optional[str] = None
    mfa_enabled: bool = False
    mfa_backup_codes: list[str] = []
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}


class UserResponse(UserBase):
    """Modèle de réponse pour un utilisateur (sans données sensibles)"""
    id: str
    mfa_enabled: bool
    created_at: datetime

    class Config:
        populate_by_name = True


# ============================================================================
# Modèles Produit
# ============================================================================

class ProduitBase(BaseModel):
    """Modèle de base pour un produit"""
    nom: str = Field(..., description="Nom du produit")
    nom_creole: Optional[str] = Field(None, description="Nom en créole haïtien")
    code: str = Field(..., description="Code unique du produit (ex: PROD-RIZ)")
    categorie: Literal[
        "cereales", "legumineuses", "huiles", "sucre",
        "tubercules", "produits_animaux", "fruits_legumes", "autres"
    ] = Field(..., description="Catégorie du produit")
    unite: str = Field(..., description="Unité de mesure (kg, litre, unité, etc.)")
    description: Optional[str] = Field(None, description="Description du produit")


class ProduitCreate(ProduitBase):
    """Modèle pour la création d'un produit"""
    pass


class ProduitInDB(ProduitBase):
    """Modèle pour un produit en base de données"""
    id: str = Field(alias="_id")
    actif: bool = True
    prix_ref_min: Optional[float] = None
    prix_ref_max: Optional[float] = None
    prix_ref_moyen: Optional[float] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}


class ProduitResponse(ProduitBase):
    """Modèle de réponse pour un produit"""
    id: str
    actif: bool
    prix_ref_moyen: Optional[float] = None

    class Config:
        populate_by_name = True


# ============================================================================
# Modèles Marché
# ============================================================================

class MarcheBase(BaseModel):
    """Modèle de base pour un marché"""
    nom: str = Field(..., description="Nom du marché")
    code: str = Field(..., description="Code unique du marché (ex: MAR-000001)")
    commune_id: str = Field(..., description="ID de la commune")
    type_marche: Literal["quotidien", "hebdomadaire", "occasionnel"] = Field(
        ..., description="Type de marché"
    )
    latitude: Optional[float] = Field(None, ge=-90, le=90, description="Latitude")
    longitude: Optional[float] = Field(None, ge=-180, le=180, description="Longitude")
    jours_ouverture: Optional[list[str]] = Field(None, description="Jours d'ouverture")


class MarcheCreate(MarcheBase):
    """Modèle pour la création d'un marché"""
    pass


class MarcheInDB(MarcheBase):
    """Modèle pour un marché en base de données"""
    id: str = Field(alias="_id")
    actif: bool = True
    location: Optional[dict] = None  # GeoJSON pour index 2dsphere
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}


class MarcheResponse(MarcheBase):
    """Modèle de réponse pour un marché"""
    id: str
    actif: bool

    class Config:
        populate_by_name = True


# ============================================================================
# Modèles Collecte de Prix
# ============================================================================

class CollecteBase(BaseModel):
    """Modèle de base pour une collecte de prix"""
    marche_id: str = Field(..., description="ID du marché")
    produit_id: str = Field(..., description="ID du produit")
    prix: float = Field(..., ge=0, description="Prix collecté (>= 0)")
    date: datetime = Field(..., description="Date de la collecte")
    commentaire: Optional[str] = Field(None, description="Commentaire optionnel")


class CollecteCreate(CollecteBase):
    """Modèle pour la création d'une collecte"""
    pass


class CollecteInDB(CollecteBase):
    """Modèle pour une collecte en base de données"""
    id: str = Field(alias="_id")
    agent_id: str = Field(..., description="ID de l'agent ayant collecté")
    statut: Literal["brouillon", "soumise", "validée", "rejetée"] = "soumise"
    motif_rejet: Optional[str] = None
    validee_par: Optional[str] = None
    validee_at: Optional[datetime] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    created_offline: bool = False
    synced_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}


class CollecteResponse(CollecteBase):
    """Modèle de réponse pour une collecte"""
    id: str
    agent_id: str
    statut: str
    created_at: datetime

    class Config:
        populate_by_name = True


# ============================================================================
# Modèles Alerte
# ============================================================================

class AlerteBase(BaseModel):
    """Modèle de base pour une alerte"""
    niveau: Literal["normal", "surveillance", "alerte", "urgence"] = Field(
        ..., description="Niveau de l'alerte"
    )
    type_alerte: Literal["prix_eleve", "indisponible", "tendance_haussiere"] = Field(
        ..., description="Type d'alerte"
    )
    marche_id: str
    produit_id: str
    prix_actuel: float
    prix_reference: float
    ecart_pourcentage: float


class AlerteInDB(AlerteBase):
    """Modèle pour une alerte en base de données"""
    id: str = Field(alias="_id")
    statut: Literal["active", "resolue", "fermee"] = "active"
    vue_par: list[str] = []
    created_at: datetime
    resolved_at: Optional[datetime] = None

    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}


# ============================================================================
# Modèles de Réponse Génériques
# ============================================================================

class MessageResponse(BaseModel):
    """Réponse générique avec un message"""
    message: str
    detail: Optional[str] = None


class HealthCheckResponse(BaseModel):
    """Réponse du health check"""
    status: str
    database: str
    environment: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
