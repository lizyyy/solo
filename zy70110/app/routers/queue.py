from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.database import get_db
from app.models import InspectionQueue, InspectionStatus
from app.schemas import QueueStatisticsResponse, InspectionQueueResponse
from app.services import get_queue_statistics

router = APIRouter(prefix="/queue", tags=["排队管理"])


@router.get("/statistics", response_model=QueueStatisticsResponse)
def get_statistics(db: Session = Depends(get_db)):
    stats = get_queue_statistics(db)
    
    queue_responses = []
    for record in stats["current_queue"]:
        queue_responses.append(InspectionQueueResponse(
            id=record.id,
            appointment_id=record.appointment_id,
            inspection_window_id=record.inspection_window_id,
            window_code=record.inspection_window.window_code,
            queue_number=record.queue_number,
            queue_date=record.queue_date,
            status=record.status,
            checked_in_time=record.checked_in_time,
            inspection_start_time=record.inspection_start_time,
            inspection_end_time=record.inspection_end_time,
            expected_wait_minutes=record.expected_wait_minutes,
            actual_wait_minutes=record.actual_wait_minutes,
            inspector_name=record.inspector_name,
            inspection_notes=record.inspection_notes
        ))
    
    return QueueStatisticsResponse(
        total_waiting=stats["total_waiting"],
        total_in_inspection=stats["total_in_inspection"],
        total_completed_today=stats["total_completed_today"],
        total_skipped_today=stats["total_skipped_today"],
        average_wait_minutes=stats["average_wait_minutes"],
        current_queue=queue_responses
    )


@router.get("/current", response_model=List[InspectionQueueResponse])
def get_current_queue(db: Session = Depends(get_db)):
    from datetime import date
    today = date.today()
    
    records = db.query(InspectionQueue).filter(
        InspectionQueue.queue_date == today,
        or_(
            InspectionQueue.status == InspectionStatus.WAITING,
            InspectionQueue.status == InspectionStatus.IN_PROGRESS
        )
    ).order_by(InspectionQueue.queue_number).all()
    
    return [InspectionQueueResponse(
        id=record.id,
        appointment_id=record.appointment_id,
        inspection_window_id=record.inspection_window_id,
        window_code=record.inspection_window.window_code,
        queue_number=record.queue_number,
        queue_date=record.queue_date,
        status=record.status,
        checked_in_time=record.checked_in_time,
        inspection_start_time=record.inspection_start_time,
        inspection_end_time=record.inspection_end_time,
        expected_wait_minutes=record.expected_wait_minutes,
        actual_wait_minutes=record.actual_wait_minutes,
        inspector_name=record.inspector_name,
        inspection_notes=record.inspection_notes
    ) for record in records]


@router.get("/history", response_model=List[InspectionQueueResponse])
def get_queue_history(db: Session = Depends(get_db)):
    from datetime import date, timedelta
    three_days_ago = date.today() - timedelta(days=3)
    
    records = db.query(InspectionQueue).filter(
        InspectionQueue.queue_date >= three_days_ago
    ).order_by(
        InspectionQueue.queue_date.desc(),
        InspectionQueue.queue_number.desc()
    ).limit(100).all()
    
    return [InspectionQueueResponse(
        id=record.id,
        appointment_id=record.appointment_id,
        inspection_window_id=record.inspection_window_id,
        window_code=record.inspection_window.window_code,
        queue_number=record.queue_number,
        queue_date=record.queue_date,
        status=record.status,
        checked_in_time=record.checked_in_time,
        inspection_start_time=record.inspection_start_time,
        inspection_end_time=record.inspection_end_time,
        expected_wait_minutes=record.expected_wait_minutes,
        actual_wait_minutes=record.actual_wait_minutes,
        inspector_name=record.inspector_name,
        inspection_notes=record.inspection_notes
    ) for record in records]
