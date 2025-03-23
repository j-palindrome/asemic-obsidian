declare global {
  type ParserSettings = {
    w: number
  }

  interface Data {
    font?: Record<string, string>
    source?: string
    settings?: ParserSettings
  }
}

declare module '*.worker' {
  export default Worker
}

export {}
