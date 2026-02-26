/**
 * Tests sur environnement de PRODUCTION Vercel
 * URL: https://parsa-umber.vercel.app/
 *
 * Comptes testés:
 * - admin@sap.ht / Test123!
 * - agent@sap.ht / Test123!
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'https://parsa-umber.vercel.app';

// Ces tests ciblent l'environnement de production Vercel.
// Ils sont ignorés par défaut en local pour ne pas bloquer la CI locale.
// Pour les exécuter : PLAYWRIGHT_TEST_PROD=1 npx playwright test test-production-vercel
const SKIP_PROD = !process.env.PLAYWRIGHT_TEST_PROD;

// Helper pour la connexion
async function login(page, email, password) {
    await page.goto(BASE_URL);
    await page.waitForTimeout(1000);
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    // Attendre la redirection après login
    await page.waitForURL(/dashboard|collectes/, { timeout: 10000 });
}

test.describe('🌐 PRODUCTION - Authentification et Permissions', () => {

    test.beforeEach(({}, testInfo) => {
        if (SKIP_PROD) testInfo.skip(true, 'Production tests: set PLAYWRIGHT_TEST_PROD=1 to enable');
    });

    test('Admin - Connexion et accès pages admin', async ({ page }) => {
        console.log('🔐 [PROD] Test: Connexion admin@sap.ht');

        // 1. Connexion
        await login(page, 'admin@sap.ht', 'Test123!');

        // 2. Vérifier redirection vers dashboard
        await expect(page).toHaveURL(/dashboard/);
        console.log('  ✅ Redirection dashboard OK');

        // 3. Vérifier présence du nom d'utilisateur
        const userInfo = page.locator('text=/admin|bailleur/i').first();
        await expect(userInfo).toBeVisible({ timeout: 5000 });
        console.log('  ✅ Informations utilisateur affichées');

        // 4. Accéder à la page Collectes (doit voir vue CONSULTATION)
        await page.click('a[href="#/collectes"]');
        await page.waitForTimeout(2000);

        // Vérifier qu'on voit le tableau (pas le formulaire de saisie)
        const tableauVisible = await page.locator('table, .table').count() > 0;
        const formulaireAbsent = await page.locator('form[id*="collecte"]').count() === 0;

        if (tableauVisible && formulaireAbsent) {
            console.log('  ✅ Vue CONSULTATION affichée (tableau, pas formulaire)');
        } else {
            console.log('  ⚠️ Vue collectes à vérifier');
        }

        // 5. Accéder à une page admin (Produits)
        await page.goto(`${BASE_URL}#/admin/produits`);
        await page.waitForTimeout(2000);

        // Vérifier qu'on n'a pas de message d'erreur
        const erreurTexte = await page.textContent('body');
        const hasError = erreurTexte.includes('réservé aux') || erreurTexte.includes('Accès non autorisé');

        expect(hasError).toBe(false);
        console.log('  ✅ Accès page admin/produits OK');

        console.log('✅ [PROD] Test admin@sap.ht : RÉUSSI\n');
    });

    test('Agent - Connexion et vue saisie collectes', async ({ page }) => {
        console.log('🔐 [PROD] Test: Connexion agent@sap.ht');

        // 1. Connexion
        await login(page, 'agent@sap.ht', 'Test123!');

        // 2. Vérifier redirection vers dashboard
        await expect(page).toHaveURL(/dashboard/);
        console.log('  ✅ Redirection dashboard OK');

        // 3. Vérifier présence du nom d'utilisateur
        const userInfo = page.locator('text=/agent/i').first();
        await expect(userInfo).toBeVisible({ timeout: 5000 });
        console.log('  ✅ Informations utilisateur affichées');

        // 4. Accéder à la page Collectes (doit voir vue SAISIE)
        await page.click('a[href="#/collectes"]');
        await page.waitForTimeout(2000);

        // Vérifier présence d'éléments de la vue saisie
        const hasMarche = await page.locator('select[id*="marche"], label:has-text("Marché")').count() > 0;
        const hasProduit = await page.locator('select[id*="produit"], label:has-text("Produit")').count() > 0;

        if (hasMarche && hasProduit) {
            console.log('  ✅ Vue SAISIE affichée (formulaire collecte)');
        } else {
            console.log('  ⚠️ Vue saisie - éléments à vérifier');
        }

        // 5. Vérifier qu'on ne peut PAS accéder aux pages admin
        await page.goto(`${BASE_URL}#/admin/produits`);
        await page.waitForTimeout(2000);

        // Vérifier message d'erreur ou redirection
        const url = page.url();
        const body = await page.textContent('body');
        const isBlocked = body.includes('réservé aux administrateurs') ||
                         body.includes('Accès non autorisé') ||
                         url.includes('dashboard');

        expect(isBlocked).toBe(true);
        console.log('  ✅ Accès pages admin bloqué (comme prévu)');

        console.log('✅ [PROD] Test agent@sap.ht : RÉUSSI\n');
    });

});

test.describe('🌐 PRODUCTION - Menu Analyse', () => {

    test.beforeEach(({}, testInfo) => {
        if (SKIP_PROD) testInfo.skip(true, 'Production tests: set PLAYWRIGHT_TEST_PROD=1 to enable');
    });

    test('Menu Analyse accessible et fonctionnel', async ({ page }) => {
        console.log('📊 [PROD] Test: Menu Analyse');

        await login(page, 'admin@sap.ht', 'Test123!');
        await page.waitForTimeout(1000);

        // 1. Trouver et cliquer sur le menu Analyse
        const analyseMenu = page.locator('a:has-text("Analyse"), button:has-text("Analyse")').first();
        const isVisible = await analyseMenu.isVisible({ timeout: 5000 }).catch(() => false);

        expect(isVisible).toBe(true);
        console.log('  ✅ Menu Analyse trouvé');

        await analyseMenu.click();
        await page.waitForTimeout(500);
        console.log('  ✅ Menu Analyse cliqué');
    });

    test('Tableau de bord national - Vérifier chargement', async ({ page }) => {
        console.log('📊 [PROD] Test: Tableau de bord national');

        await login(page, 'admin@sap.ht', 'Test123!');
        await page.waitForTimeout(1000);

        // Capturer les erreurs réseau
        const apiErrors = [];
        page.on('response', response => {
            if (response.status() === 404 && response.url().includes('/api/dashboard')) {
                apiErrors.push({
                    url: response.url(),
                    status: response.status()
                });
            }
        });

        // Accéder à la page
        await page.goto(`${BASE_URL}#/tableau-bord-national`);
        await page.waitForTimeout(3000);

        // Vérifier qu'on n'a pas d'erreur 404
        const bodyText = await page.textContent('body');
        const has404 = bodyText.includes('404') || bodyText.includes('Page non trouvée');

        expect(has404).toBe(false);
        console.log('  ✅ Page accessible (pas de 404)');

        // Vérifier s'il y a un message d'erreur API
        const hasAPIError = bodyText.includes('Données non disponibles') ||
                           bodyText.includes('Erreur') ||
                           bodyText.includes('Impossible de charger');

        if (hasAPIError) {
            console.log('  ⚠️ Erreur API détectée - Les données ne se chargent pas');
        } else {
            console.log('  ✅ Aucune erreur API visible');
        }

        if (apiErrors.length > 0) {
            console.log('  ❌ Erreurs 404 détectées:');
            apiErrors.forEach(err => {
                console.log(`    - ${err.url}`);
            });
        } else {
            console.log('  ✅ Aucune erreur 404 sur API dashboard');
        }
    });

    test('Indicateurs détaillés - Vérifier chargement', async ({ page }) => {
        console.log('📊 [PROD] Test: Indicateurs détaillés');

        await login(page, 'admin@sap.ht', 'Test123!');
        await page.waitForTimeout(1000);

        await page.goto(`${BASE_URL}#/indicateurs-detailles`);
        await page.waitForTimeout(3000);

        const bodyText = await page.textContent('body');
        const has404 = bodyText.includes('404');

        expect(has404).toBe(false);
        console.log('  ✅ Page accessible');

        const hasContent = await page.locator('h1, h2, .card, canvas').count() > 0;
        console.log(hasContent ? '  ✅ Contenu présent' : '  ⚠️ Pas de contenu visible');
    });

    test('Drilldown géographique - Vérifier chargement', async ({ page }) => {
        console.log('🗺️ [PROD] Test: Drilldown géographique');

        await login(page, 'admin@sap.ht', 'Test123!');
        await page.waitForTimeout(1000);

        await page.goto(`${BASE_URL}#/drilldown-geo`);
        await page.waitForTimeout(3000);

        const bodyText = await page.textContent('body');
        const has404 = bodyText.includes('404');

        expect(has404).toBe(false);
        console.log('  ✅ Page accessible');

        const hasMap = await page.locator('canvas, svg, .map, #map').count() > 0;
        console.log(hasMap ? '  ✅ Élément carte/graphique présent' : '  ⚠️ Pas de carte visible');
    });

    test('Vérifier endpoints API Dashboard PROD', async ({ page }) => {
        console.log('🔌 [PROD] Test: Endpoints API Dashboard');

        const apiCalls = [];
        const apiResponses = {};

        page.on('request', request => {
            if (request.url().includes('/api/dashboard')) {
                apiCalls.push({
                    url: request.url(),
                    method: request.method()
                });
            }
        });

        page.on('response', async response => {
            if (response.url().includes('/api/dashboard')) {
                const shortUrl = response.url().replace(/https?:\/\/[^\/]+/, '');
                apiResponses[shortUrl] = response.status();

                console.log(`  📡 ${response.status()} - ${shortUrl}`);

                if (response.status() === 404) {
                    console.log(`    ❌ Endpoint non trouvé`);
                } else if (response.status() === 200) {
                    console.log(`    ✅ Endpoint OK`);
                } else if (response.status() >= 500) {
                    console.log(`    ❌ Erreur serveur`);
                }
            }
        });

        await login(page, 'admin@sap.ht', 'Test123!');

        await page.goto(`${BASE_URL}#/tableau-bord-national`);
        await page.waitForTimeout(4000);

        if (apiCalls.length === 0) {
            console.log('  ⚠️ Aucun appel API /api/dashboard détecté');
        } else {
            console.log(`  ℹ️ ${apiCalls.length} appels API détectés`);
        }
    });

});

test.afterEach(async ({ page }) => {
    await page.close();
});
