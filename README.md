# Système d'Alerte Précoce (SAP) - Architecture Minimaliste

Système d'alerte précoce pour la sécurité alimentaire en Haïti - Phase 0 MVP

## 🎯 Stack Technologique

### Frontend
- **HTML5** + **JavaScript pur (ES6)** + **TailwindCSS**
- Mode hors-ligne : Service Worker + IndexedDB
- Internationalisation : Français + Créole haïtien

### Backend
- **Python 3.13** + **FastAPI** + **Uvicorn**
- Base de données : **MongoDB 8.23**
- Authentification : JWT + MFA (TOTP)
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
# Copier le fichier d'exemple (déjà fait si vous suivez ce guide)
cp .env.example .env

# Éditer .env avec vos propres valeurs
# Les clés JWT et MFA sont déjà générées automatiquement
```

### 3. Installer les dépendances Python

```bash
# Créer un environnement virtuel (déjà fait)
python -m venv venv

# Activer l'environnement virtuel
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Installer les dépendances (déjà fait)
pip install -r requirements.txt
```

### 4. Installer les dépendances Node.js

```bash
# Déjà fait
npm install
```

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
# Activer l'environnement virtuel d'abord
venv\Scripts\activate

# Démarrer le serveur (à venir - Section 2)
uvicorn backend.main:app --reload --port 8000
```

#### Frontend (Développement)
```bash
# Terminal séparé - Compiler Tailwind en mode watch + serveur HTTP
npm run dev

# Ou séparément:
npm run tailwind:watch  # Watch mode pour Tailwind
npm run serve           # Serveur HTTP Python sur port 3000
```

## 📁 Structure du Projet

```
sap-minimaliste/
├── backend/
│   ├── services/          # Services métier
│   ├── middleware/        # Middleware (auth, audit, security)
│   ├── tests/             # Tests Playwright
│   ├── main.py            # Point d'entrée FastAPI (à créer)
│   ├── config.py          # Configuration (à créer)
│   ├── models.py          # Modèles Pydantic (à créer)
│   └── database.py        # Connexion MongoDB (à créer)
├── frontend/
│   ├── modules/           # Modules JavaScript
│   ├── i18n/              # Fichiers de traduction (FR/HT)
│   ├── dist/              # CSS compilé
│   ├── index.html         # Point d'entrée (à créer)
│   ├── app.js             # Routeur principal (à créer)
│   └── sw.js              # Service Worker (à créer)
├── openspec/              # Spécifications et proposition
├── .env                   # Variables d'environnement
├── .env.example           # Template de configuration
├── requirements.txt       # Dépendances Python
├── package.json           # Dépendances Node.js
├── tailwind.config.js     # Configuration Tailwind
└── README.md              # Ce fichier
```

## ✅ Validation de l'Installation

Vérifiez que tout est correctement installé :

```bash
# Vérifier Python
python --version  # Devrait afficher Python 3.13.2

# Vérifier Node.js
node --version    # Devrait afficher v22.14.0

# Vérifier les dépendances Python
venv\Scripts\activate
pip list | findstr fastapi  # Devrait afficher fastapi 0.115.5

# Vérifier les dépendances Node.js
npm list --depth=0  # Devrait afficher tailwindcss, playwright, etc.

# Compiler Tailwind CSS
npm run tailwind:build  # Devrait créer frontend/dist/output.css
```

## 📝 Prochaines Étapes

✅ **Section 1 - Infrastructure TERMINÉE**
- Structure projet créée
- Dépendances installées
- Configuration de base prête

🔄 **Section 2 - Backend API Foundation (à venir)**
- Créer `backend/main.py` avec FastAPI de base
- Créer `backend/config.py` pour variables d'environnement
- Créer `backend/database.py` pour connexion MongoDB
- Créer `backend/models.py` avec modèles Pydantic
- Tester avec `/health` et `/docs`

## 🔧 Commandes Utiles

```bash
# Backend
uvicorn backend.main:app --reload         # Démarrer avec hot-reload
uvicorn backend.main:app --host 0.0.0.0   # Accessible sur réseau local

# Frontend
npm run tailwind:build    # Compiler CSS (production)
npm run tailwind:watch    # Compiler CSS (watch mode)
npm run serve             # Serveur HTTP Python

# Tests
npm test                  # Lancer tests Playwright
npm run test:ui           # Interface UI des tests

# Base de données
mongo                     # Console MongoDB
mongod --dbpath <path>    # Démarrer MongoDB avec chemin custom
```

## 📚 Documentation

- [Proposition complète](openspec/changes/refactoriser-stack-minimaliste/proposal.md)
- [Document de conception](openspec/changes/refactoriser-stack-minimaliste/design.md)
- [Plan d'implémentation](openspec/changes/refactoriser-stack-minimaliste/tasks.md)
- [PRD - Feuille de route](PRD.md)

## 🤝 Contribution

Ce projet suit le workflow OpenSpec pour la gestion des changements. Voir `openspec/AGENTS.md` pour plus de détails.

## 📄 Licence

MIT

---

**Status**: ✅ Section 1 terminée - Infrastructure prête
**Prochaine étape**: Section 2 - Backend API Foundation
