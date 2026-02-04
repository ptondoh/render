const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const FRONTEND_URL = 'http://localhost:3000';
const BACKEND_URL = 'http://localhost:8000';

// Couleurs pour la console
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

async function runTests() {
    log('\n╔════════════════════════════════════════════════════════╗', 'cyan');
    log('║   🧪 SUITE DE TESTS COMPLÈTE SAP - TOUS LES TESTS    ║', 'cyan');
    log('╚════════════════════════════════════════════════════════╝\n', 'cyan');

    const results = {
        passed: 0,
        failed: 0,
        tests: []
    };

    const browser = await chromium.launch({
        headless: false,
        slowMo: 50
    });

    const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 }
    });

    const page = await context.newPage();

    // Console listener pour capturer les erreurs
    const consoleErrors = [];
    page.on('console', msg => {
        if (msg.type() === 'error') {
            consoleErrors.push(msg.text());
        }
    });

    try {
        // ═══════════════════════════════════════════════════════
        // TEST 1 : Vérification fichiers essentiels
        // ═══════════════════════════════════════════════════════
        log('═══════════════════════════════════════════════════════', 'blue');
        log('TEST 1 : Vérification fichiers essentiels', 'blue');
        log('═══════════════════════════════════════════════════════', 'blue');

        const cssPath = path.join(__dirname, 'frontend', 'dist', 'output.css');
        const cssExists = fs.existsSync(cssPath);

        if (cssExists) {
            const cssStats = fs.statSync(cssPath);
            const cssSizeKB = (cssStats.size / 1024).toFixed(2);
            log(`✅ CSS Tailwind présent (${cssSizeKB} KB)`, 'green');
            results.passed++;
            results.tests.push({ name: 'CSS Tailwind présent', status: 'PASS' });
        } else {
            log('❌ CSS Tailwind MANQUANT !', 'red');
            results.failed++;
            results.tests.push({ name: 'CSS Tailwind présent', status: 'FAIL' });
        }

        // ═══════════════════════════════════════════════════════
        // TEST 2 : Backend disponible
        // ═══════════════════════════════════════════════════════
        log('\n═══════════════════════════════════════════════════════', 'blue');
        log('TEST 2 : Backend disponible', 'blue');
        log('═══════════════════════════════════════════════════════', 'blue');

        try {
            const backendResponse = await page.request.get(BACKEND_URL);
            if (backendResponse.ok() || backendResponse.status() === 404) {
                log('✅ Backend répond (port 8000)', 'green');
                results.passed++;
                results.tests.push({ name: 'Backend disponible', status: 'PASS' });
            } else {
                throw new Error('Backend non disponible');
            }
        } catch (error) {
            log('❌ Backend ne répond pas', 'red');
            log(`   Erreur: ${error.message}`, 'red');
            results.failed++;
            results.tests.push({ name: 'Backend disponible', status: 'FAIL' });
        }

        // ═══════════════════════════════════════════════════════
        // TEST 3 : Page de connexion charge correctement
        // ═══════════════════════════════════════════════════════
        log('\n═══════════════════════════════════════════════════════', 'blue');
        log('TEST 3 : Page de connexion', 'blue');
        log('═══════════════════════════════════════════════════════', 'blue');

        await page.goto(FRONTEND_URL, { waitUntil: 'networkidle' });
        await page.waitForTimeout(2000);

        // Vérifier que le CSS est chargé (pas d'erreur 404)
        const cssRequest = page.waitForResponse(
            response => response.url().includes('output.css'),
            { timeout: 5000 }
        ).catch(() => null);

        const cssResponse = await cssRequest;
        if (cssResponse && cssResponse.ok()) {
            log('✅ CSS chargé avec succès (200)', 'green');
            results.passed++;
            results.tests.push({ name: 'CSS chargé', status: 'PASS' });
        } else {
            log('❌ CSS non chargé ou erreur', 'red');
            results.failed++;
            results.tests.push({ name: 'CSS chargé', status: 'FAIL' });
        }

        // Vérifier que les éléments sont stylés (Tailwind appliqué)
        const buttonElement = await page.$('button[type="submit"]');
        if (buttonElement) {
            const bgColor = await buttonElement.evaluate(el =>
                window.getComputedStyle(el).backgroundColor
            );

            // Si pas de style, bgColor serait "rgba(0, 0, 0, 0)" ou similaire
            if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
                log('✅ Styles Tailwind appliqués (bouton stylé)', 'green');
                results.passed++;
                results.tests.push({ name: 'Styles Tailwind appliqués', status: 'PASS' });
            } else {
                log('❌ Styles Tailwind non appliqués', 'red');
                results.failed++;
                results.tests.push({ name: 'Styles Tailwind appliqués', status: 'FAIL' });
            }
        }

        // Vérifier absence message "Mode hors-ligne"
        const offlineBanner = await page.$('#connection-status');
        const isVisible = offlineBanner ? await offlineBanner.isVisible() : false;

        if (!isVisible) {
            log('✅ Pas de message "Mode hors-ligne"', 'green');
            results.passed++;
            results.tests.push({ name: 'Pas de mode hors-ligne', status: 'PASS' });
        } else {
            log('❌ Message "Mode hors-ligne" visible', 'red');
            results.failed++;
            results.tests.push({ name: 'Pas de mode hors-ligne', status: 'FAIL' });
        }

        // ═══════════════════════════════════════════════════════
        // TEST 4 : Service Worker désactivé
        // ═══════════════════════════════════════════════════════
        log('\n═══════════════════════════════════════════════════════', 'blue');
        log('TEST 4 : Service Worker', 'blue');
        log('═══════════════════════════════════════════════════════', 'blue');

        const swRegistrations = await page.evaluate(() => {
            return navigator.serviceWorker.getRegistrations().then(regs => regs.length);
        });

        if (swRegistrations === 0) {
            log('✅ Service Worker désactivé (0 registrations)', 'green');
            results.passed++;
            results.tests.push({ name: 'Service Worker désactivé', status: 'PASS' });
        } else {
            log(`⚠️  Service Worker actif (${swRegistrations} registrations)`, 'yellow');
            results.failed++;
            results.tests.push({ name: 'Service Worker désactivé', status: 'WARN' });
        }

        // ═══════════════════════════════════════════════════════
        // TEST 5 : Connexion Admin
        // ═══════════════════════════════════════════════════════
        log('\n═══════════════════════════════════════════════════════', 'blue');
        log('TEST 5 : Connexion Admin', 'blue');
        log('═══════════════════════════════════════════════════════', 'blue');

        await page.waitForSelector('input[type="email"]', { timeout: 10000 });
        await page.fill('input[type="email"]', 'admin@sap.ht');
        await page.fill('input[type="password"]', 'Test123!');
        await page.click('button[type="submit"]');

        await page.waitForTimeout(3000);

        const currentUrl = page.url();
        if (currentUrl.includes('dashboard')) {
            log('✅ Connexion admin réussie', 'green');
            results.passed++;
            results.tests.push({ name: 'Connexion admin', status: 'PASS' });
        } else {
            log('❌ Échec connexion admin', 'red');
            results.failed++;
            results.tests.push({ name: 'Connexion admin', status: 'FAIL' });
        }

        // ═══════════════════════════════════════════════════════
        // TEST 6 : Menu Administration complet
        // ═══════════════════════════════════════════════════════
        log('\n═══════════════════════════════════════════════════════', 'blue');
        log('TEST 6 : Menu Administration', 'blue');
        log('═══════════════════════════════════════════════════════', 'blue');

        const adminMenuButton = await page.$('#admin-menu-button');
        if (adminMenuButton) {
            await adminMenuButton.click();
            await page.waitForTimeout(500);

            const menuItems = [
                { selector: 'a[href="#/admin/unites"]', name: 'Unités de mesure' },
                { selector: 'a[href="#/admin/categories"]', name: 'Catégories' },
                { selector: 'a[href="#/admin/produits"]', name: 'Produits' },
                { selector: 'a[href="#/admin/departements"]', name: 'Départements' },
                { selector: 'a[href="#/admin/communes"]', name: 'Communes' },
                { selector: 'a[href="#/admin/marches"]', name: 'Marchés' }
            ];

            let allMenusPresent = true;
            for (const item of menuItems) {
                const element = await page.$(item.selector);
                if (element) {
                    log(`   ✅ ${item.name}`, 'green');
                } else {
                    log(`   ❌ ${item.name} MANQUANT`, 'red');
                    allMenusPresent = false;
                }
            }

            if (allMenusPresent) {
                results.passed++;
                results.tests.push({ name: 'Menu Administration complet', status: 'PASS' });
            } else {
                results.failed++;
                results.tests.push({ name: 'Menu Administration complet', status: 'FAIL' });
            }
        } else {
            log('❌ Menu Administration non trouvé', 'red');
            results.failed++;
            results.tests.push({ name: 'Menu Administration complet', status: 'FAIL' });
        }

        // ═══════════════════════════════════════════════════════
        // TEST 7 : Navigation pages admin
        // ═══════════════════════════════════════════════════════
        log('\n═══════════════════════════════════════════════════════', 'blue');
        log('TEST 7 : Navigation pages admin', 'blue');
        log('═══════════════════════════════════════════════════════', 'blue');

        const adminPages = [
            { url: '/admin/departements', name: 'Départements' },
            { url: '/admin/communes', name: 'Communes' },
            { url: '/admin/produits', name: 'Produits' },
            { url: '/admin/marches', name: 'Marchés' },
            { url: '/admin/unites', name: 'Unités de mesure' }
        ];

        let allPagesWork = true;
        for (const adminPage of adminPages) {
            await page.goto(`${FRONTEND_URL}/#${adminPage.url}`);
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(1500);

            const pageTitle = await page.textContent('h1, h2').catch(() => null);
            if (pageTitle) {
                log(`   ✅ ${adminPage.name} accessible`, 'green');
            } else {
                log(`   ❌ ${adminPage.name} erreur`, 'red');
                allPagesWork = false;
            }
        }

        if (allPagesWork) {
            results.passed++;
            results.tests.push({ name: 'Pages admin accessibles', status: 'PASS' });
        } else {
            results.failed++;
            results.tests.push({ name: 'Pages admin accessibles', status: 'FAIL' });
        }

        // ═══════════════════════════════════════════════════════
        // TEST 8 : Page Collectes
        // ═══════════════════════════════════════════════════════
        log('\n═══════════════════════════════════════════════════════', 'blue');
        log('TEST 8 : Page Collectes', 'blue');
        log('═══════════════════════════════════════════════════════', 'blue');

        await page.goto(`${FRONTEND_URL}/#/collectes`);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        const collectesTitle = await page.textContent('h1, h2').catch(() => null);
        if (collectesTitle) {
            log('✅ Page Collectes accessible', 'green');
            results.passed++;
            results.tests.push({ name: 'Page Collectes', status: 'PASS' });
        } else {
            log('❌ Page Collectes erreur', 'red');
            results.failed++;
            results.tests.push({ name: 'Page Collectes', status: 'FAIL' });
        }

        // ═══════════════════════════════════════════════════════
        // TEST 9 : Page Alertes
        // ═══════════════════════════════════════════════════════
        log('\n═══════════════════════════════════════════════════════', 'blue');
        log('TEST 9 : Page Alertes', 'blue');
        log('═══════════════════════════════════════════════════════', 'blue');

        await page.goto(`${FRONTEND_URL}/#/alertes`);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        const alertesTitle = await page.textContent('h1, h2').catch(() => null);
        if (alertesTitle) {
            log('✅ Page Alertes accessible', 'green');
            results.passed++;
            results.tests.push({ name: 'Page Alertes', status: 'PASS' });
        } else {
            log('❌ Page Alertes erreur', 'red');
            results.failed++;
            results.tests.push({ name: 'Page Alertes', status: 'FAIL' });
        }

        // ═══════════════════════════════════════════════════════
        // TEST 10 : Captures d'écran finales
        // ═══════════════════════════════════════════════════════
        log('\n═══════════════════════════════════════════════════════', 'blue');
        log('TEST 10 : Captures d\'écran', 'blue');
        log('═══════════════════════════════════════════════════════', 'blue');

        await page.goto(`${FRONTEND_URL}/#/dashboard`);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);
        await page.screenshot({
            path: 'test_final_dashboard.png',
            fullPage: true
        });
        log('📸 test_final_dashboard.png', 'cyan');

        await page.goto(`${FRONTEND_URL}/#/admin/departements`);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);
        await page.screenshot({
            path: 'test_final_departements.png',
            fullPage: true
        });
        log('📸 test_final_departements.png', 'cyan');

        results.passed++;
        results.tests.push({ name: 'Captures d\'écran', status: 'PASS' });

        // ═══════════════════════════════════════════════════════
        // TEST 11 : Erreurs console
        // ═══════════════════════════════════════════════════════
        log('\n═══════════════════════════════════════════════════════', 'blue');
        log('TEST 11 : Erreurs console', 'blue');
        log('═══════════════════════════════════════════════════════', 'blue');

        if (consoleErrors.length === 0) {
            log('✅ Aucune erreur console', 'green');
            results.passed++;
            results.tests.push({ name: 'Aucune erreur console', status: 'PASS' });
        } else {
            log(`⚠️  ${consoleErrors.length} erreur(s) console`, 'yellow');
            consoleErrors.slice(0, 5).forEach(err => {
                log(`   - ${err.substring(0, 100)}`, 'yellow');
            });
            results.tests.push({ name: 'Aucune erreur console', status: 'WARN' });
        }

    } catch (error) {
        log(`\n❌ ERREUR CRITIQUE: ${error.message}`, 'red');
        console.error(error);
        results.failed++;
    } finally {
        await browser.close();
    }

    // ═══════════════════════════════════════════════════════
    // RÉSULTATS FINAUX
    // ═══════════════════════════════════════════════════════
    log('\n\n╔════════════════════════════════════════════════════════╗', 'cyan');
    log('║              📊 RÉSULTATS FINAUX                      ║', 'cyan');
    log('╚════════════════════════════════════════════════════════╝\n', 'cyan');

    log(`✅ Tests réussis  : ${results.passed}`, 'green');
    log(`❌ Tests échoués  : ${results.failed}`, results.failed > 0 ? 'red' : 'green');
    log(`📋 Total tests    : ${results.tests.length}\n`);

    const successRate = ((results.passed / results.tests.length) * 100).toFixed(1);

    if (successRate === 100) {
        log('🎉 PARFAIT ! 100% DE RÉUSSITE !', 'green');
        log('✅ Tous les problèmes sont résolus définitivement', 'green');
    } else if (successRate >= 90) {
        log(`✅ EXCELLENT ! ${successRate}% de réussite`, 'green');
    } else if (successRate >= 75) {
        log(`⚠️  BON : ${successRate}% de réussite`, 'yellow');
    } else {
        log(`❌ NÉCESSITE ATTENTION : ${successRate}% de réussite`, 'red');
    }

    log('\n📝 Détail des tests:', 'cyan');
    results.tests.forEach((test, index) => {
        const icon = test.status === 'PASS' ? '✅' : test.status === 'WARN' ? '⚠️ ' : '❌';
        const color = test.status === 'PASS' ? 'green' : test.status === 'WARN' ? 'yellow' : 'red';
        log(`   ${index + 1}. ${icon} ${test.name}`, color);
    });

    log('\n═══════════════════════════════════════════════════════\n', 'cyan');
}

// Exécution
runTests().catch(console.error);
