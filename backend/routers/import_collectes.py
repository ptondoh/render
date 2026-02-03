"""
Router pour l'import de collectes via CSV/Excel
"""
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, status
from typing import List, Dict, Any
import pandas as pd
import io
from datetime import datetime
from bson import ObjectId

from backend.middleware.security import get_current_user
from backend.middleware.rbac import can_submit_collectes
from backend.database import db

router = APIRouter(prefix="/api/collectes", tags=["Import Collectes"])


async def validate_and_resolve_references(row: pd.Series, row_num: int) -> Dict[str, Any]:
    """
    Valide une ligne et résout les références (marché, produit, unité)

    Returns:
        Dict avec les données validées et les IDs résolus

    Raises:
        ValueError si une validation échoue
    """
    errors = []

    # Validation marche_nom
    if pd.isna(row.get('marche_nom')) or str(row['marche_nom']).strip() == '':
        errors.append(f"Ligne {row_num}: 'marche_nom' est requis")
    else:
        marche_nom = str(row['marche_nom']).strip()
        marche = await db.marches.find_one({"nom": {"$regex": f"^{marche_nom}$", "$options": "i"}})
        if not marche:
            errors.append(f"Ligne {row_num}: Marché '{marche_nom}' introuvable")

    # Validation produit_nom
    if pd.isna(row.get('produit_nom')) or str(row['produit_nom']).strip() == '':
        errors.append(f"Ligne {row_num}: 'produit_nom' est requis")
    else:
        produit_nom = str(row['produit_nom']).strip()
        produit = await db.produits.find_one({"nom": {"$regex": f"^{produit_nom}$", "$options": "i"}})
        if not produit:
            errors.append(f"Ligne {row_num}: Produit '{produit_nom}' introuvable")

    # Validation unite_nom
    if pd.isna(row.get('unite_nom')) or str(row['unite_nom']).strip() == '':
        errors.append(f"Ligne {row_num}: 'unite_nom' est requis")
    else:
        unite_nom = str(row['unite_nom']).strip()
        unite = await db.unites_mesure.find_one({"unite": {"$regex": f"^{unite_nom}$", "$options": "i"}})
        if not unite:
            errors.append(f"Ligne {row_num}: Unité '{unite_nom}' introuvable")

    # Validation quantite
    if pd.isna(row.get('quantite')):
        errors.append(f"Ligne {row_num}: 'quantite' est requis")
    else:
        try:
            quantite = float(row['quantite'])
            if quantite <= 0:
                errors.append(f"Ligne {row_num}: 'quantite' doit être > 0")
        except (ValueError, TypeError):
            errors.append(f"Ligne {row_num}: 'quantite' doit être un nombre")

    # Validation prix
    if pd.isna(row.get('prix')):
        errors.append(f"Ligne {row_num}: 'prix' est requis")
    else:
        try:
            prix = float(row['prix'])
            if prix <= 0:
                errors.append(f"Ligne {row_num}: 'prix' doit être > 0")
        except (ValueError, TypeError):
            errors.append(f"Ligne {row_num}: 'prix' doit être un nombre")

    # Validation date
    if pd.isna(row.get('date')):
        errors.append(f"Ligne {row_num}: 'date' est requis")
    else:
        try:
            # Essayer de parser la date
            date_str = str(row['date'])
            if isinstance(row['date'], pd.Timestamp):
                date_obj = row['date'].to_pydatetime()
            else:
                date_obj = datetime.fromisoformat(date_str.split()[0])  # Prendre seulement la partie date
        except (ValueError, TypeError):
            errors.append(f"Ligne {row_num}: 'date' doit être au format AAAA-MM-JJ")

    # Validation periode
    valid_periodes = ['matin1', 'matin2', 'soir1', 'soir2']
    if pd.isna(row.get('periode')) or str(row['periode']).strip() == '':
        errors.append(f"Ligne {row_num}: 'periode' est requis")
    else:
        periode = str(row['periode']).strip().lower()
        if periode not in valid_periodes:
            errors.append(f"Ligne {row_num}: 'periode' doit être: {', '.join(valid_periodes)}")

    # S'il y a des erreurs, les lever
    if errors:
        raise ValueError("\n".join(errors))

    # Retourner les données validées avec IDs résolus
    return {
        "marche_id": str(marche["_id"]),
        "produit_id": str(produit["_id"]),
        "unite_id": str(unite["_id"]),
        "quantite": float(row['quantite']),
        "prix": float(row['prix']),
        "date": date_obj if isinstance(row['date'], pd.Timestamp) else datetime.fromisoformat(str(row['date']).split()[0]),
        "periode": str(row['periode']).strip().lower(),
        "commentaire": str(row.get('commentaire', '')).strip() if pd.notna(row.get('commentaire')) else ""
    }


@router.post("/import")
async def import_collectes(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Importer des collectes depuis un fichier CSV ou Excel

    Format attendu:
    - marche_nom: Nom du marché (ex: Croix-des-Bossales)
    - produit_nom: Nom du produit (ex: Riz local)
    - unite_nom: Nom de l'unité (ex: kilogramme)
    - quantite: Quantité mesurée (nombre)
    - prix: Prix en gourdes (nombre)
    - date: Date au format AAAA-MM-JJ
    - periode: matin1, matin2, soir1 ou soir2
    - commentaire: Texte optionnel
    """
    # Vérifier que l'utilisateur est un agent
    if not can_submit_collectes(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seuls les agents peuvent importer des collectes"
        )

    # Vérifier le type de fichier
    filename = file.filename.lower()
    if not (filename.endswith('.csv') or filename.endswith('.xlsx') or filename.endswith('.xls')):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Format de fichier non supporté. Utilisez CSV ou Excel (.xlsx, .xls)"
        )

    try:
        # Lire le fichier
        contents = await file.read()

        if filename.endswith('.csv'):
            # Lire CSV
            df = pd.read_csv(io.BytesIO(contents), encoding='utf-8-sig')
        else:
            # Lire Excel
            df = pd.read_excel(io.BytesIO(contents), sheet_name='Données')

        # Vérifier que le fichier n'est pas vide
        if len(df) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Le fichier est vide"
            )

        # Vérifier les colonnes requises
        required_columns = ['marche_nom', 'produit_nom', 'unite_nom', 'quantite', 'prix', 'date', 'periode']
        missing_columns = [col for col in required_columns if col not in df.columns]

        if missing_columns:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Colonnes manquantes: {', '.join(missing_columns)}"
            )

        # Valider et traiter chaque ligne
        validation_errors = []
        collectes_to_create = []

        for idx, row in df.iterrows():
            row_num = idx + 2  # +2 car Excel commence à 1 et il y a l'en-tête

            try:
                validated_data = await validate_and_resolve_references(row, row_num)

                # Ajouter les métadonnées
                collecte_dict = {
                    **validated_data,
                    "agent_id": current_user.id,
                    "statut": "validee",  # Auto-validation
                    "validee_at": datetime.utcnow(),
                    "created_at": datetime.utcnow(),
                    "synced_at": datetime.utcnow()
                }

                collectes_to_create.append(collecte_dict)

            except ValueError as e:
                validation_errors.append(str(e))

        # S'il y a des erreurs de validation, les retourner
        if validation_errors:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "message": "Erreurs de validation détectées",
                    "errors": validation_errors,
                    "total_lignes": len(df),
                    "lignes_valides": len(collectes_to_create),
                    "lignes_invalides": len(validation_errors)
                }
            )

        # Insérer toutes les collectes
        if collectes_to_create:
            result = await db.collectes_prix.insert_many(collectes_to_create)
            inserted_ids = [str(id) for id in result.inserted_ids]

            # Générer les alertes pour chaque collecte
            from backend.routers.alertes import generer_alertes_pour_collecte
            for collecte_id in inserted_ids:
                try:
                    await generer_alertes_pour_collecte(collecte_id)
                except Exception as e:
                    # Ne pas bloquer l'import si la génération d'alertes échoue
                    import logging
                    logging.error(f"Erreur génération alerte pour {collecte_id}: {e}")

        return {
            "message": "Import réussi",
            "total_lignes": len(df),
            "collectes_creees": len(collectes_to_create),
            "collectes_ids": inserted_ids if collectes_to_create else []
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors du traitement du fichier: {str(e)}"
        )


@router.get("/import/template")
async def download_template(
    format: str = "excel",
    current_user: dict = Depends(get_current_user)
):
    """
    Télécharger le template d'import (Excel ou CSV)

    Query params:
    - format: "excel" ou "csv" (par défaut: excel)
    """
    from fastapi.responses import FileResponse
    from pathlib import Path

    # Chemin vers les templates
    templates_dir = Path(__file__).parent.parent.parent / 'templates'

    if format.lower() == 'csv':
        file_path = templates_dir / 'template_collecte_prix.csv'
        media_type = 'text/csv'
        filename = 'template_collecte_prix.csv'
    else:
        file_path = templates_dir / 'template_collecte_prix.xlsx'
        media_type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        filename = 'template_collecte_prix.xlsx'

    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template non trouvé. Exécutez le script generate_collecte_templates.py"
        )

    return FileResponse(
        path=str(file_path),
        media_type=media_type,
        filename=filename
    )
