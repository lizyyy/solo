from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime

from app.database import get_db
from app.auth import allow_supervisor, allow_all_authenticated
from app import models
from app.crud.export_crud import export_crud
from app.models import BatchStatus

router = APIRouter(prefix="/exports", tags=["数据导出"])


@router.get("/summary")
async def export_summary(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    status: Optional[BatchStatus] = None,
    format: str = Query("excel", regex="^(excel|json)$"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(allow_supervisor)
):
    if format == "excel":
        excel_data = export_crud.export_to_excel(
            db, "summary", start_date=start_date, end_date=end_date, status=status
        )
        filename = f"batch_summary_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        return Response(
            content=excel_data,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    else:
        df = export_crud.generate_summary_report(
            db, start_date=start_date, end_date=end_date, status=status
        )
        return df.to_dict(orient="records")


@router.get("/box-detail")
async def export_box_detail(
    batch_id: Optional[int] = None,
    format: str = Query("excel", regex="^(excel|json)$"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(allow_all_authenticated)
):
    if format == "excel":
        excel_data = export_crud.export_to_excel(db, "box_detail", batch_id=batch_id)
        filename = f"box_detail_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        return Response(
            content=excel_data,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    else:
        df = export_crud.generate_box_detail_report(db, batch_id=batch_id)
        return df.to_dict(orient="records")


@router.get("/dirty-records")
async def export_dirty_records(
    batch_id: Optional[int] = None,
    include_resolved: bool = False,
    format: str = Query("excel", regex="^(excel|json)$"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(allow_supervisor)
):
    if format == "excel":
        excel_data = export_crud.export_to_excel(
            db, "dirty_records", batch_id=batch_id, include_resolved=include_resolved
        )
        filename = f"dirty_records_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        return Response(
            content=excel_data,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    else:
        df = export_crud.generate_dirty_records_report(
            db, batch_id=batch_id, include_resolved=include_resolved
        )
        return df.to_dict(orient="records")


@router.get("/batches/{batch_id}/status-changes")
async def get_batch_status_changes(
    batch_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(allow_all_authenticated)
):
    return export_crud.get_batch_status_changes(db, batch_id)
