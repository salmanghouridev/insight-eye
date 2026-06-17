"use client"

import React, { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Play, RotateCcw, AlertTriangle, CheckCircle, Wifi, StopCircle } from "lucide-react"

import { GazeTracker } from "@/components/GazeTracker"
import { GazePlotter } from "@/components/GazePlotter"
import { MetricsDashboard } from "@/components/MetricsDashboard"
import { SnellenTest } from "@/components/SnellenTest"
import { useGazeWebSocket } from "@/hooks/useGazeWebSocket"
import { Suspense } from "react"

function TrackerWorkspaceContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  
  const sessionId = searchParams.get("sessionId")
  const clientName = searchParams.get("clientName") || "Webcam Device"

  // Live Metrics State
  const [metrics, setMetrics] = useState<any>({
    frame_id: 0,
    timestamp: 0,
    ear_left: 0,
    ear_right: 0,
    ear_avg: 0,
    is_blink_active: false,
    gaze_x: 0.5,
    gaze_y: 0.5,
    gaze_velocity: 0.0,
    is_fixating: false,
    is_saccade: false,
    estimated_distance_cm: 150.0
  })

  // Calibration state (from camera tracking calibration, separate from screen card calibration)
  const [calibrationData, setCalibrationData] = useState<any | null>(null)
  const [isCalibratingGaze, setIsCalibratingGaze] = useState<boolean>(false)
  const [reportCompiling, setReportCompiling] = useState<boolean>(false)

  // Redirect if no session ID exists
  useEffect(() => {
    if (!sessionId) {
      router.push("/")
    }
  }, [sessionId, router])

  // WebSocket hook
  const { connectionState, sendMetrics, disconnect } = useGazeWebSocket({
    sessionId,
    role: "tracker"
  })

  // Triggered when Snellen test is complete
  const handleTestFinished = async (testScores: Record<string, string>) => {
    if (!sessionId) return
    setReportCompiling(true)
    
    try {
      // 1. Post Stop Session to compile session metrics
      await fetch(`http://localhost:8000/api/sessions/${sessionId}/stop`, {
        method: "POST"
      })

      // 2. Post Generate NLP Report to trigger LangChain Ollama engine
      const reportRes = await fetch(`http://localhost:8000/api/sessions/${sessionId}/generate-report`, {
        method: "POST"
      })

      if (!reportRes.ok) throw new Error("Failed to compile AI clinical report")
      
      // Clean up local websocket
      disconnect()
      
      // Redirect to reports viewer
      router.push(`/reports/${sessionId}`)
    } catch (err) {
      console.error(err)
      alert("Error compiling report on backend. Redirecting to report view...")
      router.push(`/reports/${sessionId}`)
    } finally {
      setReportCompiling(false)
    }
  }

  const handleStopSessionManually = async () => {
    if (!sessionId) return
    
    try {
      await fetch(`http://localhost:8000/api/sessions/${sessionId}/stop`, {
        method: "POST"
      })
      disconnect()
      router.push(`/reports/${sessionId}`)
    } catch (err) {
      router.push(`/reports/${sessionId}`)
    }
  }

  // Visual status indicators
  const getConnectionBadge = () => {
    switch (connectionState) {
      case "open":
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 bg-cyberGreen/10 border border-cyberGreen/30 text-cyberGreen rounded-full text-xs font-mono">
            <Wifi className="w-3.5 h-3.5" /> EYE FEED ACTIVE
          </span>
        )
      case "connecting":
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 bg-cyberCyan/10 border border-cyberCyan/30 text-cyberCyan rounded-full text-xs font-mono animate-pulse">
            <RotateCcw className="w-3.5 h-3.5 animate-spin" /> CONNECTING
          </span>
        )
      case "error":
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 bg-cyberPink/10 border border-cyberPink/30 text-cyberPink rounded-full text-xs font-mono">
            <AlertTriangle className="w-3.5 h-3.5" /> PIPELINE ERROR
          </span>
        )
      default:
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 bg-cyberSilver/10 border border-cyberSilver/30 text-cyberSilver rounded-full text-xs font-mono">
            <StopCircle className="w-3.5 h-3.5" /> STREAM OFFLINE
          </span>
        )
    }
  }

  const userDistance = metrics.estimated_distance_cm || 150.0
  const isDistanceCorrect = userDistance >= 135 && userDistance <= 165

  if (!sessionId) return null

  return (
    <div className="min-h-screen bg-darkBg flex flex-col p-6 space-y-6 relative font-mono text-white">
      {/* Background Grids */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(102,252,241,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(102,252,241,0.01)_1px,transparent_1px)] bg-[size:30px_30px] pointer-events-none" />

      {/* Top Header Panel */}
      <header className="relative p-5 bg-darkPanel/20 border border-cyberTeal/15 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="absolute top-0 left-4 -translate-y-1/2 px-2 bg-darkBg text-cyberCyan font-bold text-xs tracking-widest uppercase">
          INSIGHTEYE VISUAL TESTING CHAMBER
        </div>
        
        <div className="space-y-1">
          <h1 className="text-sm text-white font-bold flex items-center gap-2">
            Session: <span className="text-cyberCyan">{sessionId.slice(0, 8)}...</span>
          </h1>
          <p className="text-xs text-cyberSilver/50">Device: {clientName}</p>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          {getConnectionBadge()}
          
          <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono ${
            isDistanceCorrect ? "bg-cyberGreen/10 border border-cyberGreen/30 text-cyberGreen" : "bg-cyberPink/10 border border-cyberPink/30 text-cyberPink animate-pulse"
          }`}>
            <AlertTriangle className="w-3.5 h-3.5" /> 
            {isDistanceCorrect ? "POSITION SAFE" : "ADJUST DISTANCE"}
          </span>

          <button
            onClick={handleStopSessionManually}
            className="px-4 py-1.5 border border-cyberPink/50 text-cyberPink hover:bg-cyberPink hover:text-white transition font-semibold text-xs rounded uppercase tracking-wider flex items-center gap-1.5"
          >
            <StopCircle className="w-4 h-4" /> Exit Test
          </button>
        </div>
      </header>

      {/* Main Grid: Visual Testing Optotypes vs Live Camera Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column (2/3 width on large screens): Snellen Acuity optotype presenter */}
        <div className="lg:col-span-2 flex flex-col h-full">
          <SnellenTest
            sessionId={sessionId}
            userDistanceCm={userDistance}
            isDistanceCorrect={isDistanceCorrect}
            onTestFinished={handleTestFinished}
          />
        </div>

        {/* Right Column (1/3 width): Diagnostic Camera & Gaze tracker plot */}
        <div className="flex flex-col space-y-6">
          {/* Webcam Diagnostic block */}
          <div className="p-5 bg-darkPanel/10 border border-cyberTeal/15 rounded-lg flex flex-col space-y-3">
            <div className="text-xs text-cyberCyan font-bold tracking-wider uppercase mb-1">
              Webcam Diagnostic Feed
            </div>
            <GazeTracker
              sessionId={sessionId}
              connectionState={connectionState}
              sendMetrics={sendMetrics}
              onMetricsUpdated={setMetrics}
              calibrationData={calibrationData}
            />
          </div>

          {/* Gaze Vector visualizer plot */}
          <div className="p-5 bg-darkPanel/10 border border-cyberTeal/15 rounded-lg flex flex-col space-y-3">
            <div className="text-xs text-cyberCyan font-bold tracking-wider uppercase mb-1">
              Live Gaze Track Vector
            </div>
            <GazePlotter
              currentGaze={{ x: metrics.gaze_x, y: metrics.gaze_y }}
              isBlinkActive={metrics.is_blink_active}
            />
          </div>
        </div>
      </div>

      {/* Bottom Row: Live Telemetry Cards */}
      <section className="relative p-5 bg-darkPanel/10 border border-cyberTeal/15 rounded-lg flex flex-col space-y-4">
        <div className="text-xs text-cyberCyan font-bold tracking-wider uppercase border-b border-cyberTeal/10 pb-2">
          Diagnostic Telemetry
        </div>
        <MetricsDashboard
          ear={metrics.ear_avg}
          blinkCount={metrics.is_blink_active ? metrics.frame_id : 0}
          isBlinkActive={metrics.is_blink_active}
          gazeX={metrics.gaze_x}
          gazeY={metrics.gaze_y}
          gazeVelocity={metrics.gaze_velocity}
          isFixating={metrics.is_fixating}
          isSaccade={metrics.is_saccade}
        />
      </section>

      {/* Report Compilation Overlay Modal */}
      {reportCompiling && (
        <div className="fixed inset-0 z-50 bg-darkBg/95 backdrop-blur-md flex flex-col items-center justify-center font-mono space-y-4">
          <div className="w-10 h-10 border-4 border-cyberCyan/20 border-t-cyberCyan rounded-full animate-spin" />
          <h2 className="text-cyberCyan font-bold text-lg uppercase tracking-widest animate-pulse">Compiling Diagnostic Report</h2>
          <p className="text-xs text-cyberSilver max-w-sm text-center">
            Retrieving Snellen visual test scores, running eye behavior algorithms, and querying LangChain + Ollama local LLM diagnostics...
          </p>
        </div>
      )}
    </div>
  )
}

export default function TrackerWorkspace() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center font-mono p-4 space-y-4">
        <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
        <h2 className="text-emerald-400 font-bold text-lg uppercase tracking-widest animate-pulse">Initializing Test Workspace</h2>
        <p className="text-xs text-slate-400 max-w-sm text-center">
          Loading camera streams, gaze model calibration assets, and websocket channels...
        </p>
      </div>
    }>
      <TrackerWorkspaceContent />
    </Suspense>
  )
}
