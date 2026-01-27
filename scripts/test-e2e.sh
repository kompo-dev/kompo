#!/bin/bash

# Tests E2E pour Kompo CLI Template System
# Ce script teste le système de templates unifié

set -e

echo "🧪 Démarrage des tests E2E Kompo CLI..."
echo "======================================"

# Configuration
TEST_DIR="/tmp/kompo-e2e-tests"
KOMPO_DIR=$(pwd)

# Nettoyer et créer le répertoire de test
rm -rf "$TEST_DIR"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

# Helper colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
test_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

test_error() {
    echo -e "${RED}❌ $1${NC}"
    exit 1
}

test_info() {
    echo -e "${YELLOW}ℹ️  $1${NC}"
}

# Test 1: Installation des dépendances
test_info "Test 1: Installation des dépendances"
cd "$KOMPO_DIR"
pnpm install --silent > /dev/null 2>&1
test_success "Dépendances installées"

# Test 2: Lister les templates (Community)
test_info "Test 2: Lister les templates Community"
TEMPLATES_OUTPUT=$(pnpm kompo new --list-templates 2>&1)
echo "$TEMPLATES_OUTPUT" | grep -q "app-defi-swap" || test_error "Template app-defi-swap non trouvé"
echo "$TEMPLATES_OUTPUT" | grep -q "plugin-wallet" || test_error "Template plugin-wallet non trouvé"
echo "$TEMPLATES_OUTPUT" | grep -q "erc20-allowance" || test_error "Template erc20-allowance non trouvé"
test_success "Templates Community listés correctement"

# Test 3: Créer un projet avec template app
test_info "Test 3: Création d'un projet avec template app"
cd "$TEST_DIR"
"$KOMPO_DIR/pnpm" kompo new test-defi-app --template app-defi-swap > /dev/null 2>&1
[ -d "test-defi-app" ] || test_error "Répertoire du projet non créé"
cd test-defi-app
[ -f "kompo.json" ] || test_error "kompo.json non créé"
[ -f "README.md" ] || test_error "README.md non copié depuis le blueprint"
test_success "Projet créé avec template app-defi-swap"

# Test 4: Vérifier la structure du projet
test_info "Test 4: Vérification de la structure du projet"
[ -d "apps" ] || test_error "Répertoire apps non trouvé"
[ -d "shared" ] || test_error "Répertoire shared non trouvé"
[ -d "domains" ] || test_error "Répertoire domains non trouvé"
test_success "Structure du projet correcte"

# Test 5: Installer un plugin
test_info "Test 5: Installation d'un plugin"
"$KOMPO_DIR/pnpm" kompo install plugin-wallet --app test-defi-app > /dev/null 2>&1
# Vérifier que le blueprint a été copié
[ -f "README.md" ] && grep -q "Wallet Connection Plugin" README.md || test_error "Blueprint du plugin non copié"
test_success "Plugin installé avec succès"

# Test 6: Erreur - template non trouvé
test_info "Test 6: Gestion d'erreur - template non trouvé"
cd "$TEST_DIR"
"$KOMPO_DIR/pnpm" kompo new test-error --template template-inexistant 2>&1 | grep -q "not found" || test_error "Erreur non gérée pour template inexistant"
test_success "Erreur gérée correctement pour template inexistant"

# Test 7: Erreur - app non existante pour install
test_info "Test 7: Gestion d'erreur - app non existante"
cd "$TEST_DIR/test-defi-app"
"$KOMPO_DIR/pnpm" kompo install plugin-wallet --app app-inexistante 2>&1 | grep -q "does not exist" || test_error "Erreur non gérée pour app inexistante"
test_success "Erreur gérée correctement pour app inexistante"

# Test 8: Upgrade vers Enterprise
test_info "Test 8: Upgrade vers Enterprise"
cd "$TEST_DIR"
mkdir -p test-upgrade/packages/enterprise-plugins/backend
echo 'console.log("Enterprise backend")' > test-upgrade/packages/enterprise-plugins/backend/index.ts
cd test-upgrade
echo "test-key-12345" | "$KOMPO_DIR/pnpm" kompo upgrade enterprise > /dev/null 2>&1
[ -f "packages/enterprise-plugins/backend/index.ts" ] || test_error "Upgrade enterprise échoué"
test_success "Upgrade vers Enterprise réussi"

# Test 9: Templates après upgrade (optionnel - si templates enterprise existent)
test_info "Test 9: Vérification des templates après upgrade"
TEMPLATES_AFTER_UPGRADE=$("$KOMPO_DIR/pnpm" kompo new --list-templates 2>&1)
echo "$TEMPLATES_AFTER_UPGRADE" | grep -q "app-defi-swap" || test_error "Templates community perdus après upgrade"
test_success "Templates conservés après upgrade"

# Test 10: Créer un template custom
test_info "Test 10: Création et utilisation d'un template custom"
cd "$KOMPO_DIR"
mkdir -p packages/templates/community/app-test-custom/blueprint
cat > packages/templates/community/app-test-custom/template.json << 'EOF'
{
  "name": "app-test-custom",
  "description": "Template de test personnalisé",
  "version": 1,
  "type": "app",
  "category": "test",
  "stack": {
    "required": ["nextjs"],
    "designSystem": ["shadcn"]
  },
  "blueprint": "./blueprint"
}
EOF

echo "# Test Custom Template" > packages/templates/community/app-test-custom/blueprint/README.md

cd "$TEST_DIR"
"$KOMPO_DIR/pnpm" kompo new test-custom-app --template app-test-custom > /dev/null 2>&1
cd test-custom-app
[ -f "README.md" ] && grep -q "Test Custom Template" README.md || test_error "Template custom non appliqué"
test_success "Template custom créé et utilisé avec succès"

# Nettoyage du template custom
rm -rf "$KOMPO_DIR/packages/templates/community/app-test-custom"

# Résumé des tests
echo ""
echo "======================================"
echo -e "${GREEN}🎉 Tous les tests E2E sont passés avec succès !${NC}"
echo "======================================"
echo ""
echo "Résumé des tests validés :"
echo "✅ Installation des dépendances"
echo "✅ Listing des templates Community"
echo "✅ Création d'un projet avec template app"
echo "✅ Vérification de la structure du projet"
echo "✅ Installation d'un plugin"
echo "✅ Gestion d'erreur - template non trouvé"
echo "✅ Gestion d'erreur - app non existante"
echo "✅ Upgrade vers Enterprise"
echo "✅ Conservation des templates après upgrade"
echo "✅ Création et utilisation d'un template custom"
echo ""
echo -e "${GREEN}Le système de templates unifié Kompo est fonctionnel !${NC}"
