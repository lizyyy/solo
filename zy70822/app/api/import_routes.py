from fastapi import APIRouter, Depends, File, UploadFile, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any

from app.models import get_db
from app.services import ImportService

router = APIRouter()


@router.post("/appointments/csv", response_model=Dict[str, Any])
async def import_appointments_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """导入预约CSV文件"""
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="请上传CSV格式文件")
    
    content = await file.read()
    csv_content = content.decode('utf-8')
    
    service = ImportService(db)
    result = service.import_appointments_from_csv(csv_content)
    
    return {
        "success": True,
        "message": f"成功导入 {result['imported_count']} 条预约记录",
        "data": result
    }


@router.post("/inventory/json", response_model=Dict[str, Any])
async def import_inventory_json(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """导入疫苗库存JSON文件"""
    if not file.filename.endswith('.json'):
        raise HTTPException(status_code=400, detail="请上传JSON格式文件")
    
    content = await file.read()
    json_content = content.decode('utf-8')
    
    service = ImportService(db)
    result = service.import_inventory_from_json(json_content)
    
    return {
        "success": True,
        "message": f"成功导入 {result['imported_count']} 条库存记录",
        "data": result
    }


@router.post("/rules/json", response_model=Dict[str, Any])
async def import_rules_json(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """导入禁忌规则JSON文件"""
    if not file.filename.endswith('.json'):
        raise HTTPException(status_code=400, detail="请上传JSON格式文件")
    
    content = await file.read()
    json_content = content.decode('utf-8')
    
    service = ImportService(db)
    result = service.import_rules_from_json(json_content)
    
    return {
        "success": True,
        "message": f"成功导入 {result['imported_count']} 条规则",
        "data": result
    }
