from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional
from io import BytesIO
from datetime import datetime
from ..database import get_db
from ..services.export_service import ExportService

router = APIRouter(prefix="/api/exports", tags=["结果导出"])


@router.get("/applications")
def export_applications(
    pool_id: Optional[str] = Query(None, description="按摇号池过滤"),
    status: Optional[str] = Query(None, description="按状态过滤"),
    db: Session = Depends(get_db)
):
    excel_data = ExportService.generate_application_excel(db, pool_id, status)
    if not excel_data:
        raise HTTPException(status_code=404, detail="无数据可导出")

    filename = f"公租房申请_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx"
    return StreamingResponse(
        BytesIO(excel_data),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/applications/{application_id}/family")
def export_family_detail(application_id: int, db: Session = Depends(get_db)):
    excel_data = ExportService.generate_family_detail_excel(db, application_id)
    if not excel_data:
        raise HTTPException(status_code=404, detail="申请记录不存在")

    filename = f"家庭成员详情_{application_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx"
    return StreamingResponse(
        BytesIO(excel_data),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/applications/{application_id}/history")
def export_processing_history(application_id: int, db: Session = Depends(get_db)):
    excel_data = ExportService.generate_processing_history_excel(db, application_id)
    if not excel_data:
        raise HTTPException(status_code=404, detail="申请记录不存在")

    filename = f"处理历史_{application_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx"
    return StreamingResponse(
        BytesIO(excel_data),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/pools/{pool_id}")
def export_pool_summary(pool_id: str, db: Session = Depends(get_db)):
    excel_data = ExportService.generate_pool_summary_excel(db, pool_id)
    if not excel_data:
        raise HTTPException(status_code=404, detail="摇号池不存在")

    filename = f"摇号池汇总_{pool_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx"
    return StreamingResponse(
        BytesIO(excel_data),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/pools/{pool_id}/applications")
def export_pool_applications(pool_id: str, db: Session = Depends(get_db)):
    excel_data = ExportService.generate_application_excel(db, pool_id=pool_id)
    if not excel_data:
        raise HTTPException(status_code=404, detail="摇号池不存在或无数据")

    filename = f"摇号池申请_{pool_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx"
    return StreamingResponse(
        BytesIO(excel_data),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
