const { chromium } = require('playwright');

const FRONTEND_URL = 'http://localhost:3000';

(async () => {
    console.log('🔍 Debug test connexion...\n');

    const browser = await chromium.launch({ headless: false, slowMo: 500 });
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

    try {
        // 1. Charger la page
        console.log('1. Chargement de la page de connexion...');
        await page.goto(FRONTEND_URL);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);

        console.log('   URL actuelle:', page.url());

        // 2. Vérifier CSS
        console.log('\n2. Vérification du CSS...');
        const cssLink = await page.$('link[href*="output.css"]');
        if (cssLink) {
            const href = await cssLink.getAttribute('href');
            console.log('   ✅ Link CSS trouvé:', href);
        } else {
            console.log('   ❌ Link CSS non trouvé');
        }

        // 3. Prendre screenshot avant connexion
        await page.screenshot({ path: 'debug_avant_connexion.png' });
        console.log('   📸 debug_avant_connexion.png');

        // 4. Chercher le formulaire
        console.log('\n3. Recherche du formulaire...');
        const emailInput = await page.$('input[type="email"]');
        const passwordInput = await page.$('input[type="password"]');
        const submitButton = await page.$('button[type="submit"]');

        console.log('   Email input:', emailInput ? '✅' : '❌');
        console.log('   Password input:', passwordInput ? '✅' : '❌');
        console.log('   Submit button:', submitButton ? '✅' : '❌');

        if (!emailInput || !passwordInput || !submitButton) {
            console.log('\n❌ Formulaire incomplet, attente plus longue...');
            await page.waitForTimeout(5000);
        }

        // 5. Remplir et soumettre
        console.log('\n4. Connexion...');
        await page.fill('input[type="email"]', 'admin@sap.ht');
        await page.fill('input[type="password"]', 'Admin123!');

        console.log('   Formulaire rempli');

        await page.click('button[type="submit"]');
        console.log('   Bouton cliqué');

        // 6. Attendre navigation
        console.log('\n5. Attente navigation...');
        await page.waitForTimeout(5000);

        const newUrl = page.url();
        console.log('   URL après connexion:', newUrl);

        if (newUrl.includes('dashboard')) {
            console.log('   ✅ CONNEXION RÉUSSIE !');
        } else if (newUrl.includes('login')) {
            console.log('   ❌ Toujours sur login - échec connexion');

            // Vérifier erreur
            const errorMsg = await page.$('.error, .alert').catch(() => null);
            if (errorMsg) {
                const errorText = await errorMsg.textContent();
                console.log('   Erreur affichée:', errorText);
            }
        } else {
            console.log('   ⚠️  URL inattendue:', newUrl);
        }

        // 7. Screenshot après
        await page.screenshot({ path: 'debug_apres_connexion.png', fullPage: true });
        console.log('   📸 debug_apres_connexion.png');

        console.log('\n✅ Debug terminé');

    } catch (error) {
        console.error('\n❌ ERREUR:', error.message);
        await page.screenshot({ path: 'debug_erreur.png', fullPage: true });
    } finally {
        await browser.close();
    }
})();
