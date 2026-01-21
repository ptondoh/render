# Stockage des Données

## ADDED Requirements

### Requirement: MongoDB comme Base de Données Principale
Le système SHALL utiliser MongoDB pour stocker toutes les données persistantes.

#### Scenario: Connexion à la base de données
- **WHEN** l'application backend démarre
- **THEN** une connexion MongoDB est établie via Motor (driver async)
- **AND** la connexion utilise un pool de connexions configurable
- **AND** l'application vérifie la connectivité et échoue rapidement si la DB est inaccessible

#### Scenario: Collections principales créées
- **WHEN** le système est initialisé pour la première fois
- **THEN** les collections suivantes existent : `users`, `regions`, `produits`, `collectes_prix`, `audit_logs`
- **AND** les index nécessaires sont créés automatiquement

### Requirement: Schémas Flexibles avec Validation
Le système SHALL utiliser des schémas MongoDB flexibles tout en validant les données critiques.

#### Scenario: Insertion de données valides
- **WHEN** un document valide est inséré dans une collection
- **THEN** MongoDB accepte le document
- **AND** les champs obligatoires sont présents
- **AND** les types de données correspondent aux attentes

#### Scenario: Évolution du schéma
- **WHEN** une nouvelle phase du projet nécessite des champs additionnels
- **THEN** les nouveaux champs peuvent être ajoutés sans migration des documents existants
- **AND** l'application gère l'absence de ces champs dans les anciens documents

### Requirement: Indexation pour Performance
Le système SHALL créer des index MongoDB pour optimiser les requêtes fréquentes.

#### Scenario: Index sur les champs de recherche
- **WHEN** le système démarre
- **THEN** des index sont créés sur : `users.email`, `collectes_prix.date`, `collectes_prix.marche_id`, `audit_logs.timestamp`
- **AND** les requêtes de recherche utilisent ces index automatiquement

#### Scenario: Requêtes géospatiales
- **WHEN** une fonctionnalité nécessite des recherches par proximité géographique
- **THEN** un index géospatial (2dsphere) est créé sur les champs de coordonnées
- **AND** les requêtes de proximité retournent des résultats en moins de 100ms pour 10000 documents

### Requirement: Transactions pour Opérations Critiques
Le système SHALL utiliser des transactions MongoDB pour les opérations nécessitant l'atomicité.

#### Scenario: Validation de collecte avec audit
- **WHEN** un décideur valide une collecte de prix
- **THEN** l'update de la collecte ET l'insertion du log d'audit s'effectuent dans une transaction
- **AND** si l'une des opérations échoue, les deux sont annulées (rollback)

#### Scenario: Opérations simples sans transaction
- **WHEN** une opération simple (lecture, insertion unique) est effectuée
- **THEN** aucune transaction n'est utilisée (optimisation performance)

### Requirement: Gestion des ObjectId
Le système SHALL gérer correctement les ObjectId MongoDB dans toute l'application.

#### Scenario: Conversion automatique en API
- **WHEN** un document MongoDB est retourné par l'API
- **THEN** le champ `_id` (ObjectId) est converti en string
- **AND** le format JSON retourné utilise `id` au lieu de `_id` pour cohérence

#### Scenario: Validation des IDs en entrée
- **WHEN** un client envoie un ID dans une requête
- **THEN** le système valide que l'ID est un ObjectId valide
- **AND** retourne une erreur 422 si l'ID est malformé

### Requirement: Backup et Restauration
Le système SHALL supporter des mécanismes de backup et restauration de données.

#### Scenario: Backup quotidien automatique
- **WHEN** le système est en production
- **THEN** un backup complet de MongoDB est effectué chaque nuit à 2h du matin
- **AND** les backups sont conservés pendant 30 jours
- **AND** les backups sont stockés sur un système de stockage externe sécurisé

#### Scenario: Restauration après incident
- **WHEN** un administrateur lance une procédure de restauration
- **THEN** la base de données peut être restaurée à partir du dernier backup valide
- **AND** la durée de restauration est inférieure à 30 minutes pour une base < 10 Go
