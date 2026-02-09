/**
 * Gestionnaire de version de l'application
 * Détecte les changements de version et vide le cache automatiquement
 */

// VERSION DE L'APPLICATION - À INCRÉMENTER À CHAQUE CHANGEMENT DE STRUCTURE
const APP_VERSION = '1.1.0'; // Changed: Migration roles (string -> array)

const VERSION_KEY = 'app_version';
const LAST_CHECK_KEY = 'version_last_check';

/**
 * Vérifier et gérer les mises à jour de version
 * @returns {boolean} true si le cache a été vidé
 */
export function checkAndHandleVersionUpdate() {
    try {
        const storedVersion = localStorage.getItem(VERSION_KEY);
        const now = Date.now();

        console.log(`[Version] Version actuelle: ${APP_VERSION}`);
        console.log(`[Version] Version stockée: ${storedVersion || 'aucune'}`);

        // Première visite ou version différente
        if (!storedVersion || storedVersion !== APP_VERSION) {
            console.warn(`[Version] Changement de version détecté: ${storedVersion} -> ${APP_VERSION}`);
            console.log('[Version] Nettoyage du cache...');

            // Vider tout le localStorage SAUF les préférences utilisateur importantes
            const keysToKeep = [
                'user_preferences',
                'theme',
                'language'
            ];

            const allKeys = Object.keys(localStorage);
            allKeys.forEach(key => {
                if (!keysToKeep.includes(key)) {
                    localStorage.removeItem(key);
                }
            });

            // Vider le sessionStorage
            sessionStorage.clear();

            // Mettre à jour la version
            localStorage.setItem(VERSION_KEY, APP_VERSION);
            localStorage.setItem(LAST_CHECK_KEY, now.toString());

            console.log('[Version] ✅ Cache nettoyé avec succès');

            return true;
        }

        // Vérifier périodiquement (toutes les heures)
        const lastCheck = parseInt(localStorage.getItem(LAST_CHECK_KEY) || '0');
        const hoursSinceLastCheck = (now - lastCheck) / (1000 * 60 * 60);

        if (hoursSinceLastCheck > 1) {
            localStorage.setItem(LAST_CHECK_KEY, now.toString());
            console.log('[Version] ✅ Version à jour (vérification périodique)');
        }

        return false;

    } catch (error) {
        console.error('[Version] Erreur lors de la vérification de version:', error);
        return false;
    }
}

/**
 * Obtenir la version actuelle de l'application
 */
export function getAppVersion() {
    return APP_VERSION;
}

/**
 * Forcer la mise à jour (pour debug)
 */
export function forceVersionUpdate() {
    localStorage.removeItem(VERSION_KEY);
    return checkAndHandleVersionUpdate();
}

/**
 * Migrer les données si nécessaire
 * Appelé après détection d'un changement de version
 */
export function migrateData(fromVersion) {
    console.log(`[Migration] Début de la migration depuis ${fromVersion}`);

    try {
        // Migration spécifique : roles string -> array
        if (fromVersion < '1.1.0') {
            console.log('[Migration] Migration des rôles utilisateur...');

            // Si un utilisateur est stocké en cache
            const userStr = localStorage.getItem('user');
            if (userStr) {
                try {
                    const user = JSON.parse(userStr);

                    // Si le user a un champ 'role' (ancien format)
                    if (user.role && typeof user.role === 'string') {
                        console.log('[Migration] Conversion role -> roles');
                        user.roles = [user.role];
                        delete user.role;
                        localStorage.setItem('user', JSON.stringify(user));
                        console.log('[Migration] ✅ Utilisateur migré');
                    }

                    // Si le user a 'roles' qui n'est pas un array
                    if (user.roles && !Array.isArray(user.roles)) {
                        console.log('[Migration] Correction du format roles');
                        user.roles = [user.roles];
                        localStorage.setItem('user', JSON.stringify(user));
                        console.log('[Migration] ✅ Format roles corrigé');
                    }
                } catch (e) {
                    console.error('[Migration] Erreur lors de la migration utilisateur:', e);
                    localStorage.removeItem('user');
                }
            }
        }

        console.log('[Migration] ✅ Migration terminée');

    } catch (error) {
        console.error('[Migration] Erreur lors de la migration:', error);
    }
}

/**
 * Afficher les informations de version dans la console
 */
export function logVersionInfo() {
    console.log('%c╔═══════════════════════════════════════════╗', 'color: #3b82f6; font-weight: bold');
    console.log(`%c║   SAP - Système d'Alerte Précoce         ║`, 'color: #3b82f6; font-weight: bold');
    console.log(`%c║   Version: ${APP_VERSION.padEnd(29)} ║`, 'color: #3b82f6; font-weight: bold');
    console.log('%c╚═══════════════════════════════════════════╝', 'color: #3b82f6; font-weight: bold');
}
