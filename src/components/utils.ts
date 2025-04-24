export const defaultPreProcess = () =>
  ({ replacements: {} } as {
    replacements: Record<string, string>
  })

export const splitArgs = (argsStr: string) => {
  const split = argsStr.split(' ').filter(Boolean)

  let args: string[] = []
  let currentArg = ''
  let inString: string | null = null

  for (let i = 0; i < split.length; i++) {
    const token = split[i]

    if (inString) {
      currentArg += ' ' + token
      if (token.endsWith(inString)) {
        args.push(currentArg.substring(1, currentArg.length - 1))
        currentArg = ''
        inString = null
      }
    } else {
      if (token.startsWith('"') || token.startsWith("'")) {
        inString = token[0]
        currentArg = token
        if (token.endsWith(inString) && token.length > 1) {
          args.push(currentArg.substring(1, currentArg.length - 1))
          currentArg = ''
          inString = null
        }
      } else {
        args.push(token)
      }
    }
  }

  return args
}
