from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any

from app.database import get_db
from app.services.import_service import ImportService

router = APIRouter(prefix="/import", tags=["数据导入"])


@router.post("/machinery", response_model=Dict[str, Any])
async def import_machinery(
    file: UploadFile = File(..., description="农机台账 JSON 文件"),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith('.json'):
        raise HTTPException(status_code=400, detail="请上传 JSON 格式的文件")
    
    try:
        content = await file.read()
        content_str = content.decode('utf-8')
        
        service = ImportService(db)
        result = service.import_machinery_ledger(content_str)
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导入失败: {str(e)}")


@router.post("/gps-trajectory", response_model=Dict[str, Any])
async def import_gps_trajectory(
    file: UploadFile = File(..., description="GPS 轨迹 JSONL 文件"),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith('.jsonl'):
        raise HTTPException(status_code=400, detail="请上传 JSONL 格式的文件")
    
    try:
        content = await file.read()
        content_str = content.decode('utf-8')
        
        service = ImportService(db)
        result = service.import_gps_trajectory(content_str)
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导入失败: {str(e)}")


@router.post("/plot-contract", response_model=Dict[str, Any])
async def import_plot_contract(
    file: UploadFile = File(..., description="地块合同 CSV 文件"),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="请上传 CSV 格式的文件")
    
    try:
        content = await file.read()
        content_str = content.decode('utf-8')
        
        service = ImportService(db)
        result = service.import_plot_contract(content_str)
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导入失败: {str(e)}")


@router.post("/pricing-rules", response_model=Dict[str, Any])
async def import_pricing_rules(
    file: UploadFile = File(..., description="计费规则 YAML 文件"),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith(('.yaml', '.yml')):
        raise HTTPException(status_code=400, detail="请上传 YAML 格式的文件")
    
    try:
        content = await file.read()
        content_str = content.decode('utf-8')
        
        service = ImportService(db)
        result = service.import_pricing_rules(content_str)
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导入失败: {str(e)}")
