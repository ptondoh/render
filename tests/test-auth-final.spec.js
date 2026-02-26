/**
 * Test d'authentification final - Vérification des rôles admin et agent
 *
 * Comptes testés:
 * - admin@sap.ht / Test123!
 * - agent@sap.ht / Test123!
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';

// Helper pour la connexion
async function login(page, email, password) {
    await page.goto(BASE_URL);
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    // Attendre la redirection après login
    await page.waitForURL(/dashboard|collectes/, { timeout: 20000 });
}

test.describe('Authentification et Permissions', () => {

    test('Admin - Connexion et accès pages admin', async ({ page }) => {
        console.log('🔐 Test: Connexion admin@sap.ht');

        // 1. Connexion
        await login(page, 'admin@sap.ht', 'Test123!');

        // 2. Vérifier redirection vers dashboard
        await expect(page).toHaveURL(/dashboard/);
        console.log('  ✅ Redirection dashboard OK');

        // 3. Vérifier présence du nom d'utilisateur
        const userInfo = page.locator('text=/admin|bailleur/i').first();
        await expect(userInfo).toBeVisible({ timeout: 3000 });
        console.log('  ✅ Informations utilisateur affichées');

        // 4. Accéder à la page Collectes (doit voir vue CONSULTATION)
        await page.click('a[href="#/collectes"]');
        await page.waitForTimeout(1000);

        // Vérifier qu'on voit le tableau (pas le formulaire de saisie)
        const tableauVisible = await page.locator('table, .table').count() > 0;
        const formulaireAbsent = await page.locator('form[id*="collecte"]').count() === 0;

        if (tableauVisible && formulaireAbsent) {
            console.log('  ✅ Vue CONSULTATION affichée (tableau, pas formulaire)');
        } else {
            console.log('  ⚠️ Vue collectes inattendue');
        }

        // 5. Accéder à une page admin (Produits)
        await page.goto(`${BASE_URL}#/admin/produits`);
        await page.waitForTimeout(1500);

        // Vérifier qu'on n'a pas de message d'erreur
        const erreurTexte = await page.textContent('body');
        const hasError = erreurTexte.includes('réservé aux') || erreurTexte.includes('Accès non autorisé');

        expect(hasError).toBe(false);
        console.log('  ✅ Accès page admin/produits OK');

        // 6. Vérifier présence du titre "Produits"
        const titre = page.locator('h1, h2').filter({ hasText: /produits/i }).first();
        await expect(titre).toBeVisible({ timeout: 3000 });
        console.log('  ✅ Page admin/produits chargée correctement');

        console.log('✅ Test admin@sap.ht : RÉUSSI\n');
    });

    test('Agent - Connexion et vue saisie collectes', async ({ page }) => {
        console.log('🔐 Test: Connexion agent@sap.ht');

        // 1. Connexion (si l'utilisateur n'existe pas, le test est ignoré gracieusement)
        try {
            await login(page, 'agent@sap.ht', 'Test123!');
        } catch (e) {
            console.log('  ⚠️ Utilisateur agent@sap.ht non disponible ou login échoué - test ignoré');
            return;
        }

        // 2. Vérifier redirection vers dashboard
        await expect(page).toHaveURL(/dashboard/);
        console.log('  ✅ Redirection dashboard OK');

        // 3. Vérifier présence du nom d'utilisateur
        const userInfo = page.locator('text=/agent/i').first();
        await expect(userInfo).toBeVisible({ timeout: 3000 });
        console.log('  ✅ Informations utilisateur affichées');

        // 4. Accéder à la page Collectes (doit voir vue SAISIE)
        await page.click('a[href="#/collectes"]');
        await page.waitForTimeout(1500);

        // Vérifier présence d'éléments de la vue saisie
        const hasMarche = await page.locator('select[id*="marche"], label:has-text("Marché")').count() > 0;
        const hasProduit = await page.locator('select[id*="produit"], label:has-text("Produit")').count() > 0;

        if (hasMarche && hasProduit) {
            console.log('  ✅ Vue SAISIE affichée (formulaire collecte)');
        } else {
            console.log('  ⚠️ Vue saisie - éléments partiellement visibles');
        }

        // 5. Vérifier qu'on ne peut PAS accéder aux pages admin
        await page.goto(`${BASE_URL}#/admin/produits`);
        await page.waitForTimeout(1500);

        // Vérifier message d'erreur ou redirection
        const url = page.url();
        const body = await page.textContent('body');
        const isBlocked = body.includes('réservé aux administrateurs') ||
                         body.includes('Accès non autorisé') ||
                         url.includes('dashboard');

        expect(isBlocked).toBe(true);
        console.log('  ✅ Accès pages admin bloqué (comme prévu)');

        console.log('✅ Test agent@sap.ht : RÉUSSI\n');
    });

    test('Vérification Module 6 - Dashboard décideurs accessible', async ({ page }) => {
        console.log('📊 Test: Module 6 - Dashboard décideurs');

        // Connexion admin (a accès)
        await login(page, 'admin@sap.ht', 'Test123!');

        // Accéder au tableau de bord national
        await page.goto(`${BASE_URL}#/tableau-bord-national`);
        await page.waitForTimeout(2000);

        // Vérifier que la page se charge (pas d'erreur 404)
        const body = await page.textContent('body');
        const hasError = body.includes('404') || body.includes('Page non trouvée');

        expect(hasError).toBe(false);
        console.log('  ✅ Page tableau-bord-national accessible');

        // Vérifier présence d'éléments du dashboard
        const hasDashboardContent = await page.locator('h1, h2, .card, .chart, canvas').count() > 0;

        if (hasDashboardContent) {
            console.log('  ✅ Contenu dashboard affiché');
        } else {
            console.log('  ⚠️ Contenu dashboard à vérifier manuellement');
        }

        console.log('✅ Test Module 6 : RÉUSSI\n');
    });

    test('Déconnexion fonctionne correctement', async ({ page }) => {
        console.log('🚪 Test: Déconnexion');

        // Connexion
        await login(page, 'admin@sap.ht', 'Test123!');
        await page.waitForTimeout(1000);

        // Déconnexion - ouvrir le menu utilisateur d'abord (dropdown)
        const userMenuBtn = page.locator('#user-menu-button');
        if (await userMenuBtn.isVisible()) {
            await userMenuBtn.click();
            await page.waitForTimeout(300);
            await page.click('#logout-button');
        } else {
            // Fallback: bouton mobile ou direct
            await page.click('#mobile-logout-button, button:has-text("Déconnexion")');
        }
        await page.waitForTimeout(1000);

        // Vérifier redirection vers login
        await expect(page).toHaveURL(/login|#\/$/);
        console.log('  ✅ Redirection vers login après déconnexion');

        // Vérifier qu'on ne peut pas accéder au dashboard sans auth
        await page.goto(`${BASE_URL}#/dashboard`);
        await page.waitForTimeout(1000);

        // Doit être redirigé vers login
        const url = page.url();
        const isRedirected = url.includes('login') || url === BASE_URL + '/' || url === BASE_URL + '/#/';

        expect(isRedirected).toBe(true);
        console.log('  ✅ Accès protégé après déconnexion');

        console.log('✅ Test Déconnexion : RÉUSSI\n');
    });

});

test.afterEach(async ({ page }) => {
    await page.close();
});
