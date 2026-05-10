from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from ..database import get_db
from ..schemas.verification import RollbackRequest
from ..schemas.common import StandardResponse
from ..services.rollback_service import rollback_service


router = APIRouter(prefix="/api/rollbacks", tags=["误报回滚管理"])


@router.post("", response_model=StandardResponse[dict])
def rollback_verification(
    request: RollbackRequest,
    db: Session = Depends(get_db)
):
    try:
        if request.verification_code:
            result = rollback_service.rollback_verification(
                db=db,
                verification_code=request.verification_code,
                rollback_reason=request.rollback_reason,
                rolled_by=request.rolled_by
            )
        elif request.lesion_code:
            result = rollback_service.rollback_false_positive(
                db=db,
                lesion_code=request.lesion_code,
                rollback_reason=request.rollback_reason,
                rolled_by=request.rolled_by
            )
        else:
            raise ValueError("必须提供核验编号或病斑编号")
        
        return StandardResponse(
            success=True,
            code=200,
            message=result["business_message"],
            data=result
        )
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )


@router.post("/false-positive/{lesion_code}", response_model=StandardResponse[dict])
def rollback_false_positive(
    lesion_code: str,
    rollback_reason: str = Query(..., description="回滚原因"),
    rolled_by: str = Query(..., description="回滚人"),
    db: Session = Depends(get_db)
):
    try:
        result = rollback_service.rollback_false_positive(
            db=db,
            lesion_code=lesion_code,
            rollback_reason=rollback_reason,
            rolled_by=rolled_by
        )
        
        return StandardResponse(
            success=True,
            code=200,
            message=result["business_message"],
            data=result
        )
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )


@router.get("/history", response_model=StandardResponse[dict])
def get_rollback_history(
    lesion_code: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    result = rollback_service.get_rollback_history(
        db=db,
        lesion_code=lesion_code,
        page=page,
        page_size=page_size
    )
    
    return StandardResponse(
        success=True,
        code=200,
        message=result["business_message"],
        data=result
    )
