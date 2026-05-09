from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session
import pandas as pd
import io

from app.core.database import get_db
from app.models import Equipment, EnergyData, ProductionData, BaselineVersion, EnergySaving
from app.schemas import (
    EnergyDataCreate, EnergyDataResponse,
    ProductionDataCreate, ProductionDataResponse,
    BaselineVersionCreate, BaselineVersionUpdate, BaselineVersionResponse,
    BaselineCalculationRequest, SavingCalculationRequest, EnergySavingResponse,
    OutlierDetectionRequest
)
from app.services import OutlierService, BaselineService, SavingService

router = APIRouter(prefix="/api/energy", tags=["能源管理"])


@router.post("/data/energy", response_model=List[EnergyDataResponse], status_code=status.HTTP_201_CREATED)
def create_energy_data(data: List[EnergyDataCreate], db: Session = Depends(get_db)):
    """批量创建能耗数据"""
    created_records = []
    
    for item in data:
        equipment = db.query(Equipment).filter(Equipment.id == item.equipment_id).first()
        if not equipment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"设备 {item.equipment_id} 不存在"
            )
        
        record = EnergyData(**item.dict())
        db.add(record)
        created_records.append(record)
    
    db.commit()
    for record in created_records:
        db.refresh(record)
    
    return created_records


@router.post("/data/production", response_model=List[ProductionDataResponse], status_code=status.HTTP_201_CREATED)
def create_production_data(data: List[ProductionDataCreate], db: Session = Depends(get_db)):
    """批量创建产量数据"""
    created_records = []
    
    for item in data:
        equipment = db.query(Equipment).filter(Equipment.id == item.equipment_id).first()
        if not equipment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"设备 {item.equipment_id} 不存在"
            )
        
        record = ProductionData(**item.dict())
        db.add(record)
        created_records.append(record)
    
    db.commit()
    for record in created_records:
        db.refresh(record)
    
    return created_records


@router.post("/data/import/energy")
async def import_energy_data(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """导入能耗数据（Excel/CSV）"""
    if not file.filename.endswith(('.xlsx', '.xls', '.csv')):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="仅支持Excel和CSV文件"
        )
    
    try:
        contents = await file.read()
        
        if file.filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(contents))
        else:
            df = pd.read_excel(io.BytesIO(contents))
        
        required_columns = ['设备编号', '记录时间', '能耗值']
        for col in required_columns:
            if col not in df.columns:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"缺少必需列: {col}"
                )
        
        imported_count = 0
        errors = []
        
        for idx, row in df.iterrows():
            try:
                equipment = db.query(Equipment).filter(
                    Equipment.code == str(row['设备编号'])
                ).first()
                
                if not equipment:
                    errors.append(f"第{idx+2}行: 设备编号 {row['设备编号']} 不存在")
                    continue
                
                record_time = pd.to_datetime(row['记录时间']).to_pydatetime()
                
                energy_type = str(row.get('能源类型', 'electricity'))
                source = str(row.get('数据来源', file.filename))
                
                record = EnergyData(
                    equipment_id=equipment.id,
                    record_date=record_time,
                    energy_consumption=float(row['能耗值']),
                    energy_type=energy_type,
                    source=source
                )
                db.add(record)
                imported_count += 1
                
            except Exception as e:
                errors.append(f"第{idx+2}行: {str(e)}")
        
        db.commit()
        
        return {
            "imported_count": imported_count,
            "errors": errors,
            "total_rows": len(df)
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"文件处理失败: {str(e)}"
        )


@router.post("/data/import/production")
async def import_production_data(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """导入产量数据（Excel/CSV）"""
    if not file.filename.endswith(('.xlsx', '.xls', '.csv')):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="仅支持Excel和CSV文件"
        )
    
    try:
        contents = await file.read()
        
        if file.filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(contents))
        else:
            df = pd.read_excel(io.BytesIO(contents))
        
        required_columns = ['设备编号', '记录时间', '产量', '产量单位']
        for col in required_columns:
            if col not in df.columns:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"缺少必需列: {col}"
                )
        
        imported_count = 0
        errors = []
        
        for idx, row in df.iterrows():
            try:
                equipment = db.query(Equipment).filter(
                    Equipment.code == str(row['设备编号'])
                ).first()
                
                if not equipment:
                    errors.append(f"第{idx+2}行: 设备编号 {row['设备编号']} 不存在")
                    continue
                
                record_time = pd.to_datetime(row['记录时间']).to_pydatetime()
                
                shift = str(row.get('班次', ''))
                source = str(row.get('数据来源', file.filename))
                
                record = ProductionData(
                    equipment_id=equipment.id,
                    record_date=record_time,
                    production_quantity=float(row['产量']),
                    production_unit=str(row['产量单位']),
                    shift=shift,
                    source=source
                )
                db.add(record)
                imported_count += 1
                
            except Exception as e:
                errors.append(f"第{idx+2}行: {str(e)}")
        
        db.commit()
        
        return {
            "imported_count": imported_count,
            "errors": errors,
            "total_rows": len(df)
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"文件处理失败: {str(e)}"
        )


@router.post("/outliers/detect")
def detect_outliers(request: OutlierDetectionRequest, db: Session = Depends(get_db)):
    """检测异常数据"""
    results = []
    
    equipment_ids = request.equipment_ids or []
    
    if not equipment_ids:
        all_equipment = db.query(Equipment).all()
        equipment_ids = [eq.id for eq in all_equipment]
    
    for equipment_id in equipment_ids:
        try:
            result = OutlierService.detect_equipment_outliers(
                db, equipment_id, request.start_date, request.end_date, request.threshold
            )
            results.append(result)
        except Exception as e:
            results.append({
                "equipment_id": equipment_id,
                "error": str(e)
            })
    
    return {"results": results}


@router.post("/outliers/mark")
def mark_outliers(request: OutlierDetectionRequest, db: Session = Depends(get_db)):
    """标记异常数据"""
    results = []
    
    equipment_ids = request.equipment_ids or []
    
    if not equipment_ids:
        all_equipment = db.query(Equipment).all()
        equipment_ids = [eq.id for eq in all_equipment]
    
    for equipment_id in equipment_ids:
        try:
            result = OutlierService.mark_outliers(
                db, equipment_id, request.start_date, request.end_date, request.threshold
            )
            results.append(result)
        except Exception as e:
            results.append({
                "equipment_id": equipment_id,
                "error": str(e)
            })
    
    return {"results": results}


@router.get("/baselines/", response_model=List[BaselineVersionResponse])
def list_baselines(
    skip: int = 0,
    limit: int = 100,
    equipment_id: Optional[int] = None,
    group_id: Optional[int] = None,
    status: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    """获取基线版本列表"""
    query = db.query(BaselineVersion)
    
    if equipment_id:
        query = query.filter(BaselineVersion.equipment_id == equipment_id)
    if group_id:
        query = query.filter(BaselineVersion.group_id == group_id)
    if status:
        query = query.filter(BaselineVersion.status == status)
    if is_active is not None:
        query = query.filter(BaselineVersion.is_active == is_active)
    
    return query.order_by(BaselineVersion.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/baselines/{baseline_id}", response_model=BaselineVersionResponse)
def get_baseline(baseline_id: int, db: Session = Depends(get_db)):
    """获取单个基线版本"""
    baseline = db.query(BaselineVersion).filter(BaselineVersion.id == baseline_id).first()
    if not baseline:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"基线版本 {baseline_id} 不存在"
        )
    return baseline


@router.post("/baselines/calculate")
def calculate_baseline(request: BaselineCalculationRequest, db: Session = Depends(get_db)):
    """计算并创建基线版本"""
    results = []
    
    if request.equipment_ids:
        for equipment_id in request.equipment_ids:
            try:
                baseline = BaselineService.create_baseline_version(
                    db=db,
                    name=request.version_name,
                    equipment_id=equipment_id,
                    start_date=request.start_date,
                    end_date=request.end_date,
                    created_by=request.created_by
                )
                results.append({
                    "equipment_id": equipment_id,
                    "baseline_id": baseline.id,
                    "version": baseline.version,
                    "success": True
                })
            except Exception as e:
                results.append({
                    "equipment_id": equipment_id,
                    "error": str(e),
                    "success": False
                })
    
    if request.group_ids:
        for group_id in request.group_ids:
            try:
                baseline = BaselineService.create_baseline_version(
                    db=db,
                    name=request.version_name,
                    group_id=group_id,
                    start_date=request.start_date,
                    end_date=request.end_date,
                    created_by=request.created_by
                )
                results.append({
                    "group_id": group_id,
                    "baseline_id": baseline.id,
                    "version": baseline.version,
                    "success": True
                })
            except Exception as e:
                results.append({
                    "group_id": group_id,
                    "error": str(e),
                    "success": False
                })
    
    return {"results": results}


@router.post("/baselines/{baseline_id}/activate")
def activate_baseline(
    baseline_id: int,
    replace_reason: Optional[str] = Query(None, description="替换旧版本的原因"),
    db: Session = Depends(get_db)
):
    """激活基线版本"""
    try:
        baseline = BaselineService.activate_baseline(db, baseline_id, replace_reason)
        return {
            "baseline_id": baseline.id,
            "version": baseline.version,
            "is_active": baseline.is_active,
            "status": baseline.status
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/savings/calculate")
def calculate_savings(request: SavingCalculationRequest, db: Session = Depends(get_db)):
    """计算节能收益"""
    results = []
    
    if request.equipment_ids:
        for equipment_id in request.equipment_ids:
            try:
                saving = SavingService.create_saving_record(
                    db=db,
                    equipment_id=equipment_id,
                    baseline_id=request.baseline_id,
                    period_start=request.period_start,
                    period_end=request.period_end,
                    created_by=request.created_by
                )
                results.append({
                    "equipment_id": equipment_id,
                    "saving_id": saving.id,
                    "saving_energy": saving.saving_energy,
                    "saving_rate": saving.saving_rate,
                    "success": True
                })
            except Exception as e:
                results.append({
                    "equipment_id": equipment_id,
                    "error": str(e),
                    "success": False
                })
    
    if request.group_ids:
        for group_id in request.group_ids:
            try:
                saving_result = SavingService.calculate_group_saving(
                    db=db,
                    group_id=group_id,
                    baseline_id=request.baseline_id,
                    period_start=request.period_start,
                    period_end=request.period_end
                )
                results.append({
                    "group_id": group_id,
                    "saving_energy": saving_result["saving_energy"],
                    "saving_rate": saving_result["saving_rate"],
                    "equipment_count": saving_result["equipment_count"],
                    "success": True
                })
            except Exception as e:
                results.append({
                    "group_id": group_id,
                    "error": str(e),
                    "success": False
                })
    
    return {"results": results}


@router.get("/savings/", response_model=List[EnergySavingResponse])
def list_savings(
    skip: int = 0,
    limit: int = 100,
    equipment_id: Optional[int] = None,
    baseline_id: Optional[int] = None,
    status: Optional[str] = None,
    period_start: Optional[datetime] = None,
    period_end: Optional[datetime] = None,
    db: Session = Depends(get_db)
):
    """获取节能收益记录列表"""
    query = db.query(EnergySaving)
    
    if equipment_id:
        query = query.filter(EnergySaving.equipment_id == equipment_id)
    if baseline_id:
        query = query.filter(EnergySaving.baseline_id == baseline_id)
    if status:
        query = query.filter(EnergySaving.status == status)
    if period_start:
        query = query.filter(EnergySaving.period_start >= period_start)
    if period_end:
        query = query.filter(EnergySaving.period_end <= period_end)
    
    return query.order_by(EnergySaving.calculation_date.desc()).offset(skip).limit(limit).all()
