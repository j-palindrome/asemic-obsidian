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
import { CanvasTexture } from 'three'
import { PostProcessing, WebGPURenderer } from 'three/src/Three.WebGPU.js'
import { texture } from 'three/tsl'
import invariant from 'tiny-invariant'
// @ts-ignore
import AsemicWorker from './asemic.worker'
import { Parser } from './parse'
import Renderer from './renderer'

export default function AsemicApp({
  source,
  ref
}: {
  source: string
  ref: RefObject<any>
}) {
  const scenes = source.split('\n---\n')
  const [index, setIndex] = useState(0)
  const [scene, setScene] = useState(scenes[index])

  const canvas = useRef<HTMLCanvasElement>(null)
  const [settings, setSettings] = useState({
    animating: true,
    h: 'window' as number | 'window'
  })

  // useEffect(() => {
  //   return () => {
  //     worker.terminate()
  //   }
  // }, [])

  let animationFrame = useRef(0)
  const worker = useRef<Worker>(null!)
  useEffect(() => {
    worker.current = new AsemicWorker() as Worker
    return () => {
      worker.current.terminate()
    }
  }, [])

  const dispose = useRef<() => void>(null)

  useEffect(() => {
    invariant(canvas.current)
    const offscreenCanvas = new OffscreenCanvas(1, 1)
    let thisTexture = new CanvasTexture(offscreenCanvas)
    thisTexture.flipY = false
    const onResize = () => {
      if (!canvas.current) return
      const boundingRect = canvas.current.getBoundingClientRect()
      if (!boundingRect.width || !boundingRect.height) return
      offscreenCanvas.width = boundingRect.width * devicePixelRatio
      offscreenCanvas.height = boundingRect.height * devicePixelRatio
      // canvas.current.width = boundingRect.width * devicePixelRatio
      // canvas.current.height = boundingRect.height * devicePixelRatio
      onscreen.setSize(boundingRect.width, boundingRect.height)
      thisTexture.needsUpdate = true
      // TODO: resize thisTexture to fit the size of the canvas

      window.postMessage({
        settings: {
          height: offscreenCanvas.height,
          width: offscreenCanvas.width
        }
      })
    }

    const ctx = offscreenCanvas.getContext('2d')!
    const renderer = new Renderer(ctx)

    const onscreen = new WebGPURenderer({
      canvas: canvas.current
    })

    const thisPass = texture(thisTexture)
    // const thisPass = vec4(1, 1, 1, 1)
    const postProcessing = new PostProcessing(onscreen, thisPass)

    onscreen.init().then(() => {
      onResize()
      worker.current.postMessage({
        source
      })
    })

    worker.current.onmessage = evt => {
      if (evt.data.settings) {
        setSettings(settings => ({
          ...settings,
          ...evt.data.settings
        }))
      }
      if (evt.data.curves) {
        renderer.render(evt.data.curves)
        thisTexture.needsUpdate = true
        postProcessing.render()

        if (!settings.animating) return
        animationFrame.current = requestAnimationFrame(() => {
          worker.current.postMessage({
            source,
            settings: {
              height: offscreenCanvas.height,
              width: offscreenCanvas.width
            }
          })
        })
      }
    }

    window.addEventListener('resize', onResize)

    dispose.current = () => {
      cancelAnimationFrame(animationFrame.current)
      window.removeEventListener('resize', onResize)
      if (onscreen._initialized) {
        onscreen.dispose()
      }
      worker.current.terminate()
      thisTexture.dispose()
    }
    return () => {
      dispose.current()
    }
  }, [settings, source])

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
  }, [curves, source, index])

  const perform = true
  const editable = useRef<HTMLTextAreaElement>(null!)
  useEffect(() => {
    if (!editable.current) return
    editable.current.value! = source
  }, [source])

  useImperativeHandle(
    ref,
    () => ({
      animationFrame,
      settings,
      setSettings,
      worker
    }),
    [settings, animationFrame, worker]
  )

  const parser = useMemo(() => new Parser(), [])
  return (
    <>
      <div className='asemic relative h-fit w-full'>
        <canvas
          className=''
          onClick={ev => {
            if (perform || !editable.current) return
            parser.reset()
            const rect = ev.currentTarget.getBoundingClientRect()
            parser.set({ height: rect.height, width: rect.width })
            parser.parse(editable.current.value)
            const mouse = new Pt(
              (ev.clientX - rect.left) / rect.width,
              (ev.clientY - rect.top) / rect.width
            )
            mouse.rotate2D(parser.transform.rotation * Math.PI * 2 * -1)
            mouse.divide(parser.transform.scale)
            mouse.subtract(parser.transform.translation)

            editable.current.value =
              editable.current.value +
              ` ${mouse.x.toFixed(2)},${mouse.y.toFixed(2)}`
            ev.preventDefault()
            editable.current.focus()
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
      {!perform && (
        <textarea
          ref={editable}
          className='h-[100px] w-full text-white font-mono p-2'
          onKeyDown={ev => {
            // ev.stopPropagation()
            if (ev.key === 'Enter' && ev.metaKey) {
              setScene(ev.currentTarget.value)
              window.navigator.clipboard.writeText(ev.currentTarget.value)
            } else if (ev.key === 'Escape') {
              ev.currentTarget.blur()
            }
          }}></textarea>
      )}
    </>
  )
}
