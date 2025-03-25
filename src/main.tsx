import {
  App,
  MarkdownFileInfo,
  MarkdownRenderChild,
  MarkdownView,
  Menu,
  Notice,
  Plugin,
  setIcon
} from 'obsidian'
import SettingsTab from './plugin/SettingsTab'
import { createRoot } from 'react-dom/client'
import AsemicApp from './components/AsemicApp'

export default class AsemicPlugin extends Plugin {
  settings: {} = {}

  constructor(app: App, manifest: any) {
    super(app, manifest)
    this.saveSettings = this.saveSettings.bind(this)
  }

  async onload() {
    await this.loadSettings()
    this.addSettingTab(new SettingsTab(this))

    this.registerMarkdownCodeBlockProcessor('asemic', (source, el, ctx) => {
      ctx.addChild(new AsemicFrame(el, source, this))
    })
  }

  async loadSettings() {
    Object.assign(this.settings, await this.loadData())
  }

  async saveSettings() {
    await this.saveData(this.settings)
  }
}

export class AsemicFrame extends MarkdownRenderChild {
  source: string
  plugin: AsemicPlugin

  onload() {
    const root = createRoot(this.containerEl)
    root.render(
      <AsemicApp source={this.source} plugin={this.plugin} parent={this} />
    )
  }

  constructor(el: HTMLElement, source: string, plugin: AsemicPlugin) {
    super(el)
    this.source = source
    this.plugin = plugin
  }
}
