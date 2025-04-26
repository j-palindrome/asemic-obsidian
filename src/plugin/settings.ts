import { Parser } from 'src/components/parse'

export const defaultSettings = {
  animating: true as boolean,
  debug: true as boolean,
  h: 'auto' as number | 'window' | 'auto',
  perform: false as boolean,
  scene: 0 as number
}

export const splitString = (string: string, at: string) => {
  let index = string.indexOf(at)
  return [string.slice(0, index), string.slice(index + at.length)] as [
    string,
    string
  ]
}
