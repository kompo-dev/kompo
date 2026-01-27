/**
 * Global variables used across all templates
 * These values are shared across all frameworks and design systems
 */

export const GLOBAL_VARIABLES = {
  // Branding
  branding: {
    name: 'Kompo',
    tagline: 'Web3 Component as a Service',
  },

  // Social Links
  socialLinks: {
    github: 'https://github.com/nicmusic/kompo',
    twitter: 'https://twitter.com/nicmusic_xyz',
    farcaster: 'https://warpcast.com/nicmusic.eth',
  },

  // Text content
  texts: {
    hero: {
      title: 'Welcome to ',
      description:
        "Built with Kompo's composable architecture. Swap adapters without changing your code.",
    },
    features: {
      architecture: {
        title: 'Kompo Hexagonal',
        description: 'Ports & Adapters architecture for vendor-lock-free development',
        details: 'Domain logic stays pure. Adapters can be swapped without touching business code.',
        url: 'https://kompo.dev/docs/architecture',
        linkText: 'Learn More',
      },
      getStarted: {
        title: 'Get Started',
        description: 'Build your first feature in minutes',
        commands: [
          'kompo add domain user',
          'kompo add use-case createUser',
          'kompo add adapter orm',
        ],
        url: 'https://kompo.dev/docs/get-started',
        linkText: 'View Guide',
      },
      docs: {
        title: 'Kompo Docs',
        description: 'Complete documentation and examples',
        details: 'Learn best practices, patterns, and advanced features of Kompo.',
        url: 'https://kompo.dev/docs',
        linkText: 'Open Docs',
      },
      studio: {
        title: 'Kompo Studio',
        description: 'Test and preview your adapters',
        details: 'Interactive dashboard to test your components and adapters.',
        url: 'http://localhost:9000',
        linkText: 'Open Studio',
      },
      design: {
        title: 'Design Systems',
        description: 'Pre-configured with your favorite UI library. Shadcn, MUI, Chakra and more.',
      },
      testing: {
        title: 'Testing Ready',
        description: 'Unit tests, integration tests, and E2E tests configured out of the box.',
      },
      deployment: {
        title: 'Easy Deployment',
        description: 'Deploy to Vercel, Railway, or any cloud provider with a single command.',
      },
    },
    footer: 'Built with Kompo',
  },

  // Icons/Emojis
  icons: {
    hexagon: '⬡',
    rocket: '🚀',
    book: '📚',
    palette: '🎨',
  },

  // Colors (for reference in templates)
  colors: {
    emerald: '#10b981',
    blue: '#3b82f6',
    purple: '#a855f7',
    orange: '#f97316',
  },

  // Default ports
  studioPort: 9000,
} as const

// Helper function to merge global variables with template data
export function mergeWithGlobals<T extends Record<string, unknown>>(
  data: T
): T & typeof GLOBAL_VARIABLES {
  return {
    ...GLOBAL_VARIABLES,
    ...data,
  }
}
