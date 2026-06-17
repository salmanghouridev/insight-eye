import React from "react"
import { Eye, Activity, Timer, ArrowUpRight, Compass } from "lucide-react"

interface MetricsDashboardProps {
  ear: number
  blinkCount: number
  isBlinkActive: boolean
  gazeX: number
  gazeY: number
  gazeVelocity: number
  isFixating: boolean
  isSaccade: boolean
}

export function MetricsDashboard({
  ear,
  blinkCount,
  isBlinkActive,
  gazeX,
  gazeY,
  gazeVelocity,
  isFixating,
  isSaccade
}: MetricsDashboardProps) {
  // Determine text representation of gaze direction
  const getGazeDirection = () => {
    if (isBlinkActive) return "BLINKING"
    
    let horiz = "Center"
    if (gazeX < 0.42) horiz = "Left"
    if (gazeX > 0.58) horiz = "Right"

    let vert = ""
    if (gazeY < 0.42) vert = "Up"
    if (gazeY > 0.58) vert = "Down"

    if (horiz === "Center" && vert === "") return "Centered"
    return `${vert} ${horiz}`.trim()
  }

  const gazeDirection = getGazeDirection()

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
      {/* 1. Blink Tracker Card */}
      <div className={`p-5 rounded-lg border bg-darkPanel/40 backdrop-blur-sm transition-all duration-300 ${
        isBlinkActive ? "border-cyberPink shadow-[0_0_15px_rgba(255,46,99,0.2)] bg-cyberPink/10" : "border-cyberTeal/20"
      }`}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono tracking-widest text-cyberSilver/70 uppercase">Blink Monitor</span>
          <Eye className={`w-4 h-4 ${isBlinkActive ? "text-cyberPink animate-pulse" : "text-cyberTeal"}`} />
        </div>
        <div className="mt-4 flex items-baseline gap-2">
          <span className={`text-3xl font-bold font-mono tracking-tight transition-colors duration-200 ${
            isBlinkActive ? "text-cyberPink" : "text-white"
          }`}>
            {blinkCount}
          </span>
          <span className="text-xs text-cyberSilver/50">blinks</span>
        </div>
        <div className="mt-2 text-xs text-cyberSilver/40 font-mono">
          State: {isBlinkActive ? "EYE CLOSED" : "EYE OPEN"}
        </div>
      </div>

      {/* 2. Gaze Direction Card */}
      <div className="p-5 rounded-lg border border-cyberTeal/20 bg-darkPanel/40 backdrop-blur-sm transition-all duration-300">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono tracking-widest text-cyberSilver/70 uppercase">Gaze Direction</span>
          <Compass className="w-4 h-4 text-cyberCyan" />
        </div>
        <div className="mt-4 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-white tracking-wide truncate max-w-full">
            {gazeDirection}
          </span>
        </div>
        <div className="mt-2 text-xs text-cyberSilver/40 font-mono flex gap-3">
          <span>X: {gazeX.toFixed(3)}</span>
          <span>Y: {gazeY.toFixed(3)}</span>
        </div>
      </div>

      {/* 3. Fixation Card */}
      <div className={`p-5 rounded-lg border bg-darkPanel/40 backdrop-blur-sm transition-all duration-300 ${
        isFixating ? "border-cyberGreen shadow-[0_0_15px_rgba(0,230,118,0.15)] bg-cyberGreen/5" : "border-cyberTeal/20"
      }`}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono tracking-widest text-cyberSilver/70 uppercase">Fixation Monitor</span>
          <Timer className={`w-4 h-4 ${isFixating ? "text-cyberGreen" : "text-cyberSilver/40"}`} />
        </div>
        <div className="mt-4 flex items-baseline gap-2">
          <span className={`text-3xl font-bold font-mono ${isFixating ? "text-cyberGreen" : "text-white"}`}>
            {isFixating ? "STABLE" : "LOOKING"}
          </span>
        </div>
        <div className="mt-2 text-xs text-cyberSilver/40 font-mono">
          Focus: {isFixating ? "Visual Fixation Locked" : "Scanning Scene"}
        </div>
      </div>

      {/* 4. Saccade Velocity Card */}
      <div className={`p-5 rounded-lg border bg-darkPanel/40 backdrop-blur-sm transition-all duration-300 ${
        isSaccade ? "border-cyberPink/80 shadow-[0_0_15px_rgba(255,46,99,0.15)] bg-cyberPink/5" : "border-cyberTeal/20"
      }`}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono tracking-widest text-cyberSilver/70 uppercase">Saccade Speed</span>
          <ArrowUpRight className={`w-4 h-4 ${isSaccade ? "text-cyberPink" : "text-cyberTeal"}`} />
        </div>
        <div className="mt-4 flex items-baseline gap-2">
          <span className="text-3xl font-bold font-mono text-white">
            {gazeVelocity.toFixed(2)}
          </span>
          <span className="text-xs text-cyberSilver/50">u/s</span>
        </div>
        <div className="mt-2 text-xs font-mono">
          <span className={isSaccade ? "text-cyberPink" : "text-cyberSilver/40"}>
            {isSaccade ? "SACCADE DETECTED" : "Low Acceleration"}
          </span>
        </div>
      </div>
    </div>
  )
}
