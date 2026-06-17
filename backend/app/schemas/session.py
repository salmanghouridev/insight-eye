from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Optional, Dict, Any
from app.schemas.metrics import FrameMetricsSchema

class SessionStartPayload(BaseModel):
    client_name: str = Field("Webcam Tracker", description="Name/identifier of the tracking client")

class SessionMetadataSchema(BaseModel):
    session_id: str = Field(..., description="Unique UUID identifying the tracking session")
    client_name: str = Field(..., description="Name of the client that ran this session")
    started_at: datetime = Field(..., description="Session start date and time")
    ended_at: Optional[datetime] = Field(None, description="Session end date and time")
    status: str = Field(..., description="Lifecycle status: 'active' or 'stopped'")

class TestResultCreate(BaseModel):
    eye_tested: str = Field(..., description="Left, Right, or Both eyes ('LEFT', 'RIGHT', 'BOTH')")
    acuity_score: str = Field(..., description="Calculated Snellen score (e.g. '6/6', '6/9', '6/60')")
    letters_shown: int = Field(..., description="Count of optotypes presented")
    letters_correct: int = Field(..., description="Count of correctly identified letters")

class TestResultSchema(TestResultCreate):
    test_id: str = Field(..., description="Unique test UUID")
    session_id: str = Field(..., description="Foreign key linking to the session UUID")
    recorded_at: datetime = Field(..., description="Timestamp of result record")

class ReportSchema(BaseModel):
    report_id: str = Field(..., description="Unique report UUID")
    session_id: str = Field(..., description="Foreign key linking to the session UUID")
    clinical_assessment: str = Field(..., description="NLP-generated clinical visual report text")
    risk_flags: Dict[str, Any] = Field(..., description="Assessed clinical risk indicators dictionary")
    recommendations: str = Field(..., description="Recommended medical actions advice text")
    generated_at: datetime = Field(..., description="Timestamp of report compilation")

class AggregateSummarySchema(BaseModel):
    total_frames: int = Field(..., description="Total frames recorded")
    total_blinks: int = Field(..., description="Total blinks detected")
    average_blink_duration_sec: float = Field(..., description="Average blink duration in seconds")
    blink_frequency_per_min: float = Field(..., description="Blink frequency extrapolated per minute")
    fixation_ratio: float = Field(..., description="Percentage of frames spent fixating (0.0 to 1.0)")
    saccade_ratio: float = Field(..., description="Percentage of frames spent in saccades (0.0 to 1.0)")
    average_ear: float = Field(..., description="Mean Eye Aspect Ratio recorded over the entire session")

class ReportPayloadSchema(BaseModel):
    metadata: SessionMetadataSchema = Field(..., description="Session metadata details")
    summary: AggregateSummarySchema = Field(..., description="Session statistics aggregate summary")
    frames: List[FrameMetricsSchema] = Field(..., description="Full timeseries list of frame-by-frame metrics")
    test_results: List[TestResultSchema] = Field([], description="List of visual acuity test records")
    report: Optional[ReportSchema] = Field(None, description="NLP clinical diagnostic report details")
