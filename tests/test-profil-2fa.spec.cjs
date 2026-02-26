/**
 * Tests Playwright — Page Profil et 2FA Email OTP
 * Vérifie :
 *   1. Layout du profil (labels séparés des valeurs)
 *   2. Section 2FA avec les 3 options radio
 *   3. Activation de l'OTP email
 *   4. Formulaire de login affiche le bon message pour email OTP
 *   5. Remise à zéro (aucune 2FA)
 */

const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API_URL  = process.env.API_URL  || 'http://localhost:8000';
const AGENT = { email: 'agent.test@sap.ht', password: 'Agent123!' };
const ADMIN = { email: 'admin@sap.ht', password: 'Test123!' };

// Helper : login
async function loginAs(page, { email, password }) {
    await page.goto(`${BASE_URL}/#/login`);
    await page.waitForSelector('#email-input');
    await page.fill('#email-input', email);
    await page.fill('#password-input', password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard/, { timeout: 15000 });
}

// Helper : attend un toast contenant le texte
async function waitForToast(page, text) {
    const toast = page.locator(`text=${text}`).first();
    await toast.waitFor({ state: 'visible', timeout: 8000 });
}

// Helper : reset la méthode 2FA via API directement
// Utilise page.request.fetch() pour bypasser le service worker
async function reset2FAMethod(page, method = 'none') {
    const token = await page.evaluate(() => localStorage.getItem('access_token'));
    if (!token) return false;
    const response = await page.request.fetch(`${API_URL}/api/auth/two-fa-method`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        data: JSON.stringify({ method })
    });
    return response.ok();
}

// Helper : reset 2FA d'un agent via admin (pour cleanup quand l'agent ne peut pas se connecter)
// Utilise page.request.fetch() pour bypasser le service worker
async function resetAgentTwoFaViaAdmin(page, agentEmail) {
    // Login admin pour obtenir token
    const loginRes = await page.request.fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        data: JSON.stringify({ email: ADMIN.email, password: ADMIN.password })
    });
    const loginData = await loginRes.json();
    const adminToken = loginData.access_token;
    if (!adminToken) return false;

    // Trouver l'ID de l'agent
    const usersRes = await page.request.fetch(`${API_URL}/api/users`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const users = await usersRes.json();
    const agent = Array.isArray(users) ? users.find(u => u.email === agentEmail) : null;
    if (!agent) return false;

    // Reset 2FA via PUT /api/users/{id}
    const updateRes = await page.request.fetch(`${API_URL}/api/users/${agent.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        data: JSON.stringify({ roles: agent.roles || ['agent'], actif: true, two_fa_method: 'none' })
    });
    return updateRes.ok();
}

// Helper : ouvrir le menu utilisateur et se déconnecter
async function openUserMenuAndLogout(page) {
    // Ouvrir le dropdown utilisateur (le bouton logout est dedans)
    await page.click('#user-menu-button');
    // Attendre que le bouton logout soit visible (dropdown ouvert)
    await page.locator('#logout-button').click();
    await page.waitForURL(/login/);
}

// ============================================================

test.describe('Page Profil — Layout', () => {

    test.beforeEach(async ({ page }) => {
        await loginAs(page, AGENT);
        await page.goto(`${BASE_URL}/#/profil`);
        await page.waitForSelector('text=Informations personnelles');
    });

    test('Labels et valeurs sont séparés (pas collés)', async ({ page }) => {
        // Trouver le label "Email" dans le tableau (span text-gray-500)
        const emailLabel = page.locator('span.text-gray-500:has-text("Email")').first();
        const emailBbox = await emailLabel.boundingBox();

        // La valeur email a la classe text-right — utiliser ce sélecteur pour ne pas
        // matcher le sous-titre de la page (qui n'a pas text-right)
        const emailValue = page.locator(`span.text-right:has-text("${AGENT.email}")`).first();
        const valueBbox = await emailValue.boundingBox();

        expect(valueBbox.x).toBeGreaterThan(emailBbox.x + emailBbox.width + 30);
        console.log(`✅ Label x=${emailBbox.x.toFixed(0)} + ${emailBbox.width.toFixed(0)}px, Valeur x=${valueBbox.x.toFixed(0)} — bien séparés`);
    });

    test('Bouton "Changer le mot de passe" n\'est pas pleine largeur', async ({ page }) => {
        await page.waitForSelector('button:has-text("Changer le mot de passe")');
        const btn = page.locator('button:has-text("Changer le mot de passe")');
        const btnBbox = await btn.boundingBox();
        const containerWidth = await page.evaluate(() => document.getElementById('app')?.offsetWidth || window.innerWidth);

        // Le bouton ne doit pas dépasser 60% du container
        expect(btnBbox.width).toBeLessThan(containerWidth * 0.6);
        console.log(`✅ Bouton ${btnBbox.width.toFixed(0)}px < 60% de ${containerWidth}px`);
    });

});


test.describe('Page Profil — Section 2FA', () => {

    test.beforeEach(async ({ page }) => {
        await loginAs(page, AGENT);
        await reset2FAMethod(page, 'none');
        await page.goto(`${BASE_URL}/#/profil`);
        await page.waitForSelector('text=Méthode de vérification en 2 étapes');
    });

    test.afterEach(async ({ page }) => {
        // Remettre à "none" pour nettoyer l'état
        try {
            await reset2FAMethod(page, 'none');
        } catch (_) { /* ignore si la session a expiré */ }
    });

    test('Les 3 options radio sont présentes', async ({ page }) => {
        await expect(page.locator('input[value="none"]')).toBeVisible();
        await expect(page.locator('input[value="totp"]')).toBeVisible();
        await expect(page.locator('input[value="email"]')).toBeVisible();

        await expect(page.locator('text=Aucune vérification')).toBeVisible();
        await expect(page.locator('text=Application d\'authentification')).toBeVisible();
        await expect(page.locator('text=Code par email')).toBeVisible();
        console.log('✅ 3 options radio présentes');
    });

    test('"Aucune vérification" est sélectionnée par défaut', async ({ page }) => {
        await expect(page.locator('input[value="none"]')).toBeChecked();
        console.log('✅ Option "none" cochée par défaut');
    });

    test('Sélectionner "Email" affiche le bouton Enregistrer', async ({ page }) => {
        await page.click('input[value="email"]');
        const saveBtn = page.locator('button:has-text("Enregistrer")');
        await saveBtn.waitFor({ state: 'visible', timeout: 3000 });
        await expect(saveBtn).toBeVisible();
        console.log('✅ Bouton Enregistrer visible après sélection email');
    });

    test('Sélectionner "TOTP" affiche le bouton de configuration', async ({ page }) => {
        await page.click('input[value="totp"]');
        const configBtn = page.locator('button:has-text("Configurer l\'application")');
        await configBtn.waitFor({ state: 'visible', timeout: 3000 });
        await expect(configBtn).toBeVisible();
        console.log('✅ Bouton de configuration TOTP visible');
    });

    test('Annuler remet la sélection originale', async ({ page }) => {
        await page.click('input[value="email"]');
        await page.waitForSelector('button:has-text("Annuler")');
        await page.click('button:has-text("Annuler")');
        await expect(page.locator('input[value="none"]')).toBeChecked();
        console.log('✅ Annulation remet la sélection à "none"');
    });

    test('Activation Email OTP réussit et persiste', async ({ page }) => {
        await page.click('input[value="email"]');
        await page.waitForSelector('button:has-text("Enregistrer")');
        await page.click('button:has-text("Enregistrer")');

        await waitForToast(page, 'Email OTP');
        await page.waitForTimeout(2000);

        await expect(page.locator('input[value="email"]')).toBeChecked();
        console.log('✅ Email OTP activé avec succès');
    });

    test('Désactivation (retour à none) fonctionne', async ({ page }) => {
        // Activer email OTP d'abord
        await page.click('input[value="email"]');
        await page.click('button:has-text("Enregistrer")');
        await waitForToast(page, 'Email OTP');
        await page.waitForTimeout(2000);

        // Puis désactiver
        await page.click('input[value="none"]');
        await page.waitForSelector('button:has-text("Enregistrer")');
        await page.click('button:has-text("Enregistrer")');
        await waitForToast(page, 'désactivée');
        await page.waitForTimeout(1000);

        await expect(page.locator('input[value="none"]')).toBeChecked();
        console.log('✅ Retour à "aucune 2FA" réussi');
    });

});


test.describe('Login — Formulaire Email OTP', () => {

    test.beforeEach(async ({ page }) => {
        // Naviguer vers l'app d'abord (évite "Failed to fetch" depuis about:blank)
        await page.goto(`${BASE_URL}/#/login`);
        await page.waitForSelector('#email-input');
        // S'assurer que l'agent est en mode "none" (via admin si nécessaire)
        await resetAgentTwoFaViaAdmin(page, AGENT.email);
    });

    test('Login avec email OTP affiche le bon sous-titre', async ({ page }) => {
        // Activer email OTP pour l'agent
        await loginAs(page, AGENT);
        await reset2FAMethod(page, 'email');

        // Déconnexion via le bouton logout (dans le dropdown)
        await openUserMenuAndLogout(page);

        // Reconnexion — devrait afficher le formulaire OTP
        await page.fill('#email-input', AGENT.email);
        await page.fill('#password-input', AGENT.password);
        await page.click('button[type="submit"]');

        // Le formulaire OTP doit apparaître avec le bon message
        const emailSubtitle = page.locator('text=Un code à 6 chiffres a été envoyé à votre adresse email');
        await emailSubtitle.waitFor({ state: 'visible', timeout: 8000 });
        await expect(emailSubtitle).toBeVisible();
        console.log('✅ Sous-titre email OTP affiché');

        await expect(page.locator('#mfa-code-input')).toBeVisible();
        console.log('✅ Champ de code OTP visible');

        // Retour à l'écran de login
        await page.click('button:has-text("Retour")');
        await page.waitForSelector('#email-input');

        // Nettoyage : reset via admin (agent ne peut plus se connecter sans OTP)
        await resetAgentTwoFaViaAdmin(page, AGENT.email);
        console.log('✅ 2FA réinitialisée via admin');
    });

    test('Login sans 2FA redirige directement vers le dashboard', async ({ page }) => {
        // L'agent est déjà en mode "none" grâce au beforeEach
        await loginAs(page, AGENT);
        await reset2FAMethod(page, 'none');

        await openUserMenuAndLogout(page);

        await page.fill('#email-input', AGENT.email);
        await page.fill('#password-input', AGENT.password);
        await page.click('button[type="submit"]');

        await page.waitForURL(/dashboard/);
        await expect(page.locator('text=Tableau de bord').first()).toBeVisible();
        console.log('✅ Login sans 2FA → dashboard direct');
    });

});
