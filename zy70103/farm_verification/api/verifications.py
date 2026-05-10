from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from ..database import get_db
from ..schemas.verification import (
    VerificationCreate, VerificationUpdate, VerificationResponse,
    VerificationListResponse, VerificationResultEnum
)
from ..schemas.common import StandardResponse
from ..services.verification_service import verification_service
from ..models.verification import VerificationResult


router = APIRouter(prefix="/api/verifications", tags=["人工核验管理"])


@router.post("", response_model=StandardResponse[dict])
def create_verification(
    verification_data: VerificationCreate,
    db: Session = Depends(get_db)
):
    try:
        result = verification_service.create_verification(db, verification_data)
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


@router.get("/{verification_code}", response_model=StandardResponse[VerificationResponse])
def get_verification(verification_code: str, db: Session = Depends(get_db)):
    verification = verification_service.get_verification_by_code(db, verification_code)
    if not verification:
        raise HTTPException(
            status_code=404,
            detail=f"核验记录【{verification_code}】不存在"
        )
    
    return StandardResponse(
        success=True,
        code=200,
        message=f"查找到核验记录【{verification_code}】",
        data=verification
    )


@router.get("", response_model=StandardResponse[VerificationListResponse])
def list_verifications(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    lesion_code: Optional[str] = Query(None),
    grid_code: Optional[str] = Query(None),
    result: Optional[VerificationResultEnum] = Query(None),
    verified_by: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    is_reverted: Optional[bool] = Query(None),
    db: Session = Depends(get_db)
):
    result_data = verification_service.list_verifications(
        db=db,
        page=page,
        page_size=page_size,
        lesion_code=lesion_code,
        grid_code=grid_code,
        result=VerificationResult(result.value) if result else None,
        verified_by=verified_by,
        is_active=is_active,
        is_reverted=is_reverted
    )
    
    return StandardResponse(
        success=True,
        code=200,
        message=f"共找到{result_data.total}条核验记录",
        data=result_data
    )


@router.get("/statistics/overview", response_model=StandardResponse[dict])
def get_verification_statistics(
    batch_code: Optional[str] = Query(None),
    grid_code: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    stats = verification_service.get_verification_statistics(
        db=db,
        batch_code=batch_code,
        grid_code=grid_code
    )
    
    return StandardResponse(
        success=True,
        code=200,
        message=stats["business_summary"],
        data=stats
    )
