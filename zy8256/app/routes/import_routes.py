from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.importers import (
    CabinImporter, WorkTicketImporter, SensorLogImporter, VentilationRuleImporter
)
from app.schemas import ImportResponse

router = APIRouter(prefix="/api/import", tags=["导入"])


@router.post("/cabins", response_model=ImportResponse)
async def import_cabins(
    file: UploadFile = File(..., description="舱室台账CSV文件"),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="文件格式错误，只支持CSV文件")
    
    content = (await file.read()).decode('utf-8')
    result = CabinImporter.import_from_csv(db, content)
    
    return ImportResponse(
        success=result.error_count == 0,
        success_count=result.success_count,
        error_count=result.error_count,
        errors=result.errors if result.errors else None,
        warnings=result.warnings if result.warnings else None
    )


@router.post("/work-tickets", response_model=ImportResponse)
async def import_work_tickets(
    file: UploadFile = File(..., description="涂装作业票JSONL文件"),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith('.jsonl') and not file.filename.endswith('.json'):
        raise HTTPException(status_code=400, detail="文件格式错误，只支持JSONL/JSON文件")
    
    content = (await file.read()).decode('utf-8')
    result = WorkTicketImporter.import_from_jsonl(db, content)
    
    return ImportResponse(
        success=result.error_count == 0,
        success_count=result.success_count,
        error_count=result.error_count,
        errors=result.errors if result.errors else None,
        warnings=result.warnings if result.warnings else None
    )


@router.post("/sensor-logs", response_model=ImportResponse)
async def import_sensor_logs(
    file: UploadFile = File(..., description="VOC传感器日志CSV文件"),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="文件格式错误，只支持CSV文件")
    
    content = (await file.read()).decode('utf-8')
    result = SensorLogImporter.import_from_csv(db, content)
    
    return ImportResponse(
        success=result.error_count == 0,
        success_count=result.success_count,
        error_count=result.error_count,
        errors=result.errors if result.errors else None,
        warnings=result.warnings if result.warnings else None
    )


@router.post("/ventilation-rules", response_model=ImportResponse)
async def import_ventilation_rules(
    file: UploadFile = File(..., description="排风联锁规则YAML文件"),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith('.yaml') and not file.filename.endswith('.yml'):
        raise HTTPException(status_code=400, detail="文件格式错误，只支持YAML文件")
    
    content = (await file.read()).decode('utf-8')
    result = VentilationRuleImporter.import_from_yaml(db, content)
    
    return ImportResponse(
        success=result.error_count == 0,
        success_count=result.success_count,
        error_count=result.error_count,
        errors=result.errors if result.errors else None,
        warnings=result.warnings if result.warnings else None
    )
