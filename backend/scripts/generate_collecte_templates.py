# -*- coding: utf-8 -*-
"""
Générer les templates Excel et CSV pour l'import de collectes
"""
import pandas as pd
from pathlib import Path
from datetime import datetime

def generate_templates():
    """Génère les fichiers templates Excel et CSV"""

    # Données d'exemple
    data = {
        'marche_nom': ['Croix-des-Bossales', 'Marché Salomon'],
        'produit_nom': ['Riz local', 'Maïs moulu'],
        'unite_nom': ['kilogramme', 'livre'],
        'quantite': [1.0, 2.0],
        'prix': [75.0, 50.0],
        'date': ['2026-02-02', '2026-02-02'],
        'periode': ['matin1', 'soir1'],
        'commentaire': ['Prix stable', 'Prix en hausse']
    }

    # Créer DataFrame
    df = pd.DataFrame(data)

    # Définir le répertoire de sortie
    output_dir = Path(__file__).parent.parent.parent / 'templates'
    output_dir.mkdir(exist_ok=True)

    # Générer Excel avec instructions
    excel_path = output_dir / 'template_collecte_prix.xlsx'
    with pd.ExcelWriter(excel_path, engine='openpyxl') as writer:
        # Feuille de données
        df.to_excel(writer, sheet_name='Données', index=False)

        # Feuille d'instructions
        instructions = pd.DataFrame({
            'Colonne': [
                'marche_nom',
                'produit_nom',
                'unite_nom',
                'quantite',
                'prix',
                'date',
                'periode',
                'commentaire'
            ],
            'Description': [
                'Nom du marché (ex: Croix-des-Bossales)',
                'Nom du produit (ex: Riz local, Maïs moulu)',
                'Nom de l\'unité de mesure (ex: kilogramme, livre, sac)',
                'Quantité mesurée (nombre décimal, ex: 1.0, 2.5)',
                'Prix en gourdes (HTG) - nombre décimal',
                'Date de la collecte au format AAAA-MM-JJ (ex: 2026-02-02)',
                'Période: matin1, matin2, soir1 ou soir2',
                'Commentaire optionnel (vide si aucun)'
            ],
            'Obligatoire': [
                'OUI', 'OUI', 'OUI', 'OUI', 'OUI', 'OUI', 'OUI', 'NON'
            ],
            'Exemple': [
                'Croix-des-Bossales',
                'Riz local',
                'kilogramme',
                '1.0',
                '75.0',
                '2026-02-02',
                'matin1',
                'Prix stable'
            ]
        })
        instructions.to_excel(writer, sheet_name='Instructions', index=False)

        # Feuille de référence - Périodes
        periodes_df = pd.DataFrame({
            'Code': ['matin1', 'matin2', 'soir1', 'soir2'],
            'Description': ['Matin 1 (6h-9h)', 'Matin 2 (9h-12h)', 'Soir 1 (12h-15h)', 'Soir 2 (15h-18h)']
        })
        periodes_df.to_excel(writer, sheet_name='Périodes', index=False)

    # Générer CSV
    csv_path = output_dir / 'template_collecte_prix.csv'
    df.to_csv(csv_path, index=False, encoding='utf-8-sig')

    print(f"Templates generes:")
    print(f"   - Excel: {excel_path}")
    print(f"   - CSV: {csv_path}")

    return excel_path, csv_path

if __name__ == '__main__':
    generate_templates()
