import { AsemicFont } from './components/defaultFont'
import { FlatTransform, Parser, Transform } from './components/parse'

declare global {
  interface Data {
    source?: string
    progress?: Partial<Parser['progress']>
    settingsSource?: string
    preProcess?: Parser['preProcessing']
    live: {
      keys?: string
      text?: string
      keysIndex?: number
      textIndex?: number
    }
    error?: string
  }
  type DataBack = {
    response?: 'editable'
    bitmap?: ImageBitmap
    errors?: string[]
    settings?: Parser['settings']
    lastTransform?: FlatTransform
  } & Partial<Parser['output']>
}

declare module '*.worker' {
  export default Worker
}

declare module '*.md' {
  const source: string
  export default source
}
declare global {
  interface Window {
    lastSource?: number
  }
}
export {}
