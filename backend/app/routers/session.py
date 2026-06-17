from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas.session import (
    SessionStartPayload, 
    SessionMetadataSchema, 
    AggregateSummarySchema, 
    ReportPayloadSchema,
    TestResultCreate,
    TestResultSchema,
    ReportSchema
)
from app.services.session_service import session_service
from app.db.session import get_db

router = APIRouter(prefix="/sessions", tags=["sessions"])

@router.post("/start", response_model=SessionMetadataSchema, status_code=status.HTTP_201_CREATED)
async def start_session(payload: SessionStartPayload, db: AsyncSession = Depends(get_db)):
    """Starts a new tracking session and returns metadata (async with db)."""
    return await session_service.start_session(db, payload.client_name)

@router.post("/{session_id}/stop", response_model=AggregateSummarySchema)
async def stop_session(session_id: str, db: AsyncSession = Depends(get_db)):
    """Stops the active tracking session, aggregates metrics, and returns the summary."""
    summary = await session_service.stop_session(db, session_id)
    if summary is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session with ID '{session_id}' not found."
        )
    return summary

@router.get("/{session_id}/report", response_model=ReportPayloadSchema)
async def get_session_report(session_id: str, db: AsyncSession = Depends(get_db)):
    """Retrieves the complete report payload (metadata, aggregates, tests, and clinical reports)."""
    report = await session_service.get_report(db, session_id)
    if report is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session with ID '{session_id}' not found."
        )
    return report

@router.post("/{session_id}/test-result", response_model=TestResultSchema, status_code=status.HTTP_201_CREATED)
async def add_test_result(session_id: str, payload: TestResultCreate, db: AsyncSession = Depends(get_db)):
    """Logs a Snellen eye acuity test result (LEFT, RIGHT, BOTH) for a session."""
    result = await session_service.add_test_result(db, session_id, payload)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session with ID '{session_id}' not found or inactive."
        )
    return result

@router.post("/{session_id}/generate-report", response_model=ReportSchema, status_code=status.HTTP_201_CREATED)
async def generate_clinical_report(session_id: str, db: AsyncSession = Depends(get_db)):
    """Triggers the LangChain + Ollama NLP engine to compile a structured eye health report."""
    report = await session_service.generate_report(db, session_id)
    if report is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session with ID '{session_id}' not found or session data insufficient."
        )
    return report
