export interface PortTypeDefinition {
  value: string // Internal ID (e.g. 'repository')
  label: string // Display Label (e.g. 'Repository')
  suffix: string // Hexagonal Suffix (e.g. 'repository')
  capabilities: string[] // Supported Adapter Capabilities (e.g. ['orm', 'nosql'])
  hint: string // Description for CLI
  icon?: string // Emoji icon
}

export const PORT_DEFINITIONS: PortTypeDefinition[] = [
  // --- Domain Logic / Persistence ---
  {
    value: 'repository',
    label: 'Repository',
    suffix: 'repository',
    capabilities: ['orm', 'cache', 'storage'],
    hint: 'Persistence (SQL, NoSQL, Storage)',
    icon: '🗄️ ',
  },
  {
    value: 'index',
    label: 'Index',
    suffix: 'index',
    capabilities: ['search', 'indexer', 'analytics'],
    hint: 'Search & Indexing (Algolia, TheGraph, PostHog)',
    icon: '🔍',
  },
  {
    value: 'cache',
    label: 'Cache', // Specific enough to be its own port type? Or merged into Repository?
    suffix: 'cache',
    capabilities: ['cache'],
    hint: 'Caching Layer (Redis, Upstash)',
    icon: '⚡',
  },

  // --- External Interactions ---
  {
    value: 'gateway',
    label: 'Service Gateway (Integrations/SDKs)',
    suffix: 'gateway',
    capabilities: ['gateway', 'storage', 'ai', 'rpc', 'http'],
    hint: 'High-level access (OpenAI, Octokit, S3)',
    icon: '🌐',
  },
  {
    value: 'http',
    label: 'HTTP Client (REST/API)',
    suffix: 'gateway',
    capabilities: ['http'],
    hint: 'Low-level HTTP calls (Axios, Fetch)',
    icon: '🌍',
  },
  {
    value: 'graphql',
    label: 'GraphQL Client',
    suffix: 'gateway',
    capabilities: ['graphql'],
    hint: 'Raw GraphQL Operations',
    icon: '🕸️ ',
  },
  {
    value: 'processor',
    label: 'Processor',
    suffix: 'processor',
    capabilities: ['payments', 'media', 'identity'],
    hint: 'Delegated Processing (Stripe, Cloudinary, Onfido)',
    icon: '🏭',
  },

  // --- Infrastructure Services ---
  {
    value: 'provider',
    label: 'Provider',
    suffix: 'provider',
    capabilities: ['wallet', 'auth', 'account', 'flags'],
    hint: 'Infrastructure Providers (Auth, Wallet, Feature Flags)',
    icon: '🏗️ ',
  },

  // --- Messaging / Events ---
  {
    value: 'bus',
    label: 'Event Bus',
    suffix: 'bus',
    capabilities: ['events'],
    hint: 'Event Messaging (Kafka, RabbitMQ)',
    icon: '🚌',
  },
  {
    value: 'sender',
    label: 'Sender',
    suffix: 'sender',
    capabilities: ['notifications'],
    hint: 'Message Sending (Email, SMS, Push)',
    icon: '📨',
  },
  {
    value: 'monitor',
    label: 'Monitor',
    suffix: 'monitor',
    capabilities: ['observability'],
    hint: 'System Monitoring (Sentry, Datadog)',
    icon: '📡',
  },

  // --- Complex Logic ---
  {
    value: 'executor',
    label: 'Executor',
    suffix: 'executor',
    capabilities: ['jobs'],
    hint: 'Background Jobs & Workflows',
    icon: '⚙️ ',
  },

  // --- Generic ---
  {
    value: 'other',
    label: 'Other',
    suffix: 'port',
    capabilities: [],
    hint: 'Generic / Custom Port',
    icon: '📦',
  },
]

export const KOMPO_RECOMMENDED_SUFFIXES = PORT_DEFINITIONS.map((p) => ({
  value: p.suffix,
  label: p.suffix,
  group: ['repository', 'index', 'cache', 'bus'].includes(p.value)
    ? 'Domain Logic'
    : 'Infrastructure',
  hint: p.hint,
}))
