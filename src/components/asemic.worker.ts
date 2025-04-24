import { cloneDeep } from 'lodash'
import { FlatTransform, Parser } from './parse'

let parser: Parser = new Parser()
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
        thickness: parser.getDynamicValue(parser.transform.thickness)
      } as FlatTransform,
      ...parser.output
    })
  }
}
