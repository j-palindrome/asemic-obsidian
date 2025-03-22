import { Bound, Group } from 'pts'

export default class Renderer {
  ctx: OffscreenCanvasRenderingContext2D
  render(curves: Group[]) {
    let { ctx } = this
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    ctx.resetTransform()
    ctx.scale(ctx.canvas.width, -ctx.canvas.width)
    ctx.translate(0, -1)
    ctx.strokeStyle = 'white'
    ctx.lineWidth = 2 / ctx.canvas.width

    for (let curve of curves) {
      ctx.beginPath()
      ctx.moveTo(curve[0].x, curve[0].y)
      if (curve.length == 1) {
      } else if (curve.length == 2) {
        ctx.lineTo(curve[1].x, curve[1].y)
      } else {
        for (let i = 0; i < curve.length - 3; i++) {
          const nextPoint = curve[i + 1].$add(curve[i + 2]).divide(2)
          ctx.quadraticCurveTo(
            curve[i + 1].x,
            curve[i + 1].y,
            nextPoint.x,
            nextPoint.y
          )
        }
        ctx.quadraticCurveTo(
          curve[curve.length - 2].x,
          curve[curve.length - 2].y,
          curve[curve.length - 1].x,
          curve[curve.length - 1].y
        )
      }
      ctx.stroke()
    }
  }

  constructor(ctx: OffscreenCanvasRenderingContext2D) {
    this.ctx = ctx
  }
}
