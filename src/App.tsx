import { useEffect, useRef } from 'react'
import AsemicApp from './components/AsemicApp'
import AsemicPlugin, { AsemicFrame } from './main'
import AsemicApp_Obsidian from './components/AsemicApp_Obsidian'

export default function PluginApp({
  source,
  plugin,
  parent
}: {
  source: string
  plugin: AsemicPlugin
  parent: AsemicFrame
}) {
  return <AsemicApp plugin={plugin} parent={parent} source={source} />
}
