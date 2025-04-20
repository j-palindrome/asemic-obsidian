import { Parser } from 'src/components/parse'

export const defaultSettings: Parser['settings'] = {
  animating: true,
  debug: true,
  h: 'auto'
}

export const splitString = (string: string, at: string) => {
  let index = string.indexOf(at)
  return [string.slice(0, index), string.slice(index + at.length)]
}
