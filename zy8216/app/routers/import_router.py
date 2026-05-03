from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.import_service import DataImporter
from app.schemas import ImportResult

router = APIRouter(prefix="/import", tags=["数据导入"])


@router.post("/animals", response_model=ImportResult)
async def import_animals(
    file: UploadFile = File(..., description="animals.csv 文件"),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="请上传 CSV 文件")
    
    try:
        content = await file.read()
        file_content = content.decode('utf-8')
        
        importer = DataImporter(db)
        imported, errors = importer.import_animals_from_csv(file_content)
        
        return ImportResult(
            success=len(errors) == 0,
            message=f"成功导入 {imported} 条动物记录" if not errors else f"导入完成，有 {len(errors)} 个错误",
            records_imported=imported,
            errors=errors
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导入失败: {str(e)}")


@router.post("/health-checks", response_model=ImportResult)
async def import_health_checks(
    file: UploadFile = File(..., description="health_checks.csv 文件"),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="请上传 CSV 文件")
    
    try:
        content = await file.read()
        file_content = content.decode('utf-8')
        
        importer = DataImporter(db)
        imported, errors = importer.import_health_checks_from_csv(file_content)
        
        return ImportResult(
            success=len(errors) == 0,
            message=f"成功导入 {imported} 条健康检查记录" if not errors else f"导入完成，有 {len(errors)} 个错误",
            records_imported=imported,
            errors=errors
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导入失败: {str(e)}")


@router.post("/cage-scans", response_model=ImportResult)
async def import_cage_scans(
    file: UploadFile = File(..., description="cage_scans.jsonl 文件"),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith('.jsonl'):
        raise HTTPException(status_code=400, detail="请上传 JSONL 文件")
    
    try:
        content = await file.read()
        file_content = content.decode('utf-8')
        
        importer = DataImporter(db)
        imported, anomaly_count, errors = importer.import_cage_scans_from_jsonl(file_content)
        
        message = f"成功处理 {imported} 条扫码记录，检测到 {anomaly_count} 个异常"
        if errors:
            message += f"，有 {len(errors)} 个处理错误"
        
        return ImportResult(
            success=len(errors) == 0,
            message=message,
            records_imported=imported,
            errors=errors
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导入失败: {str(e)}")


@router.post("/rules", response_model=ImportResult)
async def import_rules(
    file: UploadFile = File(..., description="rules.yaml 文件"),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith(('.yaml', '.yml')):
        raise HTTPException(status_code=400, detail="请上传 YAML 文件")
    
    try:
        content = await file.read()
        file_content = content.decode('utf-8')
        
        importer = DataImporter(db)
        imported, errors = importer.import_rules_from_yaml(file_content)
        
        return ImportResult(
            success=len(errors) == 0,
            message=f"成功导入 {imported} 条规则" if not errors else f"导入完成，有 {len(errors)} 个错误",
            records_imported=imported,
            errors=errors
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导入失败: {str(e)}")
