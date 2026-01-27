<div align="center">
  <img src="https://raw.githubusercontent.com/kompo-dev/kompo/main/packages/assets/kompo.svg" alt="Kompo Logo" width="120" />
  <h1>Kompo</h1>
  <p>
  <strong>Code orchestration for web3.</strong></p>
  <p><i>Deploy modular adapters. Own your code.</i></p>

  <p>
    <a href="https://www.npmjs.com/package/@kompo-dev/create-kompo"><img src="https://img.shields.io/npm/v/@kompo-dev/create-kompo?style=flat-square&color=blue" alt="Version" /></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License" /></a>
    <a href="https://twitter.com/kompodev"><img src="https://img.shields.io/badge/twitter-@kompodev-1DA1F2?style=flat-square" alt="Twitter" /></a>
    <a href="https://discord.gg/kompo"><img src="https://img.shields.io/badge/discord-join-7289DA?style=flat-square" alt="Discord" /></a>
  </p>
</div>

---

## Why Kompo?

Building web3 apps today means **starting from scratch every time**.

You spend **40-60% of your time** on boilerplate:

- Setting up wallet connections (RainbowKit, SIWE, session management)
- Configuring indexers (Ponder, The Graph, custom event listeners)
- Managing RPC providers (Alchemy, Infura, fallbacks)
- Handling multi-chain logic (contract addresses, chain routing)
- Generating types from ABIs and schemas

And when you want to switch providers—**you refactor everything**.

**Kompo eliminates the boilerplate while keeping you 100% in control.**

---

## What is Kompo?

A **code orchestration framework** for TypeScript web3 developers.

Built on **Hexagonal Architecture** (Ports & Adapters), Kompo lets you:

- **Declare your stack once** in a single config file.
- **Deploy modular adapters** directly into your codebase.
- **Swap providers anytime** without refactoring.

**The Terraform of web3 code.** Declare once, swap providers anytime.

> Think: **Terraform for your application code**, not your infrastructure.

**Infrastructure as Code** democratized cloud deployment. **Code as a Service** democratizes web3 development.

---

## What You Get

| ✨ Pre-Built Adapters               | 🎯 Production Patterns          | 🚀 Templates Included        |
| :---------------------------------- | :------------------------------ | :--------------------------- |
| **Wallet:** RainbowKit + SIWE       | Type-safe contract interactions | NFT Marketplace              |
| **Indexing:** Ponder, The Graph     | Multi-chain configuration       | DAO Governance               |
| **RPC:** Alchemy, Infura, QuickNode | Error handling & retries        | DeFi Dashboard               |
| **Storage:** Pinata, Arweave        | Rate limiting & caching         | Cross-chain yield aggregator |
| **Database:** Postgres, Neon        | Session management              |                              |

---

## ⚡ Quick Start

### 1. Create a project

```bash
pnpm create kompo@latest my-awesome-app
cd my-awesome-app
```

### 2. Choose your stack (interactive CLI)

```text
? Select authentication strategy
  → Wallet + session (SIWE + NextAuth)

? Select indexing provider
  → Ponder

? Select chains
  → Ethereum
  → Polygon
  → Arbitrum

✓ Stack configured! 5 adapters installed.
✓ Types generated from ABIs.
✓ Ready to build.
```

### 3. Start building

```bash
pnpm dev
```

### What you have:

- ✅ Typed multi-chain wallet connection
- ✅ Smart contract indexing configured
- ✅ RPC provider setup with fallbacks
- ✅ Production patterns included
- ✅ Ready to ship

### Time Saved (Real Numbers)

| Task                   | Manual         | Kompo          |
| :--------------------- | :------------- | :------------- |
| Wallet + session setup | 4-6 hours      | **2 minutes**  |
| Multi-chain config     | 2-4 weeks      | **10 minutes** |
| Indexer setup          | 3-5 hours      | **5 minutes**  |
| Type generation        | 2-3 hours      | **30 seconds** |
| **MVP dApp**           | **8-12 weeks** | **2-3 days**   |

---

## 🏛️ Core Architecture

Hexagonal Architecture separates business logic from infrastructure concerns:

```
┌─────────────────────────────────────┐
│    Your Core Logic (Pure TS)        │
│  (business rules, no dependencies)  │
└──────────────┬──────────────────────┘
               │
┌──────────────┴──────────────────────┐
│  Ports (Interfaces / Contracts)     │
│  (what your core needs)             │
└──────────────┬──────────────────────┘
               │
┌──────────────┴──────────────────────┐
│  Adapters (Implementations)         │
│  (how you get it: Alchemy, Ponder)  │
└─────────────────────────────────────┘
```

Change an adapter (e.g., Alchemy → Infura) → **everything else works unchanged**.

### Example: Swap RPC Providers

**Before** (3+ hours of refactoring):

```typescript
// Old code using Alchemy
import { Alchemy, Network } from "alchemy-sdk";
const alchemy = new Alchemy({ apiKey: process.env.ALCHEMY_KEY });
const balance = await alchemy.core.getBalance(address);
```

**After** (1 line of config):

```json
// kompo.config.json
{
  "adapters": {
    "rpc-provider": {
      "port": "rpc",
      "engine": "infura"
    }
  }
}
```

```typescript
// Your code stays the same
import { rpc } from "@/composition";
const balance = await rpc.getBalance(address);
```

---

## 🚀 Use Cases Built With Kompo

### NFT Marketplace (Ethereum + Polygon)

```bash
pnpm kompo add template nft-marketplace
```

**Pre-built:** Wallet connection, Contract interaction (mint, list, buy), Multi-chain contract management, Event indexing.

### DAO Governance (Multi-chain)

```bash
pnpm kompo add template dao
```

**Pre-built:** Member voting, Proposal execution, Cross-chain quorum, Treasury management.

### DeFi Dashboard (10+ chains)

```bash
pnpm kompo add template defi-dashboard
```

**Pre-built:** Token balance aggregation, Swap routing, Staking positions, Cross-chain liquidity.

---

## 🗝️ Key Features

### 🚀 Ship Faster

- Pre-configured adapters for wallet auth, indexing, RPC.
- Multi-chain setup in one file (`kompo.config.json`).
- CLI scaffolds production patterns in seconds.

### 🔄 Zero Vendor Lock-In

- Change RPC providers with 1 line of config.
- Swap indexers without touching your code.
- Add new chains to existing contracts instantly.
- **Own 100% of your codebase** (it's all in your repo).

### 🎯 Type-Safe End-to-End

- TypeScript types generated from smart contract ABIs.
- Full autocomplete for contract methods and events.
- Compile-time validation prevents runtime errors.

### 🛠️ Production-Ready

- Error handling and retry logic included.
- RPC rate limiting and caching built-in.
- Server-side signing patterns.
- OpenTelemetry integration for monitoring.

---

## 💻 Tech Stack

- **Framework:** Next.js (extensible to Remix, NestJS, Express)
- **Runtime:** TypeScript + Node.js
- **CLI:** Powerful generator for scaffolding and code generation
- **Architecture:** Hexagonal (Ports & Adapters)
- **Web3 Libraries:** Viem, RainbowKit, Ponder, Alchemy SDK

---

## 🚦 Status: Beta

Kompo is currently in **Beta (v0.1.0)**.

- ✅ Fully functional and used in production
- ✅ APIs stable and well-documented
- 🔄 Adding new adapters and templates regularly
- ⚠️ Expect occasional breaking changes as we move toward v1.0

---

## 📖 Getting Started

### 1. Create a project

```bash
pnpm create kompo@latest my-app
cd my-app
```

### 2. Add an adapter

```bash
# Example: Add a Ponder Indexer
pnpm kompo add port indexer --domain blockchain
pnpm kompo add adapter ponder --port indexer --domain blockchain
```

### 3. Wire it up

```bash
# Generates the composition layer
pnpm kompo wire blockchain --app my-app
```

### 4. Configuration (`kompo.config.json`)

Kompo uses a central JSON configuration file (`libs/config/kompo.config.json`) to manage your architecture.

```json
{
  "project": {
    "name": "my-app",
    "org": "acme"
  },
  "domains": {
    "blockchain": {
      "ports": ["indexer"]
    }
  },
  "adapters": {
    "indexer-ponder": {
      "port": "indexer",
      "engine": "ponder",
      "path": "libs/adapters/indexer-ponder"
    }
  },
  "apps": {
    "apps/my-app": {
      "ports": {
        "indexer": "indexer-ponder"
      }
    }
  }
}
```

### 5. Usage in Your App

Once wired, Kompo generates a type-safe composition layer. You simply import the domain.

```typescript
// src/app/page.tsx
// Import the wired domain from the composition layer
import { blockchain } from '@/composition';

export default async function Dashboard() {
  // Access your adapters through the domain interface
  const updates = await blockchain.indexer.getLatestUpdates();

  return (
    <div>
      {updates.map(u => <div key={u.id}>{u.hash}</div>)}
    </div>
  );
}
```

---

## 🗺️ Roadmap (Next 90 Days)

### ✅ In Progress

- [ ] QuickNode and Ankr RPC adapters
- [ ] DAO governance template
- [ ] Enhanced error handling and logging
- [ ] Security best practices guide

### 📋 Coming Soon (Feb-Mar)

- [ ] Subgraph integration improvements
- [ ] Cross-chain transaction orchestration helpers
- [ ] Enterprise support tier
- [ ] Architecture review credits system

### 🤔 Exploring (Q1 2026)

- [ ] AI-assisted code generation
- [ ] VSCode extension for adapter management
- [ ] Kompo Cloud for team configuration sharing

---

## ❓ FAQ

<details>
<summary><strong>Is Kompo production-ready?</strong></summary>
Yes. It's currently used in production by teams building dApps. We're in Beta (v0.1.0) as we refine APIs and add more adapters. Expect to ship to mainnet confidently.
</details>

<details>
<summary><strong>How is Kompo different from Scaffold-ETH?</strong></summary>
Scaffold-ETH is great for learning and quick prototypes. Kompo is built for professional developers building production apps. Kompo focuses on architecture, type safety, and zero vendor lock-in.
</details>

<details>
<summary><strong>How is Kompo different from Thirdweb/Moralis?</strong></summary>
Thirdweb and Moralis are managed platforms (SaaS). You use their APIs and get locked into their services. Kompo is a framework. You own your code, your infrastructure, your choices. You can swap providers anytime.
</details>

<details>
<summary><strong>Do I need to use all adapters?</strong></summary>
No. Kompo is modular. Use what you need, add more later. Start minimal and grow.
</details>

<details>
<summary><strong>Can I use Kompo with my existing codebase?</strong></summary>
Yes. Install <code>@kompo/core</code> and <code>@kompo/nextjs</code> in your Next.js project and start integrating adapters incrementally.
</details>

---

## 🤝 Contributing

We welcome contributions from the community!

1.  Fork the repo: `git clone https://github.com/kompo-dev/kompo.git`
2.  Install dependencies: `pnpm install`
3.  Create a feature branch: `git checkout -b feature/my-feature`
4.  Submit a pull request.

Check out [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

### Community Channels

- 💬 [Discord Community](https://discord.gg/kompo) - Real-time chat and support
- 🐦 [Twitter](https://twitter.com/kompodev) - Latest updates and announcements
- 💌 [Email Updates](mailto:support@kompo.dev) - Subscribe for major releases

---

## License

**MIT © 2026 SmarttDev and Kompo contributors**

---

<div align="center">
  <p><strong>Kompo is built by SmarttDev and an amazing community of web3 developers.</strong></p>
  <p>Ready to stop rebuilding boilerplate?</p>
  <br />
  <a href="https://kompo.dev">Get Started →</a> | <a href="https://docs.kompo.dev">Docs →</a> | <a href="https://discord.gg/kompo">Discord →</a>
</div>
