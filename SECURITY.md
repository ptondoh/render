# 🔒 Security Policy - Système d'Alerte Précoce (SAP)

> **Dernière mise à jour :** 2026-02-23
> **Version :** 0.1
> **Score de sécurité :** 7.7/10

---

## 📋 Table des Matières

- [Vue d'ensemble](#vue-densemble)
- [Architecture de sécurité](#architecture-de-sécurité)
- [Authentification et Autorisation](#authentification-et-autorisation)
- [Protection des données](#protection-des-données)
- [Vulnérabilités connues](#vulnérabilités-connues)
- [Reporting de vulnérabilités](#reporting-de-vulnérabilités)
- [Bonnes pratiques](#bonnes-pratiques)
- [Conformité](#conformité)

---

## 🎯 Vue d'ensemble

Le Système d'Alerte Précoce (SAP) implémente des mesures de sécurité robustes pour protéger les données sensibles de sécurité alimentaire en Haïti. Ce document décrit les politiques et pratiques de sécurité du projet.

### Score de Sécurité par Catégorie

| Catégorie | Score | Status |
|-----------|-------|--------|
| **Authentification** | 9/10 | ✅ Excellent |
| **Autorisation (RBAC)** | 9/10 | ✅ Excellent |
| **Validation des données** | 8/10 | ✅ Bon |
| **Protection DDoS** | 5/10 | ⚠️ À améliorer |
| **Headers de sécurité** | 6/10 | ⚠️ À améliorer |
| **Gestion des secrets** | 9/10 | ✅ Excellent |
| **Audit et logging** | 8/10 | ✅ Bon |

**Score Global : 7.7/10 - BON**

---

## 🏗️ Architecture de Sécurité

### Stack Technique

- **Backend :** FastAPI + Python 3.13
- **Base de données :** MongoDB 8.23
- **Authentification :** JWT + MFA (TOTP)
- **Chiffrement :** bcrypt (mots de passe), AES (secrets MFA)
- **Transport :** HTTPS/TLS 1.2+

### Principes de Sécurité

1. **Defense in Depth** : Plusieurs couches de sécurité
2. **Least Privilege** : Accès minimal nécessaire (RBAC)
3. **Fail Secure** : Échec sécurisé par défaut
4. **Zero Trust** : Vérification systématique

---

## 🔐 Authentification et Autorisation

### Authentification JWT

#### Implémentation
- **Algorithme :** HS256 (HMAC-SHA256)
- **Durée de vie :**
  - Access Token : 24 heures
  - Refresh Token : 7 jours
- **Stockage :** localStorage (frontend)
- **Validation :** Vérification signature + expiration + type

#### Fichiers Concernés
- `backend/services/auth.py` - Génération et validation tokens
- `backend/middleware/security.py` - Middleware JWT
- `frontend/modules/auth.js` - Gestion tokens côté client

### Multi-Factor Authentication (MFA)

#### TOTP (Time-based One-Time Password)
- **Algorithme :** RFC 6238
- **Période :** 30 secondes
- **Chiffrement secret :** AES-256 avec clé dérivée
- **Backup codes :** 8 codes hachés avec bcrypt

#### Configuration
```python
# Variable d'environnement requise
MFA_ENCRYPTION_KEY=CHANGEZ_CETTE_CLE_POUR_CHIFFRER_LES_SECRETS_TOTP
```

### Contrôle d'Accès (RBAC)

#### Rôles Disponibles

| Rôle | Permissions | Accès |
|------|-------------|-------|
| **agent** | Saisie collectes, consultation propres données | Limité |
| **décideur** | Consultation toutes données, validation | Lecture |
| **bailleur** | Administration système, CRUD complet | Admin |

#### Implémentation
- **Middleware :** `backend/middleware/rbac.py`
- **Vérification :** Sur chaque endpoint sensible
- **Isolation :** Agents ne voient que leurs données

---

## 🛡️ Protection des Données

### Hachage des Mots de Passe

#### Algorithme : bcrypt
```python
# backend/services/auth.py
def hash_password(password: str) -> str:
    password_bytes = password.encode('utf-8')[:72]  # Limite bcrypt
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')
```

**Caractéristiques :**
- Salt unique par mot de passe
- Coût adaptatif (ralentit les attaques par force brute)
- Limite de 72 bytes respectée

### Chiffrement des Secrets MFA

#### Algorithme : AES-256
- **Mode :** Dérivation de clé depuis `MFA_ENCRYPTION_KEY`
- **Usage :** Chiffrement des secrets TOTP avant stockage
- **Fichier :** `backend/services/auth.py`

### Validation des Entrées

#### Pydantic Models
- **Email :** `EmailStr` (validation RFC 5322)
- **ObjectId :** Validation MongoDB
- **Mots de passe :** Minimum 8 caractères

**Fichier :** `backend/models.py`

### CORS (Cross-Origin Resource Sharing)

#### Configuration
```python
# backend/main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,  # Pas de wildcard
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**Origins autorisées :** Configurées via `.env`

---

## ⚠️ Vulnérabilités Connues

### 🔴 Critique

#### 1. Exposition de Détails d'Erreur en Développement
- **Localisation :** `backend/main.py:162`
- **Risque :** Stack traces exposées en mode debug
- **Mitigation :** Vérifier `APP_DEBUG=False` en production
- **Status :** ✅ Contrôle en place

### 🟡 Moyenne

#### 2. Absence de Rate Limiting
- **Localisation :** `backend/routers/auth.py`
- **Endpoints affectés :** `/api/auth/login`, `/api/auth/verify-mfa`
- **Risque :** Attaques par force brute
- **Mitigation recommandée :** Implémenter `slowapi`
- **Status :** ⚠️ À corriger avant production

#### 3. Pas de Protection CSRF
- **Localisation :** Frontend (`frontend/modules/api.js`)
- **Risque :** Attaques CSRF
- **Mitigation recommandée :** Tokens CSRF ou cookies `SameSite=Strict`
- **Status :** ⚠️ À corriger avant production

#### 4. Tokens JWT dans localStorage
- **Localisation :** `frontend/modules/auth.js:58-59`
- **Risque :** Vol via XSS
- **Mitigation recommandée :** Cookies `HttpOnly` ou CSP stricte
- **Status :** 📋 À évaluer

### 🟢 Faible

#### 5. Headers de Sécurité HTTP Manquants
- **Headers manquants :**
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Strict-Transport-Security`
  - `Content-Security-Policy`
- **Mitigation :** Middleware FastAPI
- **Status :** 📋 Recommandé

#### 6. Validation Complexité Mot de Passe Faible
- **Localisation :** `backend/models.py:64`
- **Actuel :** Minimum 8 caractères
- **Recommandé :** Majuscule + minuscule + chiffre + caractère spécial
- **Status :** 📋 Nice to have

#### 7. Pas de Timeout MongoDB
- **Risque :** Requêtes infinies si DB lente
- **Mitigation :** `max_time_ms(5000)`
- **Status :** 📋 Recommandé

#### 8. Validation Type Fichier CSV Insuffisante
- **Localisation :** `backend/routers/import_collectes.py`
- **Risque :** Upload fichiers malveillants
- **Mitigation :** Vérification magic number + limite taille
- **Status :** 📋 Recommandé

---

## 📢 Reporting de Vulnérabilités

### Comment Reporter une Vulnérabilité

Si vous découvrez une vulnérabilité de sécurité, veuillez **NE PAS** créer d'issue publique.

#### Processus de Reporting Sécurisé

1. **Email :** Envoyer à `security@sap.ht` (à créer)
2. **Objet :** `[SECURITY] Description courte`
3. **Contenu minimum :**
   - Description de la vulnérabilité
   - Étapes pour reproduire
   - Impact potentiel
   - Version affectée

#### Délais de Réponse

- **Accusé de réception :** 48 heures
- **Évaluation initiale :** 5 jours ouvrables
- **Correctif :** Selon gravité (1-30 jours)

#### Responsible Disclosure

- Les vulnérabilités ne seront pas rendues publiques avant correctif
- Crédit donné au reporter (si souhaité)
- Pas de programme bug bounty pour le moment

---

## ✅ Bonnes Pratiques

### Pour les Développeurs

#### 1. Gestion des Secrets
```bash
# ❌ JAMAIS faire ça
SECRET_KEY = "ma-cle-secrete-123"

# ✅ Toujours utiliser .env
SECRET_KEY = os.getenv("JWT_SECRET_KEY")
```

#### 2. Validation des Entrées
```python
# ✅ Toujours valider avec Pydantic
class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
```

#### 3. Logs Sécurisés
```python
# ❌ Ne JAMAIS logger de secrets
logger.info(f"User {email} logged in with password {password}")

# ✅ Logger uniquement les infos nécessaires
logger.info(f"User {email} logged in successfully")
```

#### 4. Requêtes MongoDB
```python
# ✅ Toujours valider les ObjectId
if not ObjectId.is_valid(user_id):
    raise HTTPException(status_code=400, detail="Invalid ID")
```

### Pour les Administrateurs

#### Configuration Production

**Variables d'environnement critiques :**
```bash
# Obligatoire
APP_ENV=production
APP_DEBUG=False
JWT_SECRET_KEY=<clé-aléatoire-64-chars>
MFA_ENCRYPTION_KEY=<clé-aléatoire-32-chars>

# Recommandé
CORS_ORIGINS=https://sap.ht,https://api.sap.ht
```

**Génération de clés sécurisées :**
```bash
# JWT Secret Key (64 caractères)
openssl rand -hex 32

# MFA Encryption Key (32 caractères)
openssl rand -base64 32
```

#### Monitoring

**Logs à surveiller :**
- Tentatives de login échouées répétées
- Accès refusés (403/401) multiples
- Erreurs 500 répétées
- Modifications de comptes administrateurs

**Outils recommandés :**
- Sentry (erreurs)
- Datadog / Grafana (métriques)
- Fail2ban (protection brute force)

---

## 📜 Conformité

### Standards Respectés

- ✅ **OWASP Top 10 2021** : Couverture partielle
- ✅ **CWE/SANS Top 25** : Principales failles adressées
- ✅ **GDPR** : Principe de minimisation des données
- ✅ **ISO 27001** : Bonnes pratiques appliquées

### Audits de Sécurité

| Date | Type | Score | Actions |
|------|------|-------|---------|
| 2026-02-23 | Interne | 7.7/10 | 8 recommandations |
| - | Externe | - | À planifier |
| - | Pentest | - | À planifier |

---

## 🔄 Maintenance de Sécurité

### Mises à Jour

**Dépendances Python :**
```bash
# Vérifier vulnérabilités
pip-audit

# Ou avec safety
safety check
```

**Dépendances Node.js :**
```bash
# Vérifier vulnérabilités
npm audit

# Corriger automatiquement
npm audit fix
```

### Calendrier

- **Hebdomadaire :** Revue logs de sécurité
- **Mensuel :** Mise à jour dépendances mineures
- **Trimestriel :** Mise à jour dépendances majeures
- **Semestriel :** Audit de sécurité complet

---

## 📚 Ressources

### Documentation Interne
- `PROGRESS.md` - État du projet avec section sécurité
- `TODO-SECURITY.md` - Tâches de sécurité à faire
- `.env.example` - Configuration sécurisée

### Références Externes
- [OWASP Top 10](https://owasp.org/Top10/)
- [FastAPI Security](https://fastapi.tiangolo.com/tutorial/security/)
- [JWT Best Practices](https://datatracker.ietf.org/doc/html/rfc8725)
- [MongoDB Security](https://docs.mongodb.com/manual/security/)

---

## 📞 Contact

Pour toute question de sécurité :
- **Email :** security@sap.ht (à créer)
- **Issue privée :** GitHub Security Advisory (si configuré)
- **Urgent :** Contact direct équipe de développement

---

**Dernière révision :** 2026-02-23
**Prochaine révision prévue :** 2026-08-23 (6 mois)
