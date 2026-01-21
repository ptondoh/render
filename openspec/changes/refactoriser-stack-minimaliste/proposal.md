# Changement : Refactoriser l'architecture vers un stack minimaliste et consolidé

## Pourquoi

Le projet SAP (Système d'Alerte Précoce) nécessite une architecture simplifiée et performante qui :
- Minimise la complexité du déploiement et de la maintenance
- Optimise les performances pour un environnement avec connectivité limitée
- Consolide le code dans quelques fichiers principaux pour faciliter la compréhension et la gestion
- Utilise des technologies éprouvées et légères adaptées aux contraintes du terrain

## Ce qui change

- **BREAKING** : Migration complète du stack technologique vers :
  - **Frontend** : HTML5 + JavaScript pur + TailwindCSS (sans framework JS lourd)
  - **Stockage local** : IndexedDB pour le mode hors-ligne
  - **Backend API** : Python + FastAPI + Uvicorn
  - **Base de données** : MongoDB (NoSQL flexible)
  - **Tâches planifiées** : APScheduler (jobs Python)
  - **Tests E2E** : Playwright
  - **Runtime** : Node.js (pour outillage uniquement, pas pour l'application)

- **BREAKING** : Consolidation du code en quelques fichiers principaux :
  - Frontend : `app.html`, `app.js`, `app.css` (+ modules par fonctionnalité majeure)
  - Backend : `main.py`, `models.py`, `services.py`, `scheduler.py`
  - Configuration : `config.py`, `tailwind.config.js`

- Architecture en 3 couches claires :
  - **Présentation** : Application web responsive avec mode hors-ligne
  - **API** : Services RESTful avec FastAPI
  - **Données** : MongoDB avec schémas flexibles

## Impact

### Capacités affectées
- `architecture-frontend` (NOUVELLE)
- `architecture-backend` (NOUVELLE)
- `stockage-donnees` (NOUVELLE)
- `mode-hors-ligne` (NOUVELLE)
- `securite-authentification` (NOUVELLE)
- `collecte-prix-marches` (NOUVELLE)
- `gestion-hierarchie-territoriale` (NOUVELLE)
- `gestion-produits` (NOUVELLE)
- `systeme-alertes` (NOUVELLE)

### Code affecté
- Création complète de la nouvelle architecture
- Tous les fichiers seront nouveaux (projet initial)

### Bénéfices
- ✅ Réduction de la taille du bundle (~80% plus léger sans React/Next.js)
- ✅ Performance accrue (JavaScript natif + FastAPI)
- ✅ Déploiement simplifié (2 services : API Python + fichiers statiques)
- ✅ Mode hors-ligne robuste avec IndexedDB
- ✅ Maintenance facilitée par la consolidation du code
- ✅ Flexibilité du schéma avec MongoDB
- ✅ Écosystème Python riche pour l'analyse de données future (Phase 4)

### Risques
- Migration d'un éventuel code existant nécessaire
- Courbe d'apprentissage pour l'équipe si habituée aux frameworks modernes
- JavaScript pur nécessite plus de rigueur architecturale
