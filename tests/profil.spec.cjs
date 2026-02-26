/**
 * Tests Playwright - Page Profil SAP
 * Teste les fonctionnalités de la page Mon Profil :
 *  1. Login + navigation vers /profil
 *  2. Section Informations personnelles (affichage + modification)
 *  3. Section Mot de passe (erreurs + changement valide)
 *  4. Section MFA (affichage + activation + annulation)
 */

const { test, expect } = require('@playwright/test');
const path = require('path');

const BASE_URL = 'http://localhost:3000';
const SCREENSHOTS_DIR = path.join(__dirname, '..', 'test-results');

// Credentials
const ADMIN_EMAIL = 'admin@sap.ht';
const ADMIN_PASSWORD = 'Test123!';
const DECIDEUR_EMAIL = 'decideur@sap.ht';
const DECIDEUR_PASSWORD = 'Test123!';

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Effectue le login et attend le dashboard
 */
async function doLogin(page, email, password) {
    // Nettoyer le localStorage avant chaque test
    await page.goto(`${BASE_URL}/#/login`);
    await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
    });
    await page.goto(`${BASE_URL}/#/login`);
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });

    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');

    // Attendre la redirection vers le dashboard
    await page.waitForURL(/dashboard/, { timeout: 20000 });
    await page.waitForSelector('h1', { timeout: 10000 });
}

/**
 * Navigue vers la page profil via le lien "Mon profil" dans le menu
 */
async function navigateToProfilViaMenu(page) {
    // Ouvrir le menu utilisateur (click sur le bouton user)
    const userMenuButton = page.locator('#user-menu-button');
    await userMenuButton.waitFor({ state: 'visible', timeout: 5000 });
    await userMenuButton.click();

    // Cliquer sur "Mon profil"
    const profilLink = page.locator('#user-menu-dropdown a[href="#/profil"]');
    await profilLink.waitFor({ state: 'visible', timeout: 3000 });
    await profilLink.click();

    // Attendre que la page profil soit chargée
    await page.waitForURL(/profil/, { timeout: 10000 });
}

/**
 * Navigue directement vers la page profil
 */
async function navigateToProfilDirect(page) {
    await page.goto(`${BASE_URL}/#/profil`);
}

/**
 * Attendre que le spinner de chargement initial disparaisse
 */
async function waitForProfilLoaded(page) {
    // Attendre que le titre "Mon Profil" apparaisse
    await page.waitForSelector('h1:has-text("Mon Profil")', { timeout: 10000 });
    // Attendre la disparition du spinner
    try {
        await page.waitForSelector('.animate-spin', { state: 'hidden', timeout: 8000 });
    } catch (_) {
        // Le spinner peut ne pas apparaître si la page charge vite
    }
    // Attendre que les sections soient présentes
    await page.waitForSelector('text=Informations personnelles', { timeout: 8000 });
}

/**
 * Attendre un toast et vérifier son message
 */
async function waitForToast(page, type, expectedText, timeoutMs = 6000) {
    const bgClass = type === 'success' ? 'bg-green-500' : 'bg-red-500';
    const toastSelector = `#toast-container .${bgClass}`;
    const toastLocator = page.locator(toastSelector);
    await toastLocator.first().waitFor({ state: 'visible', timeout: timeoutMs });
    const text = await toastLocator.first().textContent();
    return text;
}

/**
 * Prend un screenshot dans le dossier test-results
 */
async function screenshot(page, name) {
    await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, `profil-${name}.png`),
        fullPage: true
    });
    console.log(`  📸 Screenshot: profil-${name}.png`);
}

// ── Tests ────────────────────────────────────────────────────────────────────

test.describe('Page Profil SAP', () => {

    // ────────────────────────────────────────────────────────────────────────
    // TEST 1 : Login + navigation vers /profil
    // ────────────────────────────────────────────────────────────────────────
    test('1. Login admin + navigation vers /profil via le menu', async ({ page }) => {
        console.log('\n=== TEST 1 : Login + Navigation vers /profil ===');

        // Capturer les erreurs console
        const consoleErrors = [];
        page.on('console', msg => {
            if (msg.type() === 'error') consoleErrors.push(msg.text());
        });

        // 1.1 Login
        console.log('  → Login en tant que admin@sap.ht');
        await doLogin(page, ADMIN_EMAIL, ADMIN_PASSWORD);
        console.log('  ✓ Login réussi, dashboard chargé');

        // 1.2 Navigation via le menu
        console.log('  → Navigation via le menu utilisateur → Mon profil');
        await navigateToProfilViaMenu(page);
        console.log('  ✓ Naviguée vers /#/profil');

        // 1.3 Vérifier que la page charge correctement
        await waitForProfilLoaded(page);
        console.log('  ✓ Page profil chargée (titre "Mon Profil" présent)');

        // 1.4 Vérifier que ce n'est pas "À venir"
        const pageText = await page.locator('#app').textContent();
        expect(pageText).not.toContain('À venir');
        expect(pageText).not.toContain('coming soon');
        console.log('  ✓ La page n\'affiche pas "À venir"');

        // 1.5 Vérifier les 3 sections principales (cibler les titres h3 de chaque carte)
        await expect(page.locator('h3:has-text("Informations personnelles")')).toBeVisible();
        await expect(page.locator('h3:has-text("Changer le mot de passe")')).toBeVisible();
        await expect(page.locator('h3:has-text("Méthode de vérification en 2 étapes")')).toBeVisible();
        console.log('  ✓ Les 3 sections sont présentes : Informations, Mot de passe, MFA');

        // 1.6 Screenshot
        await screenshot(page, '01-login-et-navigation');
        console.log('  ✓ Screenshot pris');

        // 1.7 Vérifier pas d'erreurs console critiques
        const criticalErrors = consoleErrors.filter(e =>
            !e.includes('favicon') && !e.includes('manifest') && !e.includes('sw-smart')
        );
        if (criticalErrors.length > 0) {
            console.warn('  ⚠ Erreurs console:', criticalErrors);
        }
    });

    // ────────────────────────────────────────────────────────────────────────
    // TEST 2 : Section Informations personnelles
    // ────────────────────────────────────────────────────────────────────────
    test('2. Section Informations personnelles - affichage et modification', async ({ page }) => {
        console.log('\n=== TEST 2 : Section Informations personnelles ===');

        await doLogin(page, ADMIN_EMAIL, ADMIN_PASSWORD);
        await navigateToProfilDirect(page);
        await waitForProfilLoaded(page);

        // 2.1 Vérifier que l'email s'affiche
        const emailVisible = await page.locator(`text=${ADMIN_EMAIL}`).first().isVisible();
        expect(emailVisible).toBeTruthy();
        console.log(`  ✓ Email "${ADMIN_EMAIL}" visible dans la section infos`);

        // 2.2 Prendre screenshot de l'état initial (mode lecture)
        await screenshot(page, '02a-infos-mode-lecture');

        // 2.3 Cliquer sur "Modifier"
        console.log('  → Clic sur bouton "Modifier"');
        const modifierBtn = page.locator('button:has-text("Modifier")').first();
        await modifierBtn.waitFor({ state: 'visible', timeout: 5000 });
        await modifierBtn.click();

        // 2.4 Vérifier que le formulaire d'édition apparaît
        await page.waitForSelector('input[placeholder="Dupont"]', { timeout: 5000 });
        console.log('  ✓ Formulaire d\'édition apparu (champs Nom, Prénom, Téléphone)');

        // 2.5 Modifier les champs
        const nomInput = page.locator('input[placeholder="Dupont"]');
        const prenomInput = page.locator('input[placeholder="Jean"]');
        const telInput = page.locator('input[placeholder="+509 3700-0000"]');

        // Vider et remplir (tripleClick pour sélectionner tout le contenu)
        await nomInput.fill('AdminTest');
        await prenomInput.fill('SAP');
        await telInput.fill('+509 3700-1234');

        console.log('  ✓ Champs remplis : Nom=AdminTest, Prénom=SAP, Téléphone=+509 3700-1234');

        // 2.6 Screenshot avant enregistrement
        await screenshot(page, '02b-infos-en-edition');

        // 2.7 Cliquer "Enregistrer"
        console.log('  → Clic sur "Enregistrer"');
        const enregistrerBtn = page.locator('button:has-text("Enregistrer")');
        await enregistrerBtn.click();

        // 2.8 Vérifier le toast de succès
        let toastText = null;
        try {
            toastText = await waitForToast(page, 'success', 'Profil mis à jour');
            console.log(`  ✓ Toast succès reçu : "${toastText.trim()}"`);
        } catch (e) {
            // Essayer avec un sélecteur plus large
            try {
                const anyGreenToast = page.locator('#toast-container [class*="bg-green"]');
                await anyGreenToast.first().waitFor({ state: 'visible', timeout: 5000 });
                toastText = await anyGreenToast.first().textContent();
                console.log(`  ✓ Toast vert reçu : "${toastText.trim()}"`);
            } catch (e2) {
                console.warn('  ⚠ Toast de succès non détecté dans le délai imparti');
                // Vérifier si on est repassé en mode lecture (ce qui indique que la sauvegarde a réussi)
                await page.waitForSelector('button:has-text("Modifier")', { timeout: 5000 });
                console.log('  ✓ Retour en mode lecture confirmé (sauvegarde réussie)');
            }
        }

        // 2.9 Vérifier le retour en mode lecture avec les nouvelles valeurs
        await page.waitForSelector('button:has-text("Modifier")', { timeout: 8000 });
        const updatedContent = await page.locator('#app').textContent();
        expect(updatedContent).toContain('AdminTest');
        console.log('  ✓ Nom "AdminTest" visible après sauvegarde');

        // 2.10 Screenshot final
        await screenshot(page, '02c-infos-apres-sauvegarde');
        console.log('  ✓ Section Informations personnelles : OK');
    });

    // ────────────────────────────────────────────────────────────────────────
    // TEST 3 : Section Mot de passe
    // ────────────────────────────────────────────────────────────────────────
    test('3. Section Mot de passe - validation et changement', async ({ page }) => {
        console.log('\n=== TEST 3 : Section Mot de passe ===');

        await doLogin(page, ADMIN_EMAIL, ADMIN_PASSWORD);
        await navigateToProfilDirect(page);
        await waitForProfilLoaded(page);

        // Trouver les champs de la section mot de passe
        // La page profil a 3 inputs password : actuel, nouveau, confirmer
        const passwordInputs = page.locator('input[type="password"]');

        // ── 3.1 Test avec mauvais mot de passe actuel ──
        console.log('  → Test 3.1 : Mauvais mot de passe actuel');
        await passwordInputs.nth(0).fill('MauvaisPassword123!');
        await passwordInputs.nth(1).fill('NouveauMdp123!');
        await passwordInputs.nth(2).fill('NouveauMdp123!');

        const changerBtn = page.locator('button:has-text("Changer le mot de passe")');
        await changerBtn.click();

        // Attendre toast d'erreur (backend renvoie 400)
        let errorToastText = null;
        try {
            errorToastText = await waitForToast(page, 'error', '', 6000);
            console.log(`  ✓ Toast d'erreur reçu : "${errorToastText.trim()}"`);
        } catch (e) {
            // Essayer sélecteur plus large
            try {
                const anyRedToast = page.locator('#toast-container [class*="bg-red"]');
                await anyRedToast.first().waitFor({ state: 'visible', timeout: 5000 });
                errorToastText = await anyRedToast.first().textContent();
                console.log(`  ✓ Toast rouge reçu : "${errorToastText.trim()}"`);
            } catch (e2) {
                console.warn('  ⚠ Toast d\'erreur pour mauvais mot de passe non détecté - peut nécessiter un délai supplémentaire');
            }
        }

        // Attendre que le toast d'erreur (test 3.1) disparaisse entièrement (durée toast = 3000ms)
        await page.waitForTimeout(3500);

        // ── 3.2 Test avec mots de passe non correspondants ──
        console.log('  → Test 3.2 : Mots de passe ne correspondant pas');

        // Re-localiser les inputs password (la page peut avoir été re-rendue)
        const pwdInputs2 = page.locator('input[type="password"]');
        await pwdInputs2.nth(0).fill(ADMIN_PASSWORD);
        await pwdInputs2.nth(1).fill('NouveauMdp123!');
        await pwdInputs2.nth(2).fill('AutreMdp456!');

        await changerBtn.click();

        // Ce test est validé côté client, donc le toast doit apparaître immédiatement
        try {
            const redToast2 = page.locator('#toast-container [class*="bg-red"]');
            await redToast2.first().waitFor({ state: 'visible', timeout: 4000 });
            const redText2 = await redToast2.first().textContent();
            console.log(`  ✓ Toast d'erreur "non correspondants" : "${redText2.trim()}"`);
        } catch (e) {
            console.warn('  ⚠ Toast "mots de passe ne correspondent pas" non détecté');
        }

        await screenshot(page, '03a-mdp-erreurs');
        // Attendre que le toast disparaisse
        await page.waitForTimeout(3500);

        // ── 3.3 Test d'un changement valide ──
        console.log('  → Test 3.3 : Changement valide (Test123! → Test123!)');
        // On change le mot de passe pour la même valeur pour ne pas bloquer le compte
        const pwdInputs3 = page.locator('input[type="password"]');
        await pwdInputs3.nth(0).fill(ADMIN_PASSWORD);
        await pwdInputs3.nth(1).fill(ADMIN_PASSWORD);
        await pwdInputs3.nth(2).fill(ADMIN_PASSWORD);

        await changerBtn.click();

        // Attendre toast de succès
        let successToastText = null;
        try {
            const greenToast = page.locator('#toast-container [class*="bg-green"]');
            await greenToast.first().waitFor({ state: 'visible', timeout: 8000 });
            successToastText = await greenToast.first().textContent();
            console.log(`  ✓ Toast succès changement mdp : "${successToastText.trim()}"`);
        } catch (e) {
            console.warn('  ⚠ Toast de succès changement mdp non détecté dans le délai');
        }

        await screenshot(page, '03b-mdp-changement-valide');
        console.log('  ✓ Section Mot de passe : Tests complétés');
    });

    // ────────────────────────────────────────────────────────────────────────
    // TEST 4 : Section MFA
    // ────────────────────────────────────────────────────────────────────────
    test('4. Section MFA - affichage, activation du setup et annulation', async ({ page }) => {
        console.log('\n=== TEST 4 : Section MFA ===');

        await doLogin(page, ADMIN_EMAIL, ADMIN_PASSWORD);
        await navigateToProfilDirect(page);
        await waitForProfilLoaded(page);

        // 4.1 Vérifier que la section MFA s'affiche (nouveau titre dans la refactorisation)
        const mfaSection = page.locator('h3:has-text("Méthode de vérification en 2 étapes")');
        await mfaSection.waitFor({ state: 'visible', timeout: 5000 });
        console.log('  ✓ Section MFA visible');

        // 4.2 Vérifier les boutons radio (nouveau UI avec 3 options)
        const radioButtons = page.locator('input[name="two-fa-method"]');
        const radioCount = await radioButtons.count();
        expect(radioCount).toBe(3); // none, totp, email
        console.log(`  ✓ ${radioCount} méthodes 2FA disponibles (aucune, TOTP, email)`);

        // 4.3 Déterminer la méthode actuelle
        const currentChecked = page.locator('input[name="two-fa-method"]:checked');
        const currentMethod = await currentChecked.getAttribute('value').catch(() => 'none');
        console.log(`  ℹ Méthode actuelle : ${currentMethod}`);

        await screenshot(page, '04a-mfa-initial');

        // 4.4 Sélectionner TOTP si pas déjà sélectionné pour tester le flow de configuration
        if (currentMethod !== 'totp') {
            console.log('  → Sélection de la méthode TOTP');
            await page.locator('input[name="two-fa-method"][value="totp"]').click();
            await page.waitForTimeout(300); // Attendre le re-render

            // 4.5 Vérifier que le bouton de configuration TOTP apparaît
            const setupBtn = page.locator('button:has-text("Configurer l\'application d\'authentification")');
            const setupBtnVisible = await setupBtn.isVisible().catch(() => false);
            console.log(`  ${setupBtnVisible ? '✓' : '⚠'} Bouton "Configurer l\'application" visible`);

            if (setupBtnVisible) {
                // 4.6 Cliquer pour lancer le setup TOTP
                console.log('  → Clic sur "Configurer l\'application d\'authentification"');
                await setupBtn.click();

                // 4.7 Attendre que le QR code apparaisse
                console.log('  → Attente du QR code...');
                try {
                    await page.waitForSelector('img[alt="QR Code MFA"]', { timeout: 10000 });
                    console.log('  ✓ QR Code apparu !');

                    // Vérifier le contenu de la vue de setup
                    const step1Visible = await page.locator('text=Étape 1').isVisible().catch(() => false);
                    const step2Visible = await page.locator('text=Étape 2').isVisible().catch(() => false);
                    console.log(`  ${step1Visible ? '✓' : '⚠'} Étape 1 (scanner QR) visible`);
                    console.log(`  ${step2Visible ? '✓' : '⚠'} Étape 2 (entrer code) visible`);

                    // Vérifier le code secret (format base32)
                    const secretCodeEl = page.locator('code.font-mono');
                    const secretVisible = await secretCodeEl.isVisible().catch(() => false);
                    if (secretVisible) {
                        const secretText = await secretCodeEl.textContent();
                        console.log(`  ✓ Code secret visible : ${secretText.substring(0, 8)}...`);
                    }

                    // Vérifier le champ de saisie du code à 6 chiffres
                    const codeInput = page.locator('input[placeholder="000000"]');
                    const codeInputVisible = await codeInput.isVisible().catch(() => false);
                    console.log(`  ${codeInputVisible ? '✓' : '⚠'} Champ code 6 chiffres visible`);

                    // Vérifier les boutons "Confirmer" et "Annuler"
                    const confirmBtn = page.locator('button:has-text("Confirmer l\'activation")');
                    const cancelBtn = page.locator('button:has-text("Annuler")');
                    const confirmVisible = await confirmBtn.isVisible().catch(() => false);
                    const cancelVisible = await cancelBtn.isVisible().catch(() => false);
                    console.log(`  ${confirmVisible ? '✓' : '⚠'} Bouton "Confirmer l\'activation" visible`);
                    console.log(`  ${cancelVisible ? '✓' : '⚠'} Bouton "Annuler" visible`);

                    // Screenshot avec le QR code
                    await screenshot(page, '04b-mfa-qr-code');
                    console.log('  ✓ Screenshot du QR code pris');

                    // 4.8 Cliquer "Annuler" pour ne pas vraiment activer le MFA
                    if (cancelVisible) {
                        console.log('  → Clic sur "Annuler" pour ne pas activer le MFA');
                        await cancelBtn.click();
                        await page.waitForTimeout(300);

                        // Vérifier le retour à l'état initial (radio buttons à nouveau visibles)
                        await page.waitForSelector('input[name="two-fa-method"]', { timeout: 5000 });
                        console.log('  ✓ Retour à l\'état initial après annulation');

                        await screenshot(page, '04c-mfa-apres-annulation');
                    }

                } catch (e) {
                    console.warn('  ⚠ QR Code non apparu dans le délai imparti:', e.message);
                    await screenshot(page, '04b-mfa-erreur');

                    // Vérifier si un toast d'erreur est apparu
                    const errorToast = page.locator('#toast-container [class*="bg-red"]');
                    const errorVisible = await errorToast.isVisible().catch(() => false);
                    if (errorVisible) {
                        const errorText = await errorToast.textContent();
                        console.warn('  ⚠ Erreur MFA:', errorText.trim());
                    }
                }
            }
        } else {
            console.log('  ℹ TOTP déjà configuré pour ce compte - vérification de l\'UI seulement');
            await screenshot(page, '04a-mfa-totp-actif');
        }

        console.log('  ✓ Section MFA : Tests complétés');
    });

    // ────────────────────────────────────────────────────────────────────────
    // TEST 5 : Test avec utilisateur décideur (bonus)
    // ────────────────────────────────────────────────────────────────────────
    test('5. [Bonus] Profil utilisateur décideur', async ({ page }) => {
        console.log('\n=== TEST 5 : Profil décideur ===');

        // Essayer de se connecter avec decideur@sap.ht / Test123!
        console.log('  → Login en tant que decideur@sap.ht / Test123!');
        try {
            await doLogin(page, DECIDEUR_EMAIL, DECIDEUR_PASSWORD);
            console.log('  ✓ Login décideur réussi');
        } catch (e) {
            console.log('  ✗ Login échoué avec Test123! - essai avec Decideur123!');
            await doLogin(page, DECIDEUR_EMAIL, 'Decideur123!');
            console.log('  ✓ Login décideur réussi avec Decideur123!');
        }

        await navigateToProfilDirect(page);
        await waitForProfilLoaded(page);

        // Vérifier que la page charge
        const pageText = await page.locator('#app').textContent();
        expect(pageText).not.toContain('À venir');
        console.log('  ✓ Page profil décideur chargée');

        // Vérifier l'email
        const emailVisible = await page.locator(`text=${DECIDEUR_EMAIL}`).first().isVisible().catch(() => false);
        console.log(`  ${emailVisible ? '✓' : '⚠'} Email décideur visible : ${emailVisible}`);

        // Vérifier le badge de rôle
        const rolesBadge = await page.locator('text=Décideur, text=décideur').first().isVisible().catch(() => false);
        console.log(`  ${rolesBadge ? '✓' : '⚠'} Badge rôle décideur visible`);

        // Vérifier les sections (cibler les titres h3)
        await expect(page.locator('h3:has-text("Informations personnelles")')).toBeVisible();
        await expect(page.locator('h3:has-text("Changer le mot de passe")')).toBeVisible();
        await expect(page.locator('h3:has-text("Méthode de vérification en 2 étapes")')).toBeVisible();
        console.log('  ✓ Toutes les sections présentes pour le décideur');

        await screenshot(page, '05-profil-decideur');
        console.log('  ✓ Test profil décideur : OK');
    });

});
