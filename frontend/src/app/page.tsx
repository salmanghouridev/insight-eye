"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { Eye, Play, FileText, ArrowRight, Sparkles } from "lucide-react"

export default function Home() {
  const router = useRouter()
  const [clientName, setClientName] = useState<string>("Webcam Tracker")
  const [reportId, setReportId] = useState<string>("")
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const handleStartSession = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    
    try {
      // POST request to FastAPI backend to start session
      const res = await fetch("http://localhost:8000/api/sessions/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_name: clientName })
      })

      if (!res.ok) {
        throw new Error("Could not connect to FastAPI server. Ensure backend is running.")
      }

      const data = await res.json()
      router.push(`/tracker?sessionId=${data.session_id}&clientName=${encodeURIComponent(clientName)}`)
    } catch (err: any) {
      console.error(err)
      setError(err.message || "Failed to initialize session.")
    } finally {
      setLoading(false)
    }
  }

  const handleViewReport = (e: React.FormEvent) => {
    e.preventDefault()
    if (!reportId.trim()) return
    router.push(`/reports/${reportId.trim()}`)
  }

  return (
    <main className="min-h-screen bg-darkBg flex flex-col items-center justify-center p-6 relative font-mono">
      {/* Background grids */}
      <div className="absolute inset-0 border-[20px] border-cyberCyan/5 pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(102,252,241,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(102,252,241,0.02)_1px,transparent_1px)] bg-[size:30px_30px] pointer-events-none" />

      <div className="max-w-md w-full bg-darkPanel/30 backdrop-blur-md border border-cyberTeal/20 p-8 rounded-lg shadow-2xl relative">
        <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-cyberCyan" />
        <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-cyberCyan" />
        <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-cyberCyan" />
        <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-cyberCyan" />

        {/* Logo Banner */}
        <div className="flex flex-col items-center text-center space-y-2 mb-8">
          <div className="w-12 h-12 rounded-full border border-cyberCyan flex items-center justify-center bg-cyberCyan/5 shadow-[0_0_15px_rgba(102,252,241,0.1)]">
            <Eye className="w-6 h-6 text-cyberCyan animate-pulse" />
          </div>
          <h1 className="text-2xl font-bold tracking-widest text-cyberCyan">
            INSIGHTEYE HUB
          </h1>
          <p className="text-[10px] text-cyberSilver/60 uppercase tracking-widest">
            Eye & Iris Landmark Tracking Workspace
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-cyberPink/15 border border-cyberPink/30 text-cyberPink text-xs rounded text-center">
            {error}
          </div>
        )}

        <div className="space-y-6">
          {/* Start New Session */}
          <form onSubmit={handleStartSession} className="space-y-3">
            <h2 className="text-xs uppercase text-cyberCyan tracking-widest font-bold border-b border-cyberTeal/20 pb-1.5 flex items-center gap-2">
              <Play className="w-3.5 h-3.5" /> Start Live Tracker
            </h2>
            <div className="space-y-1.5">
              <label className="text-[10px] text-cyberSilver/50 uppercase">Client Device Name</label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full bg-darkBg border border-cyberTeal/30 text-white px-3 py-2 text-sm font-mono focus:outline-none focus:border-cyberCyan transition rounded"
                placeholder="Tracker identifier..."
                required
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-cyberCyan text-darkBg hover:bg-white transition font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 rounded shadow-[0_0_15px_rgba(102,252,241,0.2)] disabled:opacity-50"
            >
              {loading ? "Initializing..." : "Launch Camera Pipeline"}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* View Session Report */}
          <form onSubmit={handleViewReport} className="space-y-3 pt-4 border-t border-cyberTeal/10">
            <h2 className="text-xs uppercase text-cyberSilver/70 tracking-widest font-bold pb-1.5 flex items-center gap-2">
              <FileText className="w-3.5 h-3.5" /> Retrieve Metrics
            </h2>
            <div className="space-y-1.5">
              <label className="text-[10px] text-cyberSilver/50 uppercase">Report Session UUID</label>
              <input
                type="text"
                value={reportId}
                onChange={(e) => setReportId(e.target.value)}
                className="w-full bg-darkBg border border-cyberTeal/30 text-white px-3 py-2 text-sm font-mono focus:outline-none focus:border-cyberCyan transition rounded"
                placeholder="Enter session UUID..."
                required
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 border border-cyberSilver/30 hover:border-cyberSilver text-cyberSilver hover:text-white transition uppercase tracking-widest text-xs flex items-center justify-center gap-2 rounded"
            >
              View Gaze Summary
            </button>
          </form>

          {/* SVG Optotype Distortion Lab */}
          <div className="pt-4 border-t border-cyberTeal/10">
            <button
              onClick={() => router.push("/optotypes")}
              className="w-full py-2.5 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 transition border border-emerald-500/30 uppercase tracking-widest text-xs font-bold rounded flex items-center justify-center gap-1.5 shadow-[0_0_10px_rgba(16,185,129,0.05)]"
            >
              <Sparkles className="w-3.5 h-3.5 animate-pulse" /> Optotype Distortion Lab
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}
