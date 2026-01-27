# Contributing to Kompo

First off, thank you for considering contributing to Kompo! It's people like you that make Kompo such a great tool for the Web3 community.

## 🌈 Our Philosophy

Kompo is built on the principles of **Functional Programming** and **Hexagonal Architecture**. We value:

- **Purity:** Functions should be deterministic and side-effect free where possible.
- **Modularity:** Everything should be a swappable component.
- **Type Safety:** TypeScript is our first-class citizen.

## 🛠️ Local Development Setup

### Prerequisites

- Node.js >= 24.12.0
- PNPM >= 10.28.1

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/kompo-dev/kompo.git
   cd kompo
   ```
2. Install dependencies:
   ```bash
   pnpm install
   ```

### Project Structure

- `apps/`: Entry points for applications.
- `libs/`: Business logic (domains, ports) and infrastructure (adapters, drivers).
- `packages/cli/`: The core Kompo CLI tool.
- `packages/blueprints/`: The library of available templates.

## 📜 Coding Guidelines

### Functional Programming First

- **No classes:** Use factory functions and plain objects instead.
- **Small functions:** Keep functions focused and concise.
- **Factory Naming:** Use `create` + PascalCase (e.g., `createWalletAdapter`).

### Naming Conventions

- **Files:** `kebab-case.ts`
- **Types:** `PascalCase`
- **Functions:** `camelCase`

## 🚀 Pull Request Process

1. Create a new branch for your feature or bugfix.
2. Ensure all tests pass: `pnpm test`.
3. Format your code: `pnpm format`.
4. Lint your code: `pnpm lint`.
5. Submit your PR with a clear description of the changes.

## 💬 Community

- Join our [Discord](https://discord.gg/your-link) for discussions.
- Report bugs via [GitHub Issues](https://github.com/kompo-dev/kompo/issues).

---

Thank you for building the future of Web3 with us!
