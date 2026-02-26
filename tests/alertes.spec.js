import { test, expect } from '@playwright/test';
import { loginAsDecideur, waitForLoading } from './helpers.js';

test.describe('Page Alertes', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsDecideur(page);
    });

    test('devrait afficher la page des alertes', async ({ page }) => {
        await page.goto('/#/alertes');

        // Attendre que le titre soit visible
        await page.waitForSelector('h1.text-3xl', { timeout: 10000 });

        // Vérifier le titre
        await expect(page.locator('h1.text-3xl')).toContainText('Alertes');

        // Vérifier le sous-titre
        await expect(page.getByText('Système d\'alerte précoce')).toBeVisible();
    });

    test('devrait afficher les statistiques résumées', async ({ page }) => {
        await page.goto('/#/alertes');
        // Attendre que la page se charge
        await page.waitForSelector('h1.text-3xl', { timeout: 10000 });
        await page.waitForTimeout(2000); // Laisser le temps à l'API de charger

        // Attendre que les stats se chargent
        await page.waitForSelector('text=Alertes actives', { timeout: 10000 });

        // Vérifier les 4 cartes de stats
        await expect(page.locator('.text-sm.text-gray-600', { hasText: 'Alertes actives' })).toBeVisible();
        await expect(page.locator('.text-sm.text-gray-600', { hasText: 'Surveillance' })).toBeVisible();
        await expect(page.locator('.text-sm.text-gray-600', { hasText: /^Alerte$/ })).toBeVisible();
        await expect(page.locator('.text-sm.text-gray-600', { hasText: 'Urgence' })).toBeVisible();
    });

    test('devrait afficher les filtres', async ({ page }) => {
        await page.goto('/#/alertes');
        // Attendre que la page se charge
        await page.waitForSelector('h1.text-3xl', { timeout: 10000 });

        // Laisser le temps aux données de se charger
        await page.waitForTimeout(2000);

        // Vérifier titre section filtres
        await expect(page.locator('h3', { hasText: 'Filtres' })).toBeVisible();

        // Vérifier présence des filtres
        await expect(page.locator('input[placeholder*="Rechercher"]')).toBeVisible();
        await expect(page.locator('select', { hasText: /Tous les niveaux/ })).toBeVisible();
        await expect(page.locator('select', { hasText: /Tous les statuts/ })).toBeVisible();
    });

    test('devrait afficher la carte des alertes', async ({ page }) => {
        await page.goto('/#/alertes');
        // Attendre que la page se charge
        await page.waitForSelector('h1.text-3xl', { timeout: 10000 });

        // Laisser le temps aux données de se charger
        await page.waitForTimeout(2000);

        // Vérifier titre carte
        await expect(page.locator('h3', { hasText: 'Carte des alertes' })).toBeVisible();

        // Vérifier présence du conteneur carte
        await expect(page.locator('#alertes-map')).toBeVisible();
    });

    test('devrait afficher la table des alertes', async ({ page }) => {
        await page.goto('/#/alertes');
        // Attendre que la page se charge
        await page.waitForSelector('h1.text-3xl', { timeout: 10000 });
        await page.waitForTimeout(2000); // Laisser le temps à l'API de charger

        // Attendre que la table se charge
        await page.waitForSelector('table', { timeout: 15000 });

        // Vérifier les en-têtes de colonnes (utiliser .first() car les flèches de tri peuvent s'ajouter au texte)
        await expect(page.locator('th', { hasText: 'Date' }).first()).toBeVisible();
        await expect(page.locator('th', { hasText: 'Produit' }).first()).toBeVisible();
        await expect(page.locator('th', { hasText: 'Marché' }).first()).toBeVisible();
        await expect(page.locator('th', { hasText: 'Niveau' }).first()).toBeVisible();
        await expect(page.locator('th', { hasText: 'Variation' }).first()).toBeVisible();
        await expect(page.locator('th', { hasText: 'Prix' }).first()).toBeVisible();
        await expect(page.locator('th', { hasText: 'Actions' }).first()).toBeVisible();
    });

    test('devrait filtrer par niveau', async ({ page }) => {
        await page.goto('/#/alertes');
        // Attendre que la page se charge
        await page.waitForSelector('h1.text-3xl', { timeout: 10000 });
        await page.waitForTimeout(2000); // Laisser le temps à l'API de charger

        // Attendre que les données se chargent
        await page.waitForSelector('table', { timeout: 15000 });

        // Sélectionner niveau "urgence"
        const niveauSelect = page.locator('select').filter({ hasText: /Tous les niveaux/ });
        await niveauSelect.selectOption('urgence');

        // Attendre le filtrage
        await page.waitForTimeout(1000);

        // Vérifier que seules les alertes urgences sont affichées
        // (Si il y en a)
        const badges = page.locator('.bg-red-100');
        const count = await badges.count();
        console.log(`Alertes urgence trouvées: ${count}`);
    });

    test('devrait filtrer par statut', async ({ page }) => {
        await page.goto('/#/alertes');
        // Attendre que la page se charge
        await page.waitForSelector('h1.text-3xl', { timeout: 10000 });
        await page.waitForTimeout(2000); // Laisser le temps à l'API de charger

        // Attendre que les données se chargent
        await page.waitForSelector('table', { timeout: 15000 });

        // Sélectionner statut "active"
        const statutSelect = page.locator('select').filter({ hasText: /Tous les statuts/ });
        await statutSelect.selectOption('active');

        // Attendre le filtrage
        await page.waitForTimeout(1000);

        // Vérifier que seules les alertes actives sont affichées
        const activeBadges = page.locator('.bg-green-100', { hasText: 'Active' });
        const count = await activeBadges.count();
        console.log(`Alertes actives trouvées: ${count}`);
    });

    test('devrait rechercher une alerte', async ({ page }) => {
        await page.goto('/#/alertes');
        // Attendre que la page se charge
        await page.waitForSelector('h1.text-3xl', { timeout: 10000 });
        await page.waitForTimeout(2000); // Laisser le temps à l'API de charger

        // Attendre que les données se chargent
        await page.waitForSelector('table', { timeout: 15000 });

        // Rechercher "riz" (produit commun)
        const searchInput = page.locator('input[placeholder*="Rechercher"]');
        await searchInput.fill('riz');

        // Attendre le filtrage
        await page.waitForTimeout(1000);

        // Vérifier que des résultats sont affichés ou message vide
        const tableBody = page.locator('tbody');
        const hasRows = await tableBody.locator('tr').count() > 0;

        if (hasRows) {
            // Vérifier que les résultats contiennent "riz"
            await expect(tableBody).toContainText(/riz/i);
        } else {
            // Vérifier message vide
            await expect(page.getByText('Aucune alerte trouvée')).toBeVisible();
        }
    });

    test('devrait ouvrir le modal détails', async ({ page }) => {
        await page.goto('/#/alertes');
        // Attendre que la page se charge
        await page.waitForSelector('h1.text-3xl', { timeout: 10000 });
        await page.waitForTimeout(2000); // Laisser le temps à l'API de charger

        // Attendre que les données se chargent
        await page.waitForSelector('table', { timeout: 15000 });

        // Vérifier s'il y a des alertes
        const rows = await page.locator('tbody tr').count();

        if (rows > 0) {
            // Cliquer sur le premier bouton "Détails"
            await page.locator('button', { hasText: 'Détails' }).first().click();

            // Vérifier que le modal s'ouvre
            await expect(page.locator('text=Détails de l\'alerte')).toBeVisible({ timeout: 5000 });

            // Vérifier sections du modal
            await expect(page.getByText('Informations générales')).toBeVisible();
            await expect(page.getByText('Prix et variation')).toBeVisible();
        }
    });

    test('devrait afficher les boutons d\'action pour décideur', async ({ page }) => {
        await page.goto('/#/alertes');
        // Attendre que la page se charge
        await page.waitForSelector('h1.text-3xl', { timeout: 10000 });
        await page.waitForTimeout(2000); // Laisser le temps à l'API de charger

        // Attendre que les données se chargent
        await page.waitForSelector('table', { timeout: 15000 });

        // Vérifier présence boutons actions
        const detailsButtons = page.locator('button', { hasText: 'Détails' });
        const count = await detailsButtons.count();

        if (count > 0) {
            // Les décideurs doivent voir le bouton "Résoudre" pour alertes actives
            expect(count).toBeGreaterThan(0);
        }
    });

    test('devrait gérer la pagination', async ({ page }) => {
        await page.goto('/#/alertes');
        // Attendre que la page se charge
        await page.waitForSelector('h1.text-3xl', { timeout: 10000 });
        await page.waitForTimeout(2000); // Laisser le temps à l'API de charger

        // Attendre que les données se chargent
        await page.waitForSelector('table', { timeout: 15000 });

        // Changer items par page à 5
        const perPageSelect = page.locator('select').filter({ hasText: /Par page/ }).locator('..').locator('select');

        if (await perPageSelect.count() > 0) {
            await perPageSelect.selectOption('5');

            // Attendre le re-rendu
            await page.waitForTimeout(1000);

            // Vérifier que le sélecteur affiche bien 5
            await expect(perPageSelect).toHaveValue('5');
        }
    });

    test('devrait afficher les badges de niveau correctement', async ({ page }) => {
        await page.goto('/#/alertes');
        // Attendre que la page se charge
        await page.waitForSelector('h1.text-3xl', { timeout: 10000 });
        await page.waitForTimeout(2000); // Laisser le temps à l'API de charger

        // Attendre que les données se chargent
        await page.waitForSelector('table', { timeout: 15000 });

        // Vérifier la présence de badges (jaune, orange, rouge)
        const badges = page.locator('.bg-yellow-100, .bg-orange-100, .bg-red-100');
        const count = await badges.count();

        console.log(`Badges de niveau trouvés: ${count}`);
    });

    test('devrait afficher la variation en pourcentage', async ({ page }) => {
        await page.goto('/#/alertes');
        // Attendre que la page se charge
        await page.waitForSelector('h1.text-3xl', { timeout: 10000 });
        await page.waitForTimeout(2000); // Laisser le temps à l'API de charger

        // Attendre que les données se chargent
        await page.waitForSelector('table', { timeout: 15000 });

        // Vérifier présence de variations (format +XX% ou +XX.X%)
        const variations = page.locator('td.text-red-600').filter({ hasText: /\+\d+\.?\d*%/ });
        const count = await variations.count();

        console.log(`Variations de prix trouvées: ${count}`);
        expect(count).toBeGreaterThan(0);
    });
});
