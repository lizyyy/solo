from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import io
import urllib.parse
from app.database import get_db
from app.services.export_service import ExportService

router = APIRouter()


@router.get("/excel")
def export_excel(
    case_no: Optional[str] = None,
    user_id: Optional[str] = None,
    pile_no: Optional[str] = None,
    order_no: Optional[str] = None,
    status: Optional[str] = None,
    batch_no: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db)
):
    service = ExportService(db)
    try:
        excel_data = service.export_to_excel(
            case_no=case_no,
            user_id=user_id,
            pile_no=pile_no,
            order_no=order_no,
            status=status,
            batch_no=batch_no,
            start_date=start_date,
            end_date=end_date
        )

        filename = f"补偿记录_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        encoded_filename = urllib.parse.quote(filename)

        return StreamingResponse(
            io.BytesIO(excel_data),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导出失败: {str(e)}")


@router.get("/{case_no}/logs/excel")
def export_operation_logs(
    case_no: str,
    db: Session = Depends(get_db)
):
    service = ExportService(db)
    try:
        excel_data = service.export_operation_logs(case_no)

        filename = f"操作日志_{case_no}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        encoded_filename = urllib.parse.quote(filename)

        return StreamingResponse(
            io.BytesIO(excel_data),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"
            }
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导出失败: {str(e)}")


@router.get("/statistics")
def get_statistics(
    case_no: Optional[str] = None,
    user_id: Optional[str] = None,
    pile_no: Optional[str] = None,
    order_no: Optional[str] = None,
    status: Optional[str] = None,
    batch_no: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db)
):
    service = ExportService(db)
    try:
        stats = service.get_statistics(
            case_no=case_no,
            user_id=user_id,
            pile_no=pile_no,
            order_no=order_no,
            status=status,
            batch_no=batch_no,
            start_date=start_date,
            end_date=end_date
        )
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"统计失败: {str(e)}")
