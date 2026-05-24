import hashlib
import os
import uuid
from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any
from io import BytesIO

from fastapi import FastAPI, Depends, HTTPException, Query, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Text, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
from sqlalchemy.sql import func
import pandas as pd

UPLOAD_DIR = "uploads"
EXPORT_DIR = "exports"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(EXPORT_DIR, exist_ok=True)

SQLALCHEMY_DATABASE_URL = "sqlite:///./tree_hazards.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class HazardLevel(str, Enum):
    GENERAL = "general"
    SERIOUS = "serious"
    SEVERE = "severe"
    EMERGENCY = "emergency"

class HazardStatus(str, Enum):
    PENDING_REVIEW = "pending_review"
    BLOCKED = "blocked"
    APPROVED = "approved"
    IN_PROGRESS = "in_progress"
    PENDING_RECHECK = "pending_recheck"
    COMPLETED = "completed"
    CLOSED = "closed"

class OperationType(str, Enum):
    REGISTER = "register"
    BLOCK = "block"
    APPROVE = "approve"
    ASSIGN = "assign"
    RECHECK_SUBMIT = "recheck_submit"
    COMPLETE = "complete"
    CLOSE = "close"
    MODIFY = "modify"
    WITHDRAW = "withdraw"
    RESUBMIT = "resubmit"

class HazardDB(Base):
    __tablename__ = "hazards"
    id = Column(Integer, primary_key=True, index=True)
    tree_number = Column(String(50), index=True, nullable=False)
    road_location = Column(String(200), nullable=False)
    location_hash = Column(String(64), index=True)
    photo_path = Column(Text)
    hazard_level = Column(String(20), nullable=False)
    disposal_team = Column(String(100))
    status = Column(String(30), default=HazardStatus.PENDING_REVIEW)
    recheck_conclusion = Column(Text)
    batch_id = Column(String(64), index=True)
    description = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    is_duplicate = Column(Integer, default=0)
    original_hazard_id = Column(Integer, ForeignKey("hazards.id"))
    level_modified_count = Column(Integer, default=0)
    operations = relationship("OperationLogDB", back_populates="hazard")
    original = relationship("HazardDB", remote_side=[id])

class OperationLogDB(Base):
    __tablename__ = "operation_logs"
    id = Column(Integer, primary_key=True, index=True)
    hazard_id = Column(Integer, ForeignKey("hazards.id"))
    operation_type = Column(String(30), nullable=False)
    operator = Column(String(100))
    remark = Column(Text)
    old_status = Column(String(30))
    new_status = Column(String(30))
    old_level = Column(String(20))
    new_level = Column(String(20))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    hazard = relationship("HazardDB", back_populates="operations")

Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def calc_location_hash(tree_no, road_loc):
    return hashlib.md5(f"{tree_no}|{road_loc}".encode()).hexdigest()

def log_operation(db, h_id, op_type, operator=None, remark=None, old_status=None, new_status=None, old_level=None, new_level=None):
    log = OperationLogDB(hazard_id=h_id, operation_type=op_type.value if hasattr(op_type, "value") else op_type, operator=operator, remark=remark, old_status=old_status, new_status=new_status, old_level=old_level, new_level=new_level)
    db.add(log)
    db.commit()

STATUS_TRANSITIONS = {
    HazardStatus.PENDING_REVIEW.value: [HazardStatus.BLOCKED.value, HazardStatus.APPROVED.value, HazardStatus.CLOSED.value],
    HazardStatus.BLOCKED.value: [HazardStatus.PENDING_REVIEW.value, HazardStatus.CLOSED.value],
    HazardStatus.APPROVED.value: [HazardStatus.IN_PROGRESS.value, HazardStatus.PENDING_REVIEW.value, HazardStatus.CLOSED.value],
    HazardStatus.IN_PROGRESS.value: [HazardStatus.PENDING_RECHECK.value, HazardStatus.PENDING_REVIEW.value, HazardStatus.COMPLETED.value, HazardStatus.CLOSED.value],
    HazardStatus.PENDING_RECHECK.value: [HazardStatus.COMPLETED.value, HazardStatus.IN_PROGRESS.value, HazardStatus.CLOSED.value],
    HazardStatus.COMPLETED.value: [HazardStatus.PENDING_REVIEW.value, HazardStatus.CLOSED.value],
    HazardStatus.CLOSED.value: [HazardStatus.PENDING_REVIEW.value],
}

def validate_status_transition(old, new):
    return new in STATUS_TRANSITIONS.get(old, [])

def can_close(hazard):
    if hazard.hazard_level == HazardLevel.EMERGENCY.value:
        if not hazard.recheck_conclusion:
            return False, "封路等级隐患必须有复查结论才能关闭"
    if hazard.status in [HazardStatus.IN_PROGRESS.value, HazardStatus.PENDING_RECHECK.value]:
        if not hazard.recheck_conclusion:
            return False, "处置中或待复查的隐患必须先提交复查结论"
    return True, ""

class HazardBase(BaseModel):
    tree_number: str
    road_location: str
    photo_path: Optional[str] = None
    hazard_level: HazardLevel
    disposal_team: Optional[str] = None
    batch_id: Optional[str] = None
    description: Optional[str] = None

class HazardCreate(HazardBase):
    pass

class HazardUpdate(BaseModel):
    hazard_level: Optional[HazardLevel] = None
    disposal_team: Optional[str] = None
    description: Optional[str] = None
    recheck_conclusion: Optional[str] = None

class HazardResponse(HazardBase):
    id: int
    status: HazardStatus
    recheck_conclusion: Optional[str] = None
    location_hash: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    is_duplicate: int
    original_hazard_id: Optional[int] = None
    level_modified_count: int
    class Config:
        from_attributes = True

class OperationLogResponse(BaseModel):
    id: int
    hazard_id: int
    operation_type: OperationType
    operator: Optional[str] = None
    remark: Optional[str] = None
    old_status: Optional[HazardStatus] = None
    new_status: Optional[HazardStatus] = None
    old_level: Optional[HazardLevel] = None
    new_level: Optional[HazardLevel] = None
    created_at: datetime
    class Config:
        from_attributes = True

class StatusChangeRequest(BaseModel):
    operator: Optional[str] = None
    remark: Optional[str] = None

class RecheckRequest(BaseModel):
    conclusion: str
    operator: Optional[str] = None
    passed: bool = True

app = FastAPI(title="城市树木隐患 API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

@app.get("/")
def root():
    return {"message": "城市树木隐患 API 服务运行中"}

@app.get("/api/health")
def health_check():
    return {"status": "healthy"}

@app.post("/api/hazards/register", response_model=HazardResponse)
def register_hazard(hazard: HazardCreate, db: Session = Depends(get_db), operator: Optional[str] = None):
    loc_hash = calc_location_hash(hazard.tree_number, hazard.road_location)
    existing = db.query(HazardDB).filter(HazardDB.location_hash == loc_hash, HazardDB.is_duplicate == 0).first()
    db_hazard = HazardDB(
        tree_number=hazard.tree_number,
        road_location=hazard.road_location,
        location_hash=loc_hash,
        photo_path=hazard.photo_path,
        hazard_level=hazard.hazard_level.value,
        disposal_team=hazard.disposal_team,
        batch_id=hazard.batch_id,
        description=hazard.description,
        is_duplicate=1 if existing else 0,
        original_hazard_id=existing.id if existing else None,
    )
    db.add(db_hazard)
    db.commit()
    db.refresh(db_hazard)
    log_operation(db, db_hazard.id, OperationType.REGISTER, operator=operator, remark="重复上报" if existing else "新登记", new_status=db_hazard.status, new_level=db_hazard.hazard_level)
    return db_hazard

@app.post("/api/hazards/{hazard_id}/withdraw", response_model=HazardResponse)
def withdraw_hazard(hazard_id: int, req: StatusChangeRequest, db: Session = Depends(get_db)):
    h = db.query(HazardDB).filter(HazardDB.id == hazard_id).first()
    if not h:
        raise HTTPException(404, "Not found")
    if h.status == HazardStatus.CLOSED.value:
        raise HTTPException(400, "已关闭的隐患不能撤回")
    old_status = h.status
    h.status = HazardStatus.PENDING_REVIEW.value
    db.commit()
    db.refresh(h)
    log_operation(db, h.id, OperationType.WITHDRAW, operator=req.operator, remark=req.remark or "撤回申请", old_status=old_status, new_status=h.status)
    return h

@app.post("/api/hazards/{hazard_id}/block", response_model=HazardResponse)
def block_hazard(hazard_id: int, req: StatusChangeRequest, db: Session = Depends(get_db)):
    h = db.query(HazardDB).filter(HazardDB.id == hazard_id).first()
    if not h:
        raise HTTPException(404, "Not found")
    if not validate_status_transition(h.status, HazardStatus.BLOCKED.value):
        raise HTTPException(400, f"状态不允许拦截: {h.status}")
    old = h.status
    h.status = HazardStatus.BLOCKED.value
    db.commit()
    db.refresh(h)
    log_operation(db, h.id, OperationType.BLOCK, operator=req.operator, remark=req.remark, old_status=old, new_status=h.status)
    return h

@app.post("/api/hazards/{hazard_id}/approve", response_model=HazardResponse)
def approve_hazard(hazard_id: int, req: StatusChangeRequest, db: Session = Depends(get_db)):
    h = db.query(HazardDB).filter(HazardDB.id == hazard_id).first()
    if not h:
        raise HTTPException(404, "Not found")
    if not validate_status_transition(h.status, HazardStatus.APPROVED.value):
        raise HTTPException(400, f"状态不允许放行: {h.status}")
    old = h.status
    h.status = HazardStatus.APPROVED.value
    db.commit()
    db.refresh(h)
    log_operation(db, h.id, OperationType.APPROVE, operator=req.operator, remark=req.remark, old_status=old, new_status=h.status)
    return h

@app.post("/api/hazards/{hazard_id}/close", response_model=HazardResponse)
def close_hazard(hazard_id: int, req: StatusChangeRequest, db: Session = Depends(get_db)):
    h = db.query(HazardDB).filter(HazardDB.id == hazard_id).first()
    if not h:
        raise HTTPException(404, "Not found")
    can_close_flag, msg = can_close(h)
    if not can_close_flag:
        raise HTTPException(400, msg)
    if not validate_status_transition(h.status, HazardStatus.CLOSED.value):
        raise HTTPException(400, f"状态不允许关闭: {h.status}")
    old_status = h.status
    h.status = HazardStatus.CLOSED.value
    db.commit()
    db.refresh(h)
    log_operation(db, h.id, OperationType.CLOSE, operator=req.operator, remark=req.remark, old_status=old_status, new_status=h.status)
    return h

@app.post("/api/hazards/{hazard_id}/resubmit", response_model=HazardResponse)
def resubmit_hazard(hazard_id: int, update: Optional[HazardUpdate] = None, operator: Optional[str] = None, db: Session = Depends(get_db)):
    h = db.query(HazardDB).filter(HazardDB.id == hazard_id).first()
    if not h:
        raise HTTPException(404, "Not found")
    if h.status != HazardStatus.PENDING_REVIEW.value:
        raise HTTPException(400, "只有待审核状态的隐患才能重提")
    old_level = h.hazard_level
    level_changed = False
    if update:
        if update.hazard_level and update.hazard_level.value != h.hazard_level:
            h.hazard_level = update.hazard_level.value
            h.level_modified_count += 1
            level_changed = True
        if update.disposal_team is not None:
            h.disposal_team = update.disposal_team
        if update.description is not None:
            h.description = update.description
    old_status = h.status
    db.commit()
    db.refresh(h)
    log_operation(db, h.id, OperationType.RESUBMIT, operator=operator, remark="重新提交" if not level_changed else "重新提交并修改等级", old_status=old_status, new_status=h.status, old_level=old_level if level_changed else None, new_level=h.hazard_level if level_changed else None)
    return h

@app.post("/api/hazards/{hazard_id}/supplement", response_model=HazardResponse)
def supplement_hazard(hazard_id: int, update: HazardUpdate, db: Session = Depends(get_db)):
    h = db.query(HazardDB).filter(HazardDB.id == hazard_id).first()
    if not h:
        raise HTTPException(404, "Not found")
    if h.status not in [HazardStatus.IN_PROGRESS.value, HazardStatus.PENDING_RECHECK.value]:
        raise HTTPException(400, "只有处置中或待复查状态的隐患才能补录")
    old_level = h.hazard_level
    level_changed = False
    if update.hazard_level and update.hazard_level.value != h.hazard_level:
        h.hazard_level = update.hazard_level.value
        h.level_modified_count += 1
        level_changed = True
    if update.disposal_team is not None:
        h.disposal_team = update.disposal_team
    if update.description is not None:
        h.description = update.description
    db.commit()
    db.refresh(h)
    log_operation(db, h.id, OperationType.SUPPLEMENT, operator=update.operator, remark="补录信息" if not level_changed else "补录并修改等级", old_level=old_level if level_changed else None, new_level=h.hazard_level if level_changed else None)
    return h

@app.post("/api/hazards/{hazard_id}/recheck", response_model=HazardResponse)
def recheck_hazard(hazard_id: int, req: RecheckRequest, db: Session = Depends(get_db)):
    h = db.query(HazardDB).filter(HazardDB.id == hazard_id).first()
    if not h:
        raise HTTPException(404, "Not found")
    if h.status != HazardStatus.PENDING_RECHECK.value:
        raise HTTPException(400, "只有待复查状态的隐患才能复查")
    old_status = h.status
    h.recheck_conclusion = req.conclusion
    if req.passed:
        h.status = HazardStatus.COMPLETED.value
    else:
        h.status = HazardStatus.IN_PROGRESS.value
    db.commit()
    db.refresh(h)
    recheck_msg = "通过" if req.passed else "不通过"
    log_operation(db, h.id, OperationType.RECHECK, operator=req.operator, remark="复查" + recheck_msg + ": " + req.conclusion, old_status=old_status, new_status=h.status)
    return h

@app.get("/api/hazards", response_model=list[HazardResponse])
def list_hazards(
    status: Optional[str] = None,
    hazard_level: Optional[str] = None,
    road_location: Optional[str] = None,
    batch_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(HazardDB)
    if status:
        query = query.filter(HazardDB.status == status)
    if hazard_level:
        query = query.filter(HazardDB.hazard_level == hazard_level)
    if road_location:
        query = query.filter(HazardDB.road_location.contains(road_location))
    if batch_id:
        query = query.filter(HazardDB.batch_id == batch_id)
    return query.offset(skip).limit(limit).all()

@app.get("/api/hazards/{hazard_id}", response_model=HazardResponse)
def get_hazard(hazard_id: int, db: Session = Depends(get_db)):
    h = db.query(HazardDB).filter(HazardDB.id == hazard_id).first()
    if not h:
        raise HTTPException(404, "Not found")
    return h

@app.get("/api/hazards/{hazard_id}/logs", response_model=list[OperationLogResponse])
def get_hazard_logs(hazard_id: int, db: Session = Depends(get_db)):
    return db.query(OperationLogDB).filter(OperationLogDB.hazard_id == hazard_id).order_by(OperationLogDB.id.desc()).all()

@app.get("/api/statistics")
def get_statistics(db: Session = Depends(get_db)):
    total = db.query(HazardDB).count()
    by_level = db.query(HazardDB.hazard_level, func.count(HazardDB.id)).group_by(HazardDB.hazard_level).all()
    by_status = db.query(HazardDB.status, func.count(HazardDB.id)).group_by(HazardDB.status).all()
    duplicates = db.query(HazardDB).filter(HazardDB.is_duplicate == 1).count()
    return {
        "total": total,
        "duplicates": duplicates,
        "by_level": {k: v for k, v in by_level},
        "by_status": {k: v for k, v in by_status},
    }

@app.get("/api/export")
def export_hazards(
    status: Optional[str] = None,
    hazard_level: Optional[str] = None,
    road_location: Optional[str] = None,
    batch_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    try:
        import pandas as pd
    except ImportError:
        raise HTTPException(500, "pandas not installed")
    query = db.query(HazardDB)
    if status:
        query = query.filter(HazardDB.status == status)
    if hazard_level:
        query = query.filter(HazardDB.hazard_level == hazard_level)
    if road_location:
        query = query.filter(HazardDB.road_location.contains(road_location))
    if batch_id:
        query = query.filter(HazardDB.batch_id == batch_id)
    hazards = query.all()
    data = []
    for h in hazards:
        data.append({
            "ID": h.id,
            "树木编号": h.tree_number,
            "道路位置": h.road_location,
            "隐患等级": h.hazard_level,
            "处置队伍": h.disposal_team,
            "状态": h.status,
            "复查结论": h.recheck_conclusion or "",
            "是否重复": "是" if h.is_duplicate else "否",
            "创建时间": str(h.created_at) if h.created_at else "",
            "更新时间": str(h.updated_at) if h.updated_at else "",
        })
    df = pd.DataFrame(data)
    output_path = "/tmp/hazards_export.xlsx"
    df.to_excel(output_path, index=False, engine="openpyxl")
    from fastapi.responses import FileResponse
    return FileResponse(output_path, filename="hazards_export.xlsx", media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
