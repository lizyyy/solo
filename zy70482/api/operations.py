from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from schemas import CandidateListCreate, CandidateListResponse, BatchOperationPreview
from services import create_candidate_list, get_candidate_list_materials, execute_candidate_list
from models import CandidateList, OperationLog
import json

router = APIRouter()


@router.post("/candidates", response_model=CandidateListResponse)
def create_candidate(candidate_data: CandidateListCreate, db: Session = Depends(get_db)):
    try:
        candidate = create_candidate_list(db, candidate_data)
        candidate.target_ids = json.loads(candidate.target_ids)
        return candidate
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/candidates", response_model=List[CandidateListResponse])
def list_candidates(db: Session = Depends(get_db)):
    candidates = db.query(CandidateList).order_by(CandidateList.created_at.desc()).all()
    for c in candidates:
        c.target_ids = json.loads(c.target_ids)
    return candidates


@router.get("/candidates/{candidate_id}/preview", response_model=BatchOperationPreview)
def preview_candidate_operation(candidate_id: int, db: Session = Depends(get_db)):
    try:
        candidate, materials = get_candidate_list_materials(db, candidate_id)
        return BatchOperationPreview(
            operation_type=candidate.operation_type,
            candidate_list_id=candidate.id,
            affected_count=len(materials),
            affected_materials=materials
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/candidates/{candidate_id}/execute", response_model=CandidateListResponse)
def execute_candidate(candidate_id: int, operator: str, db: Session = Depends(get_db)):
    try:
        candidate = execute_candidate_list(db, candidate_id, operator)
        candidate.target_ids = json.loads(candidate.target_ids)
        return candidate
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/logs")
def list_operation_logs(limit: int = 100, db: Session = Depends(get_db)):
    logs = db.query(OperationLog).order_by(OperationLog.created_at.desc()).limit(limit).all()
    for log in logs:
        log.target_ids = json.loads(log.target_ids)
    return logs
