import { App, Component, parseLinktext } from 'obsidian'

import AsemicPlugin from '../main'

export default class ObsidianAPI extends Component {
  app: App
  plugin: AsemicPlugin

  async getFileText(path: string) {
    const filePath = this.app.metadataCache.getFirstLinkpathDest(
      path,
      this.app.workspace.getActiveFile()!.path
    )?.path!

    const text = await this.app.vault.adapter.read(filePath)
    const asemicMatch = text.match(/```asemic((.|\n)+?)```/)
    if (!asemicMatch) {
      console.error(`Asemic: no asemic codeblock found in file [[${path}]]`)
      return ''
    } else {
      return asemicMatch[1]
    }
  }

  async overwriteCurrentFile(find: string, replace: string) {
    this.app.vault.process(this.app.workspace.getActiveFile()!, text => {
      return text.replace(find, replace)
    })
  }

  constructor(plugin: AsemicPlugin) {
    super()
    this.plugin = plugin
    this.app = this.plugin.app
  }
}
