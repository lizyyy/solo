from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse, Response
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional
from io import BytesIO

from app.models.database import get_db
from app.services.export_service import ExportService

router = APIRouter(prefix="/exports", tags=["导出报表"])


@router.get("/summary")
def get_summary(
    area: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
):
    service = ExportService(db)
    try:
        summary = service.get_area_summary(area, start_date, end_date, status)
        statistics = service.get_statistics_summary(area, start_date, end_date)
        return {
            "work_orders": summary,
            "statistics": statistics,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/excel")
def export_excel(
    area: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
):
    service = ExportService(db)
    try:
        excel_data = service.export_to_excel(
            area=area,
            start_date=start_date,
            end_date=end_date,
            status=status,
        )

        filename = f"巡检异常汇总_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx"

        return Response(
            content=excel_data,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            },
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/csv")
def export_csv(
    area: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
):
    service = ExportService(db)
    try:
        csv_data = service.export_to_csv(
            area=area,
            start_date=start_date,
            end_date=end_date,
            status=status,
        )

        filename = f"巡检异常汇总_{datetime.now().strftime('%Y%m%d%H%M%S')}.csv"

        return Response(
            content=csv_data.encode("utf-8-sig"),
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            },
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/statistics")
def get_statistics(
    area: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db),
):
    service = ExportService(db)
    try:
        return service.get_statistics_summary(area, start_date, end_date)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
