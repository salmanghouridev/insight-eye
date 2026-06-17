import React, { useState, useEffect } from "react"

export interface CalibrationPoint {
  xPct: number
  yPct: number
  label: string
}

// 9 Calibration grid points on screen percentages
const CALIBRATION_POINTS: CalibrationPoint[] = [
  { xPct: 10, yPct: 10, label: "Top-Left" },
  { xPct: 50, yPct: 10, label: "Top-Center" },
  { xPct: 90, yPct: 10, label: "Top-Right" },
  { xPct: 10, yPct: 50, label: "Mid-Left" },
  { xPct: 50, yPct: 50, label: "Center" },
  { xPct: 90, yPct: 50, label: "Mid-Right" },
  { xPct: 10, yPct: 90, label: "Bot-Left" },
  { xPct: 50, yPct: 90, label: "Bot-Center" },
  { xPct: 90, yPct: 90, label: "Bot-Right" },
]

export interface CalibrationData {
  minGazeX: number
  maxGazeX: number
  minGazeY: number
  maxGazeY: number
}

interface CalibrationUIProps {
  currentRawGaze: { x: number; y: number }
  onCalibrationComplete: (data: CalibrationData) => void
  onCancel: () => void
}

export function CalibrationUI({ currentRawGaze, onCalibrationComplete, onCancel }: CalibrationUIProps) {
  const [activeIdx, setActiveIdx] = useState<number>(0)
  const [collectedPoints, setCollectedPoints] = useState<{ screen: CalibrationPoint; gaze: { x: number; y: number } }[]>([])

  const handlePointClick = () => {
    // Collect current raw gaze and map to target screen coordinates
    const pointData = {
      screen: CALIBRATION_POINTS[activeIdx],
      gaze: { ...currentRawGaze },
    }

    const updatedPoints = [...collectedPoints, pointData]
    setCollectedPoints(updatedPoints)

    if (activeIdx < CALIBRATION_POINTS.length - 1) {
      setActiveIdx(activeIdx + 1)
    } else {
      // Calculate calibration boundaries
      // Left columns: 0, 3, 6
      const leftGazeXs = [updatedPoints[0].gaze.x, updatedPoints[3].gaze.x, updatedPoints[6].gaze.x]
      // Right columns: 2, 5, 8
      const rightGazeXs = [updatedPoints[2].gaze.x, updatedPoints[5].gaze.x, updatedPoints[8].gaze.x]
      // Top rows: 0, 1, 2
      const topGazeYs = [updatedPoints[0].gaze.y, updatedPoints[1].gaze.y, updatedPoints[2].gaze.y]
      // Bottom rows: 6, 7, 8
      const botGazeYs = [updatedPoints[6].gaze.y, updatedPoints[7].gaze.y, updatedPoints[8].gaze.y]

      // Determine bounding limits
      const minGazeX = leftGazeXs.reduce((sum, val) => sum + val, 0) / 3
      const maxGazeX = rightGazeXs.reduce((sum, val) => sum + val, 0) / 3
      const minGazeY = topGazeYs.reduce((sum, val) => sum + val, 0) / 3
      const maxGazeY = botGazeYs.reduce((sum, val) => sum + val, 0) / 3

      onCalibrationComplete({
        minGazeX: Math.min(minGazeX, maxGazeX),
        maxGazeX: Math.max(minGazeX, maxGazeX),
        minGazeY: Math.min(minGazeY, maxGazeY),
        maxGazeY: Math.max(minGazeY, maxGazeY),
      })
    }
  }

  // Allow spacebar as secondary click trigger
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault()
        handlePointClick()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [activeIdx, collectedPoints, currentRawGaze])

  const activePoint = CALIBRATION_POINTS[activeIdx]

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-darkBg/95 select-none">
      {/* Top Banner */}
      <div className="absolute top-8 left-0 right-0 text-center">
        <h2 className="text-xl font-bold tracking-widest text-cyberCyan">
          9-POINT EYE TRACKING CALIBRATION
        </h2>
        <p className="mt-2 text-sm text-cyberSilver">
          Look directly at the pulsing red circle and press <kbd className="px-2 py-0.5 bg-darkPanel text-cyberCyan border border-cyberCyan/30 rounded text-xs">Spacebar</kbd> or click the dot.
        </p>
        <p className="mt-1 text-xs text-cyberSilver/60">
          Point {activeIdx + 1} of 9 ({activePoint.label})
        </p>
      </div>

      {/* Cancel button */}
      <button
        onClick={onCancel}
        className="absolute top-8 right-8 px-4 py-1.5 border border-cyberPink/50 text-cyberPink hover:bg-cyberPink/15 transition rounded text-xs uppercase font-mono tracking-widest"
      >
        Exit Calibration
      </button>

      {/* Target Dot */}
      <div
        className="absolute transition-all duration-300 ease-out cursor-pointer flex items-center justify-center"
        style={{ left: `${activePoint.xPct}%`, top: `${activePoint.yPct}%`, transform: "translate(-50%, -50%)" }}
        onClick={handlePointClick}
      >
        <div className="absolute w-8 h-8 rounded-full bg-cyberPink/20 animate-ping" />
        <div className="w-4 h-4 rounded-full bg-cyberPink border-2 border-white shadow-[0_0_15px_#FF2E63]" />
      </div>

      {/* Calibration Guide Grid Outline */}
      <div className="absolute inset-0 border-[10px] border-cyberCyan/10 pointer-events-none" />
      <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-cyberCyan/5 pointer-events-none" />
      <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-cyberCyan/5 pointer-events-none" />
    </div>
  )
}
