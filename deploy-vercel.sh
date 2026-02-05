#!/bin/bash

echo ""
echo "===================================="
echo "   Déploiement SAP vers Vercel"
echo "===================================="
echo ""

# Vérifier si Vercel CLI est installé
if ! command -v vercel &> /dev/null; then
    echo "[1/3] Installation de Vercel CLI..."
    npm install -g vercel
else
    echo "[1/3] Vercel CLI déjà installé ✅"
fi

echo ""
echo "[2/3] Préparation du build frontend..."
cd frontend
npm install
npm run build

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ ERREUR: Le build a échoué!"
    exit 1
fi

cd ..
echo ""
echo "[3/3] Déploiement vers Vercel..."
vercel --prod

echo ""
echo "===================================="
echo "   ✅ Déploiement terminé!"
echo "===================================="
echo ""
echo "Votre application est maintenant disponible en ligne."
echo "Vercel vous a fourni une URL ci-dessus."
echo ""
