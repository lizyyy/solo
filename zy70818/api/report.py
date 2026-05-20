from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from typing import Optional
from enum import Enum

from models.report import ReportType, ReportFormat
from services.report_service import report_generator
from utils.storage import store

router = APIRouter(tags=["报告下载"])


@router.post("/{reconciliation_id}/generate", summary="生成报告")
async def generate_report(
    reconciliation_id: str,
    report_type: ReportType,
    report_format: ReportFormat,
    generated_by: Optional[str] = None
):
    try:
        report = report_generator.generate_report(
            reconciliation_id=reconciliation_id,
            report_type=report_type,
            report_format=report_format,
            generated_by=generated_by
        )
        return {
            "success": True,
            "report_id": report.id,
            "title": report.title,
            "file_path": report.file_path,
            "file_size": report.file_size,
            "statistics": report.statistics
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/download", summary="下载报告文件")
async def download_report(file_path: str):
    try:
        buffer = report_generator.get_report_file(file_path)
        filename = file_path.split('/')[-1]

        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        if file_path.endswith('.csv'):
            media_type = "text/csv"

        return StreamingResponse(
            buffer,
            media_type=media_type,
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{reconciliation_id}/preview", summary="预览报告数据")
async def preview_report(reconciliation_id: str):
    from models.reconciliation import ReconciliationResult
    reconciliation = store.get('reconciliation', reconciliation_id, ReconciliationResult)
    if not reconciliation:
        raise HTTPException(status_code=404, detail="对账任务不存在")

    return {
        "title": reconciliation.name,
        "period": f"{reconciliation.start_date} ~ {reconciliation.end_date}",
        "statistics": {
            "total_inventory": reconciliation.total_inventory_count,
            "total_consumption": reconciliation.total_consumption_count,
            "total_discrepancies": reconciliation.discrepancy_count,
            "unresolved": reconciliation.unresolved_discrepancy_count
        },
        "discrepancy_summary": [
            {"type": d.type, "batch": d.batch_number, "store": d.store_name, "description": d.description}
            for d in reconciliation.discrepancies[:10]
        ]
    }
