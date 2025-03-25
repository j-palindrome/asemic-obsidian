// Here are the rules for notation:
//
// # Point Syntax
// x,y: absolute coordinates in x,y.
// +x,y: relative coordinates in x,y. The point is determined relative to the previous point.
// @t,r: polar coordinates in theta, r. The point is determined starting at the previous point, rotating by theta and moving by r. Theta is given in 0-1 along a circle (0 = 0deg, 1 = 360deg).
// <p: intersection. Returns the point on the previous line p amount along it. p can range from 0 to 1.
//
// # Line Syntax
// [x,y x,y x,y]: points. Create a new line of points.
// +[x,y]: add points. Add points to the current line.
// f(x0,y0 x1,y1 h,w): call the function f. 3(): draw 3 points [0,0 0.5,0 1,0], 4(): draw [0,0 0,1 1,1 1,0] 5(): draw 5 points [0,0 0,.66 .5,1 1,0.66 1,0], 6(): draw 6 points [0,0 0,0 1,0 1,1 1,0 1,0].
// The start point is x0,y0 and the end point is x1,y1. The shape is rotated and scaled to stretch between these two points.
// h,w determines the scale of the curve, h with how much it bends upwards and w with how much it bows outwards in the x-direction. If only one number is provided it is assumed to be h.
// {*x,y @t +x,y}: transformation. The coordinate system is scaled by *x,y (if present), rotated by @theta (if present), and moved by +x,y (if present). Transformations are performed in the order in which they appear.
// Examples: {+0,1} {+1,2 @1/4 *2,3} {+-.1,2 @0.3}
// {!}: reset the current transformation.
// {+! @! *!} +!: reset transform, @!: reset rotation, *!: reset scale.

// Larger-scale functions
// text(string): render the given text

import { Bound, Color, Group, Mat, Pt } from 'pts'
import { defaultFont } from './defaultFont'
import { lerp } from 'three/src/math/MathUtils.js'
import { AsemicGroup, AsemicPt } from './AsemicPt'
import { thickness } from 'three/tsl'

export type Transform = {
  scale: Pt
  rotation: number
  translation: Pt
  thickness: number | (() => number)
}
export class Parser {
  startTime = performance.now()
  curves: AsemicGroup[] = []
  settings: Record<string, any>
  currentCurve: AsemicGroup = new AsemicGroup()
  transform: Transform = {
    scale: new Pt(1, 1),
    rotation: 0,
    translation: new Pt(0, 0),
    thickness: 1
  }
  transforms: Transform[] = []
  progress = { point: 0, time: 0, curve: 0 }
  font = defaultFont
  lastPoint: AsemicPt = new AsemicPt(this, 0, 0)

  reset() {
    this.curves = []
    this.progress.point = 0
    this.progress.curve = 0
    this.progress.time = Math.floor(performance.now() - this.startTime) / 1000
    this.transform = {
      scale: new Pt(1, 1),
      rotation: 0,
      translation: new Pt(0, 0),
      thickness: 1
    }
  }

  log(slice: number = 0) {
    const toFixed = (x: number) => {
      const str = x.toFixed(2)
      if (str.endsWith('00')) {
        return String(Math.floor(x))
      } else {
        return str
      }
    }
    return this.curves
      .slice(slice)
      .map(
        curve =>
          `[${curve.map(x => `${toFixed(x[0])},${toFixed(x[1])}`).join(' ')}]`
      )
      .join('\n')
  }

  format({ w }: { w: number }) {
    let newCurves: [number, number][][] = []
    for (let curve of this.curves) {
      // fake it with a gradient
      const newCurve: [number, number][] = []
      let index = 0
      const push = ([x, y]) => {
        // newCurve.set([x, y], index)
        newCurve.push([x, y])
        index += 2
      }
      if (curve.length == 1) {
      } else if (curve.length == 2) {
        // ctx.beginPath()
        const normal = curve
          .at(1)
          .$subtract(curve[0])
          .rotate2D(0.25 * Math.PI * 2)
          .unit()
          .scale(curve.at(1).thickness / 2 / w)

        const p0 = curve.at(0).clone()
        p0.add(normal)

        push([p0.x, p0.y])

        const p1 = curve.at(1).clone()
        p1.add(normal)
        push([p1.x, p1.y])
        p1.subtract(normal.clone().scale(2))
        push([p1.x, p1.y])
        p0.subtract(normal.clone().scale(2))
        push([p0.x, p0.y])
      } else {
        const p0 = curve.at(0).clone()
        const n0 = curve
          .at(1)
          .$subtract(curve.at(0))
          .rotate2D(0.25 * Math.PI * 2)
          .unit()
          .scale(curve.at(0).thickness / 2 / w)
        p0.add(n0)
        push([p0.x, p0.y])

        const drawCurve = (curve: AsemicGroup, i: number) => {
          const p2 =
            i === curve.length - 3
              ? curve.at(i + 2).clone()
              : curve
                  .at(i + 1)
                  .$add(curve.at(i + 2))
                  .divide(2)
          const n2 = curve
            .at(i + 2)
            .$subtract(curve.at(i + 1))
            .rotate2D(0.25 * Math.PI * 2)
            .unit()
            .scale(
              (curve.at(i + 1).thickness + curve.at(i + 2).thickness) /
                2 /
                2 /
                w
            )
          p2.add(n2)
          const p1 = curve.at(i + 1).clone()
          const n1 = curve
            .at(i + 2)
            .$subtract(curve.at(i))
            .rotate2D(0.25 * Math.PI * 2)
            .unit()
            .scale(curve.at(i + 1).thickness / 2 / w)
          p1.add(n1)

          // The curve is given in [x,y] points with quadratic curves drawn between them. For each pair [p1 p2], the first control point is p1, and the second control point is (p1 + p2) / 2.
          // Given a thickness t, find the 2 edges of the curve from the second control point.
          push([p1.x, p1.y])
          push([p2.x, p2.y])
        }
        for (let i = 0; i <= curve.length - 3; i++) {
          drawCurve(curve, i)
        }
        const reversedCurve = new AsemicGroup(...curve.reverse())
        const pEnd = reversedCurve.at(0).clone()
        const nEnd = reversedCurve
          .at(1)
          .$subtract(reversedCurve.at(0))
          .rotate2D(0.25 * Math.PI * 2)
          .unit()
          .scale(reversedCurve.at(0).thickness / 2 / w)
        pEnd.add(nEnd)
        push([pEnd.x, pEnd.y])
        for (let i = 0; i <= curve.length - 3; i++) {
          drawCurve(reversedCurve, i)
        }
      }
      newCurves.push(newCurve)
    }
    return newCurves
  }

  protected evalExpr(expr: string) {
    if (!expr) return undefined
    while (expr.includes('(')) {
      let bracket = 1
      const start = expr.indexOf('(')
      let end = start + 1
      for (; end < expr.length; end++) {
        if (expr[end] === '(') bracket++
        else if (expr[end] === ')') {
          bracket--
          if (bracket === 0) break
        }
      }

      expr =
        expr.substring(0, start) +
        this.evalExpr(expr.substring(start + 1, end)) +
        expr.substring(end + 1)
    }
    if (expr.includes('T')) {
      // vary according to t
      expr = expr.replace(/T/g, this.progress.time.toString())
    }
    while (expr.includes('R')) {
      expr = expr.replace('R', `${Math.random().toFixed(3)}`)
    }
    if (expr.includes('P')) {
      expr = expr.replace(/P/g, this.progress.point.toString())
    }
    if (expr.includes('C')) {
      expr = expr.replace(/C/g, this.progress.curve.toString())
    }
    if (expr.includes('>')) {
      // 1.1<R>2.4
      const [firstPoint, fade, ...nextPoints] = expr
        .split(/[<>]/g)
        .map(x => this.evalExpr(x))
      const points = [firstPoint, ...nextPoints]
      const index = (points.length - 1) * fade * 0.999

      return lerp(
        points[Math.floor(index)],
        points[Math.floor(index) + 1],
        index % 1
      )
    }

    if (expr.includes('*')) {
      const [num, denom] = expr.split('*').map(x => this.evalExpr(x))
      return num / denom
    }
    if (expr.includes('/')) {
      const [num, denom] = expr.split('/').map(x => this.evalExpr(x))
      return num / denom
    }
    if (expr.includes('%')) {
      const [num, denom] = expr.split('%').map(x => this.evalExpr(x))
      return num % denom
    }

    return parseFloat(expr)
  }

  parse(source: string) {
    const evalPoint = (
      point: string,
      defaultValue: boolean | number = true
    ): Pt => {
      const parts = point.split(',')
      if (parts.length === 1) {
        if (defaultValue === false)
          throw new Error(`Incomplete point: ${point}`)
        return new Pt(
          this.evalExpr(parts[0]),
          defaultValue === true ? this.evalExpr(parts[0]) : defaultValue
        )
      }
      return new Pt(this.evalExpr(parts[0]), this.evalExpr(parts[1]))
    }

    // Parse point from string notation
    const parsePoint = (notation: string) => {
      const prevCurve = this.curves[this.curves.length - 1]
      const applyTransform = (point: AsemicPt, relative: boolean): AsemicPt => {
        point
          .scale(this.transform.scale, !relative ? [0, 0] : this.lastPoint)
          .rotate2D(
            this.transform.rotation * Math.PI * 2,
            !relative ? [0, 0] : this.lastPoint
          )
        if (!relative) point.add(this.transform.translation)

        return point
      }

      notation = notation.trim()

      let point: AsemicPt
      // Intersection point syntax: <p
      if (notation.startsWith('<')) {
        if (!prevCurve || prevCurve.length < 2) {
          throw new Error('Intersection requires a previous curve')
        }

        let p = this.evalExpr(notation.substring(1))
        const idx = Math.floor(p * (prevCurve.length - 1))
        const frac = p * (prevCurve.length - 1) - idx

        if (idx >= prevCurve.length - 1) {
          return prevCurve[prevCurve.length - 1]
        }

        const p1 = prevCurve[idx]
        const p2 = prevCurve[idx + 1]

        point = new AsemicPt(
          this,
          p1[0] + (p2[0] - p1[0]) * frac,
          p1[1] + (p2[1] - p1[1]) * frac
        )
      }

      // Polar coordinates: @t,r
      else if (notation.startsWith('@')) {
        const [theta, radius] = evalPoint(notation.substring(1), false)
        const thetaRad = theta * Math.PI * 2 // Convert 0-1 to radians

        point = applyTransform(
          this.lastPoint.$add(radius, 0).rotate2D(thetaRad, this.lastPoint),
          true
        )
      }

      // Relative coordinates: +x,y
      else if (notation.startsWith('+')) {
        point = applyTransform(
          this.lastPoint.$add(evalPoint(notation.substring(1))),
          true
        )
      } else {
        // Absolute coordinates: x,y
        point = applyTransform(new AsemicPt(this, evalPoint(notation)), false)
      }
      this.lastPoint = point
      return point
    }

    const mapCurve = (
      multiplyPoints: Group,
      addPoints: Group,
      start: AsemicPt,
      end: AsemicPt
    ) => {
      let usedEnd =
        end[0] === start[0] && end[1] === start[1] ? start.$add(1, 0) : end

      const angle = usedEnd.$subtract(start).angle()
      const distance = usedEnd.$subtract(start).magnitude()

      const mappedCurve = [
        start,
        ...multiplyPoints.map((x, i) => {
          x.scale([distance, this.transform.scale.y], [0, 0])
            .add(addPoints[i].scale([1, this.transform.scale.x], [0, 0]))
            .rotate2D(angle, [0, 0])
            .add(start)
          this.progress.point = (i + 1) / (multiplyPoints.length + 2 - 1)
          return new AsemicPt(this, x)
        }),
        end
      ]
      this.currentCurve.push(...mappedCurve)
    }

    const parseArgs = (args: string[]) => {
      this.progress.point = 0
      const startPoint = parsePoint(args[0])
      this.progress.point = 1
      const endPoint = parsePoint(args[1])

      let h = 0,
        w = 0
      if (args.length >= 3) {
        const hwParts = args[2].split(',')
        h = this.evalExpr(hwParts[0])
        w = hwParts.length > 1 ? this.evalExpr(hwParts[1]) : 0
      }

      return [startPoint, endPoint, h, w] as [
        AsemicPt,
        AsemicPt,
        number,
        number
      ]
    }

    const splitArgs = (argsStr: string) => argsStr.split(' ').filter(Boolean)
    // Predefined functions
    const functions: Record<string, (args: string) => void> = {
      log: args => {
        const slice = Number(args[0] || '0')
        postMessage({ log: this.log(slice) })
      },
      within: argsStr => {
        const args = splitArgs(argsStr)
        const point0 = parsePoint(args[0])
        const point1 = parsePoint(args[1])
        const slice = Number(args[2] ?? '0')
        const bounds = new AsemicGroup(
          ...(this.curves.slice(slice).flat() as AsemicPt[])
        ).boundingBox()
        const sub = bounds[0].$subtract(point0)
        this.curves
          .slice(slice)
          .forEach(curve =>
            curve
              .subtract(sub)
              .scale(
                Math.min(
                  (point1.x - point0.x) / (bounds[1].x - bounds[0].x),
                  (point1.y - point0.y) / (bounds[1].y - bounds[0].y)
                ),
                point0
              )
          )
      },
      text: text => {
        const formatSpace = (insert?: string) => {
          if (insert) return ` ${insert} `
          return ' '
        }
        this.parse(
          formatSpace(this.font.settings.start) +
            text
              .split('')
              .map(x => this.font.characters[x])
              .filter(Boolean)
              .join(formatSpace(this.font.settings.each)) +
            formatSpace(this.font.settings.end)
        )
      },
      '3': argsStr => {
        const args = splitArgs(argsStr)
        const [start, end, h] = parseArgs(args)
        return mapCurve(
          Group.fromArray([[0.5, h * 2]]),
          Group.fromArray([[0, 0]]),
          start,
          end
        )
      },
      '4': argsStr => {
        const args = splitArgs(argsStr)
        const [start, end, h, w] = parseArgs(args)
        return mapCurve(
          Group.fromArray([
            [0, h],
            [1, h]
          ]),
          Group.fromArray([
            [-w, 0],
            [w, 0]
          ]),
          start,
          end
        )
      },
      '5': argsStr => {
        const args = splitArgs(argsStr)
        const [start, end, h, w] = parseArgs(args)
        return mapCurve(
          Group.fromArray([
            [0, h * 0.5],
            [0.5, h],
            [1, h * 0.5]
          ]),
          Group.fromArray([
            [-w, 0],
            [0, 0],
            [w, 0]
          ]),
          start,
          end
        )
      },
      '6': argsStr => {
        const args = splitArgs(argsStr)
        const [start, end, h, w] = parseArgs(args)
        return mapCurve(
          Group.fromArray([
            [0, 0],
            [0, h],
            [1, h],
            [1, 0]
          ]),
          Group.fromArray([
            [-w, 0],
            [-w, 0],
            [w, 0],
            [w, 0]
          ]),
          start,
          end
        )
      },
      circle: argsStr => {
        const args = splitArgs(argsStr)
        const center = parsePoint(args[0])
        const [w, h] = evalPoint(args[1])
          .scale(this.transform.scale)
          .rotate2D(this.transform.rotation * Math.PI * 2)
        const points = Group.fromArray([
          [w, 0],
          [w, h],
          [-w, h],
          [-w, -h],
          [w, -h],
          [w, 0]
        ]).add(center)
        this.currentCurve.push(
          ...points.map((x, i) => {
            this.progress.point = i / (points.length - 1)
            return new AsemicPt(this, x)
          })
        )
      }
    }

    const parseTransform = (token: string) => {
      // { ...transforms }
      const transformStr = token.substring(1, token.length - 1)
      const transforms = transformStr.split(' ')

      transforms.forEach(transform => {
        if (transform === '<') {
          Object.assign(this.transform, this.transforms.pop()!)
        } else if (transform === '>') {
          const newTransform = {} as Transform
          for (let key of Object.keys(this.transform)) {
            if (this.transform[key] instanceof Pt) {
              newTransform[key] = this.transform[key].clone()
            } else {
              newTransform[key] = this.transform[key]
            }
          }
          this.transforms.push(newTransform)
        } else if (transform === '!') {
          // Reset all transformations
          this.transform.scale.set([1, 1])
          this.transform.rotation = 0
          this.transform.translation.set([0, 0])
        } else if (transform.startsWith('*!')) {
          // Reset scale
          this.transform.scale.set([1, 1])
        } else if (transform.startsWith('@!')) {
          // Reset rotation
          this.transform.rotation = 0
        } else if (transform.startsWith('+!')) {
          // Reset translation
          this.transform.translation.set([0, 0])
        } else if (transform.startsWith('*')) {
          // Scale
          this.transform.scale.multiply(evalPoint(transform.substring(1)))
        } else if (transform.startsWith('@')) {
          // Rotation
          this.transform.rotation += this.evalExpr(transform.substring(1))
        } else if (transform.startsWith('+')) {
          // Translation
          this.transform.translation.add(
            evalPoint(transform.substring(1))
              .scale(this.transform.scale)
              .rotate2D(this.transform.rotation * Math.PI * 2)
          )
        } else {
          const keyCall = transform.match(/(\w+)\:(.+)/)
          if (keyCall) {
            const key = keyCall[1]
            const value = keyCall[2]
            switch (key) {
              case 'thickness':
                this.transform.thickness = () => {
                  return this.evalExpr(value)
                }
                break
              default:
                if (value.includes(',')) {
                  const list = value.split(',')
                  if (list.length > 2) {
                    this.transform[key] = new AsemicPt(
                      this,
                      value.split(',').map(x => this.evalExpr(x))
                    )
                  } else {
                    this.transform[key] = evalPoint(value)
                  }
                } else {
                  this.transform[key] = this.evalExpr(value)
                }
                break
            }
          }
        }
      })
    }

    if (source.includes('\n---')) {
      const parseSetting = (token: string) => {
        if (!token) return
        if (token.startsWith('!')) {
          this.settings[token.substring(1)] = false
        } else if (token.includes(':')) {
          const [key, value] = token.split(':')
          this.settings[key] = parseFloat(value)
        } else {
          this.settings[token] = true
        }
      }
      const [preSettings, afterSource] = source.split('\n---')
      if (!this.settings) {
        this.settings = {}
        for (let token of preSettings.split(/\s/g)) {
          parseSetting(token.trim())
        }
        postMessage({ settings: this.settings })
      }
      source = afterSource
    }

    // Tokenize the source
    let tokens: string[] = []
    let current = ''
    let inBrackets = 0
    let inParentheses = 0
    let inBraces = 0

    const parsedString = source
      .split('\n')
      .filter(x => !/^\s*\/\//.test(x))
      .join('\n')
    for (let i = 0; i < parsedString.length; i++) {
      const char = parsedString[i]

      if (char === '[') inBrackets++
      else if (char === ']') inBrackets--
      else if (char === '(') inParentheses++
      else if (char === ')') inParentheses--
      else if (char === '{') inBraces++
      else if (char === '}') inBraces--

      if (
        (char === ' ' || char === '\n') &&
        inBrackets === 0 &&
        inParentheses === 0 &&
        inBraces === 0
      ) {
        if (current) {
          tokens.push(current)
          current = ''
        }
      } else {
        current += char
      }
    }

    if (current) tokens.push(current)

    for (let i = 0; i < tokens.length; i++) {
      let token = tokens[i].trim()

      // Parse transformation
      if (token.startsWith('{') && token.endsWith('}')) {
        parseTransform(token)
        continue
      }

      // curve additions

      if (token.startsWith('+')) {
        token = token.substring(1)
      } else {
        if (this.currentCurve.length > 0) {
          if (this.currentCurve.length === 2) {
            this.progress.point = 0.5
            this.currentCurve.splice(1, 0, this.currentCurve.interpolate(0.5))
          }
          this.curves.push(this.currentCurve)
          this.currentCurve = new AsemicGroup()
          this.progress.point = 0
          this.progress.curve++
        }
      }

      // Parse points definition
      if (token.startsWith('[')) {
        const pointsStr = token.substring(1, token.length - 1)
        const pointsTokens = pointsStr.split(' ')

        pointsTokens.forEach((pointToken, i) => {
          if (!pointToken.trim()) return
          this.progress.point = i / (pointsTokens.length - 1)
          const point = parsePoint(pointToken)
          this.currentCurve.push(point)
        })

        continue
      }

      // Parse function call
      const functionCall = token.trim().match(/^(\w+)\((.*?)\)$/)
      if (functionCall) {
        const functionName = functionCall[1]
        const argsStr = functionCall[2]

        // Parse function arguments

        if (!functions[functionName])
          throw new Error(
            `unknown function: ${functionName} with args ${argsStr}`
          )
        functions[functionName](argsStr)
        continue
      }
    }

    if (this.currentCurve.length > 0) {
      this.curves.push(this.currentCurve)
    }
  }

  constructor() {
    this.evalExpr = this.evalExpr.bind(this)
  }
}
