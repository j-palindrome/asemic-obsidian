import { Pt } from 'pts'
import { useEffect, useMemo, useRef, useState } from 'react'
import invariant from 'tiny-invariant'
import { flatMap, max } from 'lodash'
import { defaultSettings } from 'src/plugin/settings'
// @ts-ignore
import AsemicWorker from './asemic.worker'
import { Parser } from './parse'
import Renderer from './renderer'
import { Client } from 'node-osc'

export default function AsemicApp({ source }: { source: string }) {
  const [settingsSource, ...scenes] = source.split('---').map(x => x.trim())

  const [index, setIndex] = useState(0)
  const [scene, setScene] = useState(scenes[index])
  useEffect(() => {
    setScene(scenes[index])
  }, [index])

  const canvas = useRef<HTMLCanvasElement>(null)
  const frame = useRef<HTMLDivElement>(null)

  const [settings, setSettings] = useState(defaultSettings)
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
        progress: {
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

    const client = new Client('localhost', 7001)
    const parseMessages = (evt: { data: DataBack }) => {
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
              evt.data.curves.length > 0,
            `Failed: ${canvas.current} ${canvas.current?.width} ${evt.data.curves.length}`
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

        if (!settingsRef.current.animating) return
        animationFrame.current = requestAnimationFrame(() => {
          worker.current.postMessage({
            source: scene
          })
        })
      }
      if (evt.data.osc) {
        // client.send(
        //   {
        //     address: evt.data.osc.path,
        //     args: evt.data.osc.args
        //   },
        //   'localhost',
        //   7000
        // )
        console.log('sent', {
          address: evt.data.osc.path,
          args: evt.data.osc.args
        })
        client.send(
          evt.data.osc.path,
          ...evt.data.osc.args.map(x => (x instanceof Pt ? [x.x, x.y] : x))
        )
      }
    }
    worker.current.onmessage = parseMessages
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
      settingsSource,
      source: scene,
      progress: settings
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

  const perform = false
  const editable = useRef<HTMLTextAreaElement>(null!)
  useEffect(() => {
    if (!editable.current) return
    editable.current.value = scene
  }, [scene])

  const parser = useMemo(() => new Parser(), [])

  const useKeys = () => {
    useEffect(() => {
      let keysPressed: Record<string, number> = {}
      let keyString = ''
      const onKeyDown = (ev: KeyboardEvent) => {
        // Check if this is a repeated key event (key held down)
        // Skip adding to keyString if it's a repeated key
        if (ev.repeat) {
          return
        }
        if (ev.key === 'Backspace') {
          if (ev.metaKey) {
            keyString = ''
          } else if (ev.altKey) {
            keyString = keyString.slice(0, keyString.lastIndexOf(' '))
          } else {
            keyString = keyString.slice(0, -1)
          }
        } else if (ev.key.length === 1 && !ev.metaKey && !ev.ctrlKey) {
          keyString += ev.key
          keysPressed[ev.key] = performance.now()
        }

        worker.current.postMessage({
          progress: {
            keys: Object.keys(keysPressed)
              .sort(x => keysPressed[x])
              .join(''),
            text: keyString
          }
        } as Data)
      }
      const onKeyUp = (ev: KeyboardEvent) => {
        delete keysPressed[ev.key]
      }
      window.addEventListener('keydown', onKeyDown)
      window.addEventListener('keyup', onKeyUp)
      return () => {
        window.removeEventListener('keydown', onKeyDown)
        window.removeEventListener('keyup', onKeyUp)
      }
    }, [])
  }
  useKeys()

  return (
    <>
      <div
        className={`relative h-fit w-full bg-black overflow-auto max-h-[calc(100vh-100px)]`}
        ref={frame}
        onClick={ev => {
          if (perform || !editable.current || !ev.altKey) return
          ev.preventDefault()
          ev.stopPropagation()
          parser.reset()
          const rect = ev.currentTarget.getBoundingClientRect()
          parser.progress.height = rect.height
          parser.progress.width = rect.width
          parser.parse(editable.current.value)
          const mouse = new Pt(
            (ev.clientX - rect.left) / rect.width,
            (ev.clientY - rect.top) / rect.width
          )
          mouse.rotate2D(parser.transform.rotation * Math.PI * 2 * -1)
          mouse.divide(parser.transform.scale)
          mouse.subtract(parser.transform.translation)

          const scrollSave = editable.current.scrollTop
          editable.current.value =
            editable.current.value +
            ` ${mouse.x.toFixed(2)},${mouse.y.toFixed(2)}`
          editable.current.scrollTo({ top: scrollSave })
        }}>
        <canvas
          style={{
            width: '100%',
            height: settings.h === 'window' ? '100vh' : undefined,
            aspectRatio:
              settings.h === 'window' ? undefined : `1 / ${settings.h}`
          }}
          ref={canvas}
          height={1080}
          width={1080}></canvas>
        {!perform && (
          <div className='fixed top-0 left-0 h-full w-[calc(100%-50px)]'>
            <div className='w-full h-fit flex justify-end *:!block *:!mr-2 *:!bg-transparent *:!cursor-pointer *:hover:!bg-white/20 bottom-0 left-0 font-mono *:!text-white/50 *:!border-0 *:!text-xs'>
              <button
                onClick={async () => {
                  try {
                    invariant(frame.current)
                    if (!document.fullscreenElement) {
                      frame.current.style.setProperty(
                        'height',
                        '100vh',
                        'important'
                      )
                      await frame.current?.requestFullscreen()
                    } else {
                      frame.current.style.setProperty('height', '')
                      await document.exitFullscreen()
                    }
                  } catch (err) {
                    console.error('Fullscreen error:', err)
                  }
                }}>
                fullscreen
              </button>
              <button
                onClick={() => {
                  setIndex(index - 1 < 0 ? scenes.length - 1 : index - 1)
                }}>
                {'<'}
              </button>
              <button
                onClick={() => {
                  setIndex(index + 1 > scenes.length - 1 ? 0 : index + 1)
                }}>
                {'>'}
              </button>
            </div>
            <textarea
              ref={editable}
              className='overflow-auto text-white p-2 text-sm bg-transparent h-full w-full !resize-none !outline-none !border-none opacity-50 text-right'
              style={{
                fontFamily: 'Fira Code',
                whiteSpace: 'pre-wrap',
                fontWeight: 100,
                boxShadow: 'none !important'
              }}
              onBlur={ev => {
                ev.preventDefault()
                ev.stopPropagation()
              }}
              onKeyDown={ev => {
                // ev.stopPropagation()
                if (ev.key === 'Enter' && ev.metaKey) {
                  setScene(ev.currentTarget.value)
                  window.navigator.clipboard.writeText(ev.currentTarget.value)
                } else if (ev.key === 'f' && ev.metaKey) {
                  editable.current.blur()
                  console.log('exit fullscreen')

                  // ev.preventDefault()
                  // ev.stopPropagation()
                  // frame.current!.focus()
                }
              }}></textarea>
          </div>
        )}
      </div>
    </>
  )
}
