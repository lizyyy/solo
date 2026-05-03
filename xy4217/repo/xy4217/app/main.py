from fastapi import FastAPI, Depends, UploadFile, File, Query, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime
import json
from io import BytesIO

from app.config import settings
from app.db.database import get_db, init_db
from app.models.models import (
    Prescription, DrugBatch, TemperatureLog, WasteRecord, RiskRecord
)
from app.parsers.prescription_parser import parse_prescription_csv
from app.parsers.drug_batch_parser import parse_drug_batch_json
from app.parsers.temperature_parser import parse_temperature_csv, parse_temperature_json
from app.parsers.waste_parser import parse_waste_csv, parse_waste_json
from app.rules.rule_engine import RuleEngine
from app.exporters.audit_exporter import AuditExporter, calculate_statistics

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="医院静配中心化疗药批次追踪系统后端API"
)


@app.on_event("startup")
def startup_event():
    init_db()


@app.get("/")
def root():
    return {
        "name": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "status": "running",
        "docs_url": "/docs"
    }


@app.post(f"{settings.API_PREFIX}/import/prescriptions", tags=["导入接口"])
def import_prescriptions(
    file: UploadFile = File(..., description="处方CSV文件"),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="请上传CSV文件")
    
    content = file.file.read().decode('utf-8-sig')
    result = parse_prescription_csv(content)
    
    if not result['success'] and result['errors']:
        return {
            "status": "partial",
            "message": f"解析完成，但有{len(result['errors'])}条错误",
            "total": result['total'],
            "errors": result['errors']
        }
    
    success_count = 0
    for presc_data in result['prescriptions']:
        existing = db.query(Prescription).filter(
            Prescription.prescription_id == presc_data['prescription_id']
        ).first()
        
        if existing:
            for key, value in presc_data.items():
                setattr(existing, key, value)
            success_count += 1
        else:
            presc = Prescription(**presc_data)
            db.add(presc)
            success_count += 1
    
    db.commit()
    
    return {
        "status": "success",
        "message": f"成功导入{success_count}条处方记录",
        "imported": success_count,
        "total": result['total']
    }


@app.post(f"{settings.API_PREFIX}/import/drug-batches", tags=["导入接口"])
def import_drug_batches(
    file: UploadFile = File(..., description="药品批号JSON文件"),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith('.json'):
        raise HTTPException(status_code=400, detail="请上传JSON文件")
    
    content = file.file.read().decode('utf-8-sig')
    result = parse_drug_batch_json(content)
    
    if not result['success'] and result['errors']:
        return {
            "status": "partial",
            "message": f"解析完成，但有{len(result['errors'])}条错误",
            "total": result['total'],
            "errors": result['errors']
        }
    
    success_count = 0
    for batch_data in result['batches']:
        existing = db.query(DrugBatch).filter(
            DrugBatch.batch_number == batch_data['batch_number']
        ).first()
        
        if existing:
            for key, value in batch_data.items():
                setattr(existing, key, value)
            success_count += 1
        else:
            batch = DrugBatch(**batch_data)
            db.add(batch)
            success_count += 1
    
    db.commit()
    
    return {
        "status": "success",
        "message": f"成功导入{success_count}条药品批号记录",
        "imported": success_count,
        "total": result['total']
    }


@app.post(f"{settings.API_PREFIX}/import/temperature", tags=["导入接口"])
def import_temperature(
    file: UploadFile = File(..., description="冰箱温度日志文件"),
    db: Session = Depends(get_db)
):
    content = file.file.read().decode('utf-8-sig')
    
    if file.filename.endswith('.csv'):
        result = parse_temperature_csv(content)
    elif file.filename.endswith('.json'):
        result = parse_temperature_json(content)
    else:
        raise HTTPException(status_code=400, detail="请上传CSV或JSON文件")
    
    if not result['success'] and result['errors']:
        return {
            "status": "partial",
            "message": f"解析完成，但有{len(result['errors'])}条错误",
            "total": result['total'],
            "errors": result['errors']
        }
    
    success_count = 0
    for log_data in result['logs']:
        log = TemperatureLog(**log_data)
        db.add(log)
        success_count += 1
    
    db.commit()
    
    return {
        "status": "success",
        "message": f"成功导入{success_count}条温度记录",
        "imported": success_count,
        "total": result['total']
    }


@app.post(f"{settings.API_PREFIX}/import/waste", tags=["导入接口"])
def import_waste(
    file: UploadFile = File(..., description="废弃登记文件"),
    db: Session = Depends(get_db)
):
    content = file.file.read().decode('utf-8-sig')
    
    if file.filename.endswith('.csv'):
        result = parse_waste_csv(content)
    elif file.filename.endswith('.json'):
        result = parse_waste_json(content)
    else:
        raise HTTPException(status_code=400, detail="请上传CSV或JSON文件")
    
    if not result['success'] and result['errors']:
        return {
            "status": "partial",
            "message": f"解析完成，但有{len(result['errors'])}条错误",
            "total": result['total'],
            "errors": result['errors']
        }
    
    success_count = 0
    for record_data in result['records']:
        existing = db.query(WasteRecord).filter(
            WasteRecord.waste_id == record_data['waste_id']
        ).first()
        
        if existing:
            for key, value in record_data.items():
                setattr(existing, key, value)
            success_count += 1
        else:
            record = WasteRecord(**record_data)
            db.add(record)
            success_count += 1
    
    db.commit()
    
    return {
        "status": "success",
        "message": f"成功导入{success_count}条废弃记录",
        "imported": success_count,
        "total": result['total']
    }


@app.get(f"{settings.API_PREFIX}/prescriptions", tags=["查询接口"])
def get_prescriptions(
    patient_id: Optional[str] = Query(None, description="患者ID"),
    status: Optional[str] = Query(None, description="状态"),
    batch_number: Optional[str] = Query(None, description="批号"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    query = db.query(Prescription)
    
    if patient_id:
        query = query.filter(Prescription.patient_id == patient_id)
    if status:
        query = query.filter(Prescription.status == status)
    if batch_number:
        query = query.filter(Prescription.batch_number == batch_number)
    
    total = query.count()
    prescriptions = query.order_by(Prescription.prescription_time.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size).all()
    
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "data": [
            {
                "id": p.id,
                "prescription_id": p.prescription_id,
                "patient_id": p.patient_id,
                "patient_name": p.patient_name,
                "drug_name": p.drug_name,
                "dose": p.dose,
                "unit": p.unit,
                "prescription_time": p.prescription_time,
                "status": p.status,
                "batch_number": p.batch_number
            } for p in prescriptions
        ]
    }


@app.get(f"{settings.API_PREFIX}/drug-batches", tags=["查询接口"])
def get_drug_batches(
    batch_number: Optional[str] = Query(None, description="批号"),
    drug_name: Optional[str] = Query(None, description="药品名称"),
    status: Optional[str] = Query(None, description="状态"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    query = db.query(DrugBatch)
    
    if batch_number:
        query = query.filter(DrugBatch.batch_number.like(f"%{batch_number}%"))
    if drug_name:
        query = query.filter(DrugBatch.drug_name.like(f"%{drug_name}%"))
    if status:
        query = query.filter(DrugBatch.status == status)
    
    total = query.count()
    batches = query.order_by(DrugBatch.receive_time.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size).all()
    
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "data": [
            {
                "id": b.id,
                "batch_number": b.batch_number,
                "drug_name": b.drug_name,
                "drug_id": b.drug_id,
                "spec": b.spec,
                "total_amount": b.total_amount,
                "used_amount": b.used_amount,
                "remaining_amount": b.remaining_amount,
                "unit": b.unit,
                "expire_date": b.expire_date,
                "receive_time": b.receive_time,
                "storage_location": b.storage_location,
                "status": b.status
            } for b in batches
        ]
    }


@app.get(f"{settings.API_PREFIX}/temperature-logs", tags=["查询接口"])
def get_temperature_logs(
    fridge_id: Optional[str] = Query(None, description="冰箱ID"),
    status: Optional[str] = Query(None, description="状态"),
    start_time: Optional[datetime] = Query(None, description="开始时间"),
    end_time: Optional[datetime] = Query(None, description="结束时间"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    query = db.query(TemperatureLog)
    
    if fridge_id:
        query = query.filter(TemperatureLog.fridge_id == fridge_id)
    if status:
        query = query.filter(TemperatureLog.status == status)
    if start_time:
        query = query.filter(TemperatureLog.log_time >= start_time)
    if end_time:
        query = query.filter(TemperatureLog.log_time <= end_time)
    
    total = query.count()
    logs = query.order_by(TemperatureLog.log_time.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size).all()
    
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "data": [
            {
                "id": l.id,
                "fridge_id": l.fridge_id,
                "fridge_name": l.fridge_name,
                "temperature": l.temperature,
                "min_temp": l.min_temp,
                "max_temp": l.max_temp,
                "log_time": l.log_time,
                "status": l.status
            } for l in logs
        ]
    }


@app.get(f"{settings.API_PREFIX}/waste-records", tags=["查询接口"])
def get_waste_records(
    batch_number: Optional[str] = Query(None, description="批号"),
    closed: Optional[int] = Query(None, description="是否闭环(0/1)"),
    start_time: Optional[datetime] = Query(None, description="开始时间"),
    end_time: Optional[datetime] = Query(None, description="结束时间"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    query = db.query(WasteRecord)
    
    if batch_number:
        query = query.filter(WasteRecord.batch_number == batch_number)
    if closed is not None:
        query = query.filter(WasteRecord.closed == closed)
    if start_time:
        query = query.filter(WasteRecord.waste_time >= start_time)
    if end_time:
        query = query.filter(WasteRecord.waste_time <= end_time)
    
    total = query.count()
    records = query.order_by(WasteRecord.waste_time.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size).all()
    
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "data": [
            {
                "id": w.id,
                "waste_id": w.waste_id,
                "prescription_id": w.prescription_id,
                "batch_number": w.batch_number,
                "drug_name": w.drug_name,
                "waste_amount": w.waste_amount,
                "unit": w.unit,
                "waste_reason": w.waste_reason,
                "waste_time": w.waste_time,
                "operator": w.operator,
                "closed": w.closed
            } for w in records
        ]
    }


@app.post(f"{settings.API_PREFIX}/risk/check", tags=["风险复核"])
def check_risks(
    start_time: Optional[datetime] = Query(None, description="开始时间"),
    end_time: Optional[datetime] = Query(None, description="结束时间"),
    save_to_db: bool = Query(False, description="是否保存到数据库"),
    db: Session = Depends(get_db)
):
    engine = RuleEngine(db)
    risks = engine.run_all_rules(start_time=start_time, end_time=end_time)
    
    if save_to_db:
        for risk_data in risks:
            risk = RiskRecord(
                risk_type=risk_data['risk_type'],
                risk_level=risk_data['risk_level'],
                description=risk_data['description'],
                related_prescription_id=risk_data.get('related_prescription_id'),
                related_batch_number=risk_data.get('related_batch_number'),
                related_fridge_id=risk_data.get('related_fridge_id'),
                related_waste_id=risk_data.get('related_waste_id')
            )
            db.add(risk)
        db.commit()
    
    stats = calculate_statistics(risks)
    
    return {
        "status": "success",
        "statistics": stats,
        "risks": risks
    }


@app.get(f"{settings.API_PREFIX}/risk/records", tags=["风险复核"])
def get_risk_records(
    risk_type: Optional[str] = Query(None, description="风险类型"),
    risk_level: Optional[str] = Query(None, description="风险等级"),
    status: Optional[str] = Query(None, description="处理状态"),
    start_time: Optional[datetime] = Query(None, description="开始时间"),
    end_time: Optional[datetime] = Query(None, description="结束时间"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    query = db.query(RiskRecord)
    
    if risk_type:
        query = query.filter(RiskRecord.risk_type == risk_type)
    if risk_level:
        query = query.filter(RiskRecord.risk_level == risk_level)
    if status:
        query = query.filter(RiskRecord.status == status)
    if start_time:
        query = query.filter(RiskRecord.create_time >= start_time)
    if end_time:
        query = query.filter(RiskRecord.create_time <= end_time)
    
    total = query.count()
    records = query.order_by(RiskRecord.create_time.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size).all()
    
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "data": [
            {
                "id": r.id,
                "risk_type": r.risk_type,
                "risk_level": r.risk_level,
                "description": r.description,
                "related_prescription_id": r.related_prescription_id,
                "related_batch_number": r.related_batch_number,
                "related_fridge_id": r.related_fridge_id,
                "related_waste_id": r.related_waste_id,
                "status": r.status,
                "handler": r.handler,
                "handle_time": r.handle_time,
                "create_time": r.create_time
            } for r in records
        ]
    }


@app.get(f"{settings.API_PREFIX}/export/audit-report", tags=["审计导出"])
def export_audit_report(
    start_time: Optional[datetime] = Query(None, description="开始时间"),
    end_time: Optional[datetime] = Query(None, description="结束时间"),
    format: str = Query("markdown", description="导出格式: markdown或json"),
    db: Session = Depends(get_db)
):
    engine = RuleEngine(db)
    risks = engine.run_all_rules(start_time=start_time, end_time=end_time)
    stats = calculate_statistics(risks)
    
    exporter = AuditExporter()
    
    if format.lower() == "json":
        result = exporter.generate_risk_json(risks, stats)
        return JSONResponse(content=result)
    else:
        markdown = exporter.generate_markdown_report(
            risks, stats, start_time, end_time
        )
        
        buffer = BytesIO(markdown.encode('utf-8'))
        buffer.seek(0)
        
        return StreamingResponse(
            buffer,
            media_type="text/markdown",
            headers={
                "Content-Disposition": f"attachment; filename=audit-report_{datetime.now().strftime('%Y%m%d%H%M%S')}.md"
            }
        )


@app.get(f"{settings.API_PREFIX}/export/batch-tracking", tags=["审计导出"])
def export_batch_tracking(
    batch_number: str = Query(..., description="批号"),
    db: Session = Depends(get_db)
):
    batch = db.query(DrugBatch).filter(
        DrugBatch.batch_number == batch_number
    ).first()
    
    if not batch:
        raise HTTPException(status_code=404, detail=f"未找到批号: {batch_number}")
    
    prescriptions = db.query(Prescription).filter(
        Prescription.batch_number == batch_number
    ).all()
    
    wastes = db.query(WasteRecord).filter(
        WasteRecord.batch_number == batch_number
    ).all()
    
    batch_info = {
        "drug_name": batch.drug_name,
        "drug_id": batch.drug_id,
        "spec": batch.spec,
        "total_amount": batch.total_amount,
        "used_amount": batch.used_amount,
        "remaining_amount": batch.remaining_amount,
        "unit": batch.unit,
        "expire_date": str(batch.expire_date) if batch.expire_date else None,
        "receive_time": str(batch.receive_time) if batch.receive_time else None,
        "storage_location": batch.storage_location,
        "supplier": batch.supplier,
        "status": batch.status
    }
    
    presc_list = [
        {
            "prescription_id": p.prescription_id,
            "patient_id": p.patient_id,
            "patient_name": p.patient_name,
            "dose": p.dose,
            "unit": p.unit,
            "prescription_time": str(p.prescription_time),
            "status": p.status
        } for p in prescriptions
    ]
    
    waste_list = [
        {
            "waste_id": w.waste_id,
            "waste_amount": w.waste_amount,
            "unit": w.unit,
            "waste_reason": w.waste_reason,
            "waste_time": str(w.waste_time),
            "operator": w.operator,
            "closed": w.closed
        } for w in wastes
    ]
    
    exporter = AuditExporter()
    markdown = exporter.generate_batch_tracking_report(
        batch_number, batch_info, presc_list, waste_list
    )
    
    buffer = BytesIO(markdown.encode('utf-8'))
    buffer.seek(0)
    
    return StreamingResponse(
        buffer,
        media_type="text/markdown",
        headers={
            "Content-Disposition": f"attachment; filename=batch-tracking_{batch_number}_{datetime.now().strftime('%Y%m%d%H%M%S')}.md"
        }
    )


@app.get(f"{settings.API_PREFIX}/stats/dashboard", tags=["统计信息"])
def get_dashboard_stats(db: Session = Depends(get_db)):
    presc_count = db.query(Prescription).count()
    batch_count = db.query(DrugBatch).count()
    temp_count = db.query(TemperatureLog).count()
    waste_count = db.query(WasteRecord).count()
    
    engine = RuleEngine(db)
    risks = engine.run_all_rules()
    stats = calculate_statistics(risks)
    
    unclosed_waste = db.query(WasteRecord).filter(WasteRecord.closed == 0).count()
    active_batches = db.query(DrugBatch).filter(DrugBatch.status == 'active').count()
    
    return {
        "data_overview": {
            "prescriptions": presc_count,
            "drug_batches": batch_count,
            "temperature_logs": temp_count,
            "waste_records": waste_count
        },
        "risk_summary": stats,
        "attention_items": {
            "unclosed_waste": unclosed_waste,
            "active_batches": active_batches
        }
    }
