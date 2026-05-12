from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional, List
from geopy.distance import geodesic
import enum

SQLALCHEMY_DATABASE_URL = "sqlite:///./street_light.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class ReportStatus(str, enum.Enum):
    SUBMITTED = "submitted"
    MERGED = "merged"
    DISPATCHED = "dispatched"
    IN_PROGRESS = "in_progress"
    CANCELLED = "cancelled"
    SPARE_SHORTAGE = "spare_shortage"
    CONSTRUCTION_FAILED = "construction_failed"
    PENDING_REDISPATCH = "pending_redispatch"
    CLOSED = "closed"

class LampPole(Base):
    __tablename__ = "lamp_poles"
    id = Column(Integer, primary_key=True, index=True)
    pole_code = Column(String, unique=True, index=True)
    latitude = Column(Float)
    longitude = Column(Float)
    address = Column(String)
    status = Column(String, default="normal")
    created_at = Column(DateTime, default=datetime.utcnow)
    reports = relationship("Report", back_populates="lamp_pole")

class Report(Base):
    __tablename__ = "reports"
    id = Column(Integer, primary_key=True, index=True)
    report_no = Column(String, unique=True, index=True)
    lamp_pole_id = Column(Integer, ForeignKey("lamp_poles.id"))
    source = Column(String)
    description = Column(Text)
    reporter_name = Column(String)
    reporter_phone = Column(String)
    status = Column(String, default=ReportStatus.SUBMITTED)
    latitude = Column(Float)
    longitude = Column(Float)
    merged_into = Column(Integer, ForeignKey("reports.id"), nullable=True)
    merged_reports = relationship("Report", remote_side=[id])
    cancel_reason = Column(Text, nullable=True)
    close_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    lamp_pole = relationship("LampPole", back_populates="reports")
    dispatches = relationship("Dispatch", back_populates="report")
    construction_feedbacks = relationship("ConstructionFeedback", back_populates="report")

class Dispatch(Base):
    __tablename__ = "dispatches"
    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(Integer, ForeignKey("reports.id"))
    worker_name = Column(String)
    worker_phone = Column(String)
    team = Column(String)
    scheduled_time = Column(DateTime)
    remarks = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    report = relationship("Report", back_populates="dispatches")
    spare_usages = relationship("SpareUsage", back_populates="dispatch")

class SparePart(Base):
    __tablename__ = "spare_parts"
    id = Column(Integer, primary_key=True, index=True)
    part_code = Column(String, unique=True, index=True)
    name = Column(String)
    quantity = Column(Integer, default=0)
    unit = Column(String)
    threshold = Column(Integer, default=5)

class SpareUsage(Base):
    __tablename__ = "spare_usages"
    id = Column(Integer, primary_key=True, index=True)
    dispatch_id = Column(Integer, ForeignKey("dispatches.id"))
    spare_part_id = Column(Integer, ForeignKey("spare_parts.id"))
    quantity = Column(Integer)
    dispatch = relationship("Dispatch", back_populates="spare_usages")

class ConstructionFeedback(Base):
    __tablename__ = "construction_feedbacks"
    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(Integer, ForeignKey("reports.id"))
    result = Column(String)
    description = Column(Text)
    photos = Column(Text, nullable=True)
    worker_signature = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    report = relationship("Report", back_populates="construction_feedbacks")

Base.metadata.create_all(bind=engine)

app = FastAPI(title="城市照明报修API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class LampPoleCreate(BaseModel):
    pole_code: str
    latitude: float
    longitude: float
    address: str

class LampPoleResponse(BaseModel):
    id: int
    pole_code: str
    latitude: float
    longitude: float
    address: str
    status: str
    created_at: datetime
    class Config:
        from_attributes = True

class ReportCreate(BaseModel):
    pole_code: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    source: str
    description: str
    reporter_name: str
    reporter_phone: str

class MergeCandidate(BaseModel):
    report_id: int
    report_no: str
    source: str
    status: str
    distance_meters: float
    created_at: datetime
    description: str

class ReportResponse(BaseModel):
    id: int
    report_no: str
    lamp_pole_id: Optional[int]
    source: str
    description: str
    status: str
    latitude: Optional[float]
    longitude: Optional[float]
    merged_into: Optional[int]
    cancel_reason: Optional[str]
    close_reason: Optional[str]
    created_at: datetime
    updated_at: datetime
    merge_candidates: Optional[List[MergeCandidate]] = None
    not_closed_reason: Optional[str] = None
    class Config:
        from_attributes = True

class DispatchCreate(BaseModel):
    report_id: int
    worker_name: str
    worker_phone: str
    team: str
    scheduled_time: datetime
    remarks: Optional[str] = None

class SparePartCreate(BaseModel):
    part_code: str
    name: str
    quantity: int
    unit: str
    threshold: int = 5

class SparePartResponse(BaseModel):
    id: int
    part_code: str
    name: str
    quantity: int
    unit: str
    threshold: int
    class Config:
        from_attributes = True

class SpareUsageCreate(BaseModel):
    spare_part_id: int
    quantity: int

class ConstructionFeedbackCreate(BaseModel):
    report_id: int
    result: str
    description: str
    worker_signature: str
    spare_usages: Optional[List[SpareUsageCreate]] = None

def generate_report_no(db: Session) -> str:
    last_report = db.query(Report).order_by(Report.id.desc()).first()
    next_id = (last_report.id + 1) if last_report else 1
    return f"RPT{datetime.now().strftime('%Y%m%d')}{next_id:06d}"

def find_nearby_pole(db: Session, lat: float, lon: float, threshold_meters: int = 50) -> Optional[LampPole]:
    poles = db.query(LampPole).all()
    nearest_pole = None
    min_distance = float('inf')
    for pole in poles:
        distance = geodesic((lat, lon), (pole.latitude, pole.longitude)).meters
        if distance <= threshold_meters and distance < min_distance:
            min_distance = distance
            nearest_pole = pole
    return nearest_pole

def find_duplicate_reports(db: Session, lamp_pole_id: int, new_report_id: int) -> List[Report]:
    active_reports = db.query(Report).filter(
        Report.lamp_pole_id == lamp_pole_id,
        Report.id != new_report_id,
        Report.status.notin_([ReportStatus.CLOSED, ReportStatus.CANCELLED, ReportStatus.MERGED])
    ).all()
    return active_reports

def get_not_closed_reason(db: Session, report: Report) -> Optional[str]:
    if report.status == ReportStatus.CLOSED:
        return None
    if report.status == ReportStatus.MERGED:
        main_report = db.query(Report).filter(Report.id == report.merged_into).first()
        if main_report:
            return f"已合并到工单 {main_report.report_no}，主单状态: {main_report.status}"
        return "已合并到其他工单"
    if report.status == ReportStatus.SPARE_SHORTAGE:
        return "备件不足，等待补货"
    if report.status == ReportStatus.CONSTRUCTION_FAILED:
        return "施工失败，待重新派工"
    if report.status == ReportStatus.PENDING_REDISPATCH:
        return "待重新派工"
    if report.status == ReportStatus.DISPATCHED:
        return "已派工，待施工"
    if report.status == ReportStatus.IN_PROGRESS:
        return "施工中"
    if report.status == ReportStatus.SUBMITTED:
        return "已提交，待处理"
    return "处理中"

@app.post("/api/lamp-poles/", response_model=LampPoleResponse)
def create_lamp_pole(pole: LampPoleCreate, db: Session = Depends(get_db)):
    db_pole = db.query(LampPole).filter(LampPole.pole_code == pole.pole_code).first()
    if db_pole:
        raise HTTPException(status_code=400, detail="灯杆编号已存在")
    db_pole = LampPole(**pole.model_dump())
    db.add(db_pole)
    db.commit()
    db.refresh(db_pole)
    return db_pole

@app.get("/api/lamp-poles/", response_model=List[LampPoleResponse])
def list_lamp_poles(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(LampPole).offset(skip).limit(limit).all()

@app.get("/api/lamp-poles/{pole_id}", response_model=LampPoleResponse)
def get_lamp_pole(pole_id: int, db: Session = Depends(get_db)):
    pole = db.query(LampPole).filter(LampPole.id == pole_id).first()
    if not pole:
        raise HTTPException(status_code=404, detail="灯杆不存在")
    return pole

@app.post("/api/reports/", response_model=ReportResponse)
def create_report(report: ReportCreate, db: Session = Depends(get_db)):
    lamp_pole = None
    if report.pole_code:
        lamp_pole = db.query(LampPole).filter(LampPole.pole_code == report.pole_code).first()
    elif report.latitude and report.longitude:
        lamp_pole = find_nearby_pole(db, report.latitude, report.longitude)
    if not lamp_pole and not (report.latitude and report.longitude):
        raise HTTPException(status_code=400, detail="必须提供灯杆编号或经纬度")
    db_report = Report(
        report_no=generate_report_no(db),
        lamp_pole_id=lamp_pole.id if lamp_pole else None,
        source=report.source,
        description=report.description,
        reporter_name=report.reporter_name,
        reporter_phone=report.reporter_phone,
        latitude=report.latitude if report.latitude else (lamp_pole.latitude if lamp_pole else None),
        longitude=report.longitude if report.longitude else (lamp_pole.longitude if lamp_pole else None)
    )
    db.add(db_report)
    db.commit()
    db.refresh(db_report)
    merge_candidates = []
    if lamp_pole:
        duplicates = find_duplicate_reports(db, lamp_pole.id, db_report.id)
        for dup in duplicates:
            distance = geodesic(
                (db_report.latitude, db_report.longitude),
                (dup.latitude, dup.longitude)
            ).meters if (db_report.latitude and dup.latitude) else 0
            merge_candidates.append(MergeCandidate(
                report_id=dup.id,
                report_no=dup.report_no,
                source=dup.source,
                status=dup.status,
                distance_meters=round(distance, 2),
                created_at=dup.created_at,
                description=dup.description
            ))
    if merge_candidates:
        main_report = merge_candidates[0]
        main_report_obj = db.query(Report).filter(Report.id == main_report.report_id).first()
        if main_report_obj:
            db_report.status = ReportStatus.MERGED
            db_report.merged_into = main_report_obj.id
            db.commit()
            db.refresh(db_report)
    response = ReportResponse.model_validate(db_report)
    response.merge_candidates = merge_candidates
    response.not_closed_reason = get_not_closed_reason(db, db_report)
    return response

@app.get("/api/reports/", response_model=List[ReportResponse])
def list_reports(
    status: Optional[str] = None,
    pole_code: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(Report)
    if status:
        query = query.filter(Report.status == status)
    if pole_code:
        pole = db.query(LampPole).filter(LampPole.pole_code == pole_code).first()
        if pole:
            query = query.filter(Report.lamp_pole_id == pole.id)
    reports = query.offset(skip).limit(limit).all()
    result = []
    for r in reports:
        resp = ReportResponse.model_validate(r)
        resp.not_closed_reason = get_not_closed_reason(db, r)
        result.append(resp)
    return result

@app.get("/api/reports/{report_id}", response_model=ReportResponse)
def get_report(report_id: int, db: Session = Depends(get_db)):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="报修单不存在")
    response = ReportResponse.model_validate(report)
    response.not_closed_reason = get_not_closed_reason(db, report)
    return response

@app.post("/api/reports/{report_id}/cancel")
def cancel_report(report_id: int, reason: str = Query(...), db: Session = Depends(get_db)):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="报修单不存在")
    if report.status in [ReportStatus.CLOSED, ReportStatus.CANCELLED, ReportStatus.MERGED]:
        raise HTTPException(status_code=400, detail=f"当前状态 {report.status} 无法撤销")
    report.status = ReportStatus.CANCELLED
    report.cancel_reason = reason
    db.commit()
    return {"message": "撤销成功", "report_no": report.report_no, "status": report.status}

@app.get("/api/reports/{report_id}/history")
def get_report_history(report_id: int, db: Session = Depends(get_db)):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="报修单不存在")
    history = []
    history.append({
        "action": "创建",
        "timestamp": report.created_at,
        "status": report.status,
        "description": f"从 {report.source} 提交报修"
    })
    if report.merged_into:
        main_report = db.query(Report).filter(Report.id == report.merged_into).first()
        history.append({
            "action": "合并",
            "timestamp": report.updated_at,
            "status": ReportStatus.MERGED,
            "description": f"合并到工单 {main_report.report_no if main_report else report.merged_into}"
        })
    if report.cancel_reason:
        history.append({
            "action": "撤销",
            "timestamp": report.updated_at,
            "status": ReportStatus.CANCELLED,
            "description": f"撤销原因: {report.cancel_reason}"
        })
    for dispatch in report.dispatches:
        history.append({
            "action": "派工",
            "timestamp": dispatch.created_at,
            "status": ReportStatus.DISPATCHED,
            "description": f"派给 {dispatch.worker_name} ({dispatch.team})，预定时间: {dispatch.scheduled_time}"
        })
    for feedback in report.construction_feedbacks:
        history.append({
            "action": "施工反馈",
            "timestamp": feedback.created_at,
            "status": feedback.result,
            "description": feedback.description
        })
    if report.close_reason:
        history.append({
            "action": "关闭",
            "timestamp": report.updated_at,
            "status": ReportStatus.CLOSED,
            "description": report.close_reason
        })
    history.sort(key=lambda x: x["timestamp"])
    return {"report_no": report.report_no, "history": history}

@app.post("/api/dispatches/")
def create_dispatch(dispatch: DispatchCreate, db: Session = Depends(get_db)):
    report = db.query(Report).filter(Report.id == dispatch.report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="报修单不存在")
    if report.status in [ReportStatus.CLOSED, ReportStatus.CANCELLED, ReportStatus.MERGED]:
        raise HTTPException(status_code=400, detail=f"当前状态 {report.status} 无法派工")
    db_dispatch = Dispatch(**dispatch.model_dump())
    db.add(db_dispatch)
    report.status = ReportStatus.DISPATCHED
    db.commit()
    db.refresh(db_dispatch)
    return {"message": "派工成功", "dispatch_id": db_dispatch.id, "report_status": report.status}

@app.post("/api/spare-parts/", response_model=SparePartResponse)
def create_spare_part(part: SparePartCreate, db: Session = Depends(get_db)):
    existing = db.query(SparePart).filter(SparePart.part_code == part.part_code).first()
    if existing:
        raise HTTPException(status_code=400, detail="备件编号已存在")
    db_part = SparePart(**part.model_dump())
    db.add(db_part)
    db.commit()
    db.refresh(db_part)
    return db_part

@app.get("/api/spare-parts/", response_model=List[SparePartResponse])
def list_spare_parts(db: Session = Depends(get_db)):
    return db.query(SparePart).all()

@app.post("/api/construction-feedback/")
def submit_construction_feedback(feedback: ConstructionFeedbackCreate, db: Session = Depends(get_db)):
    report = db.query(Report).filter(Report.id == feedback.report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="报修单不存在")
    if report.status not in [ReportStatus.DISPATCHED, ReportStatus.IN_PROGRESS, ReportStatus.PENDING_REDISPATCH]:
        raise HTTPException(status_code=400, detail=f"当前状态 {report.status} 无法提交反馈")
    db_feedback = ConstructionFeedback(
        report_id=feedback.report_id,
        result=feedback.result,
        description=feedback.description,
        worker_signature=feedback.worker_signature
    )
    db.add(db_feedback)
    if feedback.spare_usages:
        dispatch = db.query(Dispatch).filter(Dispatch.report_id == report.id).order_by(Dispatch.id.desc()).first()
        if not dispatch:
            raise HTTPException(status_code=400, detail="未找到派工记录")
        for usage in feedback.spare_usages:
            part = db.query(SparePart).filter(SparePart.id == usage.spare_part_id).first()
            if not part:
                raise HTTPException(status_code=404, detail=f"备件 {usage.spare_part_id} 不存在")
            if part.quantity < usage.quantity:
                report.status = ReportStatus.SPARE_SHORTAGE
                db.commit()
                raise HTTPException(status_code=400, detail=f"备件 {part.name} 不足，库存: {part.quantity}, 需要: {usage.quantity}")
            part.quantity -= usage.quantity
            db.add(SpareUsage(dispatch_id=dispatch.id, spare_part_id=usage.spare_part_id, quantity=usage.quantity))
    if feedback.result == "success":
        report.status = ReportStatus.CLOSED
        report.close_reason = "施工完成，问题解决"
    elif feedback.result == "failed":
        report.status = ReportStatus.PENDING_REDISPATCH
    else:
        report.status = ReportStatus.IN_PROGRESS
    db.commit()
    return {"message": "反馈提交成功", "report_status": report.status}

@app.post("/api/reports/{report_id}/redispatch")
def redispatch_report(report_id: int, reason: str = Query(...), db: Session = Depends(get_db)):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="报修单不存在")
    if report.status not in [ReportStatus.SPARE_SHORTAGE, ReportStatus.PENDING_REDISPATCH, ReportStatus.CONSTRUCTION_FAILED]:
        raise HTTPException(status_code=400, detail=f"当前状态 {report.status} 无需重新派工")
    report.status = ReportStatus.SUBMITTED
    db.commit()
    return {"message": "已重置为待派工状态", "report_no": report.report_no, "status": report.status}

@app.post("/api/reports/{report_id}/confirm-close")
def confirm_close_report(report_id: int, confirm: bool = Query(...), reason: Optional[str] = None, db: Session = Depends(get_db)):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="报修单不存在")
    if confirm:
        report.status = ReportStatus.CLOSED
        report.close_reason = reason or "管理员确认关闭"
    else:
        report.status = ReportStatus.PENDING_REDISPATCH
        report.close_reason = None
    db.commit()
    return {"message": "操作成功", "report_no": report.report_no, "status": report.status}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
