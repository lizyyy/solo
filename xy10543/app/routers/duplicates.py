from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import APIResponse, DuplicateCandidateResponse
from app.services import DuplicateService

router = APIRouter(prefix="/api/duplicates", tags=["重复识别"])

@router.post("/scan", response_model=APIResponse)
def scan_duplicates(db: Session = Depends(get_db)):
    candidates = DuplicateService.scan_duplicates(db)
    return APIResponse(
        success=True,
        code="SCAN_COMPLETED",
        message=f"扫描完成，新增 {len(candidates)} 条重复候选",
        data=[DuplicateCandidateResponse.model_validate(c).model_dump() for c in candidates]
    )

@router.get("/pending", response_model=APIResponse)
def get_pending_candidates(db: Session = Depends(get_db)):
    candidates = DuplicateService.get_pending_candidates(db)
    return APIResponse(
        success=True,
        code="OK",
        message=f"待处理重复候选: {len(candidates)} 条",
        data=[DuplicateCandidateResponse.model_validate(c).model_dump() for c in candidates]
    )

@router.post("/{candidate_id}/resolve", response_model=APIResponse)
def resolve_candidate(candidate_id: int, db: Session = Depends(get_db)):
    candidate = DuplicateService.resolve_candidate(db, candidate_id)
    if not candidate:
        return APIResponse(
            success=False,
            code="CANDIDATE_NOT_FOUND",
            message=f"重复候选 {candidate_id} 不存在",
            data=None
        )
    return APIResponse(
        success=True,
        code="RESOLVED",
        message=f"重复候选 {candidate_id} 已标记为已处理",
        data=DuplicateCandidateResponse.model_validate(candidate).model_dump()
    )
