/**
 * Tests Playwright - Contrôle d'accès RBAC
 * Valide que chaque rôle voit uniquement ce qu'il est autorisé à voir
 * et est bloqué des pages non autorisées
 */

const { test, expect } = require('@playwright/test');

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API_URL = process.env.API_URL || 'http://localhost:8000';

// Credentials pour chaque rôle
const USERS = {
    agent: {
        email: 'agent.test@sap.ht',
        password: 'Agent123!',
        expectedRole: 'agent'
    },
    decideur: {
        email: 'decideur.test@sap.ht',
        password: 'Decideur123!',
        expectedRole: 'décideur'
    },
    bailleur: {
        email: 'admin@sap.ht',
        password: 'Test123!',
        expectedRole: 'bailleur'
    }
};

/**
 * Helper : Se connecter avec un utilisateur spécifique
 */
async function loginAs(page, userType) {
    const user = USERS[userType];

    // Nettoyer le localStorage pour partir d'un état propre
    await page.goto(`${BASE_URL}/#/login`);
    await page.evaluate(() => {
        localStorage.clear();
    });

    await page.goto(`${BASE_URL}/#/login`);
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });

    await page.fill('input[type="email"]', user.email);
    await page.fill('input[type="password"]', user.password);
    await page.click('button[type="submit"]');

    // Attendre la redirection vers dashboard
    await page.waitForURL(/dashboard/, { timeout: 15000 });
    console.log(`✓ Connecté comme ${userType}`);
}

/**
 * Helper : Créer un utilisateur de test via API
 */
async function createTestUser(userType, roleId) {
    const user = USERS[userType];

    try {
        const response = await fetch(`${API_URL}/api/users`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.BAILLEUR_TOKEN || ''}`
            },
            body: JSON.stringify({
                email: user.email,
                password: user.password,
                roles: [roleId],
                nom: `Test ${userType}`,
                prenom: 'User',
                actif: true
            })
        });

        if (response.ok) {
            console.log(`✓ Utilisateur ${userType} créé`);
            return await response.json();
        } else if (response.status === 400) {
            console.log(`! Utilisateur ${userType} existe déjà`);
            return null;
        } else {
            throw new Error(`Erreur création user: ${response.status}`);
        }
    } catch (error) {
        console.log(`! Erreur création ${userType}: ${error.message}`);
        return null;
    }
}

/**
 * Helper : Vérifier qu'une page est accessible
 */
async function expectPageAccessible(page, url, pageName) {
    await page.goto(`${BASE_URL}/#${url}`);
    await page.waitForTimeout(1000);

    // Vérifier qu'on n'a pas de message "Accès non autorisé"
    const content = await page.textContent('body');
    expect(content).not.toContain('Accès non autorisé');
    expect(content).not.toContain('Accès refusé');
    console.log(`  ✓ ${pageName} accessible`);
}

/**
 * Helper : Vérifier qu'une page est bloquée
 */
async function expectPageBlocked(page, url, pageName) {
    await page.goto(`${BASE_URL}/#${url}`);
    await page.waitForTimeout(1500);

    // Vérifier message d'erreur ou redirection
    const content = await page.textContent('body');
    const isBlocked = content.includes('Accès non autorisé') ||
                     content.includes('Accès refusé') ||
                     content.includes('Cette page est réservée') ||
                     content.includes('403') ||
                     content.includes('Permissions manquantes');

    expect(isBlocked).toBe(true);
    console.log(`  ✓ ${pageName} bloquée (comme prévu)`);
}

/**
 * Helper : Vérifier que le menu contient certains items
 */
async function expectMenuItems(page, expectedItems, notExpectedItems = []) {
    // Vérifier que les items attendus sont VISIBLES (pas hidden)
    for (const item of expectedItems) {
        // Utiliser une recherche partielle pour gérer les emojis et variations
        const selector = `nav >> text=/${item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/i`;
        const visible = await page.isVisible(selector).catch(() => false);
        expect(visible).toBe(true);
    }

    // Vérifier que les items non attendus sont CACHÉS ou ABSENTS
    for (const item of notExpectedItems) {
        // Vérifier si l'élément existe
        const adminDesktop = await page.$('#admin-menu-desktop');
        const adminMobile = await page.$('#admin-menu-mobile');
        const analyseDesktop = await page.$('#analyse-menu-desktop');
        const analyseMobile = await page.$('#analyse-menu-mobile');

        if (item === 'Administration') {
            // Vérifier que les deux menus admin sont cachés
            const desktopHidden = adminDesktop ? await adminDesktop.evaluate(el => el.classList.contains('hidden')) : true;
            const mobileHidden = adminMobile ? await adminMobile.evaluate(el => el.classList.contains('hidden')) : true;
            expect(desktopHidden && mobileHidden).toBe(true);
        } else if (item === 'Analyse') {
            // Vérifier que les deux menus analyse sont cachés
            const desktopHidden = analyseDesktop ? await analyseDesktop.evaluate(el => el.classList.contains('hidden')) : true;
            const mobileHidden = analyseMobile ? await analyseMobile.evaluate(el => el.classList.contains('hidden')) : true;
            expect(desktopHidden && mobileHidden).toBe(true);
        }
    }
    console.log(`  ✓ Menu contient items attendus`);
}

// ============================================================================
// TEST SUITE 1 : Rôle AGENT
// ============================================================================

test.describe('Contrôle d\'accès - Rôle AGENT', () => {

    test('Test A1 : Agent peut accéder aux pages de collectes', async ({ page }) => {
        await loginAs(page, 'agent');

        console.log('\n=== Test A1 : Pages Collectes accessibles ===');

        // Pages que l'agent DOIT pouvoir accéder
        await expectPageAccessible(page, '/collectes', 'Collectes');
        await expectPageAccessible(page, '/mes-collectes', 'Mes Collectes');
        await expectPageAccessible(page, '/collectes-jour', 'Collectes du Jour');
    });

    test('Test A2 : Agent NE PEUT PAS accéder aux pages Admin', async ({ page }) => {
        await loginAs(page, 'agent');

        console.log('\n=== Test A2 : Pages Admin bloquées ===');

        // Pages admin qui DOIVENT être bloquées
        await expectPageBlocked(page, '/admin/permissions', 'Admin Permissions');
        await expectPageBlocked(page, '/admin/roles', 'Admin Rôles');
        await expectPageBlocked(page, '/admin/utilisateurs', 'Admin Utilisateurs');
        await expectPageBlocked(page, '/admin/unites', 'Admin Unités');
        await expectPageBlocked(page, '/admin/categories', 'Admin Catégories');
    });

    test('Test A3 : Agent NE PEUT PAS accéder aux pages Analyse', async ({ page }) => {
        await loginAs(page, 'agent');

        console.log('\n=== Test A3 : Pages Analyse bloquées ===');

        // Pages d'analyse réservées aux décideurs/bailleurs
        await expectPageBlocked(page, '/tableau-bord-national', 'Vue Nationale');
        await expectPageBlocked(page, '/indicateurs-detailles', 'Indicateurs Détaillés');
        await expectPageBlocked(page, '/drilldown-geo', 'Drill-down Géo');
    });

    test('Test A4 : Menu agent ne contient pas Administration', async ({ page }) => {
        await loginAs(page, 'agent');

        console.log('\n=== Test A4 : Menu Administration absent ===');

        await expectMenuItems(
            page,
            ['Collectes', 'Alertes'], // Items attendus
            ['Administration', 'Analyse'] // Items NON attendus
        );
    });
});

// ============================================================================
// TEST SUITE 2 : Rôle DÉCIDEUR
// ============================================================================

test.describe('Contrôle d\'accès - Rôle DÉCIDEUR', () => {

    test('Test D1 : Décideur peut accéder aux pages de collectes', async ({ page }) => {
        await loginAs(page, 'decideur');

        console.log('\n=== Test D1 : Pages Collectes accessibles ===');

        await expectPageAccessible(page, '/collectes', 'Collectes');
        await expectPageAccessible(page, '/alertes', 'Alertes');
    });

    test('Test D2 : Décideur peut accéder aux pages Analyse', async ({ page }) => {
        await loginAs(page, 'decideur');

        console.log('\n=== Test D2 : Pages Analyse accessibles ===');

        // Pages d'analyse accessibles aux décideurs
        await expectPageAccessible(page, '/tableau-bord-national', 'Vue Nationale');
        await expectPageAccessible(page, '/indicateurs-detailles', 'Indicateurs Détaillés');
        await expectPageAccessible(page, '/drilldown-geo', 'Drill-down Géo');
    });

    test('Test D3 : Décideur NE PEUT PAS accéder aux pages Admin', async ({ page }) => {
        await loginAs(page, 'decideur');

        console.log('\n=== Test D3 : Pages Admin bloquées ===');

        // Pages admin réservées aux bailleurs uniquement
        await expectPageBlocked(page, '/admin/permissions', 'Admin Permissions');
        await expectPageBlocked(page, '/admin/roles', 'Admin Rôles');
        await expectPageBlocked(page, '/admin/utilisateurs', 'Admin Utilisateurs');
    });

    test('Test D4 : Menu décideur contient Analyse mais pas Administration', async ({ page }) => {
        await loginAs(page, 'decideur');

        console.log('\n=== Test D4 : Menu correct pour décideur ===');

        await expectMenuItems(
            page,
            ['Collectes', 'Alertes', 'Analyse'], // Items attendus
            ['Administration'] // Items NON attendus
        );
    });
});

// ============================================================================
// TEST SUITE 3 : Rôle BAILLEUR
// ============================================================================

test.describe('Contrôle d\'accès - Rôle BAILLEUR', () => {

    test('Test B1 : Bailleur peut accéder aux pages de collectes', async ({ page }) => {
        await loginAs(page, 'bailleur');

        console.log('\n=== Test B1 : Pages Collectes accessibles ===');

        await expectPageAccessible(page, '/collectes', 'Collectes');
        await expectPageAccessible(page, '/alertes', 'Alertes');
    });

    test('Test B2 : Bailleur peut accéder aux pages Analyse', async ({ page }) => {
        await loginAs(page, 'bailleur');

        console.log('\n=== Test B2 : Pages Analyse accessibles ===');

        await expectPageAccessible(page, '/tableau-bord-national', 'Vue Nationale');
        await expectPageAccessible(page, '/indicateurs-detailles', 'Indicateurs Détaillés');
        await expectPageAccessible(page, '/drilldown-geo', 'Drill-down Géo');
    });

    test('Test B3 : Bailleur peut accéder aux pages Admin', async ({ page }) => {
        await loginAs(page, 'bailleur');

        console.log('\n=== Test B3 : Pages Admin accessibles ===');

        // Toutes les pages admin accessibles
        await expectPageAccessible(page, '/admin/permissions', 'Admin Permissions');
        await expectPageAccessible(page, '/admin/roles', 'Admin Rôles');
        await expectPageAccessible(page, '/admin/utilisateurs', 'Admin Utilisateurs');
        await expectPageAccessible(page, '/admin/unites', 'Admin Unités');
        await expectPageAccessible(page, '/admin/categories', 'Admin Catégories');
        await expectPageAccessible(page, '/admin/produits', 'Admin Produits');
        await expectPageAccessible(page, '/admin/departements', 'Admin Départements');
        await expectPageAccessible(page, '/admin/communes', 'Admin Communes');
        await expectPageAccessible(page, '/admin/marches', 'Admin Marchés');
    });

    test('Test B4 : Menu bailleur contient Administration et Analyse', async ({ page }) => {
        await loginAs(page, 'bailleur');

        console.log('\n=== Test B4 : Menu complet pour bailleur ===');

        await expectMenuItems(
            page,
            ['Collectes', 'Alertes', 'Analyse', 'Administration'], // Tous items attendus
            [] // Aucun item à exclure
        );
    });
});

// ============================================================================
// TEST SUITE 4 : Tests d'intégration RBAC
// ============================================================================

test.describe('Intégration RBAC - Matrice de permissions complète', () => {

    test('Test I1 : Matrice complète des accès par rôle', async ({ page }) => {
        test.setTimeout(90000); // 90 secondes pour ce test long
        console.log('\n=== Test I1 : Vérification matrice complète ===');

        const testMatrix = [
            // [Route, Agent, Décideur, Bailleur]
            ['/collectes', true, true, true],
            ['/mes-collectes', true, true, true],
            ['/alertes', true, true, true],
            ['/tableau-bord-national', false, true, true],
            ['/indicateurs-detailles', false, true, true],
            ['/drilldown-geo', false, true, true],
            ['/admin/permissions', false, false, true],
            ['/admin/roles', false, false, true],
            ['/admin/utilisateurs', false, false, true],
            ['/admin/unites', false, false, true],
            ['/admin/categories', false, false, true],
            ['/admin/produits', false, false, true],
        ];

        // Tester Agent
        await loginAs(page, 'agent');
        console.log('\n  Testing Agent...');
        for (const [route, agentAccess] of testMatrix) {
            if (agentAccess) {
                await expectPageAccessible(page, route, route);
            } else {
                await expectPageBlocked(page, route, route);
            }
        }

        // Tester Décideur
        await page.goto(`${BASE_URL}/#/login`);
        await loginAs(page, 'decideur');
        console.log('\n  Testing Décideur...');
        for (const [route, , decideurAccess] of testMatrix) {
            if (decideurAccess) {
                await expectPageAccessible(page, route, route);
            } else {
                await expectPageBlocked(page, route, route);
            }
        }

        // Tester Bailleur
        await page.goto(`${BASE_URL}/#/login`);
        await loginAs(page, 'bailleur');
        console.log('\n  Testing Bailleur...');
        for (const [route, , , bailleurAccess] of testMatrix) {
            if (bailleurAccess) {
                await expectPageAccessible(page, route, route);
            }
        }

        console.log('\n✓ Matrice complète validée');
    });
});
