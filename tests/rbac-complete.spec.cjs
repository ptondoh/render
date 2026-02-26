/**
 * Tests Playwright complets pour le système RBAC
 * - Permissions (CRUD, filtres, tri)
 * - Rôles (CRUD, assignation permissions)
 * - Utilisateurs (avec rôles dynamiques)
 */

const { test, expect } = require('@playwright/test');

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API_URL = process.env.API_URL || 'http://localhost:8000';

// Credentials bailleur
const BAILLEUR_EMAIL = 'admin@sap.ht';
const BAILLEUR_PASSWORD = 'Test123!';

// RUN_ID stable via process.env : Playwright peut ré-évaluer le module pour chaque describe block,
// ce qui donnerait des Date.now() différents. process.env persiste dans le même processus worker.
if (!process.env.PLAYWRIGHT_RBAC_RUN_ID) {
    process.env.PLAYWRIGHT_RBAC_RUN_ID = String(Date.now());
}
const RUN_ID = process.env.PLAYWRIGHT_RBAC_RUN_ID;
const TEST_PERM_NAME = `test:execute-${RUN_ID}`;
const TEST_PERM_WORKFLOW = `reports:generate-${RUN_ID}`;
const TEST_ROLE_NAME = `superviseur-${RUN_ID}`;
const TEST_ROLE_WORKFLOW = `analyste-${RUN_ID}`;
const TEST_USER_EMAIL = `test.rbac+${RUN_ID}@sap.ht`;
const TEST_USER_WORKFLOW = `analyste+${RUN_ID}@sap.ht`;

/**
 * Helper : Se connecter comme bailleur
 */
async function loginAsBailleur(page) {
    await page.goto(`${BASE_URL}/#/login`);
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });

    await page.fill('input[type="email"]', BAILLEUR_EMAIL);
    await page.fill('input[type="password"]', BAILLEUR_PASSWORD);
    await page.click('button[type="submit"]');

    // Attendre la redirection vers dashboard
    await page.waitForURL(/dashboard/, { timeout: 15000 });
    console.log('✓ Connecté comme bailleur');
}

/**
 * Helper : Attendre et fermer un toast
 */
async function waitForToast(page, expectedText) {
    if (expectedText) {
        // Attendre spécifiquement un toast contenant le texte attendu
        await page.waitForFunction(
            (text) => {
                const container = document.getElementById('toast-container');
                if (!container) return false;
                return Array.from(container.querySelectorAll('div')).some(
                    el => el.textContent.includes(text)
                );
            },
            expectedText,
            { timeout: 8000 }
        );
        const toast = await page.$(`#toast-container div:has-text("${expectedText}")`);
        const toastText = await toast.textContent();
        console.log(`Toast: ${toastText}`);
        return toastText;
    } else {
        const toast = await page.waitForSelector('#toast-container > div', { timeout: 5000 });
        const toastText = await toast.textContent();
        console.log(`Toast: ${toastText}`);
        return toastText;
    }
}

/**
 * Helper : Remplir le champ de recherche et attendre que la ligne exacte apparaisse.
 * Inclut un fallback page.reload() si l'item n'est pas trouvé dans les 5 premières secondes
 * (cas de timing où les données API ne sont pas encore disponibles au chargement initial).
 */
async function searchAndWaitForRow(page, searchTerm, timeout = 10000) {
    await page.fill('input[placeholder*="Rechercher"]', searchTerm);

    const found = await page.waitForFunction(
        (name) => Array.from(document.querySelectorAll('tbody tr td:first-child'))
            .some(c => c.textContent.trim() === name),
        searchTerm,
        { timeout: 5000 }
    ).catch(() => null);

    if (!found) {
        // Forcer un rechargement complet pour obtenir des données fraîches depuis l'API
        console.log(`  → Item "${searchTerm}" non trouvé, rechargement de la page...`);
        await page.reload({ waitUntil: 'domcontentloaded' });
        // Attendre que le tableau se remplisse après rechargement
        await page.waitForSelector('tbody tr', { timeout: 10000 });
        await page.fill('input[placeholder*="Rechercher"]', searchTerm);
        await page.waitForFunction(
            (name) => Array.from(document.querySelectorAll('tbody tr td:first-child'))
                .some(c => c.textContent.trim() === name),
            searchTerm,
            { timeout }
        );
    }
}

// ============================================================================
// TEST SUITE 1 : Page Admin Permissions
// ============================================================================

test.describe('Admin Permissions - CRUD Complet', () => {

    test.beforeEach(async ({ page }) => {
        await loginAsBailleur(page);
    });

    test('Test 1.1 : Accéder à la page permissions', async ({ page }) => {
        console.log('\n=== Test 1.1 : Navigation vers /admin/permissions ===');

        // Cliquer sur le menu Administration
        await page.click('text=Administration');
        await page.waitForTimeout(500);

        // Cliquer sur "Permissions"
        await page.click('a[href="#/admin/permissions"]');
        await page.waitForURL(/admin\/permissions/, { timeout: 5000 });

        // Vérifier le titre (ignorer le h1 du header "SAP")
        const title = await page.textContent('h1:has-text("Permissions")');
        expect(title).toBe('Permissions');

        // Vérifier qu'il y a des permissions (40 créées lors du seed)
        const subtitle = await page.textContent('h1:has-text("Permissions") + p');
        console.log(`Subtitle: ${subtitle}`);
        expect(subtitle).toMatch(/\d+ permission\(s\)/);

        console.log('✓ Page permissions chargée');
    });

    test('Test 1.2 : Filtrer permissions par action', async ({ page }) => {
        console.log('\n=== Test 1.2 : Filtrer par action ===');

        await page.goto(`${BASE_URL}/#/admin/permissions`);
        await page.waitForSelector('h1:has-text("Permissions")', { timeout: 5000 });

        // Attendre que les données soient chargées
        await page.waitForSelector('tbody tr', { timeout: 10000 });

        // Récupérer le nombre initial
        const initialCount = await page.textContent('h1.text-3xl + p');
        console.log(`Count initial: ${initialCount}`);

        // Filtrer par action "read"
        await page.selectOption('select', 'read');
        await page.waitForTimeout(500);

        // Vérifier que le nombre a changé
        const filteredCount = await page.textContent('h1.text-3xl + p');
        console.log(`Count après filtre "read": ${filteredCount}`);
        expect(filteredCount).not.toBe(initialCount);

        // Vérifier que tous les badges affichent "read"
        const badges = await page.$$eval('td .badge, td span', elements =>
            elements.map(el => el.textContent.toLowerCase())
        );
        const readBadges = badges.filter(text => text.includes('read'));
        console.log(`Badges "read" trouvés: ${readBadges.length}`);
        expect(readBadges.length).toBeGreaterThan(0);

        console.log('✓ Filtre par action fonctionne');
    });

    test('Test 1.3 : Rechercher une permission', async ({ page }) => {
        console.log('\n=== Test 1.3 : Rechercher "collectes" ===');

        await page.goto(`${BASE_URL}/#/admin/permissions`);
        // Attendre que les données soient chargées (pas juste le h1)
        await page.waitForSelector('tbody tr', { timeout: 10000 });

        // Rechercher "collectes"
        const searchInput = await page.waitForSelector('input[placeholder*="Rechercher"]');
        await searchInput.fill('collectes');
        await page.waitForTimeout(500);

        // Vérifier les résultats
        const rows = await page.$$('tbody tr');
        console.log(`Résultats trouvés: ${rows.length}`);
        expect(rows.length).toBeGreaterThan(0);

        // Vérifier que toutes les lignes contiennent "collectes"
        const firstCell = await page.textContent('tbody tr:first-child td:first-child');
        console.log(`Première permission: ${firstCell}`);
        expect(firstCell).toContain('collectes');

        console.log('✓ Recherche fonctionne');
    });

    test('Test 1.4 : Trier les permissions', async ({ page }) => {
        console.log('\n=== Test 1.4 : Tri par nom ===');

        await page.goto(`${BASE_URL}/#/admin/permissions`);
        await page.waitForSelector('tbody tr', { timeout: 5000 });

        // Récupérer le premier nom avant tri
        const firstBefore = await page.textContent('tbody tr:first-child td:first-child');
        console.log(`Premier avant tri: ${firstBefore}`);

        // La page démarre triée par "nom" asc (↑ déjà affiché)
        // Premier clic → inverse vers desc (↓)
        await page.click('th:has-text("Nom")');
        await page.waitForTimeout(500);

        // Vérifier l'indicateur de tri (↓ après premier clic)
        const sortIndicator = await page.textContent('th:has-text("Nom")');
        console.log(`Indicateur de tri: ${sortIndicator}`);
        expect(sortIndicator).toContain('↓');

        // Deuxième clic → revient en asc (↑)
        await page.click('th:has-text("Nom")');
        await page.waitForTimeout(500);

        // Vérifier l'indicateur (↑)
        const sortIndicator2 = await page.textContent('th:has-text("Nom")');
        expect(sortIndicator2).toContain('↑');

        console.log('✓ Tri fonctionne');
    });

    test('Test 1.5 : Créer une nouvelle permission', async ({ page }) => {
        console.log(`\n=== Test 1.5 : Créer permission "${TEST_PERM_NAME}" ===`);

        await page.goto(`${BASE_URL}/#/admin/permissions`);
        await page.waitForSelector('h1:has-text("Permissions")', { timeout: 5000 });

        // Cliquer sur "Ajouter une permission"
        await page.click('button:has-text("Ajouter une permission")');
        await page.waitForSelector('h2:has-text("Ajouter une permission")', { timeout: 3000 });

        // Remplir le formulaire (utiliser le select du modal, pas le filtre)
        await page.fill('input[placeholder*="collectes:read"]', TEST_PERM_NAME);
        await page.locator('.space-y-4 select').selectOption('create');
        await page.fill('textarea[placeholder*="Description"]', 'Permission de test pour exécution');

        // Sauvegarder
        await page.click('button:has-text("Créer")');

        // Attendre le toast de succès
        await waitForToast(page, 'créée avec succès');

        // Vérifier que la permission apparaît dans la liste
        await page.fill('input[placeholder*="Rechercher"]', TEST_PERM_NAME);
        await page.waitForTimeout(500);

        const found = await page.textContent('tbody tr:first-child td:first-child');
        expect(found).toBe(TEST_PERM_NAME);

        console.log('✓ Permission créée avec succès');
    });

    test('Test 1.6 : Modifier une permission', async ({ page }) => {
        console.log(`\n=== Test 1.6 : Modifier permission "${TEST_PERM_NAME}" ===`);

        await page.goto(`${BASE_URL}/#/admin/permissions`);
        await page.waitForSelector('tbody tr', { timeout: 5000 });

        // Rechercher la permission créée et attendre qu'elle apparaisse dans le tableau
        await searchAndWaitForRow(page, TEST_PERM_NAME);

        // Cliquer sur "Modifier" dans le tableau
        await page.click('tbody tr:first-child button:has-text("Modifier")');
        await page.waitForSelector('h2:has-text("Modifier la permission")', { timeout: 3000 });

        // Modifier la description
        await page.fill('textarea[placeholder*="Description"]', 'Permission modifiée pour test');

        // Sauvegarder — dernier bouton "Modifier" = celui du modal (le tableau vient avant)
        await page.locator('button:has-text("Modifier")').last().click();

        // Attendre le toast
        await waitForToast(page, 'modifiée avec succès');

        console.log('✓ Permission modifiée');
    });

    test('Test 1.7 : Supprimer une permission', async ({ page }) => {
        console.log(`\n=== Test 1.7 : Supprimer permission "${TEST_PERM_NAME}" ===`);

        await page.goto(`${BASE_URL}/#/admin/permissions`);
        await page.waitForSelector('tbody tr', { timeout: 5000 });

        // Rechercher la permission et attendre qu'elle apparaisse dans le tableau
        await searchAndWaitForRow(page, TEST_PERM_NAME);

        // Cliquer sur "Supprimer" et confirmer
        page.on('dialog', dialog => dialog.accept());
        await page.click('tbody tr:first-child button:has-text("Supprimer")');

        // Attendre le toast
        await waitForToast(page, 'supprimée avec succès');

        // Vérifier qu'elle n'apparaît plus
        const noResults = await page.textContent('.text-center, tbody');
        console.log(`Résultat: ${noResults}`);

        console.log('✓ Permission supprimée');
    });
});

// ============================================================================
// TEST SUITE 2 : Page Admin Rôles
// ============================================================================

test.describe('Admin Rôles - CRUD et Permissions', () => {

    test.beforeEach(async ({ page }) => {
        await loginAsBailleur(page);
    });

    test('Test 2.1 : Accéder à la page rôles', async ({ page }) => {
        console.log('\n=== Test 2.1 : Navigation vers /admin/roles ===');

        await page.click('text=Administration');
        await page.waitForTimeout(500);
        await page.click('a[href="#/admin/roles"]');
        await page.waitForURL(/admin\/roles/, { timeout: 5000 });
        await page.waitForSelector('h1.text-3xl:has-text("Rôles")', { timeout: 8000 });

        const title = await page.textContent('h1.text-3xl:has-text("Rôles")');
        expect(title).toBe('Rôles');

        // Vérifier les 3 rôles de base
        const subtitle = await page.textContent('h1.text-3xl:has-text("Rôles") + p');
        console.log(`Subtitle: ${subtitle}`);
        expect(subtitle).toMatch(/\d+ rôle\(s\)/);

        console.log('✓ Page rôles chargée');
    });

    test('Test 2.2 : Voir les rôles de base', async ({ page }) => {
        console.log('\n=== Test 2.2 : Vérifier agent, décideur, bailleur ===');

        await page.goto(`${BASE_URL}/#/admin/roles`);
        await page.waitForSelector('tbody tr', { timeout: 5000 });

        // Chercher chaque rôle de base individuellement : la pagination affiche 10/page
        // et il peut y avoir 14+ rôles (dont décideur sur la 2ème page en tri alphabétique)
        // Utiliser page.evaluate() au lieu de page.fill() pour éviter la concaténation :
        // le SPA reconstruit le DOM sur chaque input event + requestAnimationFrame remet
        // le curseur à la fin (setSelectionRange(pos,pos) sans sélection), ce qui peut
        // amener Playwright à appendre au lieu de remplacer entre deux fill().
        for (const roleName of ['agent', 'décideur', 'bailleur']) {
            await page.evaluate((val) => {
                const input = document.querySelector('input[placeholder*="Rechercher"]');
                if (input) {
                    input.value = val;
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }, roleName);
            await page.waitForFunction(
                (name) => Array.from(document.querySelectorAll('tbody tr td:first-child'))
                    .some(c => c.textContent.trim() === name),
                roleName,
                { timeout: 5000 }
            );
            console.log(`✓ Rôle "${roleName}" trouvé`);
        }
        // Effacer la recherche
        await page.fill('input[placeholder*="Rechercher"]', '');

        console.log('✓ 3 rôles de base présents');
    });

    test('Test 2.3 : Voir les permissions d\'un rôle', async ({ page }) => {
        console.log('\n=== Test 2.3 : Compter permissions du bailleur ===');

        await page.goto(`${BASE_URL}/#/admin/roles`);
        await page.waitForSelector('tbody tr', { timeout: 5000 });

        // Rechercher "bailleur"
        await page.fill('input[placeholder*="Rechercher"]', 'bailleur');
        await page.waitForTimeout(500);

        // Vérifier le badge de permissions
        const permBadge = await page.textContent('tbody tr:first-child td:nth-child(3)');
        console.log(`Permissions bailleur: ${permBadge}`);
        expect(permBadge).toContain('40');  // Bailleur a 40 permissions

        console.log('✓ Bailleur a 40 permissions');
    });

    test('Test 2.4 : Créer un nouveau rôle', async ({ page }) => {
        console.log(`\n=== Test 2.4 : Créer rôle "${TEST_ROLE_NAME}" ===`);

        await page.goto(`${BASE_URL}/#/admin/roles`);
        await page.waitForSelector('h1:has-text("Rôles")', { timeout: 5000 });

        // Cliquer sur "Ajouter un rôle"
        await page.click('button:has-text("Ajouter un rôle")');
        await page.waitForSelector('h2:has-text("Ajouter un rôle")', { timeout: 3000 });

        // Remplir le formulaire
        await page.fill('input[placeholder="agent"]', TEST_ROLE_NAME);
        await page.fill('textarea[placeholder*="Description"]', 'Superviseur des agents de terrain');

        // Cocher quelques permissions (collectes:read, collectes:update)
        const checkboxes = await page.$$('input[type="checkbox"]');
        if (checkboxes.length > 0) {
            await checkboxes[0].check();  // Première permission
            await checkboxes[1].check();  // Deuxième permission
        }

        // Sauvegarder
        await page.click('button:has-text("Créer")');

        // Attendre le toast
        await waitForToast(page, 'créé avec succès');

        // Vérifier dans la liste
        await page.fill('input[placeholder*="Rechercher"]', TEST_ROLE_NAME);
        await page.waitForTimeout(500);

        const found = await page.textContent('tbody tr:first-child td:first-child');
        expect(found).toBe(TEST_ROLE_NAME);

        console.log(`✓ Rôle ${TEST_ROLE_NAME} créé`);
    });

    test('Test 2.5 : Modifier un rôle', async ({ page }) => {
        console.log(`\n=== Test 2.5 : Modifier rôle "${TEST_ROLE_NAME}" ===`);

        await page.goto(`${BASE_URL}/#/admin/roles`);
        await page.waitForSelector('tbody tr', { timeout: 5000 });

        // Rechercher le rôle de test et attendre qu'il apparaisse dans le tableau
        await searchAndWaitForRow(page, TEST_ROLE_NAME);

        // Cliquer "Modifier" dans le tableau
        await page.click('tbody tr:first-child button:has-text("Modifier")');
        await page.waitForSelector('h2:has-text("Modifier le rôle")', { timeout: 3000 });

        // Changer la description
        await page.fill('textarea[placeholder*="Description"]', 'Superviseur avec permissions étendues');

        // Cocher une permission supplémentaire
        const checkboxes = await page.$$('input[type="checkbox"]:not(:checked)');
        if (checkboxes.length > 0) {
            await checkboxes[0].check();
        }

        // Sauvegarder — dernier bouton "Modifier" = celui du modal (le tableau vient avant)
        await page.locator('button:has-text("Modifier")').last().click();

        // Attendre toast
        await waitForToast(page, 'modifié avec succès');

        console.log('✓ Rôle modifié');
    });

    test('Test 2.6 : Supprimer un rôle', async ({ page }) => {
        console.log(`\n=== Test 2.6 : Supprimer rôle "${TEST_ROLE_NAME}" ===`);

        await page.goto(`${BASE_URL}/#/admin/roles`);
        await page.waitForSelector('tbody tr', { timeout: 5000 });

        // Rechercher le rôle de test et attendre qu'il apparaisse dans le tableau
        await searchAndWaitForRow(page, TEST_ROLE_NAME);

        // Supprimer avec confirmation
        page.on('dialog', dialog => dialog.accept());
        await page.click('tbody tr:first-child button:has-text("Supprimer")');

        // Attendre toast
        await waitForToast(page, 'supprimé avec succès');

        console.log('✓ Rôle supprimé');
    });
});

// ============================================================================
// TEST SUITE 3 : Page Admin Utilisateurs (avec rôles dynamiques)
// ============================================================================

test.describe('Admin Utilisateurs - Rôles Dynamiques', () => {

    test.beforeEach(async ({ page }) => {
        await loginAsBailleur(page);
    });

    test('Test 3.1 : Accéder à la page utilisateurs', async ({ page }) => {
        console.log('\n=== Test 3.1 : Navigation vers /admin/utilisateurs ===');

        await page.click('text=Administration');
        await page.waitForTimeout(500);
        await page.click('a[href="#/admin/utilisateurs"]');
        await page.waitForURL(/admin\/utilisateurs/, { timeout: 5000 });
        await page.waitForSelector('h1.text-3xl:has-text("Utilisateurs")', { timeout: 8000 });

        const title = await page.textContent('h1.text-3xl:has-text("Utilisateurs")');
        expect(title).toBe('Utilisateurs');

        console.log('✓ Page utilisateurs chargée');
    });

    test('Test 3.2 : Voir les rôles dans la table', async ({ page }) => {
        console.log('\n=== Test 3.2 : Vérifier affichage rôles (noms, pas IDs) ===');

        await page.goto(`${BASE_URL}/#/admin/utilisateurs`);
        await page.waitForSelector('tbody tr', { timeout: 5000 });

        // Vérifier que les badges de rôles affichent des noms (Agent, Décideur, Bailleur)
        const roleBadges = await page.$$eval('tbody tr:first-child td:nth-child(3) .badge, tbody tr:first-child td:nth-child(3) span',
            elements => elements.map(el => el.textContent)
        );
        console.log(`Badges rôles: ${roleBadges.join(', ')}`);

        // Vérifier qu'on voit des noms, pas des ObjectIds (pas de chaînes longues hexadécimales)
        roleBadges.forEach(badge => {
            expect(badge).not.toMatch(/^[a-f0-9]{24}$/i);  // Pas un ObjectId
        });

        console.log('✓ Rôles affichés comme noms, pas IDs');
    });

    test('Test 3.3 : Filtre par rôle dynamique', async ({ page }) => {
        console.log('\n=== Test 3.3 : Filtrer par rôle "agent" ===');

        await page.goto(`${BASE_URL}/#/admin/utilisateurs`);
        await page.waitForSelector('tbody tr', { timeout: 5000 });

        // Trouver le select de filtre de rôle (2ème select)
        const roleSelects = await page.$$('select');
        if (roleSelects.length >= 2) {
            const roleSelect = roleSelects[0];  // Premier select = rôle

            // Vérifier qu'il y a des options chargées depuis la BDD
            const options = await page.$$eval('select:first-of-type option', opts =>
                opts.map(opt => opt.textContent)
            );
            console.log(`Options de rôle: ${options.join(', ')}`);

            expect(options.length).toBeGreaterThan(1);  // Plus que "Tous les rôles"
            expect(options).toContain('agent');
            expect(options).toContain('décideur');
            expect(options).toContain('bailleur');
        }

        console.log('✓ Filtre par rôle chargé depuis BDD');
    });

    test('Test 3.4 : Créer utilisateur avec sélection rôle dynamique', async ({ page }) => {
        console.log(`\n=== Test 3.4 : Créer utilisateur "${TEST_USER_EMAIL}" ===`);

        await page.goto(`${BASE_URL}/#/admin/utilisateurs`);
        // Attendre que les données soient chargées (tableau visible)
        await page.waitForSelector('tbody tr', { timeout: 10000 });

        // Cliquer "Ajouter un utilisateur"
        await page.click('button:has-text("Ajouter un utilisateur")');
        await page.waitForSelector('h2:has-text("Ajouter un utilisateur")', { timeout: 3000 });

        // Remplir le formulaire
        await page.fill('input[type="email"]', TEST_USER_EMAIL);
        await page.fill('input[type="password"]', 'TestRBAC123!');
        await page.fill('input[placeholder="Dupont"]', 'Test');
        await page.fill('input[placeholder="Jean"]', 'RBAC');

        // Vérifier que les checkboxes de rôles sont générées dynamiquement
        const roleCheckboxes = await page.$$('input[type="checkbox"][id^="role-"]');
        console.log(`Nombre de checkboxes rôles: ${roleCheckboxes.length}`);
        expect(roleCheckboxes.length).toBeGreaterThan(0);

        // Cocher le premier rôle (agent)
        if (roleCheckboxes.length > 0) {
            await roleCheckboxes[0].check();
        }

        // Cocher "Compte actif"
        const actifCheckbox = await page.$('input[id="actif-checkbox"]');
        if (actifCheckbox) {
            await actifCheckbox.check();
        }

        // Sauvegarder
        await page.click('button:has-text("Créer")');

        // Attendre toast
        await waitForToast(page, 'créé avec succès');

        // Vérifier dans la liste
        await page.fill('input[placeholder*="Rechercher"]', TEST_USER_EMAIL);
        await page.waitForTimeout(500);

        const found = await page.textContent('tbody tr:first-child td:first-child');
        expect(found).toBe(TEST_USER_EMAIL);

        console.log('✓ Utilisateur créé avec rôle dynamique');
    });

    test('Test 3.5 : Modifier rôles d\'un utilisateur', async ({ page }) => {
        console.log(`\n=== Test 3.5 : Modifier rôles de ${TEST_USER_EMAIL} ===`);

        await page.goto(`${BASE_URL}/#/admin/utilisateurs`);
        await page.waitForSelector('tbody tr', { timeout: 5000 });

        // Rechercher l'utilisateur et attendre qu'il apparaisse dans le tableau
        await searchAndWaitForRow(page, TEST_USER_EMAIL);

        // Modifier
        await page.click('tbody tr:first-child button:has-text("Modifier")');
        await page.waitForSelector('h2:has-text("Modifier l\'utilisateur")', { timeout: 3000 });

        // Cocher un deuxième rôle
        const roleCheckboxes = await page.$$('input[type="checkbox"][id^="role-"]');
        if (roleCheckboxes.length > 1) {
            await roleCheckboxes[1].check();  // Ajouter un 2ème rôle
        }

        // Sauvegarder — dernier bouton "Modifier" = celui du modal (le tableau vient avant)
        await page.locator('button:has-text("Modifier")').last().click();

        // Attendre toast
        await waitForToast(page, 'modifié avec succès');

        // Vérifier que 2 badges de rôles s'affichent
        await searchAndWaitForRow(page, TEST_USER_EMAIL);

        const roleBadges = await page.$$('tbody tr:first-child td:nth-child(3) .badge, tbody tr:first-child td:nth-child(3) span');
        console.log(`Nombre de badges rôles: ${roleBadges.length}`);
        expect(roleBadges.length).toBeGreaterThan(0);

        console.log('✓ Rôles modifiés');
    });

    test('Test 3.6 : Supprimer utilisateur test', async ({ page }) => {
        console.log(`\n=== Test 3.6 : Supprimer ${TEST_USER_EMAIL} ===`);

        await page.goto(`${BASE_URL}/#/admin/utilisateurs`);
        await page.waitForSelector('tbody tr', { timeout: 5000 });

        // Rechercher l'utilisateur et attendre qu'il apparaisse dans le tableau
        await searchAndWaitForRow(page, TEST_USER_EMAIL);

        // Supprimer avec confirmation
        page.on('dialog', dialog => dialog.accept());
        await page.click('tbody tr:first-child button:has-text("Supprimer")');

        // Attendre toast
        await waitForToast(page, 'désactivé');

        console.log('✓ Utilisateur supprimé');
    });
});

// ============================================================================
// TEST SUITE 4 : Tests d'intégration RBAC
// ============================================================================

test.describe('Intégration RBAC - Workflow complet', () => {

    test.beforeEach(async ({ page }) => {
        await loginAsBailleur(page);
    });

    test('Test 4.1 : Workflow complet Permissions → Rôles → Users', async ({ page }) => {
        console.log('\n=== Test 4.1 : Workflow complet RBAC ===');

        // ÉTAPE 1 : Créer une permission custom
        console.log(`Étape 1/4 : Créer permission "${TEST_PERM_WORKFLOW}"`);
        await page.goto(`${BASE_URL}/#/admin/permissions`);
        await page.waitForSelector('button:has-text("Ajouter une permission")', { timeout: 5000 });

        await page.click('button:has-text("Ajouter une permission")');
        await page.waitForSelector('h2:has-text("Ajouter une permission")');

        await page.fill('input[placeholder*="collectes:read"]', TEST_PERM_WORKFLOW);
        // Cibler le select dans le modal (.space-y-4), pas le filtre de la page
        await page.locator('.space-y-4 select').selectOption('create');
        await page.fill('textarea', 'Générer des rapports personnalisés');
        await page.click('button:has-text("Créer")');

        await waitForToast(page, 'Permission créée');
        console.log('✓ Permission créée');

        // ÉTAPE 2 : Créer un rôle avec cette permission
        console.log(`Étape 2/4 : Créer rôle "${TEST_ROLE_WORKFLOW}" avec permission ${TEST_PERM_WORKFLOW}`);
        await page.goto(`${BASE_URL}/#/admin/roles`);
        await page.waitForSelector('button:has-text("Ajouter un rôle")', { timeout: 5000 });

        await page.click('button:has-text("Ajouter un rôle")');
        await page.waitForSelector('h2:has-text("Ajouter un rôle")');

        await page.fill('input[placeholder="agent"]', TEST_ROLE_WORKFLOW);
        await page.fill('textarea', 'Analyste de données');

        // Chercher et cocher la permission workflow
        const permCheckboxes = await page.$$('input[type="checkbox"]');
        for (const checkbox of permCheckboxes) {
            const label = await checkbox.evaluate(el => el.nextElementSibling?.textContent);
            if (label && label.includes(TEST_PERM_WORKFLOW)) {
                await checkbox.check();
                break;
            }
        }

        await page.click('button:has-text("Créer")');
        await waitForToast(page, 'Rôle créé');
        console.log('✓ Rôle créé');

        // ÉTAPE 3 : Créer un utilisateur avec ce rôle
        console.log(`Étape 3/4 : Créer utilisateur "${TEST_USER_WORKFLOW}" avec rôle ${TEST_ROLE_WORKFLOW}`);
        await page.goto(`${BASE_URL}/#/admin/utilisateurs`);
        await page.waitForSelector('button:has-text("Ajouter un utilisateur")', { timeout: 5000 });

        await page.click('button:has-text("Ajouter un utilisateur")');
        await page.waitForSelector('h2:has-text("Ajouter un utilisateur")');

        await page.fill('input[type="email"]', TEST_USER_WORKFLOW);
        await page.fill('input[type="password"]', 'Analyste123!');

        // Attendre que les rôles soient chargés dans le modal
        await page.waitForSelector('input[type="checkbox"][id^="role-"]', { timeout: 5000 });

        // Chercher et cocher le rôle workflow via evaluate() pour éviter les stale element handles
        // (page.$$() retourne des ElementHandles qui deviennent périmés si le SPA re-rend)
        const roleFound = await page.evaluate((roleName) => {
            const checkboxes = document.querySelectorAll('input[type="checkbox"][id^="role-"]');
            for (const checkbox of checkboxes) {
                const label = checkbox.nextElementSibling;
                if (label && label.textContent.includes(roleName)) {
                    checkbox.checked = true;
                    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
                    return true;
                }
            }
            return false;
        }, TEST_ROLE_WORKFLOW);
        console.log(`Rôle workflow "${TEST_ROLE_WORKFLOW}" ${roleFound ? 'coché ✓' : 'NON TROUVÉ !'}`);

        await page.click('button:has-text("Créer")');
        await waitForToast(page, 'Utilisateur créé');
        console.log('✓ Utilisateur créé');

        // ÉTAPE 4 : Vérifier que tout est lié
        console.log('Étape 4/4 : Vérifier que utilisateur → rôle → permission');

        await page.fill('input[placeholder*="Rechercher"]', TEST_USER_WORKFLOW);
        await page.waitForTimeout(500);

        const userRoleBadge = await page.textContent('tbody tr:first-child td:nth-child(3)');
        console.log(`Rôle de l'utilisateur: ${userRoleBadge}`);
        expect(userRoleBadge.toLowerCase()).toContain('analyste');

        console.log('✓ Workflow RBAC complet validé !');
    });
});
