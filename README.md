# Système d'Alerte Précoce (SAP) - Architecture Minimaliste

Système d'alerte précoce pour la sécurité alimentaire en Haïti - Phase 0 MVP

## 🎯 Stack Technologique

### Frontend
- **HTML5** + **JavaScript pur (ES6)** + **TailwindCSS**
- Mode hors-ligne : Service Worker + IndexedDB
- Internationalisation : Français + Créole haïtien

### Backend
- **Python 3.13** + **FastAPI 0.115.5** + **Uvicorn**
- Base de données : **MongoDB 8.23**
- Authentification : **JWT** + **MFA (TOTP)**
- Hachage : **bcrypt**
- Notifications : SendGrid (email)

## 📋 Prérequis

- Python 3.10+ ✅ (installé: 3.13.2)
- Node.js 16+ ✅ (installé: v22.14.0)
- MongoDB 4.4+ ✅ (installé: 8.23)

## 🚀 Installation

### 1. Cloner le dépôt

```bash
git clone https://github.com/tep-parsa/sap-minimaliste.git
cd sap-minimaliste
```

### 2. Configuration de l'environnement

```bash
# Copier le fichier d'exemple
cp .env.example .env

# Le fichier .env contient déjà des clés générées automatiquement:
# - JWT_SECRET_KEY (pour tokens d'authentification)
# - MFA_ENCRYPTION_KEY (pour chiffrement secrets MFA)
```

### 3. Installer les dépendances Python

```bash
# Créer un environnement virtuel
python -m venv venv

# Activer l'environnement virtuel
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Installer les dépendances
pip install -r requirements.txt
```

**Dépendances installées (38 packages):**
- fastapi==0.115.5
- uvicorn[standard]==0.34.0
- motor==3.6.0 (driver MongoDB async)
- pydantic==2.10.4 + pydantic-settings==2.7.1
- email-validator==2.2.0
- python-jose[cryptography]==3.3.0 (JWT)
- passlib[bcrypt]==1.7.4 (hachage mots de passe)
- pyotp==2.9.0 (TOTP pour MFA)
- qrcode==8.0 + Pillow==11.1.0 (génération QR codes)
- APScheduler==3.11.0
- sendgrid==6.11.0

### 4. Installer les dépendances Node.js

```bash
npm install
```

**Dépendances installées (108 packages):**
- @playwright/test (tests E2E)
- tailwindcss + postcss + autoprefixer
- concurrently (scripts parallèles)

### 5. Démarrer MongoDB

```bash
# Assurez-vous que MongoDB est en cours d'exécution
# Windows (si installé comme service):
net start MongoDB

# Ou démarrez manuellement:
mongod --dbpath C:\data\db
```

### 6. Démarrer l'application

#### Backend (FastAPI)

```bash
# Activer l'environnement virtuel
venv\Scripts\activate

# Démarrer le serveur avec hot-reload
uvicorn backend.main:app --reload --port 8000

# Ou avec un port différent
uvicorn backend.main:app --reload --port 8888
```

Le serveur démarre sur `http://127.0.0.1:8000` (ou le port spécifié)

**Endpoints disponibles:**
- 🏠 `http://127.0.0.1:8000/` - Point d'entrée
- ❤️ `http://127.0.0.1:8000/health` - Health check
- ℹ️ `http://127.0.0.1:8000/version` - Informations version
- 📚 `http://127.0.0.1:8000/docs` - Documentation Swagger UI
- 📖 `http://127.0.0.1:8000/redoc` - Documentation ReDoc

#### Frontend (Développement)

```bash
# Terminal séparé - Compiler Tailwind + serveur HTTP
npm run dev

# Ou séparément:
npm run tailwind:watch  # Watch mode pour Tailwind
npm run serve           # Serveur HTTP Python sur port 3000
```

## 📁 Structure du Projet

```
sap-minimaliste/
├── backend/
│   ├── services/
│   │   ├── __init__.py
│   │   └── auth.py            ✅ Service d'authentification (JWT, MFA, TOTP)
│   ├── routers/
│   │   ├── __init__.py
│   │   └── auth.py            ✅ Router d'authentification (8 endpoints)
│   ├── middleware/
│   │   ├── __init__.py
│   │   ├── security.py        ✅ Middleware JWT
│   │   ├── rbac.py            ✅ Contrôle d'accès basé sur les rôles
│   │   └── audit.py           ✅ Logging des actions utilisateurs
│   ├── tests/                 # Tests Playwright (à venir)
│   ├── __init__.py            ✅ Package backend
│   ├── main.py                ✅ Point d'entrée FastAPI
│   ├── config.py              ✅ Configuration (Pydantic Settings)
│   ├── models.py              ✅ Modèles Pydantic (User, Produit, Marche, etc.)
│   └── database.py            ✅ Connexion MongoDB avec Motor
├── frontend/
│   ├── modules/               # Modules JavaScript (à venir)
│   ├── i18n/                  # Fichiers de traduction FR/HT (à venir)
│   ├── dist/                  # CSS compilé
│   │   └── output.css         ✅ CSS compilé Tailwind
│   ├── styles.css             ✅ Configuration Tailwind
│   ├── index.html             # Point d'entrée (à venir)
│   ├── app.js                 # Routeur principal (à venir)
│   └── sw.js                  # Service Worker (à venir)
├── openspec/                  # Spécifications OpenSpec
│   └── changes/refactoriser-stack-minimaliste/
│       ├── proposal.md        ✅ Proposition
│       ├── design.md          ✅ Document de conception
│       ├── tasks.md           ✅ Plan d'implémentation
│       └── specs/             ✅ 9 fichiers de spécifications
├── .env                       ✅ Variables d'environnement
├── .env.example               ✅ Template de configuration
├── requirements.txt           ✅ Dépendances Python (38 packages)
├── package.json               ✅ Dépendances Node.js (108 packages)
├── tailwind.config.js         ✅ Configuration Tailwind
└── README.md                  ✅ Ce fichier
```

## ✅ Fonctionnalités Implémentées

### Section 1 - Infrastructure ✅
- ✅ Structure du projet créée
- ✅ Configuration environnement (.env avec clés sécurisées)
- ✅ Dépendances Python installées (38 packages)
- ✅ Dépendances Node.js installées (108 packages)
- ✅ TailwindCSS configuré avec thème SAP

### Section 2 - Backend API Foundation ✅
- ✅ `backend/__init__.py` - Package marker
- ✅ `backend/config.py` - Configuration avec Pydantic Settings
- ✅ `backend/database.py` - Connexion MongoDB async (Motor)
- ✅ `backend/models.py` - Modèles Pydantic (User, Produit, Marche, Collecte, Alerte)
- ✅ `backend/main.py` - Application FastAPI avec lifespan
- ✅ 3 endpoints de base: `/`, `/health`, `/version`
- ✅ Documentation Swagger UI automatique
- ✅ Middleware CORS configuré
- ✅ Index MongoDB créés automatiquement au démarrage

### Section 3 - Sécurité et Authentification ✅

#### Services (`backend/services/auth.py`)
- ✅ Hachage/vérification mots de passe (bcrypt)
- ✅ Génération/validation tokens JWT (access + refresh)
- ✅ Génération/vérification codes TOTP (PyOTP)
- ✅ Génération QR codes pour apps d'authentification
- ✅ Génération/vérification backup codes
- ✅ Chiffrement/déchiffrement secrets MFA (Fernet)

#### Middleware
- ✅ `security.py` - Middleware JWT pour protection des routes
- ✅ `rbac.py` - Contrôle d'accès basé sur les rôles (agent, décideur, bailleur)
- ✅ `audit.py` - Logging des actions dans MongoDB (collection audit_logs)

#### Endpoints d'authentification (`/api/auth/*`)
1. ✅ `POST /api/auth/register` - Inscription utilisateur
2. ✅ `POST /api/auth/login` - Connexion (support MFA)
3. ✅ `POST /api/auth/verify-mfa` - Vérification code MFA
4. ✅ `POST /api/auth/refresh` - Rafraîchir access token
5. ✅ `GET /api/auth/me` - Obtenir utilisateur actuel
6. ✅ `POST /api/auth/mfa/setup` - Configurer MFA (QR code + backup codes)
7. ✅ `POST /api/auth/mfa/verify-setup` - Activer MFA
8. ✅ `POST /api/auth/mfa/disable` - Désactiver MFA

### Section 4 - Gestion des Données de Référence ✅

#### Modèles enrichis (`backend/models.py`)
- ✅ `UniteMesure` - Unités de mesure (kg, livre, sac, marmite, etc.)
- ✅ `CategorieProduit` - Catégories de produits
- ✅ `CategorieUser` - Catégories d'utilisateurs
- ✅ `Permission` - Permissions système
- ✅ `Role` - Rôles avec permissions
- ✅ `Departement` - 10 départements d'Haïti
- ✅ `Commune` - Communes avec type_zone (urbaine/péri-urbaine/rurale)
- ✅ `Produit` enrichi - Relations avec catégorie et unité de mesure
- ✅ `Marche` enrichi - Nom créole, spécialités, contacts
- ✅ `User` enrichi - Prénom, catégorie, rôle

#### Endpoints référentiels (`/api/*`)
1. ✅ `GET/POST /api/unites-mesure` - Gestion des unités de mesure
2. ✅ `GET/POST /api/categories-produit` - Gestion des catégories de produits
3. ✅ `GET/POST /api/categories-user` - Gestion des catégories d'utilisateurs
4. ✅ `GET/POST /api/permissions` - Gestion des permissions (décideur uniquement)
5. ✅ `GET/POST /api/roles` - Gestion des rôles (décideur uniquement)

#### Endpoints hiérarchie territoriale (`/api/*`)
6. ✅ `GET/POST/PUT/DELETE /api/departements` - CRUD départements
7. ✅ `GET /api/departements/{id}` - Détail d'un département
8. ✅ `GET /api/departements/{id}/communes` - Communes d'un département
9. ✅ `GET/POST/PUT/DELETE /api/communes` - CRUD communes
10. ✅ `GET /api/communes/{id}` - Détail d'une commune

#### Endpoints produits (`/api/produits/*`)
11. ✅ `GET /api/produits` - Liste des produits (filtrable par catégorie)
12. ✅ `GET /api/produits/{id}` - Détail d'un produit
13. ✅ `POST /api/produits` - Créer un produit (décideur)
14. ✅ `PUT /api/produits/{id}` - Modifier un produit (décideur)
15. ✅ `DELETE /api/produits/{id}` - Supprimer un produit (décideur)

#### Endpoints marchés (`/api/marches/*`)
16. ✅ `GET /api/marches` - Liste des marchés (filtrable par commune/département)
17. ✅ `GET /api/marches/{id}` - Détail d'un marché
18. ✅ `POST /api/marches` - Créer un marché (décideur)
19. ✅ `PUT /api/marches/{id}` - Modifier un marché (décideur)
20. ✅ `DELETE /api/marches/{id}` - Supprimer un marché (décideur)
21. ✅ `GET /api/marches/communes/{id}/marches` - Marchés d'une commune

#### Script de seed data (`backend/scripts/seed_data.py`)
- ✅ 8 unités de mesure (kg, livre, sac, marmite, litre, gallon, unité, douzaine)
- ✅ 8 catégories de produits (céréales, légumineuses, huiles, tubercules, etc.)
- ✅ 10 départements d'Haïti avec codes ISO (HT-OU, HT-AR, HT-ND, etc.)
- ✅ 28 communes principales (Port-au-Prince, Cap-Haïtien, Gonaïves, etc.)
- ✅ 15 produits de base (riz, maïs, haricots, huile, sucre, etc.)

#### Protection RBAC
- ✅ Lecture: tous les rôles authentifiés
- ✅ Création/Modification: décideur uniquement
- ✅ Vérifications d'intégrité référentielle
- ✅ Soft delete pour données avec relations

## 🧪 Tests et Validation

### 0. Initialiser les Données de Référence

**Important:** Avant de tester l'API, exécutez le script de seed data pour créer les données de base.

```bash
# Assurez-vous que MongoDB est démarré
net start MongoDB

# Exécuter le script de seed data
python -m backend.scripts.seed_data
```

**Résultat attendu:**
```
======================================================================
INITIALISATION DES DONNEES DE REFERENCE DU SAP
======================================================================

[1/5] Initialisation des unites de mesure...
   -> 8 unites de mesure creees

[2/5] Initialisation des categories de produits...
   -> 8 categories de produits creees

[3/5] Initialisation des departements...
   -> 10 departements crees

[4/5] Initialisation des communes...
   -> 28 communes creees

[5/5] Initialisation des produits...
   -> 15 produits crees

======================================================================
INITIALISATION TERMINEE AVEC SUCCES!
======================================================================
```

**Note:** Le script est idempotent - il ne créera pas de doublons si les données existent déjà.

### 1. Tester le Health Check

```bash
# Démarrer le serveur
uvicorn backend.main:app --reload --port 8000

# Dans un autre terminal, tester les endpoints de base
curl http://localhost:8000/
curl http://localhost:8000/health
curl http://localhost:8000/version
```

**Réponse attendue `/health`:**
```json
{
  "status": "healthy",
  "database": "connected",
  "environment": "development",
  "timestamp": "2026-01-22T03:26:43.771164"
}
```

### 2. Tester l'Inscription d'un Utilisateur

```bash
# Créer un utilisateur test
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "agent@sap.ht",
    "password": "MotDePasse123",
    "role": "agent",
    "nom": "Jean Dupont",
    "actif": true
  }'
```

**Réponse attendue:**
```json
{
  "email": "agent@sap.ht",
  "role": "agent",
  "nom": "Jean Dupont",
  "departement_id": null,
  "telephone": null,
  "actif": true,
  "id": "...",
  "mfa_enabled": false,
  "created_at": "2026-01-22T03:26:54.228137"
}
```

### 3. Tester la Connexion

```bash
# Se connecter
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "agent@sap.ht",
    "password": "MotDePasse123"
  }'
```

**Réponse attendue:**
```json
{
  "access_token": "eyJhbGci...",
  "refresh_token": "eyJhbGci...",
  "token_type": "bearer",
  "user": {
    "email": "agent@sap.ht",
    "role": "agent",
    ...
  },
  "mfa_required": false
}
```

**Important:** Copiez le `access_token` pour les prochaines requêtes.

### 4. Tester l'Authentification JWT

```bash
# Utiliser le token pour accéder à un endpoint protégé
curl http://localhost:8000/api/auth/me \
  -H "Authorization: Bearer VOTRE_ACCESS_TOKEN"
```

**Réponse attendue:**
```json
{
  "email": "agent@sap.ht",
  "role": "agent",
  "nom": "Jean Dupont",
  "id": "...",
  "mfa_enabled": false,
  "created_at": "..."
}
```

### 5. Tester la Configuration MFA (Optionnel)

```bash
# Configurer le MFA pour l'utilisateur connecté
curl -X POST http://localhost:8000/api/auth/mfa/setup \
  -H "Authorization: Bearer VOTRE_ACCESS_TOKEN"
```

**Réponse attendue:**
```json
{
  "secret": "ABCDEF123456...",
  "qr_code": "data:image/png;base64,...",
  "backup_codes": [
    "1A2B-3C4D",
    "5E6F-7G8H",
    ...
  ]
}
```

Le QR code peut être scanné avec Google Authenticator, Authy, ou toute app TOTP.

### 6. Tester les Endpoints de la Section 4

**Créer un utilisateur décideur:**
```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "decideur@sap.ht",
    "password": "MotDePasse123",
    "role": "décideur",
    "nom": "Jean Decideur",
    "actif": true
  }'
```

**Se connecter et récupérer le token:**
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "decideur@sap.ht",
    "password": "MotDePasse123"
  }'
```

**Tester les unités de mesure:**
```bash
# Lister les unités de mesure
curl -H "Authorization: Bearer VOTRE_TOKEN" \
  http://localhost:8000/api/unites-mesure
```

**Réponse attendue:** 8 unités (kg, livre, sac, marmite, litre, gallon, unité, douzaine)

**Tester les départements:**
```bash
# Lister les départements
curl -H "Authorization: Bearer VOTRE_TOKEN" \
  http://localhost:8000/api/departements
```

**Réponse attendue:** 10 départements d'Haïti avec codes ISO

**Tester les produits:**
```bash
# Lister les produits
curl -H "Authorization: Bearer VOTRE_TOKEN" \
  http://localhost:8000/api/produits
```

**Réponse attendue:** 15 produits avec relations (categorie_nom, unite_nom)

**Exemple de réponse produit:**
```json
{
  "nom": "Riz importé",
  "nom_creole": "Diri etranje",
  "code": "PROD-RIZ-IMP",
  "id_categorie": "...",
  "id_unite_mesure": "...",
  "id": "...",
  "actif": true,
  "categorie_nom": "Céréales",
  "unite_nom": "livre"
}
```

### 7. Explorer l'API avec Swagger UI

Ouvrez votre navigateur: `http://localhost:8000/docs`

Swagger UI vous permet de:
- 📖 Voir tous les endpoints disponibles
- 🧪 Tester les endpoints directement depuis le navigateur
- 📝 Voir les schémas de requête/réponse
- 🔐 Autoriser avec votre token JWT (bouton "Authorize")

## 📊 Base de Données MongoDB

### Collections créées automatiquement:

**Collections principales:**
1. **users** - Utilisateurs du système
   - Index sur `email` (unique), `role`

2. **collectes_prix** - Collectes de prix sur les marchés
   - Index sur `marche_id`, `produit_id`, `date`, `agent_id`, `statut`

3. **audit_logs** - Logs d'audit des actions
   - Index sur `user_id`, `timestamp`, `action`

**Collections référentiels (Section 4):**
4. **unites_mesure** - Unités de mesure
   - Index sur `unite` (unique)

5. **categories_produit** - Catégories de produits
   - Index sur `nom`

6. **categories_user** - Catégories d'utilisateurs
   - Index sur `nom`

7. **permissions** - Permissions système
   - Index composé sur `nom` + `action` (unique)

8. **roles** - Rôles avec permissions
   - Index sur `nom` (unique)

**Collections hiérarchie territoriale:**
9. **departements** - 10 départements d'Haïti
   - Index sur `code` (unique), `actif`

10. **communes** - Communes (~145 au total)
    - Index sur `code` (unique), `departement_id`, `actif`

11. **marches** - Marchés locaux
    - Index sur `code` (unique), `commune_id`, `actif`
    - Index géospatial `2dsphere` sur `location`

12. **produits** - Référentiel des produits alimentaires
    - Index sur `code` (unique), `actif`

### Se connecter à MongoDB:

```bash
# Shell MongoDB
mongo

# Utiliser la base de données
use sap_db

# Voir les collections
show collections

# Voir les utilisateurs
db.users.find().pretty()

# Voir les logs d'audit
db.audit_logs.find().limit(10).pretty()
```

## 🔐 Sécurité

### Authentification
- **JWT (JSON Web Tokens)** pour les sessions
- **Access tokens** valides 24 heures (configurable)
- **Refresh tokens** valides 7 jours (configurable)
- **MFA (Multi-Factor Authentication)** avec TOTP (optionnel)

### Protection des mots de passe
- Hachage avec **bcrypt** (coût par défaut)
- Limite de 72 bytes par mot de passe (contrainte bcrypt)

### Chiffrement
- Secrets MFA chiffrés avec **Fernet** (AES-128)
- Clés stockées dans variables d'environnement

### Audit
- Toutes les actions importantes loggées dans `audit_logs`
- Tentatives de connexion enregistrées (succès/échecs)
- IP et User-Agent capturés

### RBAC (Contrôle d'accès basé sur les rôles)
- **agent** - Collecte de prix sur le terrain
- **décideur** - Validation des données, gestion utilisateurs
- **bailleur** - Consultation des données et rapports

## 🔧 Commandes Utiles

### Backend

```bash
# Démarrer avec hot-reload
uvicorn backend.main:app --reload

# Démarrer sur réseau local
uvicorn backend.main:app --host 0.0.0.0 --port 8000

# Démarrer en production (sans reload)
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --workers 4
```

### Frontend

```bash
npm run tailwind:build    # Compiler CSS (production)
npm run tailwind:watch    # Compiler CSS (watch mode)
npm run serve             # Serveur HTTP Python
npm run dev               # Watch + Serve en parallèle
```

### Tests

```bash
npm test                  # Lancer tests Playwright
npm run test:ui           # Interface UI des tests
```

### Base de données

```bash
mongo                     # Console MongoDB
mongod --dbpath <path>    # Démarrer MongoDB avec chemin custom

# Dump et restore
mongodump --db sap_db --out backup/
mongorestore --db sap_db backup/sap_db/
```

### Git (Branches)

```bash
# Branches disponibles
git branch -a

# Changer de branche
git checkout main          # Branche principale
git checkout v0.1          # Version 0.1
git checkout refactor-stack-minimaliste  # Développement
```

## 📚 Documentation

- [Proposition complète](openspec/changes/refactoriser-stack-minimaliste/proposal.md)
- [Document de conception](openspec/changes/refactoriser-stack-minimaliste/design.md)
- [Plan d'implémentation](openspec/changes/refactoriser-stack-minimaliste/tasks.md)
- [PRD - Feuille de route](PRD.md)
- [Swagger UI](http://localhost:8000/docs) (serveur démarré)
- [ReDoc](http://localhost:8000/redoc) (serveur démarré)

## 🐛 Dépannage

### Erreur "Port already in use"
```bash
# Trouver le processus utilisant le port 8000
netstat -ano | findstr :8000

# Tuer le processus (Windows)
taskkill /PID <PID> /F
```

### Erreur "MongoDB not connected"
```bash
# Vérifier que MongoDB est démarré
net start MongoDB

# Ou vérifier manuellement
mongod --version
```

### Erreur "Module not found"
```bash
# Réinstaller les dépendances Python
pip install -r requirements.txt

# Réinstaller les dépendances Node.js
npm install
```

### Erreur "Invalid token"
- Vérifiez que vous utilisez le bon `access_token`
- Les tokens expirent après 24 heures (utilisez `/api/auth/refresh`)
- Assurez-vous d'inclure `Bearer` avant le token: `Authorization: Bearer <token>`

## 📝 Prochaines Étapes

### ✅ Sections Terminées

- ✅ **Section 1** - Infrastructure et configuration
- ✅ **Section 2** - Backend API Foundation
- ✅ **Section 3** - Sécurité et Authentification
- ✅ **Section 4** - Gestion des Données de Référence

### 🔄 Sections À Venir

- **Section 5** - Collectes de Prix et Alertes
  - CRUD Collectes de prix (mode hors-ligne)
  - Calcul automatique des alertes (4 niveaux)
  - Endpoints de consultation des alertes
  - Notifications (SendGrid)

- **Section 6** - Frontend
  - Interface utilisateur (HTML + JS + Tailwind)
  - Mode hors-ligne (Service Worker + IndexedDB)
  - Internationalisation (FR/HT)

- **Section 7** - Tests et Déploiement
  - Tests E2E avec Playwright
  - Optimisation performance
  - Documentation déploiement

## 🤝 Contribution

Ce projet suit le workflow OpenSpec pour la gestion des changements. Voir `openspec/AGENTS.md` pour plus de détails.

## 📄 Licence

MIT

---

**Status**: ✅ Sections 1, 2, 3, 4 terminées - Backend API complet avec référentiels
**Version**: v0.2
**Dernière mise à jour**: 2026-01-23

**Endpoints disponibles**: 42 endpoints
- 3 endpoints de base (/, /health, /version)
- 8 endpoints d'authentification
- 10 endpoints de référentiels (unités, catégories, permissions, rôles)
- 13 endpoints hiérarchie territoriale (départements, communes)
- 5 endpoints produits (CRUD)
- 6 endpoints marchés (CRUD)

**Collections MongoDB**: 12 collections avec index optimisés
**Données de seed**: 8 unités, 8 catégories, 10 départements, 28 communes, 15 produits

**Tests**: ✅ Inscription, Connexion, JWT, MFA, CRUD complet sur tous les référentiels
**Prochaine étape**: Section 5 - Collectes de Prix et Alertes
