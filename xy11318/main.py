from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
from typing import List, Optional
from datetime import datetime, date
from pydantic import BaseModel
import uuid
import os
from database import get_db, init_db, ScheduleAnomaly, GPSRecord, DriverCheckIn, ParentComplaint
import pandas as pd
from io import BytesIO

app = FastAPI(title="校车调度异常处理系统")

class AnomalyCreate(BaseModel):
    bus_id: str
    driver_id: str
    driver_name: str
    route_name: str
    scheduled_time: datetime
    actual_time: datetime
    anomaly_type: str
    responsible_person: str
    notes: Optional[str] = None

class AnomalyUpdate(BaseModel):
    status: Optional[str] = None
    responsible_person: Optional[str] = None
    notes: Optional[str] = None

class AnomalyResponse(BaseModel):
    id: int
    anomaly_id: str
    bus_id: str
    driver_id: str
    driver_name: str
    route_name: str
    scheduled_time: datetime
    actual_time: datetime
    delay_minutes: int
    anomaly_type: str
    status: str
    responsible_person: str
    gps_match: bool
    checkin_match: bool
    complaint_count: int
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime

class BatchOperationResult(BaseModel):
    success_count: int
    failure_count: int
    successful_ids: List[str]
    failed_ids: List[str]
    errors: List[str]

@app.on_event("startup")
def startup_event():
    init_db()

@app.post("/api/anomalies/", response_model=AnomalyResponse)
def create_anomaly(anomaly: AnomalyCreate, db: Session = Depends(get_db)):
    delay = int((anomaly.actual_time - anomaly.scheduled_time).total_seconds() // 60)
    db_anomaly = ScheduleAnomaly(
        anomaly_id=f"ANOMALY-{uuid.uuid4().hex[:8].upper()}",
        bus_id=anomaly.bus_id,
        driver_id=anomaly.driver_id,
        driver_name=anomaly.driver_name,
        route_name=anomaly.route_name,
        scheduled_time=anomaly.scheduled_time,
        actual_time=anomaly.actual_time,
        delay_minutes=delay,
        anomaly_type=anomaly.anomaly_type,
        responsible_person=anomaly.responsible_person,
        notes=anomaly.notes
    )
    db.add(db_anomaly)
    db.commit()
    db.refresh(db_anomaly)
    return db_anomaly

@app.get("/api/anomalies/", response_model=List[AnomalyResponse])
def list_anomalies(
    responsible_person: Optional[str] = None,
    status: Optional[str] = None,
    anomaly_type: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(ScheduleAnomaly)
    
    filters = []
    if responsible_person:
        filters.append(ScheduleAnomaly.responsible_person == responsible_person)
    if status:
        filters.append(ScheduleAnomaly.status == status)
    if anomaly_type:
        filters.append(ScheduleAnomaly.anomaly_type == anomaly_type)
    if start_date:
        filters.append(ScheduleAnomaly.scheduled_time >= datetime.combine(start_date, datetime.min.time()))
    if end_date:
        filters.append(ScheduleAnomaly.scheduled_time <= datetime.combine(end_date, datetime.max.time()))
    
    if filters:
        query = query.filter(and_(*filters))
    
    return query.offset(skip).limit(limit).all()

@app.get("/api/anomalies/summary")
def get_summary(db: Session = Depends(get_db)):
    total = db.query(ScheduleAnomaly).count()
    pending = db.query(ScheduleAnomaly).filter(ScheduleAnomaly.status == "pending").count()
    resolved = db.query(ScheduleAnomaly).filter(ScheduleAnomaly.status == "resolved").count()
    by_type = db.query(ScheduleAnomaly.anomaly_type, func.count(ScheduleAnomaly.id)).group_by(ScheduleAnomaly.anomaly_type).all()
    by_person = db.query(ScheduleAnomaly.responsible_person, func.count(ScheduleAnomaly.id)).group_by(ScheduleAnomaly.responsible_person).all()
    
    return {
        "total_anomalies": total,
        "pending": pending,
        "resolved": resolved,
        "by_type": {t: c for t, c in by_type},
        "by_responsible_person": {p: c for p, c in by_person}
    }

@app.get("/api/anomalies/{anomaly_id}", response_model=AnomalyResponse)
def get_anomaly(anomaly_id: str, db: Session = Depends(get_db)):
    anomaly = db.query(ScheduleAnomaly).filter(ScheduleAnomaly.anomaly_id == anomaly_id).first()
    if not anomaly:
        raise HTTPException(status_code=404, detail="Anomaly not found")
    return anomaly

@app.put("/api/anomalies/{anomaly_id}", response_model=AnomalyResponse)
def update_anomaly(anomaly_id: str, update: AnomalyUpdate, db: Session = Depends(get_db)):
    anomaly = db.query(ScheduleAnomaly).filter(ScheduleAnomaly.anomaly_id == anomaly_id).first()
    if not anomaly:
        raise HTTPException(status_code=404, detail="Anomaly not found")
    
    update_data = update.dict(exclude_unset=True)
    for field in update_data:
        setattr(anomaly, field, update_data[field])
    
    db.commit()
    db.refresh(anomaly)
    return anomaly

@app.post("/api/anomalies/batch/", response_model=BatchOperationResult)
def create_batch_anomalies(anomalies: List[AnomalyCreate], db: Session = Depends(get_db)):
    successful = []
    failed = []
    errors = []
    
    for i, anomaly in enumerate(anomalies):
        try:
            delay = int((anomaly.actual_time - anomaly.scheduled_time).total_seconds() // 60)
            db_anomaly = ScheduleAnomaly(
                anomaly_id=f"ANOMALY-{uuid.uuid4().hex[:8].upper()}",
                bus_id=anomaly.bus_id,
                driver_id=anomaly.driver_id,
                driver_name=anomaly.driver_name,
                route_name=anomaly.route_name,
                scheduled_time=anomaly.scheduled_time,
                actual_time=anomaly.actual_time,
                delay_minutes=delay,
                anomaly_type=anomaly.anomaly_type,
                responsible_person=anomaly.responsible_person,
                notes=anomaly.notes
            )
            db.add(db_anomaly)
            db.commit()
            db.refresh(db_anomaly)
            successful.append(db_anomaly.anomaly_id)
        except Exception as e:
            db.rollback()
            failed.append(f"index_{i}")
            errors.append(f"Item {i}: {str(e)}")
    
    return BatchOperationResult(
        success_count=len(successful),
        failure_count=len(failed),
        successful_ids=successful,
        failed_ids=failed,
        errors=errors
    )

@app.put("/api/anomalies/batch/retry", response_model=BatchOperationResult)
def retry_batch_operation(
    anomaly_ids: List[str], status: str, db: Session = Depends(get_db)):
    successful = []
    failed = []
    errors = []
    
    for anomaly_id in anomaly_ids:
        try:
            anomaly = db.query(ScheduleAnomaly).filter(ScheduleAnomaly.anomaly_id == anomaly_id).first()
            if not anomaly:
                failed.append(anomaly_id)
                errors.append(f"{anomaly_id}: Not found")
                continue
            anomaly.status = status
            db.commit()
            successful.append(anomaly_id)
        except Exception as e:
            db.rollback()
            failed.append(anomaly_id)
            errors.append(f"{anomaly_id}: {str(e)}")
    
    return BatchOperationResult(
        success_count=len(successful),
        failure_count=len(failed),
        successful_ids=successful,
        failed_ids=failed,
        errors=errors
    )

@app.get("/api/export/anomalies")
def export_anomalies(
    responsible_person: Optional[str] = None,
    status: Optional[str] = None,
    anomaly_type: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    format: str = Query("excel", pattern="^(excel|csv)$"),
    db: Session = Depends(get_db)
):
    query = db.query(ScheduleAnomaly)
    
    filters = []
    if responsible_person:
        filters.append(ScheduleAnomaly.responsible_person == responsible_person)
    if status:
        filters.append(ScheduleAnomaly.status == status)
    if anomaly_type:
        filters.append(ScheduleAnomaly.anomaly_type == anomaly_type)
    if start_date:
        filters.append(ScheduleAnomaly.scheduled_time >= datetime.combine(start_date, datetime.min.time()))
    if end_date:
        filters.append(ScheduleAnomaly.scheduled_time <= datetime.combine(end_date, datetime.max.time()))
    
    if filters:
        query = query.filter(and_(*filters))
    
    anomalies = query.all()
    
    data = []
    for a in anomalies:
        data.append({
            "异常ID": a.anomaly_id,
            "车辆ID": a.bus_id,
            "司机ID": a.driver_id,
            "司机姓名": a.driver_name,
            "线路名称": a.route_name,
            "计划时间": a.scheduled_time.strftime("%Y-%m-%d %H:%M:%S"),
            "实际时间": a.actual_time.strftime("%Y-%m-%d %H:%M:%S"),
            "延误分钟": a.delay_minutes,
            "异常类型": a.anomaly_type,
            "状态": a.status,
            "负责人": a.responsible_person,
            "GPS匹配": "是" if a.gps_match else "否",
            "打卡匹配": "是" if a.checkin_match else "否",
            "投诉数量": a.complaint_count,
            "备注": a.notes or "",
            "创建时间": a.created_at.strftime("%Y-%m-%d %H:%M:%S")
        })
    
    df = pd.DataFrame(data)
    export_dir = "exports"
    os.makedirs(export_dir, exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    if format == "excel":
        filename = f"{export_dir}/anomalies_{timestamp}.xlsx"
        df.to_excel(filename, index=False, engine="openpyxl")
    else:
        filename = f"{export_dir}/anomalies_{timestamp}.csv"
        df.to_csv(filename, index=False, encoding="utf-8-sig")
    
    return FileResponse(filename, filename=os.path.basename(filename))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
