import { cloneDeep } from 'lodash'
import { FlatTransform, Parser } from './parse'
import Renderer from './renderer'

let parser: Parser = new Parser()

let devicePixelRatio = 2
self.onmessage = (ev: MessageEvent<Data>) => {
  if (ev.data.progress) {
    Object.assign(parser.progress, ev.data.progress)
  }
  if (ev.data.settingsSource) {
    parser.parseSettings(ev.data.settingsSource)
    self.postMessage({ settings: parser.settings })
  }
  if (ev.data.preProcess) {
    parser.preProcess = ev.data.preProcess
  }
  if (ev.data.live) {
    Object.assign(parser.live, ev.data.live)
  }
  if (ev.data.source) {
    parser.reset()
    parser.source = ev.data.source
    parser.doPreProcess()
    parser.parse(parser.source)
    parser.format()

    self.postMessage({
      lastTransform: {
        translation: parser.transform.translation,
        rotation: parser.transform.rotation,
        scale: parser.transform.scale,
        width: parser.getDynamicValue(parser.transform.width)
      } as FlatTransform,
      ...parser.output
    })
  }
}
