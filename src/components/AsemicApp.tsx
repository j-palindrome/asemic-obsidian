import { Curve, Pt } from 'pts'
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
  const [settingsSource, ...scenes] = source.split('\n---\n').map(x => x.trim())

  const [index, setIndex] = useState(0)
  const useScene = () => {
    const [scene, setScene] = useState(scenes[index])

    const sceneRef = useRef(scene)
    useEffect(() => {
      sceneRef.current = scene
    }, [scene])
    return [scene, setScene, sceneRef] as const
  }
  const [scene, setScene, sceneRef] = useScene()

  useEffect(() => {
    setScene(scenes[index])
  }, [index])

  const canvas = useRef<HTMLCanvasElement>(null!)
  const frame = useRef<HTMLDivElement>(null!)

  const [settings, setSettings] = useState(defaultSettings)
  const settingsRef = useRef(settings)
  useEffect(() => {
    settingsRef.current = settings

    if (settings.scene) {
      setIndex(settings.scene)
    }
  }, [settings])

  const worker = useMemo(() => new AsemicWorker() as Worker, [])
  const lastTransform = useRef<FlatTransform>(null!)
  const setup = () => {
    const animationFrame = useRef(0)
    const onscreen = useRef<ImageBitmapRenderingContext>(null!)
    const client = useMemo(() => new Client('localhost', 7001), [])
    const [isSetup, setIsSetup] = useState(false)
    const onResize = () => {
      if (!canvas.current) return
      const boundingRect = canvas.current.getBoundingClientRect()
      if (!boundingRect.width || !boundingRect.height) return
      devicePixelRatio = 2

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
          height: canvas.current.height,
          width: canvas.current.width
        },
        source: !settings.animating ? scene : undefined
      })
    }

    useEffect(() => {
      invariant(canvas.current)
      // let thisTexture = new CanvasTexture(offscreenCanvas)
      // thisTexture.flipY = false

      // const offscreenCanvas = new OffscreenCanvas(1080, 1080)
      const ctx = canvas.current.getContext('2d')!
      const renderer = new Renderer(ctx)

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
            if (evt.data.curves.length === 0) return

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
        }
        if (evt.data.curves) {
          renderer.render(evt.data.curves)
          // this is crazy

          // thisTexture.needsUpdate = true
          // postProcessing.render()

          if (!settingsRef.current.animating) return
          animationFrame.current = requestAnimationFrame(() => {
            worker.postMessage({
              source: sceneRef.current
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

      worker.postMessage({ settingsSource })
      return () => {
        resizeObserver.disconnect()
        worker.terminate()
        window.removeEventListener('resize', onResize)
      }
    }, [worker])

    useEffect(() => {
      onResize()
      setIsSetup(true)
    }, [settings])

    useEffect(() => {
      if (!isSetup) return
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
      return () => {
        cancelAnimationFrame(animationFrame.current)
      }
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
        worker.postMessage({
          progress: {
            keys: Object.keys(keysPressed)
              .sort(x => keysPressed[x])
              .join('')
          }
        } as Data)
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
        className={`relative w-full bg-black overflow-auto ${
          settings.h === 'window'
            ? 'h-[calc(100vh-100px)]'
            : 'h-fit max-h-[calc(100vh-100px)]'
        } fullscreen:max-h-screen`}
        ref={frame}
        onClick={ev => {
          if (perform || !editable.current || !ev.altKey) return
          ev.preventDefault()
          ev.stopPropagation()

          const rect = editable.current.getBoundingClientRect()
          const mouse = new Pt([
            (ev.clientX - rect.left) / rect.width,
            (ev.clientY - rect.top) / rect.width
          ])
          const listenForResponse = (ev: { data: DataBack }) => {
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
        }}>
        <canvas
          style={{
            width: '100%',
            height: settings.h === 'window' ? '100%' : undefined,
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
                  const newSource = source.split('\n---\n')
                  newSource[index + 1] = currentScene

                  if (obsidian) {
                    obsidian.overwriteCurrentFile(
                      source,
                      newSource.join('\n---\n')
                    )
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
