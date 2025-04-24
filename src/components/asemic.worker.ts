import { cloneDeep } from 'lodash'
import { FlatTransform, Parser } from './parse'
import Renderer from './renderer'

let parser: Parser = new Parser()
const offscreenCanvas = new OffscreenCanvas(1080, 1080)
const ctx = offscreenCanvas.getContext('2d')!
const renderer = new Renderer(ctx)

let devicePixelRatio = 2
self.onmessage = (ev: MessageEvent<Data>) => {
  if (ev.data.progress) {
    Object.assign(parser.progress, ev.data.progress)
    offscreenCanvas.width = parser.progress.width * devicePixelRatio
    offscreenCanvas.height = parser.progress.height * devicePixelRatio
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

    renderer.render(parser.output.curves)
    const bitmap = offscreenCanvas.transferToImageBitmap()

    self.postMessage(
      {
        lastTransform: {
          translation: parser.transform.translation,
          rotation: parser.transform.rotation,
          scale: parser.transform.scale,
          thickness: parser.getDynamicValue(parser.transform.thickness)
        } as FlatTransform,
        ...parser.output,
        bitmap
      },
      undefined,
      [bitmap]
    )
  }
}
