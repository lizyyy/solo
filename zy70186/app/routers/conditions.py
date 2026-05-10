from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.schemas import ReleaseConditionCreate, ReleaseConditionResponse
from app.services import ReleaseConditionService, BusinessException

router = APIRouter(prefix="/release-conditions", tags=["释放条件"])


@router.post("", response_model=ReleaseConditionResponse)
def create_condition(data: ReleaseConditionCreate, db: Session = Depends(get_db)):
    try:
        return ReleaseConditionService.create_condition(db, data)
    except BusinessException as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/account/{account_id}", response_model=List[ReleaseConditionResponse])
def list_conditions(account_id: int, db: Session = Depends(get_db)):
    return ReleaseConditionService.list_by_account(db, account_id)


@router.post("/{condition_id}/meet", response_model=ReleaseConditionResponse)
def meet_condition(condition_id: int, met_by: str = None, db: Session = Depends(get_db)):
    try:
        return ReleaseConditionService.meet_condition(db, condition_id, met_by)
    except BusinessException as e:
        raise HTTPException(status_code=400, detail=str(e))
