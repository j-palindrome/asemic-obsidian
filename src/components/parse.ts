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

import { Group, Mat, Pt } from 'pts'

export const parse = (source: string): Group[] => {
  const curves: Group[] = []
  let currentCurve: Group = new Group()
  let lastPoint: Pt = new Pt(0, 0)
  let scale: Pt = new Pt(1, 1)
  let rotation = 0
  let translation: Pt = new Pt(0, 0)

  // Helper to evaluate math expressions like "1/4"
  const evalExpr = (expr: string): number => {
    console.log('eval', expr)
    if (expr.includes('/')) {
      const [num, denom] = expr.split('/').map(Number)
      return num / denom
    }
    return parseFloat(expr)
  }

  // Apply current transformation to a point
  const applyTransform = (point: Pt): Pt => {
    return point
      .scale(scale)
      .rotate2D(rotation * Math.PI * 2)
      .add(translation)
  }

  // Parse point from string notation
  const parsePoint = (notation: string, prevCurve?: Group) => {
    notation = notation.trim()

    // Intersection point syntax: <p
    if (notation.startsWith('<')) {
      if (!prevCurve || prevCurve.length < 2) {
        throw new Error('Intersection requires a previous curve')
      }

      const p = evalExpr(notation.substring(1))
      const idx = Math.floor(p * (prevCurve.length - 1))
      const frac = p * (prevCurve.length - 1) - idx

      if (idx >= prevCurve.length - 1) {
        return prevCurve[prevCurve.length - 1]
      }

      const p1 = prevCurve[idx]
      const p2 = prevCurve[idx + 1]

      return new Pt([
        p1[0] + (p2[0] - p1[0]) * frac,
        p1[1] + (p2[1] - p1[1]) * frac
      ])
    }

    // Polar coordinates: @t,r
    if (notation.startsWith('@')) {
      const parts = notation.substring(1).split(',')
      const theta = evalExpr(parts[0])
      const radius = parts.length > 1 ? evalExpr(parts[1]) : 1

      const thetaRad = theta * Math.PI * 2 // Convert 0-1 to radians
      return new Pt([
        lastPoint[0] + radius * Math.cos(thetaRad),
        lastPoint[1] + radius * Math.sin(thetaRad)
      ])
    }

    // Relative coordinates: +x,y
    if (notation.startsWith('+')) {
      const parts = notation.substring(1).split(',')
      const x = evalExpr(parts[0])
      const y = evalExpr(parts[1])

      return new Pt([lastPoint[0] + x, lastPoint[1] + y])
    }

    // Absolute coordinates: x,y
    const parts = notation.split(',')
    const x = evalExpr(parts[0])
    const y = evalExpr(parts[1])

    return new Pt(x, y)
  }

  const mapCurve = (points: Group, start: Pt, end: Pt): Pt[] => {
    let usedEnd =
      end[0] === start[0] && end[1] === start[1]
        ? [start[0] + 1, start[1] + 0]
        : end
    // Handle both single point and array of points
    const curvePoints = points

    // Calculate the vector from start to end
    const dx = usedEnd[0] - start[0]
    const dy = usedEnd[1] - start[1]
    const distance = Math.sqrt(dx * dx + dy * dy)

    // Calculate the rotation angle
    const angle = Math.atan2(dy, dx)

    console.log('map', points, start, end, distance, angle)

    const mappedCurve = [
      start,
      ...points.map(x => x.rotate2D(angle, start).scale(1 / distance, start)),
      end
    ]
    return mappedCurve
  }

  // Predefined functions
  const functions: Record<
    string,
    (start: Pt, end: Pt, h?: number, w?: number) => Pt[]
  > = {
    '3': (start, end, h = 0, w = 0) =>
      mapCurve(Group.fromArray([[0.5, h]]), start, end),
    '4': (start, end, h = 0, w = 0) =>
      mapCurve(
        Group.fromArray([
          [-w, h],
          [1 + w, h]
        ]),
        start,
        end
      ),
    '5': (start, end, h = 0, w = 0) =>
      mapCurve(
        Group.fromArray([
          [-w, 0.5 * h],
          [0.5, h],
          [1 + w, 0.5 * h]
        ]),
        start,
        end
      ),
    '6': (start, end, h = 0, w = 0) =>
      mapCurve(
        Group.fromArray([
          [-w, 0],
          [-w, h],
          [1 + w, h],
          [1 + w, 0]
        ]),
        start,
        end
      )
  }

  // Tokenize the source
  let tokens: string[] = []
  let current = ''
  let inBrackets = 0
  let inParentheses = 0

  for (let i = 0; i < source.length; i++) {
    const char = source[i]

    if (char === '[') inBrackets++
    else if (char === ']') inBrackets--
    else if (char === '(') inParentheses++
    else if (char === ')') inParentheses--

    if (
      (char === ' ' || char === '\n') &&
      inBrackets === 0 &&
      inParentheses === 0
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
    const token = tokens[i]

    // Parse transformation
    if (token.startsWith('{') && token.endsWith('}')) {
      const transformStr = token.substring(1, token.length - 1)
      const transforms = transformStr.split(' ')

      transforms.forEach(transform => {
        if (transform === '!') {
          // Reset all transformations
          scale.set([1, 1])
          rotation = 0
          translation.set([0, 0])
        } else if (transform.startsWith('*!')) {
          // Reset scale
          scale.set([1, 1])
        } else if (transform.startsWith('@!')) {
          // Reset rotation
          rotation = 0
        } else if (transform.startsWith('+!')) {
          // Reset translation
          translation.set([0, 0])
        } else if (transform.startsWith('*')) {
          // Scale
          const parts = transform.substring(1).split(',')
          if (parts.length === 1) {
            const s = evalExpr(parts[0])
            scale.set([s, s])
          } else {
            scale.set([evalExpr(parts[0]), evalExpr(parts[1])])
          }
        } else if (transform.startsWith('@')) {
          // Rotation
          rotation = evalExpr(transform.substring(1))
        } else if (transform.startsWith('+')) {
          // Translation
          const parts = transform.substring(1).split(',')
          translation.set([evalExpr(parts[0]), evalExpr(parts[1])])
        }
      })

      continue
    }

    // Parse points definition
    if (token.startsWith('[')) {
      if (currentCurve.length > 0) {
        curves.push(currentCurve)
      }

      currentCurve = new Group()
      const pointsStr = token.substring(1, token.length - 1)
      const pointsTokens = pointsStr.split(' ')

      pointsTokens.forEach(pointToken => {
        if (!pointToken.trim()) return

        const point = parsePoint(
          pointToken,
          curves.length > 0 ? curves[curves.length - 1] : undefined
        )
        const transformedPoint = applyTransform(point)
        currentCurve.push(transformedPoint)
        lastPoint = transformedPoint
      })

      continue
    }

    // Parse add points to current curve
    if (token === '+') {
      continue // Just a continuation marker, handled by the next token
    }

    // Parse add points
    if (token.startsWith('+[')) {
      const pointsStr = token.substring(2, token.length - 1)
      const pointsTokens = pointsStr.split(' ')

      pointsTokens.forEach(pointToken => {
        if (!pointToken.trim()) return

        const point = parsePoint(
          pointToken,
          curves.length > 0 ? curves[curves.length - 1] : undefined
        )
        const transformedPoint = applyTransform(point)
        currentCurve.push(transformedPoint)
        lastPoint = transformedPoint
      })

      continue
    }

    // Parse function call
    const functionMatch = token.match(/^(\d+)\((.*?)\)(?:\+(.*))?$/)
    if (functionMatch) {
      const functionName = functionMatch[1]
      const argsStr = functionMatch[2]
      const addPoints = functionMatch[3]

      // Parse function arguments
      const args = argsStr.split(' ').filter(Boolean)

      if (args.length >= 2) {
        const startPoint = parsePoint(
          args[0],
          curves.length > 0 ? curves[curves.length - 1] : undefined
        )
        const endPoint = parsePoint(
          args[1],
          curves.length > 0 ? curves[curves.length - 1] : undefined
        )
        const transformedStart = applyTransform(startPoint)
        const transformedEnd = applyTransform(endPoint)

        let h = 0,
          w = 0
        if (args.length >= 3) {
          const hwParts = args[2].split(',')
          h = evalExpr(hwParts[0])
          w = hwParts.length > 1 ? evalExpr(hwParts[1]) : 0
        }

        if (functions[functionName]) {
          if (currentCurve.length > 0) {
            curves.push(currentCurve)
            currentCurve = new Group()
          }

          const functionPoints = functions[functionName](
            transformedStart,
            transformedEnd,
            h,
            w
          )
          currentCurve.push(...functionPoints)
          lastPoint = functionPoints[functionPoints.length - 1]
        }
      }

      // Handle add points if present
      if (addPoints) {
        if (addPoints.startsWith('[')) {
          const pointsStr = addPoints.substring(1, addPoints.length - 1)
          const pointsTokens = pointsStr.split(' ')

          pointsTokens.forEach(pointToken => {
            if (!pointToken.trim()) return

            const point = parsePoint(
              pointToken,
              curves.length > 0 ? curves[curves.length - 1] : undefined
            )
            const transformedPoint = applyTransform(point)
            currentCurve.push(transformedPoint)
            lastPoint = transformedPoint
          })
        }
      }

      continue
    }
  }

  if (currentCurve.length > 0) {
    curves.push(currentCurve)
  }

  return curves
}
