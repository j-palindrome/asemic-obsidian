import { Parser } from './parse'

let parser: Parser = new Parser()
let throttle = false
self.onmessage = (ev: MessageEvent<Data>) => {
  if (throttle) return
  throttle = true
  if (ev.data.settings) {
    parser.set(ev.data.settings!)
  }
  if (ev.data.source) {
    parser.reset()
    parser.parse(ev.data.source)
    const formattedCurves = parser.format()
    throttle = false
    self.postMessage({ curves: formattedCurves })
  }
  if (ev.data.font) {
    parser.font = ev.data.font
  }
}
