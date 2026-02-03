# Guide de Test en Local - SAP (Système d'Alerte Précoce)

Ce guide vous aidera à cloner, installer et tester l'application SAP sur votre machine locale.

## 📋 Prérequis

Avant de commencer, assurez-vous d'avoir installé :

- **Python 3.11+** ([Télécharger Python](https://www.python.org/downloads/))
- **Node.js 18+** (pour les outils frontend uniquement) ([Télécharger Node.js](https://nodejs.org/))
- **MongoDB** (local ou compte MongoDB Atlas)
  - **Option 1 - Local** : [Télécharger MongoDB Community](https://www.mongodb.com/try/download/community)
  - **Option 2 - Cloud** : [Créer un compte MongoDB Atlas gratuit](https://www.mongodb.com/cloud/atlas/register)
- **Git** ([Télécharger Git](https://git-scm.com/downloads))

## 🚀 Installation

### 1. Cloner le projet

```bash
git clone https://github.com/tep-parsa/sap-minimaliste.git
cd sap-minimaliste
```

### 2. Installer les dépendances Python

```bash
# Créer un environnement virtuel (recommandé)
python -m venv venv

# Activer l'environnement virtuel
# Sur Windows :
venv\Scripts\activate
# Sur Mac/Linux :
source venv/bin/activate

# Installer les dépendances
pip install -r requirements.txt
```

### 3. Configuration de MongoDB

#### Option A : MongoDB Local

1. **Installer MongoDB Community** sur votre machine
2. **Démarrer MongoDB** :
   ```bash
   # Windows (généralement se lance automatiquement comme service)
   # Vérifier si MongoDB tourne :
   mongosh

   # Mac/Linux
   sudo systemctl start mongod
   # ou
   brew services start mongodb-community
   ```

3. **Créer le fichier `.env`** à la racine du projet :
   ```env
   # Configuration Backend
   MONGODB_URI=mongodb://localhost:27017
   MONGODB_DB_NAME=sap_db

   # Sécurité
   JWT_SECRET_KEY=votre-cle-secrete-super-longue-et-aleatoire-changez-la
   JWT_ALGORITHM=HS256
   JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
   JWT_REFRESH_TOKEN_EXPIRE_DAYS=7

   # Application
   APP_ENV=development
   APP_DEBUG=True
   APP_HOST=0.0.0.0
   APP_PORT=8000

   # CORS
   CORS_ORIGINS=http://localhost:3000,http://localhost:8000,http://127.0.0.1:3000
   ```

#### Option B : MongoDB Atlas (Cloud)

1. **Créer un cluster gratuit** sur [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register)
2. **Créer un utilisateur** de base de données (ex: `sap_user`)
3. **Autoriser votre IP** dans Network Access
4. **Récupérer la chaîne de connexion** (remplacer `<password>` par votre mot de passe)
5. **Créer le fichier `.env`** :
   ```env
   # Configuration Backend
   MONGODB_URI=mongodb+srv://sap_user:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   MONGODB_DB_NAME=sap_db

   # Sécurité
   JWT_SECRET_KEY=votre-cle-secrete-super-longue-et-aleatoire-changez-la
   JWT_ALGORITHM=HS256
   JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
   JWT_REFRESH_TOKEN_EXPIRE_DAYS=7

   # Application
   APP_ENV=development
   APP_DEBUG=True
   APP_HOST=0.0.0.0
   APP_PORT=8000

   # CORS
   CORS_ORIGINS=http://localhost:3000,http://localhost:8000,http://127.0.0.1:3000
   ```

### 4. Initialiser la base de données

Exécutez le script de seed pour créer les données de test :

```bash
python backend/scripts/seed_database.py
```

Ce script va créer :
- ✅ 3 utilisateurs de test (admin, agent, décideur)
- ✅ 10 départements d'Haïti
- ✅ ~140 communes
- ✅ 5 marchés avec produits
- ✅ 20+ produits alimentaires
- ✅ Unités de mesure
- ✅ Données de collectes exemple

### 5. Compiler le CSS (Tailwind)

```bash
cd frontend
npm install
npm run tailwind:build
cd ..
```

## 🎯 Lancement de l'application

**IMPORTANT** : Vous devez lancer **2 serveurs** en même temps dans **2 terminaux séparés**.

### Terminal 1 : Backend (API)

```bash
# Depuis la RACINE du projet
python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

Vous devriez voir :
```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete.
✅ Connecté à MongoDB: sap_db
```

### Terminal 2 : Frontend (Interface)

```bash
# Depuis le dossier frontend
cd frontend
python -m http.server 3000
```

Vous devriez voir :
```
Serving HTTP on :: port 3000 (http://[::]:3000/) ...
```

## 🧪 Tester l'application

### 1. Accéder à l'application

Ouvrez votre navigateur et allez sur : **http://localhost:3000**

### 2. Comptes de test

| Rôle | Email | Mot de passe |
|------|-------|--------------|
| **Admin** | admin@sap.ht | Admin123! |
| **Agent** | agent@sap.ht | Test123! |
| **Décideur** | decideur@sap.ht | Test123! |

### 3. Tests par fonctionnalité

#### A. Dashboard (Tous les rôles)

1. **Connexion** avec n'importe quel compte
2. **Vérifier les tuiles** :
   - Nombre de collectes
   - Alertes actives
   - Marchés suivis
   - Produits surveillés
3. **Tester les filtres** :
   - Sélectionner un département
   - Sélectionner une commune
   - Les chiffres devraient se mettre à jour

#### B. Collectes (Rôle: Agent)

1. **Se connecter** avec `agent@sap.ht`
2. **Accéder à la page Collectes**
3. **Formulaire de collecte** :
   - Autoriser la géolocalisation (pour sélectionner un marché proche)
   - Sélectionner un marché dans la liste déroulante
   - Sélectionner la date du jour
   - Sélectionner une période (matin1, matin2, soir1, soir2)
   - Remplir les prix pour chaque produit
   - **Soumettre** la collecte
4. **Import CSV/Excel** :
   - Télécharger un template (CSV ou Excel)
   - Modifier le fichier avec vos données
   - Glisser-déposer le fichier ou cliquer pour sélectionner
   - **Vérifier l'aperçu** des données
   - **Confirmer l'import**

**Structure du fichier d'import** :

| marche_nom | produit_nom | unite_nom | quantite | prix | date | periode | commentaire |
|------------|-------------|-----------|----------|------|------|---------|-------------|
| Croix-des-Bossales | Riz local | kilogramme | 1.0 | 75.0 | 2026-02-03 | matin1 | Prix stable |
| Marché Salomon | Maïs moulu | livre | 2.0 | 50.0 | 2026-02-03 | soir1 | Prix en hausse |

**Périodes valides** : `matin1`, `matin2`, `soir1`, `soir2`

#### C. Alertes (Rôle: Décideur)

1. **Se connecter** avec `decideur@sap.ht`
2. **Accéder à la page Alertes**
3. **Consulter les alertes** générées automatiquement :
   - Variations de prix anormales
   - Pénuries détectées
   - Tendances à la hausse
4. **Filtrer les alertes** :
   - Par département
   - Par commune
   - Par produit
   - Par niveau de gravité (critique, élevée, moyenne, faible)

#### D. Administration (Rôle: Admin)

1. **Se connecter** avec `admin@sap.ht`
2. **Accéder au menu Admin**
3. **Tester les pages CRUD** :
   - **Produits** : Créer, modifier, supprimer des produits
   - **Marchés** : Gérer les marchés et leurs produits
   - **Communes** : Gérer les communes
   - **Unités de mesure** : Gérer les unités (kg, lb, etc.)
4. **Pagination** : Naviguer entre les pages (20 items/page)

## 🔧 Troubleshooting

### Problème : "This site can't be reached" sur localhost:3000

**Solution** : Le serveur frontend ne tourne pas.
```bash
cd frontend
python -m http.server 3000
```

### Problème : "Erreur lors du chargement des marchés" (CORS)

**Solution** : Vérifiez que le backend tourne correctement.
```bash
# Tester le backend
curl http://localhost:8000/health

# Devrait retourner : {"status":"healthy","database":"connected",...}
```

**Si le backend ne répond pas** :
1. Arrêtez tous les processus Python en cours
2. Relancez le backend depuis la RACINE du projet :
   ```bash
   python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
   ```

### Problème : "ModuleNotFoundError: No module named 'backend'"

**Solution** : Vous êtes dans le mauvais répertoire.
```bash
# Assurez-vous d'être à la RACINE du projet
pwd  # ou cd sur Windows

# Devrait afficher : .../sap-minimaliste
# PAS : .../sap-minimaliste/frontend
# PAS : .../sap-minimaliste/backend
```

### Problème : Multiple processus sur le port 8000

**Solution** : Arrêtez tous les backends en double.

**Windows** :
```bash
# Voir les processus sur le port 8000
netstat -ano | findstr ":8000"

# Arrêter via le Gestionnaire des tâches
# Ou via PowerShell :
Stop-Process -Id <PID> -Force
```

**Mac/Linux** :
```bash
# Voir les processus sur le port 8000
lsof -i :8000

# Arrêter le processus
kill -9 <PID>
```

### Problème : "KeyError: 'code'" ou "KeyError: 'type_marche'"

**Solution** : Vos données de marchés sont incomplètes. Réinitialisez la base de données :
```bash
python backend/scripts/seed_database.py
```

### Problème : Excel montre des caractères binaires (PK||��...)

**Solution** : Assurez-vous que la bibliothèque SheetJS est chargée dans `frontend/index.html` :
```html
<script src="https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js"></script>
```

### Problème : CSS ne se charge pas (styles manquants)

**Solution** : Recompilez le CSS Tailwind :
```bash
cd frontend
npm run tailwind:build
```

## 📊 Endpoints API disponibles

Une fois le backend lancé, vous pouvez tester les endpoints :

- **Documentation interactive** : http://localhost:8000/docs
- **Santé de l'API** : http://localhost:8000/health

### Endpoints principaux :

| Méthode | Endpoint | Description | Authentification |
|---------|----------|-------------|------------------|
| POST | `/api/auth/login` | Connexion | Non |
| GET | `/api/marches` | Liste des marchés | Oui |
| GET | `/api/produits` | Liste des produits | Oui |
| GET | `/api/collectes` | Liste des collectes | Oui |
| POST | `/api/collectes` | Créer une collecte | Oui (Agent) |
| POST | `/api/collectes/import` | Import CSV/Excel | Oui (Agent) |
| GET | `/api/alertes` | Liste des alertes | Oui (Décideur) |
| GET | `/api/dashboard/stats` | Statistiques dashboard | Oui |

## 📝 Notes importantes

1. **Port 8000 et 3000** : Assurez-vous que ces ports sont libres avant de lancer les serveurs
2. **Géolocalisation** : Pour sélectionner un marché, le navigateur doit avoir accès à votre localisation GPS
3. **Auto-validation** : Les collectes sont automatiquement validées et génèrent des alertes en temps réel
4. **Base de données** : Les données de test incluent des collectes des 30 derniers jours pour tester les graphiques
5. **Responsive** : L'application est optimisée pour mobile et desktop

## 🐛 Rapporter un bug

Si vous rencontrez un problème non listé ici :

1. Vérifiez les logs dans les terminaux backend et frontend
2. Ouvrez la console du navigateur (F12) pour voir les erreurs JavaScript
3. Créez une issue sur GitHub avec :
   - Description du problème
   - Étapes pour reproduire
   - Logs d'erreur
   - Système d'exploitation et versions (Python, Node.js, etc.)

## 📚 Architecture du projet

```
sap-minimaliste/
├── backend/
│   ├── main.py              # Point d'entrée FastAPI
│   ├── models.py            # Modèles Pydantic
│   ├── database.py          # Connexion MongoDB
│   ├── config.py            # Configuration
│   ├── routers/             # Endpoints API
│   │   ├── auth.py          # Authentification
│   │   ├── collectes.py     # Gestion des collectes
│   │   ├── import_collectes.py  # Import CSV/Excel
│   │   ├── marches.py       # Gestion des marchés
│   │   ├── produits.py      # Gestion des produits
│   │   ├── alertes.py       # Système d'alertes
│   │   └── ...
│   ├── middleware/          # Sécurité JWT & RBAC
│   └── scripts/             # Scripts utilitaires
│       └── seed_database.py # Initialisation DB
├── frontend/
│   ├── index.html           # Page principale
│   ├── app.js               # Routeur et app principale
│   ├── pages/               # Pages SPA
│   │   ├── login.js
│   │   ├── dashboard.js
│   │   ├── collectes.js
│   │   ├── alertes.js
│   │   └── admin/
│   ├── modules/             # Modules réutilisables
│   │   ├── api.js           # Client API
│   │   ├── auth.js          # Gestion auth
│   │   └── components.js    # Composants UI
│   ├── dist/                # CSS compilé
│   └── styles/              # Sources CSS
├── templates/               # Templates CSV/Excel
│   ├── template_collecte_prix.csv
│   └── template_collecte_prix.xlsx
├── requirements.txt         # Dépendances Python
├── .env                     # Configuration (à créer)
├── README.md                # Documentation principale
└── test.md                  # Ce guide !
```

## ✅ Checklist de test complet

- [ ] Installation réussie (Python, dépendances)
- [ ] MongoDB connecté (local ou Atlas)
- [ ] Seed de la base de données
- [ ] Backend démarré sur port 8000
- [ ] Frontend démarré sur port 3000
- [ ] Connexion avec les 3 rôles (admin, agent, décideur)
- [ ] Dashboard affiche les statistiques
- [ ] Filtres du dashboard fonctionnent
- [ ] Collecte manuelle créée avec succès
- [ ] Import CSV fonctionne
- [ ] Import Excel fonctionne
- [ ] Aperçu avant import s'affiche
- [ ] Alertes générées automatiquement
- [ ] Filtres des alertes fonctionnent
- [ ] Pages admin CRUD fonctionnelles
- [ ] Pagination fonctionne
- [ ] Géolocalisation fonctionne
- [ ] Responsive mobile OK

## 🎉 Bon test !

Si tout fonctionne correctement, vous devriez avoir une application complète de suivi des prix alimentaires avec :
- Import en masse de données
- Alertes automatiques
- Tableaux de bord interactifs
- Gestion complète des données
- Interface responsive

N'hésitez pas à explorer toutes les fonctionnalités et à signaler tout problème rencontré !
