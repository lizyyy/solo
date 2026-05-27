from sqlalchemy.orm import Session
from typing import List, Optional
import pandas as pd
import json
from datetime import datetime
import io

from . import models, schemas
from .models import DiscrepancyType, DataSource


def import_alarms_from_csv(db: Session, csv_content: bytes, filename: str) -> schemas.ImportResult:
    """从CSV导入告警数据"""
    errors = []
    imported = 0
    failed = 0
    
    try:
        df = pd.read_csv(io.BytesIO(csv_content))
        
        required_columns = ['alarm_id', 'pole_id', 'light_id', 'alarm_type', 'alarm_level', 
                           'alarm_time', 'description', 'status']
        missing_cols = [col for col in required_columns if col not in df.columns]
        if missing_cols:
            return schemas.ImportResult(
                source_type="alarm",
                file_name=filename,
                imported_count=0,
                failed_count=0,
                errors=[f"缺少必要列: {', '.join(missing_cols)}"]
            )
        
        for _, row in df.iterrows():
            try:
                alarm_time = pd.to_datetime(row['alarm_time']).to_pydatetime()
                
                existing = db.query(models.Alarm).filter(
                    models.Alarm.alarm_id == str(row['alarm_id'])
                ).first()
                
                if existing:
                    continue
                
                alarm = models.Alarm(
                    alarm_id=str(row['alarm_id']),
                    pole_id=str(row['pole_id']),
                    light_id=str(row['light_id']),
                    alarm_type=str(row['alarm_type']),
                    alarm_level=str(row['alarm_level']),
                    alarm_time=alarm_time,
                    description=str(row['description']),
                    status=str(row['status']),
                    source_file=filename,
                    is_false_alarm=bool(row.get('is_false_alarm', False)),
                    false_alarm_reason=str(row.get('false_alarm_reason', '')) if row.get('false_alarm_reason') else None
                )
                db.add(alarm)
                imported += 1
            except Exception as e:
                failed += 1
                errors.append(f"行{imported + failed}: {str(e)}")
        
        db.commit()
    except Exception as e:
        errors.append(f"文件解析错误: {str(e)}")
    
    return schemas.ImportResult(
        source_type="alarm",
        file_name=filename,
        imported_count=imported,
        failed_count=failed,
        errors=errors
    )


def import_inspections_from_json(db: Session, json_content: bytes, filename: str) -> schemas.ImportResult:
    """从JSON导入巡查数据"""
    errors = []
    imported = 0
    failed = 0
    
    try:
        data = json.loads(json_content.decode('utf-8'))
        
        if not isinstance(data, list):
            data = [data]
        
        for item in data:
            try:
                inspection_id = item.get('inspection_id')
                if not inspection_id:
                    failed += 1
                    errors.append(f"缺少inspection_id")
                    continue
                
                existing = db.query(models.Inspection).filter(
                    models.Inspection.inspection_id == str(inspection_id)
                ).first()
                
                if existing:
                    continue
                
                inspection_time = pd.to_datetime(item['inspection_time']).to_pydatetime()
                
                inspection = models.Inspection(
                    inspection_id=str(inspection_id),
                    pole_id=str(item.get('pole_id', '')),
                    light_id=str(item.get('light_id', '')),
                    inspector=str(item.get('inspector', '')),
                    inspection_time=inspection_time,
                    status=str(item.get('status', '')),
                    issues_found=json.dumps(item.get('issues_found', []), ensure_ascii=False) if isinstance(item.get('issues_found'), list) else str(item.get('issues_found', '')),
                    photos=json.dumps(item.get('photos', []), ensure_ascii=False) if item.get('photos') else None,
                    source_file=filename
                )
                db.add(inspection)
                imported += 1
            except Exception as e:
                failed += 1
                errors.append(f"记录{imported + failed}: {str(e)}")
        
        db.commit()
    except Exception as e:
        errors.append(f"文件解析错误: {str(e)}")
    
    return schemas.ImportResult(
        source_type="inspection",
        file_name=filename,
        imported_count=imported,
        failed_count=failed,
        errors=errors
    )


def import_work_orders_from_csv(db: Session, csv_content: bytes, filename: str) -> schemas.ImportResult:
    """从CSV导入维修单数据"""
    errors = []
    imported = 0
    failed = 0
    
    try:
        df = pd.read_csv(io.BytesIO(csv_content))
        
        required_columns = ['order_id', 'pole_id', 'light_id', 'repair_type', 'reporter', 'report_time', 'status']
        missing_cols = [col for col in required_columns if col not in df.columns]
        if missing_cols:
            return schemas.ImportResult(
                source_type="work_order",
                file_name=filename,
                imported_count=0,
                failed_count=0,
                errors=[f"缺少必要列: {', '.join(missing_cols)}"]
            )
        
        for _, row in df.iterrows():
            try:
                order_id = str(row['order_id'])
                
                existing = db.query(models.WorkOrder).filter(
                    models.WorkOrder.order_id == order_id
                ).first()
                
                if existing:
                    continue
                
                report_time = pd.to_datetime(row['report_time']).to_pydatetime()
                repair_time = pd.to_datetime(row['repair_time']).to_pydatetime() if pd.notna(row.get('repair_time')) else None
                
                work_order = models.WorkOrder(
                    order_id=order_id,
                    pole_id=str(row['pole_id']),
                    light_id=str(row['light_id']),
                    alarm_id=str(row['alarm_id']) if pd.notna(row.get('alarm_id')) else None,
                    repair_type=str(row['repair_type']),
                    reporter=str(row['reporter']),
                    report_time=report_time,
                    repairer=str(row['repairer']) if pd.notna(row.get('repairer')) else None,
                    repair_time=repair_time,
                    repair_content=str(row['repair_content']) if pd.notna(row.get('repair_content')) else None,
                    status=str(row['status']),
                    is_retest=bool(row.get('is_retest', False)),
                    retest_result=str(row['retest_result']) if pd.notna(row.get('retest_result')) else None,
                    source_file=filename
                )
                db.add(work_order)
                imported += 1
            except Exception as e:
                failed += 1
                errors.append(f"行{imported + failed}: {str(e)}")
        
        db.commit()
    except Exception as e:
        errors.append(f"文件解析错误: {str(e)}")
    
    return schemas.ImportResult(
        source_type="work_order",
        file_name=filename,
        imported_count=imported,
        failed_count=failed,
        errors=errors
    )


def get_alarms(db: Session, pole_id: Optional[str] = None, light_id: Optional[str] = None, 
               skip: int = 0, limit: int = 100) -> List[models.Alarm]:
    query = db.query(models.Alarm)
    if pole_id:
        query = query.filter(models.Alarm.pole_id == pole_id)
    if light_id:
        query = query.filter(models.Alarm.light_id == light_id)
    return query.offset(skip).limit(limit).all()


def get_inspections(db: Session, pole_id: Optional[str] = None, light_id: Optional[str] = None,
                    skip: int = 0, limit: int = 100) -> List[models.Inspection]:
    query = db.query(models.Inspection)
    if pole_id:
        query = query.filter(models.Inspection.pole_id == pole_id)
    if light_id:
        query = query.filter(models.Inspection.light_id == light_id)
    return query.offset(skip).limit(limit).all()


def get_work_orders(db: Session, pole_id: Optional[str] = None, light_id: Optional[str] = None,
                    order_id: Optional[str] = None, skip: int = 0, limit: int = 100) -> List[models.WorkOrder]:
    query = db.query(models.WorkOrder)
    if pole_id:
        query = query.filter(models.WorkOrder.pole_id == pole_id)
    if light_id:
        query = query.filter(models.WorkOrder.light_id == light_id)
    if order_id:
        query = query.filter(models.WorkOrder.order_id == order_id)
    return query.offset(skip).limit(limit).all()


def get_batches(db: Session, skip: int = 0, limit: int = 50) -> List[models.ReconciliationBatch]:
    return db.query(models.ReconciliationBatch).order_by(
        models.ReconciliationBatch.created_at.desc()
    ).offset(skip).limit(limit).all()


def get_batch_by_id(db: Session, batch_id: str) -> Optional[models.ReconciliationBatch]:
    return db.query(models.ReconciliationBatch).filter(
        models.ReconciliationBatch.batch_id == batch_id
    ).first()
