from fastapi import FastAPI, File, UploadFile, HTTPException
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
import cv2
import numpy as np
import mediapipe as mp
import time
import io
import os

from features import EyeFeatureExtractor, FrameMetrics

app = FastAPI(
    title="InsightEye Analytics API",
    description="REST API for real-time eye tracking and feature extraction (EAR, Gaze, Blinks, Fixations, Saccades)",
    version="2.0.0"
)

# Global extractor instance for session-like tracking
extractor = EyeFeatureExtractor()

# MediaPipe model path
MODEL_PATH = "face_landmarker.task"
detector = None

def get_detector():
    """Lazy initializer for FaceLandmarker detector to avoid startup delays."""
    global detector
    if detector is None:
        if not os.path.exists(MODEL_PATH):
            raise RuntimeError(
                f"Model file '{MODEL_PATH}' not found. Please run main.py first to download the weights, or download it manually."
            )
        from mediapipe.tasks import python
        from mediapipe.tasks.python import vision
        base_options = python.BaseOptions(model_asset_path=MODEL_PATH)
        options = vision.FaceLandmarkerOptions(
            base_options=base_options,
            output_face_blendshapes=False,
            output_facial_transformation_matrixes=False,
            num_faces=1,
            running_mode=vision.RunningMode.IMAGE
        )
        detector = vision.FaceLandmarker.create_from_options(options)
    return detector

# Pydantic models for incoming JSON payloads
class LandmarkPoint(BaseModel):
    x: float
    y: float
    z: float

class LandmarkPayload(BaseModel):
    frame_id: int
    timestamp: Optional[float] = None
    landmarks: List[LandmarkPoint] = Field(..., min_items=478, max_items=478, description="List of 478 MediaPipe face landmarks")

@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "InsightEye Analytics Service",
        "version": "2.0.0"
    }

@app.post("/analyze/landmarks", response_model=Dict[str, Any])
def analyze_landmarks(payload: LandmarkPayload):
    """
    Directly processes pre-computed landmarks (e.g. from a client-side tracker) 
    and feeds them to the Feature Extractor.
    """
    ts = payload.timestamp if payload.timestamp is not None else time.time()
    
    try:
        # Map Pydantic structures to mock objects containing x,y,z properties for Extractor
        class MockLandmark:
            def __init__(self, x, y, z):
                self.x = x
                self.y = y
                self.z = z

        mock_landmarks = [MockLandmark(lm.x, lm.y, lm.z) for lm in payload.landmarks]
        
        # Process landmarks
        metrics = extractor.process_landmarks(payload.frame_id, ts, mock_landmarks)
        
        return {
            "metrics": metrics.to_dict(),
            "session_summary": extractor.get_session_summary()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Feature extraction failed: {str(e)}")

@app.post("/analyze/image", response_model=Dict[str, Any])
async def analyze_image(file: UploadFile = File(...)):
    """
    Processes an uploaded image file: runs FaceLandmarker, extracts landmarks, 
    computes eye metrics, and returns the analytics results.
    """
    # Read image bytes
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    if frame is None:
        raise HTTPException(status_code=400, detail="Invalid image file format")

    try:
        # Convert to MediaPipe Image
        import mediapipe as mp
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
        
        # Run inference
        landmarker = get_detector()
        detection_result = landmarker.detect(mp_image)
        
        if not detection_result.face_landmarks:
            return {
                "face_detected": False,
                "metrics": None,
                "message": "No face detected in the image"
            }

        face_landmarks = detection_result.face_landmarks[0]
        ts = time.time()
        
        # Process landmarks
        metrics = extractor.process_landmarks(0, ts, face_landmarks)
        
        return {
            "face_detected": True,
            "metrics": metrics.to_dict(),
            "session_summary": extractor.get_session_summary()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image processing failed: {str(e)}")

@app.get("/session/summary")
def get_session_summary():
    """Returns the cumulative session analytics (blink counts, history)."""
    return extractor.get_session_summary()

@app.post("/session/reset")
def reset_session():
    """Resets the state of the feature extractor."""
    global extractor
    extractor = EyeFeatureExtractor()
    return {"status": "success", "message": "Session reset successfully"}
