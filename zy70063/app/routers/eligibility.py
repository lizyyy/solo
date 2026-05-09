from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..schemas import EligibilityCheckRequest, EligibilityCheckResult
from ..services import EligibilityService

router = APIRouter(prefix="/eligibility", tags=["资格校验"])


@router.post("/check", response_model=EligibilityCheckResult)
def check_eligibility(
    data: EligibilityCheckRequest,
    db: Session = Depends(get_db)
):
    try:
        return EligibilityService.check_eligibility(
            db,
            student_id=data.student_id,
            exam_id=data.exam_id
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
