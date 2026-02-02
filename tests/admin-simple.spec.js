import { test, expect } from '@playwright/test';

test.describe('Test simple - Départements et Communes', () => {
    test('devrait charger la page de login', async ({ page }) => {
        await page.goto('/');

        // Attendre que la page charge
        await page.waitForLoadState('networkidle');

        // Vérifier qu'on est redirigé vers login
        await expect(page).toHaveURL(/.*#\/login/);
    });

    test('devrait se connecter en tant que décideur', async ({ page }) => {
        await page.goto('/#/login');

        // Attendre le formulaire
        await page.waitForSelector('input[type="email"]');

        // Remplir le formulaire
        await page.fill('input[type="email"]', 'decideur@sap.ht');
        await page.fill('input[type="password"]', 'Test123!');

        // Soumettre
        await page.click('button:has-text("Se connecter")');

        // Attendre le dashboard
        await page.waitForURL(/.*#\/dashboard/, { timeout: 30000 });
    });

    test('devrait naviguer vers admin départements', async ({ page }) => {
        // Login d'abord
        await page.goto('/#/login');
        await page.fill('input[type="email"]', 'decideur@sap.ht');
        await page.fill('input[type="password"]', 'Test123!');
        await page.click('button:has-text("Se connecter")');
        await page.waitForURL(/.*#\/dashboard/, { timeout: 30000 });

        // Naviguer vers départements
        await page.goto('/#/admin/departements');
        await page.waitForLoadState('networkidle');

        // Vérifier le titre (sélecteur plus spécifique)
        await expect(page.locator('h1.text-3xl')).toContainText('Départements');
    });

    test('devrait afficher la liste des départements', async ({ page }) => {
        // Login
        await page.goto('/#/login');
        await page.fill('input[type="email"]', 'decideur@sap.ht');
        await page.fill('input[type="password"]', 'Test123!');
        await page.click('button:has-text("Se connecter")');
        await page.waitForURL(/.*#\/dashboard/, { timeout: 30000 });

        // Aller sur départements
        await page.goto('/#/admin/departements');

        // Attendre que le réseau soit stable
        await page.waitForLoadState('networkidle', { timeout: 30000 });

        // Attendre que le spinner disparaisse (timeout plus long)
        const spinner = page.locator('.animate-spin');
        if (await spinner.count() > 0) {
            await spinner.first().waitFor({ state: 'hidden', timeout: 30000 });
        }

        // Attendre un peu plus pour que les données se chargent
        await page.waitForTimeout(2000);

        // Attendre que la table soit visible (timeout plus long)
        await page.waitForSelector('table', { timeout: 30000 });

        // Vérifier la table
        await expect(page.locator('table')).toBeVisible();
        await expect(page.locator('th', { hasText: /^Code$/ })).toBeVisible();
        await expect(page.locator('th', { hasText: /^Nom$/ })).toBeVisible();
    });

    test('devrait naviguer vers admin communes', async ({ page }) => {
        // Login
        await page.goto('/#/login');
        await page.fill('input[type="email"]', 'decideur@sap.ht');
        await page.fill('input[type="password"]', 'Test123!');
        await page.click('button:has-text("Se connecter")');
        await page.waitForURL(/.*#\/dashboard/, { timeout: 30000 });

        // Naviguer vers communes
        await page.goto('/#/admin/communes');
        await page.waitForLoadState('networkidle');

        // Vérifier le titre (sélecteur plus spécifique)
        await expect(page.locator('h1.text-3xl')).toContainText('Communes');
    });

    test('devrait afficher la liste des communes', async ({ page }) => {
        // Login
        await page.goto('/#/login');
        await page.fill('input[type="email"]', 'decideur@sap.ht');
        await page.fill('input[type="password"]', 'Test123!');
        await page.click('button:has-text("Se connecter")');
        await page.waitForURL(/.*#\/dashboard/, { timeout: 30000 });

        // Aller sur communes
        await page.goto('/#/admin/communes');

        // Attendre que le réseau soit stable
        await page.waitForLoadState('networkidle', { timeout: 30000 });

        // Attendre que le spinner disparaisse (timeout plus long)
        const spinner = page.locator('.animate-spin');
        if (await spinner.count() > 0) {
            await spinner.first().waitFor({ state: 'hidden', timeout: 30000 });
        }

        // Attendre un peu plus pour que les données se chargent
        await page.waitForTimeout(2000);

        // Attendre que la table soit visible (timeout plus long)
        await page.waitForSelector('table', { timeout: 30000 });

        // Vérifier la table
        await expect(page.locator('table')).toBeVisible();
        await expect(page.locator('th', { hasText: /^Code$/ })).toBeVisible();
        await expect(page.locator('th', { hasText: /^Nom$/ })).toBeVisible();
        await expect(page.locator('th:has-text("Département")')).toBeVisible();
    });
});
