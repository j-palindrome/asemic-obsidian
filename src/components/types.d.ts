declare global {
  interface Data {
    grid?: { x: number; y: number }
    curves?: string
    font?: Record<string, string>
  }
}

declare module '*.worker' {
  export default Worker
}

export {}
