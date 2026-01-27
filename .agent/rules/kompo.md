---
trigger: always_on
---

# Kompo Project Rules

## Architecture & Coding Style

### Functional Programming First

- **No classes** - Use factory functions and plain objects instead
- Prefer pure functions where possible
- Use TypeScript `type` definitions (not `interface`) for data shapes
- Adapters should export factory functions: `createXxxAdapter()`

### Naming Conventions

- **Files**: kebab-case (e.g., `user-repository.ts`)
- **Types**: PascalCase (e.g., `UserRepository`)
- **Functions**: camelCase (e.g., `createUserRepository`)
- **Factory functions**: `create` + PascalCase (e.g., `createWalletAdapter`)

### Template Variables (Eta templates)

Standard variables for adapter/port generation:

- `name` - kebab-case (e.g., `user-profile`)
- `pascalName` - PascalCase (e.g., `UserProfile`)
- `camelName` - camelCase (e.g., `userProfile`)
- `scope` - Package scope (e.g., `company`)
- `provider` - Provider ID (e.g., `drizzle`, `redis`)

### Project Structure

- `libs/` - Business logic (domains, ports, entities, use-cases), Infrastructure (aapters, drivers)
- `apps/` - Application entry points
- `packages/cli/` - CLI tool (generators, templates)

### CLI Templates

- Use `.eta` extension for Eta templates
- Templates in `packages/cli/src/templates/add/adapter/`
- Each adapter type has `default/` and provider-specific subdirectories
