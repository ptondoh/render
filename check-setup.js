#!/usr/bin/env node
/**
 * Script de vérification - S'assure que tout est prêt avant de démarrer
 */

const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

console.log('🔍 Vérification de la configuration du projet SAP...\n');

let hasErrors = false;

// 1. Vérifier que le CSS Tailwind est compilé
const cssPath = path.join(__dirname, 'frontend', 'dist', 'output.css');
if (!fs.existsSync(cssPath)) {
    console.log('❌ CSS Tailwind manquant !');
    console.log('   📦 Compilation en cours...');

    try {
        execSync('npm run tailwind:build', { stdio: 'inherit' });
        console.log('   ✅ CSS compilé avec succès\n');
    } catch (error) {
        console.error('   ❌ Erreur lors de la compilation CSS');
        hasErrors = true;
    }
} else {
    const stats = fs.statSync(cssPath);
    const sizeKB = (stats.size / 1024).toFixed(2);
    console.log(`✅ CSS Tailwind présent (${sizeKB} KB)\n`);
}

// 2. Vérifier que le dossier dist existe
const distPath = path.join(__dirname, 'frontend', 'dist');
if (!fs.existsSync(distPath)) {
    console.log('📁 Création du dossier dist...');
    fs.mkdirSync(distPath, { recursive: true });
    console.log('✅ Dossier dist créé\n');
}

// 3. Vérifier les variables d'environnement
const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
    console.log('⚠️  Fichier .env manquant');
    console.log('   💡 Créez un fichier .env à la racine du projet\n');
} else {
    console.log('✅ Fichier .env présent\n');
}

// 4. Vérifier node_modules
const nodeModulesPath = path.join(__dirname, 'node_modules');
if (!fs.existsSync(nodeModulesPath)) {
    console.log('⚠️  node_modules manquant');
    console.log('   💡 Exécutez: npm install\n');
    hasErrors = true;
} else {
    console.log('✅ node_modules présent\n');
}

// 5. Résumé
if (hasErrors) {
    console.log('❌ Certaines vérifications ont échoué');
    console.log('   Corrigez les problèmes ci-dessus avant de continuer\n');
    process.exit(1);
} else {
    console.log('✅ Tout est prêt ! Vous pouvez démarrer l\'application.\n');
    console.log('💡 Commandes disponibles:');
    console.log('   npm run dev       - Démarrer en mode développement');
    console.log('   npm start         - Démarrer frontend + backend');
    console.log('   npm run serve     - Frontend seulement\n');
}
