# Collecte Prix Marchés

## ADDED Requirements

### Requirement: Processus de Collecte en 4 Étapes
Le système SHALL guider l'agent à travers un processus de collecte structuré en 4 étapes.

#### Scenario: Étape 1 - Sélection du marché
- **WHEN** un agent démarre une nouvelle collecte
- **THEN** une liste des marchés de sa région s'affiche
- **AND** les marchés sont filtrables par nom ou code
- **AND** la position géographique actuelle de l'agent est affichée sur une carte (si disponible)
- **AND** après sélection, l'agent passe à l'étape 2

#### Scenario: Étape 2 - Sélection des produits
- **WHEN** un agent a sélectionné un marché
- **THEN** la liste complète des produits référencés s'affiche
- **AND** les produits sont regroupés par catégorie (céréales, légumineuses, huiles, etc.)
- **AND** l'agent peut sélectionner un ou plusieurs produits via checkboxes
- **AND** au moins 1 produit doit être sélectionné pour continuer

#### Scenario: Étape 3 - Sélection de la date
- **WHEN** un agent a sélectionné les produits
- **THEN** un sélecteur de date s'affiche (date picker)
- **AND** la date par défaut est la date du jour
- **AND** les dates futures sont désactivées
- **AND** les dates de plus de 7 jours dans le passé affichent un avertissement
- **AND** après sélection, l'agent passe à l'étape 4

#### Scenario: Étape 4 - Saisie des prix
- **WHEN** un agent arrive à l'étape de saisie
- **THEN** un formulaire affiche une ligne par produit sélectionné
- **AND** chaque ligne contient : nom produit, champ prix, unité (kg, litre, etc.)
- **AND** les champs prix acceptent uniquement des nombres décimaux positifs
- **AND** un prix de 0 est valide (produit indisponible)
- **AND** l'agent peut ajouter des commentaires optionnels par produit

### Requirement: Validation des Données de Collecte
Le système SHALL valider les données saisies avant enregistrement.

#### Scenario: Validation côté client
- **WHEN** un agent saisit un prix
- **THEN** le champ valide en temps réel que le prix est un nombre positif
- **AND** si le prix dépasse 10x la moyenne historique, un avertissement s'affiche
- **AND** l'agent peut confirmer ou corriger le prix

#### Scenario: Validation côté serveur
- **WHEN** une collecte est soumise à l'API
- **THEN** le serveur vérifie que tous les champs obligatoires sont présents
- **AND** le serveur vérifie que le marché et les produits existent
- **AND** le serveur vérifie que la date n'est pas dans le futur
- **AND** si validation échoue, une erreur 422 détaillée est retournée

#### Scenario: Détection de doublons
- **WHEN** une collecte est soumise pour un marché/produit/date déjà existant
- **THEN** le système détecte le doublon potentiel
- **AND** un avertissement est affiché à l'agent
- **AND** l'agent peut choisir : annuler, remplacer l'ancien, ou créer quand même (avec justification)

### Requirement: Support Multidevice et Géolocalisation
Le système SHALL faciliter la collecte sur mobile avec géolocalisation.

#### Scenario: Géolocalisation automatique
- **WHEN** un agent démarre une collecte sur mobile
- **THEN** l'application demande la permission de géolocalisation
- **AND** si accordée, la position GPS est capturée et associée à la collecte
- **AND** la distance entre la position et le marché sélectionné est calculée
- **AND** si distance > 5 km, un avertissement est affiché (possibilité d'erreur de saisie)

#### Scenario: Photo du marché (optionnel)
- **WHEN** un agent souhaite ajouter une photo du marché
- **THEN** l'agent peut utiliser la caméra de son téléphone ou sélectionner une image
- **AND** l'image est redimensionnée à max 1024x1024 pixels côté client
- **AND** l'image est uploadée vers le serveur et associée à la collecte
- **AND** les métadonnées EXIF (géolocalisation, timestamp) sont extraites si disponibles

#### Scenario: Interface tactile optimisée
- **WHEN** un agent utilise l'application sur smartphone
- **THEN** tous les boutons ont une taille minimale de 44x44 pixels
- **AND** les champs de saisie ont une hauteur minimale de 44 pixels
- **AND** le clavier numérique s'affiche automatiquement pour les champs prix
- **AND** la navigation entre champs se fait par toucher ou bouton "Suivant"

### Requirement: Gestion des États de Collecte
Le système SHALL gérer le cycle de vie complet d'une collecte avec états.

#### Scenario: États possibles
- **WHEN** une collecte existe dans le système
- **THEN** elle possède un des états suivants : `brouillon`, `soumise`, `validée`, `rejetée`

#### Scenario: Sauvegarde en brouillon
- **WHEN** un agent travaille sur une collecte mais ne l'a pas finalisée
- **THEN** l'agent peut sauvegarder en brouillon (localement ou sur serveur)
- **AND** le brouillon est récupérable ultérieurement pour continuer la saisie
- **AND** les brouillons de plus de 7 jours sont archivés automatiquement

#### Scenario: Soumission pour validation
- **WHEN** un agent finalise une collecte
- **THEN** le statut passe à `soumise`
- **AND** un décideur de la région est notifié
- **AND** l'agent ne peut plus modifier la collecte

#### Scenario: Validation par décideur
- **WHEN** un décideur consulte les collectes soumises
- **THEN** il peut valider ou rejeter chaque collecte
- **AND** en cas de validation, le statut passe à `validée` et la collecte est intégrée aux statistiques
- **AND** en cas de rejet, le décideur SHALL fournir un motif
- **AND** l'agent reçoit une notification du rejet avec le motif

#### Scenario: Réouverture après rejet
- **WHEN** une collecte est rejetée
- **THEN** l'agent peut la modifier et la resoumettre
- **AND** l'historique des versions est conservé (audit)
- **AND** le motif de rejet reste visible lors de la modification

### Requirement: Affichage Historique et Statistiques
Le système SHALL permettre aux agents de consulter leurs collectes passées.

#### Scenario: Liste des collectes personnelles
- **WHEN** un agent accède à "Mes collectes"
- **THEN** toutes ses collectes sont listées avec : marché, date, nb produits, statut
- **AND** la liste est triée par date décroissante par défaut
- **AND** des filtres sont disponibles : période, marché, statut

#### Scenario: Détail d'une collecte
- **WHEN** un agent clique sur une collecte dans la liste
- **THEN** le détail complet s'affiche : tous les prix, commentaires, photos, géolocalisation
- **AND** l'historique des modifications est visible (qui, quand, quoi)
- **AND** les validations/rejets sont affichés avec les décideurs concernés

#### Scenario: Statistiques personnelles
- **WHEN** un agent consulte son tableau de bord
- **THEN** les statistiques suivantes s'affichent :
  - Nombre total de collectes (ce mois, ce trimestre, cette année)
  - Taux de validation (collectes validées / soumises)
  - Marchés couverts
  - Produits collectés
- **AND** des graphiques simples illustrent l'évolution dans le temps
