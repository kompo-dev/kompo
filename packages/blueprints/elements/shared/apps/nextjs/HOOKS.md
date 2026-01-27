# Next.js Base Template Hooks

This template exposes several "hooks" (injection points) allowing derived blueprints (like `nextjs-wallet` or `nft-marketplace`) to inject code into the main `page.tsx` without replacing the entire file.

## Available Hooks

### `page-top`

**Context**: Top of the file, before imports.
**Usage**: Rarely used, maybe for directives like `"use client"` if not already present, or file-level comments.

### `page-imports`

**Context**: After standard imports, before the component definition.
**Usage**: Import components, hooks, or libraries required by your feature.

```typescript
// Example
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
```

### `page-logic`

**Context**: Inside the `Home` component, before the return statement.
**Usage**: React hooks initialization, data fetching, or derived state.

```typescript
// Example
const { address, isConnected } = useAccount();
const [mounted, setMounted] = useState(false);
```

### `demo-container`

**Context**: Inside the `<main>` or demo section of the JSX return.
**Usage**: rendering the UI components for your feature.

```tsx
// Example
<div className="p-4 border rounded">
  <h3>Wallet Status</h3>
  <ConnectButton />
</div>
```

## How to use

In your `blueprint.json`, map these keys to your snippet files under the `hooks` property:

```json
"hooks": {
  "page-imports": "snippets/imports.eta",
  "demo-container": "snippets/demo.eta"
}
```
