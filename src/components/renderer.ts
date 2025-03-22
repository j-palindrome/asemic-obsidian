import { Bound, Group } from 'pts'
import { AsemicGroup, AsemicPt } from './AsemicPt'

export default class Renderer {
  ctx: OffscreenCanvasRenderingContext2D
  render(curves: AsemicGroup[]) {
    let { ctx } = this
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    ctx.resetTransform()
    ctx.scale(ctx.canvas.width, -ctx.canvas.width)
    ctx.translate(0, -1)
    ctx.lineWidth = 2 / ctx.canvas.width
    ctx.fillStyle = 'white'
    ctx.strokeStyle = 'white'
    for (let curve of curves) {
      // fake it with a gradient
      const w = this.ctx.canvas.width
      ctx.beginPath()

      if (curve.length == 1) {
      } else if (curve.length == 2) {
        for (let side = 0; side < 2; side++) {
          // ctx.beginPath()
          ctx.moveTo(curve.at(0).x, curve.at(0).y)
          const normal = curve
            .at(1)
            .$subtract(curve.at(0))
            .rotate2D(0.25 * Math.PI * 2)
            .unit()
            .scale(curve.at(1).thickness / w)

          const p1 = curve.at(1).clone()
          if (side) p1.add(normal)
          else p1.subtract(normal)
          ctx.lineTo(p1.x, p1.y)
        }
      } else {
        const p0 = curve.at(0).clone()
        const n0 = curve
          .at(1)
          .$subtract(curve.at(0))
          .rotate2D(0.25 * Math.PI * 2)
          .unit()
          .scale(curve.at(0).thickness / w)
        p0.add(n0)
        ctx.moveTo(p0.x, p0.y)

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
              (curve.at(i + 1).thickness + curve.at(i + 2).thickness) / 2 / w
            )
          p2.add(n2)
          const p1 = curve.at(i + 1).clone()
          const n1 = curve
            .at(i + 2)
            .$subtract(curve.at(i))
            .rotate2D(0.25 * Math.PI * 2)
            .unit()
            .scale(curve.at(i + 1).thickness / w)
          p1.add(n1)

          // The curve is given in [x,y] points with quadratic curves drawn between them. For each pair [p1 p2], the first control point is p1, and the second control point is (p1 + p2) / 2.
          // Given a thickness t, find the 2 edges of the curve from the second control point.
          ctx.quadraticCurveTo(p1.x, p1.y, p2.x, p2.y)
        }
        for (let i = 0; i <= curve.length - 3; i++) {
          drawCurve(curve, i, false)
        }
        const reversedCurve = new AsemicGroup(...curve.reverse())
        const pEnd = reversedCurve.at(0).clone()
        const nEnd = reversedCurve
          .at(1)
          .$subtract(reversedCurve.at(0))
          .rotate2D(0.25 * Math.PI * 2)
          .unit()
          .scale(reversedCurve.at(0).thickness / w)
        pEnd.add(nEnd)
        ctx.lineTo(pEnd.x, pEnd.y)
        for (let i = 0; i <= curve.length - 3; i++) {
          drawCurve(reversedCurve, i, false)
        }
      }
      ctx.fill()
      // ctx.fill()
    }
  }

  constructor(ctx: OffscreenCanvasRenderingContext2D) {
    this.ctx = ctx
  }
}
