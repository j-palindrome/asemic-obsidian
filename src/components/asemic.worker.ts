import { Group, Pt } from 'pts'
import { defaultFont } from './defaultFont'
import { Parser } from './parse'
import Renderer from './renderer'

const canvas = new OffscreenCanvas(1920, 1920)
const ctx = canvas.getContext('2d')!
let parser = new Parser()
let renderer = new Renderer(ctx)

self.onmessage = (ev: MessageEvent<Data>) => {
  if (ev.data.font) {
    parser.font = ev.data.font
  }
  // test change
  if (ev.data.curves) {
    parser.reset()
    parser.parse(ev.data.curves)
    renderer.render(parser.curves)
    const map = canvas.transferToImageBitmap()
    self.postMessage({ bitmap: map })
  }
}
