"use client"

import React, { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Clock, Activity, FileText, CheckCircle2, RotateCcw, AlertTriangle, ShieldAlert, HeartPulse } from "lucide-react"

export default function ReportViewer() {
  const { id } = useParams()
  const router = useRouter()
  
  const [report, setReport] = useState<any | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchReport() {
      if (!id) return
      
      try {
        setLoading(true)
        setError(null)
        
        // Fetch session report from FastAPI (includes metadata, summary, tests, and NLP report)
        const res = await fetch(`http://localhost:8000/api/sessions/${id}/report`)
        
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error(`Session report '${id}' not found. Check UUID.`)
          }
          throw new Error("Failed to fetch session report from backend.")
        }

        const data = await res.json()
        setReport(data)
      } catch (err: any) {
        console.error(err)
        setError(err.message || "Failed to load report.")
      } finally {
        setLoading(false)
      }
    }

    fetchReport()
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen bg-darkBg flex flex-col items-center justify-center font-mono space-y-4">
        <div className="w-10 h-10 border-4 border-cyberCyan/20 border-t-cyberCyan rounded-full animate-spin" />
        <p className="text-sm text-cyberCyan tracking-widest uppercase animate-pulse">Compiling Clinical Diagnostics...</p>
      </div>
    )
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-darkBg flex flex-col items-center justify-center font-mono p-6">
        <div className="max-w-md w-full bg-darkPanel/20 border border-cyberPink/30 p-8 rounded-lg text-center flex flex-col items-center space-y-4">
          <AlertTriangle className="w-12 h-12 text-cyberPink animate-bounce" />
          <h2 className="text-lg font-bold text-cyberPink uppercase tracking-widest">Report Retrieval Failed</h2>
          <p className="text-xs text-cyberSilver/70">{error || "No data received."}</p>
          <button
            onClick={() => router.push("/")}
            className="px-6 py-2 border border-cyberCyan/40 text-cyberCyan hover:bg-cyberCyan hover:text-darkBg transition font-semibold text-xs rounded uppercase tracking-wider flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  const { metadata, summary, test_results, report: nlpReport } = report

  // Calculate session duration
  const startTime = new Date(metadata.started_at)
  const endTime = metadata.ended_at ? new Date(metadata.ended_at) : null
  const durationSec = endTime ? (endTime.getTime() - startTime.getTime()) / 1000 : 0
  
  const getFormattedDuration = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return `${m}m ${s}s`
  }

  const getEyeAcuity = (eye: string) => {
    const r = test_results.find((t: any) => t.eye_tested === eye)
    return r ? r.acuity_score : "Not Tested"
  }

  const getEyeAccuracy = (eye: string) => {
    const r = test_results.find((t: any) => t.eye_tested === eye)
    return r ? `${r.letters_correct}/${r.letters_shown}` : "N/A"
  }

  return (
    <div className="min-h-screen bg-darkBg p-6 space-y-6 font-mono relative text-white">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(102,252,241,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(102,252,241,0.01)_1px,transparent_1px)] bg-[size:30px_30px] pointer-events-none" />

      {/* Top Navigation */}
      <nav className="flex justify-between items-center pb-4 border-b border-cyberTeal/10">
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-2 text-xs text-cyberSilver hover:text-cyberCyan transition uppercase tracking-widest"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Workspace
        </button>
        <span className="text-[10px] text-cyberSilver/40 uppercase tracking-widest">Report Session: {id}</span>
      </nav>

      {/* Title block */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-widest text-cyberCyan flex items-center gap-2">
          <FileText className="w-6 h-6" /> INSIGHTEYE DIAGNOSTIC REPORT
        </h1>
        <p className="text-[10px] text-cyberSilver/50 uppercase">Structured eye health screening assessment</p>
      </div>

      {/* Summary Row: Acuity Scores & Metadata */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Visual Acuity Results */}
        <section className="lg:col-span-2 p-5 bg-darkPanel/20 border border-cyberTeal/15 rounded-lg relative flex flex-col justify-between">
          <div className="absolute top-0 left-4 -translate-y-1/2 px-2 bg-darkBg text-cyberCyan font-bold text-xs tracking-widest uppercase">
            VISUAL ACUITY METRICS
          </div>
          <div className="grid grid-cols-3 gap-4 text-center my-4">
            <div className="p-4 bg-black/30 border border-cyberTeal/10 rounded">
              <span className="text-[10px] text-cyberSilver/50 uppercase block mb-1">Right Eye</span>
              <span className="text-3xl font-extrabold text-cyberCyan font-mono block">
                {getEyeAcuity("RIGHT")}
              </span>
              <span className="text-[10px] text-cyberSilver/40 block mt-1 font-mono">
                Accuracy: {getEyeAccuracy("RIGHT")}
              </span>
            </div>
            <div className="p-4 bg-black/30 border border-cyberTeal/10 rounded">
              <span className="text-[10px] text-cyberSilver/50 uppercase block mb-1">Left Eye</span>
              <span className="text-3xl font-extrabold text-cyberCyan font-mono block">
                {getEyeAcuity("LEFT")}
              </span>
              <span className="text-[10px] text-cyberSilver/40 block mt-1 font-mono">
                Accuracy: {getEyeAccuracy("LEFT")}
              </span>
            </div>
            <div className="p-4 bg-black/30 border border-cyberTeal/10 rounded">
              <span className="text-[10px] text-cyberSilver/50 uppercase block mb-1">Both Eyes</span>
              <span className="text-3xl font-extrabold text-cyberCyan font-mono block">
                {getEyeAcuity("BOTH")}
              </span>
              <span className="text-[10px] text-cyberSilver/40 block mt-1 font-mono">
                Accuracy: {getEyeAccuracy("BOTH")}
              </span>
            </div>
          </div>
          <div className="text-[10px] text-cyberSilver/40 font-mono text-center">
            *Visual Acuity scores standardized to Snellen 6-meter system (e.g. 6/6 indicates normal vision at 6 meters).
          </div>
        </section>

        {/* Metadata Panel */}
        <section className="p-5 bg-darkPanel/20 border border-cyberTeal/15 rounded-lg flex flex-col justify-between relative">
          <div className="absolute top-0 left-4 -translate-y-1/2 px-2 bg-darkBg text-cyberCyan font-bold text-xs tracking-widest uppercase">
            METADATA
          </div>
          <div className="space-y-3 my-2 text-xs">
            <div className="flex justify-between border-b border-cyberTeal/5 pb-1">
              <span className="text-cyberSilver/50 uppercase">Client Device</span>
              <span className="text-white font-semibold">{metadata.client_name}</span>
            </div>
            <div className="flex justify-between border-b border-cyberTeal/5 pb-1">
              <span className="text-cyberSilver/50 uppercase">Tested At</span>
              <span className="text-white font-semibold">{startTime.toLocaleString()}</span>
            </div>
            <div className="flex justify-between border-b border-cyberTeal/5 pb-1">
              <span className="text-cyberSilver/50 uppercase">Active Time</span>
              <span className="text-cyberCyan font-semibold">{getFormattedDuration(durationSec)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-cyberSilver/50 uppercase">Total Frames</span>
              <span className="text-white font-semibold">{summary.total_frames} frames</span>
            </div>
          </div>
        </section>
      </div>

      {/* AI Clinical Screening NLP Report */}
      {nlpReport && (
        <section className="p-6 bg-darkPanel/20 border-2 border-cyberCyan/40 rounded-lg relative space-y-6 shadow-[0_0_20px_rgba(102,252,241,0.05)]">
          <div className="absolute top-0 left-6 -translate-y-1/2 px-3 py-0.5 bg-cyberCyan text-darkBg font-bold text-xs tracking-widest uppercase rounded">
            AI CLINICAL SCREENING REPORT (LangChain + Ollama)
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Assessment (2/3 width) */}
            <div className="lg:col-span-2 space-y-3">
              <h3 className="text-sm font-bold text-cyberCyan uppercase tracking-widest flex items-center gap-1.5">
                <HeartPulse className="w-4 h-4" /> Clinical Assessment
              </h3>
              <p className="text-xs text-cyberSilver/90 leading-relaxed font-sans border-l-2 border-cyberCyan/35 pl-4">
                {nlpReport.clinical_assessment}
              </p>

              <h3 className="text-sm font-bold text-cyberCyan uppercase tracking-widest flex items-center gap-1.5 pt-4">
                🩺 Ophthalmologist Recommendations
              </h3>
              <p className="text-xs text-cyberSilver/95 leading-relaxed font-sans border-l-2 border-cyberCyan/35 pl-4">
                {nlpReport.recommendations}
              </p>
            </div>

            {/* Risk Indicators (1/3 width) */}
            <div className="space-y-4 border-t lg:border-t-0 lg:border-l border-cyberTeal/10 pt-4 lg:pt-0 lg:pl-6">
              <h3 className="text-sm font-bold text-cyberCyan uppercase tracking-widest flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4" /> Behavioral Risks
              </h3>
              
              <div className="space-y-2.5 text-xs">
                {/* Risk 1: Low Acuity */}
                <div className="flex items-center justify-between p-2 rounded bg-black/20">
                  <span className="text-cyberSilver/80">Low Acuity Alert</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    nlpReport.risk_flags.low_acuity_detected 
                      ? "bg-cyberPink/15 text-cyberPink border border-cyberPink/30" 
                      : "bg-cyberGreen/10 text-cyberGreen border border-cyberGreen/30"
                  }`}>
                    {nlpReport.risk_flags.low_acuity_detected ? "TRIGGERED" : "NORMAL"}
                  </span>
                </div>

                {/* Risk 2: Squinting */}
                <div className="flex items-center justify-between p-2 rounded bg-black/20">
                  <span className="text-cyberSilver/80">Squinting Strain</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    nlpReport.risk_flags.excessive_squinting 
                      ? "bg-cyberPink/15 text-cyberPink border border-cyberPink/30 animate-pulse" 
                      : "bg-cyberGreen/10 text-cyberGreen border border-cyberGreen/30"
                  }`}>
                    {nlpReport.risk_flags.excessive_squinting ? "HIGH STRAIN" : "NORMAL"}
                  </span>
                </div>

                {/* Risk 3: Blinking */}
                <div className="flex items-center justify-between p-2 rounded bg-black/20">
                  <span className="text-cyberSilver/80">Excessive Blinking</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    nlpReport.risk_flags.high_blink_rate 
                      ? "bg-cyberPink/15 text-cyberPink border border-cyberPink/30" 
                      : "bg-cyberGreen/10 text-cyberGreen border border-cyberGreen/30"
                  }`}>
                    {nlpReport.risk_flags.high_blink_rate ? "WARNING" : "NORMAL"}
                  </span>
                </div>

                {/* Risk 4: Fixation */}
                <div className="flex items-center justify-between p-2 rounded bg-black/20">
                  <span className="text-cyberSilver/80">Fixation Instability</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    nlpReport.risk_flags.poor_fixation_stability 
                      ? "bg-cyberPink/15 text-cyberPink border border-cyberPink/30" 
                      : "bg-cyberGreen/10 text-cyberGreen border border-cyberGreen/30"
                  }`}>
                    {nlpReport.risk_flags.poor_fixation_stability ? "POOR FOCUS" : "STABLE"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Webcam Analytics Telemetry Summary */}
      <section className="p-5 bg-darkPanel/20 border border-cyberTeal/15 rounded-lg relative">
        <div className="absolute top-0 left-4 -translate-y-1/2 px-2 bg-darkBg text-cyberCyan font-bold text-xs tracking-widest uppercase">
          WEBCAM BIOMETRIC SUMMARY
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-center mt-2 text-xs">
          <div className="p-4 bg-black/20 border border-cyberTeal/5 rounded">
            <span className="text-cyberSilver/50 block mb-1 uppercase text-[10px]">Average Eyelid aperture (EAR)</span>
            <span className="text-xl font-bold text-white block">{summary.average_ear.toFixed(4)}</span>
            <span className="text-[10px] text-cyberSilver/40 block mt-1">Normal: 0.25 - 0.35</span>
          </div>
          <div className="p-4 bg-black/20 border border-cyberTeal/5 rounded">
            <span className="text-cyberSilver/50 block mb-1 uppercase text-[10px]">Blink count (Duration)</span>
            <span className="text-xl font-bold text-white block">
              {summary.total_blinks} <span className="text-xs text-cyberSilver/60">({summary.average_blink_duration_sec.toFixed(2)}s)</span>
            </span>
            <span className="text-[10px] text-cyberSilver/40 block mt-1">Extrapolated: {summary.blink_frequency_per_min.toFixed(1)}/min</span>
          </div>
          <div className="p-4 bg-black/20 border border-cyberTeal/5 rounded">
            <span className="text-cyberSilver/50 block mb-1 uppercase text-[10px]">Fixation stability</span>
            <span className="text-xl font-bold text-white block">{(summary.fixation_ratio * 100).toFixed(1)}%</span>
            <span className="text-[10px] text-cyberSilver/40 block mt-1">Time spent in stable focus</span>
          </div>
          <div className="p-4 bg-black/20 border border-cyberTeal/5 rounded">
            <span className="text-cyberSilver/50 block mb-1 uppercase text-[10px]">Saccadic movements</span>
            <span className="text-xl font-bold text-white block">{(summary.saccade_ratio * 100).toFixed(1)}%</span>
            <span className="text-[10px] text-cyberSilver/40 block mt-1">Rapid visual tracking shifts</span>
          </div>
        </div>
      </section>
    </div>
  )
}
