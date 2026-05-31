from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.error_messages import get_user_friendly_message
from app.schemas.common import ApiResponse, PaginatedResponse
from app.schemas.correction import (
    CorrectionCreate,
    CorrectionUpdate,
    CorrectionResponse,
    CorrectionListItem,
    CorrectionBatchRequest,
    CorrectionBatchResponse
)
from app.services.correction_service import correction_service

router = APIRouter(prefix="/corrections", tags=["修正管理"])


@router.get("", response_model=ApiResponse[PaginatedResponse[CorrectionListItem]])
def get_corrections(
    meeting_id: Optional[int] = None,
    operator: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db)
):
    try:
        items, total, total_pages = correction_service.get_correction_list(
            db, meeting_id, operator, page, page_size
        )
        return ApiResponse.success(
            data=PaginatedResponse(
                items=items,
                total=total,
                page=page,
                page_size=page_size,
                total_pages=total_pages
            ),
            user_friendly_message="获取修正记录列表成功～"
        )
    except Exception as e:
        return ApiResponse.error(
            code=500,
            message=str(e),
            user_friendly_message=get_user_friendly_message(e)
        )


@router.get("/{correction_id}", response_model=ApiResponse[CorrectionResponse])
def get_correction(correction_id: int, db: Session = Depends(get_db)):
    try:
        correction = correction_service.get_correction(db, correction_id)
        return ApiResponse.success(
            data=correction,
            user_friendly_message="获取修正记录详情成功～"
        )
    except Exception as e:
        return ApiResponse.error(
            code=500,
            message=str(e),
            user_friendly_message=get_user_friendly_message(e)
        )


@router.post("", response_model=ApiResponse[CorrectionResponse])
def create_correction(correction_in: CorrectionCreate, db: Session = Depends(get_db)):
    try:
        correction = correction_service.create_correction(db, correction_in)
        return ApiResponse.success(
            data=correction,
            user_friendly_message="修正记录创建成功～"
        )
    except Exception as e:
        return ApiResponse.error(
            code=500,
            message=str(e),
            user_friendly_message=get_user_friendly_message(e)
        )


@router.post("/batch", response_model=ApiResponse[CorrectionBatchResponse])
def batch_correct(request: CorrectionBatchRequest, db: Session = Depends(get_db)):
    try:
        result = correction_service.batch_correct(
            db, request.meeting_id, request.corrections, request.operator
        )
        return ApiResponse.success(
            data=result,
            user_friendly_message="批量修正完成～"
        )
    except Exception as e:
        return ApiResponse.error(
            code=500,
            message=str(e),
            user_friendly_message=get_user_friendly_message(e)
        )


@router.put("/{correction_id}", response_model=ApiResponse[CorrectionResponse])
def update_correction(correction_id: int, correction_in: CorrectionUpdate, db: Session = Depends(get_db)):
    try:
        correction = correction_service.update_correction(db, correction_id, correction_in)
        return ApiResponse.success(
            data=correction,
            user_friendly_message="修正记录更新成功～"
        )
    except Exception as e:
        return ApiResponse.error(
            code=500,
            message=str(e),
            user_friendly_message=get_user_friendly_message(e)
        )


@router.delete("/{correction_id}", response_model=ApiResponse)
def delete_correction(correction_id: int, db: Session = Depends(get_db)):
    try:
        correction_service.delete_correction(db, correction_id)
        return ApiResponse.success(
            user_friendly_message="修正记录删除成功～"
        )
    except Exception as e:
        return ApiResponse.error(
            code=500,
            message=str(e),
            user_friendly_message=get_user_friendly_message(e)
        )


@router.get("/meeting/{meeting_id}/stats", response_model=ApiResponse)
def get_correction_stats(meeting_id: int, db: Session = Depends(get_db)):
    try:
        stats = correction_service.get_correction_stats(db, meeting_id)
        return ApiResponse.success(
            data=stats,
            user_friendly_message="获取修正统计成功～"
        )
    except Exception as e:
        return ApiResponse.error(
            code=500,
            message=str(e),
            user_friendly_message=get_user_friendly_message(e)
        )
