from typing import Optional, List
from fastapi import APIRouter, Depends, Path, Query, status
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy.orm import Session
import os

from ..database import get_db
from ..models import ExportFormat, AnalysisType
from ..schemas import (
    APIResponse, PaginatedResponse, ExportRequest, ExportResponse
)
from ..services import ExportService

router = APIRouter()


@router.post("", response_model=APIResponse[ExportResponse], status_code=status.HTTP_201_CREATED)
def create_export(
    export_request: ExportRequest,
    db: Session = Depends(get_db)
):
    export_service = ExportService(db)
    
    export_record = export_service.export_task(
        task_id=export_request.task_id,
        export_format=export_request.format,
        analysis_types=export_request.analysis_types,
        include_severities=export_request.include_severities,
        include_raw_data=export_request.include_raw_data,
        include_metrics=export_request.include_metrics,
        include_recommendations=export_request.include_recommendations
    )
    
    return APIResponse(
        data=ExportResponse(
            export_id=export_record.id,
            task_id=export_record.task_id,
            file_name=export_record.file_name,
            file_size=export_record.file_size,
            format=export_record.export_format,
            download_url=f"/api/v1/exports/{export_record.id}/download",
            created_at=export_record.created_at
        ),
        message="导出成功"
    )


@router.get("", response_model=APIResponse[PaginatedResponse[ExportResponse]])
def list_exports(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    db: Session = Depends(get_db)
):
    export_service = ExportService(db)
    skip = (page - 1) * page_size
    records, total = export_service.list_exports(skip=skip, limit=page_size)
    
    total_pages = (total + page_size - 1) // page_size
    
    return APIResponse(
        data=PaginatedResponse(
            items=[
                ExportResponse(
                    export_id=r.id,
                    task_id=r.task_id,
                    file_name=r.file_name,
                    file_size=r.file_size,
                    format=r.export_format,
                    download_url=f"/api/v1/exports/{r.id}/download",
                    created_at=r.created_at
                )
                for r in records
            ],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages
        )
    )


@router.get("/{export_id}", response_model=APIResponse[ExportResponse])
def get_export(
    export_id: int = Path(..., ge=1, description="导出记录ID"),
    db: Session = Depends(get_db)
):
    export_service = ExportService(db)
    record = export_service.get_export_record(export_id)
    
    return APIResponse(
        data=ExportResponse(
            export_id=record.id,
            task_id=record.task_id,
            file_name=record.file_name,
            file_size=record.file_size,
            format=record.export_format,
            download_url=f"/api/v1/exports/{record.id}/download",
            created_at=record.created_at
        )
    )


@router.get("/{export_id}/download")
def download_export(
    export_id: int = Path(..., ge=1, description="导出记录ID"),
    db: Session = Depends(get_db)
):
    export_service = ExportService(db)
    record = export_service.get_export_record(export_id)
    
    file_path = record.file_path
    if not os.path.exists(file_path):
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={
                "success": False,
                "error_code": "FILE_NOT_FOUND",
                "error_message": "导出文件不存在"
            }
        )
    
    media_types = {
        ExportFormat.JSON: "application/json",
        ExportFormat.MARKDOWN: "text/markdown",
        ExportFormat.HTML: "text/html"
    }
    
    return FileResponse(
        path=file_path,
        media_type=media_types.get(record.export_format, "application/octet-stream"),
        filename=record.file_name
    )


@router.delete("/{export_id}", response_model=APIResponse[dict])
def delete_export(
    export_id: int = Path(..., ge=1, description="导出记录ID"),
    db: Session = Depends(get_db)
):
    export_service = ExportService(db)
    record = export_service.get_export_record(export_id)
    
    if os.path.exists(record.file_path):
        os.remove(record.file_path)
    
    db.delete(record)
    db.commit()
    
    return APIResponse(
        data={"deleted": True},
        message="导出记录删除成功"
    )
