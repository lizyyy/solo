from datetime import datetime, date
from typing import Optional, List, Dict, Any
from enum import Enum
import json
import io

from fastapi import FastAPI, HTTPException, Query, Body
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, validator
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Date, Text, Boolean, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
import pandas as pd

DATABASE_URL = "sqlite:///./api_registry.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class RegistrationStatus(str, Enum):
    PENDING = "pending"
    LOG_VERIFIED = "log_verified"
    TRANSFORMATION_CONFIRMED = "transformation_confirmed"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    DELAYED = "delayed"
    EXCEPTION = "exception"

class CallerRegistration(Base):
    __tablename__ = "caller_registrations"
    
    id = Column(Integer, primary_key=True, index=True)
    api_path = Column(String, index=True, nullable=False)
    caller_system = Column(String, index=True, nullable=False)
    last_call_time = Column(DateTime)
    contact_person = Column(String)
    contact_email = Column(String)
    contact_phone = Column(String)
    status = Column(String, default=RegistrationStatus.PENDING)
    transformation_plan = Column(Text)
    planned_completion_date = Column(Date)
    actual_completion_date = Column(Date)
    delay_reason = Column(Text)
    extension_days = Column(Integer, default=0)
    raw_input = Column(Text)
    processing_notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_manual_correction = Column(Boolean, default=False)
    corrected_by = Column(String)
    
    log_evidences = relationship("LogEvidence", back_populates="registration", cascade="all, delete-orphan")
    status_history = relationship("StatusHistory", back_populates="registration", cascade="all, delete-orphan")

class LogEvidence(Base):
    __tablename__ = "log_evidences"
    
    id = Column(Integer, primary_key=True, index=True)
    registration_id = Column(Integer, ForeignKey("caller_registrations.id"))
    log_source = Column(String)
    log_timestamp = Column(DateTime)
    log_details = Column(Text)
    call_count = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    registration = relationship("CallerRegistration", back_populates="log_evidences")

class StatusHistory(Base):
    __tablename__ = "status_history"
    
    id = Column(Integer, primary_key=True, index=True)
    registration_id = Column(Integer, ForeignKey("caller_registrations.id"))
    previous_status = Column(String)
    new_status = Column(String)
    changed_by = Column(String)
    change_reason = Column(Text)
    changed_at = Column(DateTime, default=datetime.utcnow)
    
    registration = relationship("CallerRegistration", back_populates="status_history")

Base.metadata.create_all(bind=engine)

class CallerRegistrationCreate(BaseModel):
    api_path: str = Field(..., description="接口路径")
    caller_system: str = Field(..., description="调用方系统名称")
    last_call_time: Optional[datetime] = None
    contact_person: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    transformation_plan: Optional[str] = None
    planned_completion_date: Optional[date] = None
    raw_input: Optional[str] = None
    
    @validator('api_path')
    def api_path_must_start_with_slash(cls, v):
        if not v.startswith('/'):
            raise ValueError('api_path must start with /')
        return v

class CallerRegistrationUpdate(BaseModel):
    contact_person: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    transformation_plan: Optional[str] = None
    planned_completion_date: Optional[date] = None
    actual_completion_date: Optional[date] = None

class StatusUpdate(BaseModel):
    new_status: RegistrationStatus
    changed_by: str
    change_reason: Optional[str] = None
    delay_reason: Optional[str] = None
    extension_days: Optional[int] = None

class LogEvidenceCreate(BaseModel):
    log_source: str
    log_timestamp: datetime
    log_details: str
    call_count: int = 1

class ManualCorrection(BaseModel):
    corrected_by: str
    correction_notes: str
    updates: Dict[str, Any]

class CallerRegistrationResponse(BaseModel):
    id: int
    api_path: str
    caller_system: str
    last_call_time: Optional[datetime]
    contact_person: Optional[str]
    contact_email: Optional[str]
    contact_phone: Optional[str]
    status: str
    transformation_plan: Optional[str]
    planned_completion_date: Optional[date]
    actual_completion_date: Optional[date]
    delay_reason: Optional[str]
    extension_days: int
    is_manual_correction: bool
    corrected_by: Optional[str]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        orm_mode = True

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

app = FastAPI(title="接口调用方登记API", version="1.0.0")

@app.post("/registrations/", response_model=CallerRegistrationResponse, status_code=201)
def create_registration(registration: CallerRegistrationCreate):
    db = next(get_db())
    existing = db.query(CallerRegistration).filter(
        CallerRegistration.api_path == registration.api_path,
        CallerRegistration.caller_system == registration.caller_system
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"Registration already exists for API '{registration.api_path}' and caller '{registration.caller_system}'"
        )
    
    db_registration = CallerRegistration(
        api_path=registration.api_path,
        caller_system=registration.caller_system,
        last_call_time=registration.last_call_time,
        contact_person=registration.contact_person,
        contact_email=registration.contact_email,
        contact_phone=registration.contact_phone,
        transformation_plan=registration.transformation_plan,
        planned_completion_date=registration.planned_completion_date,
        raw_input=registration.raw_input or json.dumps(registration.dict(), ensure_ascii=False)
    )
    db.add(db_registration)
    db.commit()
    db.refresh(db_registration)
    return db_registration

@app.get("/registrations/", response_model=List[CallerRegistrationResponse])
def list_registrations(
    api_path: Optional[str] = None,
    caller_system: Optional[str] = None,
    status: Optional[RegistrationStatus] = None,
    skip: int = 0,
    limit: int = 100
):
    db = next(get_db())
    query = db.query(CallerRegistration)
    
    if api_path:
        query = query.filter(CallerRegistration.api_path.contains(api_path))
    if caller_system:
        query = query.filter(CallerRegistration.caller_system.contains(caller_system))
    if status:
        query = query.filter(CallerRegistration.status == status)
    
    return query.offset(skip).limit(limit).all()

@app.get("/registrations/{registration_id}", response_model=CallerRegistrationResponse)
def get_registration(registration_id: int):
    db = next(get_db())
    registration = db.query(CallerRegistration).filter(CallerRegistration.id == registration_id).first()
    if not registration:
        raise HTTPException(status_code=404, detail="Registration not found")
    return registration

@app.post("/registrations/{registration_id}/status")
def update_status(registration_id: int, status_update: StatusUpdate):
    db = next(get_db())
    registration = db.query(CallerRegistration).filter(CallerRegistration.id == registration_id).first()
    if not registration:
        raise HTTPException(status_code=404, detail="Registration not found")
    
    previous_status = registration.status
    registration.status = status_update.new_status
    
    if status_update.new_status == RegistrationStatus.DELAYED:
        if status_update.delay_reason:
            registration.delay_reason = status_update.delay_reason
        if status_update.extension_days:
            registration.extension_days += status_update.extension_days
    
    history = StatusHistory(
        registration_id=registration_id,
        previous_status=previous_status,
        new_status=status_update.new_status,
        changed_by=status_update.changed_by,
        change_reason=status_update.change_reason
    )
    db.add(history)
    db.commit()
    db.refresh(registration)
    return {
        "message": "Status updated successfully",
        "registration": {
            "id": registration.id,
            "api_path": registration.api_path,
            "caller_system": registration.caller_system,
            "status": registration.status,
            "extension_days": registration.extension_days,
            "delay_reason": registration.delay_reason
        }
    }

@app.post("/registrations/{registration_id}/log-evidence")
def add_log_evidence(registration_id: int, evidence: LogEvidenceCreate):
    db = next(get_db())
    registration = db.query(CallerRegistration).filter(CallerRegistration.id == registration_id).first()
    if not registration:
        raise HTTPException(status_code=404, detail="Registration not found")
    
    db_evidence = LogEvidence(
        registration_id=registration_id,
        log_source=evidence.log_source,
        log_timestamp=evidence.log_timestamp,
        log_details=evidence.log_details,
        call_count=evidence.call_count
    )
    db.add(db_evidence)
    
    if registration.status == RegistrationStatus.PENDING:
        registration.status = RegistrationStatus.LOG_VERIFIED
        history = StatusHistory(
            registration_id=registration_id,
            previous_status=RegistrationStatus.PENDING,
            new_status=RegistrationStatus.LOG_VERIFIED,
            changed_by="system",
            change_reason="Log evidence added"
        )
        db.add(history)
    
    db.commit()
    return {"message": "Log evidence added successfully"}

@app.post("/registrations/{registration_id}/manual-correction")
def manual_correction(registration_id: int, correction: ManualCorrection):
    db = next(get_db())
    registration = db.query(CallerRegistration).filter(CallerRegistration.id == registration_id).first()
    if not registration:
        raise HTTPException(status_code=404, detail="Registration not found")
    
    original_data = {
        "api_path": registration.api_path,
        "caller_system": registration.caller_system,
        "status": registration.status
    }
    
    allowed_fields = ["api_path", "caller_system", "contact_person", "contact_email", 
                      "contact_phone", "transformation_plan", "planned_completion_date",
                      "actual_completion_date", "status", "delay_reason", "extension_days"]
    
    for field, value in correction.updates.items():
        if field in allowed_fields:
            if field.endswith("_date") and value:
                if isinstance(value, str):
                    value = datetime.fromisoformat(value).date()
            setattr(registration, field, value)
    
    registration.is_manual_correction = True
    registration.corrected_by = correction.corrected_by
    registration.processing_notes = (registration.processing_notes or "") + \
        f"\n[{datetime.utcnow()}] Manual correction by {correction.corrected_by}: {correction.correction_notes}"
    
    history = StatusHistory(
        registration_id=registration_id,
        previous_status=json.dumps(original_data, ensure_ascii=False),
        new_status=json.dumps(correction.updates, ensure_ascii=False),
        changed_by=correction.corrected_by,
        change_reason=f"Manual correction: {correction.correction_notes}"
    )
    db.add(history)
    db.commit()
    db.refresh(registration)
    return {
        "message": "Manual correction applied successfully",
        "registration": {
            "id": registration.id,
            "api_path": registration.api_path,
            "caller_system": registration.caller_system,
            "last_call_time": registration.last_call_time,
            "contact_person": registration.contact_person,
            "contact_email": registration.contact_email,
            "contact_phone": registration.contact_phone,
            "status": registration.status,
            "transformation_plan": registration.transformation_plan,
            "planned_completion_date": registration.planned_completion_date,
            "actual_completion_date": registration.actual_completion_date,
            "delay_reason": registration.delay_reason,
            "extension_days": registration.extension_days,
            "is_manual_correction": registration.is_manual_correction,
            "corrected_by": registration.corrected_by,
            "created_at": registration.created_at,
            "updated_at": registration.updated_at
        }
    }

@app.post("/registrations/{registration_id}/confirm-transformation")
def confirm_transformation(registration_id: int, confirmed_by: str = Body(..., embed=True)):
    db = next(get_db())
    registration = db.query(CallerRegistration).filter(CallerRegistration.id == registration_id).first()
    if not registration:
        raise HTTPException(status_code=404, detail="Registration not found")
    
    previous_status = registration.status
    registration.status = RegistrationStatus.TRANSFORMATION_CONFIRMED
    
    history = StatusHistory(
        registration_id=registration_id,
        previous_status=previous_status,
        new_status=RegistrationStatus.TRANSFORMATION_CONFIRMED,
        changed_by=confirmed_by,
        change_reason="Transformation confirmed"
    )
    db.add(history)
    db.commit()
    return {"message": "Transformation confirmed successfully"}

@app.post("/registrations/{registration_id}/delay-request")
def delay_request(registration_id: int, delay_reason: str = Body(...), extension_days: int = Body(...), requested_by: str = Body(...)):
    db = next(get_db())
    registration = db.query(CallerRegistration).filter(CallerRegistration.id == registration_id).first()
    if not registration:
        raise HTTPException(status_code=404, detail="Registration not found")
    
    previous_status = registration.status
    registration.status = RegistrationStatus.DELAYED
    registration.delay_reason = delay_reason
    registration.extension_days += extension_days
    
    history = StatusHistory(
        registration_id=registration_id,
        previous_status=previous_status,
        new_status=RegistrationStatus.DELAYED,
        changed_by=requested_by,
        change_reason=f"Delay request: {delay_reason}, extension: {extension_days} days"
    )
    db.add(history)
    db.commit()
    return {"message": "Delay request processed successfully"}

# @app.exception_handler(Exception)
# async def global_exception_handler(request, exc):
#     import traceback
#     try:
#         db = next(get_db())
#         error_registration = CallerRegistration(
#             api_path="/exception",
#             caller_system="system",
#             status=RegistrationStatus.EXCEPTION,
#             raw_input=json.dumps({
#                 "method": request.method,
#                 "url": str(request.url),
#                 "error": str(exc),
#                 "type": type(exc).__name__,
#                 "traceback": traceback.format_exc()
#             }, ensure_ascii=False),
#             processing_notes=f"Global exception caught: {str(exc)}"
#         )
#         db.add(error_registration)
#         db.commit()
#     except Exception as e:
#         pass
#     from fastapi.responses import JSONResponse
#     return JSONResponse(
#         status_code=500,
#         content={"detail": str(exc), "type": type(exc).__name__}
#     )

@app.get("/registrations/{registration_id}/history")
def get_registration_history(registration_id: int):
    db = next(get_db())
    history = db.query(StatusHistory).filter(
        StatusHistory.registration_id == registration_id
    ).order_by(StatusHistory.changed_at.desc()).all()
    return history

@app.get("/export/registrations")
def export_registrations(format: str = Query("xlsx", enum=["xlsx", "csv"])):
    db = next(get_db())
    registrations = db.query(CallerRegistration).all()
    
    data = []
    for reg in registrations:
        data.append({
            "ID": reg.id,
            "接口路径": reg.api_path,
            "调用方系统": reg.caller_system,
            "最近调用时间": reg.last_call_time.isoformat() if reg.last_call_time else None,
            "联系人": reg.contact_person,
            "联系邮箱": reg.contact_email,
            "联系电话": reg.contact_phone,
            "状态": reg.status,
            "改造计划": reg.transformation_plan,
            "计划完成日期": reg.planned_completion_date.isoformat() if reg.planned_completion_date else None,
            "实际完成日期": reg.actual_completion_date.isoformat() if reg.actual_completion_date else None,
            "延期原因": reg.delay_reason,
            "延期天数": reg.extension_days,
            "是否人工修正": reg.is_manual_correction,
            "修正人": reg.corrected_by,
            "创建时间": reg.created_at.isoformat(),
            "更新时间": reg.updated_at.isoformat()
        })
    
    df = pd.DataFrame(data)
    
    if format == "xlsx":
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='接口调用登记')
        output.seek(0)
        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=api_registrations.xlsx"}
        )
    else:
        output = io.StringIO()
        df.to_csv(output, index=False)
        output.seek(0)
        return StreamingResponse(
            output,
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=api_registrations.csv"}
        )

@app.get("/export/statistics")
def get_statistics():
    db = next(get_db())
    total = db.query(CallerRegistration).count()
    status_stats = {}
    for status in RegistrationStatus:
        count = db.query(CallerRegistration).filter(CallerRegistration.status == status).count()
        status_stats[status.value] = count
    
    api_stats = db.query(
        CallerRegistration.api_path,
        CallerRegistration.caller_system
    ).distinct().count()
    
    delayed_count = db.query(CallerRegistration).filter(
        CallerRegistration.status == RegistrationStatus.DELAYED
    ).count()
    
    return {
        "total_registrations": total,
        "unique_api_caller_pairs": api_stats,
        "status_distribution": status_stats,
        "delayed_count": delayed_count
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
