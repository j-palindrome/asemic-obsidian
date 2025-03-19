import { useEffect, useRef } from 'react'
import { texture } from 'three/tsl'
import { PostProcessing, Texture, WebGPURenderer } from 'three/webgpu'
// @ts-ignore
import AsemicWorker from './asemic.worker'

export default function AsemicApp({ source }: { source: string }) {
  const canvas = useRef<HTMLCanvasElement>(null!)

  useEffect(() => {
    const worker = AsemicWorker() as Worker
    const thisTexture = new Texture()
    worker.onmessage = evt => {
      const imageBitmap = evt.data.bitmap
      if (imageBitmap instanceof ImageBitmap) {
        console.log('bitmap', imageBitmap)

        thisTexture.image = imageBitmap
        thisTexture.needsUpdate = true
      }
      if (evt.data.log) {
        console.log(
          ...(evt.data.log instanceof Array ? evt.data.log : [evt.data.log])
        )
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
      worker.postMessage({
        curves: source
      })
    })
  })

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
