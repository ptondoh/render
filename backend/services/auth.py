"""
Service d'authentification pour SAP.
Gère le hachage des mots de passe, JWT, et MFA (TOTP).
"""

from datetime import datetime, timedelta
from typing import Optional
import secrets
import base64

import bcrypt
from jose import JWTError, jwt
import pyotp
import qrcode
from io import BytesIO

from backend.config import settings


# ============================================================================
# Gestion des mots de passe
# ============================================================================

def hash_password(password: str) -> str:
    """
    Hacher un mot de passe avec bcrypt.

    Args:
        password: Mot de passe en clair

    Returns:
        Hash bcrypt du mot de passe
    """
    # Bcrypt a une limite de 72 bytes
    # Encoder et tronquer si nécessaire
    password_bytes = password.encode('utf-8')[:72]
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Vérifier un mot de passe contre son hash.

    Args:
        plain_password: Mot de passe en clair
        hashed_password: Hash bcrypt du mot de passe

    Returns:
        True si le mot de passe correspond, False sinon
    """
    password_bytes = plain_password.encode('utf-8')[:72]
    hashed_bytes = hashed_password.encode('utf-8')
    return bcrypt.checkpw(password_bytes, hashed_bytes)


# ============================================================================
# Gestion des tokens JWT
# ============================================================================

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Créer un token JWT d'accès.

    Args:
        data: Données à encoder dans le token (user_id, email, role, etc.)
        expires_delta: Durée de validité personnalisée (optionnel)

    Returns:
        Token JWT encodé
    """
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            minutes=settings.jwt_access_token_expire_minutes
        )

    to_encode.update({
        "exp": expire,
        "iat": datetime.utcnow(),
        "type": "access"
    })

    encoded_jwt = jwt.encode(
        to_encode,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm
    )

    return encoded_jwt


def create_refresh_token(data: dict) -> str:
    """
    Créer un token JWT de rafraîchissement.

    Args:
        data: Données à encoder dans le token (user_id uniquement)

    Returns:
        Token JWT de rafraîchissement encodé
    """
    to_encode = data.copy()

    expire = datetime.utcnow() + timedelta(
        days=settings.jwt_refresh_token_expire_days
    )

    to_encode.update({
        "exp": expire,
        "iat": datetime.utcnow(),
        "type": "refresh"
    })

    encoded_jwt = jwt.encode(
        to_encode,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm
    )

    return encoded_jwt


def decode_token(token: str) -> Optional[dict]:
    """
    Décoder et vérifier un token JWT.

    Args:
        token: Token JWT à décoder

    Returns:
        Payload du token si valide, None sinon
    """
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm]
        )
        return payload
    except JWTError:
        return None


# ============================================================================
# Gestion MFA (TOTP)
# ============================================================================

def generate_mfa_secret() -> str:
    """
    Générer un secret aléatoire pour TOTP.

    Returns:
        Secret TOTP en base32
    """
    return pyotp.random_base32()


def generate_totp_uri(secret: str, email: str) -> str:
    """
    Générer l'URI TOTP pour les applications d'authentification.

    Args:
        secret: Secret TOTP
        email: Email de l'utilisateur

    Returns:
        URI au format otpauth://
    """
    totp = pyotp.TOTP(secret)
    return totp.provisioning_uri(
        name=email,
        issuer_name="SAP - Système d'Alerte Précoce"
    )


def generate_qr_code(totp_uri: str) -> str:
    """
    Générer un QR code pour l'URI TOTP.

    Args:
        totp_uri: URI TOTP

    Returns:
        QR code en base64 (image PNG)
    """
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(totp_uri)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")

    # Convertir en base64
    buffer = BytesIO()
    img.save(buffer, format="PNG")
    img_str = base64.b64encode(buffer.getvalue()).decode()

    return f"data:image/png;base64,{img_str}"


def verify_totp(secret: str, code: str) -> bool:
    """
    Vérifier un code TOTP.

    Args:
        secret: Secret TOTP de l'utilisateur
        code: Code à 6 chiffres fourni par l'utilisateur

    Returns:
        True si le code est valide, False sinon
    """
    totp = pyotp.TOTP(secret)
    return totp.verify(code, valid_window=1)  # Accepte ±30 secondes


def generate_backup_codes(count: int = 8) -> list[str]:
    """
    Générer des codes de backup pour MFA.

    Args:
        count: Nombre de codes à générer (défaut: 8)

    Returns:
        Liste de codes de backup
    """
    codes = []
    for _ in range(count):
        # Générer un code de 8 caractères alphanumériques
        code = secrets.token_hex(4).upper()
        # Formater comme XXXX-XXXX
        formatted = f"{code[:4]}-{code[4:]}"
        codes.append(formatted)

    return codes


def hash_backup_codes(codes: list[str]) -> list[str]:
    """
    Hacher les codes de backup avant stockage.

    Args:
        codes: Liste de codes en clair

    Returns:
        Liste de codes hachés
    """
    return [hash_password(code) for code in codes]


def verify_backup_code(code: str, hashed_codes: list[str]) -> bool:
    """
    Vérifier un code de backup contre la liste des codes hachés.

    Args:
        code: Code fourni par l'utilisateur
        hashed_codes: Liste des codes de backup hachés

    Returns:
        True si le code correspond, False sinon
    """
    for hashed_code in hashed_codes:
        if verify_password(code, hashed_code):
            return True
    return False


# ============================================================================
# Fonctions utilitaires
# ============================================================================

def encrypt_mfa_secret(secret: str) -> str:
    """
    Chiffrer le secret MFA avant stockage en base de données.
    Note: Pour une sécurité maximale, utiliser Fernet de cryptography.

    Args:
        secret: Secret MFA en clair

    Returns:
        Secret chiffré
    """
    # Pour Phase 0, simple encodage base64
    # En production, utiliser Fernet avec settings.mfa_encryption_key
    from cryptography.fernet import Fernet

    # Utiliser la clé de chiffrement MFA
    key = settings.mfa_encryption_key.encode()

    # S'assurer que la clé est au bon format (32 bytes url-safe base64)
    if len(key) != 44:  # 32 bytes en base64 = 44 caractères
        # Si la clé n'est pas au bon format, la dériver
        import hashlib
        key = base64.urlsafe_b64encode(
            hashlib.sha256(key).digest()
        )

    fernet = Fernet(key)
    encrypted = fernet.encrypt(secret.encode())

    return encrypted.decode()


def decrypt_mfa_secret(encrypted_secret: str) -> str:
    """
    Déchiffrer le secret MFA.

    Args:
        encrypted_secret: Secret MFA chiffré

    Returns:
        Secret MFA en clair
    """
    from cryptography.fernet import Fernet

    key = settings.mfa_encryption_key.encode()

    if len(key) != 44:
        import hashlib
        key = base64.urlsafe_b64encode(
            hashlib.sha256(key).digest()
        )

    fernet = Fernet(key)
    decrypted = fernet.decrypt(encrypted_secret.encode())

    return decrypted.decode()
