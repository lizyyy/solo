from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime

from app.database import get_db
from app.services.export_service import ExportService

router = APIRouter(prefix="/export", tags=["数据导出"])


@router.get("/settlements/csv", response_class=PlainTextResponse)
async def export_settlements_csv(
    machine_id: Optional[str] = Query(None, description="机器编号"),
    start_date: Optional[str] = Query(None, description="开始日期 (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="结束日期 (YYYY-MM-DD)"),
    db: Session = Depends(get_db)
):
    try:
        start_dt = None
        end_dt = None
        
        if start_date:
            start_dt = datetime.fromisoformat(f"{start_date}T00:00:00")
        if end_date:
            end_dt = datetime.fromisoformat(f"{end_date}T23:59:59")
        
        service = ExportService(db)
        csv_content = service.export_settlements_csv(
            machine_id=machine_id,
            start_date=start_dt,
            end_date=end_dt
        )
        
        if not csv_content:
            raise HTTPException(status_code=404, detail="没有可导出的数据")
        
        return PlainTextResponse(
            content=csv_content,
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename=settlements_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导出失败: {str(e)}")


@router.get("/settlements/markdown", response_class=PlainTextResponse)
async def export_settlements_markdown(
    machine_id: Optional[str] = Query(None, description="机器编号"),
    start_date: Optional[str] = Query(None, description="开始日期 (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="结束日期 (YYYY-MM-DD)"),
    db: Session = Depends(get_db)
):
    try:
        start_dt = None
        end_dt = None
        
        if start_date:
            start_dt = datetime.fromisoformat(f"{start_date}T00:00:00")
        if end_date:
            end_dt = datetime.fromisoformat(f"{end_date}T23:59:59")
        
        service = ExportService(db)
        md_content = service.export_settlements_markdown(
            machine_id=machine_id,
            start_date=start_dt,
            end_date=end_dt
        )
        
        return PlainTextResponse(
            content=md_content,
            media_type="text/markdown",
            headers={
                "Content-Disposition": f"attachment; filename=settlement_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导出失败: {str(e)}")


@router.get("/anomalies/csv", response_class=PlainTextResponse)
async def export_anomalies_csv(
    machine_id: Optional[str] = Query(None, description="机器编号"),
    resolved: Optional[bool] = Query(None, description="是否已解决"),
    db: Session = Depends(get_db)
):
    try:
        service = ExportService(db)
        csv_content = service.export_anomalies_csv(
            machine_id=machine_id,
            resolved=resolved
        )
        
        if not csv_content:
            raise HTTPException(status_code=404, detail="没有可导出的数据")
        
        return PlainTextResponse(
            content=csv_content,
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename=anomalies_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导出失败: {str(e)}")


@router.get("/anomalies/markdown", response_class=PlainTextResponse)
async def export_anomalies_markdown(
    machine_id: Optional[str] = Query(None, description="机器编号"),
    resolved: Optional[bool] = Query(None, description="是否已解决"),
    db: Session = Depends(get_db)
):
    try:
        service = ExportService(db)
        md_content = service.export_anomalies_markdown(
            machine_id=machine_id,
            resolved=resolved
        )
        
        return PlainTextResponse(
            content=md_content,
            media_type="text/markdown",
            headers={
                "Content-Disposition": f"attachment; filename=anomaly_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导出失败: {str(e)}")
