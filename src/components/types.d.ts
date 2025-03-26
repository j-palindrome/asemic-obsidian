import { AsemicFont } from './defaultFont'

declare global {
  type ParserSettings = {
    height: number
    width: number
  }

  interface Data {
    font?: AsemicFont
    source?: string
    settings?: ParserSettings
  }
}

declare module '*.worker' {
  export default Worker
}

export {}
