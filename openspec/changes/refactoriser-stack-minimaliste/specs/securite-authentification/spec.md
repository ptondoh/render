# Sécurité et Authentification

## ADDED Requirements

### Requirement: Authentification Multi-Facteurs (MFA)
Le système SHALL exiger une authentification à deux facteurs pour tous les utilisateurs.

#### Scenario: Inscription avec MFA
- **WHEN** un nouvel utilisateur est créé par un administrateur
- **THEN** un secret TOTP est généré pour cet utilisateur
- **AND** un QR code est affiché pour scanner avec une application d'authentification (Google Authenticator, Authy, etc.)
- **AND** l'utilisateur SHALL vérifier son premier code OTP avant d'activer son compte

#### Scenario: Connexion avec MFA
- **WHEN** un utilisateur entre email et mot de passe valides
- **THEN** le système demande le code OTP à 6 chiffres
- **AND** le code doit être saisi dans les 30 secondes (fenêtre TOTP standard)
- **AND** après 3 tentatives OTP échouées, le compte est verrouillé pendant 15 minutes

#### Scenario: Codes de backup
- **WHEN** un utilisateur active MFA pour la première fois
- **THEN** 10 codes de backup à usage unique sont générés
- **AND** les codes sont affichés une seule fois à l'utilisateur
- **AND** l'utilisateur SHALL les télécharger ou les imprimer
- **AND** chaque code de backup peut remplacer un OTP une seule fois

### Requirement: Gestion des Sessions JWT
Le système SHALL utiliser JSON Web Tokens (JWT) pour gérer les sessions utilisateur.

#### Scenario: Émission du token après authentification
- **WHEN** un utilisateur s'authentifie avec succès (email + password + OTP)
- **THEN** un access token JWT est émis avec expiration de 24 heures
- **AND** un refresh token JWT est émis avec expiration de 7 jours
- **AND** le token contient les claims : `user_id`, `role`, `region_id`, `exp`, `iat`
- **AND** les tokens sont signés avec un secret configuré par variable d'environnement

#### Scenario: Validation du token sur requête API
- **WHEN** un client envoie une requête à un endpoint protégé
- **THEN** le token JWT est extrait du header `Authorization: Bearer <token>`
- **AND** la signature est vérifiée avec le secret serveur
- **AND** l'expiration est vérifiée
- **AND** si invalide ou expiré, une erreur 401 est retournée

#### Scenario: Refresh du token
- **WHEN** un client envoie un refresh token valide à `/api/auth/refresh`
- **THEN** un nouveau access token est émis
- **AND** l'ancien access token reste valide jusqu'à son expiration
- **AND** si le refresh token est expiré, l'utilisateur doit se reconnecter complètement

### Requirement: Contrôle d'Accès Basé sur les Rôles (RBAC)
Le système SHALL implémenter un RBAC avec trois rôles : Agent, Décideur, Bailleur.

#### Scenario: Permissions par rôle
- **WHEN** le système détermine les permissions d'un utilisateur
- **THEN** les permissions suivantes s'appliquent :
  - **Agent** : Créer collectes, lire ses propres collectes, lire produits/marchés
  - **Décideur** : Tout ce que Agent peut faire + valider collectes + voir toutes les collectes de sa région
  - **Bailleur** : Lecture seule sur toutes les données (collectes, alertes, rapports)

#### Scenario: Vérification des permissions
- **WHEN** un utilisateur tente d'accéder à une ressource
- **THEN** le système vérifie que le rôle de l'utilisateur autorise l'action
- **AND** si non autorisé, une erreur 403 Forbidden est retournée avec un message explicite

#### Scenario: Isolation territoriale
- **WHEN** un Agent ou Décideur accède à des collectes
- **THEN** seules les collectes de sa région (ou sous-régions) sont accessibles
- **AND** les requêtes sont automatiquement filtrées par `region_id` du token JWT
- **AND** les Bailleurs voient toutes les régions sans filtre

### Requirement: Chiffrement des Données Sensibles
Le système SHALL chiffrer les données sensibles au repos et en transit.

#### Scenario: Chiffrement en transit (TLS)
- **WHEN** un client communique avec l'API
- **THEN** toutes les connexions utilisent HTTPS/TLS 1.2 minimum
- **AND** les certificats sont valides et émis par une autorité reconnue (Let's Encrypt)
- **AND** les connexions HTTP sont redirigées vers HTTPS

#### Scenario: Chiffrement des mots de passe
- **WHEN** un mot de passe utilisateur est stocké
- **THEN** le mot de passe est hashé avec bcrypt (coût factor 12 minimum)
- **AND** le hash inclut un salt unique par utilisateur
- **AND** le mot de passe en clair n'est jamais stocké ni loggé

#### Scenario: Chiffrement des secrets MFA
- **WHEN** un secret TOTP est stocké en base de données
- **THEN** le secret est chiffré avec AES-256
- **AND** la clé de chiffrement est stockée dans une variable d'environnement séparée
- **AND** le secret n'est déchiffré qu'au moment de la validation OTP

### Requirement: Journalisation d'Audit Complète
Le système SHALL enregistrer toutes les actions critiques dans un journal d'audit.

#### Scenario: Enregistrement des actions
- **WHEN** un utilisateur effectue une action critique (création, modification, suppression, validation)
- **THEN** un enregistrement est créé dans la collection `audit_logs`
- **AND** l'enregistrement contient : `user_id`, `action`, `resource`, `resource_id`, `changes`, `timestamp`, `ip`
- **AND** pour les modifications, `changes` contient l'état avant et après (diff)

#### Scenario: Actions auditées
- **WHEN** le système est en fonctionnement
- **THEN** les actions suivantes sont obligatoirement auditées :
  - Connexion / Déconnexion
  - Création / Modification / Suppression de collecte
  - Validation / Rejet de collecte
  - Création / Modification d'utilisateur
  - Changement de rôle ou permissions
  - Génération d'alerte

#### Scenario: Immutabilité des logs d'audit
- **WHEN** un log d'audit est créé
- **THEN** il ne peut jamais être modifié ou supprimé (insertion uniquement)
- **AND** toute tentative de modification retourne une erreur
- **AND** les logs sont conservés pendant au moins 2 ans

#### Scenario: Consultation des logs
- **WHEN** un administrateur ou auditeur consulte les logs
- **THEN** les logs sont filtrables par utilisateur, action, date, ressource
- **AND** un export CSV est disponible
- **AND** la consultation des logs est elle-même auditée

### Requirement: Protection contre les Attaques Courantes
Le système SHALL implémenter des protections contre les attaques web classiques.

#### Scenario: Protection contre brute-force
- **WHEN** plusieurs tentatives de connexion échouent depuis une même IP
- **THEN** après 5 échecs en 15 minutes, l'IP est rate-limitée
- **AND** les tentatives suivantes retournent une erreur 429 (Too Many Requests)
- **AND** le rate-limit se reset après 1 heure

#### Scenario: Protection CORS
- **WHEN** une requête Cross-Origin est reçue
- **THEN** les headers CORS autorisent uniquement les origines configurées
- **AND** les credentials (cookies, authorization header) ne sont acceptés que des origines autorisées

#### Scenario: Protection XSS
- **WHEN** des données utilisateur sont affichées dans l'UI
- **THEN** tous les contenus sont échappés automatiquement (text content, jamais innerHTML)
- **AND** les headers CSP (Content Security Policy) sont configurés
- **AND** inline scripts sont interdits (sauf avec nonce)

#### Scenario: Protection injection SQL/NoSQL
- **WHEN** des données utilisateur sont utilisées dans une requête MongoDB
- **THEN** les paramètres sont toujours passés via le driver (jamais de concaténation)
- **AND** les opérateurs MongoDB dangereux ($where) sont désactivés
- **AND** la validation Pydantic rejette les payloads malveillants
