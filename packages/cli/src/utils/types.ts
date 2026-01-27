export interface TemplateConfig {
  version: number
  name: string
  description: string
  category: string
  tags: string[]
  plans: {
    community: {
      frontend: string[]
      backend: string[]
    }
    enterprise: {
      frontend: string[]
      backend: string[]
    }
  }
  dependencies: {
    community: string[]
    enterprise: string[]
  }
  history: Array<{
    action: string
    plugin?: string
    template?: string
    app: string
    adapter?: string
  }>
}

export interface TemplateOptions {
  frontend?: string
  backend?: string
  plan?: 'community' | 'enterprise'
}
