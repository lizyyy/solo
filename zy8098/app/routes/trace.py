from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from .. import schemas, services
from ..database import get_db

router = APIRouter(prefix="/api/trace", tags=["trace"])


@router.post("/complaint")
def trace_complaint(request: schemas.ComplaintTraceRequest, db: Session = Depends(get_db)):
    results = services.TraceService.trace_complaint(db, request)
    return {"count": len(results), "results": results}


@router.post("/report")
def get_trace_report(request: schemas.TraceReportRequest, db: Session = Depends(get_db)):
    try:
        report = services.TraceService.generate_trace_report(
            db, request.sample_id, request.box_code
        )
        return report
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/export-report", response_class=PlainTextResponse)
def export_trace_report(request: schemas.TraceReportRequest, db: Session = Depends(get_db)):
    try:
        md_content = services.TraceService.export_report_md(
            db, request.sample_id, request.box_code
        )
        return md_content
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
