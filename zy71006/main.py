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

def calc_location_hash(tree_number: str, road_location: str) -> str:
    key = f"{tree_number.strip().lower()}:{road_location.strip().lower()}"
    return hashlib.md5(key.encode()).hexdigest()

def log_operation(db: Session, hazard_id: int, op_type: OperationType, operator: str = None, remark: str = None, old_status: str = None, new_status: str = None, old_level: str = None, new_level: str = None):
    log = OperationLogDB(
        hazard_id=hazard_id,
        operation_type=op_type.value,
        operator=operator,
        remark=remark,
        old_status=old_status,
        new_status=new_status,
        old_level=old_level,
        new_level=new_level,
    )
    db.add(log)
    db.commit()

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

@app.get("/api/hazards", response_model=dict)
def list_hazards(
    status: Optional[HazardStatus] = None,
    level: Optional[HazardLevel] = None,
    team: Optional[str] = None,
    batch_id: Optional[str] = None,
    include_duplicates: bool = False,
    skip: int = 0, limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(HazardDB)
    if not include_duplicates:
        query = query.filter(HazardDB.is_duplicate == 0)
    if status:
        query = query.filter(HazardDB.status == status.value)
    if level:
        query = query.filter(HazardDB.hazard_level == level.value)
    if team:
        query = query.filter(HazardDB.disposal_team.contains(team))
    if batch_id:
        query = query.filter(HazardDB.batch_id == batch_id)
    total = query.count()
    items = query.order_by(HazardDB.created_at.desc()).offset(skip).limit(limit).all()
    return {"total": total, "items": [HazardResponse.model_validate(i) for i in items]}

@app.get("/api/hazards/{hazard_id}", response_model=HazardResponse)
def get_hazard(hazard_id: int, db: Session = Depends(get_db)):
    h = db.query(HazardDB).filter(HazardDB.id == hazard_id).first()
    if not h: raise HTTPException(404, "Not found")
    return h

@app.post("/api/hazards/{hazard_id}/block", response_model=HazardResponse)
def block_hazard(hazard_id: int, req: StatusChangeRequest, db: Session = Depends(get_db)):
    h = db.query(HazardDB).filter(HazardDB.id == hazard_id).first()
    if not h: raise HTTPException(404, "Not found")
    old = h.status
    h.status = HazardStatus.BLOCKED.value
    db.commit()
    db.refresh(h)
    log_operation(db, h.id, OperationType.BLOCK, operator=req.operator, remark=req.remark, old_status=old, new_status=h.status)
    return h

@app.post("/api/hazards/{hazard_id}/approve", response_model=HazardResponse)
def approve_hazard(hazard_id: int, req: StatusChangeRequest, db: Session = Depends(get_db)):
    h = db.query(HazardDB).filter(HazardDB.id == hazard_id).first()
    if not h: raise HTTPException(404, "Not found")
    old = h.status
    h.status = HazardStatus.APPROVED.value
    db.commit()
    db.refresh(h)
    log_operation(db, h.id, OperationType.APPROVE, operator=req.operator, remark=req.remark, old_status=old, new_status=h.status)
    return h

@app.post("/api/hazards/{hazard_id}/assign", response_model=HazardResponse)
def assign_hazard(hazard_id: int, team: str, operator: Optional[str] = None, db: Session = Depends(get_db)):
    h = db.query(HazardDB).filter(HazardDB.id == hazard_id).first()
    if not h: raise HTTPException(404, "Not found")
    old_team = h.disposal_team
    h.disposal_team = team
    h.status = HazardStatus.IN_PROGRESS.value
    db.commit()
    db.refresh(h)
    log_operation(db, h.id, OperationType.ASSIGN, operator=operator, remark=f"派单给: {team}", old_status=old_team, new_status=team)
    return h

@app.post("/api/hazards/{hazard_id}/recheck", response_model=HazardResponse)
def submit_recheck(hazard_id: int, req: RecheckRequest, db: Session = Depends(get_db)):
    h = db.query(HazardDB).filter(HazardDB.id == hazard_id).first()
    if not h: raise HTTPException(404, "Not found")
    h.recheck_conclusion = req.conclusion
    old_status = h.status
    if req.passed:
        h.status = HazardStatus.COMPLETED.value
    else:
        h.status = HazardStatus.IN_PROGRESS.value
    db.commit()
    db.refresh(h)
    log_operation(db, h.id, OperationType.RECHECK_SUBMIT, operator=req.operator, remark=req.conclusion, old_status=old_status, new_status=h.status)
    return h

@app.post("/api/hazards/{hazard_id}/close", response_model=HazardResponse)
def close_hazard(hazard_id: int, req: StatusChangeRequest, db: Session = Depends(get_db)):
    h = db.query(HazardDB).filter(HazardDB.id == hazard_id).first()
    if not h: raise HTTPException(404, "Not found")
    old_status = h.status
    h.status = HazardStatus.CLOSED.value
    db.commit()
    db.refresh(h)
    log_operation(db, h.id, OperationType.CLOSE, operator=req.operator, remark=req.remark, old_status=old_status, new_status=h.status)
    return h

@app.get("/api/hazards/{hazard_id}/logs", response_model=list[OperationLogResponse])
def get_hazard_logs(hazard_id: int, db: Session = Depends(get_db)):
    logs = db.query(OperationLogDB).filter(OperationLogDB.hazard_id == hazard_id).order_by(OperationLogDB.created_at.desc()).all()
    return logs

@app.put("/api/hazards/{hazard_id}", response_model=HazardResponse)
def update_hazard(hazard_id: int, update: HazardUpdate, operator: Optional[str] = None, db: Session = Depends(get_db)):
    h = db.query(HazardDB).filter(HazardDB.id == hazard_id).first()
    if not h: raise HTTPException(404, "Not found")
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
    if update.recheck_conclusion is not None:
        h.recheck_conclusion = update.recheck_conclusion
    db.commit()
    db.refresh(h)
    if level_changed:
        log_operation(db, h.id, OperationType.MODIFY, operator=operator, remark="等级变更", old_level=old_level, new_level=h.hazard_level)
    return h

@app.get("/api/statistics")
def get_statistics(db: Session = Depends(get_db)):
    total = db.query(HazardDB).filter(HazardDB.is_duplicate == 0).count()
    by_level = {l.value: db.query(HazardDB).filter(HazardDB.is_duplicate == 0, HazardDB.hazard_level == l.value).count() for l in HazardLevel}
    by_status = {s.value: db.query(HazardDB).filter(HazardDB.is_duplicate == 0, HazardDB.status == s.value).count() for s in HazardStatus}
    teams = db.query(HazardDB.disposal_team).filter(HazardDB.disposal_team != None).distinct().all()
    by_team = {t[0]: db.query(HazardDB).filter(HazardDB.disposal_team == t[0]).count() for t in teams if t[0]}
    pending_recheck = db.query(HazardDB).filter(HazardDB.is_duplicate == 0, HazardDB.status == HazardStatus.PENDING_RECHECK.value).count()
    return {"total": total, "by_level": by_level, "by_status": by_status, "by_team": by_team, "pending_recheck": pending_recheck}

@app.get("/api/exports/excel")
def export_excel(
    status: Optional[HazardStatus] = None,
    level: Optional[HazardLevel] = None,
    team: Optional[str] = None,
    include_duplicates: bool = False,
    db: Session = Depends(get_db)
):
    query = db.query(HazardDB)
    if not include_duplicates:
        query = query.filter(HazardDB.is_duplicate == 0)
    if status:
        query = query.filter(HazardDB.status == status.value)
    if level:
        query = query.filter(HazardDB.hazard_level == level.value)
    if team:
        query = query.filter(HazardDB.disposal_team.contains(team))
    items = query.order_by(HazardDB.created_at.desc()).all()
    data = []
    for h in items:
        data.append({
            "ID": h.id,
            "树木编号": h.tree_number,
            "道路位置": h.road_location,
            "隐患等级": h.hazard_level,
            "状态": h.status,
            "处置队伍": h.disposal_team,
            "复查结论": h.recheck_conclusion,
            "批次ID": h.batch_id,
            "创建时间": h.created_at,
            "是否重复": "是" if h.is_duplicate else "否",
        })
    df = pd.DataFrame(data)
    output = BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="隐患列表")
    output.seek(0)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"tree_hazards_{ts}.xlsx"
    return StreamingResponse(output, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": f"attachment; filename={filename}"})

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
