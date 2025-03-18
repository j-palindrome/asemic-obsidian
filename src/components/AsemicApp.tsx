import { useRef } from 'react'

export default function AsemicApp({ source }: { source: string }) {
  const canvas = useRef()
  return (
    <div
      className='asemic'
      style={{
        maxHeight: '80vh',
        aspectRatio: '1 / 1',
        width: '100%',
        display: 'flex',
        alignItems: 'center'
      }}>
      <canvas ref={canvas}></canvas>
    </div>
  )
}
