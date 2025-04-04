import { useEffect, useMemo, useRef, useState } from 'react'
// @ts-ignore
import AsemicWorker from './asemic.worker'
import Renderer from './renderer'
import AsemicPlugin, { AsemicFrame } from 'src/main'
import invariant from 'tiny-invariant'

export default function AsemicApp_Obsidian({
  source,
  plugin,
  parent
}: {
  source: string
  plugin: AsemicPlugin
  parent: AsemicFrame
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [settings, setSettings] = useState({
    animating: true,
    h: 1
  })

  const { offscreenCanvas, onResize } = useMemo(() => {
    const offscreenCanvas = new OffscreenCanvas(0, 0)
    const onResize = () => {
      invariant(canvas.current)
      const boundingRect = canvas.current.getBoundingClientRect()
      offscreenCanvas.width = boundingRect.width * devicePixelRatio
      offscreenCanvas.height = boundingRect.height * devicePixelRatio
      canvas.current.width = boundingRect.width * devicePixelRatio
      canvas.current.height = boundingRect.height * devicePixelRatio
    }
    return { offscreenCanvas, onResize }
  }, [])
  useEffect(() => {
    onResize()
  }, [settings.h])

  const worker = useMemo(() => new AsemicWorker() as Worker, [])

  let animationFrame = useRef(0)

  useEffect(() => {
    invariant(canvas.current)
    const onscreen = canvas.current.getContext('bitmaprenderer')!

    if (!canvas.current) return
    const ctx = offscreenCanvas.getContext('2d')!
    const renderer = new Renderer(ctx)

    worker.onmessage = evt => {
      if (evt.data.settings) {
        setSettings(settings => ({ ...settings, ...evt.data.settings }))
      }
      if (evt.data.curves) {
        renderer.render(evt.data.curves)
        onscreen.transferFromImageBitmap(
          offscreenCanvas.transferToImageBitmap()
        )

        if (!settings.animating) return
        animationFrame.current = requestAnimationFrame(() => {
          worker.postMessage({
            source,
            settings: {
              height: offscreenCanvas.height,
              width: offscreenCanvas.width
            }
          })
        })
      }
    }
  }, [settings])

  useEffect(() => {
    invariant(canvas.current)
    onResize()

    // const thisTexture = new CanvasTexture(offscreenCanvas)
    // thisTexture.flipY = false

    window.addEventListener('resize', onResize)

    // const renderer = new WebGPURenderer({
    //   canvas: canvas.current
    // })
    // const thisPass = texture(thisTexture)
    // const postProcessing = new PostProcessing(renderer, thisPass)

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
    //       renderer.dispose()
    //       return
    //     }
    //     worker.postMessage({
    //       source,
    //       settings: { w: 1080 }
    //     })
    //   })
    // })

    worker.postMessage({
      source,
      settings: { height: offscreenCanvas.height, width: offscreenCanvas.width }
    })
    parent.onunload = () => {
      cancelAnimationFrame(animationFrame.current)
      setSettings(settings => ({ ...settings, animating: false }))
      // renderer.setAnimationLoop(() => {})
      // renderer.dispose()
      // thisTexture.dispose()
      worker.terminate()
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return (
    <div className='asemic'>
      <canvas
        ref={canvas}
        style={{ width: '100%', aspectRatio: `1 / ${settings.h}` }}
        height={0}
        width={0}></canvas>
    </div>
  )
}
