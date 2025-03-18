import { useRef, useEffect } from 'react'
import {
  CanvasTexture,
  OrthographicCamera,
  PostProcessing,
  Scene,
  Texture,
  WebGPURenderer
} from 'three/webgpu'
import { pass, texture, vec4 } from 'three/tsl'
// @ts-ignore
import AsemicWorker from './asemic.worker'
import { parse } from './parse'
import { defaultFont } from './defaultFont'

export default function AsemicApp({ source }: { source: string }) {
  const canvas = useRef<HTMLCanvasElement>(null!)

  useEffect(() => {
    const worker = AsemicWorker() as Worker
    const thisTexture = new Texture()
    worker.onmessage = evt => {
      const imageBitmap = evt.data.bitmap
      if (imageBitmap instanceof ImageBitmap) {
        thisTexture.image = imageBitmap
        thisTexture.needsUpdate = true
      }
    }

    const renderer = new WebGPURenderer({
      canvas: canvas.current
    })
    const thisPass = texture(thisTexture)
    const postProcessing = new PostProcessing(renderer, thisPass)
    renderer.init().then(() => {
      renderer.setAnimationLoop(time => {
        postProcessing.render()
      })
    })
  })

  console.log(parse(defaultFont['a']))

  return (
    <div
      className='asemic'
      style={{
        maxHeight: '80vh',
        aspectRatio: '1 / 1',
        width: '100%',
        display: 'flex',
        alignItems: 'center'
      }}>
      <canvas
        ref={canvas}
        style={{ height: '100%', width: '100%' }}
        height={1920}
        width={1920}></canvas>
    </div>
  )
}
