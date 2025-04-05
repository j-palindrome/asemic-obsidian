import { Pt } from 'pts'
import {
  useEffect,
  useRef,
  useState,
  useMemo,
  forwardRef,
  RefObject,
  useImperativeHandle
} from 'react'
import { CanvasTexture, FloatType } from 'three'
import { PostProcessing, WebGPURenderer } from 'three/src/Three.WebGPU.js'
import { texture } from 'three/tsl'
import invariant from 'tiny-invariant'
// @ts-ignore
import AsemicWorker from './asemic.worker'
import { Parser } from './parse'
import Renderer from './renderer'

export default function AsemicApp({ source }: { source: string }) {
  const scenes = source.split('\n\n---\n\n')
  const [index, setIndex] = useState(0)
  const [scene, setScene] = useState(scenes[index])
  useEffect(() => {
    setScene(scenes[index])
  }, [index])
  console.log(scene)

  const canvas = useRef<HTMLCanvasElement>(null)
  const [settings, setSettings] = useState({
    animating: true,
    h: 'window' as number | 'window'
  })

  let animationFrame = useRef(0)
  const worker = useRef<Worker>(null!)

  useEffect(() => {
    invariant(canvas.current)
    const offscreenCanvas = new OffscreenCanvas(1, 1)
    let thisTexture = new CanvasTexture(offscreenCanvas)
    thisTexture.flipY = false
    worker.current = new AsemicWorker() as Worker
    const onResize = () => {
      if (!canvas.current) return
      const boundingRect = canvas.current.getBoundingClientRect()
      if (!boundingRect.width || !boundingRect.height) return
      offscreenCanvas.width = boundingRect.width * devicePixelRatio
      offscreenCanvas.height = boundingRect.height * devicePixelRatio
      // canvas.current.width = boundingRect.width * devicePixelRatio
      // canvas.current.height = boundingRect.height * devicePixelRatio
      // onscreen.setSize(boundingRect.width, boundingRect.height)
      onscreen.setDrawingBufferSize(
        boundingRect.width,
        boundingRect.height,
        devicePixelRatio
      )
      thisTexture.image.width = offscreenCanvas.width
      thisTexture.image.height = offscreenCanvas.height
      thisTexture.needsUpdate = true

      worker.current.postMessage({
        settings: {
          height: offscreenCanvas.height,
          width: offscreenCanvas.width
        }
      })
    }

    const ctx = offscreenCanvas.getContext('2d')!
    const renderer = new Renderer(ctx)

    // const onscreen = canvas.current.getContext('bitmaprenderer')!
    const onscreen = new WebGPURenderer({
      canvas: canvas.current,
      antialias: true,
      depth: false,
      alpha: true,
      powerPreference: 'high-performance',
      colorBufferType: FloatType
    })

    const thisPass = texture(thisTexture)
    // const thisPass = vec4(1, 1, 1, 1)
    const postProcessing = new PostProcessing(onscreen, thisPass)

    worker.current.onmessage = evt => {
      if (evt.data.settings) {
        setSettings(settings => ({
          ...settings,
          ...evt.data.settings
        }))
      }
      if (evt.data.curves) {
        renderer.render(evt.data.curves)
        // onscreen.transferFromImageBitmap(
        //   offscreenCanvas.transferToImageBitmap()
        // )

        thisTexture.needsUpdate = true
        postProcessing.render()

        if (!settings.animating) return
        animationFrame.current = requestAnimationFrame(() => {
          worker.current.postMessage({
            source: scene,
            settings: {
              height: offscreenCanvas.height,
              width: offscreenCanvas.width
            }
          })
        })
      }
    }
    window.addEventListener('resize', onResize)
    onscreen.init().then(() => {
      onResize()

      worker.current.postMessage({
        source: scene,
        settings
      })
    })

    // onResize()

    // worker.current.postMessage({
    //   source,
    //   settings: { height: offscreenCanvas.height, width: offscreenCanvas.width }
    // })

    const dispose = () => {
      cancelAnimationFrame(animationFrame.current)
      window.removeEventListener('resize', onResize)
      if (onscreen._initialized) {
        onscreen.dispose()
      }
      worker.current.terminate()
      thisTexture.dispose()
    }

    return () => {
      dispose()
    }
  }, [scene])

  const [curves, setCurves] = useState<string[][]>([[]])

  useEffect(() => {
    const advance = (direction: 1 | -1) => {
      const newScene =
        direction < 0
          ? Math.max(index - 1, 0)
          : Math.min(index + 1, scenes.length - 1)
      window.location.replace(`http://localhost:5173?scene=${newScene}`)
    }
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'ArrowRight' && ev.altKey) {
        advance(1)
      } else if (ev.key === 'ArrowLeft' && ev.altKey) {
        advance(-1)
      } else if (ev.key === 'Escape') {
        setCurves([[]])
        setScene(scenes[index])
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [curves, scene, index])

  const perform = false
  const editable = useRef<HTMLDivElement>(null!)
  useEffect(() => {
    if (!editable.current) return
    editable.current.innerHTML = scene
  }, [scene])

  const parser = useMemo(() => new Parser(), [])
  return (
    <>
      {!perform && (
        <div
          contentEditable
          ref={editable}
          className='h-[100px] overflow-auto w-full text-white p-2 text-base whitespace-pre'
          style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}
          onKeyDown={ev => {
            console.log('keydown', ev)

            // ev.stopPropagation()
            if (ev.key === 'Enter' && ev.metaKey) {
              setScene(ev.currentTarget.innerHTML)
              window.navigator.clipboard.writeText(ev.currentTarget.innerHTML)
            } else if (ev.key === 'Escape') {
              ev.currentTarget.blur()
            }
          }}></div>
      )}
      <div className='relative h-fit w-full'>
        <canvas
          className=''
          onClick={ev => {
            if (perform || !editable.current) return
            parser.reset()
            const rect = ev.currentTarget.getBoundingClientRect()
            parser.set({ height: rect.height, width: rect.width })
            parser.parse(editable.current.innerHTML)
            const mouse = new Pt(
              (ev.clientX - rect.left) / rect.width,
              (ev.clientY - rect.top) / rect.width
            )
            mouse.rotate2D(parser.transform.rotation * Math.PI * 2 * -1)
            mouse.divide(parser.transform.scale)
            mouse.subtract(parser.transform.translation)

            const scrollSave = editable.current.scrollTop
            editable.current.innerHTML =
              editable.current.innerHTML +
              ` ${mouse.x.toFixed(2)},${mouse.y.toFixed(2)}`
            ev.preventDefault()
            editable.current.scrollTo({ top: scrollSave })
          }}
          ref={canvas}
          style={{
            width: '100%',
            height: settings.h === 'window' ? '100%' : undefined,
            aspectRatio:
              settings.h === 'window' ? undefined : `1 / ${settings.h}`
          }}
          height={1}
          width={1}></canvas>
      </div>
    </>
  )
}
