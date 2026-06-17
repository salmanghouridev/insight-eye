import React, { useState, useEffect, useCallback } from "react"
import { Shield, Sparkles, Check, AlertCircle, Play, Eye } from "lucide-react"

// Snellen optotype characters standard pool
const OPTOTYPES = ["C", "D", "E", "F", "L", "O", "P", "T", "Z"]

interface TestScore {
  eye: "LEFT" | "RIGHT" | "BOTH"
  acuity: string
  correct: number
  total: number
}

interface SnellenTestProps {
  sessionId: string
  userDistanceCm: number
  isDistanceCorrect: boolean
  onTestFinished: (scores: Record<string, string>) => void
}

// Snellen steps mapping (standard 6-meter acuity lines)
const SNELLEN_LINES = [
  { label: "6/60", multiplier: 10.0, letterCount: 1 }, // Line 1
  { label: "6/30", multiplier: 5.0, letterCount: 3 },  // Line 2
  { label: "6/20", multiplier: 3.33, letterCount: 4 }, // Line 3
  { label: "6/12", multiplier: 2.0, letterCount: 5 },  // Line 4
  { label: "6/9", multiplier: 1.5, letterCount: 5 },   // Line 5
  { label: "6/6", multiplier: 1.0, letterCount: 5 },   // Line 6
]

export function SnellenTest({ sessionId, userDistanceCm, isDistanceCorrect, onTestFinished }: SnellenTestProps) {
  const [step, setStep] = useState<"instructions" | "calibrate" | "test" | "finished">("instructions")
  
  // Calibration: Credit Card width in pixels (85.6mm physical width)
  const [cardWidthPx, setCardWidthPx] = useState<number>(250)
  const [pixelsPerMm, setPixelsPerMm] = useState<number>(2.92) // default approximation

  // Test states
  const [eyeSequence, setEyeSequence] = useState<("RIGHT" | "LEFT" | "BOTH")[]>(["RIGHT", "LEFT", "BOTH"])
  const [currentEyeIdx, setCurrentEyeIdx] = useState<number>(0)
  const [currentLineIdx, setCurrentLineIdx] = useState<number>(0)
  
  // Letter presentation states
  const [currentLetters, setCurrentLetters] = useState<string[]>([])
  const [activeLetterIdx, setActiveLetterIdx] = useState<number>(0)
  const [answers, setAnswers] = useState<boolean[]>([])
  
  // Results tracker
  const [results, setResults] = useState<Record<string, string>>({
    RIGHT: "Pending",
    LEFT: "Pending",
    BOTH: "Pending"
  })

  const currentEye = eyeSequence[currentEyeIdx]
  const currentLine = SNELLEN_LINES[currentLineIdx]

  // Generate randomized letter sequences
  const generateLetters = useCallback((count: number) => {
    const list: string[] = []
    for (let i = 0; i < count; i++) {
      const idx = Math.floor(Math.random() * OPTOTYPES.length)
      list.push(OPTOTYPES[idx])
    }
    return list
  }, [])

  // Start visual acuity test
  const startTest = () => {
    setPixelsPerMm(cardWidthPx / 85.6)
    setCurrentEyeIdx(0)
    setCurrentLineIdx(0)
    setActiveLetterIdx(0)
    const initialLetters = generateLetters(SNELLEN_LINES[0].letterCount)
    setCurrentLetters(initialLetters)
    setAnswers([])
    setStep("test")
  }

  // Answer scoring handler
  const handleAnswer = async (inputLetter: string) => {
    const targetLetter = currentLetters[activeLetterIdx]
    const isCorrect = inputLetter.toUpperCase() === targetLetter

    const updatedAnswers = [...answers, isCorrect]
    setAnswers(updatedAnswers)

    // Log the answer to backend via REST API (optional, can be uploaded at the end)

    if (activeLetterIdx < currentLetters.length - 1) {
      setActiveLetterIdx(activeLetterIdx + 1)
    } else {
      // Row is finished, calculate correct percentage
      const correctCount = updatedAnswers.filter(Boolean).length
      const successRate = correctCount / currentLetters.length

      if (successRate >= 0.60) {
        // Passed this row! Keep track of highest acuity score
        const newResults = { ...results, [currentEye]: currentLine.label }
        setResults(newResults)

        if (currentLineIdx < SNELLEN_LINES.length - 1) {
          // Advance to next smaller line
          const nextIdx = currentLineIdx + 1
          setCurrentLineIdx(nextIdx)
          setActiveLetterIdx(0)
          setAnswers([])
          setCurrentLetters(generateLetters(SNELLEN_LINES[nextIdx].letterCount))
        } else {
          // Passed 6/6! Move to next eye or complete
          await advanceEyeSequence(newResults)
        }
      } else {
        // Failed this row. Visual acuity is the previous successfully passed row
        const finalAcuity = currentLineIdx === 0 ? "Below 6/60" : SNELLEN_LINES[currentLineIdx - 1].label
        const newResults = { ...results, [currentEye]: finalAcuity }
        setResults(newResults)
        
        await advanceEyeSequence(newResults)
      }
    }
  }

  const advanceEyeSequence = async (updatedResults: Record<string, string>) => {
    // Submit test results to database
    try {
      const currentScore = updatedResults[currentEye]
      const correctCount = answers.filter(Boolean).length
      
      await fetch(`http://localhost:8000/api/sessions/${sessionId}/test-result`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eye_tested: currentEye,
          acuity_score: currentScore,
          letters_shown: currentLetters.length,
          letters_correct: correctCount
        })
      })
    } catch (err) {
      console.error("[Snellen] Failed to persist eye result:", err)
    }

    if (currentEyeIdx < eyeSequence.length - 1) {
      // Switch to next eye in sequence and reset rows to largest (6/60)
      const nextEyeIdx = currentEyeIdx + 1
      setCurrentEyeIdx(nextEyeIdx)
      setCurrentLineIdx(0)
      setActiveLetterIdx(0)
      setAnswers([])
      setCurrentLetters(generateLetters(SNELLEN_LINES[0].letterCount))
    } else {
      // Retest complete!
      setStep("finished")
      onTestFinished(updatedResults)
    }
  }

  // Calculate pixel height for current Snellen optotype row
  // Standard 6/6 at 1.5m subtends 5 arcminutes: physical height = 2.18mm
  const getOptotypePixelSize = () => {
    const baseHeightMm = 2.1817
    const currentMultiplier = currentLine.multiplier
    const physicalHeightMm = baseHeightMm * currentMultiplier
    return physicalHeightMm * pixelsPerMm
  }

  // Capture keyboard key presses
  useEffect(() => {
    if (step !== "test") return

    const handleKeyDown = (e: KeyboardEvent) => {
      const char = e.key.toUpperCase()
      if (OPTOTYPES.includes(char)) {
        e.preventDefault()
        handleAnswer(char)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [step, currentLetters, activeLetterIdx, answers, currentEyeIdx, currentLineIdx])

  return (
    <div className="w-full h-full min-h-[420px] bg-darkPanel/30 border border-cyberTeal/15 p-6 rounded-lg flex flex-col relative font-mono text-white">
      {/* Corner brackets */}
      <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-cyberCyan" />
      <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-cyberCyan" />
      <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-cyberCyan" />
      <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-cyberCyan" />

      {/* STEP 1: General setup instructions */}
      {step === "instructions" && (
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-5 p-4">
          <div className="w-12 h-12 rounded-full bg-cyberCyan/15 border border-cyberCyan flex items-center justify-center text-cyberCyan">
            <Eye className="w-6 h-6" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-bold tracking-widest text-cyberCyan">VISUAL ACUITY SCREENING</h2>
            <p className="text-xs text-cyberSilver/80 max-w-md">
              This digital Snellen test measures visual sharpness. Before starting, ensure:
            </p>
          </div>
          <ul className="text-left text-xs text-cyberSilver/70 space-y-2 max-w-sm">
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-cyberGreen shrink-0 mt-0.5" />
              <span>Calibrate your screen size (DPI check).</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-cyberGreen shrink-0 mt-0.5" />
              <span>Stand exactly <strong>1.5 meters (150cm)</strong> away from the screen.</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-cyberGreen shrink-0 mt-0.5" />
              <span>Test sequence: Cover left eye, then right eye, then test both.</span>
            </li>
          </ul>
          <button
            onClick={() => setStep("calibrate")}
            className="px-6 py-2 bg-cyberCyan text-darkBg hover:bg-white font-bold uppercase tracking-wider text-xs rounded transition"
          >
            Go to Calibration
          </button>
        </div>
      )}

      {/* STEP 2: Screen Calibration using a credit card slider */}
      {step === "calibrate" && (
        <div className="flex-1 flex flex-col items-center justify-center space-y-6 p-4">
          <div className="text-center space-y-2">
            <h2 className="text-sm font-bold tracking-widest text-cyberCyan uppercase">Step 1: Screen Size Calibration</h2>
            <p className="text-xs text-cyberSilver/70 max-w-md">
              Place a physical credit card or ID card against the screen rectangle. Adjust the slider until the box matches the card's width.
            </p>
          </div>

          {/* Calibrator credit card outline box */}
          <div 
            className="border-2 border-dashed border-cyberCyan bg-cyberCyan/5 rounded flex flex-col items-center justify-center relative shadow-[0_0_15px_rgba(102,252,241,0.05)]"
            style={{ width: `${cardWidthPx}px`, height: `${cardWidthPx / 1.586}px` }}
          >
            <div className="w-8 h-8 rounded bg-cyberCyan/10 border border-cyberCyan/30 flex items-center justify-center text-cyberCyan text-xs font-bold font-mono">
              CC
            </div>
            <span className="text-[10px] text-cyberCyan/60 absolute bottom-2 font-mono">85.60 mm width</span>
          </div>

          <div className="w-full max-w-xs space-y-2">
            <input
              type="range"
              min="150"
              max="450"
              value={cardWidthPx}
              onChange={(e) => setCardWidthPx(parseInt(e.target.value))}
              className="w-full accent-cyberCyan cursor-pointer bg-darkPanel h-1 rounded"
            />
            <div className="flex justify-between text-[10px] text-cyberSilver/50">
              <span>Zoom Out</span>
              <span className="text-cyberCyan font-bold">{cardWidthPx} px</span>
              <span>Zoom In</span>
            </div>
          </div>

          <button
            onClick={startTest}
            className="px-6 py-2.5 bg-cyberCyan text-darkBg hover:bg-white font-bold uppercase tracking-wider text-xs rounded transition flex items-center gap-1.5"
          >
            <Play className="w-4 h-4 fill-current" /> Confirm & Start Test
          </button>
        </div>
      )}

      {/* STEP 3: Active visual testing layout */}
      {step === "test" && (
        <div className="flex-1 flex flex-col">
          {/* Active Status header */}
          <div className="flex justify-between items-center border-b border-cyberTeal/15 pb-3 mb-6">
            <div className="space-y-1">
              <span className="text-[10px] text-cyberSilver/50 uppercase block">ACTIVE EYE TARGET</span>
              <span className="text-sm font-bold text-cyberCyan flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-cyberPink animate-pulse" />
                {currentEye} EYE ONLY
              </span>
            </div>
            <div className="text-right space-y-1">
              <span className="text-[10px] text-cyberSilver/50 uppercase block">TEST DISTANCE</span>
              <span className={`text-xs font-bold font-mono ${isDistanceCorrect ? "text-cyberGreen" : "text-cyberPink"}`}>
                {userDistanceCm.toFixed(0)} cm ({isDistanceCorrect ? "Correct" : "Adjust Distance"})
              </span>
            </div>
          </div>

          {/* Main Visual Presentation Chamber */}
          <div className="flex-1 flex flex-col items-center justify-center min-h-[180px] bg-black/40 border border-cyberTeal/5 rounded relative">
            
            {/* Warning block if user steps outside distance threshold */}
            {!isDistanceCorrect && (
              <div className="absolute inset-0 bg-darkBg/95 backdrop-blur-sm z-20 flex flex-col items-center justify-center p-4 text-center font-mono">
                <AlertCircle className="w-10 h-10 text-cyberPink animate-bounce mb-3" />
                <h3 className="text-cyberPink font-bold text-sm uppercase mb-1">Position Warning</h3>
                <p className="text-xs text-cyberSilver max-w-xs mb-3">
                  Please adjust your posture. Stand exactly <strong>1.5m (150cm)</strong> away and center your face in the camera.
                </p>
                <div className="text-xs text-cyberCyan font-bold">
                  Current: {userDistanceCm.toFixed(0)}cm / Target: 150cm
                </div>
              </div>
            )}

            {/* Rendered Optotype (Letter) */}
            <div 
              className="font-bold flex items-center justify-center select-none text-white tracking-widest leading-none font-sans"
              style={{ 
                fontSize: `${getOptotypePixelSize()}px`, 
                height: `${getOptotypePixelSize()}px`
              }}
            >
              {currentLetters[activeLetterIdx]}
            </div>
          </div>

          {/* Letter indicator dots */}
          <div className="flex justify-center gap-1.5 my-4">
            {currentLetters.map((_, idx) => (
              <span 
                key={idx}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  idx === activeLetterIdx ? "bg-cyberCyan" : (idx < activeLetterIdx ? "bg-cyberTeal" : "bg-darkPanel")
                }`}
              />
            ))}
          </div>

          {/* Interactive Multiple Choice Buttons (keyboard capture is active simultaneously) */}
          <div className="space-y-3">
            <span className="text-[10px] text-cyberSilver/40 uppercase block text-center">
              Select or Type letter using keyboard:
            </span>
            <div className="grid grid-cols-3 sm:grid-cols-9 gap-2">
              {OPTOTYPES.map((char) => (
                <button
                  key={char}
                  onClick={() => handleAnswer(char)}
                  className="py-2.5 bg-darkPanel/50 border border-cyberTeal/20 hover:border-cyberCyan text-white font-bold hover:bg-cyberCyan/10 transition text-sm rounded font-mono"
                >
                  {char}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: Test complete placeholder */}
      {step === "finished" && (
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 p-4">
          <div className="w-12 h-12 rounded-full bg-cyberGreen/10 border border-cyberGreen flex items-center justify-center text-cyberGreen">
            <Check className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold tracking-widest text-cyberGreen">SCREENING COMPLETE</h2>
            <p className="text-xs text-cyberSilver/70">Visual acuity scores calculated successfully.</p>
          </div>
          
          <div className="w-full max-w-xs bg-darkPanel/20 border border-cyberTeal/20 p-4 rounded text-left space-y-2 text-xs">
            <div className="flex justify-between border-b border-cyberTeal/10 pb-1.5">
              <span>Right Eye:</span>
              <span className="text-cyberCyan font-bold">{results.RIGHT}</span>
            </div>
            <div className="flex justify-between border-b border-cyberTeal/10 pb-1.5">
              <span>Left Eye:</span>
              <span className="text-cyberCyan font-bold">{results.LEFT}</span>
            </div>
            <div className="flex justify-between">
              <span>Both Eyes:</span>
              <span className="text-cyberCyan font-bold">{results.BOTH}</span>
            </div>
          </div>

          <p className="text-[10px] text-cyberSilver/50 uppercase max-w-sm">
            Press Stop & Report on the top toolbar to generate your detailed diagnostic dashboard and AI-driven clinical report.
          </p>
        </div>
      )}
    </div>
  )
}
export default SnellenTest
