/**
 * Tests Playwright — Dashboard Bailleur
 * Vérifie les 10 tuiles de configuration et leur navigation.
 */

const { test, expect } = require('@playwright/test');

const BASE_URL = 'http://localhost:3000';
const ADMIN_EMAIL = 'admin@sap.ht';
const ADMIN_PASSWORD = 'Test123!';

async function loginAsBailleur(page) {
    await page.goto(BASE_URL);
    await page.waitForTimeout(500);
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard/, { timeout: 10000 });
    await page.waitForTimeout(800);
}

test.describe('Dashboard Bailleur — Tuiles de configuration', () => {

    test('10 tuiles présentes sur le dashboard admin', async ({ page }) => {
        await loginAsBailleur(page);

        const tuiles = [
            'Unités de mesure',
            'Catégories',
            'Produits',
            'Départements',
            'Communes',
            'Marchés',
            'Import CSV/Excel',
            'Utilisateurs',
            'Rôles',
            'Permissions',
        ];

        for (const titre of tuiles) {
            const tile = page.locator(`[data-tile="${titre}"]`);
            await expect(tile).toBeVisible({ timeout: 5000 });
            console.log(`  ✅ Tuile "${titre}" visible`);
        }
    });

    test('Tuile Utilisateurs navigue vers /admin/utilisateurs', async ({ page }) => {
        await loginAsBailleur(page);

        await page.locator('[data-tile="Utilisateurs"]').click();
        await page.waitForTimeout(500);

        expect(page.url()).toContain('/admin/utilisateurs');
        console.log('  ✅ Navigation /admin/utilisateurs OK');

        // Vérifier que la page se charge (pas de message d'erreur)
        const body = await page.textContent('body');
        expect(body).not.toContain('Accès non autorisé');
    });

    test('Tuile Rôles navigue vers /admin/roles', async ({ page }) => {
        await loginAsBailleur(page);

        await page.locator('[data-tile="Rôles"]').click();
        await page.waitForTimeout(500);

        expect(page.url()).toContain('/admin/roles');
        console.log('  ✅ Navigation /admin/roles OK');

        const body = await page.textContent('body');
        expect(body).not.toContain('Accès non autorisé');
    });

    test('Tuile Permissions navigue vers /admin/permissions', async ({ page }) => {
        await loginAsBailleur(page);

        await page.locator('[data-tile="Permissions"]').click();
        await page.waitForTimeout(500);

        expect(page.url()).toContain('/admin/permissions');
        console.log('  ✅ Navigation /admin/permissions OK');

        const body = await page.textContent('body');
        expect(body).not.toContain('Accès non autorisé');
    });

    test('Tuiles existantes naviguent correctement', async ({ page }) => {
        await loginAsBailleur(page);

        const checks = [
            { tile: 'Produits',        hash: '/admin/produits' },
            { tile: 'Marchés',         hash: '/admin/marches' },
            { tile: 'Import CSV/Excel', hash: '/admin/import' },
        ];

        for (const { tile, hash } of checks) {
            // Revenir au dashboard entre chaque navigation
            await page.goto(`${BASE_URL}/#/dashboard`);
            await page.waitForTimeout(500);

            await page.locator(`[data-tile="${tile}"]`).click();
            await page.waitForTimeout(500);

            expect(page.url()).toContain(hash);
            console.log(`  ✅ Tuile "${tile}" → ${hash} OK`);
        }
    });

    test('Layout 4 colonnes sur desktop', async ({ page }) => {
        // Viewport desktop
        await page.setViewportSize({ width: 1280, height: 800 });
        await loginAsBailleur(page);

        // Vérifier que la grille a bien 4 colonnes (md:grid-cols-4)
        const grid = page.locator('.grid.grid-cols-2.md\\:grid-cols-4');
        await expect(grid).toBeVisible({ timeout: 5000 });
        console.log('  ✅ Grille 4 colonnes présente');

        // Vérifier qu'il y a bien 10 tuiles dans la grille
        const tileCount = await grid.locator('[data-tile]').count();
        expect(tileCount).toBe(10);
        console.log(`  ✅ ${tileCount} tuiles dans la grille`);
    });

});
