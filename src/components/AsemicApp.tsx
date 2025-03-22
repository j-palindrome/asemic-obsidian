import { useEffect, useRef } from 'react'
// @ts-ignore
import AsemicWorker from './asemic.worker'

export default function AsemicApp({ source }: { source: string }) {
  const canvas = useRef<HTMLCanvasElement>(null!)

  useEffect(() => {
    const worker = AsemicWorker() as Worker
    // const thisTexture = new Texture()
    const ctx = canvas.current.getContext('bitmaprenderer')!
    worker.onmessage = evt => {
      const imageBitmap = evt.data.bitmap
      if (imageBitmap instanceof ImageBitmap) {
        ctx.transferFromImageBitmap(imageBitmap)
        imageBitmap.close()
        // thisTexture.image = imageBitmap
        // thisTexture.needsUpdate = true
        // postProcessing.render()
      }
      if (evt.data.log) {
        console.log(
          ...(evt.data.log instanceof Array ? evt.data.log : [evt.data.log])
        )
      }
    }

    worker.postMessage({
      curves: source
    })

    // const renderer = new WebGPURenderer({
    //   canvas: canvas.current
    // })
    // const thisPass = texture(thisTexture)
    // const postProcessing = new PostProcessing(renderer, thisPass)
    // renderer.init().then(() => {
    //   worker.postMessage({
    //     curves: source
    //   })
    // })
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
