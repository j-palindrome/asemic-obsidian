import { AsemicFont } from './defaultFont'
import { Parser } from './parse'

declare global {
  interface Data {
    font?: AsemicFont
    source?: string
    progress?: Partial<Parser['progress']>
  }
}

declare module '*.worker' {
  export default Worker
}

export {}
