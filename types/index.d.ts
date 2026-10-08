export type ColorName = string

declare module 'claude-code' {
  interface PluginState {
    'tint': {
      repo: string | null
      number: number | null
      name: string | null
      color: ColorName | null
      icon: string | null
      pattern: string | null
      isHidden: boolean
      hasFrame: boolean
      isTitling: boolean
      prompts: number
    }
  }
}
