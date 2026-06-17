"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Settings, RefreshCw, Sparkles, AlertCircle } from "lucide-react"
import {
  generateOptotype,
  generateChartRow,
  generateTestChart,
  PRESETS,
  PresetName,
  DistortionOptions
} from "@/utils/optotypeGenerator"

export default function OptotypePlayground() {
  const router = useRouter()

  // Mode: "single" | "row" | "chart"
  const [mode, setMode] = useState<"single" | "row" | "chart">("single")

  // Target inputs
  const [letter, setLetter] = useState<string>("C")
  const [lettersRow, setLettersRow] = useState<string>("CDHKN")
  const [levelsCount, setLevelsCount] = useState<number>(6)
  const [seed, setSeed] = useState<number>(42)

  // Distortion options state
  const [options, setOptions] = useState<DistortionOptions>({
    contrast: 1.0,
    crowding: 0.0,
    strokeErosion: 0.0,
    microWarp: 0.0,
    strokeJitter: 0.0,
    segmentDropout: 0,
    gaussianBlur: 0.0,
    visualNoise: 0.0,
    temporalFlashing: 0,
    seed: 42
  })

  // Preset tracking
  const [activePreset, setActivePreset] = useState<PresetName | "custom">("custom")

  // Output outputs
  const [outputSvg, setOutputSvg] = useState<string>("")
  const [outputMeta, setOutputMeta] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<"preview" | "code" | "meta">("preview")

  // Generate when inputs/options change
  useEffect(() => {
    let result: { svg: string; metadata: any }

    if (mode === "single") {
      result = generateOptotype(letter, { ...options, seed })
    } else if (mode === "row") {
      result = generateChartRow(lettersRow, { ...options, seed })
    } else {
      result = generateTestChart(levelsCount, seed)
    }

    setOutputSvg(result.svg)
    setOutputMeta(result.metadata)
  }, [mode, letter, lettersRow, levelsCount, options, seed])

  const handleApplyPreset = (name: PresetName) => {
    const preset = PRESETS[name]
    setOptions({
      contrast: preset.contrast,
      crowding: preset.crowding,
      strokeErosion: preset.strokeErosion,
      microWarp: preset.microWarp,
      strokeJitter: preset.strokeJitter,
      segmentDropout: preset.segmentDropout,
      gaussianBlur: preset.gaussianBlur,
      visualNoise: preset.visualNoise,
      temporalFlashing: preset.temporalFlashing,
      seed: preset.seed
    })
    setSeed(preset.seed || 42)
    setActivePreset(name)
  }

  const handleOptionChange = (key: keyof DistortionOptions, val: number) => {
    setOptions((prev) => ({ ...prev, [key]: val }))
    setActivePreset("custom")
  }

  const handleRandomizeSeed = () => {
    const newSeed = Math.floor(Math.random() * 100000)
    setSeed(newSeed)
    setOptions((prev) => ({ ...prev, seed: newSeed }))
    setActivePreset("custom")
  }

  const SLOAN_LETTERS = ["C", "D", "H", "K", "N", "O", "R", "S", "V", "Z"]

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 font-mono relative">
      {/* Background grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(16,185,129,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.015)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none" />

      <div className="max-w-6xl mx-auto space-y-6 relative">
        {/* Navigation & Header */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-emerald-500/10">
          <div>
            <button
              onClick={() => router.push("/")}
              className="flex items-center gap-2 text-xs text-slate-400 hover:text-emerald-400 transition uppercase tracking-widest mb-2"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Dashboard
            </button>
            <h1 className="text-2xl font-bold tracking-widest text-emerald-400 flex items-center gap-2">
              <Sparkles className="w-6 h-6 animate-pulse" /> OPTOTYPE DISTORTION LAB
            </h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">
              Controlled Acuity Distortion Factors (Non-Destructive Legibility)
            </p>
          </div>
          
          <div className="flex gap-2 bg-slate-900 border border-slate-800 p-1 rounded">
            {(["single", "row", "chart"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-3 py-1.5 rounded text-xs uppercase tracking-widest transition ${
                  mode === m
                    ? "bg-emerald-500 text-slate-950 font-bold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT: Controls Panel (5 cols) */}
          <section className="lg:col-span-5 bg-slate-900/50 border border-slate-800 rounded-lg p-5 space-y-6">
            <h2 className="text-xs uppercase text-emerald-400 tracking-widest font-bold border-b border-slate-800 pb-2 flex items-center gap-1.5">
              <Settings className="w-3.5 h-3.5" /> Distortion Factors
            </h2>

            {/* Presets Row */}
            <div className="space-y-2">
              <label className="text-[10px] text-slate-500 uppercase block">Standard Presets</label>
              <div className="grid grid-cols-3 gap-2">
                {(["mild", "moderate", "hard"] as PresetName[]).map((name) => (
                  <button
                    key={name}
                    onClick={() => handleApplyPreset(name)}
                    className={`py-1 text-xs uppercase rounded border transition ${
                      activePreset === name
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 font-bold"
                        : "bg-slate-950/40 text-slate-400 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>

            {/* Target Settings */}
            <div className="space-y-4 pt-2 border-t border-slate-800">
              <label className="text-[10px] text-slate-500 uppercase block">Test Configuration</label>

              {mode === "single" && (
                <div className="space-y-2">
                  <span className="text-xs text-slate-300 block">Sloan Letter:</span>
                  <div className="grid grid-cols-5 gap-1.5">
                    {SLOAN_LETTERS.map((l) => (
                      <button
                        key={l}
                        onClick={() => setLetter(l)}
                        className={`py-1 text-sm font-bold rounded border transition ${
                          letter === l
                            ? "bg-emerald-500 text-slate-950 border-emerald-500"
                            : "bg-slate-950/40 text-slate-400 border-slate-800 hover:border-slate-700"
                        }`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {mode === "row" && (
                <div className="space-y-1.5">
                  <span className="text-xs text-slate-300 block">Sloan Row (Letters):</span>
                  <input
                    type="text"
                    value={lettersRow}
                    onChange={(e) => setLettersRow(e.target.value.toUpperCase().replace(/[^CDHKNOSVZR]/g, ""))}
                    className="w-full bg-slate-950 border border-slate-800 text-white px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 rounded font-mono"
                    maxLength={10}
                    placeholder="E.g. CDHKN"
                  />
                  <span className="text-[9px] text-slate-500 block">Sloan Set: C, D, H, K, N, O, R, S, V, Z</span>
                </div>
              )}

              {mode === "chart" && (
                <div className="space-y-1.5">
                  <span className="text-xs text-slate-300 block">Chart Acuity Rows:</span>
                  <input
                    type="number"
                    min={1}
                    max={6}
                    value={levelsCount}
                    onChange={(e) => setLevelsCount(Math.max(1, Math.min(6, parseInt(e.target.value) || 1)))}
                    className="w-full bg-slate-950 border border-slate-800 text-white px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 rounded font-mono"
                  />
                  <span className="text-[9px] text-slate-500 block">Dynamic vertical stack: scales down sizes and ramps up distortion.</span>
                </div>
              )}

              {/* Seed */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-300">Random Seed (LCG):</span>
                  <button
                    onClick={handleRandomizeSeed}
                    className="flex items-center gap-1 text-[10px] text-emerald-400 hover:text-white transition uppercase"
                  >
                    <RefreshCw className="w-2.5 h-2.5" /> Randomize
                  </button>
                </div>
                <input
                  type="number"
                  value={seed}
                  onChange={(e) => {
                    const s = parseInt(e.target.value) || 0;
                    setSeed(s);
                    setOptions((prev) => ({ ...prev, seed: s }));
                    setActivePreset("custom");
                  }}
                  className="w-full bg-slate-950 border border-slate-800 text-white px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 rounded font-mono"
                />
              </div>
            </div>

            {/* Pipeline Sliders */}
            <div className={`space-y-5 pt-4 border-t border-slate-800 ${mode === "chart" ? "opacity-30 pointer-events-none" : ""}`}>
              <div className="flex justify-between items-center">
                <label className="text-[10px] text-slate-500 uppercase">Controlled Factors</label>
                {mode === "chart" && <span className="text-[9.5px] text-amber-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Auto-ramped in chart mode</span>}
              </div>

              {/* 1. Low Contrast */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Low Contrast</span>
                  <span className="text-emerald-400 font-mono">{(options.contrast !== undefined ? (1 - options.contrast) * 100 : 0).toFixed(0)}% reduced</span>
                </div>
                <input
                  type="range"
                  min="0.3"
                  max="1.0"
                  step="0.05"
                  value={options.contrast}
                  onChange={(e) => handleOptionChange("contrast", parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-[9px] text-slate-500 block">Reduces letter density from black toward white.</span>
              </div>

              {/* 2. Crowding */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Crowding (Spacing)</span>
                  <span className="text-emerald-400 font-mono">{(options.crowding !== undefined ? options.crowding * 100 : 0).toFixed(0)}% compressed</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.05"
                  value={options.crowding}
                  disabled={mode === "single"}
                  onChange={(e) => handleOptionChange("crowding", parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer disabled:opacity-20"
                />
                <span className="text-[9px] text-slate-500 block">Reduces padding between optotypes (increases visual confusion).</span>
              </div>

              {/* 3. Stroke Erosion */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Stroke Erosion</span>
                  <span className="text-emerald-400 font-mono">{(options.strokeErosion !== undefined ? options.strokeErosion * 100 : 0).toFixed(0)}% shaved</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="0.15"
                  step="0.01"
                  value={options.strokeErosion}
                  onChange={(e) => handleOptionChange("strokeErosion", parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-[9px] text-slate-500 block">Shaves physical stroke thickness along edges.</span>
              </div>

              {/* 4. Micro-Warp */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Micro-Warp</span>
                  <span className="text-emerald-400 font-mono">{(options.microWarp !== undefined ? options.microWarp * 100 : 0).toFixed(0)}% bent</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="0.20"
                  step="0.01"
                  value={options.microWarp}
                  onChange={(e) => handleOptionChange("microWarp", parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-[9px] text-slate-500 block">Bends vertical and curved segments using low-frequency noise.</span>
              </div>

              {/* 5. Edge Jitter */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Edge Jitter</span>
                  <span className="text-emerald-400 font-mono">{(options.strokeJitter !== undefined ? options.strokeJitter * 100 : 0).toFixed(0)}% roughness</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="0.20"
                  step="0.01"
                  value={options.strokeJitter}
                  onChange={(e) => handleOptionChange("strokeJitter", parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-[9px] text-slate-500 block">Adds wobbly border irregularity using high-frequency noise.</span>
              </div>

              {/* 6. Segment Dropout */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Segment Dropout</span>
                  <span className="text-emerald-400 font-mono">{options.segmentDropout} cuts</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="3"
                  step="1"
                  value={options.segmentDropout}
                  onChange={(e) => handleOptionChange("segmentDropout", parseInt(e.target.value))}
                  className="w-full accent-emerald-500 h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-[9px] text-slate-500 block">Removes micro parts of paths using transparency masks.</span>
              </div>

              {/* 7. Gaussian Blur */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Gaussian Blur</span>
                  <span className="text-emerald-400 font-mono">{options.gaussianBlur?.toFixed(2)}px</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="2.0"
                  step="0.1"
                  value={options.gaussianBlur}
                  onChange={(e) => handleOptionChange("gaussianBlur", parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-[9px] text-slate-500 block">Simulates mild optical refocusing blur.</span>
              </div>

              {/* 8. Visual Noise */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Visual Background Noise</span>
                  <span className="text-emerald-400 font-mono">{(options.visualNoise !== undefined ? options.visualNoise * 100 : 0).toFixed(0)}% texture</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="0.25"
                  step="0.01"
                  value={options.visualNoise}
                  onChange={(e) => handleOptionChange("visualNoise", parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-[9px] text-slate-500 block">Adds faint grainy background texture overlay to letters.</span>
              </div>

              {/* 9. Temporal Flashing */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Temporal Flashing</span>
                  <span className="text-emerald-400 font-mono">{options.temporalFlashing === 0 ? "STATIC" : `${options.temporalFlashing} Hz`}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="0.5"
                  value={options.temporalFlashing}
                  onChange={(e) => handleOptionChange("temporalFlashing", parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-[9px] text-slate-500 block">Flashes optotype opacity at a specific frequency (0 for static).</span>
              </div>
            </div>
          </section>

          {/* RIGHT: Preview & Outputs (7 cols) */}
          <section className="lg:col-span-7 space-y-4">
            {/* Tabs Selector */}
            <div className="flex justify-between items-center border-b border-slate-800 pb-1.5">
              <div className="flex gap-2">
                {(["preview", "code", "meta"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-1 text-xs uppercase tracking-wider border-b-2 transition ${
                      activeTab === tab
                        ? "border-emerald-400 text-emerald-400 font-bold"
                        : "border-transparent text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {tab === "preview" ? "🔍 Visual Preview" : tab === "code" ? "⚡ SVG Source" : "📋 Metadata"}
                  </button>
                ))}
              </div>
              <span className="text-[10px] text-slate-500 uppercase">Interactive Output</span>
            </div>

            {/* Screen Container */}
            <div className="bg-slate-950 border border-slate-800 rounded-lg min-h-[380px] p-6 flex flex-col items-center justify-center relative overflow-hidden">
              <div className="absolute top-3 left-3 text-[9px] text-slate-500 uppercase tracking-widest">
                Render Space ({mode === "single" ? "100x100 Box" : mode === "row" ? "Flexible Row" : "Stacked Chart"})
              </div>

              {activeTab === "preview" && (
                <div className="w-full flex items-center justify-center min-h-[300px]">
                  {mode === "single" ? (
                    <div 
                      className="w-48 h-48 bg-white border-2 border-slate-800 shadow-xl rounded flex items-center justify-center overflow-hidden"
                      dangerouslySetInnerHTML={{ __html: outputSvg }}
                    />
                  ) : mode === "row" ? (
                    <div 
                      className="w-full max-w-lg bg-white p-4 shadow-xl border border-slate-800 rounded overflow-hidden"
                      dangerouslySetInnerHTML={{ __html: outputSvg }}
                    />
                  ) : (
                    <div 
                      className="w-full max-w-sm bg-white p-6 shadow-xl border border-slate-800 rounded max-h-[450px] overflow-y-auto overflow-x-hidden"
                      dangerouslySetInnerHTML={{ __html: outputSvg }}
                    />
                  )}
                </div>
              )}

              {activeTab === "code" && (
                <div className="w-full text-[11px] text-emerald-300 font-mono bg-black/40 p-4 rounded border border-slate-900 h-[380px] overflow-y-auto whitespace-pre-wrap select-all">
                  {outputSvg}
                </div>
              )}

              {activeTab === "meta" && (
                <pre className="w-full text-[11px] text-slate-300 font-mono bg-black/40 p-4 rounded border border-slate-900 h-[380px] overflow-y-auto select-all">
                  {JSON.stringify(outputMeta, null, 2)}
                </pre>
              )}
            </div>

            {/* Info Box */}
            <div className="p-4 bg-slate-900/20 border border-slate-800 rounded text-[11px] text-slate-400 space-y-1">
              <span className="font-bold text-slate-300 block uppercase">Controlled Distortion Metrics:</span>
              <ul className="list-disc pl-4 space-y-1">
                <li><strong className="text-emerald-400">Crowding:</strong> Crowded visual rows test foveal lateral masking in macular screening.</li>
                <li><strong className="text-emerald-400">Micro-Warp:</strong> Evaluates metamorphopsia (retinal distortion checks) via bends.</li>
                <li><strong className="text-emerald-400">Visual Noise:</strong> Grain checks signal-to-noise thresholds for visual processing.</li>
                <li><strong className="text-emerald-400">Temporal Flashing:</strong> Pulsed stimuli evaluates critical flicker fusion limits.</li>
              </ul>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
