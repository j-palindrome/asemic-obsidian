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
import _, { flatMap, max, set } from 'lodash'

export default function AsemicApp({ source }: { source: string }) {
  const scenes = source.split('\n\n---\n\n')
  const [index, setIndex] = useState(0)
  const [scene, setScene] = useState(scenes[index])
  useEffect(() => {
    setScene(scenes[index])
  }, [index])

  const canvas = useRef<HTMLCanvasElement>(null)
  const [settings, setSettings] = useState({
    animating: true,
    h: 'auto' as number | 'window' | 'auto'
  })
  const settingsRef = useRef(settings)
  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

  let animationFrame = useRef(0)
  const worker = useRef<Worker>(null!)

  useEffect(() => {
    invariant(canvas.current)
    const offscreenCanvas = new OffscreenCanvas(1080, 1080)
    // let thisTexture = new CanvasTexture(offscreenCanvas)
    // thisTexture.flipY = false
    worker.current = new AsemicWorker() as Worker
    const onResize = () => {
      if (!canvas.current) return
      const boundingRect = canvas.current.getBoundingClientRect()
      if (!boundingRect.width || !boundingRect.height) return
      devicePixelRatio = 2

      offscreenCanvas.width = boundingRect.width * devicePixelRatio
      offscreenCanvas.height = boundingRect.height * devicePixelRatio
      canvas.current.width = boundingRect.width * devicePixelRatio
      canvas.current.height = boundingRect.height * devicePixelRatio

      // onscreen.setDrawingBufferSize(
      //   boundingRect.width,
      //   boundingRect.height,
      //   devicePixelRatio
      // )

      // thisTexture.needsUpdate = true
      worker.current.postMessage({
        settings: {
          height: offscreenCanvas.height,
          width: offscreenCanvas.width
        }
      })
    }
    const resizeObserver = new ResizeObserver(onResize)

    if (canvas.current) {
      resizeObserver.observe(canvas.current)
    }

    const ctx = offscreenCanvas.getContext('2d')!
    const renderer = new Renderer(ctx)

    const onscreen = canvas.current.getContext('bitmaprenderer')!
    // const onscreen = new WebGPURenderer({
    //   canvas: canvas.current,
    //   antialias: true,
    //   depth: false,
    //   alpha: true,
    //   powerPreference: 'high-performance',
    //   colorBufferType: FloatType
    // })

    // const thisPass = texture(thisTexture)
    // const postProcessing = new PostProcessing(onscreen, thisPass)

    worker.current.onmessage = evt => {
      if (evt.data.settings) {
        setSettings(settings => ({
          ...settings,
          ...evt.data.settings
        }))
      }
      if (evt.data.curves) {
        if (settingsRef.current.h === 'auto') {
          invariant(
            canvas.current &&
              canvas.current.width !== 0 &&
              evt.data.curves.length > 0
          )

          const maxY = max(flatMap(evt.data.curves, '1'))! + 0.1

          if (
            canvas.current.height !== Math.floor(maxY * canvas.current.width)
          ) {
            canvas.current.height = canvas.current.width * maxY

            onResize()

            animationFrame.current = requestAnimationFrame(() => {
              worker.current.postMessage({
                source: scene
              })
            })
            return
          }
        }
        renderer.render(evt.data.curves)
        onscreen.transferFromImageBitmap(
          offscreenCanvas.transferToImageBitmap()
        )

        // thisTexture.needsUpdate = true
        // postProcessing.render()

        if (!settings.animating) return
        animationFrame.current = requestAnimationFrame(() => {
          worker.current.postMessage({
            source: scene
          })
        })
      }
    }
    window.addEventListener('resize', onResize)
    // onscreen.init().then(() => {
    //   onResize()

    //   worker.current.postMessage({
    //     source: scene,
    //     settings
    //   })
    // })

    onResize()

    worker.current.postMessage({
      source: scene,
      settings
    })

    const dispose = () => {
      resizeObserver.disconnect()
      cancelAnimationFrame(animationFrame.current)
      window.removeEventListener('resize', onResize)
      // if (onscreen._initialized) {
      //   onscreen.dispose()
      // }
      worker.current.terminate()
      // thisTexture.dispose()
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
            parser.progress.height = rect.height
            parser.progress.width = rect.width
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
          height={1080}
          width={1080}></canvas>
      </div>
    </>
  )
}
