from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app.errors import BusinessError
from app.schemas import (
    QueueNumberCreate, QueueNumberResponse,
    QueueNumberBatchCreate, QueueStatusUpdate,
    ProblemRecordResponse
)
from app.services.queue_service import QueueService

router = APIRouter(prefix="/api/queue-numbers", tags=["排队号管理"])


@router.post("/", response_model=QueueNumberResponse, summary="创建单个排队号")
def create_queue_number(data: QueueNumberCreate, db: Session = Depends(get_db)):
    try:
        service = QueueService(db)
        return service.create_queue_number(data)
    except BusinessError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": e.error_code,
                "error_message": e.error_message,
                "error_type": e.error_type,
                "detail": e.detail,
            }
        )


@router.post("/batch/", summary="批量创建排队号（按套餐）")
def create_batch_queue_numbers(data: QueueNumberBatchCreate, db: Session = Depends(get_db)):
    try:
        service = QueueService(db)
        return service.create_batch_queue_numbers(data)
    except BusinessError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": e.error_code,
                "error_message": e.error_message,
                "error_type": e.error_type,
                "detail": e.detail,
            }
        )


@router.get("/{queue_number_id}", response_model=QueueNumberResponse, summary="获取排队号详情")
def get_queue_number(queue_number_id: int, db: Session = Depends(get_db)):
    try:
        service = QueueService(db)
        return service.get_queue_number(queue_number_id)
    except BusinessError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": e.error_code,
                "error_message": e.error_message,
                "error_type": e.error_type,
                "detail": e.detail,
            }
        )


@router.get("/", response_model=List[QueueNumberResponse], summary="查询排队号列表")
def list_queue_numbers(
    patient_id: Optional[int] = Query(None, description="患者ID"),
    package_id: Optional[int] = Query(None, description="套餐ID"),
    status: Optional[str] = Query(None, description="状态: pending/in_progress/completed/rescheduled/cancelled/invalid"),
    project_type: Optional[str] = Query(None, description="项目类型: fasting/post_meal/unrestricted"),
    db: Session = Depends(get_db)
):
    service = QueueService(db)
    return service.list_queue_numbers(
        patient_id=patient_id,
        package_id=package_id,
        status=status,
        project_type=project_type,
    )


@router.patch("/{queue_number_id}/status/", response_model=QueueNumberResponse, summary="更新排队号状态")
def update_queue_status(
    queue_number_id: int,
    data: QueueStatusUpdate,
    db: Session = Depends(get_db)
):
    try:
        service = QueueService(db)
        return service.update_queue_status(queue_number_id, data.new_status)
    except BusinessError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": e.error_code,
                "error_message": e.error_message,
                "error_type": e.error_type,
                "detail": e.detail,
            }
        )


@router.post("/{queue_number_id}/reschedule/", response_model=QueueNumberResponse, summary="改约排队号")
def reschedule_queue(queue_number_id: int, db: Session = Depends(get_db)):
    try:
        service = QueueService(db)
        return service.reschedule_queue(queue_number_id)
    except BusinessError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": e.error_code,
                "error_message": e.error_message,
                "error_type": e.error_type,
                "detail": e.detail,
            }
        )


@router.post("/{queue_number_id}/reactivate/", response_model=QueueNumberResponse, summary="重新激活已改约的排队号")
def reactivate_queue(queue_number_id: int, db: Session = Depends(get_db)):
    try:
        service = QueueService(db)
        return service.reactivate_rescheduled_queue(queue_number_id)
    except BusinessError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": e.error_code,
                "error_message": e.error_message,
                "error_type": e.error_type,
                "detail": e.detail,
            }
        )


@router.get("/problems/", response_model=List[ProblemRecordResponse], summary="获取问题记录列表（脏数据）")
def list_problem_records(limit: int = Query(100, ge=1, le=1000), db: Session = Depends(get_db)):
    service = QueueService(db)
    return service.get_problem_records(limit=limit)


@router.get("/validation/rules/", summary="获取排队验证规则说明")
def get_validation_rules(db: Session = Depends(get_db)):
    service = QueueService(db)
    return service.get_queue_validation_rules()
