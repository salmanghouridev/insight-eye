from dataclasses import dataclass, asdict
from typing import List, Tuple, Dict, Any, Optional
import numpy as np
import time

@dataclass
class FrameMetrics:
    frame_id: int
    timestamp: float
    ear_left: float
    ear_right: float
    ear_avg: float
    is_blink_active: bool
    gaze_x: float
    gaze_y: float
    gaze_velocity: float
    is_fixating: bool
    is_saccade: bool

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

class EyeFeatureExtractor:
    # Landmarks indices mapping (standard MediaPipe Face Mesh / Tasks indexes)
    LEFT_IRIS_CENTER = 468
    RIGHT_IRIS_CENTER = 473

    # Left eye outline: Corners (362, 263), Verticals (385, 380) and (386, 374)
    LEFT_EYE_CORNERS = (362, 263)
    LEFT_EYE_VERTICAL_1 = (385, 380)
    LEFT_EYE_VERTICAL_2 = (386, 374)
    LEFT_IRIS_INDICES = [469, 470, 471, 472]

    # Right eye outline: Corners (33, 133), Verticals (158, 153) and (159, 145)
    RIGHT_EYE_CORNERS = (33, 133)
    RIGHT_EYE_VERTICAL_1 = (158, 153)
    RIGHT_EYE_VERTICAL_2 = (159, 145)
    RIGHT_IRIS_INDICES = [474, 475, 476, 477]

    def __init__(
        self,
        ear_threshold: float = 0.22,
        dispersion_threshold: float = 0.08,
        fixation_window_frames: int = 15,
        saccade_velocity_threshold: float = 2.5
    ):
        """
        Initializes the feature extractor with parameters for blink, fixation, and saccade detection.
        """
        self.ear_threshold = ear_threshold
        self.dispersion_threshold = dispersion_threshold
        self.fixation_window_frames = fixation_window_frames
        self.saccade_velocity_threshold = saccade_velocity_threshold

        # Session tracking state
        self.blink_count = 0
        self.is_blink_active = False
        self.blink_start_time = 0.0
        self.blink_history: List[Dict[str, float]] = []

        # Sliding window for fixation detection: stores (gaze_x, gaze_y, timestamp)
        self.gaze_window: List[Tuple[float, float, float]] = []
        
        # Last gaze for velocity tracking: (gaze_x, gaze_y, timestamp)
        self.last_gaze: Optional[Tuple[float, float, float]] = None

    @staticmethod
    def _dist(p1: Any, p2: Any) -> float:
        """Calculates Euclidean distance between two 3D landmarks."""
        return float(np.sqrt((p1.x - p2.x)**2 + (p1.y - p2.y)**2 + (p1.z - p2.z)**2))

    @staticmethod
    def _project_point(p: Any, line_start: Any, line_end: Any) -> float:
        """
        Projects a point onto a line segment and returns the relative ratio [0, 1].
        """
        # Convert to numpy arrays for vector math
        pt = np.array([p.x, p.y])
        start = np.array([line_start.x, line_start.y])
        end = np.array([line_end.x, line_end.y])

        line_vec = end - start
        pt_vec = pt - start

        line_len_sq = np.dot(line_vec, line_vec)
        if line_len_sq == 0:
            return 0.5
        
        # Calculate projection scalar ratio
        projection = np.dot(pt_vec, line_vec) / line_len_sq
        return float(projection)

    def calculate_eye_ear(self, face_landmarks: List[Any], corners: Tuple[int, int], v1: Tuple[int, int], v2: Tuple[int, int]) -> float:
        """
        Calculates Eye Aspect Ratio (EAR) for a single eye.
        """
        p_inner = face_landmarks[corners[0]]
        p_outer = face_landmarks[corners[1]]
        p_v1_top = face_landmarks[v1[0]]
        p_v1_bot = face_landmarks[v1[1]]
        p_v2_top = face_landmarks[v2[0]]
        p_v2_bot = face_landmarks[v2[1]]

        # Vertical distances
        d_v1 = self._dist(p_v1_top, p_v1_bot)
        d_v2 = self._dist(p_v2_top, p_v2_bot)
        # Horizontal distance
        d_h = self._dist(p_inner, p_outer)

        if d_h == 0:
            return 0.0
        
        return (d_v1 + d_v2) / (2.0 * d_h)

    def calculate_gaze_ratios(
        self,
        face_landmarks: List[Any],
        iris_idx: int,
        corners: Tuple[int, int],
        v1_top_idx: int,
        v2_top_idx: int,
        v1_bot_idx: int,
        v2_bot_idx: int
    ) -> Tuple[float, float]:
        """
        Calculates normalized horizontal and vertical gaze ratios using vector projections.
        """
        p_iris = face_landmarks[iris_idx]
        p_inner = face_landmarks[corners[0]]
        p_outer = face_landmarks[corners[1]]

        # Calculate horizontal gaze: project iris onto inner-to-outer segment
        gaze_x = self._project_point(p_iris, p_inner, p_outer)

        # Calculate vertical midpoint segments
        p_top_mid = face_landmarks[v1_top_idx]  # simplified top midpoint
        p_bot_mid = face_landmarks[v1_bot_idx]  # simplified bottom midpoint
        
        # Calculate vertical gaze: project iris onto top-to-bottom segment
        gaze_y = self._project_point(p_iris, p_top_mid, p_bot_mid)

        return gaze_x, gaze_y

    def process_landmarks(self, frame_id: int, timestamp: float, face_landmarks: List[Any]) -> FrameMetrics:
        """
        Analyzes eye landmarks for EAR, gaze ratio, fixation stability, and saccade velocity.
        """
        # 1. Compute EAR
        ear_left = self.calculate_eye_ear(face_landmarks, self.LEFT_EYE_CORNERS, self.LEFT_EYE_VERTICAL_1, self.LEFT_EYE_VERTICAL_2)
        ear_right = self.calculate_eye_ear(face_landmarks, self.RIGHT_EYE_CORNERS, self.RIGHT_EYE_VERTICAL_1, self.RIGHT_EYE_VERTICAL_2)
        ear_avg = (ear_left + ear_right) / 2.0

        # 2. Blink Detection & State Tracker
        if ear_avg < self.ear_threshold:
            if not self.is_blink_active:
                self.is_blink_active = True
                self.blink_start_time = timestamp
        else:
            if self.is_blink_active:
                self.is_blink_active = False
                duration = timestamp - self.blink_start_time
                if duration > 0.05:  # Filter micro-jitters
                    self.blink_count += 1
                    self.blink_history.append({
                        "start": self.blink_start_time,
                        "end": timestamp,
                        "duration": duration
                    })

        # 3. Gaze Estimation
        # Left eye gaze ratio calculation
        gaze_x_left, gaze_y_left = self.calculate_gaze_ratios(
            face_landmarks,
            self.LEFT_IRIS_CENTER,
            self.LEFT_EYE_CORNERS,
            self.LEFT_EYE_VERTICAL_1[0],
            self.LEFT_EYE_VERTICAL_2[0],
            self.LEFT_EYE_VERTICAL_1[1],
            self.LEFT_EYE_VERTICAL_2[1]
        )
        
        # Right eye gaze ratio calculation
        gaze_x_right, gaze_y_right = self.calculate_gaze_ratios(
            face_landmarks,
            self.RIGHT_IRIS_CENTER,
            self.RIGHT_EYE_CORNERS,
            self.RIGHT_EYE_VERTICAL_1[0],
            self.RIGHT_EYE_VERTICAL_2[0],
            self.RIGHT_EYE_VERTICAL_1[1],
            self.RIGHT_EYE_VERTICAL_2[1]
        )

        # Average gaze ratios (mirrored gaze directions naturally align)
        gaze_x = (gaze_x_left + gaze_x_right) / 2.0
        gaze_y = (gaze_y_left + gaze_y_right) / 2.0

        # 4. Gaze Velocity
        gaze_velocity = 0.0
        if self.last_gaze is not None:
            last_x, last_y, last_t = self.last_gaze
            dt = timestamp - last_t
            if dt > 0:
                dist = np.sqrt((gaze_x - last_x)**2 + (gaze_y - last_y)**2)
                gaze_velocity = dist / dt
        
        # Update last gaze tracker
        self.last_gaze = (gaze_x, gaze_y, timestamp)

        # 5. Fixation Detection (I-DT Algorithm)
        self.gaze_window.append((gaze_x, gaze_y, timestamp))
        if len(self.gaze_window) > self.fixation_window_frames:
            self.gaze_window.pop(0)

        is_fixating = False
        if len(self.gaze_window) == self.fixation_window_frames:
            xs = [g[0] for g in self.gaze_window]
            ys = [g[1] for g in self.gaze_window]
            dispersion = (max(xs) - min(xs)) + (max(ys) - min(ys))
            if dispersion < self.dispersion_threshold:
                is_fixating = True

        # 6. Saccade Classification
        is_saccade = False
        if gaze_velocity > self.saccade_velocity_threshold and not is_fixating:
            is_saccade = True

        return FrameMetrics(
            frame_id=frame_id,
            timestamp=timestamp,
            ear_left=ear_left,
            ear_right=ear_right,
            ear_avg=ear_avg,
            is_blink_active=self.is_blink_active,
            gaze_x=gaze_x,
            gaze_y=gaze_y,
            gaze_velocity=gaze_velocity,
            is_fixating=is_fixating,
            is_saccade=is_saccade
        )

    def get_session_summary(self) -> Dict[str, Any]:
        """
        Aggregates session analytics (blinks, etc.) for export or API payloads.
        """
        durations = [b["duration"] for b in self.blink_history]
        avg_blink_duration = float(np.mean(durations)) if durations else 0.0
        max_blink_duration = float(np.max(durations)) if durations else 0.0

        return {
            "total_blinks": self.blink_count,
            "average_blink_duration_sec": round(avg_blink_duration, 4),
            "max_blink_duration_sec": round(max_blink_duration, 4),
            "blink_history": self.blink_history
        }
