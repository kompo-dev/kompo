export interface TemplateConfig {
  version: number
  name: string
  description: string
  category: string
  tags: string[]
  plans: {
    community: {
      frameworks: string[]
    }
    enterprise: {
      frameworks: string[]
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
  framework?: string
  plan?: 'community' | 'enterprise'
}
