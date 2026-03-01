"""
Router d'authentification pour SAP.
Gère l'inscription, la connexion, le MFA et les tokens JWT.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Literal
from datetime import datetime, timedelta
from bson import ObjectId
import secrets

from backend.database import get_collection
from backend.services import auth as auth_service
from backend.services.email import send_otp_email
from backend.models import UserCreate, UserResponse, UserInDB, ChangePasswordRequest, ProfileUpdateRequest
from backend.middleware.security import get_current_user
from backend.middleware.rbac import require_decideur
from backend.middleware.audit import (
    log_action, log_auth_attempt, log_mfa_setup,
    log_mfa_verification, get_client_ip
)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


# ============================================================================
# Helper Functions
# ============================================================================

async def get_role_names_from_ids(role_ids: list[str]) -> list[str]:
    """
    Récupère les noms des rôles depuis leurs IDs.
    Retourne une liste de noms de rôles.
    """
    if not role_ids:
        return []

    roles_collection = get_collection("roles")

    # Convertir les string IDs en ObjectId
    object_ids = []
    for role_id in role_ids:
        if ObjectId.is_valid(role_id):
            object_ids.append(ObjectId(role_id))

    if not object_ids:
        return []

    # Charger les rôles depuis la BDD
    roles = await roles_collection.find({"_id": {"$in": object_ids}}).to_list(None)

    # Extraire les noms
    role_names = [role.get("nom", "") for role in roles if "nom" in role]

    return role_names


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
    mfa_method: Optional[str] = None  # "totp" ou "email"
    temp_token: Optional[str] = None


class MFAVerifyRequest(BaseModel):
    """Requête de vérification MFA (temp_token passé dans le header Authorization)"""
    code: str = Field(..., min_length=6, max_length=8)


class TwoFAMethodRequest(BaseModel):
    """Requête de mise à jour de la méthode de 2e facteur"""
    method: Literal["none", "totp", "email"] = Field(..., description="Méthode: none, totp, email")


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

    # Enrichir avec les noms des rôles
    role_names = await get_role_names_from_ids(user_doc["roles"])

    # Retourner l'utilisateur créé
    return UserResponse(
        id=user_doc["_id"],
        email=user_doc["email"],
        roles=user_doc["roles"],
        role_names=role_names,
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

    # Vérifier que l'utilisateur a au moins un rôle
    if not user_doc.get("roles"):
        await log_auth_attempt(
            email=credentials.email,
            success=False,
            ip_address=ip_address,
            reason="Aucun rôle assigné"
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Votre compte n'a pas de rôle assigné. Veuillez contacter l'administrateur."
        )

    user = UserInDB(**user_doc)

    # Déterminer la méthode de 2e facteur
    two_fa_method = user.two_fa_method or "none"

    if two_fa_method == "email":
        # Générer un OTP à 6 chiffres
        otp_code = ''.join(secrets.choice('0123456789') for _ in range(6))
        otp_hash = auth_service.hash_password(otp_code)
        otp_expires = datetime.utcnow() + timedelta(minutes=10)

        # Stocker l'OTP en base
        await users_collection.update_one(
            {"_id": user_doc["_id"]},
            {"$set": {"email_otp_hash": otp_hash, "email_otp_expires_at": otp_expires}}
        )

        # Afficher l'OTP dans la console (mode dev)
        await send_otp_email(user.email, otp_code)

        temp_token = auth_service.create_access_token(
            data={"sub": str(user.id), "type": "mfa_pending"},
            expires_delta=timedelta(minutes=10)
        )

        role_names = await get_role_names_from_ids(user.roles)
        return LoginResponse(
            access_token="",
            token_type="bearer",
            user=UserResponse(
                id=user.id,
                email=user.email,
                roles=user.roles,
                role_names=role_names,
                nom=user.nom,
                departement_id=user.departement_id,
                telephone=user.telephone,
                actif=user.actif,
                mfa_enabled=user.mfa_enabled,
                created_at=user.created_at
            ),
            mfa_required=True,
            mfa_method="email",
            temp_token=temp_token
        )

    elif two_fa_method == "totp" or (two_fa_method == "none" and user.mfa_enabled):
        # Flux TOTP (comportement existant)
        temp_token = auth_service.create_access_token(
            data={"sub": str(user.id), "type": "mfa_pending"},
            expires_delta=None
        )

        role_names = await get_role_names_from_ids(user.roles)
        return LoginResponse(
            access_token="",
            token_type="bearer",
            user=UserResponse(
                id=user.id,
                email=user.email,
                roles=user.roles,
                role_names=role_names,
                nom=user.nom,
                departement_id=user.departement_id,
                telephone=user.telephone,
                actif=user.actif,
                mfa_enabled=user.mfa_enabled,
                created_at=user.created_at
            ),
            mfa_required=True,
            mfa_method="totp",
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

    # Enrichir avec les noms des rôles
    role_names = await get_role_names_from_ids(user.roles)

    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        user=UserResponse(
            id=user.id,
            email=user.email,
            roles=user.roles,
            role_names=role_names,
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
    Vérifier le code MFA (TOTP ou OTP email) et retourner les tokens d'accès.
    Le temp_token doit être passé dans le header Authorization: Bearer <temp_token>.
    """
    ip_address = get_client_ip(request)

    # Extraire le temp_token depuis le header Authorization
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token temporaire manquant dans le header Authorization"
        )
    temp_token = auth_header[7:]

    # Décoder le temp token
    payload = auth_service.decode_token(temp_token)

    if not payload or payload.get("type") != "mfa_pending":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token temporaire invalide"
        )

    user_id = payload.get("sub")

    # Récupérer l'utilisateur
    users_collection = get_collection("users")
    user_doc = await users_collection.find_one({"_id": ObjectId(user_id)})

    if not user_doc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Utilisateur non trouvé"
        )

    user = UserInDB(**user_doc)
    two_fa_method = user.two_fa_method or "none"

    if two_fa_method == "email":
        # Vérification OTP email
        otp_hash = user_doc.get("email_otp_hash")
        otp_expires = user_doc.get("email_otp_expires_at")

        if not otp_hash or not otp_expires:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Code OTP non généré. Veuillez vous reconnecter."
            )

        if datetime.utcnow() > otp_expires:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Code OTP expiré. Veuillez vous reconnecter."
            )

        if not auth_service.verify_password(verify_data.code, otp_hash):
            await log_mfa_verification(
                user_id=user_id, success=False, method="email_otp", ip_address=ip_address
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Code OTP invalide"
            )

        # Effacer l'OTP utilisé
        await users_collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$unset": {"email_otp_hash": "", "email_otp_expires_at": ""}}
        )
        await log_mfa_verification(
            user_id=user_id, success=True, method="email_otp", ip_address=ip_address
        )

    else:
        # Vérification TOTP (comportement existant)
        decrypted_secret = auth_service.decrypt_mfa_secret(user.mfa_secret)
        is_valid_totp = auth_service.verify_totp(decrypted_secret, verify_data.code)

        if not is_valid_totp:
            is_valid_backup = auth_service.verify_backup_code(
                verify_data.code,
                user.mfa_backup_codes
            )

            if is_valid_backup:
                updated_codes = [
                    code for code in user.mfa_backup_codes
                    if not auth_service.verify_password(verify_data.code, code)
                ]
                await users_collection.update_one(
                    {"_id": user_id},
                    {"$set": {"mfa_backup_codes": updated_codes}}
                )
                await log_mfa_verification(
                    user_id=user_id, success=True, method="backup_code", ip_address=ip_address
                )
            else:
                await log_mfa_verification(
                    user_id=user_id, success=False, method="totp", ip_address=ip_address
                )
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Code MFA invalide"
                )
        else:
            await log_mfa_verification(
                user_id=user_id, success=True, method="totp", ip_address=ip_address
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

    # Enrichir avec les noms des rôles
    role_names = await get_role_names_from_ids(user.roles)

    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        user=UserResponse(
            id=user.id,
            email=user.email,
            roles=user.roles,
            role_names=role_names,
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
    # Enrichir avec les noms des rôles
    role_names = await get_role_names_from_ids(current_user.roles)

    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        roles=current_user.roles,
        role_names=role_names,
        nom=current_user.nom,
        departement_id=current_user.departement_id,
        telephone=current_user.telephone,
        actif=current_user.actif,
        mfa_enabled=current_user.mfa_enabled,
        two_fa_method=current_user.two_fa_method,
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
                "two_fa_method": "totp",
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
                "two_fa_method": "none",
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


# ============================================================================
# Endpoints Profil Utilisateur
# ============================================================================

@router.post("/change-password", response_model=dict)
async def change_password(
    password_data: ChangePasswordRequest,
    request: Request,
    current_user: UserInDB = Depends(get_current_user)
):
    """
    Changer son propre mot de passe.
    Vérifie l'ancien mot de passe avant de mettre à jour.
    """
    users_collection = get_collection("users")
    ip_address = get_client_ip(request)

    # Récupérer le document complet (current_user ne contient pas password_hash)
    user_doc = await users_collection.find_one({"_id": ObjectId(current_user.id)})
    if not user_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Utilisateur non trouvé")

    # Vérifier l'ancien mot de passe
    if not auth_service.verify_password(password_data.current_password, user_doc["password_hash"]):
        await log_action(
            user_id=str(current_user.id),
            action="password_change_failed",
            resource_type="user",
            resource_id=str(current_user.id),
            details={"reason": "Mot de passe actuel incorrect"},
            ip_address=ip_address
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mot de passe actuel incorrect"
        )

    # Hacher et sauvegarder le nouveau mot de passe
    new_hash = auth_service.hash_password(password_data.new_password)
    await users_collection.update_one(
        {"_id": ObjectId(current_user.id)},
        {"$set": {"password_hash": new_hash, "updated_at": datetime.utcnow()}}
    )

    await log_action(
        user_id=str(current_user.id),
        action="password_changed",
        resource_type="user",
        resource_id=str(current_user.id),
        details={"method": "self_service"},
        ip_address=ip_address
    )

    return {"message": "Mot de passe changé avec succès"}


@router.patch("/two-fa-method", response_model=dict)
async def update_two_fa_method(
    data: TwoFAMethodRequest,
    request: Request,
    current_user: UserInDB = Depends(get_current_user)
):
    """
    Mettre à jour la méthode de 2e facteur.
    Si on quitte 'totp', les données TOTP sont effacées automatiquement.
    Pour activer 'totp', utiliser le flux /mfa/setup + /mfa/verify-setup.
    """
    users_collection = get_collection("users")
    ip_address = get_client_ip(request)

    update_fields = {
        "two_fa_method": data.method,
        "updated_at": datetime.utcnow()
    }

    # Si on quitte totp, effacer les données TOTP
    if data.method != "totp":
        update_fields.update({
            "mfa_enabled": False,
            "mfa_secret": None,
            "mfa_backup_codes": []
        })

    await users_collection.update_one(
        {"_id": ObjectId(current_user.id)},
        {"$set": update_fields}
    )

    await log_action(
        user_id=str(current_user.id),
        action="two_fa_method_updated",
        resource_type="user",
        resource_id=str(current_user.id),
        details={"two_fa_method": data.method},
        ip_address=ip_address
    )

    return {"message": f"Méthode de vérification mise à jour : {data.method}", "two_fa_method": data.method}


@router.patch("/profile", response_model=UserResponse)
async def update_profile(
    profile_data: ProfileUpdateRequest,
    request: Request,
    current_user: UserInDB = Depends(get_current_user)
):
    """
    Mettre à jour les informations personnelles (nom, prenom, telephone uniquement).
    Email et rôles ne sont pas modifiables via cet endpoint.
    """
    users_collection = get_collection("users")
    ip_address = get_client_ip(request)

    # Ne mettre à jour que les champs fournis
    update_fields = {"updated_at": datetime.utcnow()}
    if profile_data.nom is not None:
        update_fields["nom"] = profile_data.nom.strip() or None
    if profile_data.prenom is not None:
        update_fields["prenom"] = profile_data.prenom.strip() or None
    if profile_data.telephone is not None:
        update_fields["telephone"] = profile_data.telephone.strip() or None

    await users_collection.update_one(
        {"_id": ObjectId(current_user.id)},
        {"$set": update_fields}
    )

    updated_doc = await users_collection.find_one({"_id": ObjectId(current_user.id)})

    await log_action(
        user_id=str(current_user.id),
        action="profile_updated",
        resource_type="user",
        resource_id=str(current_user.id),
        details={"fields_updated": [k for k in update_fields if k != "updated_at"]},
        ip_address=ip_address
    )

    role_names = await get_role_names_from_ids(updated_doc.get("roles", []))
    return UserResponse(
        id=updated_doc["_id"],
        email=updated_doc["email"],
        roles=updated_doc.get("roles", []),
        role_names=role_names,
        nom=updated_doc.get("nom"),
        prenom=updated_doc.get("prenom"),
        departement_id=updated_doc.get("departement_id"),
        telephone=updated_doc.get("telephone"),
        actif=updated_doc.get("actif", True),
        mfa_enabled=updated_doc.get("mfa_enabled", False),
        two_fa_method=updated_doc.get("two_fa_method", "none"),
        created_at=updated_doc["created_at"]
    )
