/**
 * Helpers pour les tests Playwright
 */

/**
 * Se connecter en tant que décideur
 * @param {import('@playwright/test').Page} page
 */
export async function loginAsDecideur(page) {
    await page.goto('/#/login');

    // Attendre que le formulaire soit chargé
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });

    // Remplir le formulaire de connexion
    await page.fill('input[type="email"]', 'decideur@sap.ht');
    await page.fill('input[type="password"]', 'Test123!');

    // Cliquer sur le bouton de connexion
    await page.click('button:has-text("Se connecter"), button[type="submit"]');

    // Attendre la redirection vers le dashboard (timeout plus long)
    await page.waitForURL('**/#/dashboard', { timeout: 20000 });

    // Attendre que le contenu du dashboard soit chargé
    await page.waitForSelector('h1', { timeout: 10000 });
}

/**
 * Vérifier qu'un toast de succès est affiché
 * @param {import('@playwright/test').Page} page
 * @param {string} message
 */
export async function expectSuccessToast(page, message) {
    const toast = page.locator('.bg-green-50, .bg-green-100').filter({ hasText: message });
    await toast.waitFor({ state: 'visible', timeout: 5000 });
}

/**
 * Vérifier qu'un toast d'erreur est affiché
 * @param {import('@playwright/test').Page} page
 * @param {string} message
 */
export async function expectErrorToast(page, message) {
    const toast = page.locator('.bg-red-50, .bg-red-100').filter({ hasText: message });
    await toast.waitFor({ state: 'visible', timeout: 5000 });
}

/**
 * Attendre que le spinner de chargement disparaisse
 * @param {import('@playwright/test').Page} page
 */
export async function waitForLoading(page) {
    // Attendre que le spinner disparaisse
    await page.waitForSelector('.animate-spin', { state: 'hidden', timeout: 10000 });
}
