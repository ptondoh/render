# Plan d'Implémentation - Refactorisation Stack Minimaliste

## 1. Configuration de l'Infrastructure

- [ ] 1.1 Installer MongoDB (local ou Docker) et créer la base de données `sap_db`
- [ ] 1.2 Créer le fichier `.env` avec variables d'environnement (DB_URL, JWT_SECRET, etc.)
- [ ] 1.3 Initialiser le projet Python avec structure de dossiers backend
- [ ] 1.4 Installer dépendances Python : FastAPI, Uvicorn, Motor, Pydantic, PyJWT, bcrypt, python-multipart, APScheduler
- [ ] 1.5 Initialiser le projet frontend avec structure de dossiers et configuration Tailwind
- [ ] 1.6 Installer dépendances Node.js (Tailwind CLI, PostCSS, Playwright pour tests)

**Validation** : `python --version`, `npm --version`, `mongod --version` retournent des versions valides

## 2. Backend - API Foundation

- [ ] 2.1 Créer `backend/main.py` avec application FastAPI de base et endpoints de santé (`/health`, `/docs`)
- [ ] 2.2 Créer `backend/config.py` pour charger variables d'environnement avec validation
- [ ] 2.3 Créer `backend/database.py` avec connexion MongoDB (Motor) et helpers de base
- [ ] 2.4 Créer `backend/models.py` avec modèles Pydantic pour User, Produit, Marché, Collecte
- [ ] 2.5 Tester connexion MongoDB et vérifier que `/docs` affiche Swagger UI

**Validation** : `uvicorn backend.main:app --reload` démarre sans erreur, `/docs` accessible

## 3. Sécurité et Authentification

- [ ] 3.1 Créer `backend/services/auth.py` : hash password (bcrypt), génération JWT
- [ ] 3.2 Créer endpoints `/api/auth/register` et `/api/auth/login` (sans MFA pour l'instant)
- [ ] 3.3 Créer middleware d'authentification JWT dans `backend/middleware/security.py`
- [ ] 3.4 Implémenter génération et validation TOTP pour MFA
- [ ] 3.5 Ajouter endpoints `/api/auth/mfa/setup` et `/api/auth/mfa/verify`
- [ ] 3.6 Créer middleware RBAC pour vérifier les rôles (agent, décideur, bailleur)
- [ ] 3.7 Créer `backend/middleware/audit.py` pour journalisation automatique des actions

**Validation** : Tests Playwright pour login complet avec MFA, vérification JWT, logs audit créés

## 4. Hiérarchie Territoriale

- [ ] 4.1 Créer modèles Pydantic pour Région, Département, Commune, Marché dans `models.py`
- [ ] 4.2 Créer `backend/services/hierarchie.py` avec CRUD complet pour chaque niveau
- [ ] 4.3 Créer endpoints API `/api/regions`, `/api/departements`, `/api/communes`, `/api/marches`
- [ ] 4.4 Implémenter génération automatique des codes (REG-XX, DEP-XXX, etc.)
- [ ] 4.5 Créer index MongoDB sur codes et champs parent pour performance
- [ ] 4.6 Implémenter recherche hiérarchique et navigation descendante
- [ ] 4.7 Créer script d'initialisation pour données territoriales de base (si disponibles)

**Validation** : Tests API pour créer/lire/modifier hiérarchie complète, vérifier contraintes parent-enfant

## 5. Gestion des Produits

- [ ] 5.1 Créer modèle Pydantic pour Produit avec catégories et unités
- [ ] 5.2 Créer `backend/services/produits.py` avec CRUD produits
- [ ] 5.3 Créer endpoints API `/api/produits` (GET, POST, PUT, DELETE)
- [ ] 5.4 Implémenter système de prix de référence par région
- [ ] 5.5 Créer script d'initialisation pour les 8 produits prioritaires de Phase 0
- [ ] 5.6 Implémenter recherche de produits (nom, catégorie, actif/inactif)

**Validation** : Tests API pour CRUD produits, vérifier initialisation produits Phase 0

## 6. Frontend - Architecture de Base

- [ ] 6.1 Créer `frontend/index.html` avec structure HTML5 et liens vers CSS/JS
- [ ] 6.2 Créer `frontend/app.js` avec routeur SPA basique (hash routing ou History API)
- [ ] 6.3 Configurer Tailwind CSS dans `tailwind.config.js` et compiler vers `styles.css`
- [ ] 6.4 Créer `frontend/modules/ui.js` avec composants réutilisables (Button, Input, Card, Modal, etc.)
- [ ] 6.5 Créer `frontend/modules/auth.js` pour gestion login/logout, stockage JWT (localStorage)
- [ ] 6.6 Créer pages de base : Login, Dashboard, 404

**Validation** : Navigation entre pages fonctionne, styles Tailwind appliqués, responsive sur mobile

## 7. Internationalisation (i18n) - Français & Créole Haïtien

- [ ] 7.1 Créer structure i18n : `frontend/i18n/fr.json` et `frontend/i18n/ht.json`
- [ ] 7.2 Créer `frontend/modules/i18n.js` avec fonctions de traduction (t(), setLanguage(), getCurrentLanguage())
- [ ] 7.3 Implémenter détection automatique de la langue du navigateur (avec fallback français)
- [ ] 7.4 Créer sélecteur de langue dans le header (drapeaux FR/HT cliquables)
- [ ] 7.5 Traduire toutes les chaînes de l'interface : labels, boutons, messages d'erreur, tooltips
- [ ] 7.6 Traduire les 8 produits Phase 0 en créole (Riz local → Diri lokal, etc.)
- [ ] 7.7 Stocker préférence langue dans localStorage pour persistance entre sessions
- [ ] 7.8 Tester changement de langue à chaud (sans rechargement page)

**Validation** : Application complètement fonctionnelle en français et créole haïtien, changement langue instantané

## 8. Mode Hors-ligne - IndexedDB et Service Worker

- [ ] 7.1 Créer `frontend/modules/db.js` avec wrapper IndexedDB (stores: collectes_queue, cached_markets, cached_products)
- [ ] 7.2 Créer `frontend/sw.js` (Service Worker) avec stratégie de cache (Cache First pour assets, Network First pour API)
- [ ] 7.3 Implémenter enregistrement Service Worker dans `app.js` au chargement
- [ ] 7.4 Créer `frontend/modules/sync.js` pour synchronisation automatique
- [ ] 7.5 Implémenter détection online/offline et affichage indicateur visuel
- [ ] 7.6 Tester fonctionnement complet hors-ligne (navigation, lecture cache, sauvegarde IndexedDB)

**Validation** : Tests Playwright en mode offline, vérifier cache fonctionne, données sauvegardées dans IndexedDB

## 8. Module Collecte Prix Marchés

- [ ] 8.1 Créer `backend/services/collecte.py` avec CRUD pour collectes de prix
- [ ] 8.2 Créer endpoints API `/api/collectes` avec filtres (marché, agent, date, statut)
- [ ] 8.3 Créer `frontend/modules/collecte.js` pour UI de collecte en 4 étapes
- [ ] 8.4 Étape 1 : Sélection marché avec recherche et géolocalisation (si autorisée)
- [ ] 8.5 Étape 2 : Sélection produits avec filtres par catégorie
- [ ] 8.6 Étape 3 : Sélection date avec date picker
- [ ] 8.7 Étape 4 : Saisie prix avec validation temps réel
- [ ] 8.8 Implémenter sauvegarde hors-ligne dans IndexedDB si pas de réseau
- [ ] 8.9 Implémenter soumission en ligne avec gestion des erreurs
- [ ] 8.10 Implémenter workflow validation (Agent soumet → Décideur valide/rejette)
- [ ] 8.11 Créer page "Mes collectes" avec liste et détails

**Validation** : Tests E2E pour collecte complète online et offline, validation/rejet par décideur

## 9. Synchronisation Hors-ligne

- [ ] 9.1 Implémenter détection retour en ligne et déclenchement auto-sync
- [ ] 9.2 Implémenter envoi par batch (10 collectes à la fois) avec retry exponentiel
- [ ] 9.3 Créer endpoint API `/api/collectes/sync` pour recevoir batches et détecter conflits
- [ ] 9.4 Implémenter résolution de conflits côté serveur (last-write-wins pour Phase 0)
- [ ] 9.5 Créer UI de résolution manuelle pour conflits complexes
- [ ] 9.6 Créer page "Données en attente" pour visualiser queue de synchronisation
- [ ] 9.7 Ajouter bouton "Synchroniser maintenant" avec barre de progression

**Validation** : Tests E2E pour synchronisation après période hors-ligne, gestion conflits

## 10. Système d'Alertes

- [ ] 10.1 Créer `backend/services/alertes.py` avec logique de calcul des alertes
- [ ] 10.2 Implémenter calcul d'écart de prix vs référence et assignation de niveau (Normal, Surveillance, Alerte, Urgence)
- [ ] 10.3 Créer endpoint API `/api/alertes` pour lire les alertes avec filtres
- [ ] 10.4 Configurer APScheduler dans `backend/scheduler.py` pour job quotidien (2h du matin)
- [ ] 10.5 Créer job de calcul automatique des alertes et stockage dans collection `alertes`
- [ ] 10.6 Créer dashboard frontend des alertes avec carte géographique et filtres
- [ ] 10.7 Implémenter affichage visuel des niveaux (couleurs + icônes accessibles)
- [ ] 10.8 Créer `backend/services/notifications.py` avec abstraction email/SMS (architecture extensible)
- [ ] 10.9 Intégrer SendGrid : installer SDK Python, configurer API key, créer templates emails (FR/HT)
- [ ] 10.10 Implémenter envoi email pour alertes Urgence via SendGrid (avec retry et logging)
- [ ] 10.11 Créer stubs pour SMS (Twilio) - méthode `send_sms()` non implémentée, retourne NotImplementedError
- [ ] 10.12 Créer interface de configuration des seuils d'alerte (admin uniquement)
- [ ] 10.13 Tester notifications email : alertes Urgence déclenchent emails aux décideurs concernés

**Validation** : Job scheduler s'exécute, alertes générées correctement, dashboard affiche alertes, emails envoyés

## 11. Dashboard et Statistiques

- [ ] 11.1 Créer endpoint `/api/stats/dashboard` pour statistiques agent (nb collectes, taux validation, etc.)
- [ ] 11.2 Créer endpoint `/api/stats/region` pour statistiques décideur (collectes région, alertes, etc.)
- [ ] 11.3 Créer page dashboard agent avec graphiques simples (Chart.js ou bibliothèque légère)
- [ ] 11.4 Créer page dashboard décideur avec vue régionale et alertes prioritaires
- [ ] 11.5 Créer page dashboard bailleur avec vue globale et exports

**Validation** : Dashboards affichent données correctes, graphiques responsive

## 12. Import/Export de Données

- [ ] 12.1 Créer endpoint `/api/import/hierarchie` pour import CSV de hiérarchie territoriale
- [ ] 12.2 Créer endpoint `/api/import/produits` pour import CSV de produits
- [ ] 12.3 Créer endpoint `/api/import/prix-historiques` pour import XLSX de prix historiques
- [ ] 12.4 Implémenter validation et détection doublons pour chaque type d'import
- [ ] 12.5 Créer endpoints `/api/export/*` pour exports CSV de toutes les entités
- [ ] 12.6 Créer UI d'import avec upload fichier, preview, et confirmation

**Validation** : Tests d'import avec fichiers valides et invalides, exports génèrent CSV corrects

## 13. Tests End-to-End avec Playwright

- [ ] 13.1 Configurer Playwright dans `backend/tests/playwright.config.js`
- [ ] 13.2 Créer tests E2E pour parcours complet : inscription → login MFA → collecte → validation
- [ ] 13.3 Créer tests E2E pour mode hors-ligne : collecte offline → sync online
- [ ] 13.4 Créer tests E2E pour alertes : génération automatique → consultation → résolution
- [ ] 13.5 Créer tests E2E pour RBAC : vérifier accès selon rôles
- [ ] 13.6 Configurer CI pour exécuter tests automatiquement (GitHub Actions ou équivalent)

**Validation** : Tous les tests Playwright passent en vert, couverture > 80% des scénarios critiques

## 14. Documentation et Déploiement

- [ ] 14.1 Rédiger README.md avec instructions d'installation locale (prérequis, setup, lancement)
- [ ] 14.2 Rédiger guide utilisateur (PDF) pour agents de terrain
- [ ] 14.3 Rédiger guide administrateur pour configuration initiale (hiérarchie, produits, utilisateurs)
- [ ] 14.4 Créer Dockerfile pour backend Python
- [ ] 14.5 Créer docker-compose.yml pour stack complet (MongoDB + Backend + Frontend)
- [ ] 14.6 Tester déploiement complet via Docker sur environnement de staging
- [ ] 14.7 Configurer HTTPS/TLS avec Let's Encrypt (certbot)
- [ ] 14.8 Configurer backups automatiques MongoDB (script cron ou MongoDB Atlas)

**Validation** : Application déployable en 1 commande (`docker-compose up`), accessible en HTTPS

## 15. Optimisations et Polish Final

- [ ] 15.1 Optimiser bundle JavaScript (minification, tree-shaking si applicable)
- [ ] 15.2 Optimiser images et assets (compression, formats modernes WebP)
- [ ] 15.3 Vérifier performance Lighthouse (score > 90 pour Performance, Accessibility, Best Practices)
- [ ] 15.4 Tester sur vrais appareils mobiles (Android, iOS si disponible)
- [ ] 15.5 Vérifier accessibilité (navigation clavier, lecteurs d'écran)
- [ ] 15.6 Corriger tous les bugs identifiés durant les tests
- [ ] 15.7 Préparer démo pour validation utilisateurs finaux (agents, décideurs)

**Validation** : Application fluide sur mobile 3G, scores Lighthouse > 90, zéro bug bloquant

---

## Notes d'Implémentation

### Dépendances

Le projet nécessite les dépendances suivantes dans `requirements.txt` (Python) :
```
fastapi==0.104.1
uvicorn[standard]==0.24.0
motor==3.3.2
pydantic==2.5.0
pydantic-settings==2.1.0
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.6
pyotp==2.9.0
qrcode==7.4.2
APScheduler==3.10.4
sendgrid==6.10.0
# twilio==8.10.0  # Phase 1+ uniquement, commenté pour Phase 0
```

Le projet nécessite les dépendances suivantes dans `package.json` (Node.js - outillage uniquement) :
```json
{
  "devDependencies": {
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.32",
    "autoprefixer": "^10.4.16",
    "@playwright/test": "^1.40.0"
  }
}
```

### Ordre des Tâches

Les sections peuvent être travaillées en parallèle selon les dépendances :
- **Sections 1-2** : Séquentiel (infrastructure d'abord)
- **Sections 3-5** : Séquentiel côté backend
- **Section 6** : Peut démarrer après section 1
- **Section 7** : i18n - Peut démarrer après section 6.1-6.2
- **Section 8** : Mode hors-ligne - Peut démarrer après section 6
- **Sections 9-11** : Nécessitent sections 2-8 complètes
- **Sections 12-15** : Finalisations séquentielles

### Estimation de Charge

- **Phase Setup (1-2)** : 1-2 jours
- **Phase Backend Core (3-5)** : 3-5 jours
- **Phase Frontend Core (6-7)** : 4-5 jours (i18n français/créole)
- **Phase Mode Hors-ligne (8)** : 2-3 jours
- **Phase Fonctionnalités Métier (9-11)** : 6-8 jours (alertes + notifications SendGrid)
- **Phase Finalisation (12-15)** : 4-5 jours

**Total estimé** : 20-28 jours de développement pour 1 développeur full-stack expérimenté

### Décisions Prises

✅ **Hébergement** : DigitalOcean ou OVH Canada
✅ **Langues** : Multilingue (français et créole haïtien)
✅ **Volumétrie** : 50 agents, 100 collectes/jour, 700 marchés

### Dimensionnement Infrastructure (basé sur volumétrie)

**DigitalOcean Droplets recommandés :**
- **MongoDB** : Droplet 2 vCPU / 4 GB RAM / 80 GB SSD (~$24/mois) OU Managed Database Basic ($15/mois)
- **Backend FastAPI** : Droplet 2 vCPU / 2 GB RAM / 50 GB SSD (~$18/mois)
- **Frontend** : Servi par Backend FastAPI (fichiers statiques) ou CDN séparé (optionnel)
- **Total estimé** : ~$40-50/mois pour infrastructure complète

**Configuration OVH alternative :**
- VPS Comfort : 2 vCPU / 4 GB RAM / 80 GB SSD (~€9/mois) pour MongoDB
- VPS Value : 1 vCPU / 2 GB RAM / 40 GB SSD (~€5/mois) pour Backend
- **Total estimé** : ~€15-20/mois (~$20-25 CAD)

**Stockage prévu :**
- Année 1 : ~3-5 GB (collectes + audit logs + images)
- Année 2 : ~8-10 GB cumulé
- Backups : 3x taille DB (snapshots quotidiens)

### Décisions Techniques Finales

Toutes les décisions ont été prises et intégrées :

✅ **Hébergement** : DigitalOcean ou OVH Canada
✅ **Langues** : Multilingue (français + créole haïtien)
✅ **Volumétrie** : 50 agents, 100 collectes/jour, 700 marchés
✅ **Navigateurs** : Chrome 90+, Safari 14+, Firefox 88+ (< 2 ans)
✅ **Email** : SendGrid gratuit (100 emails/jour)
✅ **SMS** : Twilio (architecture préparée, activation Phase 1+)

**Coût mensuel estimé Phase 0** : ~$40-50 USD (infrastructure seule)
