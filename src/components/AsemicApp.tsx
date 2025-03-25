import { useEffect, useRef } from 'react'
// @ts-ignore
import { texture } from 'three/tsl'
import { CanvasTexture, PostProcessing, WebGPURenderer } from 'three/webgpu'
// @ts-ignore
import AsemicWorker from './asemic.worker'
import Renderer from './renderer'
import AsemicPlugin, { AsemicFrame } from 'src/main'
import invariant from 'tiny-invariant'

export default function AsemicApp({
  source,
  plugin,
  parent
}: {
  source: string
  plugin: AsemicPlugin
  parent: AsemicFrame
}) {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const worker = AsemicWorker() as Worker
    let settings = {
      animating: true
    }
    invariant(canvas.current)
    const offscreenCanvas = new OffscreenCanvas(
      canvas.current.height * devicePixelRatio,
      canvas.current.width * devicePixelRatio
    )
    // const thisTexture = new CanvasTexture(offscreenCanvas)
    // thisTexture.flipY = false
    const onResize = () => {
      invariant(canvas.current)
      offscreenCanvas.height = canvas.current.height * devicePixelRatio
      offscreenCanvas.width = canvas.current.width * devicePixelRatio
    }
    window.addEventListener('resize', onResize)

    // const renderer = new WebGPURenderer({
    //   canvas: canvas.current
    // })
    // const thisPass = texture(thisTexture)
    // const postProcessing = new PostProcessing(renderer, thisPass)

    const ctx = offscreenCanvas.getContext('2d')!
    const offscreenRenderer = new Renderer(ctx)

    // renderer.init().then(() => {
    //   worker.onmessage = evt => {
    //     if (evt.data.curves) {
    //       offscreenRenderer.render(evt.data.curves)
    //       thisTexture.needsUpdate = true
    //       postProcessing.render()
    //     }
    //   }
    //   // worker.postMessage({
    //   //   source,
    //   //   settings: { w: offscreenCanvas.width }
    //   // })
    //   renderer.setAnimationLoop(() => {
    //     if (!canvas.current) {
    //       console.log('exited')
    //       renderer.dispose()
    //       return
    //     }
    //     worker.postMessage({
    //       source,
    //       settings: { w: 1080 }
    //     })
    //   })
    // })
    const onscreen = canvas.current.getContext('bitmaprenderer')!
    let animationFrame = 0

    worker.onmessage = evt => {
      if (evt.data.settings) {
        Object.assign(settings, evt.data.settings)
        console.log('settings', settings)
      }
      if (evt.data.curves) {
        offscreenRenderer.render(evt.data.curves)
        onscreen.transferFromImageBitmap(
          offscreenCanvas.transferToImageBitmap()
        )

        if (!settings.animating) return
        animationFrame = requestAnimationFrame(() => {
          worker.postMessage({
            source,
            settings: { w: offscreenCanvas.width }
          })
        })
      }
    }
    worker.postMessage({
      source,
      settings: { w: offscreenCanvas.width }
    })
    parent.onunload = () => {
      cancelAnimationFrame(animationFrame)
      settings.animating = false
      // renderer.setAnimationLoop(() => {})
      // renderer.dispose()
      // thisTexture.dispose()
      worker.terminate()
      window.removeEventListener('resize', onResize)
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
