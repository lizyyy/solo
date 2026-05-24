from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import FileResponse
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Text, ForeignKey, Enum, Float, and_
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship, Session
from datetime import datetime
from pydantic import BaseModel
from typing import Optional, List
from enum import Enum as PyEnum
import os
import uuid
import pandas as pd

SQLALCHEMY_DATABASE_URL = "sqlite:///./tree_hazards.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

UPLOAD_DIR = "app/uploads"
EXPORT_DIR = "app/exports"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(EXPORT_DIR, exist_ok=True)

class HazardLevel(str, PyEnum):
    LOW = "低危"
    MEDIUM = "中危"
    HIGH = "高危"
    EXTREME = "极危"

class DisposalStatus(str, PyEnum):
    PENDING = "待处置"
    BLOCKED = "已拦截"
    APPROVED = "已放行"
    IN_PROGRESS = "处置中"
    CLOSED = "已关闭"
    REJECTED = "已驳回"
    WITHDRAWN = "已撤回"

class DisposalType(str, PyEnum):
    PRUNE = "修剪"
    SUPPORT = "支撑"
    ROAD_CLOSE = "封路"
    REMOVE = "移除"
    OTHER = "其他"

class TreePoint(Base):
    __tablename__ = "tree_points"
    id = Column(Integer, primary_key=True, index=True)
    tree_number = Column(String, unique=True, index=True)
    road_location = Column(String, index=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    tree_type = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    hazards = relationship("HazardRecord", back_populates="tree_point")

class HazardRecord(Base):
    __tablename__ = "hazard_records"
    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String, index=True)
    tree_point_id = Column(Integer, ForeignKey("tree_points.id"))
    hazard_level = Column(Enum(HazardLevel))
    disposal_type = Column(Enum(DisposalType))
    disposal_team = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    photo_path = Column(String, nullable=True)
    status = Column(Enum(DisposalStatus), default=DisposalStatus.PENDING)
    reporter = Column(String, nullable=True)
    report_time = Column(DateTime, default=datetime.utcnow)
    is_duplicate = Column(Integer, default=0)
    duplicate_of = Column(Integer, nullable=True)
    manual_override = Column(Integer, default=0)
    override_reason = Column(Text, nullable=True)
    override_by = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    tree_point = relationship("TreePoint", back_populates="hazards")
    reviews = relationship("ReviewRecord", back_populates="hazard")
    history = relationship("StatusHistory", back_populates="hazard")

class ReviewRecord(Base):
    __tablename__ = "review_records"
    id = Column(Integer, primary_key=True, index=True)
    hazard_id = Column(Integer, ForeignKey("hazard_records.id"))
    reviewer = Column(String)
    review_conclusion = Column(Text)
    review_time = Column(DateTime, default=datetime.utcnow)
    photos = Column(Text, nullable=True)
    is_passed = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    hazard = relationship("HazardRecord", back_populates="reviews")

class StatusHistory(Base):
    __tablename__ = "status_history"
    id = Column(Integer, primary_key=True, index=True)
    hazard_id = Column(Integer, ForeignKey("hazard_records.id"))
    from_status = Column(String)
    to_status = Column(String)
    operator = Column(String, nullable=True)
    reason = Column(Text, nullable=True)
    change_time = Column(DateTime, default=datetime.utcnow)
    hazard = relationship("HazardRecord", back_populates="history")

Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

app = FastAPI(title="城市树木隐患 API", description="园林队行道树隐患管理后端服务", version="1.0.0")

def find_duplicate(db, tree_number, road_location):
    tree = db.query(TreePoint).filter(TreePoint.tree_number == tree_number).first()
    if not tree:
        tree = db.query(TreePoint).filter(TreePoint.road_location == road_location).first()
    if tree:
        existing = db.query(HazardRecord).filter(
            and_(
                HazardRecord.tree_point_id == tree.id,
                HazardRecord.status.notin_([DisposalStatus.CLOSED, DisposalStatus.REJECTED]),
                HazardRecord.is_duplicate == 0
            )
        ).order_by(HazardRecord.created_at.desc()).first()
        return existing
    return None

def add_history(db, hazard_id, from_s, to_s, operator=None, reason=None):
    h = StatusHistory(hazard_id=hazard_id, from_status=from_s, to_status=to_s, operator=operator, reason=reason)
    db.add(h)
    db.commit()

@app.post("/api/hazards/register", summary="登记隐患")
async def register(
    tree_number: str = Form(...),
    road_location: str = Form(...),
    hazard_level: HazardLevel = Form(...),
    disposal_type: DisposalType = Form(...),
    disposal_team: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    reporter: Optional[str] = Form(None),
    batch_id: Optional[str] = Form(None),
    photo: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    duplicate = find_duplicate(db, tree_number, road_location)
    
    tree = db.query(TreePoint).filter(TreePoint.tree_number == tree_number).first()
    if not tree:
        tree = TreePoint(tree_number=tree_number, road_location=road_location)
        db.add(tree)
        db.commit()
        db.refresh(tree)
    
    photo_path = None
    if photo:
        ext = os.path.splitext(photo.filename)[1] if photo.filename else ".jpg"
        fname = f"{uuid.uuid4()}{ext}"
        photo_path = f"{UPLOAD_DIR}/{fname}"
        with open(photo_path, "wb") as f:
            f.write(await photo.read())
    
    hazard = HazardRecord(
        batch_id=batch_id or str(uuid.uuid4())[:8],
        tree_point_id=tree.id,
        hazard_level=hazard_level,
        disposal_type=disposal_type,
        disposal_team=disposal_team,
        description=description,
        photo_path=photo_path,
        reporter=reporter,
        is_duplicate=1 if duplicate else 0,
        duplicate_of=duplicate.id if duplicate else None
    )
    db.add(hazard)
    db.commit()
    db.refresh(hazard)
    add_history(db, hazard.id, None, hazard.status.value, reporter, "初始登记")
    
    return {"id": hazard.id, "batch_id": hazard.batch_id, "tree_number": tree_number, 
            "road_location": road_location, "hazard_level": hazard_level.value,
            "disposal_type": disposal_type.value, "status": hazard.status.value,
            "is_duplicate": hazard.is_duplicate, "duplicate_of": hazard.duplicate_of}

@app.post("/api/hazards/{hazard_id}/block", summary="拦截隐患")
def block(hazard_id: int, operator: Optional[str] = Form(None), reason: Optional[str] = Form("审核拦截"), db: Session = Depends(get_db)):
    h = db.query(HazardRecord).filter(HazardRecord.id == hazard_id).first()
    if not h:
        raise HTTPException(404, "not found")
    old = h.status.value
    h.status = DisposalStatus.BLOCKED
    db.commit()
    add_history(db, hazard_id, old, h.status.value, operator, reason)
    return {"id": hazard_id, "status": h.status.value}

@app.post("/api/hazards/{hazard_id}/approve", summary="放行隐患")
def approve(hazard_id: int, operator: Optional[str] = Form(None), reason: Optional[str] = Form("审核通过"), db: Session = Depends(get_db)):
    h = db.query(HazardRecord).filter(HazardRecord.id == hazard_id).first()
    if not h:
        raise HTTPException(404, "not found")
    old = h.status.value
    h.status = DisposalStatus.APPROVED
    db.commit()
    add_history(db, hazard_id, old, h.status.value, operator, reason)
    return {"id": hazard_id, "status": h.status.value}

@app.post("/api/hazards/{hazard_id}/start", summary="开始处置")
def start(hazard_id: int, operator: Optional[str] = Form(None), reason: Optional[str] = Form("开始处置"), db: Session = Depends(get_db)):
    h = db.query(HazardRecord).filter(HazardRecord.id == hazard_id).first()
    if not h:
        raise HTTPException(404, "not found")
    old = h.status.value
    h.status = DisposalStatus.IN_PROGRESS
    db.commit()
    add_history(db, hazard_id, old, h.status.value, operator, reason)
    return {"id": hazard_id, "status": h.status.value}

@app.post("/api/hazards/{hazard_id}/close", summary="关闭隐患")
def close(hazard_id: int, operator: Optional[str] = Form(None), reason: Optional[str] = Form("处置完成"), db: Session = Depends(get_db)):
    h = db.query(HazardRecord).filter(HazardRecord.id == hazard_id).first()
    if not h:
        raise HTTPException(404, "not found")
    old = h.status.value
    h.status = DisposalStatus.CLOSED
    db.commit()
    add_history(db, hazard_id, old, h.status.value, operator, reason)
    return {"id": hazard_id, "status": h.status.value}

@app.post("/api/hazards/{hazard_id}/withdraw", summary="撤回隐患")
def withdraw(hazard_id: int, operator: Optional[str] = Form(None), reason: Optional[str] = Form("申请撤回"), db: Session = Depends(get_db)):
    h = db.query(HazardRecord).filter(HazardRecord.id == hazard_id).first()
    if not h:
        raise HTTPException(404, "not found")
    old = h.status.value
    h.status = DisposalStatus.WITHDRAWN
    db.commit()
    add_history(db, hazard_id, old, h.status.value, operator, reason)
    return {"id": hazard_id, "status": h.status.value}

@app.post("/api/hazards/{hazard_id}/review", summary="补录复查")
async def review(
    hazard_id: int,
    reviewer: str = Form(...),
    review_conclusion: str = Form(...),
    is_passed: int = Form(0),
    db: Session = Depends(get_db)
):
    r = ReviewRecord(hazard_id=hazard_id, reviewer=reviewer, review_conclusion=review_conclusion, is_passed=is_passed)
    db.add(r)
    db.commit()
    if is_passed:
        h = db.query(HazardRecord).filter(HazardRecord.id == hazard_id).first()
        if h and h.status == DisposalStatus.IN_PROGRESS:
            old = h.status.value
            h.status = DisposalStatus.CLOSED
            db.commit()
            add_history(db, hazard_id, old, h.status.value, reviewer, "复查通过，隐患已消除")
    return {"id": r.id, "reviewer": reviewer, "is_passed": is_passed}

@app.put("/api/hazards/{hazard_id}/override", summary="人工改判")
def override(
    hazard_id: int,
    hazard_level: Optional[HazardLevel] = Form(None),
    disposal_type: Optional[DisposalType] = Form(None),
    override_reason: str = Form(...),
    override_by: str = Form(...),
    db: Session = Depends(get_db)
):
    h = db.query(HazardRecord).filter(HazardRecord.id == hazard_id).first()
    if not h:
        raise HTTPException(404, "not found")
    if hazard_level:
        h.hazard_level = hazard_level
    if disposal_type:
        h.disposal_type = disposal_type
    h.manual_override = 1
    h.override_reason = override_reason
    h.override_by = override_by
    db.commit()
    add_history(db, hazard_id, h.status.value, h.status.value, override_by, f"人工改判: {override_reason}")
    return {"id": hazard_id, "hazard_level": h.hazard_level.value, "disposal_type": h.disposal_type.value}

@app.get("/api/hazards", summary="查询隐患列表")
def list_hazards(
    hazard_level: Optional[HazardLevel] = Query(None),
    status: Optional[DisposalStatus] = Query(None),
    disposal_type: Optional[DisposalType] = Query(None),
    road_location: Optional[str] = Query(None),
    batch_id: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    q = db.query(HazardRecord)
    if hazard_level:
        q = q.filter(HazardRecord.hazard_level == hazard_level)
    if status:
        q = q.filter(HazardRecord.status == status)
    if disposal_type:
        q = q.filter(HazardRecord.disposal_type == disposal_type)
    if road_location:
        q = q.join(TreePoint).filter(TreePoint.road_location.contains(road_location))
    if batch_id:
        q = q.filter(HazardRecord.batch_id == batch_id)
    result = []
    for h in q.order_by(HazardRecord.created_at.desc()).all():
        result.append({
            "id": h.id, "batch_id": h.batch_id,
            "tree_number": h.tree_point.tree_number,
            "road_location": h.tree_point.road_location,
            "hazard_level": h.hazard_level.value,
            "disposal_type": h.disposal_type.value,
            "disposal_team": h.disposal_team,
            "status": h.status.value,
            "is_duplicate": h.is_duplicate,
            "duplicate_of": h.duplicate_of,
            "manual_override": h.manual_override,
            "reporter": h.reporter,
            "report_time": h.report_time.isoformat() if h.report_time else None
        })
    return result

@app.get("/api/hazards/{hazard_id}", summary="获取隐患详情")
def get_hazard(hazard_id: int, db: Session = Depends(get_db)):
    h = db.query(HazardRecord).filter(HazardRecord.id == hazard_id).first()
    if not h:
        raise HTTPException(404, "not found")
    history = [{"from": hs.from_status, "to": hs.to_status, "operator": hs.operator, "reason": hs.reason, "time": hs.change_time.isoformat()} for hs in h.history]
    reviews = [{"reviewer": r.reviewer, "conclusion": r.review_conclusion, "is_passed": r.is_passed, "time": r.review_time.isoformat()} for r in h.reviews]
    return {
        "id": h.id, "batch_id": h.batch_id,
        "tree_number": h.tree_point.tree_number,
        "road_location": h.tree_point.road_location,
        "hazard_level": h.hazard_level.value,
        "disposal_type": h.disposal_type.value,
        "status": h.status.value,
        "description": h.description,
        "history": history,
        "reviews": reviews
    }

@app.get("/api/statistics", summary="获取统计数据")
def stats(db: Session = Depends(get_db)):
    total = db.query(HazardRecord).count()
    by_level = {l.value: db.query(HazardRecord).filter(HazardRecord.hazard_level == l).count() for l in HazardLevel}
    by_status = {s.value: db.query(HazardRecord).filter(HazardRecord.status == s).count() for s in DisposalStatus}
    by_type = {t.value: db.query(HazardRecord).filter(HazardRecord.disposal_type == t).count() for t in DisposalType}
    pending = db.query(HazardRecord).filter(and_(HazardRecord.disposal_type == DisposalType.ROAD_CLOSE, HazardRecord.status == DisposalStatus.IN_PROGRESS)).count()
    dup = db.query(HazardRecord).filter(HazardRecord.is_duplicate == 1).count()
    return {"total_records": total, "by_level": by_level, "by_status": by_status, "by_disposal_type": by_type, "pending_review": pending, "duplicates_found": dup}

@app.get("/api/export/excel", summary="导出Excel报告")
def export_excel(
    hazard_level: Optional[HazardLevel] = Query(None),
    status: Optional[DisposalStatus] = Query(None),
    disposal_type: Optional[DisposalType] = Query(None),
    road_location: Optional[str] = Query(None),
    batch_id: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    q = db.query(HazardRecord)
    if hazard_level:
        q = q.filter(HazardRecord.hazard_level == hazard_level)
    if status:
        q = q.filter(HazardRecord.status == status)
    if disposal_type:
        q = q.filter(HazardRecord.disposal_type == disposal_type)
    if road_location:
        q = q.join(TreePoint).filter(TreePoint.road_location.contains(road_location))
    if batch_id:
        q = q.filter(HazardRecord.batch_id == batch_id)
    
    data = []
    for h in q.all():
        data.append({
            "ID": h.id, "批次号": h.batch_id, "树木编号": h.tree_point.tree_number,
            "位置": h.tree_point.road_location, "隐患等级": h.hazard_level.value,
            "处置类型": h.disposal_type.value, "状态": h.status.value, "上报人": h.reporter or "",
            "上报时间": h.report_time.strftime("%Y-%m-%d %H:%M:%S") if h.report_time else "",
            "是否重复": "是" if h.is_duplicate else "否"
        })
    
    df = pd.DataFrame(data)
    path = f"{EXPORT_DIR}/tree_hazards_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    df.to_excel(path, index=False, engine="openpyxl")
    return FileResponse(path, filename=os.path.basename(path))

@app.get("/api/hazards/{hazard_id}/history", summary="获取状态历史")
def get_history(hazard_id: int, db: Session = Depends(get_db)):
    hs = db.query(StatusHistory).filter(StatusHistory.hazard_id == hazard_id).order_by(StatusHistory.change_time.desc()).all()
    return [{"id": h.id, "from": h.from_status, "to": h.to_status, "operator": h.operator, "reason": h.reason, "time": h.change_time.isoformat()} for h in hs]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
