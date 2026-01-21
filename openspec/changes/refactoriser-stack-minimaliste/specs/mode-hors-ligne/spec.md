# Mode Hors-ligne

## ADDED Requirements

### Requirement: Service Worker pour Cache
Le système SHALL implémenter un Service Worker pour gérer le cache de l'application.

#### Scenario: Installation du Service Worker
- **WHEN** un utilisateur visite l'application pour la première fois
- **THEN** le Service Worker est enregistré automatiquement
- **AND** les ressources critiques (HTML, CSS, JS, images) sont mises en cache
- **AND** l'installation réussit même sur connexion lente

#### Scenario: Fonctionnement hors-ligne
- **WHEN** un utilisateur perd la connexion Internet
- **THEN** l'application continue de fonctionner normalement
- **AND** toutes les pages déjà visitées sont accessibles depuis le cache
- **AND** un indicateur visuel informe l'utilisateur qu'il est hors-ligne

#### Scenario: Mise à jour du cache
- **WHEN** une nouvelle version de l'application est déployée
- **THEN** le Service Worker détecte la mise à jour
- **AND** les nouvelles ressources sont téléchargées en arrière-plan
- **AND** l'utilisateur est notifié qu'une mise à jour est disponible
- **AND** l'utilisateur peut choisir de recharger ou continuer avec l'ancienne version

### Requirement: Stockage Local avec IndexedDB
Le système SHALL utiliser IndexedDB pour stocker les données collectées hors-ligne.

#### Scenario: Création du store IndexedDB
- **WHEN** l'application démarre pour la première fois
- **THEN** une base de données IndexedDB `sap-db` est créée avec version 1
- **AND** les object stores suivants existent : `collectes_queue`, `cached_markets`, `cached_products`, `user_profile`

#### Scenario: Stockage de collecte hors-ligne
- **WHEN** un agent saisit une collecte de prix alors qu'il est hors-ligne
- **THEN** la collecte est sauvegardée dans l'object store `collectes_queue`
- **AND** un identifiant temporaire unique est généré (UUID)
- **AND** un timestamp de création est enregistré
- **AND** l'interface confirme la sauvegarde locale

#### Scenario: Capacité de stockage
- **WHEN** un agent collecte des données pendant plusieurs jours hors-ligne
- **THEN** IndexedDB stocke jusqu'à 1000 collectes en attente de synchronisation
- **AND** l'application affiche l'espace disponible restant
- **AND** un avertissement est affiché si moins de 10% d'espace disponible

### Requirement: Synchronisation Automatique
Le système SHALL synchroniser automatiquement les données locales quand la connexion revient.

#### Scenario: Détection du retour en ligne
- **WHEN** la connexion Internet revient après une période hors-ligne
- **THEN** le Service Worker détecte le changement via l'événement `online`
- **AND** le processus de synchronisation démarre automatiquement dans les 5 secondes
- **AND** l'indicateur visuel passe de "hors-ligne" à "synchronisation en cours"

#### Scenario: Envoi des collectes en attente
- **WHEN** la synchronisation démarre
- **THEN** toutes les collectes dans `collectes_queue` sont envoyées à l'API par batch de 10
- **AND** chaque collecte envoyée avec succès est supprimée de la queue locale
- **AND** les collectes rejetées (erreur validation) sont marquées comme "erreur" avec le message
- **AND** la progression de la synchronisation est affichée à l'utilisateur (ex: "23/45 collectes synchronisées")

#### Scenario: Retry avec backoff exponentiel
- **WHEN** une tentative de synchronisation échoue (timeout, erreur serveur)
- **THEN** le système réessaye automatiquement après un délai
- **AND** le délai double à chaque échec (1s, 2s, 4s, 8s, jusqu'à max 60s)
- **AND** après 5 échecs consécutifs, la synchronisation s'arrête
- **AND** l'utilisateur est notifié et peut relancer manuellement

### Requirement: Gestion des Conflits
Le système SHALL gérer les conflits de synchronisation de manière prévisible.

#### Scenario: Pas de conflit (cas normal)
- **WHEN** une collecte locale est synchronisée et aucune modification serveur n'existe
- **THEN** la collecte est créée côté serveur avec succès
- **AND** l'ID temporaire local est remplacé par l'ID MongoDB
- **AND** la collecte est supprimée de la queue locale

#### Scenario: Conflit détecté (même marché/produit/date)
- **WHEN** une collecte locale est synchronisée mais une collecte similaire existe déjà côté serveur
- **THEN** le serveur retourne un conflit avec les détails des deux versions
- **AND** l'application affiche une interface de résolution de conflit à l'utilisateur
- **AND** l'utilisateur peut choisir : conserver local, conserver serveur, ou fusionner

#### Scenario: Résolution automatique pour certains types
- **WHEN** un conflit concerne des données non critiques (ex: timestamp de création)
- **THEN** la règle "last-write-wins" s'applique automatiquement
- **AND** l'utilisateur est informé de la résolution automatique dans les notifications

### Requirement: Interface de Gestion Hors-ligne
Le système SHALL fournir une interface pour gérer les données hors-ligne.

#### Scenario: Visualisation de la queue
- **WHEN** un agent accède à la section "Données en attente"
- **THEN** toutes les collectes non synchronisées sont listées
- **AND** chaque collecte affiche : marché, produit, prix, date, statut (en attente/erreur)
- **AND** le nombre total de collectes en attente est affiché dans le header

#### Scenario: Suppression manuelle
- **WHEN** un agent veut supprimer une collecte erronée de la queue
- **THEN** l'agent peut sélectionner la collecte et cliquer "Supprimer"
- **AND** une confirmation est demandée avant suppression
- **AND** la collecte est supprimée de IndexedDB après confirmation

#### Scenario: Synchronisation manuelle
- **WHEN** un agent clique sur "Synchroniser maintenant"
- **THEN** la synchronisation démarre immédiatement (même si déjà en cours)
- **AND** une barre de progression s'affiche
- **AND** un message de succès ou d'erreur s'affiche à la fin
