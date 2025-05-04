import { Curve, Pt } from 'pts'
import { useEffect, useMemo, useRef, useState } from 'react'
import invariant from 'tiny-invariant'
import { flatMap, isEqual, keysIn, max, set } from 'lodash'
import { defaultSettings } from 'src/plugin/settings'
// @ts-ignore
import AsemicWorker from './asemic.worker'
import { FlatTransform, Parser, Transform } from './parse'
import Renderer from './renderer'
import { ArgumentType, Client } from 'node-osc'
import ObsidianAPI from 'src/plugin/ObsidianApi'
import { defaultPreProcess } from './utils'
// @ts-ignore
import readmeText from '../../README.md'

export default function AsemicApp({
  source,
  obsidian
}: {
  source: string
  obsidian?: ObsidianAPI
}) {
  const [settingsSourceOriginal, ...scenes] = source
    .split('\n---\n')
    .map(x => x.trim())
  const [settingsSource, setSettingsSource] = useState(settingsSourceOriginal)

  const [index, setIndex] = useState(window.lastSource || 0)
  const useScene = () => {
    const [scene, setScene] = useState(scenes[index])

    const sceneRef = useRef(scene)
    useEffect(() => {
      sceneRef.current = scene
    }, [scene])
    return [scene, setScene, sceneRef] as const
  }
  const [scene, setScene, sceneRef] = useScene()
  const [editSettings, setEditSettings] = useState(false)

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

  const useErrors = () => {
    const errorsRef = useRef<string[]>([])
    const selectErrorsRef = useRef<HTMLDivElement>(null)
    const [hasErrors, setHasErrors] = useState(false)
    const setErrors = (newErrors: string[]) => {
      if (isEqual(errorsRef.current, newErrors)) return
      errorsRef.current = newErrors
      if (hasErrors && newErrors.length == 0) setHasErrors(false)
      if (!hasErrors && newErrors.length > 0) setHasErrors(true)
      if (selectErrorsRef.current) {
        selectErrorsRef.current.innerHTML = errorsRef.current.join('\n')
      }
    }
    useEffect(() => {
      if (hasErrors && selectErrorsRef.current) {
        selectErrorsRef.current.innerHTML = errorsRef.current.join('\n')
      }
    }, [hasErrors, editSettings])
    return [setErrors, hasErrors, selectErrorsRef] as const
  }
  const [setErrors, hasErrors, selectErrorsRef] = useErrors()

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
        source: !settingsRef.current.animating ? sceneRef.current : undefined
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
        if (evt.data.errors) {
          setErrors(evt.data.errors)
        }
      }
      worker.onmessage = parseMessages

      return () => {
        resizeObserver.disconnect()
        worker.terminate()
        window.removeEventListener('resize', onResize)
      }
    }, [worker])

    useEffect(() => {
      worker.postMessage({ settingsSource })
    }, [settingsSource])

    useEffect(() => {
      onResize()
      setIsSetup(true)
    }, [])

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
    const [live, setLive] = useState({
      keys: [''],
      text: [''],
      index: { type: 'text', value: 0 }
    })
    const [isLive, setIsLive] = useState(false)

    useEffect(() => {
      worker.postMessage({
        live
      })
    }, [live])

    let keysPressed = useRef<Record<string, number>>({})
    useEffect(() => {
      const onKeyDown = (ev: KeyboardEvent) => {
        // Check if this is a repeated key event (key held down)
        // Skip adding to keyString if it's a repeated key

        if (ev.repeat) {
          return
        }
        if (ev.ctrlKey) {
          const keyMatch = ev.code.match(/\d/)
          if (keyMatch) {
            if (ev.altKey) {
              const key = parseInt(keyMatch[0])
              const newKeys = [...live.keys]
              if (live.keys.length < key) {
                for (let i = 0; i <= key - live.keys.length; i++) {
                  newKeys.push('')
                }
              }
              setLive({
                ...live,
                keys: newKeys,
                index: { type: 'keys', value: key }
              })
            } else {
              const key = parseInt(keyMatch[0])
              const newTexts = [...live.text]
              if (live.text.length < key) {
                for (let i = 0; i <= key - live.text.length; i++) {
                  newTexts.push('')
                }
              }
              setLive({
                ...live,
                text: newTexts,
                index: { type: 'text', value: key }
              })
            }
          }
        } else {
          switch (live.index.type) {
            case 'keys':
              if (ev.key.length === 1 && !ev.metaKey && !ev.ctrlKey) {
                keysPressed.current[ev.key] = performance.now()
              }
              const newKeys = [...live.keys]
              newKeys[live.index.value] = Object.keys(keysPressed.current)
                .sort(x => keysPressed.current[x])
                .join('')

              setLive({ ...live, keys: newKeys })

              break
            case 'text':
              let newText = live.text[live.index.value]
              if (ev.key === 'Backspace') {
                if (ev.metaKey) {
                  newText = ''
                } else if (ev.altKey) {
                  newText = newText.slice(
                    0,
                    newText.includes(' ') ? newText.lastIndexOf(' ') : 0
                  )
                } else {
                  newText = newText.slice(0, -1)
                }
              } else if (ev.key.length === 1 && !ev.metaKey && !ev.ctrlKey) {
                newText += ev.key
              }
              const newTexts = [...live.text]
              newTexts[live.index.value] = newText

              setLive({ ...live, text: newTexts })
              break
          }
        }
      }
      const onKeyUp = (ev: KeyboardEvent) => {
        delete keysPressed.current[ev.key]
        const newKeys = [...live.keys]
        newKeys[live.index.value] = Object.keys(keysPressed.current)
          .sort(x => keysPressed.current[x])
          .join('')
        setLive({ ...live, keys: newKeys })
      }

      if (!isLive) return
      window.addEventListener('keydown', onKeyDown)
      window.addEventListener('keyup', onKeyUp)
      return () => {
        window.removeEventListener('keydown', onKeyDown)
        window.removeEventListener('keyup', onKeyUp)
      }
    }, [live, isLive])
    return [live, isLive, setIsLive] as const
  }
  const [live, isLive, setIsLive] = useKeys()

  const [perform, setPerform] = useState(settings.perform)
  useEffect(() => {
    setPerform(settings.perform)
  }, [settings.perform])
  const [help, setHelp] = useState(false)

  const requestFullscreen = async () => {
    frame.current.style.setProperty('height', '100vh', 'important')
    await frame.current?.requestFullscreen()
  }
  useEffect(() => {
    if (settings.fullscreen) {
      requestFullscreen()
    }
  }, [settings.fullscreen])

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
          <div className='fixed top-1 left-1 h-full w-[calc(100%-50px)] flex flex-col'>
            <div className='w-full h-fit flex'>
              <div className='text-sm font-mono opacity-50 truncate max-w-[33%] flex-none whitespace-nowrap'>
                {live.index.type} {live.index.value}:{' '}
                {live[live.index.type][live.index.value]?.replace('\n', '/ ')}
              </div>
              <div className='grow' />
              <button
                onClick={() => {
                  const currentScene = editable.current.value
                  setScene(editable.current.value)
                  const newSource = source.split('\n---\n')
                  newSource[index + 1] = currentScene
                  newSource[0] = settingsSource
                  window.lastSource = index

                  if (obsidian) {
                    obsidian.overwriteCurrentFile(
                      source,
                      newSource.join('\n---\n')
                    )
                  }
                }}>
                save
              </button>
              <button onClick={requestFullscreen}>fullscreen</button>
              <button
                onClick={() => {
                  setEditSettings(!editSettings)
                }}>
                settings
              </button>
              <button
                className={`${isLive ? '!bg-blue-200/40' : ''}`}
                onClick={ev => {
                  ev.preventDefault()
                  ev.stopPropagation()
                  // Blur the editable textarea if it's focused
                  // if (document.activeElement === editable.current) {
                  //   editable.current.blur()
                  // }
                  // Also blur any other active text inputs/editors
                  const activeElement = document.activeElement as HTMLElement
                  // if (activeElement && (
                  // activeElement.tagName === 'INPUT' ||

                  // activeElement.tagName === 'TEXTAREA' ||
                  // activeElement.isContentEditable
                  // )) {
                  activeElement.blur()
                  setIsLive(!isLive)
                  // }
                }}>
                live
              </button>
              <button onClick={() => setPerform(true)}>perform</button>
              <button onClick={() => setHelp(!help)}>help</button>
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
              <button
                onClick={() => {
                  const newSource = source.split('\n---\n')
                  newSource.splice(index + 1 + 1, 0, '')
                  window.lastSource = index + 1

                  if (obsidian) {
                    obsidian.overwriteCurrentFile(
                      source,
                      newSource.join('\n---\n')
                    )
                  }
                }}>
                {'+'}
              </button>
            </div>

            <div className='flex h-full w-full *:flex-none relative opacity-70'>
              <textarea
                ref={editable}
                defaultValue={scene}
                className={`relative !font-mono overflow-auto !text-blue-400 p-2 !py-4 !pr-8 text-sm bg-transparent !resize-none !outline-none !border-none text-left !shadow-none text-light !mix-blend-difference !drop-shadow-xl ${
                  editSettings ? 'w-1/2' : 'w-full'
                }`}
                onBlur={ev => {
                  ev.preventDefault()
                  ev.stopPropagation()
                }}
                onFocus={ev => {
                  if (isLive) setIsLive(false)
                }}
                onKeyDown={ev => {
                  // ev.stopPropagation()
                  if (ev.key === 'Enter' && ev.metaKey) {
                    setScene(ev.currentTarget.value)
                    window.navigator.clipboard.writeText(ev.currentTarget.value)
                  } else if (ev.key === 'f' && ev.metaKey) {
                    ev.currentTarget.blur()
                    // ev.preventDefault()
                    // ev.stopPropagation()
                    // frame.current!.focus()
                  }
                }}></textarea>
              {editSettings && (
                <div className={`h-full w-1/2 flex flex-col`}>
                  <textarea
                    defaultValue={settingsSource}
                    onBlur={ev => {
                      ev.preventDefault()
                      ev.stopPropagation()
                    }}
                    onFocus={ev => {
                      if (isLive) setIsLive(false)
                    }}
                    onKeyDown={ev => {
                      // ev.stopPropagation()
                      if (ev.key === 'Enter' && ev.metaKey) {
                        setSettingsSource(ev.currentTarget.value)
                        window.navigator.clipboard.writeText(
                          ev.currentTarget.value
                        )
                      } else if (ev.key === 'f' && ev.metaKey) {
                        ev.currentTarget.blur()
                        // ev.preventDefault()
                        // ev.stopPropagation()
                        // frame.current!.focus()
                      }
                    }}
                    className={`relative !font-mono overflow-auto !text-blue-400 p-2 text-sm bg-transparent !resize-none !outline-none !border-none text-right !shadow-none w-full text-light !mix-blend-difference !drop-shadow-xl ${
                      hasErrors ? 'h-1/2' : 'h-full'
                    }`}></textarea>
                  {hasErrors && (
                    <div
                      ref={selectErrorsRef}
                      className='relative !font-mono !overflow-auto !text-red-400 p-2 !py-4 !pr-8 text-sm bg-transparent h-1/2 text-right !shadow-none w-full !mix-blend-difference !drop-shadow-xl whitespace-pre-wrap break-words'></div>
                  )}
                </div>
              )}

              {help && (
                <div className='absolute top-0 left-0 h-full w-full overflow-auto !p-8 bg-black/50 backdrop-blur font-mono whitespace-pre-wrap'>
                  <div>{readmeText}</div>
                </div>
              )}
            </div>
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
