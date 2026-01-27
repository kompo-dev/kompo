#!/bin/bash

# Test rapide du système de templates Kompo
# Usage: pnpm test:templates

set -e

echo "🚀 Test rapide du système de templates Kompo"
echo "=========================================="

# Test 1: Lister les templates
echo "1. Test listing des templates..."
pnpm kompo new --list-templates > /dev/null 2>&1
echo "✅ Templates listés"

# Test 2: Créer un projet test
echo "2. Test création d'un projet..."
rm -rf test-template-app
pnpm kompo new test-template-app --template app-defi-swap > /dev/null 2>&1
[ -d "test-template-app" ] && echo "✅ Projet créé" || (echo "❌ Échec création" && exit 1)

# Test 3: Installer un plugin
echo "3. Test installation plugin..."
cd test-template-app
pnpm kompo install plugin-wallet --app test-template-app > /dev/null 2>&1
echo "✅ Plugin installé"
cd ..

# Test 4: Nettoyer
echo "4. Nettoyage..."
rm -rf test-template-app
echo "✅ Nettoyé"

echo ""
echo "🎉 Tous les tests de base sont passés !"
echo ""
echo "Pour les tests E2E complets :"
echo "  ./scripts/test-e2e.sh"
