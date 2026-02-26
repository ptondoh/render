const { test } = require('@playwright/test');
const path = require('path');

const BASE_URL = 'http://localhost:3000';

async function debugMenus(page, roleName, email, password) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`DEBUGGING UI POUR : ${roleName.toUpperCase()}`);
    console.log('='.repeat(60));

    // Capturer les logs console
    page.on('console', msg => {
        if (msg.text().includes('RBAC') || msg.text().includes('role')) {
            console.log(`[BROWSER ${roleName}] ${msg.text()}`);
        }
    });

    // Nettoyer le cache
    await page.goto(`${BASE_URL}/#/login`);
    await page.evaluate(() => localStorage.clear());

    // Login
    await page.goto(`${BASE_URL}/#/login`);
    await page.waitForSelector('input[type="email"]');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard/, { timeout: 15000 });

    // Attendre que les menus se mettent à jour
    await page.waitForTimeout(2000);

    // 1. Inspecter localStorage
    const userInfo = await page.evaluate(() => {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        return {
            email: user.email,
            roles: user.roles,
            role_names: user.role_names
        };
    });
    console.log('\n1. USER dans localStorage:');
    console.log(JSON.stringify(userInfo, null, 2));

    // 2. Vérifier les appels hasRole
    const authChecks = await page.evaluate(() => {
        const checks = {};
        if (window.auth) {
            const user = window.auth.getCurrentUser();
            checks.currentUser = {
                email: user?.email,
                roles: user?.roles,
                role_names: user?.role_names
            };
            checks.hasAgent = window.auth.hasRole('agent');
            checks.hasDecideur = window.auth.hasRole('décideur');
            checks.hasBailleur = window.auth.hasRole('bailleur');
            checks.hasAnalyseAccess = window.auth.hasAnyRole(['décideur', 'bailleur']);
        }
        return checks;
    });
    console.log('\n2. CHECKS hasRole():');
    console.log(JSON.stringify(authChecks, null, 2));

    // 3. Inspecter les éléments de menu
    const menuState = await page.evaluate(() => {
        const state = {};

        const adminDesktop = document.getElementById('admin-menu-desktop');
        const adminMobile = document.getElementById('admin-menu-mobile');
        const analyseDesktop = document.getElementById('analyse-menu-desktop');
        const analyseMobile = document.getElementById('analyse-menu-mobile');

        state.adminDesktop = {
            exists: !!adminDesktop,
            hasHiddenClass: adminDesktop?.classList.contains('hidden'),
            classes: adminDesktop?.className,
            visible: adminDesktop ? (adminDesktop.offsetWidth > 0 && adminDesktop.offsetHeight > 0) : false
        };

        state.adminMobile = {
            exists: !!adminMobile,
            hasHiddenClass: adminMobile?.classList.contains('hidden'),
            classes: adminMobile?.className,
            visible: adminMobile ? (adminMobile.offsetWidth > 0 && adminMobile.offsetHeight > 0) : false
        };

        state.analyseDesktop = {
            exists: !!analyseDesktop,
            hasHiddenClass: analyseDesktop?.classList.contains('hidden'),
            classes: analyseDesktop?.className,
            visible: analyseDesktop ? (analyseDesktop.offsetWidth > 0 && analyseDesktop.offsetHeight > 0) : false
        };

        state.analyseMobile = {
            exists: !!analyseMobile,
            hasHiddenClass: analyseMobile?.classList.contains('hidden'),
            classes: analyseMobile?.className,
            visible: analyseMobile ? (analyseMobile.offsetWidth > 0 && analyseMobile.offsetHeight > 0) : false
        };

        return state;
    });
    console.log('\n3. ÉTAT DES MENUS:');
    console.log(JSON.stringify(menuState, null, 2));

    // 4. Vérifier si updateUI() a été appelé
    const updateUILog = await page.evaluate(() => {
        return {
            mainNavHidden: document.getElementById('main-nav')?.classList.contains('hidden'),
            userNameText: document.getElementById('user-name')?.textContent,
            userInitials: document.getElementById('user-initials')?.textContent
        };
    });
    console.log('\n4. VÉRIFICATION updateUI():');
    console.log(JSON.stringify(updateUILog, null, 2));

    // 5. Prendre une capture d'écran
    const screenshotPath = path.join(__dirname, '..', 'test-results', `ui-${roleName}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`\n5. SCREENSHOT: ${screenshotPath}`);

    // 6. Lister tous les liens de navigation visibles
    const visibleMenuItems = await page.evaluate(() => {
        const nav = document.querySelector('nav');
        if (!nav) return [];

        const links = Array.from(nav.querySelectorAll('a, button'));
        return links
            .filter(el => el.offsetWidth > 0 && el.offsetHeight > 0)
            .map(el => ({
                text: el.textContent.trim().replace(/\s+/g, ' '),
                href: el.getAttribute('href'),
                visible: !el.closest('.hidden')
            }));
    });
    console.log('\n6. LIENS MENU VISIBLES:');
    visibleMenuItems.forEach(item => {
        console.log(`  - ${item.text} ${item.visible ? '✓' : '✗ (parent hidden)'}`);
    });

    console.log('\n' + '='.repeat(60) + '\n');
}

test('Debug UI - Comparer les 3 rôles', async ({ page }) => {
    // Agent
    await debugMenus(page, 'agent', 'agent.test@sap.ht', 'Agent123!');

    // Décideur
    await debugMenus(page, 'decideur', 'decideur.test@sap.ht', 'Decideur123!');

    // Bailleur
    await debugMenus(page, 'bailleur', 'admin@sap.ht', 'Test123!');

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║  DIAGNOSTIC TERMINÉ - Vérifiez les captures d\'écran        ║');
    console.log('║  et les logs ci-dessus pour identifier le problème         ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
});
