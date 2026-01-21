# Architecture Backend

## ADDED Requirements

### Requirement: API RESTful avec FastAPI
Le système SHALL fournir une API REST complète construite avec FastAPI et servie par Uvicorn.

#### Scenario: Documentation automatique
- **WHEN** un développeur accède à `/docs`
- **THEN** la documentation OpenAPI interactive (Swagger UI) s'affiche
- **AND** tous les endpoints sont documentés avec leurs schémas de requête/réponse
- **AND** les exemples de requêtes sont fournis pour chaque endpoint

#### Scenario: Validation automatique des requêtes
- **WHEN** un client envoie une requête avec des données invalides
- **THEN** FastAPI retourne une erreur 422 avec des détails précis sur les champs invalides
- **AND** aucune donnée invalide n'atteint la couche service

#### Scenario: Performance de l'API
- **WHEN** l'API reçoit 100 requêtes simultanées
- **THEN** le temps de réponse médian reste inférieur à 200ms
- **AND** aucune requête ne timeout avant 30 secondes

### Requirement: Architecture en Couches
Le backend SHALL suivre une architecture en couches claire (routes → services → database).

#### Scenario: Séparation des responsabilités
- **WHEN** un développeur examine le code backend
- **THEN** les routes HTTP sont définies dans `main.py` et délèguent aux services
- **AND** la logique métier est encapsulée dans les fichiers du dossier `services/`
- **AND** l'accès aux données est géré exclusivement par `database.py`

#### Scenario: Réutilisabilité de la logique métier
- **WHEN** une logique métier doit être utilisée par plusieurs endpoints
- **THEN** cette logique existe une seule fois dans un service
- **AND** les routes appellent le service sans dupliquer la logique

### Requirement: Modèles Pydantic
Le système SHALL utiliser des modèles Pydantic pour la validation et la sérialisation des données.

#### Scenario: Définition des schémas
- **WHEN** un nouveau type de données est ajouté au système
- **THEN** un modèle Pydantic correspondant est défini dans `models.py`
- **AND** le modèle inclut les validateurs nécessaires (types, contraintes)
- **AND** le modèle inclut des exemples pour la documentation

#### Scenario: Conversion automatique
- **WHEN** des données MongoDB sont renvoyées par l'API
- **THEN** les ObjectId sont automatiquement convertis en strings
- **AND** les dates sont sérialisées au format ISO 8601
- **AND** les champs sensibles (passwords) sont exclus du modèle de réponse

### Requirement: Gestion des Erreurs Standardisée
Le système SHALL retourner des erreurs HTTP standardisées avec des messages explicites.

#### Scenario: Erreur de validation
- **WHEN** une requête contient des données invalides
- **THEN** le système retourne un code 422 avec la structure : `{detail: [{loc, msg, type}]}`

#### Scenario: Ressource non trouvée
- **WHEN** une requête demande une ressource inexistante
- **THEN** le système retourne un code 404 avec `{detail: "Message explicite"}`

#### Scenario: Erreur serveur
- **WHEN** une erreur inattendue se produit
- **THEN** le système retourne un code 500 avec un message générique
- **AND** l'erreur complète est loggée côté serveur avec un identifiant unique
- **AND** l'identifiant est retourné au client pour traçabilité

### Requirement: Configuration par Variables d'Environnement
Le système SHALL charger toute sa configuration depuis des variables d'environnement.

#### Scenario: Démarrage de l'application
- **WHEN** l'application FastAPI démarre
- **THEN** toutes les configurations (DB URL, JWT secret, etc.) sont chargées depuis `.env`
- **AND** l'application refuse de démarrer si une variable obligatoire est manquante
- **AND** les secrets ne sont jamais commités dans le code source
