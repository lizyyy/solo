from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from datetime import datetime

from database import get_db
from models import AuditSession, AuditReport
from schemas import ConfirmationRequest, ConfirmationResponse


router = APIRouter(prefix="/confirmation", tags=["Confirmation"])


@router.post("/", response_model=ConfirmationResponse)
async def confirm_report(
    request: ConfirmationRequest,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(AuditSession).where(AuditSession.id == request.session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail=f"Session {request.session_id} not found")
    
    result = await db.execute(
        select(AuditReport).where(
            AuditReport.id == request.report_id,
            AuditReport.session_id == request.session_id
        )
    )
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail=f"Report {request.report_id} not found for session {request.session_id}")
    
    if report.human_confirmed:
        raise HTTPException(
            status_code=400, 
            detail=f"Report {request.report_id} is already confirmed by {report.confirmed_by}"
        )
    
    report.human_confirmed = True
    report.confirmed_by = request.confirmed_by
    report.confirmed_at = datetime.utcnow()
    
    session.status = "confirmed"
    
    await db.commit()
    await db.refresh(report)
    
    return ConfirmationResponse(
        report_id=report.id,
        session_id=report.session_id,
        human_confirmed=report.human_confirmed,
        confirmed_by=report.confirmed_by,
        confirmed_at=report.confirmed_at,
        notes=request.notes,
    )


@router.get("/report/{report_id}")
async def get_confirmation_status(
    report_id: int,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(AuditReport).where(AuditReport.id == report_id)
    )
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail=f"Report {report_id} not found")
    
    return {
        "report_id": report.id,
        "session_id": report.session_id,
        "report_name": report.report_name,
        "human_confirmed": report.human_confirmed,
        "confirmed_by": report.confirmed_by,
        "confirmed_at": report.confirmed_at,
        "created_at": report.created_at,
    }


@router.get("/session/{session_id}/status")
async def get_session_confirmation_status(
    session_id: int,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(AuditSession).where(AuditSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    
    result = await db.execute(
        select(AuditReport).where(AuditReport.session_id == session_id)
    )
    reports = result.scalars().all()
    
    confirmed_reports = sum(1 for r in reports if r.human_confirmed)
    total_reports = len(reports)
    
    return {
        "session_id": session_id,
        "session_name": session.session_name,
        "status": session.status,
        "total_reports": total_reports,
        "confirmed_reports": confirmed_reports,
        "is_fully_confirmed": session.status == "confirmed",
        "reports": [
            {
                "id": r.id,
                "report_name": r.report_name,
                "report_type": r.report_type,
                "format": r.format,
                "human_confirmed": r.human_confirmed,
                "confirmed_by": r.confirmed_by,
                "confirmed_at": r.confirmed_at,
            }
            for r in reports
        ],
    }


@router.post("/revoke/{report_id}")
async def revoke_confirmation(
    report_id: int,
    revoked_by: str,
    reason: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(AuditReport).where(AuditReport.id == report_id)
    )
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail=f"Report {report_id} not found")
    
    if not report.human_confirmed:
        raise HTTPException(status_code=400, detail=f"Report {report_id} is not confirmed")
    
    report.human_confirmed = False
    report.confirmed_by = None
    report.confirmed_at = None
    
    result = await db.execute(
        select(AuditReport).where(
            AuditReport.session_id == report.session_id,
            AuditReport.human_confirmed == True
        )
    )
    other_confirmed = result.scalars().all()
    
    if not other_confirmed:
        session_result = await db.execute(
            select(AuditSession).where(AuditSession.id == report.session_id)
        )
        session = session_result.scalar_one_or_none()
        if session and session.status == "confirmed":
            session.status = "analyzed"
    
    await db.commit()
    
    return {
        "report_id": report_id,
        "revoked_by": revoked_by,
        "revoked_at": datetime.utcnow(),
        "reason": reason or "Confirmation revoked",
        "human_confirmed": False,
    }


@router.get("/history/{session_id}")
async def get_confirmation_history(
    session_id: int,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(AuditSession).where(AuditSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    
    result = await db.execute(
        select(AuditReport).where(AuditReport.session_id == session_id)
    )
    reports = result.scalars().all()
    
    history = []
    for report in reports:
        if report.human_confirmed and report.confirmed_at:
            history.append({
                "report_id": report.id,
                "report_name": report.report_name,
                "report_type": report.report_type,
                "format": report.format,
                "confirmed_by": report.confirmed_by,
                "confirmed_at": report.confirmed_at,
                "action": "confirmed",
            })
    
    history.sort(key=lambda x: x["confirmed_at"], reverse=True)
    
    return {
        "session_id": session_id,
        "session_name": session.session_name,
        "status": session.status,
        "confirmation_history": history,
    }
