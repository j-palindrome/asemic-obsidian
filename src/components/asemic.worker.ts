import { Parser } from './parse'

let parser: Parser = new Parser()

self.onmessage = (ev: MessageEvent<Data>) => {
  if (ev.data.source) {
    parser.parse(ev.data.source)
    self.postMessage({ curves: parser.format(ev.data.settings!) })
  }
  if (ev.data.font) {
    parser.font = ev.data.font
  }
}
