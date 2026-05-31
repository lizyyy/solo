from typing import Optional
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from app.core.database import get_db
from app.core.error_messages import get_user_friendly_message
from app.schemas.common import ApiResponse, PaginatedResponse
from app.schemas.meeting import (
    MeetingCreate,
    MeetingUpdate,
    MeetingResponse,
    MeetingListItem,
    MeetingUploadResponse,
    MeetingAnalyzeResponse
)
from app.services.meeting_service import meeting_service

router = APIRouter(prefix="/meetings", tags=["会议管理"])


@router.get("", response_model=ApiResponse[PaginatedResponse[MeetingListItem]])
def get_meetings(
    keyword: Optional[str] = None,
    status: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    page: int = 1,
    page_size: int = 10,
    db: Session = Depends(get_db)
):
    try:
        items, total, total_pages = meeting_service.get_meeting_list(
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
            user_friendly_message="获取会议列表成功～"
        )
    except Exception as e:
        return ApiResponse.error(
            code=500,
            message=str(e),
            user_friendly_message=get_user_friendly_message(e)
        )


@router.get("/{meeting_id}", response_model=ApiResponse[MeetingResponse])
def get_meeting(meeting_id: int, db: Session = Depends(get_db)):
    try:
        meeting = meeting_service.get_meeting(db, meeting_id)
        return ApiResponse.success(
            data=meeting,
            user_friendly_message="获取会议详情成功～"
        )
    except Exception as e:
        return ApiResponse.error(
            code=500,
            message=str(e),
            user_friendly_message=get_user_friendly_message(e)
        )


@router.get("/no/{meeting_no}", response_model=ApiResponse[MeetingResponse])
def get_meeting_by_no(meeting_no: str, db: Session = Depends(get_db)):
    try:
        meeting = meeting_service.get_meeting_by_no(db, meeting_no)
        return ApiResponse.success(
            data=meeting,
            user_friendly_message="获取会议详情成功～"
        )
    except Exception as e:
        return ApiResponse.error(
            code=500,
            message=str(e),
            user_friendly_message=get_user_friendly_message(e)
        )


@router.post("", response_model=ApiResponse[MeetingResponse])
def create_meeting(meeting_in: MeetingCreate, db: Session = Depends(get_db)):
    try:
        meeting = meeting_service.create_meeting(db, meeting_in)
        return ApiResponse.success(
            data=meeting,
            user_friendly_message="会议创建成功～"
        )
    except Exception as e:
        return ApiResponse.error(
            code=500,
            message=str(e),
            user_friendly_message=get_user_friendly_message(e)
        )


@router.post("/upload", response_model=ApiResponse[MeetingUploadResponse])
def upload_meeting(
    file: UploadFile = File(...),
    title: str = Form(...),
    meeting_no: str = Form(...),
    db: Session = Depends(get_db)
):
    try:
        file_content = file.file.read()
        meeting = meeting_service.upload_and_create(
            db, file_content, file.filename or "unknown.txt", title, meeting_no
        )
        return ApiResponse.success(
            data=meeting,
            user_friendly_message="文件上传成功，正在处理中～"
        )
    except Exception as e:
        return ApiResponse.error(
            code=500,
            message=str(e),
            user_friendly_message=get_user_friendly_message(e)
        )


@router.post("/{meeting_id}/analyze", response_model=ApiResponse[MeetingAnalyzeResponse])
def analyze_meeting(meeting_id: int, db: Session = Depends(get_db)):
    try:
        result = meeting_service.analyze_meeting(db, meeting_id)
        return ApiResponse.success(
            data=result,
            user_friendly_message="质检分析完成～"
        )
    except Exception as e:
        return ApiResponse.error(
            code=500,
            message=str(e),
            user_friendly_message=get_user_friendly_message(e)
        )


@router.put("/{meeting_id}", response_model=ApiResponse[MeetingResponse])
def update_meeting(meeting_id: int, meeting_in: MeetingUpdate, db: Session = Depends(get_db)):
    try:
        meeting = meeting_service.update_meeting(db, meeting_id, meeting_in)
        return ApiResponse.success(
            data=meeting,
            user_friendly_message="会议更新成功～"
        )
    except Exception as e:
        return ApiResponse.error(
            code=500,
            message=str(e),
            user_friendly_message=get_user_friendly_message(e)
        )


@router.delete("/{meeting_id}", response_model=ApiResponse)
def delete_meeting(meeting_id: int, db: Session = Depends(get_db)):
    try:
        meeting_service.delete_meeting(db, meeting_id)
        return ApiResponse.success(
            user_friendly_message="会议删除成功～"
        )
    except Exception as e:
        return ApiResponse.error(
            code=500,
            message=str(e),
            user_friendly_message=get_user_friendly_message(e)
        )


@router.get("/recent", response_model=ApiResponse[list[MeetingListItem]])
def get_recent_meetings(days: int = 7, limit: int = 10, db: Session = Depends(get_db)):
    try:
        meetings = meeting_service.get_recent_meetings(db, days, limit)
        return ApiResponse.success(
            data=meetings,
            user_friendly_message="获取最近会议成功～"
        )
    except Exception as e:
        return ApiResponse.error(
            code=500,
            message=str(e),
            user_friendly_message=get_user_friendly_message(e)
        )
