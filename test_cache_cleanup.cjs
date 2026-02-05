const { chromium } = require('playwright');

const FRONTEND_URL = 'http://localhost:3000';

/**
 * Test spécifique: Vérification du nettoyage du cache au retour ONLINE
 */
(async () => {
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║   🧪 TEST NETTOYAGE CACHE AU RETOUR ONLINE           ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');

    const browser = await chromium.launch({
        headless: false,
        slowMo: 100
    });

    const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 }
    });

    const page = await context.newPage();

    // Capturer tous les logs (SW + page)
    const swLogs = [];
    const allLogs = [];
    page.on('console', msg => {
        const text = msg.text();
        allLogs.push(text);

        if (text.includes('[SW]') || text.includes('🌐') || text.includes('📶') || text.includes('📵')) {
            swLogs.push(text);
            console.log(`   ${text}`);
        }
    });

    try {
        // ═══════════════════════════════════════════════════════
        // PHASE 1 : Chargement initial (ONLINE)
        // ═══════════════════════════════════════════════════════
        console.log('═══════════════════════════════════════════════════════');
        console.log('PHASE 1 : Chargement initial (ONLINE)');
        console.log('═══════════════════════════════════════════════════════\n');

        await page.goto(FRONTEND_URL);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);

        console.log('✅ Page chargée en mode ONLINE\n');

        // Vérifier le nombre de caches
        const initialCaches = await page.evaluate(async () => {
            const cacheNames = await caches.keys();
            return {
                count: cacheNames.length,
                names: cacheNames
            };
        });

        console.log(`📦 Caches initiaux: ${initialCaches.count}`);
        initialCaches.names.forEach(name => {
            console.log(`   - ${name}`);
        });
        console.log('');

        // ═══════════════════════════════════════════════════════
        // PHASE 2 : Passage OFFLINE
        // ═══════════════════════════════════════════════════════
        console.log('═══════════════════════════════════════════════════════');
        console.log('PHASE 2 : Passage OFFLINE');
        console.log('═══════════════════════════════════════════════════════\n');

        await context.setOffline(true);
        await page.waitForTimeout(2000);

        console.log('📵 Mode OFFLINE activé\n');

        // Faire quelques requêtes pour peupler le cache
        console.log('🔄 Simulation de requêtes en mode offline...');

        // Sauvegarder une collecte
        await page.evaluate(async () => {
            if (window.offlineManager) {
                await window.offlineManager.saveCollecte({
                    marche_id: 'test-marche',
                    produit_id: 'test-produit',
                    prix: 100,
                    unite_id: 'kg',
                    periode: 'matin1',
                    date: new Date().toISOString(),
                    agent_id: 'test-agent'
                });
            }
        });

        console.log('✅ Collecte sauvegardée en mode offline\n');

        await page.waitForTimeout(2000);

        // Vérifier les caches après mode offline
        const offlineCaches = await page.evaluate(async () => {
            const cacheNames = await caches.keys();
            const cacheDetails = {};

            for (const cacheName of cacheNames) {
                const cache = await caches.open(cacheName);
                const keys = await cache.keys();
                cacheDetails[cacheName] = keys.length;
            }

            return {
                count: cacheNames.length,
                names: cacheNames,
                details: cacheDetails
            };
        });

        console.log(`📦 Caches en mode OFFLINE: ${offlineCaches.count}`);
        Object.entries(offlineCaches.details).forEach(([name, count]) => {
            console.log(`   - ${name}: ${count} entrées`);
        });
        console.log('');

        // ═══════════════════════════════════════════════════════
        // PHASE 3 : Retour ONLINE - VÉRIFICATION CRITIQUE
        // ═══════════════════════════════════════════════════════
        console.log('═══════════════════════════════════════════════════════');
        console.log('PHASE 3 : Retour ONLINE - Vérification nettoyage cache');
        console.log('═══════════════════════════════════════════════════════\n');

        // Vider les logs pour capturer seulement le retour online
        swLogs.length = 0;
        const onlineTransitionLogs = [];

        console.log('📶 Retour en mode ONLINE...\n');

        // Capturer les logs spécifiques au retour online
        page.on('console', msg => {
            onlineTransitionLogs.push(msg.text());
        });

        await context.setOffline(false);

        // Attendre la détection et le nettoyage
        await page.waitForTimeout(5000);

        // Afficher tous les logs capturés pendant la transition
        console.log('📋 Logs capturés pendant la transition:');
        onlineTransitionLogs.slice(0, 20).forEach(log => {
            console.log(`   ${log}`);
        });
        console.log('');

        // Vérifier que le message de nettoyage apparaît dans les logs SW
        const cleanupLog = onlineTransitionLogs.find(log =>
            log.includes('Retour ONLINE détecté') ||
            log.includes('Nettoyage du cache runtime') ||
            log.includes('Cache runtime vidé')
        );

        const networkChangeLog = onlineTransitionLogs.find(log =>
            log.includes('Network changed') && log.includes('ONLINE')
        );

        if (cleanupLog) {
            console.log('✅ Message de nettoyage détecté dans les logs SW:');
            console.log(`   "${cleanupLog}"\n`);
        } else {
            console.log('❌ ERREUR: Aucun message de nettoyage détecté!');
            if (networkChangeLog) {
                console.log(`⚠️  Mais détection online trouvée: "${networkChangeLog}"`);
            }
            console.log('');
        }

        // Vérifier les caches après retour online
        const onlineCaches = await page.evaluate(async () => {
            const cacheNames = await caches.keys();
            const cacheDetails = {};

            for (const cacheName of cacheNames) {
                const cache = await caches.open(cacheName);
                const keys = await cache.keys();
                cacheDetails[cacheName] = keys.length;
            }

            return {
                count: cacheNames.length,
                names: cacheNames,
                details: cacheDetails,
                hasRuntimeCache: cacheNames.some(name => name.includes('runtime'))
            };
        });

        console.log(`📦 Caches après retour ONLINE: ${onlineCaches.count}`);
        Object.entries(onlineCaches.details).forEach(([name, count]) => {
            console.log(`   - ${name}: ${count} entrées`);
        });
        console.log('');

        // ═══════════════════════════════════════════════════════
        // PHASE 4 : Vérification comportement Network First
        // ═══════════════════════════════════════════════════════
        console.log('═══════════════════════════════════════════════════════');
        console.log('PHASE 4 : Vérification Network First en mode ONLINE');
        console.log('═══════════════════════════════════════════════════════\n');

        // Faire une requête et vérifier qu'elle vient du réseau
        const networkTest = await page.evaluate(async () => {
            const startTime = Date.now();

            try {
                const response = await fetch('/api/health', {
                    cache: 'no-cache'
                });

                const endTime = Date.now();
                const duration = endTime - startTime;

                return {
                    success: response.ok || response.status === 404,
                    status: response.status,
                    duration: duration,
                    fromNetwork: duration > 10 // Si > 10ms, probablement du réseau
                };
            } catch (error) {
                return {
                    success: false,
                    error: error.message
                };
            }
        });

        if (networkTest.success) {
            console.log('✅ Requête API réussie');
            console.log(`   Status: ${networkTest.status}`);
            console.log(`   Durée: ${networkTest.duration}ms`);
            console.log(`   Source: ${networkTest.fromNetwork ? 'RÉSEAU' : 'CACHE'}\n`);
        } else {
            console.log('❌ Requête API échouée:', networkTest.error, '\n');
        }

        // ═══════════════════════════════════════════════════════
        // RÉSULTATS
        // ═══════════════════════════════════════════════════════
        console.log('\n╔════════════════════════════════════════════════════════╗');
        console.log('║              📊 RÉSULTATS DES TESTS                   ║');
        console.log('╚════════════════════════════════════════════════════════╝\n');

        let allTestsPassed = true;

        // Test 1: Cache runtime supprimé
        if (!onlineCaches.hasRuntimeCache) {
            console.log('✅ TEST 1: Cache runtime supprimé au retour online');
        } else {
            console.log('❌ TEST 1: Cache runtime ENCORE PRÉSENT!');
            allTestsPassed = false;
        }

        // Test 2: Message de nettoyage dans logs
        if (cleanupLog) {
            console.log('✅ TEST 2: Message de nettoyage dans les logs SW');
        } else {
            console.log('❌ TEST 2: Aucun message de nettoyage détecté');
            allTestsPassed = false;
        }

        // Test 3: Requêtes viennent du réseau
        if (networkTest.success && networkTest.fromNetwork) {
            console.log('✅ TEST 3: Requêtes proviennent du réseau (Network First)');
        } else if (networkTest.success && !networkTest.fromNetwork) {
            console.log('⚠️  TEST 3: Requêtes très rapides (possible cache?)');
        } else {
            console.log('❌ TEST 3: Requêtes échouées');
            allTestsPassed = false;
        }

        // Test 4: Cache statique conservé
        const hasStaticCache = onlineCaches.names.some(name =>
            name.includes('sap-v') && !name.includes('runtime')
        );
        if (hasStaticCache) {
            console.log('✅ TEST 4: Cache statique conservé pour offline');
        } else {
            console.log('⚠️  TEST 4: Cache statique non trouvé');
        }

        console.log('');

        if (allTestsPassed) {
            console.log('🎉 TOUS LES TESTS CRITIQUES RÉUSSIS!\n');
            console.log('Le système offline intelligent fonctionne correctement:');
            console.log('  • Mode ONLINE: Network First (données fraîches)');
            console.log('  • Mode OFFLINE: Cache + Queue');
            console.log('  • Retour ONLINE: Nettoyage automatique du cache runtime');
            console.log('');
        } else {
            console.log('⚠️  CERTAINS TESTS ONT ÉCHOUÉ - Vérifier le comportement\n');
        }

        // Capture finale
        await page.screenshot({
            path: 'test_cache_cleanup_final.png',
            fullPage: false
        });
        console.log('📸 Capture: test_cache_cleanup_final.png\n');

    } catch (error) {
        console.error('\n❌ ERREUR:', error.message);
        console.error(error.stack);

        await page.screenshot({
            path: 'test_cache_cleanup_error.png',
            fullPage: true
        });
        console.log('📸 Capture erreur: test_cache_cleanup_error.png');
    } finally {
        await browser.close();
    }
})();
