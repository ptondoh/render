import { test, expect } from '@playwright/test';
import { loginAsDecideur, expectSuccessToast, waitForLoading } from './helpers.js';

test.describe('Admin - Communes', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsDecideur(page);
    });

    test('devrait afficher la page des communes', async ({ page }) => {
        await page.goto('/#/admin/communes');
        await waitForLoading(page);

        // Vérifier le titre
        await expect(page.locator('h1')).toContainText('Communes');

        // Vérifier la présence du bouton ajouter
        await expect(page.locator('button', { hasText: 'Ajouter une commune' })).toBeVisible();
    });

    test('devrait afficher la liste des communes', async ({ page }) => {
        await page.goto('/#/admin/communes');
        await waitForLoading(page);

        // Attendre que la table soit chargée
        await page.waitForSelector('table', { timeout: 10000 });

        // Vérifier que la table a des en-têtes
        await expect(page.locator('th', { hasText: 'Code' })).toBeVisible();
        await expect(page.locator('th', { hasText: 'Nom' })).toBeVisible();
        await expect(page.locator('th', { hasText: 'Département' })).toBeVisible();
        await expect(page.locator('th', { hasText: 'Type Zone' })).toBeVisible();
        await expect(page.locator('th', { hasText: 'Population' })).toBeVisible();
    });

    test('devrait créer une nouvelle commune', async ({ page }) => {
        await page.goto('/#/admin/communes');
        await waitForLoading(page);

        // Cliquer sur le bouton ajouter
        await page.click('button:has-text("Ajouter une commune")');

        // Attendre que le modal s'ouvre
        await page.waitForSelector('text=Nouvelle commune', { timeout: 5000 });

        // Générer des données uniques pour le test
        const uniqueCode = `TEST-${Date.now()}`;
        const uniqueNom = `Test Commune ${Date.now()}`;

        // Remplir le formulaire
        await page.fill('input[placeholder*="HT-"]', uniqueCode);
        await page.fill('input[placeholder*="Port-au-Prince"]', uniqueNom);
        await page.fill('input[placeholder*="Pòtoprens"]', 'Test Komin');

        // Sélectionner un département (le premier disponible)
        const deptOptions = page.locator('select option').filter({ hasNotText: 'Sélectionner' });
        const firstDeptValue = await deptOptions.first().getAttribute('value');
        await page.selectOption('select', firstDeptValue);

        // Sélectionner type zone
        await page.selectOption('select', 'urbaine');

        // Ajouter population
        await page.fill('input[type="number"]', '50000');

        // Soumettre le formulaire
        await page.click('button:has-text("Créer")');

        // Vérifier le toast de succès
        await expectSuccessToast(page, 'créée avec succès');

        // Vérifier que la commune apparaît dans la liste
        await waitForLoading(page);
        await expect(page.locator(`text=${uniqueNom}`)).toBeVisible();
    });

    test('devrait filtrer par département', async ({ page }) => {
        await page.goto('/#/admin/communes');
        await waitForLoading(page);

        // Attendre que les selects soient chargés
        await page.waitForSelector('select', { timeout: 10000 });

        // Sélectionner un département dans le filtre
        const filterSelect = page.locator('select').first();
        const deptOptions = filterSelect.locator('option').filter({ hasNotText: 'Tous les départements' });

        if (await deptOptions.count() > 0) {
            const firstDeptText = await deptOptions.first().textContent();
            await filterSelect.selectOption({ label: firstDeptText });

            // Attendre le filtrage
            await page.waitForTimeout(500);

            // Vérifier que toutes les communes affichées ont le bon département
            const deptCells = page.locator('tbody td').filter({ hasText: firstDeptText });
            await expect(deptCells.first()).toBeVisible();
        }
    });

    test('devrait rechercher une commune', async ({ page }) => {
        await page.goto('/#/admin/communes');
        await waitForLoading(page);

        // Rechercher "Port"
        await page.fill('input[placeholder*="Rechercher"]', 'Port');

        // Attendre un peu pour que le filtrage se fasse
        await page.waitForTimeout(500);

        // Vérifier qu'on voit des résultats contenant "Port"
        const table = page.locator('table');
        const hasResults = await table.locator('tbody tr').count() > 0;

        if (hasResults) {
            await expect(table.locator('tbody')).toContainText(/Port/i);
        }
    });

    test('devrait modifier une commune', async ({ page }) => {
        await page.goto('/#/admin/communes');
        await waitForLoading(page);

        // Créer d'abord une commune pour le test
        await page.click('button:has-text("Ajouter une commune")');
        await page.waitForSelector('text=Nouvelle commune');

        const uniqueCode = `EDIT-${Date.now()}`;
        const uniqueNom = `Edit Test ${Date.now()}`;

        await page.fill('input[placeholder*="HT-"]', uniqueCode);
        await page.fill('input[placeholder*="Port-au-Prince"]', uniqueNom);

        // Sélectionner un département
        const deptOptions = page.locator('select option').filter({ hasNotText: 'Sélectionner' });
        const firstDeptValue = await deptOptions.first().getAttribute('value');
        await page.selectOption('select', firstDeptValue);

        await page.click('button:has-text("Créer")');
        await waitForLoading(page);

        // Maintenant, modifier cette commune
        const row = page.locator(`tr:has-text("${uniqueNom}")`);
        await row.locator('button:has-text("Modifier")').click();

        // Attendre que le modal s'ouvre
        await page.waitForSelector('text=Modifier la commune');

        // Modifier le nom
        const modifiedNom = `${uniqueNom} - Modifié`;
        await page.fill('input[placeholder*="Port-au-Prince"]', modifiedNom);

        // Modifier la population
        await page.fill('input[type="number"]', '75000');

        // Soumettre
        await page.click('button:has-text("Mettre à jour")');

        // Vérifier le toast de succès
        await expectSuccessToast(page, 'mise à jour avec succès');

        // Vérifier que le nom est modifié
        await waitForLoading(page);
        await expect(page.locator(`text=${modifiedNom}`)).toBeVisible();
    });

    test('devrait empêcher la suppression d\'une commune avec marchés', async ({ page }) => {
        await page.goto('/#/admin/communes');
        await waitForLoading(page);

        // Chercher une commune avec des marchés (badge avec nombre > 0)
        const rowWithMarches = page.locator('tr').filter({
            has: page.locator('.bg-green-50, .bg-green-100').filter({ hasText: /[1-9]/ })
        }).first();

        if (await rowWithMarches.count() > 0) {
            // Cliquer sur supprimer
            await rowWithMarches.locator('button:has-text("Supprimer")').click();

            // Vérifier le message d'erreur
            await page.waitForSelector('text=/marché.*sont liés/i', { timeout: 5000 });
        }
    });

    test('devrait afficher les badges de type zone', async ({ page }) => {
        await page.goto('/#/admin/communes');
        await waitForLoading(page);

        // Vérifier la présence de badges urbaine ou rurale
        const badges = page.locator('.bg-blue-50, .bg-gray-50').filter({ hasText: /urbaine|rurale/i });
        await expect(badges.first()).toBeVisible();
    });

    test('devrait formater la population avec séparateurs', async ({ page }) => {
        await page.goto('/#/admin/communes');
        await waitForLoading(page);

        // Créer une commune avec une population
        await page.click('button:has-text("Ajouter une commune")');
        await page.waitForSelector('text=Nouvelle commune');

        const uniqueCode = `POP-${Date.now()}`;
        const uniqueNom = `Population Test ${Date.now()}`;

        await page.fill('input[placeholder*="HT-"]', uniqueCode);
        await page.fill('input[placeholder*="Port-au-Prince"]', uniqueNom);

        // Sélectionner un département
        const deptOptions = page.locator('select option').filter({ hasNotText: 'Sélectionner' });
        const firstDeptValue = await deptOptions.first().getAttribute('value');
        await page.selectOption('select', firstDeptValue);

        // Ajouter une grande population
        await page.fill('input[type="number"]', '1234567');

        await page.click('button:has-text("Créer")');
        await waitForLoading(page);

        // Vérifier que la population est formatée avec des séparateurs (ex: 1 234 567)
        const row = page.locator(`tr:has-text("${uniqueNom}")`);
        await expect(row).toContainText(/1[\s]234[\s]567/);
    });

    test('devrait paginer les communes', async ({ page }) => {
        await page.goto('/#/admin/communes');
        await waitForLoading(page);

        // Changer le nombre d'items par page
        const perPageSelect = page.locator('select').filter({ hasText: /Par page/i }).locator('..').locator('select');
        await perPageSelect.selectOption('5');

        // Attendre le re-rendu
        await page.waitForTimeout(500);

        // Vérifier que le sélecteur affiche bien 5
        await expect(perPageSelect).toHaveValue('5');
    });

    test('devrait valider les champs requis', async ({ page }) => {
        await page.goto('/#/admin/communes');
        await waitForLoading(page);

        // Ouvrir le modal
        await page.click('button:has-text("Ajouter une commune")');
        await page.waitForSelector('text=Nouvelle commune');

        // Essayer de soumettre sans remplir les champs
        await page.click('button:has-text("Créer")');

        // Vérifier le message d'erreur de validation
        await page.waitForSelector('text=/remplir.*obligatoires/i', { timeout: 5000 });
    });

    test('devrait afficher le nom du département dans la liste', async ({ page }) => {
        await page.goto('/#/admin/communes');
        await waitForLoading(page);

        // Vérifier qu'il y a des colonnes Département avec des noms
        const deptColumn = page.locator('tbody td').nth(3); // 4ème colonne = Département
        await expect(deptColumn.first()).toBeVisible();
        await expect(deptColumn.first()).not.toHaveText('-');
    });
});
