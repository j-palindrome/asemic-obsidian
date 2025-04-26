import { AsemicFont } from './defaultFont'
import { FlatTransform, Parser, Transform } from './parse'

declare global {
  interface Data {
    source?: string
    progress?: Partial<Parser['progress']>
    settingsSource?: string
    preProcess?: Parser['preProcess']
    live: {
      keys?: string
      text?: string
      keysIndex?: number
      textIndex?: number
    }
  }
  type DataBack = {
    response?: 'editable'
    bitmap?: ImageBitmap
    [string: string]: any
  } & Partial<Parser['output']>
}

declare module '*.worker' {
  export default Worker
}

export {}
