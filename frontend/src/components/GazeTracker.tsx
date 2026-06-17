import React, { useRef, useEffect, useState } from "react"
import { FilesetResolver, FaceLandmarker } from "@mediapipe/tasks-vision"
import { CalibrationData } from "./CalibrationUI"

interface GazeTrackerProps {
  sessionId: string | null
  connectionState: string
  sendMetrics: (metrics: any) => void
  onMetricsUpdated: (metrics: any) => void
  calibrationData: CalibrationData | null
}

// Landmark Indices Mapping
const LEFT_IRIS_CENTER = 468
const RIGHT_IRIS_CENTER = 473

const LEFT_EYE_CORNERS = [362, 263]
const LEFT_EYE_VERTICAL_1 = [385, 380]
const LEFT_EYE_VERTICAL_2 = [386, 374]
const LEFT_IRIS_INDICES = [469, 470, 471, 472]

const RIGHT_EYE_CORNERS = [33, 133]
const RIGHT_EYE_VERTICAL_1 = [158, 153]
const RIGHT_EYE_VERTICAL_2 = [159, 145]
const RIGHT_IRIS_INDICES = [474, 475, 476, 477]

// Standard Euclidean Distance
const getDistance = (p1: any, p2: any) => {
  return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2) + Math.pow(p1.z - p2.z, 2))
}

// Vector projection ratio calculation
const projectPoint = (p: any, start: any, end: any) => {
  const lineVec = { x: end.x - start.x, y: end.y - start.y }
  const ptVec = { x: p.x - start.x, y: p.y - start.y }
  const lineLenSq = lineVec.x * lineVec.x + lineVec.y * lineVec.y
  if (lineLenSq === 0) return 0.5
  return (ptVec.x * lineVec.x + ptVec.y * lineVec.y) / lineLenSq
}

export function GazeTracker({
  sessionId,
  connectionState,
  sendMetrics,
  onMetricsUpdated,
  calibrationData
}: GazeTrackerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const landmarkerRef = useRef<FaceLandmarker | null>(null)
  
  const [modelLoading, setModelLoading] = useState<boolean>(true)
  const [cameraAccess, setCameraAccess] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Tracking state variables
  const blinkCountRef = useRef<number>(0)
  const isBlinkActiveRef = useRef<boolean>(false)
  const blinkStartTimeRef = useRef<number>(0)
  const lastGazeRef = useRef<{ x: number; y: number; t: number } | null>(null)
  const gazeWindowRef = useRef<{ x: number; y: number }[]>([])
  
  const frameIdRef = useRef<number>(0)
  const requestRef = useRef<number | null>(null)

  // 1. Initialize MediaPipe Face Landmarker WASM model
  useEffect(() => {
    async function initModel() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm"
        )
        const landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numFaces: 1,
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: false
        })
        landmarkerRef.current = landmarker
        setModelLoading(false)
        console.log("[MediaPipe] Model bundle loaded.")
      } catch (err) {
        console.error("Failed to load FaceLandmarker", err)
        setErrorMessage("Failed to load tracking models. Check internet connection.")
      }
    }
    initModel()
    return () => {
      if (landmarkerRef.current) {
        landmarkerRef.current.close()
      }
    }
  }, [])

  // 2. Open Webcam Access
  useEffect(() => {
    if (modelLoading) return

    navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, frameRate: 30 }
    })
    .then((stream) => {
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play()
          setCameraAccess(true)
        }
      }
    })
    .catch((err) => {
      console.error("Camera access denied", err)
      setErrorMessage("Webcam permissions denied. Allow camera access to run gaze tracking.")
    });

    return () => {
      const stream = videoRef.current?.srcObject as MediaStream
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [modelLoading])

  // 3. Animation frame loop
  useEffect(() => {
    if (!cameraAccess || modelLoading || !landmarkerRef.current) return

    const runFrame = () => {
      const video = videoRef.current
      const canvas = canvasRef.current
      const landmarker = landmarkerRef.current

      if (!video || !canvas || !landmarker || video.readyState < 2) {
        requestRef.current = requestAnimationFrame(runFrame)
        return
      }

      const ctx = canvas.getContext("2d")
      if (!ctx) return

      // Adjust canvas resolution dynamically
      const width = video.videoWidth
      const height = video.videoHeight
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
      }

      // Draw mirrored webcam feed to screen canvas
      ctx.save()
      ctx.translate(width, 0)
      ctx.scale(-1, 1)
      ctx.drawImage(video, 0, 0, width, height)
      ctx.restore()

      // Perform landmarker inference
      const timestamp = performance.now()
      const results = landmarker.detectForVideo(video, timestamp)
      frameIdRef.current += 1

      if (results.faceLandmarks && results.faceLandmarks.length > 0) {
        const landmarks = results.faceLandmarks[0]
        const nowSec = Date.now() / 1000

        // A. Calculate EAR Left/Right
        const earLeft = (getDistance(landmarks[LEFT_EYE_VERTICAL_1[0]], landmarks[LEFT_EYE_VERTICAL_1[1]]) +
                         getDistance(landmarks[LEFT_EYE_VERTICAL_2[0]], landmarks[LEFT_EYE_VERTICAL_2[1]])) /
                        (2 * getDistance(landmarks[LEFT_EYE_CORNERS[0]], landmarks[LEFT_EYE_CORNERS[1]]))
        const earRight = (getDistance(landmarks[RIGHT_EYE_VERTICAL_1[0]], landmarks[RIGHT_EYE_VERTICAL_1[1]]) +
                          getDistance(landmarks[RIGHT_EYE_VERTICAL_2[0]], landmarks[RIGHT_EYE_VERTICAL_2[1]])) /
                         (2 * getDistance(landmarks[RIGHT_EYE_CORNERS[0]], landmarks[RIGHT_EYE_CORNERS[1]]))
        const earAvg = (earLeft + earRight) / 2.0

        // B. Blink Detection
        const earThreshold = 0.22
        if (earAvg < earThreshold) {
          if (!isBlinkActiveRef.current) {
            isBlinkActiveRef.current = true
            blinkStartTimeRef.current = nowSec
          }
        } else {
          if (isBlinkActiveRef.current) {
            isBlinkActiveRef.current = false
            const duration = nowSec - blinkStartTimeRef.current
            if (duration > 0.05) {
              blinkCountRef.current += 1
            }
          }
        }

        // C. Gaze Projections
        const gazeXLeft = projectPoint(landmarks[LEFT_IRIS_CENTER], landmarks[LEFT_EYE_CORNERS[0]], landmarks[LEFT_EYE_CORNERS[1]])
        const gazeXRight = projectPoint(landmarks[RIGHT_IRIS_CENTER], landmarks[RIGHT_EYE_CORNERS[0]], landmarks[RIGHT_EYE_CORNERS[1]])
        const gazeYLeft = projectPoint(landmarks[LEFT_IRIS_CENTER], landmarks[LEFT_EYE_VERTICAL_1[0]], landmarks[LEFT_EYE_VERTICAL_1[1]])
        const gazeYRight = projectPoint(landmarks[RIGHT_IRIS_CENTER], landmarks[RIGHT_EYE_VERTICAL_1[0]], landmarks[RIGHT_EYE_VERTICAL_1[1]])

        let gazeX = (gazeXLeft + gazeXRight) / 2.0
        let gazeY = (gazeYLeft + gazeYRight) / 2.0

        // Apply screen calibration bounds if available
        if (calibrationData) {
          const { minGazeX, maxGazeX, minGazeY, maxGazeY } = calibrationData
          gazeX = (gazeX - minGazeX) / (maxGazeX - minGazeX || 1)
          gazeY = (gazeY - minGazeY) / (maxGazeY - minGazeY || 1)
          
          // Constrain within bounds
          gazeX = Math.max(0, Math.min(1, gazeX))
          gazeY = Math.max(0, Math.min(1, gazeY))
        }

        // D. Saccade Velocity
        let gazeVelocity = 0.0
        if (lastGazeRef.current) {
          const lg = lastGazeRef.current
          const dt = nowSec - lg.t
          if (dt > 0) {
            const dist = Math.sqrt(Math.pow(gazeX - lg.x, 2) + Math.pow(gazeY - lg.y, 2))
            gazeVelocity = dist / dt
          }
        }
        lastGazeRef.current = { x: gazeX, y: gazeY, t: nowSec }

        // E. Fixation Detection (I-DT Dispersion)
        gazeWindowRef.current.push({ x: gazeX, y: gazeY })
        if (gazeWindowRef.current.length > 15) {
          gazeWindowRef.current.shift()
        }

        let isFixating = false
        if (gazeWindowRef.current.length === 15) {
          const xs = gazeWindowRef.current.map((g) => g.x)
          const ys = gazeWindowRef.current.map((g) => g.y)
          const dispersion = (Math.max(...xs) - Math.min(...xs)) + (Math.max(...ys) - Math.min(...ys))
          if (dispersion < 0.08) {
            isFixating = true
          }
        }

        const isSaccade = gazeVelocity > 2.5 && !isFixating

        // F. Distance Estimation (Interpupillary distance pixel calculations)
        const lIris = landmarks[LEFT_IRIS_CENTER]
        const rIris = landmarks[RIGHT_IRIS_CENTER]
        const dx = (rIris.x - lIris.x) * width
        const dy = (rIris.y - lIris.y) * height
        const irisDistPx = Math.sqrt(dx * dx + dy * dy)
        
        // Estimated distance: focal length (650px) * physical IPD (63mm) / pixel distance
        const estimatedDistanceCm = irisDistPx > 0 ? (650.0 * 63.0) / (irisDistPx * 10.0) : 150.0

        // G. Bundle Metrics
        const metrics = {
          frame_id: frameIdRef.current,
          timestamp: nowSec,
          ear_left: earLeft,
          ear_right: earRight,
          ear_avg: earAvg,
          is_blink_active: isBlinkActiveRef.current,
          gaze_x: gazeX,
          gaze_y: gazeY,
          gaze_velocity: gazeVelocity,
          is_fixating: isFixating,
          is_saccade: isSaccade,
          estimated_distance_cm: estimatedDistanceCm
        }

        // H. Stream updates over WebSocket & react callbacks
        if (sessionId && connectionState === "open") {
          sendMetrics(metrics)
        }
        onMetricsUpdated(metrics)

        // I. Render tracking overlays on the mirrored canvas
        const drawEyeBoundary = (indices: number[], color: string) => {
          ctx.strokeStyle = color
          ctx.lineWidth = 1.5
          ctx.beginPath()
          indices.forEach((idx, i) => {
            const lm = landmarks[idx]
            const drawX = width - (lm.x * width)
            const drawY = lm.y * height
            if (i === 0) ctx.moveTo(drawX, drawY)
            else ctx.lineTo(drawX, drawY)
          })
          ctx.closePath()
          ctx.stroke()
        }

        // Draw Left Eye (Cyan) and Right Eye (Magenta)
        drawEyeBoundary(LEFT_EYE_CORNERS.concat(LEFT_EYE_VERTICAL_1, LEFT_EYE_VERTICAL_2), "#66FCF1")
        drawEyeBoundary(RIGHT_EYE_CORNERS.concat(RIGHT_EYE_VERTICAL_1, RIGHT_EYE_VERTICAL_2), "#FF2E63")

        // Draw Iris centers
        ctx.fillStyle = "#66FCF1"
        ctx.beginPath()
        ctx.arc(width - (lIris.x * width), lIris.y * height, 2.5, 0, 2 * Math.PI)
        ctx.fill()

        ctx.fillStyle = "#FF2E63"
        ctx.beginPath()
        ctx.arc(width - (rIris.x * width), rIris.y * height, 2.5, 0, 2 * Math.PI)
        ctx.fill()

        // Draw dynamic distance helper HUD overlay
        const isDistOk = estimatedDistanceCm >= 135 && estimatedDistanceCm <= 165
        ctx.fillStyle = "rgba(10, 15, 20, 0.85)"
        ctx.fillRect(15, height - 40, 210, 25)
        ctx.strokeStyle = isDistOk ? "#00E676" : "#FF2E63"
        ctx.lineWidth = 1
        ctx.strokeRect(15, height - 40, 210, 25)

        ctx.fillStyle = "#white"
        ctx.font = "bold 9px monospace"
        ctx.fillText(`CALIB DISTANCE: ${estimatedDistanceCm.toFixed(0)}cm`, 25, height - 24)
      }

      requestRef.current = requestAnimationFrame(runFrame)
    }

    requestRef.current = requestAnimationFrame(runFrame)
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current)
      }
    }
  }, [cameraAccess, modelLoading, sessionId, connectionState, sendMetrics, onMetricsUpdated, calibrationData])

  return (
    <div className="relative w-full h-[320px] rounded-lg border border-cyberTeal/15 bg-darkBg/60 backdrop-blur-sm overflow-hidden flex items-center justify-center">
      {/* Hidden webcam camera feed element */}
      <video ref={videoRef} className="hidden" playsInline muted />
      
      {/* Visually rendered mirror tracking canvas */}
      <canvas ref={canvasRef} className="w-full h-full object-cover" />

      {/* Model & Camera Loading HUD States */}
      {(modelLoading || !cameraAccess) && !errorMessage && (
        <div className="absolute inset-0 bg-darkBg/90 flex flex-col items-center justify-center font-mono space-y-3 z-10">
          <div className="w-8 h-8 rounded-full border-2 border-cyberCyan/20 border-t-cyberCyan animate-spin" />
          <p className="text-xs text-cyberCyan tracking-widest uppercase animate-pulse">
            {modelLoading ? "Initializing WASM Landmarker..." : "Acquiring Webcam Pipeline..."}
          </p>
        </div>
      )}

      {/* Errors HUD States */}
      {errorMessage && (
        <div className="absolute inset-0 bg-darkBg/95 flex flex-col items-center justify-center text-center p-6 z-10 font-mono">
          <div className="text-cyberPink text-xl font-bold uppercase mb-2">System Error</div>
          <p className="text-xs text-cyberSilver max-w-sm">{errorMessage}</p>
        </div>
      )}
    </div>
  )
}
export default GazeTracker
