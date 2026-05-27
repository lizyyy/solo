from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app import schemas, services
from app.database import get_db

router = APIRouter(prefix="/api/details", tags=["details"])


@router.get("/reference/{reference_no}", response_model=schemas.SettlementDetailResponse)
def get_detail_by_reference(reference_no: str, db: Session = Depends(get_db)):
    detail = services.get_detail_by_reference(db, reference_no)
    if not detail:
        raise HTTPException(status_code=404, detail=f"Detail with reference {reference_no} not found")
    return detail


@router.get("/{detail_id}/traces", response_model=List[schemas.ProcessingTraceResponse])
def get_detail_traces(detail_id: int, db: Session = Depends(get_db)):
    traces = services.get_detail_traces(db, detail_id)
    if not traces:
        raise HTTPException(status_code=404, detail=f"No traces found for detail {detail_id}")
    return traces


@router.get("/reference/{reference_no}/traces", response_model=List[schemas.ProcessingTraceResponse])
def get_traces_by_reference(reference_no: str, db: Session = Depends(get_db)):
    detail = services.get_detail_by_reference(db, reference_no)
    if not detail:
        raise HTTPException(status_code=404, detail=f"Detail with reference {reference_no} not found")
    
    traces = services.get_detail_traces(db, detail.id)
    return traces
