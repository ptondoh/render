"""
Router d'authentification pour SAP.
Gère l'inscription, la connexion, le MFA et les tokens JWT.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime
from bson import ObjectId

from backend.database import get_collection
from backend.services import auth as auth_service
from backend.models import UserCreate, UserResponse, UserInDB
from backend.middleware.security import get_current_user
from backend.middleware.rbac import require_decideur
from backend.middleware.audit import (
    log_action, log_auth_attempt, log_mfa_setup,
    log_mfa_verification, get_client_ip
)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


# ============================================================================
# Modèles de requête/réponse
# ============================================================================

class LoginRequest(BaseModel):
    """Requête de connexion"""
    email: EmailStr
    password: str = Field(..., min_length=8)


class LoginResponse(BaseModel):
    """Réponse de connexion"""
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str = "bearer"
    user: UserResponse
    mfa_required: bool = False
    temp_token: Optional[str] = None


class MFAVerifyRequest(BaseModel):
    """Requête de vérification MFA"""
    temp_token: str
    code: str = Field(..., min_length=6, max_length=6)


class MFASetupResponse(BaseModel):
    """Réponse de configuration MFA"""
    secret: str
    qr_code: str
    backup_codes: list[str]


class MFAVerifySetupRequest(BaseModel):
    """Requête de vérification de configuration MFA"""
    code: str = Field(..., min_length=6, max_length=6)


class RefreshTokenRequest(BaseModel):
    """Requête de rafraîchissement de token"""
    refresh_token: str


class TokenResponse(BaseModel):
    """Réponse avec nouveau token"""
    access_token: str
    token_type: str = "bearer"


# ============================================================================
# Endpoints d'authentification de base
# ============================================================================

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate, request: Request):
    """
    Inscrire un nouvel utilisateur.
    Seuls les décideurs peuvent créer de nouveaux utilisateurs.
    """
    users_collection = get_collection("users")

    # Vérifier si l'email existe déjà
    existing_user = await users_collection.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Un utilisateur avec cet email existe déjà"
        )

    # Hacher le mot de passe
    password_hash = auth_service.hash_password(user_data.password)

    # Créer le document utilisateur
    user_doc = {
        "_id": str(ObjectId()),
        "email": user_data.email,
        "password_hash": password_hash,
        "roles": user_data.roles,
        "nom": user_data.nom,
        "departement_id": user_data.departement_id,
        "telephone": user_data.telephone,
        "actif": user_data.actif,
        "mfa_enabled": False,
        "mfa_secret": None,
        "mfa_backup_codes": [],
        "created_at": datetime.utcnow(),
        "updated_at": None
    }

    # Insérer dans la base de données
    await users_collection.insert_one(user_doc)

    # Log de l'action
    ip_address = get_client_ip(request)
    await log_action(
        user_id=user_doc["_id"],
        action="user_created",
        resource_type="user",
        resource_id=user_doc["_id"],
        details={"email": user_data.email, "roles": user_data.roles},
        ip_address=ip_address
    )

    # Retourner l'utilisateur créé
    return UserResponse(
        id=user_doc["_id"],
        email=user_doc["email"],
        role=user_doc["role"],
        nom=user_doc["nom"],
        departement_id=user_doc["departement_id"],
        telephone=user_doc["telephone"],
        actif=user_doc["actif"],
        mfa_enabled=user_doc["mfa_enabled"],
        created_at=user_doc["created_at"]
    )


@router.post("/login", response_model=LoginResponse)
async def login(credentials: LoginRequest, request: Request):
    """
    Connexion d'un utilisateur.
    Si MFA activé, retourne un temp_token pour vérification.
    Sinon retourne directement les tokens d'accès.
    """
    users_collection = get_collection("users")
    ip_address = get_client_ip(request)

    # Rechercher l'utilisateur
    user_doc = await users_collection.find_one({"email": credentials.email})

    if not user_doc:
        await log_auth_attempt(
            email=credentials.email,
            success=False,
            ip_address=ip_address,
            reason="Email non trouvé"
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect"
        )

    # Vérifier le mot de passe
    if not auth_service.verify_password(credentials.password, user_doc["password_hash"]):
        await log_auth_attempt(
            email=credentials.email,
            success=False,
            ip_address=ip_address,
            reason="Mot de passe incorrect"
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect"
        )

    # Vérifier que le compte est actif
    if not user_doc.get("actif", True):
        await log_auth_attempt(
            email=credentials.email,
            success=False,
            ip_address=ip_address,
            reason="Compte désactivé"
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Compte désactivé"
        )

    user = UserInDB(**user_doc)

    # Si MFA activé, retourner un temp token
    if user.mfa_enabled:
        temp_token = auth_service.create_access_token(
            data={"sub": str(user.id), "type": "mfa_pending"},
            expires_delta=None  # Utilise le délai par défaut
        )

        return LoginResponse(
            access_token="",
            token_type="bearer",
            user=UserResponse(
                id=user.id,
                email=user.email,
                roles=user.roles,
                nom=user.nom,
                departement_id=user.departement_id,
                telephone=user.telephone,
                actif=user.actif,
                mfa_enabled=user.mfa_enabled,
                created_at=user.created_at
            ),
            mfa_required=True,
            temp_token=temp_token
        )

    # Sinon, générer les tokens normaux
    access_token = auth_service.create_access_token(
        data={"sub": str(user.id), "email": user.email, "roles": user.roles}
    )

    refresh_token = auth_service.create_refresh_token(
        data={"sub": str(user.id)}
    )

    await log_auth_attempt(
        email=credentials.email,
        success=True,
        ip_address=ip_address
    )

    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        user=UserResponse(
            id=user.id,
            email=user.email,
            roles=user.roles,
            nom=user.nom,
            departement_id=user.departement_id,
            telephone=user.telephone,
            actif=user.actif,
            mfa_enabled=user.mfa_enabled,
            created_at=user.created_at
        ),
        mfa_required=False
    )


@router.post("/verify-mfa", response_model=LoginResponse)
async def verify_mfa(verify_data: MFAVerifyRequest, request: Request):
    """
    Vérifier le code MFA et retourner les tokens d'accès.
    """
    ip_address = get_client_ip(request)

    # Décoder le temp token
    payload = auth_service.decode_token(verify_data.temp_token)

    if not payload or payload.get("type") != "mfa_pending":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token temporaire invalide"
        )

    user_id = payload.get("sub")

    # Récupérer l'utilisateur
    users_collection = get_collection("users")
    # Convertir user_id (string du JWT) en ObjectId pour la requête MongoDB
    user_doc = await users_collection.find_one({"_id": ObjectId(user_id)})

    if not user_doc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Utilisateur non trouvé"
        )

    user = UserInDB(**user_doc)

    # Déchiffrer le secret MFA
    decrypted_secret = auth_service.decrypt_mfa_secret(user.mfa_secret)

    # Vérifier le code TOTP
    is_valid_totp = auth_service.verify_totp(decrypted_secret, verify_data.code)

    # Si le code TOTP n'est pas valide, vérifier les backup codes
    if not is_valid_totp:
        is_valid_backup = auth_service.verify_backup_code(
            verify_data.code,
            user.mfa_backup_codes
        )

        if is_valid_backup:
            # Retirer le backup code utilisé
            updated_codes = [
                code for code in user.mfa_backup_codes
                if not auth_service.verify_password(verify_data.code, code)
            ]
            await users_collection.update_one(
                {"_id": user_id},
                {"$set": {"mfa_backup_codes": updated_codes}}
            )

            await log_mfa_verification(
                user_id=user_id,
                success=True,
                method="backup_code",
                ip_address=ip_address
            )
        else:
            await log_mfa_verification(
                user_id=user_id,
                success=False,
                method="totp",
                ip_address=ip_address
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Code MFA invalide"
            )
    else:
        await log_mfa_verification(
            user_id=user_id,
            success=True,
            method="totp",
            ip_address=ip_address
        )

    # Générer les tokens
    access_token = auth_service.create_access_token(
        data={"sub": str(user.id), "email": user.email, "roles": user.roles}
    )

    refresh_token = auth_service.create_refresh_token(
        data={"sub": str(user.id)}
    )

    await log_auth_attempt(
        email=user.email,
        success=True,
        ip_address=ip_address
    )

    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        user=UserResponse(
            id=user.id,
            email=user.email,
            roles=user.roles,
            nom=user.nom,
            departement_id=user.departement_id,
            telephone=user.telephone,
            actif=user.actif,
            mfa_enabled=user.mfa_enabled,
            created_at=user.created_at
        ),
        mfa_required=False
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(token_data: RefreshTokenRequest):
    """
    Rafraîchir le token d'accès avec un refresh token.
    """
    payload = auth_service.decode_token(token_data.refresh_token)

    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token invalide"
        )

    user_id = payload.get("sub")

    # Vérifier que l'utilisateur existe toujours
    users_collection = get_collection("users")
    # Convertir user_id (string du JWT) en ObjectId pour la requête MongoDB
    user_doc = await users_collection.find_one({"_id": ObjectId(user_id)})

    if not user_doc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Utilisateur non trouvé"
        )

    user = UserInDB(**user_doc)

    if not user.actif:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Compte désactivé"
        )

    # Générer un nouveau access token
    access_token = auth_service.create_access_token(
        data={"sub": str(user.id), "email": user.email, "roles": user.roles}
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer"
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: UserInDB = Depends(get_current_user)):
    """
    Obtenir les informations de l'utilisateur authentifié actuel.
    """
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        role=current_user.role,
        nom=current_user.nom,
        departement_id=current_user.departement_id,
        telephone=current_user.telephone,
        actif=current_user.actif,
        mfa_enabled=current_user.mfa_enabled,
        created_at=current_user.created_at
    )


# ============================================================================
# Endpoints MFA
# ============================================================================

@router.post("/mfa/setup", response_model=MFASetupResponse)
async def setup_mfa(
    request: Request,
    current_user: UserInDB = Depends(get_current_user)
):
    """
    Configurer le MFA pour l'utilisateur actuel.
    Génère un secret TOTP, un QR code et des backup codes.
    """
    # Générer le secret MFA
    secret = auth_service.generate_mfa_secret()

    # Générer l'URI TOTP
    totp_uri = auth_service.generate_totp_uri(secret, current_user.email)

    # Générer le QR code
    qr_code = auth_service.generate_qr_code(totp_uri)

    # Générer les backup codes
    backup_codes = auth_service.generate_backup_codes(8)

    # Chiffrer le secret
    encrypted_secret = auth_service.encrypt_mfa_secret(secret)

    # Hacher les backup codes pour le stockage
    hashed_backup_codes = auth_service.hash_backup_codes(backup_codes)

    # Stocker temporairement (ne sera activé qu'après vérification)
    users_collection = get_collection("users")
    await users_collection.update_one(
        {"_id": current_user.id},
        {
            "$set": {
                "mfa_secret": encrypted_secret,
                "mfa_backup_codes": hashed_backup_codes,
                "updated_at": datetime.utcnow()
            }
        }
    )

    return MFASetupResponse(
        secret=secret,
        qr_code=qr_code,
        backup_codes=backup_codes
    )


@router.post("/mfa/verify-setup", response_model=dict)
async def verify_mfa_setup(
    verify_data: MFAVerifySetupRequest,
    request: Request,
    current_user: UserInDB = Depends(get_current_user)
):
    """
    Vérifier et activer le MFA après configuration.
    L'utilisateur doit fournir un code TOTP valide pour confirmer.
    """
    users_collection = get_collection("users")

    # Récupérer le secret stocké
    # Convertir current_user.id (string/PyObjectId) en ObjectId pour la requête MongoDB
    user_doc = await users_collection.find_one({"_id": ObjectId(current_user.id)})

    if not user_doc or not user_doc.get("mfa_secret"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MFA non configuré. Appelez d'abord /mfa/setup"
        )

    # Déchiffrer le secret
    decrypted_secret = auth_service.decrypt_mfa_secret(user_doc["mfa_secret"])

    # Vérifier le code
    if not auth_service.verify_totp(decrypted_secret, verify_data.code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Code MFA invalide"
        )

    # Activer le MFA
    await users_collection.update_one(
        {"_id": current_user.id},
        {
            "$set": {
                "mfa_enabled": True,
                "updated_at": datetime.utcnow()
            }
        }
    )

    # Log de l'activation
    ip_address = get_client_ip(request)
    await log_mfa_setup(user_id=current_user.id, ip_address=ip_address)

    return {
        "message": "MFA activé avec succès",
        "mfa_enabled": True
    }


@router.post("/mfa/disable", response_model=dict)
async def disable_mfa(
    request: Request,
    current_user: UserInDB = Depends(get_current_user)
):
    """
    Désactiver le MFA pour l'utilisateur actuel.
    """
    users_collection = get_collection("users")

    await users_collection.update_one(
        {"_id": current_user.id},
        {
            "$set": {
                "mfa_enabled": False,
                "mfa_secret": None,
                "mfa_backup_codes": [],
                "updated_at": datetime.utcnow()
            }
        }
    )

    # Log de la désactivation
    ip_address = get_client_ip(request)
    await log_action(
        user_id=current_user.id,
        action="mfa_disabled",
        details={"mfa_enabled": False},
        ip_address=ip_address
    )

    return {
        "message": "MFA désactivé avec succès",
        "mfa_enabled": False
    }
