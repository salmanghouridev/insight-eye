from pydantic import BaseModel, Field

class FrameMetricsSchema(BaseModel):
    frame_id: int = Field(..., description="Unique frame identifier")
    timestamp: float = Field(..., description="Epoch timestamp of the frame capture")
    ear_left: float = Field(..., description="Eye Aspect Ratio for left eye")
    ear_right: float = Field(..., description="Eye Aspect Ratio for right eye")
    ear_avg: float = Field(..., description="Average Eye Aspect Ratio")
    is_blink_active: bool = Field(..., description="Is blink currently active")
    gaze_x: float = Field(..., description="Normalized horizontal gaze ratio (0.5 is center)")
    gaze_y: float = Field(..., description="Normalized vertical gaze ratio (0.5 is center)")
    gaze_velocity: float = Field(..., description="Gaze coordinate shift velocity per second")
    is_fixating: bool = Field(..., description="Is user fixating (gaze stable)")
    is_saccade: bool = Field(..., description="Is user performing a saccade (fast shift)")

    model_config = {
        "json_schema_extra": {
            "example": {
                "frame_id": 42,
                "timestamp": 1781656920.145,
                "ear_left": 0.285,
                "ear_right": 0.291,
                "ear_avg": 0.288,
                "is_blink_active": False,
                "gaze_x": 0.492,
                "gaze_y": 0.505,
                "gaze_velocity": 0.18,
                "is_fixating": True,
                "is_saccade": False
            }
        }
    }
