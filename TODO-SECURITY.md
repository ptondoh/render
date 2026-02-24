# 🔧 TODO - Sécurité SAP

> **Date de création :** 2026-02-23
> **Dernière mise à jour :** 2026-02-23
> **Priorité globale :** Avant déploiement production

---

## 📊 Vue d'ensemble

**Tâches totales :** 12
**Critiques (P1) :** 3
**Importantes (P2) :** 4
**Recommandées (P3) :** 5

**Status global :**
- [ ] 🔴 0/3 Tâches critiques complétées
- [ ] 🟡 0/4 Tâches importantes complétées
- [ ] 🟢 0/5 Tâches recommandées complétées

---

## 🔴 Priorité 1 : CRITIQUE (Avant Production)

Ces tâches **DOIVENT** être complétées avant le déploiement en production.

---

### ✅ TASK-SEC-001 : Vérifier Configuration Production

**Priorité :** 🔴 CRITIQUE
**Effort estimé :** 30 minutes
**Assigné à :** DevOps / Admin
**Date limite :** Avant déploiement

#### Description
Vérifier que toutes les variables d'environnement de production sont correctement configurées, notamment le mode DEBUG désactivé.

#### Actions
- [ ] Créer fichier `.env.production` avec les bonnes valeurs
- [ ] Vérifier `APP_ENV=production`
- [ ] Vérifier `APP_DEBUG=False`
- [ ] Générer une nouvelle `JWT_SECRET_KEY` pour production
- [ ] Générer une nouvelle `MFA_ENCRYPTION_KEY` pour production
- [ ] Configurer `CORS_ORIGINS` avec le domaine de production uniquement
- [ ] Tester le déploiement en staging d'abord

#### Fichiers concernés
- `.env.production` (à créer)
- `backend/config.py`
- `backend/main.py:162` (gestion erreurs)

#### Commandes
```bash
# Générer JWT Secret Key (64 caractères)
openssl rand -hex 32

# Générer MFA Encryption Key (32 caractères)
openssl rand -base64 32

# Vérifier configuration
python backend/config.py
```

#### Validation
- [ ] `APP_DEBUG=False` confirmé
- [ ] Erreurs 500 ne révèlent pas de stack traces
- [ ] CORS bloque les domaines non autorisés

---

### ✅ TASK-SEC-002 : Implémenter Rate Limiting

**Priorité :** 🔴 CRITIQUE
**Effort estimé :** 3-4 heures
**Assigné à :** Backend Developer
**Date limite :** Avant déploiement

#### Description
Ajouter un système de rate limiting pour protéger contre les attaques par force brute sur les endpoints d'authentification.

#### Actions
- [ ] Installer `slowapi` : `pip install slowapi`
- [ ] Configurer Limiter dans `backend/main.py`
- [ ] Ajouter limites sur `/api/auth/login` (5 tentatives/minute)
- [ ] Ajouter limites sur `/api/auth/verify-mfa` (3 tentatives/minute)
- [ ] Ajouter limites sur `/api/auth/register` (2 tentatives/minute)
- [ ] Ajouter headers `X-RateLimit-*` dans les réponses
- [ ] Tester avec script de simulation
- [ ] Documenter dans API docs

#### Code proposé
```python
# backend/main.py
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# backend/routers/auth.py
from backend.main import limiter

@router.post("/login")
@limiter.limit("5/minute")
async def login(request: Request, credentials: LoginRequest):
    ...

@router.post("/verify-mfa")
@limiter.limit("3/minute")
async def verify_mfa(request: Request, verify_data: MFAVerifyRequest):
    ...
```

#### Fichiers concernés
- `backend/main.py`
- `backend/routers/auth.py`
- `requirements.txt`

#### Tests
```python
# test_rate_limiting.py
import requests
import time

BASE_URL = "http://localhost:8000"

# Tester rate limiting login
for i in range(6):
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "test@example.com",
        "password": "wrongpassword"
    })
    print(f"Attempt {i+1}: {response.status_code}")
    if response.status_code == 429:
        print("✅ Rate limiting fonctionne!")
        break
    time.sleep(1)
```

#### Validation
- [ ] 6ème tentative de login retourne 429 (Too Many Requests)
- [ ] Header `X-RateLimit-Limit` présent
- [ ] Header `X-RateLimit-Remaining` décrémente
- [ ] Après 1 minute, limite réinitialisée

---

### ✅ TASK-SEC-003 : Ajouter Protection CSRF

**Priorité :** 🔴 CRITIQUE
**Effort estimé :** 4-5 heures
**Assigné à :** Full Stack Developer
**Date limite :** Avant déploiement

#### Description
Implémenter une protection CSRF pour sécuriser les endpoints de modification (POST/PUT/DELETE).

#### Option 1 : Cookies HttpOnly (Recommandé)
- [ ] Modifier backend pour envoyer JWT via cookies `HttpOnly`
- [ ] Ajouter cookie `SameSite=Strict` ou `SameSite=Lax`
- [ ] Modifier frontend pour ne plus utiliser localStorage
- [ ] Tester authentification avec cookies

#### Option 2 : Tokens CSRF
- [ ] Générer token CSRF côté backend
- [ ] Envoyer token dans cookie `csrftoken`
- [ ] Exiger header `X-CSRF-Token` sur requêtes modifiantes
- [ ] Valider token dans middleware

#### Code proposé (Option 1 - Cookies)
```python
# backend/routers/auth.py
from fastapi import Response

@router.post("/login")
async def login(credentials: LoginRequest, response: Response):
    # ... authentification ...

    # Définir cookies au lieu de retourner tokens en JSON
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=True,  # HTTPS uniquement
        samesite="strict",
        max_age=1440 * 60  # 24 heures
    )

    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=7 * 24 * 60 * 60  # 7 jours
    )

    return {"user": user, "success": True}
```

```javascript
// frontend/modules/api.js
// Les cookies sont automatiquement inclus avec credentials: 'include'
async request(endpoint, options = {}) {
    const config = {
        ...options,
        credentials: 'include',  // Envoie cookies
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        }
    };
    // Plus besoin d'ajouter Authorization header
    const response = await fetch(API_URL + endpoint, config);
    return response.json();
}
```

#### Fichiers concernés
- `backend/routers/auth.py`
- `backend/middleware/security.py`
- `frontend/modules/api.js`
- `frontend/modules/auth.js`

#### Validation
- [ ] Tokens ne sont plus dans localStorage
- [ ] Cookies `HttpOnly` présents dans navigateur
- [ ] Impossible d'accéder aux cookies via JavaScript
- [ ] Requêtes cross-origin bloquées

---

## 🟡 Priorité 2 : IMPORTANT (Recommandé Avant Production)

Ces tâches sont fortement recommandées avant le déploiement.

---

### ✅ TASK-SEC-004 : Ajouter Headers de Sécurité HTTP

**Priorité :** 🟡 IMPORTANT
**Effort estimé :** 2 heures
**Assigné à :** Backend Developer

#### Actions
- [ ] Installer `secure` ou créer middleware custom
- [ ] Ajouter `X-Content-Type-Options: nosniff`
- [ ] Ajouter `X-Frame-Options: DENY`
- [ ] Ajouter `X-XSS-Protection: 1; mode=block`
- [ ] Ajouter `Strict-Transport-Security` (HTTPS uniquement)
- [ ] Ajouter `Content-Security-Policy` de base
- [ ] Tester avec https://securityheaders.com

#### Code proposé
```python
# backend/middleware/security_headers.py
from starlette.middleware.base import BaseHTTPMiddleware

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)

        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # HTTPS uniquement en production
        if settings.is_production:
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

        # CSP basique
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; "
            "font-src 'self' data:;"
        )

        return response

# backend/main.py
from backend.middleware.security_headers import SecurityHeadersMiddleware
app.add_middleware(SecurityHeadersMiddleware)
```

#### Fichiers concernés
- `backend/middleware/security_headers.py` (nouveau)
- `backend/main.py`

#### Validation
- [ ] Tester sur https://securityheaders.com (Score A)
- [ ] Vérifier headers dans DevTools Network

---

### ✅ TASK-SEC-005 : Améliorer Validation Mot de Passe

**Priorité :** 🟡 IMPORTANT
**Effort estimé :** 2 heures
**Assigné à :** Backend Developer

#### Actions
- [ ] Ajouter validation complexité dans `UserCreate`
- [ ] Exiger : 1 majuscule + 1 minuscule + 1 chiffre + 1 caractère spécial
- [ ] Longueur minimale : 12 caractères (au lieu de 8)
- [ ] Vérifier contre liste de mots de passe communs
- [ ] Ajouter messages d'erreur explicites
- [ ] Mettre à jour frontend pour afficher exigences

#### Code proposé
```python
# backend/models.py
import re
from pydantic import field_validator

class UserCreate(UserBase):
    password: str = Field(..., min_length=12, description="Mot de passe (min 12 caractères)")

    @field_validator('password')
    def validate_password_strength(cls, v):
        if not re.search(r'[A-Z]', v):
            raise ValueError('Le mot de passe doit contenir au moins une majuscule')
        if not re.search(r'[a-z]', v):
            raise ValueError('Le mot de passe doit contenir au moins une minuscule')
        if not re.search(r'\d', v):
            raise ValueError('Le mot de passe doit contenir au moins un chiffre')
        if not re.search(r'[!@#$%^&*(),.?":{}|<>]', v):
            raise ValueError('Le mot de passe doit contenir au moins un caractère spécial')

        # Liste de mots de passe interdits
        common_passwords = ['password', '12345678', 'qwerty', 'admin', 'letmein']
        if v.lower() in common_passwords:
            raise ValueError('Ce mot de passe est trop commun')

        return v
```

#### Fichiers concernés
- `backend/models.py`
- `frontend/pages/login.js` (afficher exigences)

#### Validation
- [ ] "12345678" rejeté
- [ ] "Password1!" accepté
- [ ] Messages d'erreur clairs côté frontend

---

### ✅ TASK-SEC-006 : Ajouter Timeouts MongoDB

**Priorité :** 🟡 IMPORTANT
**Effort estimé :** 1-2 heures
**Assigné à :** Backend Developer

#### Actions
- [ ] Ajouter `max_time_ms(5000)` sur requêtes find
- [ ] Ajouter timeout sur requêtes aggregate
- [ ] Gérer exception `ExecutionTimeout`
- [ ] Logger requêtes lentes

#### Code proposé
```python
# backend/routers/collectes.py
from pymongo.errors import ExecutionTimeout

try:
    collectes = await db.collectes_prix.find(query)\
        .sort("date", -1)\
        .limit(limit)\
        .max_time_ms(5000)\
        .to_list(None)
except ExecutionTimeout:
    logger.error("MongoDB query timeout")
    raise HTTPException(
        status_code=status.HTTP_504_GATEWAY_TIMEOUT,
        detail="La requête a pris trop de temps"
    )
```

#### Fichiers concernés
- `backend/routers/collectes.py`
- `backend/routers/alertes.py`
- Tous les routers avec queries MongoDB

#### Validation
- [ ] Requête > 5s retourne 504
- [ ] Message d'erreur approprié

---

### ✅ TASK-SEC-007 : Migrer Tokens vers Cookies HttpOnly

**Priorité :** 🟡 IMPORTANT (si TASK-SEC-003 Option 2 choisie)
**Effort estimé :** 4-5 heures
**Assigné à :** Full Stack Developer

#### Description
Si la protection CSRF via tokens est insuffisante, migrer vers cookies `HttpOnly` pour une sécurité optimale contre XSS.

#### Actions
- [ ] Voir TASK-SEC-003 Option 1
- [ ] Nettoyer localStorage des anciens tokens
- [ ] Ajouter migration pour utilisateurs existants

#### Validation
- [ ] Tokens inaccessibles depuis console JS
- [ ] Authentification fonctionne normalement

---

## 🟢 Priorité 3 : NICE TO HAVE (Améliorations)

Ces tâches améliorent la sécurité mais ne sont pas critiques.

---

### ✅ TASK-SEC-008 : Implémenter Content Security Policy (CSP) Stricte

**Priorité :** 🟢 NICE TO HAVE
**Effort estimé :** 3-4 heures
**Assigné à :** Frontend Developer

#### Actions
- [ ] Retirer tous les `inline` scripts du HTML
- [ ] Externaliser les styles inline
- [ ] Générer des nonces pour scripts dynamiques
- [ ] Configurer CSP stricte

#### Code proposé
```python
response.headers["Content-Security-Policy"] = (
    "default-src 'none'; "
    "script-src 'self'; "
    "style-src 'self'; "
    "img-src 'self' data: https:; "
    "font-src 'self'; "
    "connect-src 'self'; "
    "base-uri 'self'; "
    "form-action 'self';"
)
```

---

### ✅ TASK-SEC-009 : Scanner Fichiers Uploadés

**Priorité :** 🟢 NICE TO HAVE
**Effort estimé :** 4-5 heures
**Assigné à :** Backend Developer

#### Actions
- [ ] Vérifier magic number des fichiers CSV
- [ ] Limiter taille upload à 10MB
- [ ] Intégrer ClamAV ou VirusTotal API (optionnel)
- [ ] Sandbox parsing CSV

#### Code proposé
```python
import magic

def validate_csv_file(file: UploadFile):
    # Vérifier magic number
    content = file.file.read(1024)
    file.file.seek(0)

    mime = magic.from_buffer(content, mime=True)
    if mime not in ['text/csv', 'text/plain']:
        raise HTTPException(400, "Format de fichier invalide")

    # Vérifier taille
    file.file.seek(0, 2)  # Aller à la fin
    size = file.file.tell()
    file.file.seek(0)  # Retour au début

    if size > 10 * 1024 * 1024:  # 10MB
        raise HTTPException(413, "Fichier trop volumineux")
```

---

### ✅ TASK-SEC-010 : Monitoring avec Sentry

**Priorité :** 🟢 NICE TO HAVE
**Effort estimé :** 2-3 heures
**Assigné à :** DevOps

#### Actions
- [ ] Créer compte Sentry.io
- [ ] Installer `sentry-sdk`
- [ ] Configurer DSN dans `.env`
- [ ] Tester capture d'erreurs

---

### ✅ TASK-SEC-011 : Tests de Pénétration Automatisés

**Priorité :** 🟢 NICE TO HAVE
**Effort estimé :** 1 jour
**Assigné à :** Security Engineer / DevOps

#### Actions
- [ ] Installer OWASP ZAP ou Burp Suite
- [ ] Scanner l'API en staging
- [ ] Corriger vulnérabilités trouvées
- [ ] Intégrer dans CI/CD

---

### ✅ TASK-SEC-012 : Documentation Sécurité Utilisateurs

**Priorité :** 🟢 NICE TO HAVE
**Effort estimé :** 2-3 heures
**Assigné à :** Tech Writer / PM

#### Actions
- [ ] Guide de bonnes pratiques pour utilisateurs
- [ ] Politique de mot de passe
- [ ] Procédure en cas de compte compromis
- [ ] FAQ sécurité

---

## 📅 Planning Suggéré

### Sprint 1 - Critique (1 semaine)
- **Jour 1-2 :** TASK-SEC-001 (Config production)
- **Jour 3-4 :** TASK-SEC-002 (Rate limiting)
- **Jour 5-7 :** TASK-SEC-003 (Protection CSRF)

### Sprint 2 - Important (1 semaine)
- **Jour 1-2 :** TASK-SEC-004 (Headers sécurité)
- **Jour 3-4 :** TASK-SEC-005 (Validation MdP)
- **Jour 5 :** TASK-SEC-006 (Timeouts MongoDB)

### Sprint 3 - Nice to Have (optionnel)
- À planifier selon priorités métier

---

## 📊 Suivi

### Template de Tâche Complétée

```markdown
### ✅ TASK-SEC-XXX : [Titre]
**Status :** ✅ COMPLÉTÉ
**Date de complétion :** YYYY-MM-DD
**Complété par :** Nom
**PR/Commit :** #123 / abc1234
**Notes :** Notes de mise en œuvre
```

### Checklist de Validation Finale

Avant de marquer le projet comme "Production Ready" :

- [ ] Les 3 tâches critiques (P1) sont complétées
- [ ] Les 4 tâches importantes (P2) sont complétées ou justifiées si reportées
- [ ] Audit de sécurité externe planifié
- [ ] Plan de réponse aux incidents documenté
- [ ] Monitoring de sécurité en place
- [ ] Formation utilisateurs sur bonnes pratiques complétée

---

**Dernière mise à jour :** 2026-02-23
**Prochaine révision :** Après complétion des tâches P1
