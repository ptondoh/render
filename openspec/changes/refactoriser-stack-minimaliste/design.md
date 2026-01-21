# Document de Conception : Architecture Minimaliste SAP

## Contexte

Le Système d'Alerte Précoce (SAP) doit fonctionner dans un environnement contraint :
- Connectivité Internet intermittente ou faible
- Utilisation sur appareils mobiles de gamme moyenne
- Déploiement dans des contextes à ressources limitées
- Besoin de maintenance simple et d'évolutivité

**Contraintes principales :**
- Mode hors-ligne obligatoire pour la collecte terrain
- Authentification multi-facteurs (MFA) requise
- Support de la hiérarchie territoriale complexe (Région > Département > Commune > Marché)
- Journalisation d'audit exhaustive

**Parties prenantes :**
- Agents de terrain (collecte de données)
- Décideurs (validation et analyse)
- Bailleurs (lecture et rapports)
- Administrateurs système

## Objectifs / Non-Objectifs

### Objectifs
- Architecture légère et performante (~200 Ko bundle JS contre ~2 Mo avec React)
- Mode hors-ligne robuste avec synchronisation automatique
- Déploiement simple (Docker ou serveur standard)
- Code consolidé en < 10 fichiers principaux pour la Phase 0
- Support natif de MongoDB pour la flexibilité future
- Écosystème Python pour l'analyse de données (Phases 3-4)

### Non-Objectifs
- Support d'anciens navigateurs (IE11, etc.) - cible : navigateurs modernes uniquement
- Application mobile native (PWA suffit pour la Phase 0)
- Génération de PDF côté client (sera fait côté serveur en Phase 1+)
- Support temps-réel (WebSockets) en Phase 0

## Décisions Architecturales

### 1. Stack Frontend : HTML5 + JavaScript Pur + TailwindCSS

**Décision :** Utiliser du JavaScript vanilla au lieu de React/Vue/Angular

**Justification :**
- **Performance** : Pas de Virtual DOM, manipulation DOM native ultra-rapide
- **Taille** : Bundle ~80% plus léger (critique pour connexions lentes)
- **Hors-ligne** : Service Worker + IndexedDB plus simple sans couche d'abstraction
- **Consolidation** : Code structuré en modules ES6, pas de JSX/transpilation complexe
- **Maintenabilité** : Standards web natifs, pas de dépendances framework à maintenir

**Alternatives considérées :**
- ❌ **React/Next.js** : Trop lourd, complexité inutile pour l'UI relativement simple
- ❌ **Vue.js** : Meilleur que React pour la taille, mais encore une abstraction superflue
- ❌ **Svelte** : Compile bien, mais ajoute un outil de build complexe
- ✅ **JavaScript pur** : Standard, léger, contrôle total

**Structure des fichiers frontend :**
```
frontend/
├── index.html              # Point d'entrée (shell de l'app)
├── app.js                  # Orchestrateur principal et routeur
├── styles.css              # Styles compilés Tailwind
├── sw.js                   # Service Worker (cache + sync)
├── modules/
│   ├── auth.js             # Authentification et MFA
│   ├── collecte.js         # Module collecte prix marchés
│   ├── db.js               # Wrapper IndexedDB
│   ├── sync.js             # Synchronisation avec API
│   └── ui.js               # Composants UI réutilisables
└── config.js               # Configuration frontend
```

### 2. Stack Backend : FastAPI + Python

**Décision :** FastAPI avec Uvicorn comme serveur ASGI

**Justification :**
- **Performance** : FastAPI est l'un des frameworks Python les plus rapides (comparable à Node.js)
- **Typage** : Pydantic pour validation automatique et documentation OpenAPI
- **Async** : Support natif async/await pour opérations I/O
- **Écosystème** : Python requis pour ML/IA en Phase 4 (prédictions, analyse satellite)
- **Simplicité** : Code intuitif, excellent pour équipes multi-niveaux

**Alternatives considérées :**
- ❌ **Node.js/Express** : Bon, mais nécessite JavaScript côté serveur (moins adapté pour ML)
- ❌ **Django** : Trop monolithique, overhead inutile
- ❌ **Flask** : Léger mais moins performant et moins de fonctionnalités built-in que FastAPI
- ✅ **FastAPI** : Performance + écosystème Python + documentation auto

**Structure des fichiers backend :**
```
backend/
├── main.py                 # Point d'entrée FastAPI
├── config.py               # Configuration (env vars, secrets)
├── models.py               # Modèles Pydantic et schémas MongoDB
├── database.py             # Connexion et helpers MongoDB
├── services/
│   ├── auth.py             # Service authentification (JWT, MFA)
│   ├── collecte.py         # Service collecte prix
│   ├── hierarchie.py       # Service hiérarchie territoriale
│   ├── produits.py         # Service gestion produits
│   └── alertes.py          # Service système d'alertes
├── middleware/
│   ├── audit.py            # Middleware journalisation audit
│   └── security.py         # Middleware sécurité (CORS, rate limit)
├── scheduler.py            # Tâches planifiées APScheduler
└── tests/                  # Tests Playwright
```

### 3. Base de Données : MongoDB

**Décision :** MongoDB comme base de données principale

**Justification :**
- **Schéma flexible** : Évolution facile entre phases (0→4) sans migrations lourdes
- **Hiérarchie** : Documents imbriqués naturels pour Région>Département>Commune
- **Performance** : Indexation rapide, agrégations puissantes pour rapports
- **Réplication** : Support natif pour déploiements distribués (multi-sites futurs)
- **JSON natif** : Pas de mapping ORM, direct de l'API au client

**Alternatives considérées :**
- ❌ **PostgreSQL** : Excellent mais schéma rigide, migrations complexes
- ❌ **MySQL** : Moins adapté pour données hiérarchiques
- ❌ **SQLite** : Trop limité pour production multi-utilisateurs
- ✅ **MongoDB** : Flexibilité + performance + scalabilité

**Schéma de données clés (Phase 0) :**
```javascript
// Collection: regions
{
  _id: ObjectId,
  code: "REG-01",
  nom: "Nord",
  departements: [
    { code: "DEP-01", nom: "Nord-Est", communes: [...] }
  ]
}

// Collection: produits
{
  _id: ObjectId,
  code: "PROD-RIZ",
  nom: "Riz local",
  unite: "kg",
  categorie: "cereales"
}

// Collection: collectes_prix
{
  _id: ObjectId,
  marche_id: ObjectId,
  produit_id: ObjectId,
  prix: 125.50,
  date: ISODate,
  agent_id: ObjectId,
  statut: "validé",
  synced_at: ISODate,
  created_offline: true
}

// Collection: users
{
  _id: ObjectId,
  email: "agent@sap.ht",
  password_hash: "...",
  role: "agent",
  mfa_secret: "...",
  region_id: ObjectId,
  actif: true
}

// Collection: audit_logs
{
  _id: ObjectId,
  user_id: ObjectId,
  action: "CREATE_COLLECTE",
  resource: "collectes_prix",
  resource_id: ObjectId,
  changes: {...},
  timestamp: ISODate,
  ip: "192.168.1.1"
}
```

### 4. Mode Hors-ligne : Service Worker + IndexedDB

**Décision :** Service Worker pour cache et IndexedDB pour stockage structuré

**Justification :**
- **Standard Web** : Pas de dépendance externe, support natif navigateurs modernes
- **Capacité** : IndexedDB sans limite de taille (vs LocalStorage 5-10 Mo)
- **Transactions** : IndexedDB supporte transactions ACID côté client
- **Sync** : Background Sync API pour soumission automatique au retour réseau

**Stratégie de synchronisation :**
1. Agent collecte hors-ligne → données dans IndexedDB
2. Service Worker détecte retour réseau → Background Sync
3. Envoi batch vers API avec retry exponentiel
4. API répond avec conflits éventuels
5. Résolution automatique ou manuelle selon règles métier

**Gestion des conflits :**
- **Règle 1** : Last-Write-Wins pour données agent (collectes simples)
- **Règle 2** : Validation manuelle pour données critiques (alertes, stocks)
- **Règle 3** : Merge automatique pour données compatibles (audit logs)

### 5. Sécurité : MFA + JWT + TLS + Audit

**Décision :** Authentification multi-facteurs obligatoire + JWT pour sessions

**Composants de sécurité :**
- **HTTPS/TLS** : Chiffrement transport (Let's Encrypt)
- **Authentification** : Email/Password + TOTP (Google Authenticator compatible)
- **Authorization** : JWT avec claims role-based (agent, décideur, bailleur)
- **Stockage secrets** : Variables d'environnement + rotation clés JWT
- **Audit** : Journalisation exhaustive (qui, quoi, quand, où, modifications)
- **Rate Limiting** : Protection brute-force (slowapi pour FastAPI)

**Flux MFA :**
```
1. Login initial → Email + Password
2. Validation credentials → Génération OTP challenge
3. Vérification OTP → Émission JWT (exp: 24h)
4. Refresh token → JWT renouvelable (exp: 7 jours)
5. Logout → Révocation token (blacklist Redis optionnel)
```

### 6. Tâches Planifiées : APScheduler

**Décision :** APScheduler intégré à FastAPI

**Justification :**
- **Natif Python** : Pas de service externe (Celery/Redis) pour Phase 0
- **Léger** : Suffisant pour tâches simples (calcul alertes, nettoyage)
- **Évolutif** : Migration future vers Celery si besoin

**Tâches Phase 0 :**
- Calcul quotidien des alertes (2h du matin)
- Nettoyage audit logs anciens (hebdomadaire)
- Vérification intégrité données (quotidien)

### 7. Consolidation du Code : Approche "Few Files"

**Décision :** Regrouper le code en fichiers cohérents par domaine

**Justification :**
- **Phase 0 limitée** : ~10 fichiers suffisent pour la complexité actuelle
- **Lisibilité** : Fichier = domaine complet (ex: `collecte.js` contient UI + logique + store)
- **Performance** : Moins de requêtes HTTP, bundles optimisés
- **Évolution** : Split en modules quand fichiers > 500 lignes

**Seuils de split :**
- Frontend : 1 fichier par module fonctionnel (< 400 lignes/fichier cible)
- Backend : 1 fichier par service (< 300 lignes/fichier cible)
- Si dépassement → Split en sous-modules

## Risques et Atténuations

| Risque | Impact | Probabilité | Atténuation |
|--------|--------|-------------|-------------|
| JavaScript pur = code spaghetti | Élevé | Moyen | Architecture ES6 modules stricte, code review, ESLint |
| IndexedDB corruption | Moyen | Faible | Versioning schéma, migration automatique, backup serveur |
| MongoDB en prod sans DBA | Élevé | Moyen | Monitoring (MongoDB Atlas), backups automatiques, guides ops |
| MFA bloque agents terrain | Élevé | Faible | Codes de backup imprimés, support téléphonique, reset admin |
| FastAPI nouveau pour équipe | Moyen | Élevé | Formation, documentation extensive, pair programming |
| Sync hors-ligne conflits | Moyen | Moyen | Tests E2E Playwright, stratégie merge claire, logs détaillés |

## Plan de Migration

### Phase 0 (Aucune migration nécessaire - nouveau projet)
1. Mise en place infrastructure (MongoDB, FastAPI, hosting)
2. Développement itératif module par module
3. Tests E2E continus avec Playwright
4. Déploiement progressif (staging → production)

### Phases futures (1-4)
- **Principe** : Ajouter, ne pas réécrire
- **Fichiers** : Nouveaux modules au lieu de modifier existants
- **DB** : Schéma flexible MongoDB permet ajouts sans migrations
- **API** : Versioning URL (`/api/v1/`, `/api/v2/`) si breaking changes

## Décisions Prises

### ✅ Hébergement
- **Décision** : DigitalOcean ou OVH Canada
- **Justification** :
  - Souveraineté des données (serveurs au Canada)
  - Coûts maîtrisés et prévisibles
  - Support francophone disponible
  - Latence acceptable pour la région
- **Implications** :
  - Utilisation de Droplets DigitalOcean ou VPS OVH
  - Configuration manuelle ou Managed Database MongoDB
  - Backup automatisé via snapshots fournisseur

### ✅ Langues
- **Décision** : Multilingue (français et créole haïtien)
- **Justification** : Accessibilité maximale pour les agents de terrain
- **Implications** :
  - Architecture i18n dès Phase 0 (fichiers de traduction JSON)
  - Structure clés de traduction : `{ "fr": "Collecte", "ht": "Koleksyon" }`
  - Détection automatique langue navigateur avec sélecteur manuel
  - Environ +15% effort développement pour gérer 2 langues
  - Fichiers de traduction : `frontend/i18n/fr.json`, `frontend/i18n/ht.json`

### ✅ Volumétrie
- **Décision** : 50 agents, 100 collectes/jour, 700 marchés
- **Justification** : Dimensionnement initial Phase 0 (MVP)
- **Implications Infrastructure** :
  - **MongoDB** : Droplet 2 vCPU, 4 GB RAM suffisant (ou Managed Database Basic tier)
  - **Backend FastAPI** : Droplet 2 vCPU, 2 GB RAM (peut scaler à 4 GB si besoin)
  - **Stockage** : ~50 GB initialement (collectes + images + audit logs sur 2 ans)
  - **Bande passante** : ~500 GB/mois estimé (100 collectes × 30 jours × ~150 KB/collecte)
  - **Index MongoDB** : Stratégie standard suffisante, pas de sharding requis Phase 0
  - **Concurrent users** : Max 20-30 simultanés (agents terrain + décideurs)

**Calculs de capacité :**
- 100 collectes/jour × 365 jours = 36 500 collectes/an
- Si 5 produits/collecte en moyenne = 182 500 prix/an
- Taille moyenne document MongoDB : ~2 KB → ~365 MB/an données collectes
- Avec audit logs, images, metadata : ~2-3 GB/an

### ✅ Support Navigateurs
- **Décision** : Chrome 90+, Safari 14+, Firefox 88+ (navigateurs < 2 ans)
- **Justification** :
  - Couverture ~95% des utilisateurs avec appareils récents
  - Pas de polyfills lourds nécessaires (Service Worker, IndexedDB natifs)
  - ES6 modules supportés nativement
  - CSS Grid et Flexbox complets
- **Implications** :
  - Bundle JavaScript minimal (pas de Babel pour transpilation ES6 → ES5)
  - Taille totale < 200 KB maintenue
  - Tests cross-browser sur Chrome, Safari, Firefox uniquement
  - Message d'avertissement pour navigateurs obsolètes (IE11, etc.)

### ✅ Notifications Email
- **Décision** : SendGrid gratuit (100 emails/jour)
- **Justification** :
  - Tier gratuit largement suffisant pour Phase 0 (alertes Urgence uniquement)
  - ~30 alertes Urgence/mois estimées = ~1 email/jour en moyenne
  - API simple et bien documentée (Python SDK officiel)
  - Fiabilité élevée et deliverability optimisée
  - Upgrade facile si besoin (tier payant à $15/mois pour 40k emails)
- **Implications** :
  - Inscription compte SendGrid et génération API key
  - Variable d'environnement `SENDGRID_API_KEY` requise
  - Templates emails en HTML (français + créole haïtien)
  - Tracking des emails envoyés (dashboard SendGrid)
  - Dépendance Python : `sendgrid==6.10.0`

### ✅ Notifications SMS (Préparation Phase 1+)
- **Décision** : Twilio pour notifications SMS futures
- **Justification** :
  - **Phase 0** : Non implémenté (emails suffisants)
  - **Phase 1+** : SMS pour alertes critiques et notifications agents terrain
  - **Phase 4** : SMS/USSD pour chefs de village (signaux faibles crowdsourcing)
  - Twilio = standard industrie, API robuste, couverture Haïti confirmée
  - Tier gratuit : $15 crédit initial pour tests
  - Coût estimé : ~$0.05/SMS × ~500 SMS/mois = ~$25/mois en Phase 1
- **Implications** :
  - Architecture backend prête pour SMS (abstraction service notifications)
  - `backend/services/notifications.py` avec méthodes : `send_email()`, `send_sms()` (stub Phase 0)
  - Numéros téléphone stockés dans modèle User (optionnel Phase 0)
  - Activation SMS via feature flag configurable
  - Dépendance Python future : `twilio==8.10.0` (non installée Phase 0)

## Résumé des Décisions Techniques

| Décision | Choix | Coût estimé | Phase |
|----------|-------|-------------|-------|
| **Hébergement** | DigitalOcean/OVH Canada | $40-50/mois | 0 |
| **Langues** | Français + Créole haïtien | +20% effort dev | 0 |
| **Navigateurs** | Chrome 90+, Safari 14+, Firefox 88+ | Aucun (pas de polyfills) | 0 |
| **Email** | SendGrid gratuit | $0/mois (100/jour) | 0 |
| **SMS** | Twilio (préparé, non activé) | $0 Phase 0, ~$25/mois Phase 1+ | 1+ |
| **Base de données** | MongoDB 5.0+ | Inclus hébergement | 0 |
| **Volumétrie** | 50 agents, 100 collectes/j, 700 marchés | Sizing confirmé | 0 |

**Coût total mensuel Phase 0** : ~$40-50/mois (infrastructure uniquement)
