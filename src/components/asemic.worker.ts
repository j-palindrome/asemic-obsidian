import { Parser } from './parse'

let parser: Parser = new Parser()
self.onmessage = (ev: MessageEvent<Data>) => {
  if (ev.data.settings) {
    parser.set(ev.data.settings!)
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
