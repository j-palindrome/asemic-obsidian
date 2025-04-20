import { AsemicFont } from './defaultFont'
import { Parser } from './parse'

declare global {
  interface Data {
    font?: AsemicFont
    source?: string
    progress?: Partial<Parser['progress']>
    settingsSource?: string
  }
  interface DataBack {
    osc?: { path: string; args: any[] }
    [string: string]: any
  }
}

declare module '*.worker' {
  export default Worker
}

export {}
