# Hiérarchie Territoriale

## ADDED Requirements

### Requirement: Modèle de Hiérarchie à 4 Niveaux
Le système SHALL gérer une hiérarchie territoriale complète : Département > Commune > Marché.

#### Scenario: Structure hiérarchique imbriquée
- **WHEN** un administrateur consulte la structure territoriale
- **THEN** la hiérarchie complète est affichée sous forme arborescente
- **AND** chaque niveau contient : code unique, nom, niveau supérieur (parent)
- **AND** un marché appartient obligatoirement à une commune
- **AND** une commune appartient obligatoirement à un département

#### Scenario: Codes uniques par niveau
- **WHEN** une nouvelle entité territoriale est créée
- **THEN** un identifiant numerique incrementale unique est assigne a Département,  Commune, Marché.
  - un code unique non obligatoire est assigné selon la convention local:
    - Département  (ex: DEP-001, DEP-002)
    - Commune  (ex: COM-00001)
    - Marché (ex: MAR-000001)
- **AND** les codes sont auto-générés et modifiables

### Requirement: Gestion des Départements
Le système SHALL permettre la création et gestion des départements.

#### Scenario: Création d'un département
- **WHEN** un administrateur crée un nouveau département
- **THEN** les champs obligatoires sont : nom
- **AND** un code DEP-XXX est généré automatiquement
- **AND** coordonnées géographiques (latitude/longitude du centre) non obligatoire

#### Scenario: Modification de département
- **WHEN** un administrateur change le nom du département
- **THEN** toutes les communes du département suivent le changement
- **AND** tous les marchés des communes sont réaffectés en cascade
- **AND** un log d'audit enregistre le changement avec justification

### Requirement: Gestion des Communes
Le système SHALL permettre la création et gestion des communes.

#### Scenario: Création d'une commune
- **WHEN** un administrateur crée une nouvelle commune
- **THEN** les champs obligatoires sont : nom, département parent
- **AND** un code COM-XXXXX est généré automatiquement
- **AND** des coordonnées GPS optionnelles peuvent être saisies

#### Scenario: Communes multiples avec même nom
- **WHEN** plusieurs communes portent le même nom dans des départements différents
- **THEN** le système les distingue par leur identifiant et code unique
- **AND** l'affichage inclut le département pour clarté (ex: "Port-au-Prince (DEP-001)")

### Requirement: Gestion des Marchés
Le système SHALL permettre la création et gestion des marchés.

#### Scenario: Création d'un marché
- **WHEN** un administrateur crée un nouveau marché
- **THEN** les champs obligatoires sont : nom, commune parente, type (hebdomadaire/quotidien/occasionnel)
- **AND** un code MAR-XXXXXX est généré automatiquement
- **AND** les coordonnées GPS sont obligatoires pour faciliter la géolocalisation des agents
- **AND** les jours d'ouverture peuvent être spécifiés (ex: lundi, mercredi, samedi)

#### Scenario: Marchés avec géolocalisation
- **WHEN** un agent recherche un marché à proximité
- **THEN** le système calcule la distance entre la position de l'agent et chaque marché
- **AND** les marchés sont triés par distance croissante
- **AND** les marchés à moins de 10 km sont marqués comme "À proximité"

#### Scenario: Statut actif/inactif
- **WHEN** un marché ferme définitivement ou temporairement
- **THEN** un administrateur peut marquer le marché comme inactif
- **AND** les marchés inactifs n'apparaissent plus dans les sélections de collecte
- **AND** les données historiques du marché restent accessibles en lecture

### Requirement: Navigation Hiérarchique
Le système SHALL faciliter la navigation dans la hiérarchie territoriale.

#### Scenario: Navigation descendante
- **WHEN** un utilisateur sélectionne un département
- **THEN** les communes de ce département  s'affichent
- **AND** en sélectionnant une commune, les marchés s'affichent
- **AND** le fil d'Ariane affiche le chemin complet (Département > Commune > Marché)

#### Scenario: Recherche globale
- **WHEN** un utilisateur utilise la recherche globale
- **THEN** il peut chercher par nom ou code à n'importe quel niveau
- **AND** les résultats affichent le chemin hiérarchique complet
- **AND** cliquer sur un résultat navigue vers cet élément

#### Scenario: Filtrage par niveau
- **WHEN** un décideur consulte les collectes de son département
- **THEN** il peut filtrer par département, commune, ou marché spécifique
- **AND** le filtre se rappelle de la dernière sélection
- **AND** des raccourcis sont disponibles pour "Tous les départements", "Toutes les communes"

### Requirement: Import/Export de la Hiérarchie
Le système SHALL permettre l'import et l'export de la structure territoriale.

#### Scenario: Export en CSV
- **WHEN** un administrateur exporte la hiérarchie
- **THEN** un fichier CSV est généré avec colonnes : type, code, nom, parent_code, latitude, longitude, statut
- **AND** le fichier inclut tous les niveaux dans un seul CSV
- **AND** l'encodage est UTF-8 avec BOM pour compatibilité Excel

#### Scenario: Import depuis CSV
- **WHEN** un administrateur importe un fichier CSV de hiérarchie
- **THEN** le système valide la structure (colonnes obligatoires, relations parent-enfant cohérentes)
- **AND** les erreurs de validation sont affichées ligne par ligne
- **AND** l'import peut être en mode "ajout" (ne modifie pas l'existant) ou "remplacement complet"
- **AND** un aperçu des changements est affiché avant confirmation

#### Scenario: Détection de doublons à l'import
- **WHEN** un fichier CSV contient des codes ou noms déjà existants
- **THEN** le système détecte les doublons et affiche une liste
- **AND** l'administrateur peut choisir : ignorer les doublons, remplacer, ou fusionner
