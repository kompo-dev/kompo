# Kompo CLI Tests

This folder contains test scripts for the unified template system Kompo.

## Available Scripts

### `test-quick.sh` - Quick Test

Tests basic functionality of the template system.

```bash
# Run quick test
pnpm test:templates

# Or directly
./scripts/test-quick.sh
```

**What it tests:**

- Listing of templates
- Creation of a project with an app template
- Installation of a plugin
- Cleanup

### `test-e2e.sh` - Full E2E Tests

Tests all usage scenarios of the system.

```bash
# Run all E2E tests
pnpm test:e2e

# Or directly
./scripts/test-e2e.sh
```

**What it tests:**

1. Installation of dependencies
2. Listing of Community templates
3. Creation of a project with an app template
4. Verification of the project structure
5. Installation of a plugin
6. Error handling (template not found)
7. Error handling (app not existent)
8. Upgrade to Enterprise
9. Preservation of templates after upgrade
10. Creation and usage of a custom template

## Manual Test Scenarios

### Scenario 1: Complete DeFi DApp

```bash
# Create the project
pnpm kompo new defi-app --template app-defi-swap

# Add components
pnpm kompo install plugin-wallet --app defi-app
pnpm kompo install erc20-allowance --app defi-app

# Verify structure
ls -la defi-app/apps/
ls -la defi-app/libs/
```

### Scenario 2: Enterprise Upgrade

```bash
# Create a Community project
pnpm kompo new my-dapp --template app-defi-swap

# Upgrade to Enterprise
pnpm kompo upgrade enterprise

# Verify Enterprise templates are available
pnpm kompo new --list-templates
```

### Scenario 3: Custom Template

```bash
# Create a template
mkdir packages/templates/community/app-my-template
cd packages/templates/community/app-my-template

# Create template.json
cat > template.json << 'EOF'
{
  "name": "app-my-template",
  "description": "My custom template",
  "type": "app",
  "category": "custom",
  "stack": {
    "required": ["nextjs"],
    "designSystem": ["shadcn"]
  },
  "blueprint": "./blueprint"
}
EOF

# Add a blueprint
mkdir blueprint
echo "# My Template" > blueprint/README.md

# Use the template
cd /tmp
pnpm kompo new test-app --template app-my-template
```

## Debugging Tests

### Enable Debug Mode

```bash
# For detailed logs
DEBUG=kompo:* pnpm kompo new test-app --template app-defi-swap

# For E2E tests
DEBUG=kompo:* ./scripts/test-e2e.sh
```

### Check Common Errors

1. **Template not found**

   ```bash
   pnpm kompo new --list-templates
   # Check that your template is in the list
   ```

2. **App not existent**

   ```bash
   # Check project structure
   ls -la apps/
   ```

3. **Dependency issues**

```bash
# Reinstall everything
pnpm clean:all
pnpm install
```

## Contributing to Tests

To add a new test:

1. Modify `test-e2e.sh` for full tests
2. Modify `test-quick.sh` for quick tests
3. Document the new scenario here
4. Update the "What it tests" section

## Test Report

After running the tests, you should see:

```text
🎉 All E2E tests passed successfully!
======================================
Test Summary:
✅ Dependencies installed
✅ Community templates listed
✅ Project created with app template
✅ Project structure verified
✅ Plugin installed
✅ Error handling - template not found
✅ Error handling - app not existent
✅ Enterprise upgrade
✅ Templates preserved after upgrade
✅ Custom template created and used
```

If a test fails, the script will stop immediately with an error message.
