# Blueprints & Starters Architecture

This document explains the organization and nomenclature of Starters and Blueprints in Kompo, and how the CLI uses them to generate projects.

## 1. Directory Structure (`packages/blueprints`)

The `blueprints` package is the single source of truth for all templates and definitions.

```
packages/blueprints/
├── elements/        # Technical building blocks (Blueprints)
│   ├── apps/        # Application templates (Next.js, Vite, etc.)
│   ├── libs/        # Shared libraries (Adapters, Domains, Ports)
│   │   ├── adapters/
│   │   ├── domains/
│   │   └── ui/      # Design Systems implementations
│   └── shared/      # Shared snippets and files
├── starters/        # User-facing entry points (Starters)
│   ├── nextjs/      # Starters for Next.js
│   │   ├── antd/    # Starters using Ant Design
│   │   │   ├── blank/   # "Blank" starter (starter.json)
│   │   │   └── starter.json # Base config for this family
│   │   └── ...
│   └── vite/        # Starters for Vite
└── ...
```

### Key Distinction

- **Elements (`elements/`)**: These are the "Lego bricks". They contain the actual code templates (`files/`, `snippets/`) and technical definitions (`blueprint.json`). They are framework-agnostic where possible.
- **Starters (`starters/`)**: These are the "Models". They define **combinations** of bricks. A starter doesn't usually contain code; it contains a **Recipe** (`starter.json`) that tells the CLI which bricks to assemble.

---

## 2. File Roles

### `starter.json` (The Recipe)

Located in `products/starters/...`. This is what the user selects when running `kompo new`.

**Key Attributes:**

- **`id`** (required): Unique technical identifier (dot notation).
  - Example: `nextjs.shadcn.blank`
- **`name`** (required): Human-readable display name.
  - Example: `"Blank Project"`
- **`description`**: Short description shown in CLI.
- **`steps`**: **The Orchestration Array**. This is the most important part. It defines the sequence of CLI commands to run to build this starter.

**Example (`nextjs/shadcn/blank/starter.json`):**

```json
{
  "id": "nextjs.shadcn.blank",
  "name": "Blank",
  "steps": [
    {
      "command": "new", // 1. Initialize Project & Workspace
      "type": "app",
      "name": "web", // 2. Create 'apps/web'
      "driver": "nextjs", //    using Next.js driver
      "designSystem": "shadcn"
    },
    {
      "command": "add",
      "type": "adapter",
      "name": "auth-js", // 3. Add Auth Adapter
      "port": "auth-provider"
    }
  ]
}
```

### `blueprint.json` (The Definition)

Located in `elements/...`. This defines a specific component (App, Adapter, Port).

**Key Attributes:**

- **`id`** (required): Unique identifier (matching directory usually).
  - Example: `stripe`, `nextjs`
- **`name`**: Human identifier.
  - Example: `"Stripe Adapter"`
- **`type`**: `app`, `adapter`, `feature`, `driver`.
- **`env`**: Environment variables definition (Zod schema generation).
- **`requires`**: NPM dependencies or other blueprints.
- **`provides`**: Capabilities (e.g., `exports`, `factory` name).

---

## 3. How the CLI Works (`kompo new`)

When you run `kompo new` (or select a starter interactively):

1.  **Selection**: The CLI loads the `starter.json` corresponding to your choice.
2.  **Validation**: It validates the JSON against `starter.schema.json`.
3.  **Extraction**: It reads the `steps` array.
4.  **Execution** (The "Engine"):
    - The CLI executes each step logically, as if you ran them manually.
    - `command: "new", type: "app"` -> triggers `AppGenerator`.
    - `command: "add", type: "adapter"` -> triggers `AdapterGenerator`.
5.  **Generation**:
    - Generators look up the corresponding **Elements** in `packages/blueprints/elements`.
    - They copy files from `elements/**/files` to your project.
    - They render templates using Eta (`.eta`).
    - They inject dependencies into `package.json`.

### Why this split?

This architecture allows **Infinite Combinations**.
We don't need to maintain a "Next.js + Stripe + Tailwind" template AND a "Next.js + Stripe + MUI" template.
We just have:

- 1 Next.js Element
- 1 Stripe Element
- 1 Tailwind Element
- 1 MUI Element

And we can create as many `starter.json` recipes as we want combining them differently.
