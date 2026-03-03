"""
Router pour l'import en masse des référentiels et entités d'administration.

Entités supportées: unites, categories, produits, departements, communes,
                    marches, permissions, roles, utilisateurs
"""
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from typing import List, Dict, Any, Optional
import pandas as pd
import io
from datetime import datetime
from bson import ObjectId

from backend.middleware.security import get_current_user
from backend.middleware.rbac import require_bailleur
from backend.database import db
from backend.services import auth as auth_service

router = APIRouter(prefix="/api/import", tags=["Import Référentiels"])

# ============================================================================
# Configuration des entités
# ============================================================================

ENTITY_CONFIG = {
    "unites": {
        "label": "Unités de mesure",
        "collection": "unites_mesure",
        "required": ["unite", "symbole"],
        "optional": [],
        "description": {
            "unite": "Nom complet de l'unité (ex: kilogramme, litre, sac)",
            "symbole": "Symbole court (ex: kg, L, sac)",
        },
        "examples": [
            {"unite": "kilogramme", "symbole": "kg"},
            {"unite": "litre", "symbole": "L"},
        ],
    },
    "categories": {
        "label": "Catégories de produits",
        "collection": "categories_produit",
        "required": ["nom"],
        "optional": ["nom_creole", "description"],
        "description": {
            "nom": "Nom de la catégorie (ex: Céréales, Fruits)",
            "nom_creole": "Nom en créole haïtien (optionnel)",
            "description": "Description de la catégorie (optionnel)",
        },
        "examples": [
            {"nom": "Céréales", "nom_creole": "Grenn", "description": "Riz, maïs, sorgho..."},
            {"nom": "Légumes", "nom_creole": "Legim", "description": ""},
        ],
    },
    "produits": {
        "label": "Produits",
        "collection": "produits",
        "required": ["nom", "code", "nom_categorie", "nom_unite"],
        "optional": ["nom_creole", "description"],
        "description": {
            "nom": "Nom du produit (ex: Riz blanc local)",
            "code": "Code unique (ex: PROD-RIZ)",
            "nom_categorie": "Nom exact de la catégorie existante (ex: Céréales)",
            "nom_unite": "Nom exact de l'unité existante (ex: kilogramme)",
            "nom_creole": "Nom en créole haïtien (optionnel)",
            "description": "Description du produit (optionnel)",
        },
        "examples": [
            {"nom": "Riz blanc local", "code": "PROD-RIZ-BL", "nom_categorie": "Céréales", "nom_unite": "kilogramme", "nom_creole": "Diri blan", "description": ""},
            {"nom": "Maïs jaune", "code": "PROD-MAIS", "nom_categorie": "Céréales", "nom_unite": "kilogramme", "nom_creole": "Mayi", "description": ""},
        ],
    },
    "departements": {
        "label": "Départements",
        "collection": "departements",
        "required": ["code", "nom"],
        "optional": ["nom_creole"],
        "description": {
            "code": "Code unique du département (ex: HT-OU)",
            "nom": "Nom du département (ex: Ouest)",
            "nom_creole": "Nom en créole haïtien (optionnel)",
        },
        "examples": [
            {"code": "HT-OU", "nom": "Ouest", "nom_creole": "Lwès"},
            {"code": "HT-ND", "nom": "Nord", "nom_creole": "Nò"},
        ],
    },
    "communes": {
        "label": "Communes",
        "collection": "communes",
        "required": ["code", "nom", "nom_departement"],
        "optional": ["type_zone", "nom_creole", "population"],
        "description": {
            "code": "Code unique de la commune",
            "nom": "Nom de la commune",
            "nom_departement": "Nom exact du département existant (ex: Ouest)",
            "type_zone": "Type de zone: urbaine, peri-urbaine ou rurale (défaut: rurale)",
            "nom_creole": "Nom en créole haïtien (optionnel)",
            "population": "Population estimée, nombre entier (optionnel)",
        },
        "examples": [
            {"code": "HT-OU-001", "nom": "Port-au-Prince", "nom_departement": "Ouest", "type_zone": "urbaine", "nom_creole": "Pòtoprens", "population": "987310"},
            {"code": "HT-ND-001", "nom": "Cap-Haïtien", "nom_departement": "Nord", "type_zone": "urbaine", "nom_creole": "Okap", "population": ""},
        ],
    },
    "marches": {
        "label": "Marchés",
        "collection": "marches",
        "required": ["nom", "nom_commune"],
        "optional": ["type_marche", "nom_creole", "code", "latitude", "longitude", "jours_ouverture", "telephone", "email"],
        "description": {
            "nom": "Nom du marché",
            "nom_commune": "Nom exact de la commune existante",
            "type_marche": "quotidien, hebdomadaire ou occasionnel (défaut: quotidien)",
            "nom_creole": "Nom en créole haïtien (optionnel)",
            "code": "Code unique (optionnel, ex: MAR-000001)",
            "latitude": "Latitude GPS, ex: 18.5432 (optionnel)",
            "longitude": "Longitude GPS, ex: -72.3388 (optionnel)",
            "jours_ouverture": "Jours séparés par ; (ex: lundi;mercredi;vendredi)",
            "telephone": "Numéro de téléphone (optionnel)",
            "email": "Email de contact (optionnel)",
        },
        "examples": [
            {"nom": "Croix-des-Bossales", "nom_commune": "Port-au-Prince", "type_marche": "quotidien", "nom_creole": "Kwadèbosal", "code": "", "latitude": "18.5432", "longitude": "-72.3388", "jours_ouverture": "lundi;mardi;mercredi;jeudi;vendredi;samedi", "telephone": "", "email": ""},
            {"nom": "Marché Salomon", "nom_commune": "Port-au-Prince", "type_marche": "hebdomadaire", "nom_creole": "", "code": "", "latitude": "", "longitude": "", "jours_ouverture": "samedi", "telephone": "", "email": ""},
        ],
    },
    "permissions": {
        "label": "Permissions",
        "collection": "permissions",
        "required": ["nom", "action"],
        "optional": ["description"],
        "description": {
            "nom": "Nom de la permission (ex: admin:unites, admin:produits:read)",
            "action": "Action: create, read, update, delete ou autre",
            "description": "Description de la permission (optionnel)",
        },
        "examples": [
            {"nom": "admin:produits:create", "action": "create", "description": "Créer des produits"},
            {"nom": "admin:produits:delete", "action": "delete", "description": "Supprimer des produits"},
        ],
    },
    "roles": {
        "label": "Rôles",
        "collection": "roles",
        "required": ["nom"],
        "optional": ["noms_permissions", "description"],
        "description": {
            "nom": "Nom du rôle (ex: Superviseur régional)",
            "noms_permissions": "Noms exacts des permissions séparés par ; (ex: admin:produits:read;admin:marches:read)",
            "description": "Description du rôle (optionnel)",
        },
        "examples": [
            {"nom": "Superviseur", "noms_permissions": "admin:produits:read;admin:marches:read", "description": "Superviseur régional"},
            {"nom": "Analyste", "noms_permissions": "", "description": "Analyste de données"},
        ],
    },
    "utilisateurs": {
        "label": "Utilisateurs",
        "collection": "users",
        "required": ["email", "password"],
        "optional": ["noms_roles", "nom", "prenom", "nom_departement", "telephone", "actif"],
        "description": {
            "email": "Adresse email unique de l'utilisateur",
            "password": "Mot de passe (minimum 8 caractères)",
            "noms_roles": "Noms exacts des rôles séparés par ; (ex: Bailleur;Agent)",
            "nom": "Nom de famille (optionnel)",
            "prenom": "Prénom (optionnel)",
            "nom_departement": "Nom exact du département d'affectation (optionnel)",
            "telephone": "Numéro de téléphone (optionnel)",
            "actif": "true ou false (défaut: true)",
        },
        "examples": [
            {"email": "superviseur@sap.ht", "password": "Superviseur123!", "noms_roles": "Bailleur", "nom": "Dupont", "prenom": "Jean", "nom_departement": "Ouest", "telephone": "509-1234-5678", "actif": "true"},
            {"email": "agent2@sap.ht", "password": "Agent456!", "noms_roles": "Agent", "nom": "Pierre", "prenom": "Marie", "nom_departement": "", "telephone": "", "actif": "true"},
        ],
    },
}


# ============================================================================
# Génération de templates
# ============================================================================

def build_template_df(entity: str) -> pd.DataFrame:
    """Construit un DataFrame template avec colonnes + lignes d'exemple."""
    config = ENTITY_CONFIG[entity]
    columns = config["required"] + config["optional"]
    examples = config["examples"]
    rows = []
    for ex in examples:
        row = {col: ex.get(col, "") for col in columns}
        rows.append(row)
    return pd.DataFrame(rows, columns=columns)


def generate_csv_template(entity: str) -> bytes:
    """Génère le contenu CSV du template."""
    df = build_template_df(entity)
    buf = io.BytesIO()
    df.to_csv(buf, index=False, encoding="utf-8-sig")
    return buf.getvalue()


def generate_excel_template(entity: str) -> bytes:
    """Génère le fichier Excel du template avec deux feuilles."""
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    from openpyxl.utils import get_column_letter
    from openpyxl.worksheet.datavalidation import DataValidation

    config = ENTITY_CONFIG[entity]
    columns = config["required"] + config["optional"]
    examples = config["examples"]

    wb = openpyxl.Workbook()

    # ── Feuille 1 : Données ──
    ws = wb.active
    ws.title = "Données"

    header_fill = PatternFill(start_color="1E6B3E", end_color="1E6B3E", fill_type="solid")
    header_font = Font(color="FFFFFF", bold=True, size=11)
    thin = Side(style="thin", color="AAAAAA")
    border = Border(left=thin, right=thin, top=thin, bottom=thin)

    # En-têtes
    for col_idx, col_name in enumerate(columns, start=1):
        cell = ws.cell(row=1, column=col_idx, value=col_name)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = border
        ws.column_dimensions[get_column_letter(col_idx)].width = max(len(col_name) + 4, 18)

    # Lignes d'exemple
    example_fill = PatternFill(start_color="F0F7F0", end_color="F0F7F0", fill_type="solid")
    for row_idx, ex in enumerate(examples, start=2):
        for col_idx, col_name in enumerate(columns, start=1):
            cell = ws.cell(row=row_idx, column=col_idx, value=ex.get(col_name, ""))
            cell.fill = example_fill
            cell.border = border

    ws.row_dimensions[1].height = 22

    # Validation données pour les colonnes enum
    enum_validations = {
        "type_zone": '"urbaine,peri-urbaine,rurale"',
        "type_marche": '"quotidien,hebdomadaire,occasionnel"',
        "actif": '"true,false"',
        "action": '"create,read,update,delete"',
    }
    for col_idx, col_name in enumerate(columns, start=1):
        if col_name in enum_validations:
            col_letter = get_column_letter(col_idx)
            dv = DataValidation(
                type="list",
                formula1=enum_validations[col_name],
                allow_blank=True,
                showErrorMessage=True,
                errorTitle="Valeur invalide",
                error=f"Choisissez une valeur dans la liste.",
            )
            ws.add_data_validation(dv)
            dv.add(f"{col_letter}2:{col_letter}1000")

    # ── Feuille 2 : Instructions ──
    ws2 = wb.create_sheet("Instructions")
    ws2.column_dimensions["A"].width = 25
    ws2.column_dimensions["B"].width = 15
    ws2.column_dimensions["C"].width = 60

    title_font = Font(bold=True, size=13, color="1E6B3E")
    ws2["A1"] = f"Instructions — Import {config['label']}"
    ws2["A1"].font = title_font
    ws2.merge_cells("A1:C1")

    ws2["A3"] = "Colonne"
    ws2["B3"] = "Obligatoire"
    ws2["C3"] = "Description"
    for cell in [ws2["A3"], ws2["B3"], ws2["C3"]]:
        cell.font = Font(bold=True)
        cell.fill = PatternFill(start_color="E0EDE0", end_color="E0EDE0", fill_type="solid")

    for row_idx, col_name in enumerate(columns, start=4):
        is_req = col_name in config["required"]
        ws2.cell(row=row_idx, column=1, value=col_name)
        ws2.cell(row=row_idx, column=2, value="Oui" if is_req else "Non")
        ws2.cell(row=row_idx, column=3, value=config["description"].get(col_name, ""))

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


# ============================================================================
# Endpoints Template
# ============================================================================

@router.get("/{entity}/template")
async def download_template(
    entity: str,
    format: str = Query("excel", description="csv ou excel"),
    current_user: dict = Depends(get_current_user)
):
    """Télécharger le template d'import pour une entité (CSV ou Excel)."""
    if entity not in ENTITY_CONFIG:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Entité '{entity}' non reconnue. Entités disponibles: {', '.join(ENTITY_CONFIG.keys())}"
        )

    config = ENTITY_CONFIG[entity]
    label_slug = entity

    if format.lower() == "csv":
        content = generate_csv_template(entity)
        media_type = "text/csv"
        filename = f"template_{label_slug}.csv"
        return StreamingResponse(
            io.BytesIO(content),
            media_type=media_type,
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    else:
        content = generate_excel_template(entity)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        filename = f"template_{label_slug}.xlsx"
        return StreamingResponse(
            io.BytesIO(content),
            media_type=media_type,
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )


# ============================================================================
# Helpers de validation / résolution
# ============================================================================

def is_empty(val) -> bool:
    """Retourne True si la valeur est vide (NaN, None, '')."""
    if val is None:
        return True
    try:
        import math
        if math.isnan(float(val)):
            return True
    except (TypeError, ValueError):
        pass
    return str(val).strip() == ""


def str_val(val, default="") -> str:
    if is_empty(val):
        return default
    return str(val).strip()


async def resolve_categorie(nom: str, row_num: int) -> str:
    doc = await db.categories_produit.find_one({"nom": {"$regex": f"^{nom}$", "$options": "i"}})
    if not doc:
        raise ValueError(f"Ligne {row_num}: Catégorie '{nom}' introuvable")
    return str(doc["_id"])


async def resolve_unite(nom: str, row_num: int) -> str:
    doc = await db.unites_mesure.find_one({"unite": {"$regex": f"^{nom}$", "$options": "i"}})
    if not doc:
        raise ValueError(f"Ligne {row_num}: Unité de mesure '{nom}' introuvable")
    return str(doc["_id"])


async def resolve_departement(nom: str, row_num: int) -> str:
    doc = await db.departements.find_one({"nom": {"$regex": f"^{nom}$", "$options": "i"}})
    if not doc:
        raise ValueError(f"Ligne {row_num}: Département '{nom}' introuvable")
    return str(doc["_id"])


async def resolve_commune(nom: str, row_num: int) -> str:
    doc = await db.communes.find_one({"nom": {"$regex": f"^{nom}$", "$options": "i"}})
    if not doc:
        raise ValueError(f"Ligne {row_num}: Commune '{nom}' introuvable")
    return str(doc["_id"])


async def resolve_permissions_list(noms_str: str, row_num: int) -> List[str]:
    if is_empty(noms_str):
        return []
    noms = [n.strip() for n in str(noms_str).split(";") if n.strip()]
    ids = []
    for nom in noms:
        doc = await db.permissions.find_one({"nom": nom})
        if not doc:
            raise ValueError(f"Ligne {row_num}: Permission '{nom}' introuvable")
        ids.append(str(doc["_id"]))
    return ids


async def resolve_roles_list(noms_str: str, row_num: int) -> List[str]:
    if is_empty(noms_str):
        return []
    noms = [n.strip() for n in str(noms_str).split(";") if n.strip()]
    ids = []
    for nom in noms:
        doc = await db.roles.find_one({"nom": nom})
        if not doc:
            raise ValueError(f"Ligne {row_num}: Rôle '{nom}' introuvable")
        ids.append(str(doc["_id"]))
    return ids


def parse_file(contents: bytes, filename: str) -> pd.DataFrame:
    """Parse CSV ou Excel en DataFrame."""
    fname = filename.lower()
    if fname.endswith(".csv"):
        return pd.read_csv(io.BytesIO(contents), encoding="utf-8-sig", dtype=str)
    elif fname.endswith(".xlsx") or fname.endswith(".xls"):
        return pd.read_excel(io.BytesIO(contents), sheet_name="Données", dtype=str)
    else:
        raise ValueError("Format de fichier non supporté. Utilisez CSV ou Excel (.xlsx, .xls)")


def check_required_columns(df: pd.DataFrame, entity: str):
    required = ENTITY_CONFIG[entity]["required"]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Colonnes obligatoires manquantes: {', '.join(missing)}"
        )


def import_response(total: int, crees: int, erreurs: List[Dict]) -> Dict:
    msg = f"Import terminé : {crees} créé(s)"
    if erreurs:
        msg += f", {len(erreurs)} erreur(s)"
    return {"message": msg, "total_lignes": total, "crees": crees, "erreurs": erreurs}


# ============================================================================
# Endpoint générique d'import
# ============================================================================

@router.post("/{entity}")
async def import_entity(
    entity: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Importer des données en masse pour une entité administrative."""
    if entity not in ENTITY_CONFIG:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Entité '{entity}' non reconnue."
        )

    # Vérifier permission bailleur
    roles = current_user.get("roles", [])
    if not roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé")

    contents = await file.read()
    try:
        df = parse_file(contents, file.filename)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    if len(df) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Le fichier est vide")

    check_required_columns(df, entity)

    # Remplacer NaN par ""
    df = df.fillna("")

    # Dispatcher vers la fonction d'import spécifique
    importers = {
        "unites": import_unites,
        "categories": import_categories,
        "produits": import_produits,
        "departements": import_departements,
        "communes": import_communes,
        "marches": import_marches,
        "permissions": import_permissions,
        "roles": import_roles,
        "utilisateurs": import_utilisateurs,
    }
    return await importers[entity](df)


# ============================================================================
# Fonctions d'import par entité
# ============================================================================

async def import_unites(df: pd.DataFrame) -> Dict:
    crees, erreurs = 0, []
    now = datetime.utcnow()
    for idx, row in df.iterrows():
        row_num = idx + 2
        try:
            unite = str_val(row.get("unite"))
            symbole = str_val(row.get("symbole"))
            if not unite:
                raise ValueError(f"Ligne {row_num}: 'unite' est requis")
            if not symbole:
                raise ValueError(f"Ligne {row_num}: 'symbole' est requis")
            existing = await db.unites_mesure.find_one({"unite": {"$regex": f"^{unite}$", "$options": "i"}})
            if existing:
                raise ValueError(f"Ligne {row_num}: Unité '{unite}' déjà existante")
            await db.unites_mesure.insert_one({"unite": unite, "symbole": symbole, "created_at": now})
            crees += 1
        except ValueError as e:
            erreurs.append({"ligne": row_num, "message": str(e)})
    return import_response(len(df), crees, erreurs)


async def import_categories(df: pd.DataFrame) -> Dict:
    crees, erreurs = 0, []
    now = datetime.utcnow()
    for idx, row in df.iterrows():
        row_num = idx + 2
        try:
            nom = str_val(row.get("nom"))
            if not nom:
                raise ValueError(f"Ligne {row_num}: 'nom' est requis")
            existing = await db.categories_produit.find_one({"nom": {"$regex": f"^{nom}$", "$options": "i"}})
            if existing:
                raise ValueError(f"Ligne {row_num}: Catégorie '{nom}' déjà existante")
            doc = {"nom": nom, "created_at": now}
            nom_creole = str_val(row.get("nom_creole"))
            if nom_creole:
                doc["nom_creole"] = nom_creole
            description = str_val(row.get("description"))
            if description:
                doc["description"] = description
            await db.categories_produit.insert_one(doc)
            crees += 1
        except ValueError as e:
            erreurs.append({"ligne": row_num, "message": str(e)})
    return import_response(len(df), crees, erreurs)


async def import_produits(df: pd.DataFrame) -> Dict:
    crees, erreurs = 0, []
    now = datetime.utcnow()
    for idx, row in df.iterrows():
        row_num = idx + 2
        try:
            nom = str_val(row.get("nom"))
            code = str_val(row.get("code"))
            nom_categorie = str_val(row.get("nom_categorie"))
            nom_unite = str_val(row.get("nom_unite"))
            if not nom:
                raise ValueError(f"Ligne {row_num}: 'nom' est requis")
            if not code:
                raise ValueError(f"Ligne {row_num}: 'code' est requis")
            if not nom_categorie:
                raise ValueError(f"Ligne {row_num}: 'nom_categorie' est requis")
            if not nom_unite:
                raise ValueError(f"Ligne {row_num}: 'nom_unite' est requis")

            existing = await db.produits.find_one({"code": code})
            if existing:
                raise ValueError(f"Ligne {row_num}: Code '{code}' déjà existant")

            id_categorie = await resolve_categorie(nom_categorie, row_num)
            id_unite_mesure = await resolve_unite(nom_unite, row_num)

            doc = {
                "nom": nom,
                "code": code,
                "id_categorie": id_categorie,
                "id_unite_mesure": id_unite_mesure,
                "actif": True,
                "created_at": now,
            }
            nom_creole = str_val(row.get("nom_creole"))
            if nom_creole:
                doc["nom_creole"] = nom_creole
            description = str_val(row.get("description"))
            if description:
                doc["description"] = description
            await db.produits.insert_one(doc)
            crees += 1
        except ValueError as e:
            erreurs.append({"ligne": row_num, "message": str(e)})
    return import_response(len(df), crees, erreurs)


async def import_departements(df: pd.DataFrame) -> Dict:
    crees, erreurs = 0, []
    now = datetime.utcnow()
    for idx, row in df.iterrows():
        row_num = idx + 2
        try:
            code = str_val(row.get("code"))
            nom = str_val(row.get("nom"))
            if not code:
                raise ValueError(f"Ligne {row_num}: 'code' est requis")
            if not nom:
                raise ValueError(f"Ligne {row_num}: 'nom' est requis")
            existing = await db.departements.find_one({"code": code})
            if existing:
                raise ValueError(f"Ligne {row_num}: Code département '{code}' déjà existant")
            doc = {"code": code, "nom": nom, "actif": True, "created_at": now}
            nom_creole = str_val(row.get("nom_creole"))
            if nom_creole:
                doc["nom_creole"] = nom_creole
            await db.departements.insert_one(doc)
            crees += 1
        except ValueError as e:
            erreurs.append({"ligne": row_num, "message": str(e)})
    return import_response(len(df), crees, erreurs)


async def import_communes(df: pd.DataFrame) -> Dict:
    crees, erreurs = 0, []
    now = datetime.utcnow()
    valid_zones = {"urbaine", "peri-urbaine", "rurale"}
    for idx, row in df.iterrows():
        row_num = idx + 2
        try:
            code = str_val(row.get("code"))
            nom = str_val(row.get("nom"))
            nom_dep = str_val(row.get("nom_departement"))
            if not code:
                raise ValueError(f"Ligne {row_num}: 'code' est requis")
            if not nom:
                raise ValueError(f"Ligne {row_num}: 'nom' est requis")
            if not nom_dep:
                raise ValueError(f"Ligne {row_num}: 'nom_departement' est requis")

            existing = await db.communes.find_one({"code": code})
            if existing:
                raise ValueError(f"Ligne {row_num}: Code commune '{code}' déjà existant")

            departement_id = await resolve_departement(nom_dep, row_num)

            type_zone = str_val(row.get("type_zone"), "rurale").lower()
            if type_zone not in valid_zones:
                raise ValueError(f"Ligne {row_num}: 'type_zone' doit être: urbaine, peri-urbaine ou rurale")

            doc = {
                "code": code,
                "nom": nom,
                "departement_id": departement_id,
                "type_zone": type_zone,
                "actif": True,
                "created_at": now,
            }
            nom_creole = str_val(row.get("nom_creole"))
            if nom_creole:
                doc["nom_creole"] = nom_creole
            pop_str = str_val(row.get("population"))
            if pop_str:
                try:
                    doc["population"] = int(float(pop_str))
                except ValueError:
                    raise ValueError(f"Ligne {row_num}: 'population' doit être un nombre entier")
            await db.communes.insert_one(doc)
            crees += 1
        except ValueError as e:
            erreurs.append({"ligne": row_num, "message": str(e)})
    return import_response(len(df), crees, erreurs)


async def import_marches(df: pd.DataFrame) -> Dict:
    crees, erreurs = 0, []
    now = datetime.utcnow()
    valid_types = {"quotidien", "hebdomadaire", "occasionnel"}
    for idx, row in df.iterrows():
        row_num = idx + 2
        try:
            nom = str_val(row.get("nom"))
            nom_commune = str_val(row.get("nom_commune"))
            if not nom:
                raise ValueError(f"Ligne {row_num}: 'nom' est requis")
            if not nom_commune:
                raise ValueError(f"Ligne {row_num}: 'nom_commune' est requis")

            commune_id = await resolve_commune(nom_commune, row_num)

            type_marche = str_val(row.get("type_marche"), "quotidien").lower()
            if type_marche not in valid_types:
                raise ValueError(f"Ligne {row_num}: 'type_marche' doit être: quotidien, hebdomadaire ou occasionnel")

            doc = {
                "nom": nom,
                "commune_id": commune_id,
                "type_marche": type_marche,
                "actif": True,
                "created_at": now,
            }
            nom_creole = str_val(row.get("nom_creole"))
            if nom_creole:
                doc["nom_creole"] = nom_creole
            code = str_val(row.get("code"))
            if code:
                doc["code"] = code
            lat = str_val(row.get("latitude"))
            if lat:
                try:
                    doc["latitude"] = float(lat)
                except ValueError:
                    raise ValueError(f"Ligne {row_num}: 'latitude' doit être un nombre décimal")
            lon = str_val(row.get("longitude"))
            if lon:
                try:
                    doc["longitude"] = float(lon)
                except ValueError:
                    raise ValueError(f"Ligne {row_num}: 'longitude' doit être un nombre décimal")
            jours_str = str_val(row.get("jours_ouverture"))
            if jours_str:
                doc["jours_ouverture"] = [j.strip() for j in jours_str.split(";") if j.strip()]
            telephone = str_val(row.get("telephone"))
            if telephone:
                doc["telephone"] = telephone
            email = str_val(row.get("email"))
            if email:
                doc["email"] = email
            await db.marches.insert_one(doc)
            crees += 1
        except ValueError as e:
            erreurs.append({"ligne": row_num, "message": str(e)})
    return import_response(len(df), crees, erreurs)


async def import_permissions(df: pd.DataFrame) -> Dict:
    crees, erreurs = 0, []
    now = datetime.utcnow()
    for idx, row in df.iterrows():
        row_num = idx + 2
        try:
            nom = str_val(row.get("nom"))
            action = str_val(row.get("action"))
            if not nom:
                raise ValueError(f"Ligne {row_num}: 'nom' est requis")
            if not action:
                raise ValueError(f"Ligne {row_num}: 'action' est requis")
            existing = await db.permissions.find_one({"nom": nom})
            if existing:
                raise ValueError(f"Ligne {row_num}: Permission '{nom}' déjà existante")
            doc = {"nom": nom, "action": action, "created_at": now}
            description = str_val(row.get("description"))
            if description:
                doc["description"] = description
            await db.permissions.insert_one(doc)
            crees += 1
        except ValueError as e:
            erreurs.append({"ligne": row_num, "message": str(e)})
    return import_response(len(df), crees, erreurs)


async def import_roles(df: pd.DataFrame) -> Dict:
    crees, erreurs = 0, []
    now = datetime.utcnow()
    for idx, row in df.iterrows():
        row_num = idx + 2
        try:
            nom = str_val(row.get("nom"))
            if not nom:
                raise ValueError(f"Ligne {row_num}: 'nom' est requis")
            existing = await db.roles.find_one({"nom": nom})
            if existing:
                raise ValueError(f"Ligne {row_num}: Rôle '{nom}' déjà existant")
            id_permissions = await resolve_permissions_list(str_val(row.get("noms_permissions")), row_num)
            doc = {"nom": nom, "id_permissions": id_permissions, "created_at": now}
            description = str_val(row.get("description"))
            if description:
                doc["description"] = description
            await db.roles.insert_one(doc)
            crees += 1
        except ValueError as e:
            erreurs.append({"ligne": row_num, "message": str(e)})
    return import_response(len(df), crees, erreurs)


async def import_utilisateurs(df: pd.DataFrame) -> Dict:
    crees, erreurs = 0, []
    now = datetime.utcnow()
    for idx, row in df.iterrows():
        row_num = idx + 2
        try:
            email = str_val(row.get("email"))
            password = str_val(row.get("password"))
            if not email:
                raise ValueError(f"Ligne {row_num}: 'email' est requis")
            if not password:
                raise ValueError(f"Ligne {row_num}: 'password' est requis")
            if len(password) < 8:
                raise ValueError(f"Ligne {row_num}: 'password' doit faire au moins 8 caractères")

            existing = await db.users.find_one({"email": email})
            if existing:
                raise ValueError(f"Ligne {row_num}: Email '{email}' déjà existant")

            roles_ids = await resolve_roles_list(str_val(row.get("noms_roles")), row_num)

            actif_str = str_val(row.get("actif"), "true").lower()
            actif = actif_str not in ("false", "0", "non", "no")

            password_hash = auth_service.hash_password(password)

            doc = {
                "email": email,
                "password_hash": password_hash,
                "roles": roles_ids,
                "actif": actif,
                "two_fa_method": "none",
                "mfa_enabled": False,
                "mfa_backup_codes": [],
                "created_at": now,
            }

            nom = str_val(row.get("nom"))
            if nom:
                doc["nom"] = nom
            prenom = str_val(row.get("prenom"))
            if prenom:
                doc["prenom"] = prenom
            telephone = str_val(row.get("telephone"))
            if telephone:
                doc["telephone"] = telephone

            nom_dep = str_val(row.get("nom_departement"))
            if nom_dep:
                dep = await db.departements.find_one({"nom": {"$regex": f"^{nom_dep}$", "$options": "i"}})
                if not dep:
                    raise ValueError(f"Ligne {row_num}: Département '{nom_dep}' introuvable")
                doc["departement_id"] = str(dep["_id"])

            await db.users.insert_one(doc)
            crees += 1
        except ValueError as e:
            erreurs.append({"ligne": row_num, "message": str(e)})
    return import_response(len(df), crees, erreurs)
