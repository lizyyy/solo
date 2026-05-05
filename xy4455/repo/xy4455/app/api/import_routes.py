from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime

from app.db.database import get_db
from app.schemas.schemas import ImportResult, ApiResponse, DataSource
from app.services.import_service import ImportService

router = APIRouter()

@router.post("/json", response_model=ApiResponse)
async def import_json(
    data_source: DataSource = Form(..., description="数据源类型"),
    json_data: str = Form(..., description="JSON格式数据"),
    db: Session = Depends(get_db)
):
    service = ImportService(db)
    result = service.import_from_json(data_source, json_data)
    
    return ApiResponse(
        success=result.success,
        message=f"JSON导入完成: 成功 {result.imported_records} 条, 失败 {result.failed_records} 条",
        data=result.dict()
    )

@router.post("/csv", response_model=ApiResponse)
async def import_csv(
    data_source: DataSource = Form(..., description="数据源类型"),
    file: UploadFile = File(..., description="CSV文件"),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="请上传CSV格式文件")
    
    content = await file.read()
    csv_data = content.decode('utf-8')
    
    service = ImportService(db)
    result = service.import_from_csv(data_source, csv_data)
    
    return ApiResponse(
        success=result.success,
        message=f"CSV导入完成: 成功 {result.imported_records} 条, 失败 {result.failed_records} 条",
        data=result.dict()
    )

@router.post("/file", response_model=ApiResponse)
async def import_file(
    data_source: DataSource = Form(..., description="数据源类型"),
    file: UploadFile = File(..., description="JSON或CSV文件"),
    db: Session = Depends(get_db)
):
    content = await file.read()
    
    service = ImportService(db)
    result = None
    
    if file.filename.endswith('.json'):
        json_data = content.decode('utf-8')
        result = service.import_from_json(data_source, json_data)
    elif file.filename.endswith('.csv'):
        csv_data = content.decode('utf-8')
        result = service.import_from_csv(data_source, csv_data)
    else:
        raise HTTPException(status_code=400, detail="不支持的文件格式, 请上传JSON或CSV文件")
    
    return ApiResponse(
        success=result.success,
        message=f"文件导入完成: 成功 {result.imported_records} 条, 失败 {result.failed_records} 条",
        data=result.dict()
    )
