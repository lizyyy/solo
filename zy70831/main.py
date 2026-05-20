from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional, List
import hashlib
import json
import uuid
import io
import pandas as pd

from database import Base, engine, get_db, Batch, BedTurnoverRecord, AuditLog
import schemas

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="公立医院床位周转API服务",
    description="用于处理住院处床位周转材料的API服务，支持去重、审计追踪和报告生成",
    version="1.0.0"
)

def calculate_batch_hash(records: List[dict]) -> str:
    sorted_records = sorted(records, key=lambda x: json.dumps(x, sort_keys=True))
    records_json = json.dumps(sorted_records, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(records_json.encode('utf-8')).hexdigest()

def calculate_admission_days(admission_date: datetime, discharge_date: Optional[datetime]) -> Optional[int]:
    if discharge_date:
        delta = discharge_date - admission_date
        return max(1, delta.days + 1)
    return None

def log_audit(
    db: Session,
    batch_id: Optional[str],
    record_id: Optional[int],
    operator: str,
    operation_type: str,
    reason: str,
    field_name: Optional[str] = None,
    old_value: Optional[str] = None,
    new_value: Optional[str] = None
):
    audit_log = AuditLog(
        batch_id=batch_id,
        record_id=record_id,
        operator=operator,
        operation_type=operation_type,
        field_name=field_name,
        old_value=old_value,
        new_value=new_value,
        reason=reason
    )
    db.add(audit_log)
    db.commit()

@app.post("/api/batches", response_model=schemas.BatchResponse, summary="提交床位周转批次")
def submit_batch(request: schemas.BatchSubmitRequest, db: Session = Depends(get_db)):
    records_dict = [record.model_dump() for record in request.records]
    batch_hash = calculate_batch_hash(records_dict)

    existing_batch = db.query(Batch).filter(Batch.batch_hash == batch_hash).first()
    if existing_batch:
        record_count = db.query(BedTurnoverRecord).filter(
            BedTurnoverRecord.batch_id == existing_batch.id,
            BedTurnoverRecord.is_effective == True
        ).count()
        return schemas.BatchResponse(
            batch_id=existing_batch.id,
            batch_hash=existing_batch.batch_hash,
            submitted_by=existing_batch.submitted_by,
            submitted_at=existing_batch.submitted_at,
            status=existing_batch.status,
            record_count=record_count,
            is_duplicate=True,
            message="该批次材料已提交过，返回原有处理结果"
        )

    batch_id = str(uuid.uuid4())
    batch = Batch(
        id=batch_id,
        batch_hash=batch_hash,
        submitted_by=request.submitted_by,
        raw_data=json.dumps(records_dict, ensure_ascii=False),
        remark=request.remark,
        status="completed"
    )
    db.add(batch)

    for item in request.records:
        admission_days = calculate_admission_days(item.admission_date, item.discharge_date)
        record = BedTurnoverRecord(
            batch_id=batch_id,
            department=item.department,
            bed_number=item.bed_number,
            patient_id=item.patient_id,
            patient_name=item.patient_name,
            admission_date=item.admission_date,
            discharge_date=item.discharge_date,
            admission_days=admission_days,
            diagnosis=item.diagnosis,
            surgeon=item.surgeon
        )
        db.add(record)

    db.commit()

    log_audit(
        db=db,
        batch_id=batch_id,
        record_id=None,
        operator=request.submitted_by,
        operation_type="BATCH_SUBMIT",
        reason=f"提交床位周转批次，共{len(request.records)}条记录"
    )

    return schemas.BatchResponse(
        batch_id=batch_id,
        batch_hash=batch_hash,
        submitted_by=request.submitted_by,
        submitted_at=batch.submitted_at,
        status="completed",
        record_count=len(request.records),
        is_duplicate=False,
        message="批次提交成功，已生成有效记录"
    )

@app.get("/api/batches/{batch_id}", response_model=schemas.BatchDetailResponse, summary="获取批次详情")
def get_batch(batch_id: str, db: Session = Depends(get_db)):
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    
    records = db.query(BedTurnoverRecord).filter(
        BedTurnoverRecord.batch_id == batch_id,
        BedTurnoverRecord.is_effective == True
    ).all()
    
    return schemas.BatchDetailResponse(
        batch_id=batch.id,
        batch_hash=batch.batch_hash,
        submitted_by=batch.submitted_by,
        submitted_at=batch.submitted_at,
        status=batch.status,
        remark=batch.remark,
        records=[schemas.BedTurnoverRecordResponse.model_validate(r) for r in records]
    )

@app.get("/api/batches", summary="获取批次列表")
def list_batches(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    batches = db.query(Batch).order_by(Batch.submitted_at.desc()).offset(skip).limit(limit).all()
    result = []
    for batch in batches:
        record_count = db.query(BedTurnoverRecord).filter(
            BedTurnoverRecord.batch_id == batch.id,
            BedTurnoverRecord.is_effective == True
        ).count()
        result.append({
            "batch_id": batch.id,
            "submitted_by": batch.submitted_by,
            "submitted_at": batch.submitted_at,
            "status": batch.status,
            "record_count": record_count
        })
    return result

@app.put("/api/records/{record_id}", summary="修改床位周转记录")
def update_record(
    record_id: int,
    request: schemas.UpdateRecordRequest,
    db: Session = Depends(get_db)
):
    record = db.query(BedTurnoverRecord).filter(
        BedTurnoverRecord.id == record_id,
        BedTurnoverRecord.is_effective == True
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")

    allowed_fields = ["department", "bed_number", "patient_id", "patient_name", 
                      "admission_date", "discharge_date", "diagnosis", "surgeon"]
    
    for field, new_value in request.updates.items():
        if field not in allowed_fields:
            raise HTTPException(status_code=400, detail=f"不允许修改字段: {field}")
        
        old_value = str(getattr(record, field))
        
        if field in ["admission_date", "discharge_date"]:
            if new_value:
                new_value = datetime.fromisoformat(new_value)
        
        setattr(record, field, new_value)
        
        log_audit(
            db=db,
            batch_id=record.batch_id,
            record_id=record_id,
            operator=request.operator,
            operation_type="RECORD_UPDATE",
            reason=request.reason,
            field_name=field,
            old_value=old_value,
            new_value=str(new_value)
        )

    if "admission_date" in request.updates or "discharge_date" in request.updates:
        record.admission_days = calculate_admission_days(record.admission_date, record.discharge_date)

    db.commit()
    
    return {"message": "记录更新成功", "record_id": record_id}

@app.get("/api/audit/batch/{batch_id}", response_model=List[schemas.AuditLogResponse], summary="获取批次审计日志")
def get_batch_audit_logs(batch_id: str, db: Session = Depends(get_db)):
    logs = db.query(AuditLog).filter(AuditLog.batch_id == batch_id).order_by(AuditLog.operation_time.desc()).all()
    return [schemas.AuditLogResponse.model_validate(log) for log in logs]

@app.get("/api/audit/record/{record_id}", response_model=List[schemas.AuditLogResponse], summary="获取单条记录审计日志")
def get_record_audit_logs(record_id: int, db: Session = Depends(get_db)):
    logs = db.query(AuditLog).filter(AuditLog.record_id == record_id).order_by(AuditLog.operation_time.desc()).all()
    return [schemas.AuditLogResponse.model_validate(log) for log in logs]

@app.get("/api/trace/{record_id}", summary="关键字段追溯")
def trace_record_fields(record_id: int, db: Session = Depends(get_db)):
    record = db.query(BedTurnoverRecord).filter(BedTurnoverRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")

    key_fields = ["department", "bed_number", "patient_id", "patient_name", 
                  "admission_date", "discharge_date", "diagnosis", "surgeon"]
    
    result = []
    for field in key_fields:
        current_value = getattr(record, field)
        
        logs = db.query(AuditLog).filter(
            AuditLog.record_id == record_id,
            AuditLog.field_name == field
        ).order_by(AuditLog.operation_time).all()
        
        change_history = []
        original_value = current_value
        
        if logs:
            original_value = logs[0].old_value
            for log in logs:
                change_history.append({
                    "operator": log.operator,
                    "operation_time": log.operation_time,
                    "old_value": log.old_value,
                    "new_value": log.new_value,
                    "reason": log.reason
                })
        
        result.append({
            "field_name": field,
            "original_value": original_value,
            "current_value": current_value,
            "change_count": len(change_history),
            "change_history": change_history
        })
    
    return {"record_id": record_id, "traceability": result}

@app.get("/api/reports/{batch_id}", response_model=schemas.ReportResponse, summary="生成床位周转报告")
def generate_report(batch_id: str, db: Session = Depends(get_db)):
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    
    records = db.query(BedTurnoverRecord).filter(
        BedTurnoverRecord.batch_id == batch_id,
        BedTurnoverRecord.is_effective == True
    ).all()

    total_records = len(records)
    effective_records = sum(1 for r in records if r.discharge_date)
    departments = set(r.department for r in records)
    
    valid_days = [r.admission_days for r in records if r.admission_days]
    avg_admission_days = sum(valid_days) / len(valid_days) if valid_days else 0
    
    turnover_rate = effective_records / total_records if total_records > 0 else 0

    dept_stats = {}
    for dept in departments:
        dept_records = [r for r in records if r.department == dept]
        dept_discharged = sum(1 for r in dept_records if r.discharge_date)
        dept_valid_days = [r.admission_days for r in dept_records if r.admission_days]
        dept_stats[dept] = {
            "department": dept,
            "total_records": len(dept_records),
            "discharged_records": dept_discharged,
            "avg_admission_days": sum(dept_valid_days) / len(dept_valid_days) if dept_valid_days else 0,
            "turnover_rate": dept_discharged / len(dept_records) if dept_records else 0
        }

    return schemas.ReportResponse(
        batch_id=batch_id,
        generated_at=datetime.utcnow(),
        summary=schemas.ReportSummary(
            total_records=total_records,
            effective_records=effective_records,
            total_departments=len(departments),
            avg_admission_days=round(avg_admission_days, 2),
            turnover_rate=round(turnover_rate, 4)
        ),
        department_statistics=list(dept_stats.values())
    )

@app.get("/api/reports/{batch_id}/download", summary="下载Excel报告")
def download_report(batch_id: str, db: Session = Depends(get_db)):
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    
    records = db.query(BedTurnoverRecord).filter(
        BedTurnoverRecord.batch_id == batch_id,
        BedTurnoverRecord.is_effective == True
    ).all()

    data = []
    for r in records:
        data.append({
            "科室": r.department,
            "床号": r.bed_number,
            "患者ID": r.patient_id,
            "患者姓名": r.patient_name,
            "入院日期": r.admission_date.strftime("%Y-%m-%d") if r.admission_date else "",
            "出院日期": r.discharge_date.strftime("%Y-%m-%d") if r.discharge_date else "",
            "住院天数": r.admission_days,
            "诊断": r.diagnosis or "",
            "主治医生": r.surgeon or "",
            "批次ID": batch_id
        })

    df = pd.DataFrame(data)
    
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='床位周转记录')
        
        summary_data = []
        departments = set(r.department for r in records)
        for dept in departments:
            dept_records = [r for r in records if r.department == dept]
            dept_discharged = sum(1 for r in dept_records if r.discharge_date)
            dept_valid_days = [r.admission_days for r in dept_records if r.admission_days]
            summary_data.append({
                "科室": dept,
                "总记录数": len(dept_records),
                "已出院": dept_discharged,
                "平均住院天数": round(sum(dept_valid_days) / len(dept_valid_days), 2) if dept_valid_days else 0,
                "床位周转率": round(dept_discharged / len(dept_records), 4) if dept_records else 0
            })
        
        pd.DataFrame(summary_data).to_excel(writer, index=False, sheet_name='科室统计')
    
    output.seek(0)
    
    filename = f"床位周转报告_{batch_id[:8]}_{datetime.now().strftime('%Y%m%d')}.xlsx"
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
