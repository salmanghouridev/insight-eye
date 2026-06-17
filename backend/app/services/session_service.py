import datetime
from typing import List, Optional, Dict, Any
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models import SessionModel, TestResultModel, FrameMetricModel, ReportModel
from app.schemas.session import (
    SessionMetadataSchema, 
    AggregateSummarySchema, 
    ReportPayloadSchema,
    TestResultCreate,
    TestResultSchema,
    ReportSchema
)
from app.schemas.metrics import FrameMetricsSchema
from app.services.report_engine import report_engine

class SessionService:
    async def start_session(self, db: AsyncSession, client_name: str) -> SessionMetadataSchema:
        """Creates and registers a new active tracking session in the database."""
        db_session = SessionModel(
            client_name=client_name,
            status="active"
        )
        db.add(db_session)
        await db.commit()
        await db.refresh(db_session)

        return SessionMetadataSchema(
            session_id=db_session.session_id,
            client_name=db_session.client_name,
            started_at=db_session.started_at,
            ended_at=db_session.ended_at,
            status=db_session.status
        )

    async def add_frame_metric(self, db: AsyncSession, session_id: str, metric: FrameMetricsSchema) -> bool:
        """Appends a frame telemetry record to the database."""
        # Check if session exists and is active
        stmt = select(SessionModel).where(SessionModel.session_id == session_id)
        res = await db.execute(stmt)
        db_session = res.scalar_one_or_none()
        
        if not db_session or db_session.status != "active":
            return False

        # Access distance if available on schema (or fallback to average 150.0 cm)
        dist = getattr(metric, "estimated_distance_cm", 150.0)

        db_metric = FrameMetricModel(
            session_id=session_id,
            frame_id=metric.frame_id,
            timestamp=metric.timestamp,
            ear_avg=metric.ear_avg,
            gaze_x=metric.gaze_x,
            gaze_y=metric.gaze_y,
            gaze_velocity=metric.gaze_velocity,
            is_fixating=metric.is_fixating,
            is_saccade=metric.is_saccade,
            estimated_distance_cm=dist
        )
        db.add(db_metric)
        await db.commit()
        return True

    async def add_test_result(self, db: AsyncSession, session_id: str, result: TestResultCreate) -> Optional[TestResultSchema]:
        """Logs a Snellen eye test result to the database."""
        stmt = select(SessionModel).where(SessionModel.session_id == session_id)
        res = await db.execute(stmt)
        db_session = res.scalar_one_or_none()
        
        if not db_session or db_session.status != "active":
            return None

        db_result = TestResultModel(
            session_id=session_id,
            eye_tested=result.eye_tested,
            acuity_score=result.acuity_score,
            letters_shown=result.letters_shown,
            letters_correct=result.letters_correct
        )
        db.add(db_result)
        await db.commit()
        await db.refresh(db_result)

        return TestResultSchema(
            test_id=db_result.test_id,
            session_id=db_result.session_id,
            eye_tested=db_result.eye_tested,
            acuity_score=db_result.acuity_score,
            letters_shown=db_result.letters_shown,
            letters_correct=db_result.letters_correct,
            recorded_at=db_result.recorded_at
        )

    async def stop_session(self, db: AsyncSession, session_id: str) -> Optional[AggregateSummarySchema]:
        """Closes a session, computes aggregates, and returns the summary."""
        stmt = select(SessionModel).where(SessionModel.session_id == session_id)
        res = await db.execute(stmt)
        db_session = res.scalar_one_or_none()
        
        if not db_session:
            return None
        
        if db_session.status == "active":
            db_session.ended_at = datetime.datetime.utcnow()
            db_session.status = "stopped"
            db.add(db_session)
            await db.commit()
            await db.refresh(db_session)

        # Retrieve logged frames
        frames_stmt = select(FrameMetricModel).where(FrameMetricModel.session_id == session_id)
        frames_res = await db.execute(frames_stmt)
        frames = frames_res.scalars().all()
        total_frames = len(frames)

        if total_frames == 0:
            return AggregateSummarySchema(
                total_frames=0,
                total_blinks=0,
                average_blink_duration_sec=0.0,
                blink_frequency_per_min=0.0,
                fixation_ratio=0.0,
                saccade_ratio=0.0,
                average_ear=0.0
            )

        # Analyze frames chronologically for blinks
        sorted_frames = sorted(frames, key=lambda f: f.timestamp)
        total_blinks = 0
        blink_durations = []
        blink_start_time = None
        is_blinking = False

        for frame in sorted_frames:
            if frame.ear_avg < 0.22:  # blink threshold
                if not is_blinking:
                    is_blinking = True
                    blink_start_time = frame.timestamp
            else:
                if is_blinking:
                    is_blinking = False
                    if blink_start_time is not None:
                        dur = frame.timestamp - blink_start_time
                        if dur > 0.05:
                            total_blinks += 1
                            blink_durations.append(dur)
                    blink_start_time = None

        avg_blink_duration = sum(blink_durations) / len(blink_durations) if blink_durations else 0.0
        
        # Calculate session duration
        ended_time = db_session.ended_at or datetime.datetime.utcnow()
        duration_sec = (ended_time - db_session.started_at).total_seconds()
        duration_min = duration_sec / 60.0 if duration_sec > 0 else 0.0
        blink_freq = (total_blinks / duration_min) if duration_min > 0 else 0.0

        fixation_count = sum(1 for f in frames if f.is_fixating)
        saccade_count = sum(1 for f in frames if f.is_saccade)
        
        return AggregateSummarySchema(
            total_frames=total_frames,
            total_blinks=total_blinks,
            average_blink_duration_sec=round(avg_blink_duration, 4),
            blink_frequency_per_min=round(blink_freq, 2),
            fixation_ratio=round(fixation_count / total_frames, 4),
            saccade_ratio=round(saccade_count / total_frames, 4),
            average_ear=round(sum(f.ear_avg for f in frames) / total_frames, 4)
        )

    async def generate_report(self, db: AsyncSession, session_id: str) -> Optional[ReportSchema]:
        """Runs the LangChain NLP generator and saves the report to the database."""
        # 1. Check if report already exists to prevent duplication
        stmt = select(ReportModel).where(ReportModel.session_id == session_id)
        res = await db.execute(stmt)
        existing_report = res.scalar_one_or_none()
        if existing_report:
            return ReportSchema(
                report_id=existing_report.report_id,
                session_id=existing_report.session_id,
                clinical_assessment=existing_report.clinical_assessment,
                risk_flags=existing_report.risk_flags,
                recommendations=existing_report.recommendations,
                generated_at=existing_report.generated_at
            )

        # 2. Query session data
        session_stmt = select(SessionModel).where(SessionModel.session_id == session_id)
        session_res = await db.execute(session_stmt)
        db_session = session_res.scalar_one_or_none()
        if not db_session:
            return None

        # Ensure session is stopped before report generation
        summary = await self.stop_session(db, session_id)
        if not summary:
            return None

        # Retrieve test results
        tests_stmt = select(TestResultModel).where(TestResultModel.session_id == session_id)
        tests_res = await db.execute(tests_stmt)
        test_results = tests_res.scalars().all()

        # Format input for LLM engine
        acuity_list = [
            {"eye_tested": t.eye_tested, "acuity_score": t.acuity_score, "accuracy": f"{t.letters_correct}/{t.letters_shown}"}
            for t in test_results
        ]
        
        summary_dict = {
            "total_frames": summary.total_frames,
            "total_blinks": summary.total_blinks,
            "average_blink_duration_sec": summary.average_blink_duration_sec,
            "blink_frequency_per_min": summary.blink_frequency_per_min,
            "fixation_ratio": summary.fixation_ratio,
            "saccade_ratio": summary.saccade_ratio,
            "average_ear": summary.average_ear
        }

        # 3. Call LangChain + Ollama NLP Engine
        report_data = await report_engine.generate_report(acuity_list, summary_dict)

        # 4. Save to database
        db_report = ReportModel(
            session_id=session_id,
            clinical_assessment=report_data.get("clinical_assessment", "N/A"),
            risk_flags=report_data.get("risk_flags", {}),
            recommendations=report_data.get("recommendations", "N/A")
        )
        db.add(db_report)
        await db.commit()
        await db.refresh(db_report)

        return ReportSchema(
            report_id=db_report.report_id,
            session_id=db_report.session_id,
            clinical_assessment=db_report.clinical_assessment,
            risk_flags=db_report.risk_flags,
            recommendations=db_report.recommendations,
            generated_at=db_report.generated_at
        )

    async def get_report(self, db: AsyncSession, session_id: str) -> Optional[ReportPayloadSchema]:
        """Compiles session data (metadata, aggregates, tests, and NLP report) into a full payload."""
        session_stmt = select(SessionModel).where(SessionModel.session_id == session_id)
        session_res = await db.execute(session_stmt)
        db_session = session_res.scalar_one_or_none()
        
        if not db_session:
            return None

        # Auto stop session to compile stats if not stopped
        summary = await self.stop_session(db, session_id)
        
        # Query test results
        tests_stmt = select(TestResultModel).where(TestResultModel.session_id == session_id)
        tests_res = await db.execute(tests_stmt)
        test_results = tests_res.scalars().all()

        # Query frame metrics
        frames_stmt = select(FrameMetricModel).where(FrameMetricModel.session_id == session_id)
        frames_res = await db.execute(frames_stmt)
        frames = frames_res.scalars().all()

        # Map to Pydantic schemas
        metadata_schema = SessionMetadataSchema(
            session_id=db_session.session_id,
            client_name=db_session.client_name,
            started_at=db_session.started_at,
            ended_at=db_session.ended_at,
            status=db_session.status
        )

        test_schemas = [
            TestResultSchema(
                test_id=t.test_id,
                session_id=t.session_id,
                eye_tested=t.eye_tested,
                acuity_score=t.acuity_score,
                letters_shown=t.letters_shown,
                letters_correct=t.letters_correct,
                recorded_at=t.recorded_at
            )
            for t in test_results
        ]

        # Query report
        report_stmt = select(ReportModel).where(ReportModel.session_id == session_id)
        report_res = await db.execute(report_stmt)
        db_report = report_res.scalar_one_or_none()

        report_schema = None
        if db_report:
            report_schema = ReportSchema(
                report_id=db_report.report_id,
                session_id=db_report.session_id,
                clinical_assessment=db_report.clinical_assessment,
                risk_flags=db_report.risk_flags,
                recommendations=db_report.recommendations,
                generated_at=db_report.generated_at
            )
        else:
            # Generate report on the fly if it doesn't exist
            report_schema = await self.generate_report(db, session_id)

        frame_schemas = [
            FrameMetricsSchema(
                frame_id=f.frame_id,
                timestamp=f.timestamp,
                ear_left=f.ear_avg,  # map generalized values
                ear_right=f.ear_avg,
                ear_avg=f.ear_avg,
                is_blink_active=f.ear_avg < 0.22,
                gaze_x=f.gaze_x,
                gaze_y=f.gaze_y,
                gaze_velocity=f.gaze_velocity,
                is_fixating=f.is_fixating,
                is_saccade=f.is_saccade
            )
            for f in frames
        ]

        return ReportPayloadSchema(
            metadata=metadata_schema,
            summary=summary,
            frames=frame_schemas,
            test_results=test_schemas,
            report=report_schema
        )

# Global singleton instance
session_service = SessionService()
