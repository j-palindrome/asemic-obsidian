import { App, Plugin } from 'obsidian'
import SettingsTab from './plugin/SettingsTab'
import { AsemicFrame } from 'src/plugin/AsemicFrame'

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
