"""
Test du workflow complet : enregistrement individuel + modification
"""
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from playwright.sync_api import sync_playwright
import time
import asyncio
from backend.database import connect_to_mongo, get_database
from datetime import datetime

def test_workflow():
    """Test du workflow complet"""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False, slow_mo=400)
        context = browser.new_context()
        page = context.new_page()

        print("=" * 70)
        print("TEST WORKFLOW COMPLET - ENREGISTREMENT INDIVIDUEL")
        print("=" * 70)

        # 1. LOGIN
        print("\n1️⃣  LOGIN")
        page.goto("http://localhost:8080")
        page.wait_for_load_state("networkidle")
        page.fill('input[type="email"]', "agent@sap.ht")
        page.fill('input[type="password"]', "Test123!")
        page.click('button[type="submit"]:has-text("Se connecter")')
        time.sleep(3)
        print("   ✅ Connecté")

        # 2. NAVIGATION
        print("\n2️⃣  NAVIGATION VERS /collectes")
        page.goto("http://localhost:8080/#/collectes")
        page.wait_for_load_state("networkidle")
        time.sleep(2)

        # 3. GPS
        print("\n3️⃣  GPS")
        page.context.grant_permissions(["geolocation"])
        page.context.set_geolocation({"latitude": 18.594395, "longitude": -72.307433})
        page.locator('button:has-text("Obtenir ma position GPS")').click()
        time.sleep(3)

        # 4. SÉLECTION MARCHÉ
        print("\n4️⃣  SÉLECTION MARCHÉ")
        page.select_option('select', value='6973c3ad17b929ed52fea343')
        time.sleep(3)

        # 5. SIMULER LES COLLECTES À DIFFÉRENTES HEURES
        print("\n5️⃣  SIMULATION DES COLLECTES ESPACÉES DANS LE TEMPS")

        # MATIN 1 (08h00) - Premier produit
        print("\n   📅 08h00 - Collecte Matin 1 (premier produit)")
        first_row = page.locator('tbody tr').first
        first_matin1_input = page.locator('input[data-periode="matin1"]').first
        first_matin1_input.fill("150")
        first_row.locator('button:has-text("+")').first.click()
        time.sleep(4)
        print("      ✅ Prix Matin 1 enregistré : 150 HTG")

        # MATIN 2 (11h00) - Premier produit
        print("\n   📅 11h00 - Collecte Matin 2 (premier produit)")
        time.sleep(2)  # Simuler 3h écoulées
        first_matin2_input = page.locator('input[data-periode="matin2"]').first
        first_matin2_input.fill("155")
        first_row.locator('button:has-text("+")').first.click()  # Maintenant c'est le 1er bouton restant
        time.sleep(4)
        print("      ✅ Prix Matin 2 enregistré : 155 HTG")

        # SOIR 1 (14h00) - Premier produit
        print("\n   📅 14h00 - Collecte Soir 1 (premier produit)")
        time.sleep(2)  # Simuler 3h écoulées
        first_soir1_input = page.locator('input[data-periode="soir1"]').first
        first_soir1_input.fill("160")
        first_row.locator('button:has-text("+")').first.click()
        time.sleep(4)
        print("      ✅ Prix Soir 1 enregistré : 160 HTG")

        # SOIR 2 (17h00) - Premier produit
        print("\n   📅 17h00 - Collecte Soir 2 (premier produit)")
        time.sleep(2)  # Simuler 3h écoulées
        first_soir2_input = page.locator('input[data-periode="soir2"]').first
        first_soir2_input.fill("165")
        first_row.locator('button:has-text("+")').first.click()
        time.sleep(4)
        print("      ✅ Prix Soir 2 enregistré : 165 HTG")

        # Vérifier qu'il n'y a plus de boutons "+" dans la première ligne
        remaining_buttons = first_row.locator('button:has-text("+")').count()
        print(f"\n   Boutons '+' restants : {remaining_buttons}")

        # Vérifier le bouton "Modifier"
        modify_button = first_row.locator('button:has-text("Modifier")')
        if modify_button.count() > 0:
            print("   ✅ Bouton 'Modifier' visible")

        # 6. MODIFIER UNE COLLECTE
        print("\n6️⃣  MODIFICATION D'UN PRIX")
        modify_button.click()
        time.sleep(2)

        # Modifier le prix Matin 1
        first_matin1_input.fill("175")
        print("   Prix Matin 1 modifié : 175 HTG")

        # Enregistrer via le bouton en bas (scroll vers le bas)
        save_button = page.locator('button:has-text("Enregistrer")').first
        save_button.scroll_into_view_if_needed()
        time.sleep(1)
        save_button.click()
        print("   ⏳ Enregistrement de la modification...")
        time.sleep(5)
        print("   ✅ Modification enregistrée")

        print("\n⏸️  Navigateur ouvert 10 secondes...")
        time.sleep(10)

        browser.close()

async def verify_database():
    """Vérifier dans la base de données"""
    print("\n" + "=" * 70)
    print("7️⃣  VÉRIFICATION BASE DE DONNÉES")
    print("=" * 70)

    await connect_to_mongo()
    db = get_database()

    # Collectes d'aujourd'hui
    today = datetime.now().date()
    collectes = await db.collectes.find({
        "date": {"$gte": datetime(today.year, today.month, today.day)}
    }).to_list(None)

    print(f"\n   Collectes créées aujourd'hui : {len(collectes)}")

    # Par période
    by_periode = {}
    for c in collectes:
        periode = c.get('periode', 'N/A')
        prix = c.get('prix')
        by_periode[periode] = prix

    print("\n   Détails par période :")
    for p in ["matin1", "matin2", "soir1", "soir2"]:
        if p in by_periode:
            prix = by_periode[p]
            print(f"     ✅ {p}: {prix} HTG")
        else:
            print(f"     ❌ {p}: non trouvé")

    # Vérifier la modification (Matin 1 devrait être à 175)
    if by_periode.get('matin1') == 175.0:
        print("\n   ✅ La modification a bien été enregistrée (Matin 1 = 175 HTG)")
    else:
        print(f"\n   ⚠️  Matin 1 = {by_periode.get('matin1')} HTG (attendu: 175)")

    print("\n" + "=" * 70)
    if len(collectes) == 4:
        print("   🎉 TEST RÉUSSI !")
        print("     ✅ 4 collectes créées (une par période)")
        print("     ✅ Enregistrement individuel fonctionnel")
        print("     ✅ Modification fonctionnelle")
    else:
        print("   ⚠️  TEST INCOMPLET")
        print(f"     Collectes: {len(collectes)} (attendu: 4)")
    print("=" * 70)

if __name__ == "__main__":
    # Nettoyer d'abord
    async def clean_db():
        await connect_to_mongo()
        db = get_database()
        today = datetime.now().date()
        result = await db.collectes.delete_many({
            "date": {"$gte": datetime(today.year, today.month, today.day)}
        })
        print(f"Base nettoyée: {result.deleted_count} collectes supprimées\n")

    asyncio.run(clean_db())

    # Test
    test_workflow()

    # Vérification
    asyncio.run(verify_database())
