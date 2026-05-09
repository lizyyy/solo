from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any
from ..database import get_db
from ..schemas import RescheduleRequest
from ..services import ExamRescheduleService

router = APIRouter(prefix="/reschedule", tags=["考场重排"])


@router.post("/", response_model=Dict[str, Any])
def reschedule_exams(
    data: RescheduleRequest,
    db: Session = Depends(get_db)
):
    try:
        result = ExamRescheduleService.reschedule_exams(
            db,
            application_ids=data.application_ids,
            exam_date=data.exam_date,
            start_time=data.start_time,
            end_time=data.end_time,
            classroom=data.classroom,
            batch_key=data.batch_key
        )
        db.commit()
        return result
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
