from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional
import io

from app.database import get_db
from app.report_exporter import ReportExporter
from app.schemas import ReportResponse, ReportFormat

router = APIRouter(prefix="/api/report", tags=["报告导出"])


@router.get("/export", response_model=ReportResponse)
async def export_report(
    format: ReportFormat = Query(ReportFormat.JSON, description="导出格式"),
    start_time: Optional[datetime] = Query(None, description="起始时间"),
    end_time: Optional[datetime] = Query(None, description="结束时间"),
    include_confirmed: bool = Query(False, description="是否包含已确认的异常"),
    db: Session = Depends(get_db)
):
    if format == ReportFormat.MARKDOWN:
        content = ReportExporter.export_to_markdown(db, start_time, end_time, include_confirmed)
        return ReportResponse(
            success=True,
            format="markdown",
            content=content,
            message="Markdown报告生成成功"
        )
    elif format == ReportFormat.CSV:
        content = ReportExporter.export_to_csv(db, start_time, end_time, include_confirmed)
        return ReportResponse(
            success=True,
            format="csv",
            content=content,
            message="CSV报告生成成功"
        )
    else:
        content = ReportExporter.export_to_json(db, start_time, end_time, include_confirmed)
        return ReportResponse(
            success=True,
            format="json",
            content=None,
            message="JSON报告生成成功，使用/download端点下载文件"
        )


@router.get("/download")
async def download_report(
    format: ReportFormat = Query(ReportFormat.MARKDOWN, description="导出格式"),
    start_time: Optional[datetime] = Query(None, description="起始时间"),
    end_time: Optional[datetime] = Query(None, description="结束时间"),
    include_confirmed: bool = Query(False, description="是否包含已确认的异常"),
    db: Session = Depends(get_db)
):
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    if format == ReportFormat.MARKDOWN:
        content = ReportExporter.export_to_markdown(db, start_time, end_time, include_confirmed)
        media_type = "text/markdown; charset=utf-8"
        filename = f"safety_report_{timestamp}.md"
    elif format == ReportFormat.CSV:
        content = ReportExporter.export_to_csv(db, start_time, end_time, include_confirmed)
        media_type = "text/csv; charset=utf-8"
        filename = f"safety_report_{timestamp}.csv"
    else:
        import json
        content = json.dumps(
            ReportExporter.export_to_json(db, start_time, end_time, include_confirmed),
            ensure_ascii=False,
            indent=2
        )
        media_type = "application/json; charset=utf-8"
        filename = f"safety_report_{timestamp}.json"
    
    output = io.BytesIO()
    output.write(content.encode('utf-8'))
    output.seek(0)
    
    return StreamingResponse(
        output,
        media_type=media_type,
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )


@router.post("/save", response_model=ReportResponse)
async def save_report_to_file(
    format: ReportFormat = Query(ReportFormat.MARKDOWN, description="导出格式"),
    start_time: Optional[datetime] = Query(None, description="起始时间"),
    end_time: Optional[datetime] = Query(None, description="结束时间"),
    include_confirmed: bool = Query(False, description="是否包含已确认的异常"),
    db: Session = Depends(get_db)
):
    filepath = ReportExporter.save_report_to_file(
        db,
        format=format.value,
        start_time=start_time,
        end_time=end_time,
        include_confirmed=include_confirmed
    )
    
    return ReportResponse(
        success=True,
        format=format.value,
        file_path=str(filepath),
        message=f"报告已保存至: {filepath}"
    )
