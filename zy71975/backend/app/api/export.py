from typing import Optional
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from datetime import datetime
import io

from app.core.database import get_db
from app.core.error_messages import get_user_friendly_message
from app.schemas.common import ApiResponse
from app.services.export_service import export_service

router = APIRouter(prefix="/export", tags=["导出管理"])


@router.get("/meeting/{meeting_id}/raw-data")
def export_raw_data(meeting_id: int, db: Session = Depends(get_db)):
    try:
        content = export_service.export_raw_data(db, meeting_id)
        filename = f"meeting_{meeting_id}_raw_data.csv"

        return StreamingResponse(
            iter([content]),
            media_type="text/csv; charset=utf-8",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )
    except Exception as e:
        return ApiResponse.error(
            code=500,
            message=str(e),
            user_friendly_message=get_user_friendly_message(e)
        )


@router.get("/weekly-report")
def export_weekly_report(
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    db: Session = Depends(get_db)
):
    try:
        content = export_service.export_weekly_report(db, start_date, end_date)

        if start_date and end_date:
            filename = f"weekly_report_{start_date.strftime('%Y%m%d')}_{end_date.strftime('%Y%m%d')}.csv"
        else:
            filename = f"weekly_report_{datetime.now().strftime('%Y%m%d')}.csv"

        return StreamingResponse(
            iter([content]),
            media_type="text/csv; charset=utf-8",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )
    except Exception as e:
        return ApiResponse.error(
            code=500,
            message=str(e),
            user_friendly_message=get_user_friendly_message(e)
        )


@router.get("/weekly-report/data", response_model=ApiResponse)
def get_weekly_report_data(
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    db: Session = Depends(get_db)
):
    try:
        data = export_service.get_weekly_report_data(db, start_date, end_date)
        return ApiResponse.success(
            data=data,
            user_friendly_message="获取周报数据成功～"
        )
    except Exception as e:
        return ApiResponse.error(
            code=500,
            message=str(e),
            user_friendly_message=get_user_friendly_message(e)
        )


@router.post("/meeting/{meeting_id}/save-raw-data", response_model=ApiResponse)
def save_raw_data_file(meeting_id: int, db: Session = Depends(get_db)):
    try:
        content = export_service.export_raw_data(db, meeting_id)
        filename = f"meeting_{meeting_id}_raw_data.csv"
        save_path = export_service.save_export_file(content, filename)
        return ApiResponse.success(
            data={"save_path": save_path},
            user_friendly_message="原始数据保存成功～"
        )
    except Exception as e:
        return ApiResponse.error(
            code=500,
            message=str(e),
            user_friendly_message=get_user_friendly_message(e)
        )


@router.post("/weekly-report/save", response_model=ApiResponse)
def save_weekly_report_file(
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    db: Session = Depends(get_db)
):
    try:
        content = export_service.export_weekly_report(db, start_date, end_date)

        if start_date and end_date:
            filename = f"weekly_report_{start_date.strftime('%Y%m%d')}_{end_date.strftime('%Y%m%d')}.csv"
        else:
            filename = f"weekly_report_{datetime.now().strftime('%Y%m%d')}.csv"

        save_path = export_service.save_export_file(content, filename)
        return ApiResponse.success(
            data={"save_path": save_path},
            user_friendly_message="周报保存成功～"
        )
    except Exception as e:
        return ApiResponse.error(
            code=500,
            message=str(e),
            user_friendly_message=get_user_friendly_message(e)
        )
