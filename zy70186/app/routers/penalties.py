from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.schemas import (
    PenaltyApplyRequest, PenaltyApprovalRequest, 
    PenaltyApprovalResponse, MessageResponse
)
from app.services import PenaltyService, BusinessException

router = APIRouter(prefix="/penalties", tags=["扣罚审批"])


@router.post("/apply", response_model=PenaltyApprovalResponse)
def apply_penalty(data: PenaltyApplyRequest, db: Session = Depends(get_db)):
    try:
        return PenaltyService.apply_penalty(db, data)
    except BusinessException as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/approve", response_model=MessageResponse)
def process_approval(data: PenaltyApprovalRequest, db: Session = Depends(get_db)):
    try:
        result = PenaltyService.process_approval(db, data)
        return MessageResponse(
            success=result["success"],
            message=result["message"],
            data={
                "is_duplicate": result["is_duplicate"],
                "approval_no": result["approval"].approval_no,
                "status": result["approval"].status.value
            }
        )
    except BusinessException as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/pending", response_model=List[PenaltyApprovalResponse])
def list_pending(db: Session = Depends(get_db)):
    return PenaltyService.list_pending(db)


@router.get("/{approval_id}", response_model=PenaltyApprovalResponse)
def get_approval(approval_id: int, db: Session = Depends(get_db)):
    from app.models import PenaltyApproval
    
    approval = db.query(PenaltyApproval).filter(
        PenaltyApproval.id == approval_id
    ).first()
    if not approval:
        raise HTTPException(status_code=404, detail="审批单不存在")
    return approval
