"""
Test du tableau final avec vraies colonnes HTML
"""
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from playwright.sync_api import sync_playwright
import time

def test_tableau_final():
    """Test du tableau HTML avec 6 colonnes"""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False, slow_mo=500)
        context = browser.new_context()
        page = context.new_page()

        print("=" * 70)
        print("TEST TABLEAU FINAL - 6 COLONNES HTML")
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
        print("   ✅ GPS obtenu")

        # 4. SÉLECTION MARCHÉ
        print("\n4️⃣  SÉLECTION MARCHÉ")
        page.select_option('select', value='6973c3ad17b929ed52fea343')
        time.sleep(3)
        print("   ✅ Marché sélectionné")

        # 5. VÉRIFIER LE TABLEAU HTML
        print("\n5️⃣  VÉRIFICATION DU TABLEAU HTML")

        # Vérifier que c'est bien un tableau
        table = page.locator('table')
        if table.count() > 0:
            print("   ✅ Tableau HTML trouvé")

            # Vérifier les headers
            headers = page.locator('thead th').all()
            print(f"\n   Nombre de colonnes: {len(headers)}")

            for i, header in enumerate(headers, 1):
                header_text = header.inner_text()
                print(f"     Colonne {i}: {header_text}")

            # Vérifier les lignes de données
            rows = page.locator('tbody tr').count()
            print(f"\n   Nombre de lignes: {rows}")

            # Vérifier les inputs
            inputs_matin1 = page.locator('input[data-periode="matin1"]').count()
            print(f"   Inputs Matin 1: {inputs_matin1}")

            # Vérifier les placeholders
            first_input = page.locator('input[data-periode="matin1"]').first
            placeholder = first_input.get_attribute('placeholder')
            print(f"   Placeholder du premier input: '{placeholder}'")

        else:
            print("   ❌ Tableau HTML non trouvé")

        # 6. TESTER LA SAISIE
        print("\n6️⃣  TEST DE SAISIE")

        # Remplir quelques prix
        inputs = page.locator('input[data-periode="matin1"]').all()
        if len(inputs) >= 2:
            inputs[0].fill("150")
            inputs[1].fill("250")
            print("   ✅ Prix saisis dans Matin 1")

            inputs = page.locator('input[data-periode="soir2"]').all()
            inputs[0].fill("180")
            inputs[1].fill("280")
            print("   ✅ Prix saisis dans Soir 2")

        print("\n⏸️  Navigateur ouvert 30 secondes pour inspection visuelle...")
        print("   Vérifiez que le tableau a bien 6 colonnes distinctes")
        print("   et que les placeholders sont visibles dans les inputs vides")
        time.sleep(30)

        browser.close()
        print("\n✅ Test terminé")

if __name__ == "__main__":
    test_tableau_final()
