"""
Test de l'ajout de produit hors liste en ligne dans le tableau
"""
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from playwright.sync_api import sync_playwright
import time

def test_ajout_inline():
    """Test de l'ajout de produit en ligne dans le tableau"""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False, slow_mo=600)
        context = browser.new_context()
        page = context.new_page()

        print("=" * 70)
        print("TEST AJOUT PRODUIT EN LIGNE DANS LE TABLEAU")
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

        # Compter les produits avant
        rows_before = page.locator('tbody tr').count()
        print(f"   📊 Lignes dans le tableau: {rows_before}")

        # 5. CLIQUER SUR "AJOUTER PRODUIT"
        print("\n5️⃣  CLIQUER SUR 'AJOUTER UN PRODUIT HORS LISTE'")
        add_button = page.locator('button:has-text("Ajouter un produit hors liste")')
        add_button.click()
        time.sleep(2)

        # Vérifier qu'une nouvelle ligne apparaît dans le tableau
        rows_after = page.locator('tbody tr').count()
        print(f"   📊 Lignes après clic: {rows_after}")

        if rows_after > rows_before:
            print("   ✅ Une ligne d'ajout est apparue dans le tableau")

            # 6. VÉRIFIER LA LIGNE D'AJOUT
            print("\n6️⃣  VÉRIFICATION DE LA LIGNE D'AJOUT")

            # La dernière ligne devrait être la ligne d'ajout (fond jaune)
            add_row = page.locator('tbody tr').last

            # Compter les cellules (colonnes)
            cells = add_row.locator('td').count()
            print(f"   Nombre de colonnes: {cells}")

            # Vérifier le select de produit
            produit_select = add_row.locator('select').first
            if produit_select.count() > 0:
                print("   ✅ Select de produit trouvé")

                # Vérifier le nombre d'options
                options = produit_select.locator('option').count()
                print(f"   Produits disponibles: {options - 1}")  # -1 pour l'option vide

            # Vérifier le select d'unité
            unite_select = add_row.locator('select').nth(1)
            if unite_select.count() > 0:
                print("   ✅ Select d'unité trouvé")

                # Vérifier le nombre d'unités
                unite_options = unite_select.locator('option').count()
                print(f"   Unités disponibles: {unite_options - 1}")

            # Vérifier les inputs de prix
            inputs = add_row.locator('input[type="number"]').count()
            print(f"   Inputs de saisie: {inputs}")

            # 7. REMPLIR LA LIGNE D'AJOUT
            print("\n7️⃣  REMPLIR LA LIGNE D'AJOUT")

            # Sélectionner un produit
            produit_select.select_option(index=1)
            time.sleep(1)
            selected_text = produit_select.locator('option:checked').inner_text()
            print(f"   Produit sélectionné: {selected_text}")

            # Sélectionner une unité
            unite_select.select_option(index=1)
            time.sleep(1)
            selected_unite = unite_select.locator('option:checked').inner_text()
            print(f"   Unité sélectionnée: {selected_unite}")

            # Remplir les 4 périodes
            prix_inputs = add_row.locator('input[type="number"]').all()
            if len(prix_inputs) >= 4:
                prix_inputs[0].fill("300")  # Matin 1
                prix_inputs[1].fill("310")  # Matin 2
                prix_inputs[2].fill("320")  # Soir 1
                prix_inputs[3].fill("330")  # Soir 2
                print("   ✅ Prix saisis pour les 4 périodes")

            time.sleep(1)

            # 8. VALIDER L'AJOUT
            print("\n8️⃣  VALIDER L'AJOUT")
            validate_button = page.locator('button:has-text("Valider")')
            if validate_button.count() > 0:
                validate_button.click()
                time.sleep(3)
                print("   ✅ Produit ajouté")

                # Vérifier que la ligne est maintenant dans le tableau normal
                rows_final = page.locator('tbody tr').count()
                print(f"   📊 Lignes finales: {rows_final}")

        else:
            print("   ❌ La ligne d'ajout n'est pas apparue")

        print("\n⏸️  Navigateur ouvert 30 secondes pour inspection...")
        time.sleep(30)

        browser.close()
        print("\n✅ Test terminé")

if __name__ == "__main__":
    test_ajout_inline()
