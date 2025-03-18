import { Group, Pt } from 'pts'
import { defaultFont } from './defaultFont'
import { parse } from './parse'

const canvas = new OffscreenCanvas(1920, 1920)
const ctx = canvas.getContext('2d')!
ctx.scale(1920, 1920)
let grid: { x: number; y: number } = { x: 100, y: 100 }
let font = defaultFont

self.onmessage = (ev: MessageEvent<Data>) => {
  if (ev.data.grid) {
    grid = ev.data.grid
  }
  if (ev.data.font) {
    font = ev.data.font
  }
  if (ev.data.curves) {
    ctx.clearRect(0, 0, 1, 1)
    // for (let group of parse(ev.data.curves)) {

    // }
  }
}
const map = canvas.transferToImageBitmap()
self.postMessage({ bitmap: map })
