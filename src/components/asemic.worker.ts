import { Parser } from './parse'

let parser: Parser = new Parser()

self.onmessage = (ev: MessageEvent<Data>) => {
  if (ev.data.source) {
    parser.parse(ev.data.source)
    const formattedCurves = parser.format(ev.data.settings!)
    self.postMessage({ curves: formattedCurves })
  }
  if (ev.data.font) {
    parser.font = ev.data.font
  }
}
