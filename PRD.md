# ️ Roadmap de Développement : Système National d’Alerte Précoce (SAP)

##  PHASE 0 : MVP - Le Socle de Confiance & Collecte Critique

**Objectif :** Établir la fondation sécurisée, la hiérarchie territoriale et la collecte de prix sur les marchés.

* **Architecture Géo-Administrative :**
* Implémentation de la cascade : **Département > Commune > Marché**.
* Référentiel des **Produits** (Riz, Maïs, Haricots, Huile, Sucre, etc.).


* **Sécurité & Identité (RBAC) :**
* Inscription et rôles : Agents (saisie), Décideurs (validation), Bailleurs (lecture).
* **Authentification Multi-Facteurs (MFA)** et Chiffrement TLS/AES.
* Journalisation d'audit (**Audit Logs**) pour chaque modification.


* **Module "Collecte Prix Marchés" (Hybride) :**
* Application Web optimisée mobile avec **Mode Hors-ligne (IndexedDB)**.
* Processus en 4 étapes : Sélection Marché > Produits > Date > Saisie.
* **Synchronisation Intelligente** : Queue de soumission automatique dès retour du réseau.


* **Ingestion de Base :**
* Module d'importation de fichiers structurés (**CSV, XLSX**) pour les prix historiques.


* **Alerte Basique :**
* Indicateur visuel à **4 niveaux** (Normal, Surveillance, Alerte, Urgence).



---

##  PHASE 1 : V1 - Vulnérabilité & Ingestion Partenaire

**Objectif :** Évaluer l'impact sur les ménages et automatiser les flux de données externes.

* **Module Évaluation Ménages (Sondage) :**
* Formulaire multi-pages : Composition, Actifs, Habitudes alimentaires.
* Calculateur en temps réel : **Score de Consommation Alimentaire (FCS)** et **Diversité Alimentaire (DDS)**.
* Validation par Géolocalisation et Photo de l'habitation.


* **Module d'Ingestion Partenaire Avancé :**
* Réception de fichiers structurés (**JSON**) et non-structurés (**PDF, DOCX, TXT**).
* **Mapping Dynamique** : Interface pour lier les colonnes d'un fichier partenaire aux champs SAP.
* **Accès Direct DB** : Connecteurs pour lire les données dans les bases de données partenaires.


* **Dashboard Agent :**
* Statistiques personnelles, zones de responsabilité et alertes locales.



---

##  PHASE 2 : V2 - Production, Stocks & Moteur d'Alerte

**Objectif :** Lier les prix à la disponibilité physique et automatiser l'intelligence du système.

* **Production & Infrastructures :**
* Gestion des **Zones de Production Agricole (ZPA)** et **Périmètres Irrigués (PI)**.
* Table des **Associations de planteurs** (Table 13 de vos documents).


* **Gestion des Stocks :**
* Référentiel des **Entrepôts** (Publics, Privés, ONG).
* Suivi dynamique des **Stocks en dépôts** (Table 17).


* **Automatisation :**
* Déclenchement automatique des alertes basé sur des seuils configurables (Prix > X% ou Stock < Y%).
* Notification multicanale instantanée des parties prenantes.



---

##  PHASE 3 : V3 - Flux Externes & Coordination de Réponse

**Objectif :** Anticiper via les importations et orchestrer l'aide humanitaire.

* **Observatoire des Flux :**
* Suivi des volumes d'**Importations** aux ports et frontières.
* Analyse de la corrélation : Dépendance Imports vs Production Nationale.


* **Gestion des Événements & Réponse :**
* Enregistrement des chocs (Ouragans, Sécheresses, Conflits).
*  Génération d'un plan d'action structuré.


* **Matrice de Coordination (3W) :**
* Interface "Qui fait Quoi, Où" pour les intervenants (ONG/État).
* Suivi des engagements et des capacités par zone d'intervention.



---

##  PHASE 4 : V4 - Intelligence Prédictive & Crowdsourcing

**Objectif :** Atteindre l'anticipation maximale (2-6 mois) via ML, IA et les signaux faibles.

* **Moteur de Simulation "What-if" :**
* Modélisation de l'impact d'une hausse des cours mondiaux ou d'un blocage routier sur les prix locaux.


* **Signaux Faibles (Crowdsourcing) :**
* Système d'alerte rapide par **SMS/USSD** pour les **Chefs de village** (sentinelles).


* **Analyse Prédictive IA :**
* Estimation des rendements agricoles via imagerie satellite, historique météo ou autres donnees.
* Prédiction des niveaux d'insécurité alimentaire à 3 mois ou a une periode donneées.