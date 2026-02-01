import { test, expect } from '@playwright/test';
import { loginAsDecideur, expectSuccessToast, waitForLoading } from './helpers.js';

test.describe('Admin - Départements', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsDecideur(page);
    });

    test('devrait afficher la page des départements', async ({ page }) => {
        await page.goto('/#/admin/departements');
        await waitForLoading(page);

        // Vérifier le titre
        await expect(page.locator('h1')).toContainText('Départements');

        // Vérifier la présence du bouton ajouter
        await expect(page.locator('button', { hasText: 'Ajouter un département' })).toBeVisible();
    });

    test('devrait afficher la liste des départements', async ({ page }) => {
        await page.goto('/#/admin/departements');
        await waitForLoading(page);

        // Attendre que la table soit chargée
        await page.waitForSelector('table', { timeout: 10000 });

        // Vérifier que la table a des en-têtes
        await expect(page.locator('th', { hasText: 'Code' })).toBeVisible();
        await expect(page.locator('th', { hasText: 'Nom' })).toBeVisible();
        await expect(page.locator('th', { hasText: 'Communes' })).toBeVisible();
    });

    test('devrait créer un nouveau département', async ({ page }) => {
        await page.goto('/#/admin/departements');
        await waitForLoading(page);

        // Cliquer sur le bouton ajouter
        await page.click('button:has-text("Ajouter un département")');

        // Attendre que le modal s'ouvre
        await page.waitForSelector('text=Nouveau département', { timeout: 5000 });

        // Générer un code unique pour le test
        const uniqueCode = `TEST-${Date.now()}`;
        const uniqueNom = `Test Département ${Date.now()}`;

        // Remplir le formulaire
        await page.fill('input[placeholder*="HT-"]', uniqueCode);
        await page.fill('input[placeholder*="Ouest"]', uniqueNom);
        await page.fill('input[placeholder*="Lwès"]', 'Test Depatman');

        // Soumettre le formulaire
        await page.click('button:has-text("Créer")');

        // Vérifier le toast de succès
        await expectSuccessToast(page, 'créé avec succès');

        // Vérifier que le département apparaît dans la liste
        await waitForLoading(page);
        await expect(page.locator(`text=${uniqueNom}`)).toBeVisible();
    });

    test('devrait rechercher un département', async ({ page }) => {
        await page.goto('/#/admin/departements');
        await waitForLoading(page);

        // Rechercher "Ouest"
        await page.fill('input[placeholder*="Rechercher"]', 'Ouest');

        // Attendre un peu pour que le filtrage se fasse
        await page.waitForTimeout(500);

        // Vérifier qu'on voit "Ouest" dans les résultats
        const table = page.locator('table');
        await expect(table).toContainText('Ouest');
    });

    test('devrait modifier un département', async ({ page }) => {
        await page.goto('/#/admin/departements');
        await waitForLoading(page);

        // Créer d'abord un département pour le test
        await page.click('button:has-text("Ajouter un département")');
        await page.waitForSelector('text=Nouveau département');

        const uniqueCode = `EDIT-${Date.now()}`;
        const uniqueNom = `Edit Test ${Date.now()}`;

        await page.fill('input[placeholder*="HT-"]', uniqueCode);
        await page.fill('input[placeholder*="Ouest"]', uniqueNom);
        await page.click('button:has-text("Créer")');
        await waitForLoading(page);

        // Maintenant, modifier ce département
        const row = page.locator(`tr:has-text("${uniqueNom}")`);
        await row.locator('button:has-text("Modifier")').click();

        // Attendre que le modal s'ouvre
        await page.waitForSelector('text=Modifier le département');

        // Modifier le nom
        const modifiedNom = `${uniqueNom} - Modifié`;
        await page.fill('input[placeholder*="Ouest"]', modifiedNom);

        // Soumettre
        await page.click('button:has-text("Mettre à jour")');

        // Vérifier le toast de succès
        await expectSuccessToast(page, 'mis à jour avec succès');

        // Vérifier que le nom est modifié
        await waitForLoading(page);
        await expect(page.locator(`text=${modifiedNom}`)).toBeVisible();
    });

    test('devrait empêcher la suppression d\'un département avec communes', async ({ page }) => {
        await page.goto('/#/admin/departements');
        await waitForLoading(page);

        // Chercher un département avec des communes (Ouest par exemple)
        const rowWithCommunes = page.locator('tr').filter({
            has: page.locator('td:has-text("commune")').filter({ hasText: /[1-9]/ })
        }).first();

        if (await rowWithCommunes.count() > 0) {
            // Cliquer sur supprimer
            await rowWithCommunes.locator('button:has-text("Supprimer")').click();

            // Vérifier le message d'erreur
            await page.waitForSelector('text=/commune.*sont liées/i', { timeout: 5000 });
        }
    });

    test('devrait paginer les départements', async ({ page }) => {
        await page.goto('/#/admin/departements');
        await waitForLoading(page);

        // Changer le nombre d'items par page
        await page.selectOption('select', '5');

        // Attendre le re-rendu
        await page.waitForTimeout(500);

        // Vérifier que le sélecteur affiche bien 5
        await expect(page.locator('select')).toHaveValue('5');
    });

    test('devrait valider les champs requis', async ({ page }) => {
        await page.goto('/#/admin/departements');
        await waitForLoading(page);

        // Ouvrir le modal
        await page.click('button:has-text("Ajouter un département")');
        await page.waitForSelector('text=Nouveau département');

        // Essayer de soumettre sans remplir les champs
        await page.click('button:has-text("Créer")');

        // Vérifier le message d'erreur de validation
        await page.waitForSelector('text=/remplir.*obligatoires/i', { timeout: 5000 });
    });
});
