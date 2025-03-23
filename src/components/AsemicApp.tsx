import { useEffect, useRef } from 'react'
// @ts-ignore
import { texture } from 'three/tsl'
import { CanvasTexture, PostProcessing, WebGPURenderer } from 'three/webgpu'
// @ts-ignore
import AsemicWorker from './asemic.worker'
import Renderer from './renderer'

export default function AsemicApp({ source }: { source: string }) {
  const canvas = useRef<HTMLCanvasElement>(null!)

  useEffect(() => {
    const worker = AsemicWorker() as Worker
    const offscreenCanvas = new OffscreenCanvas(1080, 1080)
    const thisTexture = new CanvasTexture(offscreenCanvas)
    thisTexture.flipY = false

    const renderer = new WebGPURenderer({
      canvas: canvas.current
    })
    const thisPass = texture(thisTexture)
    const postProcessing = new PostProcessing(renderer, thisPass)

    const ctx = offscreenCanvas.getContext('2d')!
    const offscreenRenderer = new Renderer(ctx)

    renderer.init().then(() => {
      worker.onmessage = evt => {
        if (evt.data.curves) {
          offscreenRenderer.render(evt.data.curves)
          thisTexture.needsUpdate = true
          postProcessing.render()
        }
      }
      worker.postMessage({
        source,
        settings: { w: 1080 }
      })
      // renderer.setAnimationLoop(() => {
      //   worker.postMessage({
      //     source,
      //     settings: { w: 1080 }
      //   })
      // })
    })
    return () => {
      renderer.dispose()
    }
  }, [])

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
