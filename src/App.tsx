import AsemicApp from './components/AsemicApp'
import AsemicPlugin, { AsemicFrame } from './main'

export default function PluginApp({
  source,
  plugin,
  parent
}: {
  source: string
  plugin: AsemicPlugin
  parent: AsemicFrame
}) {
  return (
    <div className='asemic'>
      <AsemicApp source={source} />
    </div>
  )
}
