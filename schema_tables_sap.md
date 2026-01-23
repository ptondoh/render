# Schéma des tables - Système d'Alerte Précoce (SAP)

## Tables dynamiques (mises à jour régulières)

### **1. niveaux_securite_alimentaire** (Niveaux de sécurité alimentaire)
- annee
- mois
- code_secteur_communal
- type_zone (urbaine, péri-urbaine, rurale)
- classe_ia_zone
- taux_ia_population
- population_atteinte

### **2. donnees_socioeconomiques** (Données socio-économiques)
- annee
- mois
- code_secteur_communal
- type_zone (urbaine ou rurale)
- population
- taux_chomage
- activite_economique_principale

### **3. produits_agricoles_surveillance** (Produits agricoles à surveiller)
- code_secteur_communal
- numero_campagne
- annee (aaaa)
- debut_plantation (mmjj)
- fin_plantation (mmjj)
- debut_recolte (mmjj)
- fin_recolte (mmjj)
- id_produit
- quantite_production
- id_unite_mesure

### **5. indice_vegetation_ndvi** (Indice de végétation NDVI)
- annee
- mois
- semaine
- code_secteur_communal
- valeur_ndvi

### **6. donnees_climatiques** (Données climatiques)
- localisation_station
- date_lecture
- temperature_min_c
- temperature_max_c
- temperature_moyenne_c
- pluie_totale_mm
- humidite_moyenne_sol_gm3
- vitesse_vent_min_kmh
- vitesse_vent_max_kmh
- vitesse_vent_moyenne_kmh
- echelle_beaufort

### **7. prix_produits_locaux** (Prix des produits alimentaires locaux)
- annee
- mois
- semaine
- code_secteur_communal
- id_produit
- quantite
- id_unite_mesure
- prix_detail

### **8. prix_produits_importes** (Prix des produits alimentaires importés)
- annee
- mois
- semaine
- code_secteur_communal
- id_produit
- quantite
- id_unite_mesure
- prix_detail

### **9. taux_inflation** (Inflation - IHSI)
- annee
- mois
- taux_inflation_panier_menager
- taux_change

### **10. evenements_impacts** (Événements à impacts - drivers)
- date_debut
- date_fin
- code_secteur_communal
- type_evenement (sécheresse, inondation, cyclone, blocage chaîne d'approvisionnement, violences armées, etc.)
- impact_evenement

### **17. historique_alertes_sap** (Historique des alertes du SAP)
- date_alerte
- statut_alerte
- niveau_alerte
- details_alerte

### **18. incitatifs_agricoles** (Incitatifs agricoles)
- annee
- mois
- nom_zone
- code_secteur_communal
- nombre_beneficiaires
- id_categorie

---

## Tables statiques (référence)

### **4. calendrier_agricole** (Calendrier agricole)
- code_secteur_communal
- id_produit
- date_debut_semence
- date_fin_semence
- date_debut_recolte
- date_fin_recolte
- duree_campagne

### **11. infrastructures_irrigation** (Infrastructures agricoles et périmètres irrigués)
- *Colonnes non spécifiées - couches géographiques du CNIGS*

### **12. marches_locaux** (Marchés locaux)
- nom_marche
- code_secteur_communal
- localisation_gps
- specialites
- telephone
- email

### **13. associations_planteurs** (Associations de planteurs)
- nom_association
- code_secteur_communal
- perimetre_irrigue
- localisation
- telephone
- email

### **14. intervenants** (Intervenants)
- nom_intervenant
- type_intervenant (agence gouvernementale, ONG locale, ONG internationale)
- id_role
- capacites
- zone_intervention
- telephone
- email

### **15. zones_production_agricole** (Zones de production agricole - ZPA et PI)
- nom_zone
- fichier_delimitations (fichier à attacher séparément)
- id_produit1 (production alimentaire principale 1)
- id_produit2 (production alimentaire principale 2)
- capacites_production_approximatives

### **16. entrepots_alimentaires** (Entrepôts de produits alimentaires)
- id
- nom
- type_entrepot (privé, public, ONG, autre)
- localisation_gps
- proprietaire
- capacite
- telephone
- email
- site_web
- adresse

### **17. stocks_entrepots** (Stocks en dépôts)
- id
- id_entrepot
- id_produit
- quantite_produit
- id_unite_mesure
- date

### **18. utilisateurs** (Utilisateurs)
- id
- id_categorie_user
- id_role
- nom
- prenom
- telephone
- email

### **19. unite_mesure** (Unités de mesure)
- id
- unite
- description

### **20. categorie_user** (Catégories d'utilisateurs)
- id
- nom
- description

### **21. categorie_produit** (Catégories de produits)
- id
- nom
- description

### **22. audit** (Audit)
- id
- table
- utilisateur
- action
- date
- description

### **23. produits_marche** (Produits disponibles au marché)
- id
- id_marche
- id_produit
- quantite
- id_unite_mesure
- description

### **24. permissions** (Permissions)
- id
- nom
- action
- description

### **25. roles** (Rôles)
- id
- nom
- id_permissions (liste des permissions)
- description

### **26. produits** (Produits alimentaires)
- id
- nom
- id_categorie
- description

---

## Notes importantes

**Tables dynamiques** : Requièrent des mises à jour régulières (quotidiennes, hebdomadaires ou mensuelles)

**Tables statiques** : Données de référence mises à jour occasionnellement

**Échelle de Beaufort** : Référence pour la mesure de la vitesse du vent (0-12)
