from typing import Annotated, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from hazardous_gate.audit import AuditService
from hazardous_gate.exporters import CSVExporter, MarkdownExporter
from hazardous_gate.importers import CSVImporter
from hazardous_gate.models.schemas import ImportResult
from hazardous_gate.storage import CourseUsageCRUD, get_async_session

router = APIRouter(prefix="/import-export", tags=["导入导出"])

SessionDep = Annotated[AsyncSession, Depends(get_async_session)]


@router.post("/inventory/csv", response_model=ImportResult)
async def import_inventory_csv(
    db: SessionDep,
    file: UploadFile = File(..., description="CSV文件"),
    encoding: str = Query("utf-8", description="文件编码"),
) -> ImportResult:
    if not file.filename or not file.filename.endswith('.csv'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="请上传CSV文件",
        )

    content = await file.read()

    importer = CSVImporter(db)
    result = await importer.import_from_file(
        file_content=content,
        encoding=encoding,
    )

    audit_service = AuditService(db)
    await audit_service.log_csv_import(
        total_rows=result.total_rows,
        valid_rows=result.valid_rows,
        invalid_rows=result.invalid_rows,
        imported_ids=result.imported_ids,
        errors=[e.model_dump() for e in result.errors],
    )

    return result


@router.get("/export/risk-csv")
async def export_risk_csv(
    db: SessionDep,
) -> StreamingResponse:
    csv_content = await CSVExporter.export_risk_list_bytes(db)

    audit_service = AuditService(db)
    await audit_service.log_export(
        export_type="RiskList",
        format="CSV",
        record_count=0,
    )

    return StreamingResponse(
        iter([csv_content]),
        media_type="text/csv; charset=utf-8-sig",
        headers={
            "Content-Disposition": f"attachment; filename=risk_inventory_{__import__('datetime').datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        },
    )


@router.get("/export/trace/{usage_id}/markdown")
async def export_trace_markdown(
    usage_id: int,
    db: SessionDep,
) -> StreamingResponse:
    usage = await CourseUsageCRUD.get_by_id(db, usage_id)
    if not usage:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"领用单ID {usage_id} 不存在",
        )

    markdown_content = await MarkdownExporter.export_usage_trace(db, usage_id)
    markdown_bytes = markdown_content.encode('utf-8')

    audit_service = AuditService(db)
    await audit_service.log_export(
        export_type="TraceReport",
        format="Markdown",
        record_count=1,
    )

    return StreamingResponse(
        iter([markdown_bytes]),
        media_type="text/markdown; charset=utf-8",
        headers={
            "Content-Disposition": f"attachment; filename=trace_{usage.usage_number}_{__import__('datetime').datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
        },
    )


@router.get("/export/trace/{usage_id}/preview")
async def preview_trace_markdown(
    usage_id: int,
    db: SessionDep,
) -> dict:
    usage = await CourseUsageCRUD.get_by_id(db, usage_id)
    if not usage:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"领用单ID {usage_id} 不存在",
        )

    markdown_content = await MarkdownExporter.export_usage_trace(db, usage_id)

    return {
        "usage_number": usage.usage_number,
        "content": markdown_content,
    }
