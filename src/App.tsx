import { useRef } from 'react'
import AsemicApp from './components/AsemicApp'
import AsemicPlugin, { AsemicFrame } from './main'

export default function App({
  source,
  plugin,
  parent
}: {
  source: string
  plugin: AsemicPlugin
  parent: AsemicFrame
}) {
  parent.onunload = () => {
    cancelAnimationFrame(animationFrame.current)
    setSettings(settings => ({ ...settings, animating: false }))
    // renderer.setAnimationLoop(() => {})
    // renderer.dispose()
    // thisTexture.dispose()
    worker.terminate()
    window.removeEventListener('resize', onResize)
  }
  const asemicRef = useRef<any>()
  return <AsemicApp source={source} ref={asemicRef}></AsemicApp>
}
