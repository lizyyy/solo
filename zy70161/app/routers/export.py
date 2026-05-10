from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List
import os
from ..database import get_db
from ..schemas.schemas import (
    ExportRequest,
    ExportResponse
)
from ..services import ExportService

router = APIRouter(prefix="/api/exports", tags=["数据导出"])

export_service = ExportService()


@router.post("", response_model=ExportResponse, summary="创建导出任务")
def create_export(request: ExportRequest, db: Session = Depends(get_db)):
    try:
        export_record = export_service.create_export(db, request)
        db.commit()
        db.refresh(export_record)
        return export_record
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.get("", response_model=List[ExportResponse], summary="获取导出记录列表")
def list_exports(limit: int = 100, db: Session = Depends(get_db)):
    return export_service.list_export_records(db, limit)


@router.get("/{export_id}", response_model=ExportResponse, summary="获取导出记录详情")
def get_export(export_id: int, db: Session = Depends(get_db)):
    record = export_service.get_export_record(db, export_id)
    if not record:
        raise HTTPException(status_code=404, detail="导出记录不存在")
    return record


@router.get("/{export_id}/download", summary="下载导出文件")
def download_export(export_id: int, db: Session = Depends(get_db)):
    record = export_service.get_export_record(db, export_id)
    if not record:
        raise HTTPException(status_code=404, detail="导出记录不存在")
    
    if record.status != "completed":
        raise HTTPException(
            status_code=400,
            detail=f"导出任务尚未完成，当前状态: {record.status}"
        )
    
    if not record.file_path or not os.path.exists(record.file_path):
        raise HTTPException(status_code=404, detail="导出文件不存在或已被删除")
    
    return FileResponse(
        path=record.file_path,
        filename=record.file_name or f"export_{export_id}.xlsx",
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )


@router.get("/types/available", summary="获取可用的导出类型")
def get_export_types():
    return {
        "types": [
            {
                "code": "rules",
                "name": "规则导出",
                "description": "导出规则列表，包含搜索词、类型、状态等信息",
                "sheets": ["规则列表"]
            },
            {
                "code": "history",
                "name": "历史记录导出",
                "description": "导出操作历史记录，包含状态流转、操作人等信息",
                "sheets": ["操作历史"]
            },
            {
                "code": "full_report",
                "name": "完整报告",
                "description": "导出完整的业务复核报告，包含汇总、规则、历史、审核、灰度等全部信息",
                "sheets": ["汇总概览", "规则详情", "操作历史", "审核记录", "灰度发布"]
            }
        ],
        "file_format": "Excel (.xlsx)",
        "encoding": "UTF-8"
    }
