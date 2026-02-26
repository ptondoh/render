/**
 * Test du Menu Analyse et ses sous-pages
 * Vérifie que toutes les pages du menu Analyse se chargent correctement
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';

// Helper pour la connexion
async function login(page, email, password) {
    await page.goto(BASE_URL);
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard|collectes/, { timeout: 5000 });
}

test.describe('Menu Analyse - Test Complet', () => {

    test('Vérifier accès menu Analyse et sous-menus', async ({ page }) => {
        console.log('📊 Test: Menu Analyse');

        // Connexion avec admin (a accès au menu Analyse)
        await login(page, 'admin@sap.ht', 'Test123!');
        await page.waitForTimeout(1000);

        // 1. Trouver et cliquer sur le menu Analyse
        console.log('  🔍 Recherche du menu Analyse...');

        // Le menu peut être un lien ou un bouton
        const analyseMenu = page.locator('a:has-text("Analyse"), button:has-text("Analyse")').first();
        const isVisible = await analyseMenu.isVisible({ timeout: 3000 }).catch(() => false);

        if (!isVisible) {
            console.log('  ❌ Menu Analyse non trouvé dans la navigation');
            throw new Error('Menu Analyse non visible');
        }

        console.log('  ✅ Menu Analyse trouvé');

        // Cliquer sur le menu (peut ouvrir un dropdown)
        await analyseMenu.click();
        await page.waitForTimeout(500);

        console.log('  ✅ Menu Analyse cliqué');

        // 2. Vérifier les sous-menus disponibles
        const submenus = [
            'Tableau de bord national',
            'Vue d\'ensemble nationale',
            'Indicateurs détaillés',
            'Drilldown géographique'
        ];

        console.log('  🔍 Vérification des sous-menus...');

        for (const submenu of submenus) {
            const submenuLink = page.locator(`a:has-text("${submenu}")`).first();
            const exists = await submenuLink.count() > 0;

            if (exists) {
                console.log(`    ✅ "${submenu}" trouvé`);
            } else {
                console.log(`    ⚠️ "${submenu}" non trouvé`);
            }
        }
    });

    test('Tableau de bord national - Vérifier chargement', async ({ page }) => {
        console.log('📊 Test: Tableau de bord national');

        await login(page, 'admin@sap.ht', 'Test123!');
        await page.waitForTimeout(1000);

        // Accéder directement à la page
        await page.goto(`${BASE_URL}#/tableau-bord-national`);
        await page.waitForTimeout(2000);

        // Vérifier qu'on n'a pas d'erreur 404
        const bodyText = await page.textContent('body');
        const has404 = bodyText.includes('404') || bodyText.includes('Page non trouvée');

        expect(has404).toBe(false);
        console.log('  ✅ Page accessible (pas de 404)');

        // Vérifier s'il y a un message d'erreur API
        const hasAPIError = bodyText.includes('Données non disponibles') ||
                           bodyText.includes('Erreur API') ||
                           bodyText.includes('Impossible de charger');

        if (hasAPIError) {
            console.log('  ⚠️ Erreur API détectée - Les données ne se chargent pas');
            console.log('  ℹ️ L\'endpoint /api/dashboard/indicateurs semble manquant');
        } else {
            console.log('  ✅ Aucune erreur API visible');
        }

        // Capturer les erreurs réseau
        const errors = [];
        page.on('response', response => {
            if (response.status() === 404 && response.url().includes('/api/dashboard')) {
                errors.push({
                    url: response.url(),
                    status: response.status()
                });
            }
        });

        // Actualiser pour capturer les erreurs
        await page.reload();
        await page.waitForTimeout(2000);

        if (errors.length > 0) {
            console.log('  ❌ Erreurs 404 détectées:');
            errors.forEach(err => {
                console.log(`    - ${err.url}`);
            });
        }
    });

    test('Indicateurs détaillés - Vérifier chargement', async ({ page }) => {
        console.log('📊 Test: Indicateurs détaillés');

        await login(page, 'admin@sap.ht', 'Test123!');
        await page.waitForTimeout(1000);

        // Accéder à la page
        await page.goto(`${BASE_URL}#/indicateurs-detailles`);
        await page.waitForTimeout(2000);

        // Vérifier accessibilité
        const bodyText = await page.textContent('body');
        const has404 = bodyText.includes('404');

        expect(has404).toBe(false);
        console.log('  ✅ Page accessible');

        // Vérifier contenu
        const hasContent = await page.locator('h1, h2, .card, canvas').count() > 0;
        console.log(hasContent ? '  ✅ Contenu présent' : '  ⚠️ Pas de contenu visible');
    });

    test('Drilldown géographique - Vérifier chargement', async ({ page }) => {
        console.log('🗺️ Test: Drilldown géographique');

        await login(page, 'admin@sap.ht', 'Test123!');
        await page.waitForTimeout(1000);

        // Accéder à la page
        await page.goto(`${BASE_URL}#/drilldown-geo`);
        await page.waitForTimeout(2000);

        // Vérifier accessibilité
        const bodyText = await page.textContent('body');
        const has404 = bodyText.includes('404');

        expect(has404).toBe(false);
        console.log('  ✅ Page accessible');

        // Vérifier présence carte ou contenu géographique
        const hasMap = await page.locator('canvas, svg, .map, #map').count() > 0;
        console.log(hasMap ? '  ✅ Élément carte/graphique présent' : '  ⚠️ Pas de carte visible');
    });

    test('Vérifier endpoints API Dashboard', async ({ page }) => {
        console.log('🔌 Test: Endpoints API Dashboard');

        // Intercepter les requêtes API
        const apiCalls = [];

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
                console.log(`  📡 ${response.status()} - ${response.url()}`);

                if (response.status() === 404) {
                    console.log(`    ❌ Endpoint non trouvé: ${response.url()}`);
                } else if (response.status() === 200) {
                    console.log(`    ✅ Endpoint OK`);
                }
            }
        });

        await login(page, 'admin@sap.ht', 'Test123!');

        // Visiter les pages du dashboard
        await page.goto(`${BASE_URL}#/tableau-bord-national`);
        await page.waitForTimeout(3000);

        if (apiCalls.length === 0) {
            console.log('  ⚠️ Aucun appel API /api/dashboard détecté');
        } else {
            console.log(`  ℹ️ ${apiCalls.length} appels API détectés`);
        }
    });

});
