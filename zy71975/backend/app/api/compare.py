from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.error_messages import get_user_friendly_message
from app.schemas.common import ApiResponse, PaginatedResponse
from app.schemas.compare import (
    CompareRequest,
    CompareExecuteResponse,
    CompareResultResponse,
    CompareResultListItem
)
from app.services.compare_service import compare_service

router = APIRouter(prefix="/compare", tags=["智能比对"])


@router.post("/execute", response_model=ApiResponse[CompareExecuteResponse])
def execute_compare(request: CompareRequest, db: Session = Depends(get_db)):
    try:
        result = compare_service.execute_compare(db, request)
        return ApiResponse.success(
            data=result,
            user_friendly_message="智能比对完成～"
        )
    except Exception as e:
        return ApiResponse.error(
            code=500,
            message=str(e),
            user_friendly_message=get_user_friendly_message(e)
        )


@router.get("/meeting/{meeting_id}", response_model=ApiResponse[PaginatedResponse[CompareResultListItem]])
def get_compare_results(
    meeting_id: int,
    status: Optional[str] = None,
    is_affected_by_version: Optional[bool] = None,
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db)
):
    try:
        items, total, total_pages = compare_service.get_compare_results(
            db, meeting_id, status, is_affected_by_version, page, page_size
        )
        return ApiResponse.success(
            data=PaginatedResponse(
                items=items,
                total=total,
                page=page,
                page_size=page_size,
                total_pages=total_pages
            ),
            user_friendly_message="获取比对结果成功～"
        )
    except Exception as e:
        return ApiResponse.error(
            code=500,
            message=str(e),
            user_friendly_message=get_user_friendly_message(e)
        )


@router.get("/{result_id}", response_model=ApiResponse[CompareResultResponse])
def get_compare_result(result_id: int, db: Session = Depends(get_db)):
    try:
        result = compare_service.get_compare_result(db, result_id)
        return ApiResponse.success(
            data=result,
            user_friendly_message="获取比对详情成功～"
        )
    except Exception as e:
        return ApiResponse.error(
            code=500,
            message=str(e),
            user_friendly_message=get_user_friendly_message(e)
        )


@router.get("/meeting/{meeting_id}/affected", response_model=ApiResponse[list[CompareResultListItem]])
def get_affected_results(meeting_id: int, db: Session = Depends(get_db)):
    try:
        items = compare_service.get_affected_results(db, meeting_id)
        return ApiResponse.success(
            data=items,
            user_friendly_message="获取受版本影响的比对结果成功～"
        )
    except Exception as e:
        return ApiResponse.error(
            code=500,
            message=str(e),
            user_friendly_message=get_user_friendly_message(e)
        )
