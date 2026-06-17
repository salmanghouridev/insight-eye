from sqlalchemy import Column, String, DateTime, ForeignKey, Integer, Float, Boolean, JSON, BigInteger
from sqlalchemy.orm import relationship
from app.db.session import Base
import datetime
import uuid

class SessionModel(Base):
    __tablename__ = "sessions"

    session_id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    client_name = Column(String(100), nullable=False)
    started_at = Column(DateTime, default=datetime.datetime.utcnow)
    ended_at = Column(DateTime, nullable=True)
    status = Column(String(20), default="active")  # 'active' or 'stopped'

    # Relationships
    test_results = relationship("TestResultModel", back_populates="session", cascade="all, delete-orphan")
    frame_metrics = relationship("FrameMetricModel", back_populates="session", cascade="all, delete-orphan")
    report = relationship("ReportModel", back_populates="session", uselist=False, cascade="all, delete-orphan")

class TestResultModel(Base):
    __tablename__ = "test_results"

    test_id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(36), ForeignKey("sessions.session_id", ondelete="CASCADE"), nullable=False)
    eye_tested = Column(String(10), nullable=False)  # 'LEFT', 'RIGHT', 'BOTH'
    acuity_score = Column(String(10), nullable=False)  # e.g., '6/6', '6/9', '6/60'
    letters_shown = Column(Integer, nullable=False)
    letters_correct = Column(Integer, nullable=False)
    recorded_at = Column(DateTime, default=datetime.datetime.utcnow)

    session = relationship("SessionModel", back_populates="test_results")

class FrameMetricModel(Base):
    __tablename__ = "frame_metrics"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    session_id = Column(String(36), ForeignKey("sessions.session_id", ondelete="CASCADE"), nullable=False)
    frame_id = Column(Integer, nullable=False)
    timestamp = Column(Float, nullable=False)
    ear_avg = Column(Float, nullable=False)
    gaze_x = Column(Float, nullable=False)
    gaze_y = Column(Float, nullable=False)
    gaze_velocity = Column(Float, nullable=False)
    is_fixating = Column(Boolean, nullable=False)
    is_saccade = Column(Boolean, nullable=False)
    estimated_distance_cm = Column(Float, nullable=False)

    session = relationship("SessionModel", back_populates="frame_metrics")

class ReportModel(Base):
    __tablename__ = "reports"

    report_id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(36), ForeignKey("sessions.session_id", ondelete="CASCADE"), nullable=False)
    clinical_assessment = Column(String, nullable=False)
    risk_flags = Column(JSON, nullable=False)  # Stores dictionary of risk flags
    recommendations = Column(String, nullable=False)
    generated_at = Column(DateTime, default=datetime.datetime.utcnow)

    session = relationship("SessionModel", back_populates="report")
