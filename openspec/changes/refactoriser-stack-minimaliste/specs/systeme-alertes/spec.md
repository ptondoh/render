# Système d'Alertes

## ADDED Requirements

### Requirement: Niveaux d'Alerte à 4 Paliers
Le système SHALL calculer et afficher des alertes selon 4 niveaux de sévérité.

#### Scenario: Définition des niveaux
- **WHEN** le système calcule une alerte
- **THEN** le niveau est déterminé parmi :
  - **Normal** (vert) : Prix dans la fourchette normale (± 15% de la référence)
  - **Surveillance** (jaune) : Prix élevé mais tolérable (+ 15% à + 30%)
  - **Alerte** (orange) : Prix anormalement élevé (+ 30% à + 50%)
  - **Urgence** (rouge) : Crise imminente (> + 50% ou indisponibilité)

#### Scenario: Affichage visuel des niveaux
- **WHEN** un utilisateur consulte le tableau de bord
- **THEN** chaque marché ou produit affiche un badge coloré selon son niveau d'alerte
- **AND** les couleurs respectent les standards d'accessibilité (contraste suffisant)
- **AND** une icône accompagne la couleur pour les daltoniens (✓, ⚠, ⚠⚠, ✕)

### Requirement: Calcul Automatique des Alertes
Le système SHALL calculer automatiquement les alertes basées sur les collectes validées.

#### Scenario: Calcul quotidien
- **WHEN** le système exécute le job planifié quotidien (2h du matin)
- **THEN** pour chaque produit dans chaque marché :
  - Récupérer le dernier prix validé (dernière collecte validée)
  - Comparer au prix de référence régional
  - Calculer l'écart en pourcentage
  - Assigner un niveau d'alerte selon les seuils
- **AND** les alertes sont stockées dans la collection `alertes` avec timestamp

#### Scenario: Recalcul manuel
- **WHEN** un administrateur déclenche un recalcul manuel des alertes
- **THEN** le processus de calcul démarre immédiatement
- **AND** une barre de progression indique l'avancement
- **AND** à la fin, un résumé s'affiche : nb alertes par niveau, marchés affectés

### Requirement: Critères Multiples d'Alerte
Le système SHALL considérer plusieurs critères pour générer des alertes.

#### Scenario: Alerte par variation de prix
- **WHEN** le prix d'un produit augmente significativement
- **THEN** une alerte est générée avec type "PRIX_ELEVE"
- **AND** l'alerte contient : produit, marché, prix actuel, prix référence, écart %

#### Scenario: Alerte par indisponibilité
- **WHEN** un produit normalement disponible a un prix de 0 dans 3 collectes consécutives
- **THEN** une alerte "INDISPONIBLE" de niveau Urgence est générée
- **AND** l'alerte précise la durée d'indisponibilité (nb de jours)

#### Scenario: Alerte par tendance
- **WHEN** le prix d'un produit augmente régulièrement sur 7 jours consécutifs
- **THEN** une alerte "TENDANCE_HAUSSIERE" est générée même si seuils non atteints
- **AND** l'alerte affiche un graphique de la tendance

### Requirement: Dashboard des Alertes
Le système SHALL fournir un tableau de bord centralisé des alertes.

#### Scenario: Vue d'ensemble
- **WHEN** un décideur accède au dashboard des alertes
- **THEN** un résumé s'affiche :
  - Carte géographique avec marqueurs colorés par niveau d'alerte
  - Nombre total d'alertes par niveau
  - Évolution des alertes sur les 30 derniers jours (graphique)
  - Top 10 des marchés en alerte

#### Scenario: Filtrage des alertes
- **WHEN** un utilisateur filtre les alertes
- **THEN** des filtres sont disponibles : niveau, région, département, produit, type d'alerte
- **AND** les filtres sont cumulables (ET logique)
- **AND** le nombre de résultats est affiché en temps réel

#### Scenario: Détail d'une alerte
- **WHEN** un utilisateur clique sur une alerte
- **THEN** une fenêtre modale affiche :
  - Informations complètes (marché, produit, prix, écart, niveau)
  - Historique des prix du produit dans ce marché (graphique 90 jours)
  - Collectes récentes associées
  - Actions possibles (marquer comme vue, créer un événement, exporter)

### Requirement: Notifications d'Alerte
Le système SHALL notifier les parties prenantes des alertes critiques.

#### Scenario: Notification par email (Phase 0 basique)
- **WHEN** une alerte de niveau "Urgence" est générée
- **THEN** un email est envoyé aux décideurs de la région concernée
- **AND** l'email contient : niveau, produit, marché, prix, lien vers le détail
- **AND** l'email est envoyé dans les 5 minutes suivant la génération de l'alerte

#### Scenario: Notification dans l'application
- **WHEN** un décideur se connecte à l'application
- **THEN** un badge rouge s'affiche sur l'icône "Alertes" avec le nombre d'alertes non vues
- **AND** une bannière s'affiche en haut de page pour les alertes Urgence récentes (< 24h)

#### Scenario: Gestion de l'état "vue"
- **WHEN** un utilisateur consulte le détail d'une alerte
- **THEN** l'alerte est automatiquement marquée comme "vue" pour cet utilisateur
- **AND** le badge de notification se met à jour
- **AND** plusieurs utilisateurs peuvent marquer indépendamment la même alerte

### Requirement: Historique et Traçabilité des Alertes
Le système SHALL conserver un historique complet des alertes pour analyse.

#### Scenario: Conservation des alertes
- **WHEN** une alerte est générée
- **THEN** elle est conservée indéfiniment dans la collection `alertes`
- **AND** l'état de l'alerte évolue (active, résolue, fermée)
- **AND** toutes les transitions d'état sont enregistrées avec timestamp et utilisateur

#### Scenario: Résolution d'alerte
- **WHEN** la situation revient à la normale (prix < seuil pendant 3 jours consécutifs)
- **THEN** l'alerte passe automatiquement à l'état "résolue"
- **AND** la date de résolution est enregistrée
- **AND** les utilisateurs qui avaient été notifiés reçoivent une notification de résolution

#### Scenario: Export des alertes pour rapport
- **WHEN** un bailleur demande un rapport sur les alertes d'une période
- **THEN** un export CSV ou Excel peut être généré
- **AND** l'export contient : date, niveau, type, marché, produit, prix, écart, statut
- **AND** des graphiques agrégés sont inclus dans l'export Excel

### Requirement: Configuration des Seuils d'Alerte
Le système SHALL permettre aux administrateurs de configurer les seuils d'alerte.

#### Scenario: Seuils globaux par défaut
- **WHEN** le système est initialisé
- **THEN** les seuils par défaut sont :
  - Surveillance : + 15%
  - Alerte : + 30%
  - Urgence : + 50%
- **AND** ces seuils s'appliquent à tous les produits et toutes les régions sauf override

#### Scenario: Seuils spécifiques par produit
- **WHEN** un administrateur configure un produit sensible (ex: riz)
- **THEN** il peut définir des seuils spécifiques plus stricts (ex: Surveillance à +10%)
- **AND** les seuils spécifiques ont priorité sur les seuils globaux

#### Scenario: Seuils spécifiques par région
- **WHEN** une région a une volatilité des prix particulière
- **THEN** un administrateur peut définir des seuils régionaux adaptés
- **AND** les seuils régionaux ont priorité sur les seuils produits et globaux
- **AND** l'ordre de priorité est : région+produit > région > produit > global
