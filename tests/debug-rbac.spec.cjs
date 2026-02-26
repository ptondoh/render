const { test } = require('@playwright/test');

const BASE_URL = 'http://localhost:3000';

test('Debug RBAC - Vérifier les rôles de l\'agent', async ({ page }) => {
    // Activer la capture des logs console
    page.on('console', msg => {
        console.log(`[BROWSER] ${msg.text()}`);
    });

    // Nettoyer le localStorage
    await page.goto(`${BASE_URL}/#/login`);
    await page.evaluate(() => localStorage.clear());

    // Login agent
    await page.goto(`${BASE_URL}/#/login`);
    await page.waitForSelector('input[type="email"]');
    await page.fill('input[type="email"]', 'agent.test@sap.ht');
    await page.fill('input[type="password"]', 'Agent123!');
    await page.click('button[type="submit"]');

    // Attendre le dashboard
    await page.waitForURL(/dashboard/, { timeout: 15000 });

    // Inspecter l'utilisateur dans localStorage
    const userInfo = await page.evaluate(() => {
        const userStr = localStorage.getItem('user');
        if (!userStr) return null;
        const user = JSON.parse(userStr);
        return {
            email: user.email,
            roles: user.roles,
            role_names: user.role_names
        };
    });

    console.log('\n=== INFORMATIONS UTILISATEUR AGENT ===');
    console.log(JSON.stringify(userInfo, null, 2));

    // Tester hasRole directement
    const hasRoleResults = await page.evaluate(() => {
        // Charger le module auth
        return {
            hasAgent: window.auth?.hasRole('agent'),
            hasDecideur: window.auth?.hasRole('décideur'),
            hasBailleur: window.auth?.hasRole('bailleur'),
            currentUser: window.auth?.getCurrentUser()
        };
    });

    console.log('\n=== RÉSULTATS hasRole() ===');
    console.log('hasRole("agent"):', hasRoleResults.hasAgent);
    console.log('hasRole("décideur"):', hasRoleResults.hasDecideur);
    console.log('hasRole("bailleur"):', hasRoleResults.hasBailleur);
    console.log('\n=== User complet ===');
    console.log(JSON.stringify(hasRoleResults.currentUser, null, 2));

    // Attendre pour voir la page
    await page.waitForTimeout(3000);
});
