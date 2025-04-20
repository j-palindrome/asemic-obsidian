import { App, Component } from 'obsidian'

import AsemicPlugin from '../main'

export default class ObsidianAPI extends Component {
  app: App
  plugin: AsemicPlugin
  constructor(plugin: AsemicPlugin) {
    super()
    this.plugin = plugin
    this.app = this.plugin.app
  }
}
