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
        await page.fill('input[type="email"]', 'admin@sap.ht');
        await page.fill('input[type="password"]', 'admin123');

        // Soumettre
        await page.click('button:has-text("Se connecter")');

        // Attendre le dashboard
        await page.waitForURL(/.*#\/dashboard/, { timeout: 30000 });
    });

    test('devrait naviguer vers admin départements', async ({ page }) => {
        // Login d'abord
        await page.goto('/#/login');
        await page.fill('input[type="email"]', 'admin@sap.ht');
        await page.fill('input[type="password"]', 'admin123');
        await page.click('button:has-text("Se connecter")');
        await page.waitForURL(/.*#\/dashboard/, { timeout: 30000 });

        // Naviguer vers départements
        await page.goto('/#/admin/departements');
        await page.waitForLoadState('networkidle');

        // Vérifier le titre
        await expect(page.locator('h1')).toContainText('Départements');
    });

    test('devrait afficher la liste des départements', async ({ page }) => {
        // Login
        await page.goto('/#/login');
        await page.fill('input[type="email"]', 'admin@sap.ht');
        await page.fill('input[type="password"]', 'admin123');
        await page.click('button:has-text("Se connecter")');
        await page.waitForURL(/.*#\/dashboard/, { timeout: 30000 });

        // Aller sur départements
        await page.goto('/#/admin/departements');

        // Attendre que le spinner disparaisse
        await page.waitForSelector('.animate-spin', { state: 'hidden', timeout: 20000 });

        // Vérifier la table
        await expect(page.locator('table')).toBeVisible();
        await expect(page.locator('th:has-text("Code")')).toBeVisible();
        await expect(page.locator('th:has-text("Nom")')).toBeVisible();
    });

    test('devrait naviguer vers admin communes', async ({ page }) => {
        // Login
        await page.goto('/#/login');
        await page.fill('input[type="email"]', 'admin@sap.ht');
        await page.fill('input[type="password"]', 'admin123');
        await page.click('button:has-text("Se connecter")');
        await page.waitForURL(/.*#\/dashboard/, { timeout: 30000 });

        // Naviguer vers communes
        await page.goto('/#/admin/communes');
        await page.waitForLoadState('networkidle');

        // Vérifier le titre
        await expect(page.locator('h1')).toContainText('Communes');
    });

    test('devrait afficher la liste des communes', async ({ page }) => {
        // Login
        await page.goto('/#/login');
        await page.fill('input[type="email"]', 'admin@sap.ht');
        await page.fill('input[type="password"]', 'admin123');
        await page.click('button:has-text("Se connecter")');
        await page.waitForURL(/.*#\/dashboard/, { timeout: 30000 });

        // Aller sur communes
        await page.goto('/#/admin/communes');

        // Attendre que le spinner disparaisse
        await page.waitForSelector('.animate-spin', { state: 'hidden', timeout: 20000 });

        // Vérifier la table
        await expect(page.locator('table')).toBeVisible();
        await expect(page.locator('th:has-text("Code")')).toBeVisible();
        await expect(page.locator('th:has-text("Nom")')).toBeVisible();
        await expect(page.locator('th:has-text("Département")')).toBeVisible();
    });
});
