# Gestion des Produits

## ADDED Requirements

### Requirement: Référentiel des Produits
Le système SHALL maintenir un référentiel complet des produits alimentaires surveillés.

#### Scenario: Création d'un produit
- **WHEN** un utilisateur qui a les permissions requises peut créer un nouveau produit
- **THEN** les champs 
  - obligatoires sont : nom, unité de mesure, quantité, catégorie, date de saisie
  - non obligatoires sont : marché, source, niveau de l'offre, prix
  - si le prix est present alors le nom du marché est obligatoire
- **AND** un code un entier incremental est généré automatiquement
- **AND** le produit peut avoir des synonymes/noms locaux (ex: "Riz local" = "Diri nasyonal")

#### Scenario: Catégories de produits
- **WHEN** un produit est créé
- **THEN** il doit appartenir à une catégorie parmi :
  - Céréales (Riz, Maïs, Blé, etc.)
  - Légumineuses (Haricots, Pois, Lentilles, etc.)
  - Huiles et graisses
  - Sucre et édulcorants
  - Tubercules (Igname, Patate douce, Manioc, etc.)
  - Produits animaux (Viande, Poisson, Œufs, Lait, etc.)
  - Fruits et légumes
  - Autres
- **AND** la catégorie détermine certains comportements (seuils d'alerte, etc.)

#### Scenario: Unités de mesure
- **WHEN** un produit est créé
- **THEN** l'unité de mesure est choisie parmi une liste standard : kg, litre, unité, sac, marmite, etc.
- **AND** des équivalences peuvent être définies (ex: 1 sac = 50 kg)
- **AND** lors de la collecte, l'agent voit l'unité attendue (ex: "Prix du riz (par kg)")

### Requirement: Liste Standard de Produits (Phase 0)
Le système SHALL pré-configurer une liste de produits prioritaires pour la Phase 0.

#### Scenario: Produits pré-configurés
- **WHEN** le système est initialisé pour la première fois
- **THEN** les produits suivants sont créés automatiquement :
  - Riz local (kg)
  - Riz importé (kg)
  - Maïs moulu (kg)
  - Haricots noirs (marmite)
  - Haricots rouges (marmite)
  - Huile végétale (litre)
  - Sucre (kg)
  - Farine de blé (kg)
- **AND** chaque produit a un code, une catégorie et une unité

### Requirement: Gestion des Produits Actifs/Inactifs
Le système SHALL permettre d'activer ou désactiver des produits.

#### Scenario: Désactivation d'un produit
- **WHEN** un administrateur désactive un produit
- **THEN** le produit n'apparaît plus dans les formulaires de collecte
- **AND** les données historiques pour ce produit restent accessibles
- **AND** les statistiques incluent toujours ce produit pour les périodes passées

#### Scenario: Réactivation d'un produit
- **WHEN** un administrateur réactive un produit précédemment désactivé
- **THEN** le produit réapparaît immédiatement dans les sélections de collecte
- **AND** l'historique des activations/désactivations est conservé (audit)

### Requirement: Recherche et Filtrage des Produits
Le système SHALL faciliter la recherche de produits pour les agents.

#### Scenario: Recherche par nom
- **WHEN** un agent saisit un texte dans la recherche de produits
- **THEN** les produits dont le nom contient le texte (insensible à la casse) sont affichés
- **AND** les synonymes sont également pris en compte dans la recherche
- **AND** les résultats sont triés par pertinence (correspondance exacte en premier)

#### Scenario: Filtrage par catégorie
- **WHEN** un agent filtre les produits par catégorie
- **THEN** seuls les produits de la catégorie sélectionnée sont affichés
- **AND** le nombre de produits par catégorie est visible avant sélection

#### Scenario: Produits fréquemment utilisés
- **WHEN** un agent a collecté plusieurs fois les mêmes produits
- **THEN** ces produits apparaissent en tête de liste (favoris automatiques)
- **AND** l'agent peut épingler manuellement des produits en favoris
- **AND** les favoris sont synchronisés entre appareils

### Requirement: Prix de Référence et Alertes
Le système SHALL associer des prix de référence aux produits pour détecter les anomalies.

#### Scenario: Prix de référence par département
- **WHEN** un administrateur configure un produit
- **THEN** des prix de référence peuvent être définis par département (min, max, moyen)
- **AND** ces prix servent de base pour les alertes de variation anormale

#### Scenario: Détection d'anomalie à la saisie
- **WHEN** un agent saisit un prix qui dépasse +/- 50% du prix de référence départemental
- **THEN** un avertissement s'affiche : "Ce prix semble anormalement élevé/bas. Veuillez vérifier."
- **AND** l'agent peut confirmer (avec commentaire obligatoire) ou corriger

#### Scenario: Mise à jour automatique des références
- **WHEN** des collectes validées sont accumulées sur un mois
- **THEN** le système recalcule les prix de référence (médiane, min, max) par département
- **AND** les nouveaux prix de référence sont appliqués le mois suivant
- **AND** l'historique des prix de référence est conservé

### Requirement: Équivalences et Conversions
Le système SHALL gérer les équivalences entre unités de mesure.

#### Scenario: Définition d'équivalences
- **WHEN** un administrateur configure un produit
- **THEN** il peut définir des équivalences : "1 sac = 50 kg", "1 marmite = 3 kg" 
- **AND** ces équivalences sont utilisées pour normaliser les collectes

#### Scenario: Collecte avec unité alternative
- **WHEN** un agent collecte un prix exprimé dans une unité alternative (ex: sac au lieu de kg)
- **THEN** l'agent peut sélectionner l'unité alternative
- **AND** le système convertit automatiquement vers l'unité standard pour stockage
- **AND** l'unité originale est conservée dans les métadonnées

### Requirement: Export de la Liste des Produits
Le système SHALL permettre d'exporter et importer la liste des produits.

#### Scenario: Export CSV des produits
- **WHEN** un administrateur exporte la liste des produits
- **THEN** un fichier CSV est généré avec colonnes : code, nom, catégorie, unité, actif, prix_ref_min, prix_ref_max
- **AND** le fichier inclut tous les produits (actifs et inactifs)

#### Scenario: Import CSV des produits
- **WHEN** un agent importe un fichier CSV de produits
- **THEN** le système valide : codes uniques, catégories valides, unités reconnues
- **AND** les erreurs sont affichées ligne par ligne
- **AND** l'import peut être en mode "mise à jour" (modifie l'existant) ou "ajout uniquement"
