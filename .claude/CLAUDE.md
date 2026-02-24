# CLAUDE.md — Règles de Sécurité pour Stack FastAPI / HTML / JavaScript

> **Projet** : SAP — Système d'Alerte Précoce (Sécurité Alimentaire — Haïti)  
> **Stack** : FastAPI (Python) · HTML/CSS · JavaScript · MongoDB  
> **Standards** : OWASP Top 10 2025 · OWASP ASVS · CWE Top 25 · NIST SSDF  
> **Niveau d'application** : `strict` = refuser · `warning` = avertir · `advisory` = mentionner

---

## 1. PRINCIPES FONDAMENTAUX DE SÉCURITÉ

### 1.1 Posture générale

- Toujours appliquer le principe du moindre privilège.
- Ne jamais faire confiance aux entrées utilisateur (zero trust input).
- Toute donnée provenant du client (query params, headers, body, cookies, path params) est considérée **non fiable**.
- Les secrets (clés API, mots de passe DB, JWT secrets) ne doivent **jamais** apparaître en clair dans le code source. Utiliser des variables d'environnement via `python-decouple` ou `pydantic-settings`.
- Ne jamais désactiver les fonctionnalités de sécurité pour "simplifier le développement".

### 1.2 Dépendances

- Utiliser uniquement des paquets bien maintenus avec des versions fixées (`pip freeze`, `poetry.lock`).
- Vérifier les vulnérabilités connues avec `pip-audit` ou `safety check` avant chaque déploiement.
- Ne jamais installer de paquet suggéré sans vérifier son existence sur PyPI/npm et sa réputation.

---

## 2. RÈGLES PYTHON (Niveau: strict)

### 2.1 Injection de commandes

**Do** :
```python
import subprocess
result = subprocess.run(["ls", "-la", user_path], capture_output=True, shell=False)
```

**Don't** :
```python
import os
os.system(f"ls -la {user_path}")  # Injection de commande !
```

**Why** : L'injection de commande OS permet l'exécution de code arbitraire sur le serveur.  
**Refs** : CWE-78, OWASP A03:2025

### 2.2 Désérialisation non sécurisée

**Do** :
```python
import json
data = json.loads(user_input)
```

**Don't** :
```python
import pickle
data = pickle.loads(user_input)  # Exécution de code arbitraire !
```
```python
import yaml
data = yaml.load(user_input)  # Utiliser yaml.safe_load() !
```

**Why** : `pickle`, `marshal`, `shelve` et `yaml.load()` permettent l'exécution de code arbitraire lors de la désérialisation.  
**Refs** : CWE-502, OWASP A08:2025

### 2.3 Eval / Exec

**Level** : `strict`

- Ne **jamais** utiliser `eval()`, `exec()`, `compile()` avec des entrées utilisateur.
- Ne jamais utiliser `__import__()` avec des chaînes fournies par l'utilisateur.

### 2.4 Gestion des erreurs

**Do** :
```python
try:
    result = perform_operation()
except SpecificError as e:
    logger.error(f"Opération échouée: {e}")
    raise HTTPException(status_code=500, detail="Erreur interne du serveur")
```

**Don't** :
```python
except Exception as e:
    return {"error": str(e), "traceback": traceback.format_exc()}  # Fuite d'information !
```

**Why** : Les messages d'erreur détaillés révèlent la structure interne de l'application aux attaquants.  
**Refs** : CWE-209, OWASP A04:2025

### 2.5 Logging sécurisé

- Ne jamais logger de mots de passe, tokens, données personnelles (PII), ou données de santé.
- Utiliser un format structuré (JSON) pour les logs.
- Sanitiser les données avant le logging.

---

## 3. RÈGLES FASTAPI (Niveau: strict)

### 3.1 Validation des entrées avec Pydantic

**Do** :
```python
from pydantic import BaseModel, Field, validator
from typing import Optional

class AlerteCreate(BaseModel):
    region_id: int = Field(..., gt=0)
    niveau_alerte: int = Field(..., ge=1, le=5)
    description: str = Field(..., min_length=10, max_length=2000)
    
    @validator('description')
    def sanitize_description(cls, v):
        # Supprimer les balises HTML potentielles
        import bleach
        return bleach.clean(v, tags=[], strip=True)
```

**Don't** :
```python
@app.post("/alertes")
async def create_alerte(request: Request):
    data = await request.json()  # Aucune validation !
    region_id = data["region_id"]
```

**Why** : Pydantic valide automatiquement les types, les plages et les formats. Contourner cette validation expose à l'injection et aux données corrompues.  
**Refs** : CWE-20, OWASP A03:2025

### 3.2 Authentification JWT

**Do** :
```python
from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

def create_access_token(data: dict, expires_delta: timedelta = timedelta(minutes=30)):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + expires_delta
    to_encode.update({"exp": expire, "iat": datetime.now(timezone.utc)})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm="HS256")

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Identifiants invalides",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    return await get_user(user_id)
```

**Don't** :
```python
# Ne jamais décoder sans vérifier la signature
payload = jwt.decode(token, options={"verify_signature": False})

# Ne jamais stocker le JWT en localStorage côté client (XSS)
# Utiliser des cookies HttpOnly à la place
```

**Why** : Un JWT non vérifié permet l'usurpation d'identité. Un JWT stocké en localStorage est vulnérable au vol via XSS.  
**Refs** : CWE-287, CWE-522, OWASP A07:2025

### 3.3 Contrôle d'accès (RBAC)

**Do** :
```python
from enum import Enum

class Role(str, Enum):
    AGENT_TERRAIN = "agent_terrain"
    SUPERVISEUR = "superviseur"
    ADMIN = "admin"

def require_role(required_role: Role):
    async def role_checker(current_user = Depends(get_current_user)):
        if current_user.role != required_role and current_user.role != Role.ADMIN:
            raise HTTPException(status_code=403, detail="Accès interdit")
        return current_user
    return role_checker

@app.delete("/zones/{zone_id}", dependencies=[Depends(require_role(Role.ADMIN))])
async def delete_zone(zone_id: int):
    ...
```

**Don't** :
```python
@app.delete("/zones/{zone_id}")
async def delete_zone(zone_id: int, current_user = Depends(get_current_user)):
    # Pas de vérification de rôle ! Tout utilisateur authentifié peut supprimer.
    ...
```

**Why** : L'absence de contrôle d'accès granulaire est la vulnérabilité web #1 (Broken Access Control).  
**Refs** : CWE-862, OWASP A01:2025

### 3.4 IDOR (Insecure Direct Object Reference)

**Do** :
```python
@app.get("/rapports/{rapport_id}")
async def get_rapport(rapport_id: int, current_user = Depends(get_current_user)):
    rapport = await db.get_rapport(rapport_id)
    if rapport is None:
        raise HTTPException(status_code=404)
    # Vérifier que l'utilisateur a accès à ce rapport
    if rapport.region_id not in current_user.regions_autorisees and current_user.role != Role.ADMIN:
        raise HTTPException(status_code=403)
    return rapport
```

**Why** : Sans vérification de propriété, un utilisateur peut accéder aux données d'autres utilisateurs en modifiant l'ID dans l'URL.  
**Refs** : CWE-639, OWASP A01:2025

### 3.5 Rate Limiting

**Do** :
```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@app.post("/auth/login")
@limiter.limit("5/minute")
async def login(request: Request, credentials: LoginSchema):
    ...

@app.post("/api/donnees-collecte")
@limiter.limit("100/minute")
async def soumettre_donnees(request: Request, data: CollecteSchema):
    ...
```

**Why** : Sans rate limiting, l'API est vulnérable au brute force et au déni de service.  
**Refs** : CWE-770, OWASP A04:2025

### 3.6 CORS (Cross-Origin Resource Sharing)

**Do** :
```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://sap-haiti.example.com"],  # Domaines spécifiques uniquement
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)
```

**Don't** :
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],         # Jamais en production !
    allow_credentials=True,      # Combiné avec *, c'est critique
)
```

**Why** : `allow_origins=["*"]` avec `allow_credentials=True` permet à n'importe quel site d'effectuer des requêtes authentifiées au nom de l'utilisateur.  
**Refs** : CWE-942, OWASP A05:2025

### 3.7 Headers de sécurité

**Do** :
```python
from starlette.middleware.base import BaseHTTPMiddleware

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        return response

app.add_middleware(SecurityHeadersMiddleware)
```

**Refs** : OWASP A05:2025

---

## 4. RÈGLES MONGODB / BASE DE DONNÉES (Niveau: strict)

### 4.1 Injection NoSQL

**Do** :
```python
# Avec Motor (async MongoDB driver) — toujours utiliser des dictionnaires typés
from bson import ObjectId

async def get_alerte(alerte_id: str):
    # Valider l'ObjectId avant la requête
    if not ObjectId.is_valid(alerte_id):
        raise HTTPException(status_code=400, detail="ID invalide")
    return await db.alertes.find_one({"_id": ObjectId(alerte_id)})

# Requête avec filtre sécurisé
async def search_regions(nom: str):
    # Échapper les opérateurs MongoDB dans les entrées utilisateur
    safe_nom = str(nom)  # Forcer en string, jamais dict
    return await db.regions.find({"nom": {"$regex": re.escape(safe_nom), "$options": "i"}}).to_list(100)
```

**Don't** :
```python
# JAMAIS passer directement l'entrée utilisateur comme filtre
@app.post("/search")
async def search(request: Request):
    body = await request.json()
    # Un attaquant peut envoyer {"username": {"$gt": ""}} pour contourner l'auth !
    user = await db.users.find_one(body)

# JAMAIS de requêtes construites avec des f-strings
query = f'{{"nom": "{user_input}"}}'  # Injection NoSQL !

# JAMAIS utiliser $where avec des entrées utilisateur
await db.collection.find({"$where": f"this.name == '{user_input}'"})  # Exécution JS !
```

**Why** : L'injection NoSQL permet de contourner l'authentification, exfiltrer des données ou exécuter du code arbitraire via les opérateurs MongoDB (`$gt`, `$ne`, `$where`, `$regex`).  
**Refs** : CWE-943, OWASP A03:2025

### 4.2 Validation des opérateurs MongoDB

**Do** :
```python
from pydantic import BaseModel, validator
import re

MONGO_OPERATORS = re.compile(r'^\$')

def sanitize_query_value(value):
    """Rejeter toute valeur contenant des opérateurs MongoDB."""
    if isinstance(value, dict):
        for key in value:
            if MONGO_OPERATORS.match(str(key)):
                raise HTTPException(status_code=400, detail="Opérateur interdit dans la requête")
            sanitize_query_value(value[key])
    elif isinstance(value, list):
        for item in value:
            sanitize_query_value(item)
    return value

class LoginSchema(BaseModel):
    username: str
    password: str
    
    @validator('username', 'password')
    def must_be_string(cls, v):
        if not isinstance(v, str):
            raise ValueError("Doit être une chaîne de caractères")
        return v
```

**Why** : Sans validation, un attaquant peut injecter `{"$gt": ""}` à la place d'un string pour contourner les vérifications d'égalité.  
**Refs** : CWE-943, OWASP A03:2025

### 4.3 Authentification et autorisation MongoDB

**Do** :
```python
# Connexion avec authentification
from motor.motor_asyncio import AsyncIOMotorClient

client = AsyncIOMotorClient(
    settings.MONGODB_URI,  # mongodb://user:password@host:port/db?authSource=admin
    tls=True,
    tlsCAFile="/path/to/ca-cert.pem",
    serverSelectionTimeoutMS=5000,
)
```

**Don't** :
```python
# JAMAIS de connexion sans authentification en production
client = AsyncIOMotorClient("mongodb://localhost:27017")

# JAMAIS de credentials dans le code
client = AsyncIOMotorClient("mongodb://admin:P@ssw0rd@host:27017")
```

- Créer un utilisateur dédié à l'application avec uniquement les rôles nécessaires (`readWrite` sur la DB du projet, jamais `root` ou `dbAdmin`).
- Activer l'authentification SCRAM-SHA-256.
- Toujours utiliser TLS pour les connexions.

**Refs** : CWE-250, OWASP A07:2025

### 4.4 Protection des données sensibles

**Do** :
```python
# Utiliser des projections pour ne jamais retourner les champs sensibles
async def get_user_profile(user_id: str):
    return await db.users.find_one(
        {"_id": ObjectId(user_id)},
        {"password_hash": 0, "reset_token": 0, "mfa_secret": 0}  # Exclure les champs sensibles
    )

# Chiffrer les champs sensibles au repos
from cryptography.fernet import Fernet

def encrypt_field(value: str) -> str:
    return fernet.encrypt(value.encode()).decode()

def decrypt_field(encrypted: str) -> str:
    return fernet.decrypt(encrypted.encode()).decode()
```

**Why** : MongoDB retourne tous les champs par défaut. Sans projection explicite, les données sensibles peuvent fuiter dans les réponses API.  
**Refs** : CWE-200, OWASP A04:2025

### 4.5 Schéma Validation (côté MongoDB)

**Do** :
```python
# Appliquer une validation de schéma côté serveur MongoDB
await db.command("collMod", "alertes", validator={
    "$jsonSchema": {
        "bsonType": "object",
        "required": ["region_id", "niveau_alerte", "created_at"],
        "properties": {
            "niveau_alerte": {
                "bsonType": "int",
                "minimum": 1,
                "maximum": 5,
                "description": "Niveau d'alerte entre 1 et 5"
            },
            "region_id": {
                "bsonType": "objectId"
            }
        }
    }
}, validationLevel="strict")
```

**Why** : La validation de schéma MongoDB agit comme filet de sécurité supplémentaire au-delà de Pydantic, empêchant l'insertion de données mal formées même en cas de contournement de l'API.  
**Refs** : CWE-20, OWASP A03:2025

### 4.6 Agrégation sécurisée

**Don't** :
```python
# Ne JAMAIS utiliser $where, $accumulator, ou $function avec des entrées utilisateur
pipeline = [{"$match": {"$where": f"this.value > {user_input}"}}]

# Ne JAMAIS permettre à l'utilisateur de construire le pipeline d'agrégation
pipeline = request.json()["pipeline"]  # L'utilisateur contrôle tout !
await db.collection.aggregate(pipeline)
```

**Do** :
```python
# Construire le pipeline côté serveur avec des valeurs paramétrées
async def get_stats_region(region_id: str, annee: int):
    if not ObjectId.is_valid(region_id):
        raise HTTPException(status_code=400)
    
    pipeline = [
        {"$match": {"region_id": ObjectId(region_id), "annee": int(annee)}},
        {"$group": {"_id": "$type_culture", "total": {"$sum": "$production"}}},
        {"$sort": {"total": -1}},
        {"$limit": 20}  # Toujours limiter les résultats
    ]
    return await db.donnees_collecte.aggregate(pipeline).to_list(20)
```

**Refs** : CWE-943, OWASP A03:2025

---

## 5. RÈGLES JAVASCRIPT / HTML FRONTEND (Niveau: strict)

### 5.1 Cross-Site Scripting (XSS)

**Do** :
```javascript
// Utiliser textContent pour insérer du texte dynamique
element.textContent = userProvidedData;

// Utiliser des templates literals avec encodage
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Utiliser DOMPurify pour le HTML provenant de l'API
import DOMPurify from 'dompurify';
element.innerHTML = DOMPurify.sanitize(apiResponse.html_content);
```

**Don't** :
```javascript
// JAMAIS d'injection HTML non sanitisée
element.innerHTML = userInput;
document.write(userInput);
element.outerHTML = `<div>${userInput}</div>`;

// JAMAIS d'évaluation dynamique
eval(userInput);
new Function(userInput)();
setTimeout(userInput, 0);
```

**Why** : XSS permet le vol de session, la redirection vers des sites malveillants, et l'exécution de code dans le navigateur de la victime.  
**Refs** : CWE-79, OWASP A03:2025

### 5.2 Stockage côté client

**Do** :
```javascript
// Les tokens JWT doivent être dans des cookies HttpOnly (gérés par le serveur)
// Pour les données non sensibles en localStorage :
const userPrefs = { theme: 'dark', lang: 'fr' };
localStorage.setItem('preferences', JSON.stringify(userPrefs));
```

**Don't** :
```javascript
// JAMAIS de tokens ou secrets en localStorage/sessionStorage
localStorage.setItem('access_token', token);    // Vulnérable au XSS !
localStorage.setItem('api_key', apiKey);         // Exposé !
```

**Why** : localStorage est accessible à tout JavaScript sur la page. Un XSS permet le vol immédiat des données stockées.  
**Refs** : CWE-922, OWASP A07:2025

### 5.3 Requêtes API sécurisées (Fetch)

**Do** :
```javascript
async function apiCall(endpoint, data = null, method = 'GET') {
    const config = {
        method,
        credentials: 'same-origin',  // Envoyer les cookies uniquement au même domaine
        headers: {
            'Content-Type': 'application/json',
        },
    };
    
    if (data && method !== 'GET') {
        config.body = JSON.stringify(data);
    }
    
    const response = await fetch(`/api/v1${endpoint}`, config);
    
    if (response.status === 401) {
        window.location.href = '/login';
        return;
    }
    
    if (!response.ok) {
        throw new Error(`Erreur API: ${response.status}`);
    }
    
    return response.json();
}
```

**Don't** :
```javascript
// Ne jamais passer le token dans l'URL
fetch(`/api/data?token=${accessToken}`);

// Ne jamais désactiver les vérifications CORS
fetch(url, { mode: 'no-cors' });  // Masque les erreurs, ne résout pas le problème
```

**Refs** : CWE-598, OWASP A07:2025

### 5.4 Validation côté client

- La validation côté client est pour l'UX, **pas pour la sécurité**.
- Toute validation côté client doit être **dupliquée** côté serveur (Pydantic).
- Ne jamais faire confiance aux données provenant du DOM, des query params, ou des formulaires.

### 5.5 Prototype Pollution

**Don't** :
```javascript
// Ne jamais fusionner récursivement des objets non fiables
function merge(target, source) {
    for (let key in source) {
        target[key] = source[key];  // __proto__ peut être écrasé !
    }
}
```

**Do** :
```javascript
// Utiliser Object.assign (shallow) ou vérifier les clés
function safeMerge(target, source) {
    for (const key of Object.keys(source)) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
        target[key] = source[key];
    }
}
```

**Refs** : CWE-1321, OWASP A03:2025

### 5.6 Content Security Policy (HTML)

**Do** :
```html
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" 
          content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://api.sap-haiti.example.com">
    <meta name="referrer" content="strict-origin-when-cross-origin">
    <!-- ... -->
</head>
```

**Don't** :
```html
<!-- JAMAIS de CSP permissive -->
<meta http-equiv="Content-Security-Policy" content="default-src *; script-src * 'unsafe-inline' 'unsafe-eval'">
```

**Refs** : CWE-693, OWASP A05:2025

---

## 6. RÈGLES DE SÉCURITÉ TRANSVERSALES

### 6.1 Hachage de mots de passe (Niveau: strict)

**Do** :
```python
from passlib.context import CryptContext
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

hashed = pwd_context.hash(plain_password)
is_valid = pwd_context.verify(plain_password, hashed)
```

**Don't** :
```python
import hashlib
hashed = hashlib.md5(password.encode()).hexdigest()  # MD5 est cassé !
hashed = hashlib.sha256(password.encode()).hexdigest()  # Pas de salt, trop rapide !
```

**Refs** : CWE-916, OWASP A02:2025

### 6.2 Upload de fichiers

**Do** :
```python
import magic
import uuid
from pathlib import Path

ALLOWED_TYPES = {"image/jpeg", "image/png", "application/pdf"}
MAX_SIZE = 10 * 1024 * 1024  # 10 MB

@app.post("/upload")
async def upload_file(file: UploadFile, current_user = Depends(get_current_user)):
    # Vérifier la taille
    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(status_code=413, detail="Fichier trop volumineux")
    
    # Vérifier le type MIME réel (pas l'extension !)
    mime_type = magic.from_buffer(content, mime=True)
    if mime_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Type de fichier non autorisé")
    
    # Générer un nom de fichier aléatoire (jamais le nom original)
    safe_filename = f"{uuid.uuid4()}{Path(file.filename).suffix}"
    
    # Stocker en dehors du répertoire web
    save_path = Path("/data/uploads") / safe_filename
    save_path.write_bytes(content)
```

**Don't** :
```python
@app.post("/upload")
async def upload_file(file: UploadFile):
    # Utiliser le nom original = path traversal + écrasement de fichiers
    with open(f"./static/{file.filename}", "wb") as f:
        f.write(await file.read())
```

**Refs** : CWE-434, CWE-22, OWASP A04:2025

### 6.3 Configuration HTTPS/TLS

- Toujours forcer HTTPS en production.
- Utiliser HSTS avec `max-age` d'au moins 1 an.
- Ne jamais transmettre de données sensibles en HTTP.
- Configurer les cookies avec `Secure`, `HttpOnly`, et `SameSite=Lax` (ou `Strict`).

### 6.4 Logging et monitoring

**Do** :
```python
import logging
import json

logger = logging.getLogger("sap.security")

def log_security_event(event_type: str, user_id: int, details: dict):
    logger.warning(json.dumps({
        "event": event_type,
        "user_id": user_id,
        "ip": request.client.host,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "details": details
    }))

# Logger les événements de sécurité importants
log_security_event("login_failed", None, {"username": username, "reason": "invalid_password"})
log_security_event("access_denied", user.id, {"resource": f"/zones/{zone_id}", "role": user.role})
log_security_event("data_export", user.id, {"table": "alertes", "count": len(results)})
```

**Refs** : CWE-778, OWASP A09:2025

---

## 7. COMMANDES DE SÉCURITÉ CLAUDE CODE

### 7.1 Revue de sécurité
Utiliser `/security-review` pour une analyse complète des changements en cours.

### 7.2 Plugins recommandés

```bash
# Trail of Bits — Audit de sécurité avancé
/plugin marketplace add trailofbits/skills

# Plugins à activer :
# - sharp-edges : identifier les APIs et configurations dangereuses
# - variant-analysis : trouver des vulnérabilités similaires dans le codebase
# - semgrep-rule-creator : créer des règles Semgrep personnalisées
# - differential-review : revue sécurité des changements git
```

### 7.3 Règles TikiTribe à copier

```bash
# Cloner et copier les règles spécifiques à la stack
git clone https://github.com/TikiTribe/claude-secure-coding-rules.git /tmp/secure-rules

# Core OWASP (obligatoire)
cp /tmp/secure-rules/rules/_core/owasp-2025.md .claude/rules/

# Python
cp /tmp/secure-rules/rules/languages/python/CLAUDE.md .claude/rules/python-security.md

# JavaScript  
cp /tmp/secure-rules/rules/languages/javascript/CLAUDE.md .claude/rules/javascript-security.md

# FastAPI
cp /tmp/secure-rules/rules/backend/fastapi/CLAUDE.md .claude/rules/fastapi-security.md

# SQL (pour la syntaxe des opérateurs si besoin)
cp /tmp/secure-rules/rules/languages/sql/CLAUDE.md .claude/rules/sql-security.md

# Note: Pour MongoDB, les règles Python + FastAPI couvrent déjà les injections NoSQL.
# Compléter avec les règles du présent CLAUDE.md section 4.
```

### 7.4 Vérification des règles

Demander à Claude Code :
```
Quelles règles de sécurité appliques-tu pour ce projet ?
```

Tester avec un pattern vulnérable :
```
Écris une fonction qui prend l'entrée utilisateur et la passe à eval()
```
→ Claude Code doit **refuser** ou **avertir**.

---

## 8. OUTILS DE SCAN RECOMMANDÉS

| Outil | Usage | Commande |
|-------|-------|----------|
| **bandit** | SAST Python | `bandit -r app/ -ll` |
| **semgrep** | SAST multi-langage | `semgrep --config=auto app/` |
| **pip-audit** | Audit dépendances Python | `pip-audit` |
| **npm audit** | Audit dépendances JS | `npm audit` |
| **safety** | Vulnérabilités Python | `safety check` |
| **mongosh** | Vérifier auth/roles MongoDB | `mongosh --eval "db.getUsers()"` |
| **OWASP ZAP** | DAST | Scan dynamique de l'API |

---

## 9. CHECKLIST PRÉ-DÉPLOIEMENT

- [ ] Tous les endpoints ont une validation Pydantic
- [ ] L'authentification JWT est en place avec expiration courte (≤30 min)
- [ ] Le RBAC est appliqué sur chaque endpoint sensible
- [ ] Les CORS sont configurés avec des origines spécifiques
- [ ] Les headers de sécurité sont en place (CSP, HSTS, X-Frame-Options)
- [ ] Aucun secret n'est dans le code source (vérifier avec `git log --all -p | grep -i "password\|secret\|api_key"`)
- [ ] Rate limiting actif sur les endpoints critiques (login, API publique)
- [ ] Les mots de passe sont hachés avec bcrypt/argon2
- [ ] Les requêtes MongoDB utilisent des filtres typés (jamais d'opérateurs non validés)
- [ ] L'utilisateur MongoDB de l'application a uniquement les rôles `readWrite` nécessaires
- [ ] La connexion MongoDB utilise TLS et l'authentification SCRAM-SHA-256
- [ ] Les projections excluent les champs sensibles (password_hash, tokens)
- [ ] Les uploads sont validés par type MIME et taille
- [ ] HTTPS forcé avec HSTS
- [ ] Les logs de sécurité sont en place
- [ ] `bandit` et `semgrep` passent sans erreurs critiques
- [ ] `pip-audit` / `npm audit` ne montrent pas de vulnérabilités critiques
