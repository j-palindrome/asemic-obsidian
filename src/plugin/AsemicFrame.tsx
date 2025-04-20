import { MarkdownRenderChild } from 'obsidian'
import { createRoot, Root } from 'react-dom/client'
import AsemicPlugin from '../main'
import AsemicApp from 'src/components/AsemicApp'
import ObsidianAPI from './ObsidianApi'

export class AsemicFrame extends MarkdownRenderChild {
  source: string
  plugin: AsemicPlugin
  root: Root

  onload() {
    this.root = createRoot(this.containerEl)
    this.root.render(
      <div className='asemic'>
        <AsemicApp
          source={this.source}
          obsidian={new ObsidianAPI(this.plugin)}
        />
      </div>
    )
  }

  onunload(): void {
    this.root.unmount()
  }

  constructor(el: HTMLElement, source: string, plugin: AsemicPlugin) {
    super(el)
    this.source = source
    this.plugin = plugin
  }
}
