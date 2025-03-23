import { Parser } from './parse'

let parser: Parser = new Parser()

self.onmessage = (ev: MessageEvent<Data>) => {
  if (ev.data.source) {
    const curves = parser.parse(ev.data.source, ev.data.settings!)
    self.postMessage({ curves })
  }
  if (ev.data.font) {
    parser.font = ev.data.font
  }
}
