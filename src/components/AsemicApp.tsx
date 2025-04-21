import { Pt } from 'pts'
import { useEffect, useMemo, useRef, useState } from 'react'
import invariant from 'tiny-invariant'
import { flatMap, max } from 'lodash'
import { defaultSettings } from 'src/plugin/settings'
// @ts-ignore
import AsemicWorker from './asemic.worker'
import { FlatTransform, Parser, Transform } from './parse'
import Renderer from './renderer'
import { ArgumentType, Client } from 'node-osc'
import ObsidianAPI from 'src/plugin/ObsidianApi'
import { defaultPreProcess } from './utils'

export default function AsemicApp({
  source,
  obsidian
}: {
  source: string
  obsidian?: ObsidianAPI
}) {
  const [settingsSource, ...scenes] = source.split('---').map(x => x.trim())

  const [index, setIndex] = useState(0)
  const useScene = () => {
    const [scene, setScene] = useState(scenes[index])
    return [scene, setScene] as const
  }
  const [scene, setScene] = useScene()

  useEffect(() => {
    setScene(scenes[index])
  }, [index])

  const canvas = useRef<HTMLCanvasElement>(null!)
  const frame = useRef<HTMLDivElement>(null!)

  const [settings, setSettings] = useState(defaultSettings)
  const settingsRef = useRef(settings)
  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

  const worker = useMemo(() => new AsemicWorker() as Worker, [])
  const lastTransform = useRef<FlatTransform>(null!)
  const setup = () => {
    const animationFrame = useRef(0)
    const offscreenCanvas = useMemo(() => new OffscreenCanvas(1080, 1080), [])
    const renderer = useMemo(() => {
      const ctx = offscreenCanvas.getContext('2d')!
      return new Renderer(ctx)
    }, [])
    const onscreen = useRef<ImageBitmapRenderingContext>(null!)
    const client = useMemo(() => new Client('localhost', 7001), [])
    const [isSetup, setIsSetup] = useState(false)
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
      worker.postMessage({
        progress: {
          height: offscreenCanvas.height,
          width: offscreenCanvas.width
        }
      })
    }

    useEffect(() => {
      invariant(canvas.current)
      // let thisTexture = new CanvasTexture(offscreenCanvas)
      // thisTexture.flipY = false

      const resizeObserver = new ResizeObserver(onResize)

      resizeObserver.observe(canvas.current)

      onscreen.current = canvas.current.getContext('bitmaprenderer')!

      window.addEventListener('resize', onResize)
      // onscreen.init().then(() => {
      //   onResize()

      //   worker.postMessage({
      //     source: scene,
      //     settings
      //   })
      // })

      worker.postMessage({ settingsSource })
      return () => {
        resizeObserver.disconnect()
        worker.terminate()
        window.removeEventListener('resize', onResize)
        cancelAnimationFrame(animationFrame.current)
      }
    }, [])

    useEffect(() => {
      onResize()
      setIsSetup(true)
    }, [settings])

    useEffect(() => {
      if (!isSetup) return
      const parseMessages = (evt: { data: DataBack }) => {
        if (evt.data.settings) {
          setSettings(settings => ({
            ...settingsRef.current,
            ...evt.data.settings
          }))
        }
        if (evt.data.lastTransform) {
          lastTransform.current = evt.data.lastTransform
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
                worker.postMessage({
                  source: scene
                })
              })
              return
            }
          }
          renderer.render(evt.data.curves)
          const bitmap = offscreenCanvas.transferToImageBitmap()
          onscreen.current.transferFromImageBitmap(bitmap)
          bitmap.close()

          // thisTexture.needsUpdate = true
          // postProcessing.render()

          if (!settingsRef.current.animating) return
          animationFrame.current = requestAnimationFrame(() => {
            worker.postMessage({
              source: scene
            })
          })
        }
        if (evt.data.osc) {
          evt.data.osc.forEach(({ path, args }) => {
            client.send({ address: path, args: args as ArgumentType[] })
          })
        }
      }
      worker.onmessage = parseMessages

      const restart = async () => {
        const preProcess = defaultPreProcess()
        const links = source.match(/\[\[.*?\]\]/)
        if (links) {
          for (let link of links) {
            const text = link.substring(2, link.length - 2)
            if (obsidian) {
              preProcess.replacements[link] = (
                await obsidian.getFileText(text)
              ).trim()
            } else {
              // TODO: require the text somehow
            }
          }
        }
        worker.postMessage({
          source: scene,
          preProcess
        })
      }
      restart()
    }, [scene, isSetup])
  }
  setup()

  const editable = useRef<HTMLTextAreaElement>(null!)

  useEffect(() => {
    if (!editable.current) return
    editable.current.value = scene
  }, [scene])

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

        worker.postMessage({
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

  const [perform, setPerform] = useState(settings.perform)
  useEffect(() => {
    setPerform(settings.perform)
  }, [settings.perform])

  return (
    <>
      <div
        className={`relative h-fit w-full bg-black overflow-auto max-h-[calc(100vh-100px)]`}
        ref={frame}
        onClick={ev => {
          if (perform || !editable.current || !ev.altKey) return
          ev.preventDefault()
          ev.stopPropagation()

          const rect = editable.current.getBoundingClientRect()
          const mouse = new Pt(
            (ev.clientX - rect.left) / rect.width,
            (ev.clientY - rect.top) / rect.width
          )
          const listenForResponse = (ev: { data: DataBack }) => {
            console.log('got response')

            mouse.rotate2D(lastTransform.current.rotation * Math.PI * 2 * -1)
            mouse.divide(lastTransform.current.scale)
            mouse.subtract(lastTransform.current.translation)

            const scrollSave = editable.current.scrollTop
            editable.current.value =
              editable.current.value +
              ` ${mouse.x.toFixed(2)},${mouse.y.toFixed(2)}`
            editable.current.scrollTo({ top: scrollSave })
          }
          worker.addEventListener('message', listenForResponse, {
            once: true
          })
          worker.postMessage({
            source: editable.current.value
          })
          console.log('bound')
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
        {!perform ? (
          <div className='fixed top-0 left-0 h-full w-[calc(100%-50px)]'>
            <div className='w-full h-fit flex justify-end'>
              <button
                onClick={() => {
                  const currentScene = editable.current.value
                  setScene(editable.current.value)
                  const newSource = source.replace(scenes[index], currentScene)

                  if (obsidian) {
                    obsidian.overwriteCurrentFile(source, newSource)
                  }
                }}>
                save
              </button>
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
              <button onClick={() => setPerform(true)}>perform</button>
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
              defaultValue={scene}
              className='overflow-auto text-white p-2 text-sm bg-transparent h-full w-full !resize-none !outline-none !border-none opacity-50 text-right !shadow-none'
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
                  // ev.preventDefault()
                  // ev.stopPropagation()
                  // frame.current!.focus()
                }
              }}></textarea>
          </div>
        ) : (
          <div className='fixed top-0 right-10'>
            <button onClick={() => setPerform(false)}>...</button>
          </div>
        )}
      </div>
    </>
  )
}
