from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional
import io

from pharmacy_expiry_tracker.db.database import get_db, engine, Base
from pharmacy_expiry_tracker.models.enums import ImportSourceType
from pharmacy_expiry_tracker.schemas.record import (
    ExpiryRecordCreate,
    ExpiryRecordUpdate,
    ExpiryRecordResponse,
    ExpiryRecordListResponse
)
from pharmacy_expiry_tracker.schemas.import_source import (
    ImportSourceResponse,
    ImportResult,
    ImportResultDetail
)
from pharmacy_expiry_tracker.schemas.workflow import (
    WorkflowActionRequest,
    ChangeReasonRequest,
    ChangeLogResponse
)
from pharmacy_expiry_tracker.schemas.export import ExportRequest
from pharmacy_expiry_tracker.services.record_service import RecordService
from pharmacy_expiry_tracker.services.import_service import ImportService
from pharmacy_expiry_tracker.services.workflow_service import WorkflowService
from pharmacy_expiry_tracker.services.export_service import ExportService
from pharmacy_expiry_tracker.utils.exceptions import AppException

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="乡镇药房近效期权限追责台账 API",
    description="支持进销存导出、手写调拨单、退货照片和历史压缩包导入，完整工作流和审计追踪",
    version="0.1.0"
)


@app.exception_handler(AppException)
async def app_exception_handler(request, exc: AppException):
    return HTTPException(
        status_code=400,
        detail={
            "error": exc.message,
            "details": exc.details,
            "exit_code": exc.exit_code.value
        }
    )


@app.get("/")
async def root():
    return {
        "name": "乡镇药房近效期权限追责台账系统",
        "version": "0.1.0",
        "docs": "/docs",
        "health": "ok"
    }


@app.post("/api/records", response_model=ExpiryRecordResponse, tags=["记录管理"])
def create_record(
    data: ExpiryRecordCreate,
    user_role: str = Form(...),
    db: Session = Depends(get_db)
):
    service = RecordService(db)
    return service.create_record(data, user_role)


@app.get("/api/records", response_model=ExpiryRecordListResponse, tags=["记录管理"])
def list_records(
    page: int = 1,
    page_size: int = 100,
    pharmacy_code: Optional[str] = None,
    region: Optional[str] = None,
    town: Optional[str] = None,
    status: Optional[str] = None,
    liability_result: Optional[str] = None,
    is_frozen: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    service = RecordService(db)
    skip = (page - 1) * page_size
    records, total = service.list_records(
        skip=skip,
        limit=page_size,
        pharmacy_code=pharmacy_code,
        region=region,
        town=town,
        status=status,
        liability_result=liability_result,
        is_frozen=is_frozen
    )
    return {
        "total": total,
        "items": records,
        "page": page,
        "page_size": page_size
    }


@app.get("/api/records/{record_id}", response_model=ExpiryRecordResponse, tags=["记录管理"])
def get_record(record_id: int, db: Session = Depends(get_db)):
    service = RecordService(db)
    record = service.get_record(record_id)
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")
    return record


@app.put("/api/records/{record_id}", response_model=ExpiryRecordResponse, tags=["记录管理"])
def update_record(
    record_id: int,
    data: ExpiryRecordUpdate,
    user_role: str = Form(...),
    db: Session = Depends(get_db)
):
    service = RecordService(db)
    return service.update_record(record_id, data, user_role)


@app.delete("/api/records/{record_id}", tags=["记录管理"])
def delete_record(
    record_id: int,
    operator: str = Form(...),
    user_role: str = Form(...),
    db: Session = Depends(get_db)
):
    service = RecordService(db)
    success = service.delete_record(record_id, operator, user_role)
    return {"success": success}


@app.post("/api/import/{source_type}", response_model=ImportResult, tags=["数据导入"])
async def import_data(
    source_type: ImportSourceType,
    file: UploadFile = File(...),
    uploaded_by: str = Form(...),
    notes: Optional[str] = Form(None),
    skip_duplicates: bool = Form(True),
    allow_partial: bool = Form(True),
    db: Session = Depends(get_db)
):
    service = ImportService(db)
    file_content = await file.read()

    import_source, results = service.import_file(
        source_type=source_type,
        file_name=file.filename,
        file_content=file_content,
        uploaded_by=uploaded_by,
        notes=notes,
        skip_duplicates=skip_duplicates,
        allow_partial=allow_partial
    )

    return ImportResult(
        import_source_id=import_source.id,
        total_rows=import_source.total_rows,
        success_rows=import_source.success_rows,
        failed_rows=import_source.failed_rows,
        is_complete=import_source.is_complete,
        details=[
            ImportResultDetail(
                row_number=r.row_number,
                success=r.success,
                record_id=r.record_id,
                record_no=r.record_no,
                error_message=r.error_message
            )
            for r in results
        ],
        elapsed_seconds=0
    )


@app.get("/api/import/sources", response_model=list[ImportSourceResponse], tags=["数据导入"])
def list_import_sources(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    service = ImportService(db)
    return service.get_import_sources(skip, limit)


@app.get("/api/import/sources/{import_id}", response_model=ImportSourceResponse, tags=["数据导入"])
def get_import_source(import_id: int, db: Session = Depends(get_db)):
    service = ImportService(db)
    source = service.get_import_source(import_id)
    if not source:
        raise HTTPException(status_code=404, detail="导入源不存在")
    return source


@app.post("/api/records/{record_id}/workflow", response_model=ExpiryRecordResponse, tags=["工作流"])
def workflow_action(
    record_id: int,
    request: WorkflowActionRequest,
    db: Session = Depends(get_db)
):
    service = WorkflowService(db)

    if request.action.value == "submit":
        return service.submit_record(
            record_id=record_id,
            operator=request.operator,
            operator_role=request.operator_role,
            change_reason=request.change_reason,
            ip_address=request.ip_address
        )
    elif request.action.value == "reject":
        return service.reject_record(
            record_id=record_id,
            operator=request.operator,
            operator_role=request.operator_role,
            change_reason=request.change_reason or "驳回",
            ip_address=request.ip_address
        )
    elif request.action.value == "confirm":
        return service.confirm_record(
            record_id=record_id,
            operator=request.operator,
            operator_role=request.operator_role,
            change_reason=request.change_reason,
            ip_address=request.ip_address
        )
    elif request.action.value == "withdraw":
        return service.withdraw_record(
            record_id=record_id,
            operator=request.operator,
            operator_role=request.operator_role,
            change_reason=request.change_reason or "撤回",
            ip_address=request.ip_address
        )
    elif request.action.value == "freeze":
        return service.freeze_record(
            record_id=record_id,
            operator=request.operator,
            operator_role=request.operator_role,
            change_reason=request.change_reason or "冻结",
            ip_address=request.ip_address
        )
    elif request.action.value == "unfreeze":
        return service.unfreeze_record(
            record_id=record_id,
            operator=request.operator,
            operator_role=request.operator_role,
            change_reason=request.change_reason or "解冻",
            ip_address=request.ip_address
        )
    else:
        raise HTTPException(status_code=400, detail=f"不支持的操作: {request.action}")


@app.get("/api/records/{record_id}/changelogs", response_model=list[ChangeLogResponse], tags=["工作流"])
def get_change_logs(record_id: int, db: Session = Depends(get_db)):
    service = WorkflowService(db)
    return service.get_change_logs(record_id)


@app.post("/api/export", tags=["数据导出"])
def export_records(request: ExportRequest, db: Session = Depends(get_db)):
    service = ExportService(db)
    file_content, file_name, record_count = service.export_records(request)

    return StreamingResponse(
        io.BytesIO(file_content),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" if request.export_format == "excel" else "text/csv",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{file_name}",
            "X-Export-Record-Count": str(record_count)
        }
    )


@app.get("/api/export/audit-logs", tags=["数据导出"])
def get_export_audit_logs(
    page: int = 1,
    page_size: int = 100,
    exported_by: Optional[str] = None,
    user_role: Optional[str] = None,
    db: Session = Depends(get_db)
):
    service = ExportService(db)
    skip = (page - 1) * page_size
    logs, total = service.get_export_audit_logs(skip, page_size, exported_by, user_role)
    return {
        "total": total,
        "items": logs,
        "page": page,
        "page_size": page_size
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
