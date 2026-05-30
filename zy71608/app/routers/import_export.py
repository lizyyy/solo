from typing import Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.common import ResponseModel, ImportResult
from app.services.import_service import ImportService
from app.services.export_service import ExportService
from app.models import DocumentType

router = APIRouter(prefix="/io", tags=["导入导出"])


@router.get("/sheet-names", response_model=ResponseModel[list])
async def get_sheet_names(
    file: UploadFile = File(..., description="Excel文件"),
    db: Session = Depends(get_db),
):
    try:
        content = await file.read()
        import_service = ImportService(db)
        sheet_names = import_service.get_sheet_names(content, file.filename)
        return ResponseModel(data=sheet_names)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/preview", response_model=ResponseModel[dict])
async def preview_import(
    file: UploadFile = File(..., description="Excel/CSV文件"),
    sheet_name: Optional[str] = Query(None, description="工作表名称"),
    n_rows: int = Query(10, ge=1, le=100, description="预览行数"),
    db: Session = Depends(get_db),
):
    try:
        content = await file.read()
        import_service = ImportService(db)
        preview = import_service.preview_import(content, file.filename, sheet_name, n_rows)
        return ResponseModel(data=preview)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/import", response_model=ResponseModel[ImportResult])
async def import_document(
    file: UploadFile = File(..., description="Excel/CSV文件"),
    document_type: str = Query(..., description=f"文档类型: {', '.join([e.value for e in DocumentType])}"),
    sheet_name: Optional[str] = Query(None, description="工作表名称"),
    operator: str = Query("system", description="操作人"),
    db: Session = Depends(get_db),
):
    valid_types = [e.value for e in DocumentType]
    if document_type not in valid_types:
        raise HTTPException(status_code=400, detail=f"无效的文档类型，可选值: {', '.join(valid_types)}")

    try:
        content = await file.read()
        import_service = ImportService(db)
        result = import_service.import_document(
            file_content=content,
            file_name=file.filename,
            document_type=document_type,
            sheet_name=sheet_name,
            operator=operator,
        )

        import_result = ImportResult(**result)
        return ResponseModel(data=import_result, message=f"导入完成: 成功{result['success_rows']}行，失败{result['error_rows']}行")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/export/ledger", response_model=ResponseModel[dict])
def export_reduction_ledger(
    status: Optional[str] = Query(None, description="状态筛选"),
    start_date: Optional[date] = Query(None, description="开始日期"),
    end_date: Optional[date] = Query(None, description="结束日期"),
    tenant_name: Optional[str] = Query(None, description="租户名称"),
    has_anomaly: Optional[bool] = Query(None, description="是否有异常"),
    operator: str = Query("system", description="操作人"),
    db: Session = Depends(get_db),
):
    try:
        export_service = ExportService(db)
        result = export_service.export_reduction_ledger(
            operator=operator,
            status=status,
            start_date=start_date,
            end_date=end_date,
            tenant_name=tenant_name,
            has_anomaly=has_anomaly,
        )
        return ResponseModel(data=result, message=f"导出成功，共{result['record_count']}条记录")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/export/{application_id}", response_model=ResponseModel[dict])
def export_single_application(
    application_id: int,
    operator: str = Query("system", description="操作人"),
    db: Session = Depends(get_db),
):
    try:
        export_service = ExportService(db)
        result = export_service.export_single_application(application_id, operator)
        return ResponseModel(data=result, message="导出成功")
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/export/files", response_model=ResponseModel[list])
def get_export_files(db: Session = Depends(get_db)):
    export_service = ExportService(db)
    files = export_service.get_export_files()
    return ResponseModel(data=files)


@router.get("/export/download/{file_name}")
def download_export_file(file_name: str, db: Session = Depends(get_db)):
    from app.config import settings
    from pathlib import Path

    file_path = settings.EXPORT_DIR / file_name
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="文件不存在")

    return FileResponse(
        path=str(file_path),
        filename=file_name,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
