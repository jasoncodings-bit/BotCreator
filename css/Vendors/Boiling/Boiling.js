import React, { useState, useEffect, useRef, useMemo } from "https://esm.sh/react@19"
import { createRoot } from "https://esm.sh/react-dom@19/client"
import { renderToStaticMarkup } from 'https://esm.sh/react-dom@19/server'
import rough from "https://esm.sh/roughjs"
import { Dog, Rabbit, Fish, Bird, Turtle } from "https://esm.sh/lucide-react"

const App = () => {
  const [content, setContent] = useState('something something')
  const canvasRef = useRef(null)
  const lastDrawTimeRef = useRef(0)
  const rafRef = useRef(null)

  const icons = useMemo(() => {
    return [
      { icon: Dog, color: 'darkorange' },
      { icon: Rabbit, color: 'hotpink' },
      { icon: Bird, color: 'royalblue' },
      { icon: Fish, color: 'gold' },
      { icon: Turtle, color: 'green' },
    ].map(({ icon, color }) => {
      const svg = renderToStaticMarkup(React.createElement(icon))
      const parser = new DOMParser()
      const doc = parser.parseFromString(svg, 'image/svg+xml')
      const svgEl = doc.querySelector('svg')
      const pathEls = svgEl?.querySelectorAll('path') ?? []
      const paths = [...pathEls].map(p => p.getAttribute('d'))
      return { paths, color }
    })
  }, [])

  const drawIcons = (cw, ch, ctx, rc) => {
    const scale = 2
    const gap = 24
    const baseSize = 24

    const iconWidth = baseSize * scale

    const totalWidth = icons.length * iconWidth + (icons.length - 1) * gap

    let x = (cw - totalWidth) / 2
    const y = (ch - iconWidth) / 2

    for (const { paths, color } of icons) {
      ctx.save()
      ctx.translate(x, y)
      ctx.scale(scale, scale)

      for (const d of paths) {
        rc.path(d, {
          stroke: color,
          roughness: 0.7,
          strokeWidth: 1.5 / scale,
        })
      }

      ctx.restore()
      x += iconWidth + gap
    }

  }

  useEffect(() => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    const dpr = window.devicePixelRatio || 1
    canvas.width = canvas.clientWidth * dpr
    canvas.height = canvas.clientHeight * dpr
    ctx.scale(dpr, dpr)

    const rc = rough.canvas(canvas)

    const loop = (t) => {
      rafRef.current = requestAnimationFrame(loop)
      if (t - lastDrawTimeRef.current < 150) return

      lastDrawTimeRef.current = t
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      drawIcons(canvas.clientWidth, canvas.clientHeight, ctx, rc)
    }

    rafRef.current = requestAnimationFrame(loop)

    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  return (
    <div>
      <canvas ref={canvasRef}></canvas>
    </div>
  )
}

const root = createRoot(document.getElementById("app"))

root.render(<App />)