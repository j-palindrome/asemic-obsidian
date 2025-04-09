import { Parser } from './parse'

let parser: Parser = new Parser()
self.onmessage = (ev: MessageEvent<Data>) => {
  if (ev.data.settings) {
    parser.progress.height = ev.data.settings.height
    parser.progress.width = ev.data.settings.width
  }
  if (ev.data.source) {
    parser.reset()
    parser.parse(ev.data.source)
    const formattedCurves = parser.format()
    self.postMessage({ curves: formattedCurves })
  }
  if (ev.data.font) {
    parser.font = ev.data.font
  }
}
