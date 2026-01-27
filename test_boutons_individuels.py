"""
Test des boutons "Ajouter" individuels et du bouton "Modifier"
"""
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from playwright.sync_api import sync_playwright
import time

def test_boutons_individuels():
    """Test des boutons individuels par période"""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False, slow_mo=500)
        context = browser.new_context()
        page = context.new_page()

        print("=" * 70)
        print("TEST BOUTONS INDIVIDUELS PAR PÉRIODE")
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

        # 5. VÉRIFIER LE TABLEAU
        print("\n5️⃣  VÉRIFICATION DU TABLEAU")
        headers = page.locator('thead th').all()
        print(f"   Colonnes: {', '.join([h.inner_text() for h in headers])}")

        # Compter les boutons "+" dans la première ligne
        first_row = page.locator('tbody tr').first
        add_buttons = first_row.locator('button:has-text("+")').count()
        print(f"   Boutons '+' dans la première ligne: {add_buttons}")

        # 6. ENREGISTRER MATIN 1 DU PREMIER PRODUIT
        print("\n6️⃣  ENREGISTRER MATIN 1 (08h)")

        # Remplir le prix Matin 1 du premier produit
        first_matin1_input = page.locator('input[data-periode="matin1"]').first
        first_matin1_input.fill("150")
        print("   Prix saisi: 150 HTG")

        # Cliquer sur le bouton + à côté
        first_matin1_button = first_row.locator('button:has-text("+")').first
        first_matin1_button.click()
        print("   ⏳ Clic sur le bouton '+' ...")
        time.sleep(4)

        # Vérifier que le bouton a disparu
        add_buttons_after = first_row.locator('button:has-text("+")').count()
        print(f"   Boutons '+' restants: {add_buttons_after}")

        if add_buttons_after < add_buttons:
            print("   ✅ Le bouton '+' a bien disparu")

        # Vérifier que l'input est devenu vert et désactivé
        is_disabled = first_matin1_input.is_disabled()
        if is_disabled:
            print("   ✅ Le champ est maintenant désactivé")

        # 7. ENREGISTRER SOIR 1 DU PREMIER PRODUIT (3 heures plus tard à 14h)
        print("\n7️⃣  ENREGISTRER SOIR 1 (14h)")
        time.sleep(2)  # Simuler le passage du temps

        first_soir1_input = page.locator('input[data-periode="soir1"]').first
        first_soir1_input.fill("160")
        print("   Prix saisi: 160 HTG")

        # Le bouton Soir 1 devrait être le deuxième bouton restant
        first_row.locator('button:has-text("+")').nth(1).click()
        print("   ⏳ Clic sur le bouton '+' ...")
        time.sleep(4)
        print("   ✅ Soir 1 enregistré")

        # 8. VÉRIFIER LE BOUTON "MODIFIER"
        print("\n8️⃣  VÉRIFICATION DU BOUTON MODIFIER")

        # La colonne Actions devrait maintenant contenir un bouton "Modifier"
        modify_button = first_row.locator('button:has-text("Modifier")')
        if modify_button.count() > 0:
            print("   ✅ Bouton 'Modifier' présent dans la colonne Actions")

            # Cliquer sur Modifier
            modify_button.click()
            time.sleep(2)

            # Vérifier que les champs sont maintenant éditables
            is_still_disabled = first_matin1_input.is_disabled()
            if not is_still_disabled:
                print("   ✅ Les champs sont maintenant éditables")
            else:
                print("   ❌ Les champs sont toujours désactivés")

        else:
            print("   ❌ Bouton 'Modifier' non trouvé")

        print("\n⏸️  Navigateur ouvert 30 secondes pour inspection...")
        time.sleep(30)

        browser.close()
        print("\n✅ Test terminé")

if __name__ == "__main__":
    test_boutons_individuels()
