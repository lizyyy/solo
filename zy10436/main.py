from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import create_engine, Column, String, Integer, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from enum import Enum
import json
import uuid

DATABASE_URL = "sqlite:///./cdn_switch.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class SwitchStatus(str, Enum):
    PENDING = "pending"
    SWITCHING = "switching"
    SWITCHED = "switched"
    RECOVERING = "recovering"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class Domain(Base):
    __tablename__ = "domains"
    id = Column(String, primary_key=True, index=True)
    domain_name = Column(String, unique=True, index=True, nullable=False)
    primary_origin = Column(String, nullable=False)
    backup_origin = Column(String, nullable=False)
    current_origin = Column(String, nullable=False)
    is_switched = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    switches = relationship("SwitchRecord", back_populates="domain")

class SwitchRecord(Base):
    __tablename__ = "switch_records"
    id = Column(String, primary_key=True, index=True)
    domain_id = Column(String, ForeignKey("domains.id"))
    switch_reason = Column(Text, nullable=False)
    recovery_condition = Column(Text, nullable=False)
    status = Column(String, default=SwitchStatus.PENDING)
    primary_health = Column(Boolean, default=True)
    switched_at = Column(DateTime)
    recovered_at = Column(DateTime)
    reminder_sent = Column(Boolean, default=False)
    reminder_time = Column(DateTime)
    created_by = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    domain = relationship("Domain", back_populates="switches")
    reports = relationship("SwitchReport", back_populates="switch_record")
    exceptions = relationship("SwitchException", back_populates="switch_record")

class SwitchReport(Base):
    __tablename__ = "switch_reports"
    id = Column(String, primary_key=True, index=True)
    switch_id = Column(String, ForeignKey("switch_records.id"))
    report_type = Column(String)
    content = Column(Text)
    generated_at = Column(DateTime, default=datetime.utcnow)
    switch_record = relationship("SwitchRecord", back_populates="reports")

class SwitchException(Base):
    __tablename__ = "switch_exceptions"
    id = Column(String, primary_key=True, index=True)
    switch_id = Column(String, ForeignKey("switch_records.id"))
    raw_input = Column(Text)
    error_message = Column(Text)
    resolution = Column(Text)
    occurred_at = Column(DateTime, default=datetime.utcnow)
    resolved = Column(Boolean, default=False)
    switch_record = relationship("SwitchRecord", back_populates="exceptions")

Base.metadata.create_all(bind=engine)

class DomainCreate(BaseModel):
    domain_name: str
    primary_origin: str
    backup_origin: str

class SwitchCreate(BaseModel):
    domain_name: str
    switch_reason: str
    recovery_condition: str
    created_by: Optional[str] = "system"

class SwitchUpdate(BaseModel):
    status: Optional[SwitchStatus] = None
    primary_health: Optional[bool] = None
    recovery_condition: Optional[str] = None

class SwitchReportCreate(BaseModel):
    switch_id: str
    report_type: str
    content: str

class ExceptionCreate(BaseModel):
    switch_id: Optional[str] = None
    raw_input: str
    error_message: str
    resolution: Optional[str] = ""

app = FastAPI(title="CDN 源站故障切换 API", version="1.0.0")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.post("/api/domains", response_model=Dict[str, Any])
def create_domain(domain: DomainCreate):
    db = next(get_db())
    existing = db.query(Domain).filter(Domain.domain_name == domain.domain_name).first()
    if existing:
        raise HTTPException(status_code=400, detail="域名已存在")
    
    db_domain = Domain(
        id=str(uuid.uuid4()),
        domain_name=domain.domain_name,
        primary_origin=domain.primary_origin,
        backup_origin=domain.backup_origin,
        current_origin=domain.primary_origin
    )
    db.add(db_domain)
    db.commit()
    db.refresh(db_domain)
    return {"code": 0, "message": "success", "data": {"id": db_domain.id, "domain_name": db_domain.domain_name}}

@app.get("/api/domains", response_model=Dict[str, Any])
def list_domains():
    db = next(get_db())
    domains = db.query(Domain).all()
    return {"code": 0, "message": "success", "data": [
        {"id": d.id, "domain_name": d.domain_name, "primary_origin": d.primary_origin,
         "backup_origin": d.backup_origin, "current_origin": d.current_origin, "is_switched": d.is_switched}
        for d in domains
    ]}

@app.post("/api/switches", response_model=Dict[str, Any])
def create_switch(switch: SwitchCreate):
    db = next(get_db())
    domain = db.query(Domain).filter(Domain.domain_name == switch.domain_name).first()
    if not domain:
        raise HTTPException(status_code=404, detail="域名不存在")
    
    active_switch = db.query(SwitchRecord).filter(
        SwitchRecord.domain_id == domain.id,
        SwitchRecord.status.in_([SwitchStatus.PENDING, SwitchStatus.SWITCHING, SwitchStatus.SWITCHED])
    ).first()
    
    if active_switch:
        return {
            "code": 409,
            "message": "存在进行中的切换记录，幂等保护已触发",
            "data": {"switch_id": active_switch.id, "status": active_switch.status}
        }
    
    if not domain.is_switched:
        primary_health = check_health(domain.primary_origin)
    else:
        primary_health = True
    
    switch_record = SwitchRecord(
        id=str(uuid.uuid4()),
        domain_id=domain.id,
        switch_reason=switch.switch_reason,
        recovery_condition=switch.recovery_condition,
        status=SwitchStatus.PENDING,
        primary_health=primary_health,
        created_by=switch.created_by
    )
    db.add(switch_record)
    db.commit()
    db.refresh(switch_record)
    
    return {"code": 0, "message": "切换请求已创建", "data": {"switch_id": switch_record.id}}

@app.post("/api/switches/{switch_id}/advance", response_model=Dict[str, Any])
def advance_switch(switch_id: str):
    db = next(get_db())
    switch_record = db.query(SwitchRecord).filter(SwitchRecord.id == switch_id).first()
    if not switch_record:
        raise HTTPException(status_code=404, detail="切换记录不存在")
    
    domain = switch_record.domain
    old_status = switch_record.status
    
    try:
        if switch_record.status == SwitchStatus.PENDING:
            switch_record.primary_health = check_health(domain.primary_origin)
            if switch_record.primary_health:
                switch_record.status = SwitchStatus.CANCELLED
                log_exception(db, switch_id, json.dumps({"action": "advance", "from": old_status}), 
                             "主源站健康，无需切换", "已取消切换")
                return {"code": 400, "message": "主源站健康，无需切换", "data": {"status": switch_record.status}}
            switch_record.status = SwitchStatus.SWITCHING
        
        elif switch_record.status == SwitchStatus.SWITCHING:
            domain.current_origin = domain.backup_origin
            domain.is_switched = True
            switch_record.switched_at = datetime.utcnow()
            switch_record.reminder_time = datetime.utcnow() + timedelta(hours=24)
            switch_record.status = SwitchStatus.SWITCHED
        
        elif switch_record.status == SwitchStatus.SWITCHED:
            switch_record.primary_health = check_health(domain.primary_origin)
            if not switch_record.primary_health:
                return {"code": 400, "message": "主源站未恢复健康，暂不能切回", 
                        "data": {"status": switch_record.status, "primary_health": False}}
            switch_record.status = SwitchStatus.RECOVERING
        
        elif switch_record.status == SwitchStatus.RECOVERING:
            domain.current_origin = domain.primary_origin
            domain.is_switched = False
            switch_record.recovered_at = datetime.utcnow()
            switch_record.status = SwitchStatus.COMPLETED
        
        db.commit()
        return {"code": 0, "message": "状态推进成功", 
                "data": {"switch_id": switch_id, "old_status": old_status, "new_status": switch_record.status}}
    
    except Exception as e:
        log_exception(db, switch_id, json.dumps({"action": "advance", "from": old_status}), str(e), "")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/switches", response_model=Dict[str, Any])
def list_switches(status: Optional[str] = None):
    db = next(get_db())
    query = db.query(SwitchRecord)
    if status:
        query = query.filter(SwitchRecord.status == status)
    switches = query.order_by(SwitchRecord.created_at.desc()).all()
    
    return {"code": 0, "message": "success", "data": [
        {"id": s.id, "domain_name": s.domain.domain_name, "status": s.status,
         "switch_reason": s.switch_reason, "primary_health": s.primary_health,
         "created_at": s.created_at.isoformat(), "switched_at": s.switched_at.isoformat() if s.switched_at else None}
        for s in switches
    ]}

@app.post("/api/switches/{switch_id}/manual-fix", response_model=Dict[str, Any])
def manual_fix(switch_id: str, update: SwitchUpdate):
    db = next(get_db())
    switch_record = db.query(SwitchRecord).filter(SwitchRecord.id == switch_id).first()
    if not switch_record:
        raise HTTPException(status_code=404, detail="切换记录不存在")
    
    if update.status:
        switch_record.status = update.status
    if update.primary_health is not None:
        switch_record.primary_health = update.primary_health
    if update.recovery_condition:
        switch_record.recovery_condition = update.recovery_condition
    
    db.commit()
    return {"code": 0, "message": "人工修正成功", "data": {"switch_id": switch_id, "status": switch_record.status}}

@app.get("/api/switches/{switch_id}/export", response_model=Dict[str, Any])
def export_report(switch_id: str):
    db = next(get_db())
    switch_record = db.query(SwitchRecord).filter(SwitchRecord.id == switch_id).first()
    if not switch_record:
        raise HTTPException(status_code=404, detail="切换记录不存在")
    
    report = {
        "switch_id": switch_record.id,
        "domain_name": switch_record.domain.domain_name,
        "primary_origin": switch_record.domain.primary_origin,
        "backup_origin": switch_record.domain.backup_origin,
        "switch_reason": switch_record.switch_reason,
        "recovery_condition": switch_record.recovery_condition,
        "status": switch_record.status,
        "primary_health": switch_record.primary_health,
        "created_at": switch_record.created_at.isoformat(),
        "switched_at": switch_record.switched_at.isoformat() if switch_record.switched_at else None,
        "recovered_at": switch_record.recovered_at.isoformat() if switch_record.recovered_at else None,
        "duration_minutes": (switch_record.recovered_at - switch_record.switched_at).total_seconds() // 60 
                          if switch_record.recovered_at and switch_record.switched_at else None,
        "exceptions": [{"raw_input": e.raw_input, "error_message": e.error_message, 
                       "resolution": e.resolution} for e in switch_record.exceptions]
    }
    
    db_report = SwitchReport(
        id=str(uuid.uuid4()),
        switch_id=switch_id,
        report_type="full",
        content=json.dumps(report, ensure_ascii=False)
    )
    db.add(db_report)
    db.commit()
    
    return {"code": 0, "message": "报告导出成功", "data": report}

@app.get("/api/reminders", response_model=Dict[str, Any])
def check_reminders():
    db = next(get_db())
    now = datetime.utcnow()
    pending_reminders = db.query(SwitchRecord).filter(
        SwitchRecord.status == SwitchStatus.SWITCHED,
        SwitchRecord.reminder_sent == False,
        SwitchRecord.reminder_time <= now
    ).all()
    
    for s in pending_reminders:
        s.reminder_sent = True
    db.commit()
    
    return {"code": 0, "message": "success", "data": [
        {"switch_id": s.id, "domain_name": s.domain.domain_name, 
         "switched_at": s.switched_at.isoformat(), "hours_elapsed": (now - s.switched_at).total_seconds() // 3600}
        for s in pending_reminders
    ]}

@app.post("/api/exceptions", response_model=Dict[str, Any])
def log_exception_endpoint(exception: ExceptionCreate):
    db = next(get_db())
    exc = log_exception(db, exception.switch_id, exception.raw_input, exception.error_message, exception.resolution)
    return {"code": 0, "message": "异常已记录", "data": {"exception_id": exc.id}}

def check_health(origin: str) -> bool:
    import random
    if "healthy" in origin:
        return True
    if "unhealthy" in origin:
        return False
    health_status = getattr(check_health, "_status", {})
    if origin in health_status:
        return health_status[origin]
    result = random.choice([True, False])
    health_status[origin] = result
    check_health._status = health_status
    return result

def log_exception(db, switch_id: Optional[str], raw_input: str, error_message: str, resolution: str):
    exc = SwitchException(
        id=str(uuid.uuid4()),
        switch_id=switch_id,
        raw_input=raw_input,
        error_message=error_message,
        resolution=resolution,
        resolved=bool(resolution)
    )
    db.add(exc)
    db.commit()
    return exc

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
