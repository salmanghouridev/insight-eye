import React, { useRef, useEffect } from "react"

interface Point {
  x: number
  y: number
  timestamp: number
}

interface GazePlotterProps {
  currentGaze: { x: number; y: number }
  isBlinkActive: boolean
}

export function GazePlotter({ currentGaze, isBlinkActive }: GazePlotterProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const historyRef = useRef<Point[]>([])
  const maxHistoryLength = 40 // Keep trailing history

  // Append new points
  useEffect(() => {
    if (isBlinkActive) return // Don't plot coordinates during blinks

    const now = Date.now()
    historyRef.current.push({ x: currentGaze.x, y: currentGaze.y, timestamp: now })
    if (historyRef.current.length > maxHistoryLength) {
      historyRef.current.shift()
    }
  }, [currentGaze, isBlinkActive])

  // Draw loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Set high DPI support
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
    }

    // Clear canvas
    ctx.clearRect(0, 0, width, height)

    // 1. Draw Grid Outline & Crosshairs
    ctx.strokeStyle = "rgba(102, 252, 241, 0.05)"
    ctx.lineWidth = 1
    
    // Grid lines
    const gridCount = 5
    for (let i = 1; i < gridCount; i++) {
      const x = (width / gridCount) * i
      const y = (height / gridCount) * i
      
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
      
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }

    // Center Crosshair
    ctx.strokeStyle = "rgba(102, 252, 241, 0.15)"
    ctx.beginPath()
    ctx.moveTo(width / 2, 0)
    ctx.lineTo(width / 2, height)
    ctx.moveTo(0, height / 2)
    ctx.lineTo(width, height / 2)
    ctx.stroke()

    const points = historyRef.current
    if (points.length === 0) return

    // 2. Draw trailing gaze vectors (fading connections)
    for (let i = 1; i < points.length; i++) {
      const p1 = points[i - 1]
      const p2 = points[i]
      
      // Calculate opacity fade based on age index
      const alpha = (i / points.length) * 0.4
      ctx.strokeStyle = `rgba(102, 252, 241, ${alpha})`
      ctx.lineWidth = 2
      
      // Map ratios [0.2, 0.8] onto actual pixel dimensions for visualization
      const x1 = ((p1.x - 0.25) / 0.5) * width
      const y1 = ((p1.y - 0.25) / 0.5) * height
      const x2 = ((p2.x - 0.25) / 0.5) * width
      const y2 = ((p2.y - 0.25) / 0.5) * height

      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.stroke()
    }

    // 3. Draw current focus point with neon glow
    const latest = points[points.length - 1]
    const currentX = ((latest.x - 0.25) / 0.5) * width
    const currentY = ((latest.y - 0.25) / 0.5) * height

    // Target outer ring
    ctx.strokeStyle = "rgba(102, 252, 241, 0.8)"
    ctx.lineWidth = 1.5
    ctx.shadowBlur = 8
    ctx.shadowColor = "#66FCF1"
    ctx.beginPath()
    ctx.arc(currentX, currentY, 12, 0, 2 * Math.PI)
    ctx.stroke()

    // Inner glowing core dot
    ctx.fillStyle = "#66FCF1"
    ctx.beginPath()
    ctx.arc(currentX, currentY, 3, 0, 2 * Math.PI)
    ctx.fill()

    // Reset shadow parameters
    ctx.shadowBlur = 0
  }, [currentGaze, isBlinkActive])

  return (
    <div className="relative w-full h-[320px] rounded-lg border border-cyberTeal/15 bg-darkBg/60 backdrop-blur-sm overflow-hidden flex flex-col">
      {/* HUD Grid Title */}
      <div className="absolute top-4 left-4 font-mono text-[10px] uppercase tracking-widest text-cyberSilver/50 pointer-events-none select-none">
        Gaze Trace Vector HUD [Grid Bounds: X/Y 0.25-0.75]
      </div>
      <canvas ref={canvasRef} className="flex-1 w-full h-full cursor-crosshair" />
    </div>
  )
}
