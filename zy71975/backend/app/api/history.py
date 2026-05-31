from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime

from app.core.database import get_db
from app.core.error_messages import get_user_friendly_message
from app.schemas.common import ApiResponse, PaginatedResponse
from app.models.operation_log import OperationLog
from app.models.meeting import Meeting
from app.models.compare import CompareResult
from app.models.correction import CorrectionRecord

router = APIRouter(prefix="/history", tags=["历史记录"])


@router.get("/operations", response_model=ApiResponse[PaginatedResponse])
def get_operation_logs(
    meeting_id: Optional[int] = None,
    operation_type: Optional[str] = None,
    operator: Optional[str] = None,
    status: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db)
):
    try:
        query = db.query(OperationLog).filter(OperationLog.is_deleted == False)

        if meeting_id:
            query = query.filter(OperationLog.meeting_id == meeting_id)
        if operation_type:
            query = query.filter(OperationLog.operation_type == operation_type)
        if operator:
            query = query.filter(OperationLog.operator == operator)
        if status:
            query = query.filter(OperationLog.status == status)
        if start_date:
            query = query.filter(OperationLog.created_at >= start_date)
        if end_date:
            from datetime import timedelta
            query = query.filter(OperationLog.created_at <= end_date + timedelta(days=1))

        query = query.order_by(OperationLog.created_at.desc())

        total = query.count()
        skip = (page - 1) * page_size
        items = query.offset(skip).limit(page_size).all()
        total_pages = (total + page_size - 1) // page_size

        return ApiResponse.success(
            data=PaginatedResponse(
                items=items,
                total=total,
                page=page,
                page_size=page_size,
                total_pages=total_pages
            ),
            user_friendly_message="获取操作日志成功～"
        )
    except Exception as e:
        return ApiResponse.error(
            code=500,
            message=str(e),
            user_friendly_message=get_user_friendly_message(e)
        )


@router.get("/meetings", response_model=ApiResponse[PaginatedResponse])
def get_meeting_history(
    keyword: Optional[str] = None,
    status: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    page: int = 1,
    page_size: int = 10,
    db: Session = Depends(get_db)
):
    try:
        from app.repositories.meeting_repo import meeting_repo
        items, total, total_pages = meeting_repo.search(
            db, keyword, status, start_date, end_date, page, page_size
        )
        return ApiResponse.success(
            data=PaginatedResponse(
                items=items,
                total=total,
                page=page,
                page_size=page_size,
                total_pages=total_pages
            ),
            user_friendly_message="获取会议历史成功～"
        )
    except Exception as e:
        return ApiResponse.error(
            code=500,
            message=str(e),
            user_friendly_message=get_user_friendly_message(e)
        )


@router.get("/meeting/{meeting_id}/compare-history", response_model=ApiResponse)
def get_compare_history(meeting_id: int, db: Session = Depends(get_db)):
    try:
        compare_results = db.query(CompareResult).filter(
            CompareResult.meeting_id == meeting_id,
            CompareResult.is_deleted == False
        ).order_by(CompareResult.created_at.desc()).all()

        corrections = db.query(CorrectionRecord).filter(
            CorrectionRecord.meeting_id == meeting_id,
            CorrectionRecord.is_deleted == False
        ).order_by(CorrectionRecord.created_at.desc()).all()

        operations = db.query(OperationLog).filter(
            OperationLog.meeting_id == meeting_id,
            OperationLog.is_deleted == False
        ).order_by(OperationLog.created_at.desc()).all()

        return ApiResponse.success(
            data={
                "compare_results": compare_results,
                "corrections": corrections,
                "operations": operations
            },
            user_friendly_message="获取会议历史详情成功～"
        )
    except Exception as e:
        return ApiResponse.error(
            code=500,
            message=str(e),
            user_friendly_message=get_user_friendly_message(e)
        )


@router.get("/stats/summary", response_model=ApiResponse)
def get_history_stats(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db)
):
    try:
        if end_date is None:
            end_date = datetime.now()
        if start_date is None:
            from datetime import timedelta
            start_date = end_date - timedelta(days=30)

        meetings = db.query(Meeting).filter(
            Meeting.is_deleted == False,
            Meeting.created_at >= start_date,
            Meeting.created_at <= end_date
        ).all()

        total_meetings = len(meetings)
        total_questions = sum(m.total_questions for m in meetings)
        total_correct = sum(m.correct_count for m in meetings)
        total_errors = sum(m.error_count for m in meetings)

        total_operations = db.query(OperationLog).filter(
            OperationLog.is_deleted == False,
            OperationLog.created_at >= start_date,
            OperationLog.created_at <= end_date
        ).count()

        total_corrections = db.query(CorrectionRecord).filter(
            CorrectionRecord.is_deleted == False,
            CorrectionRecord.created_at >= start_date,
            CorrectionRecord.created_at <= end_date
        ).count()

        return ApiResponse.success(
            data={
                "period": {
                    "start_date": start_date.strftime("%Y-%m-%d"),
                    "end_date": end_date.strftime("%Y-%m-%d")
                },
                "total_meetings": total_meetings,
                "total_questions": total_questions,
                "total_correct": total_correct,
                "total_errors": total_errors,
                "accuracy": f"{(total_correct / total_questions * 100):.1f}%" if total_questions > 0 else "0%",
                "total_operations": total_operations,
                "total_corrections": total_corrections
            },
            user_friendly_message="获取历史统计成功～"
        )
    except Exception as e:
        return ApiResponse.error(
            code=500,
            message=str(e),
            user_friendly_message=get_user_friendly_message(e)
        )
