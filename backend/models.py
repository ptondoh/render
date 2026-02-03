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
    prenom: Optional[str] = Field(None, description="Prénom")
    id_categorie_user: Optional[str] = Field(None, description="ID de la catégorie d'utilisateur")
    id_role: Optional[str] = Field(None, description="ID du rôle")
    departement_id: Optional[str] = Field(None, description="ID du département d'affectation")
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
# Modèles Unité de Mesure
# ============================================================================

class UniteMesureBase(BaseModel):
    """Modèle de base pour une unité de mesure"""
    unite: str = Field(..., description="Nom complet de l'unité (kilogramme, litre, sac, etc.)")
    symbole: str = Field(..., description="Symbole de l'unité (kg, L, sac, etc.)")


class UniteMesureCreate(UniteMesureBase):
    """Modèle pour la création d'une unité de mesure"""
    pass


class UniteMesureInDB(UniteMesureBase):
    """Modèle pour une unité de mesure en base de données"""
    id: str = Field(alias="_id")
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}


class UniteMesureResponse(UniteMesureBase):
    """Modèle de réponse pour une unité de mesure"""
    id: str

    class Config:
        populate_by_name = True


# ============================================================================
# Modèles Catégorie de Produit
# ============================================================================

class CategorieProduitBase(BaseModel):
    """Modèle de base pour une catégorie de produit"""
    nom: str = Field(..., description="Nom de la catégorie")
    nom_creole: Optional[str] = Field(None, description="Nom en créole haïtien")
    description: Optional[str] = Field(None, description="Description de la catégorie")


class CategorieProduitCreate(CategorieProduitBase):
    """Modèle pour la création d'une catégorie de produit"""
    pass


class CategorieProduitInDB(CategorieProduitBase):
    """Modèle pour une catégorie de produit en base de données"""
    id: str = Field(alias="_id")
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}


class CategorieProduitResponse(CategorieProduitBase):
    """Modèle de réponse pour une catégorie de produit"""
    id: str

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
    id_categorie: str = Field(..., description="ID de la catégorie")
    id_unite_mesure: str = Field(..., description="ID de l'unité de mesure")
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
    categorie_nom: Optional[str] = None
    unite_nom: Optional[str] = None

    class Config:
        populate_by_name = True


# ============================================================================
# Modèles Département
# ============================================================================

class DepartementBase(BaseModel):
    """Modèle de base pour un département"""
    code: str = Field(..., description="Code unique du département (ex: HT-OU)")
    nom: str = Field(..., description="Nom du département")
    nom_creole: Optional[str] = Field(None, description="Nom en créole haïtien")


class DepartementCreate(DepartementBase):
    """Modèle pour la création d'un département"""
    pass


class DepartementInDB(DepartementBase):
    """Modèle pour un département en base de données"""
    id: str = Field(alias="_id")
    actif: bool = True
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}


class DepartementResponse(DepartementBase):
    """Modèle de réponse pour un département"""
    id: str
    actif: bool
    nombre_communes: Optional[int] = None

    class Config:
        populate_by_name = True


# ============================================================================
# Modèles Commune
# ============================================================================

class CommuneBase(BaseModel):
    """Modèle de base pour une commune"""
    code: str = Field(..., description="Code unique de la commune")
    nom: str = Field(..., description="Nom de la commune")
    nom_creole: Optional[str] = Field(None, description="Nom en créole haïtien")
    departement_id: str = Field(..., description="ID du département")
    type_zone: Literal["urbaine", "peri-urbaine", "rurale"] = Field(
        "rurale", description="Type de zone"
    )
    population: Optional[int] = Field(None, description="Population estimée")


class CommuneCreate(CommuneBase):
    """Modèle pour la création d'une commune"""
    pass


class CommuneInDB(CommuneBase):
    """Modèle pour une commune en base de données"""
    id: str = Field(alias="_id")
    actif: bool = True
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}


class CommuneResponse(CommuneBase):
    """Modèle de réponse pour une commune"""
    id: str
    actif: bool
    departement_nom: Optional[str] = None
    nombre_marches: Optional[int] = None

    class Config:
        populate_by_name = True


# ============================================================================
# Modèles Marché
# ============================================================================

class MarcheBase(BaseModel):
    """Modèle de base pour un marché"""
    nom: str = Field(..., description="Nom du marché")
    nom_creole: Optional[str] = Field(None, description="Nom en créole haïtien")
    code: Optional[str] = Field(None, description="Code unique du marché (ex: MAR-000001)")
    commune_id: str = Field(..., description="ID de la commune")
    type_marche: Literal["quotidien", "hebdomadaire", "occasionnel"] = Field(
        "quotidien", description="Type de marché"
    )
    latitude: Optional[float] = Field(None, ge=-90, le=90, description="Latitude")
    longitude: Optional[float] = Field(None, ge=-180, le=180, description="Longitude")
    jours_ouverture: Optional[list[str]] = Field(None, description="Jours d'ouverture")
    specialites: Optional[list[str]] = Field(None, description="Spécialités du marché")
    telephone: Optional[str] = Field(None, description="Téléphone de contact")
    email: Optional[EmailStr] = Field(None, description="Email de contact")


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
    commune_nom: Optional[str] = None
    departement_nom: Optional[str] = None
    produits: Optional[list[dict]] = Field(None, description="Liste des produits du marché")

    class Config:
        populate_by_name = True


# ============================================================================
# Modèles Permission
# ============================================================================

class PermissionBase(BaseModel):
    """Modèle de base pour une permission"""
    nom: str = Field(..., description="Nom de la permission")
    action: str = Field(..., description="Action autorisée (ex: create, read, update, delete)")
    description: Optional[str] = Field(None, description="Description de la permission")


class PermissionCreate(PermissionBase):
    """Modèle pour la création d'une permission"""
    pass


class PermissionInDB(PermissionBase):
    """Modèle pour une permission en base de données"""
    id: str = Field(alias="_id")
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}


class PermissionResponse(PermissionBase):
    """Modèle de réponse pour une permission"""
    id: str

    class Config:
        populate_by_name = True


# ============================================================================
# Modèles Rôle
# ============================================================================

class RoleBase(BaseModel):
    """Modèle de base pour un rôle"""
    nom: str = Field(..., description="Nom du rôle")
    id_permissions: list[str] = Field(default=[], description="Liste des IDs de permissions")
    description: Optional[str] = Field(None, description="Description du rôle")


class RoleCreate(RoleBase):
    """Modèle pour la création d'un rôle"""
    pass


class RoleInDB(RoleBase):
    """Modèle pour un rôle en base de données"""
    id: str = Field(alias="_id")
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}


class RoleResponse(RoleBase):
    """Modèle de réponse pour un rôle"""
    id: str
    permissions: Optional[list[PermissionResponse]] = None

    class Config:
        populate_by_name = True


# ============================================================================
# Modèles Catégorie d'Utilisateur
# ============================================================================

class CategorieUserBase(BaseModel):
    """Modèle de base pour une catégorie d'utilisateur"""
    nom: str = Field(..., description="Nom de la catégorie")
    description: Optional[str] = Field(None, description="Description de la catégorie")


class CategorieUserCreate(CategorieUserBase):
    """Modèle pour la création d'une catégorie d'utilisateur"""
    pass


class CategorieUserInDB(CategorieUserBase):
    """Modèle pour une catégorie d'utilisateur en base de données"""
    id: str = Field(alias="_id")
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        populate_by_name = True
        json_encoders = {ObjectId: str}


class CategorieUserResponse(CategorieUserBase):
    """Modèle de réponse pour une catégorie d'utilisateur"""
    id: str

    class Config:
        populate_by_name = True


# ============================================================================
# Modèles Collecte de Prix
# ============================================================================

class CollecteBase(BaseModel):
    """Modèle de base pour une collecte de prix"""
    marche_id: str = Field(..., description="ID du marché")
    produit_id: str = Field(..., description="ID du produit")
    unite_id: str = Field(..., description="ID de l'unité de mesure")
    quantite: float = Field(..., gt=0, description="Quantité (> 0)")
    prix: float = Field(..., ge=0, description="Prix collecté (>= 0)")
    date: datetime = Field(..., description="Date de la collecte")
    periode: Optional[Literal["matin1", "matin2", "soir1", "soir2"]] = Field(None, description="Période de collecte (4 périodes par jour)")
    commentaire: Optional[str] = Field(None, description="Commentaire optionnel")
    image: Optional[str] = Field(None, description="Photo du produit (base64)")


class CollecteCreate(CollecteBase):
    """Modèle pour la création d'une collecte"""
    latitude: Optional[float] = Field(None, description="Latitude GPS")
    longitude: Optional[float] = Field(None, description="Longitude GPS")


class CollecteBatchCreate(BaseModel):
    """Modèle pour la création en lot de collectes"""
    collectes: list[CollecteCreate] = Field(..., description="Liste de collectes à créer")


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
    periode: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    image: Optional[str] = None
    created_at: datetime
    unite_nom: Optional[str] = None
    marche_nom: Optional[str] = None
    commune_nom: Optional[str] = None
    produit_nom: Optional[str] = None
    agent_nom: Optional[str] = None

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
