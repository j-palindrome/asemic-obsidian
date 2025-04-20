import { AsemicFont } from './defaultFont'
import { Parser, Transform } from './parse'

declare global {
  interface Data {
    source?: string
    progress?: Partial<Parser['progress']>
    settingsSource?: string
  }
  interface DataBack {
    osc?: { path: string; args: any[] }
    lastTransform?: string
    response?: 'editable'
    [string: string]: any
  }
}

declare module '*.worker' {
  export default Worker
}

export {}
