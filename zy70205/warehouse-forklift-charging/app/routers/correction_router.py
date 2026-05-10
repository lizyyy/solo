from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.schemas.schemas import ManualCorrectionRequest, APIResponse
from app.services.correction_service import CorrectionService

router = APIRouter(prefix="/api/correction", tags=["人工修正"])

@router.post("/apply", response_model=APIResponse)
def apply_correction(data: ManualCorrectionRequest, db: Session = Depends(get_db)):
    service = CorrectionService(db)
    result = service.apply_correction(data)
    
    return APIResponse(
        success=result.get("success", False),
        code=result.get("code", "ERROR"),
        message=result.get("message", "操作失败"),
        data=result.get("data"),
        errors=result.get("errors")
    )

@router.get("/history", response_model=APIResponse)
def get_correction_history(
    entity_type: Optional[str] = None,
    entity_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    service = CorrectionService(db)
    history = service.get_correction_history(entity_type, entity_id)
    
    return APIResponse(
        success=True,
        code="OK",
        message="查询成功",
        data={
            "history": history,
            "total": len(history)
        }
    )
