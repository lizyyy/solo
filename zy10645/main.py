from datetime import datetime
from enum import Enum
from typing import List, Optional
import csv
import io
from fastapi import FastAPI, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Text, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship

SQLALCHEMY_DATABASE_URL = "sqlite:///./complaints.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class ComplaintStatus(str, Enum):
    PENDING = "待处理"
    ESCALATING = "升级中"
    JUDGED = "已判责"
    CLOSED = "已关闭"

class ComplaintType(str, Enum):
    DRIVER_ATTITUDE = "司机态度"
    ROUTE_ISSUE = "路线问题"
    BILLING_ISSUE = "计费问题"
    SAFETY_ISSUE = "安全问题"
    CLEANLINESS = "车辆卫生"
    OTHER = "其他"

class Trip(Base):
    __tablename__ = "trips"
    id = Column(Integer, primary_key=True, index=True)
    trip_no = Column(String, unique=True, index=True)
    passenger_name = Column(String)
    passenger_phone = Column(String)
    driver_name = Column(String)
    driver_phone = Column(String)
    car_plate = Column(String)
    start_location = Column(String)
    end_location = Column(String)
    start_time = Column(DateTime)
    end_time = Column(DateTime)
    amount = Column(String)
    distance = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

class Complaint(Base):
    __tablename__ = "complaints"
    id = Column(Integer, primary_key=True, index=True)
    complaint_no = Column(String, unique=True, index=True)
    trip_id = Column(Integer, ForeignKey("trips.id"))
    complaint_type = Column(String)
    passenger_description = Column(Text)
    driver_feedback = Column(Text, nullable=True)
    cs_conclusion = Column(Text, nullable=True)
    status = Column(String, default=ComplaintStatus.PENDING)
    version = Column(Integer, default=1)
    has_new_evidence = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    trip = relationship("Trip", back_populates="complaints")
    evidences = relationship("Evidence", back_populates="complaint")
    histories = relationship("ComplaintHistory", back_populates="complaint")

Trip.complaints = relationship("Complaint", back_populates="trip")

class Evidence(Base):
    __tablename__ = "evidences"
    id = Column(Integer, primary_key=True, index=True)
    complaint_id = Column(Integer, ForeignKey("complaints.id"))
    evidence_type = Column(String)
    content = Column(Text)
    uploader = Column(String)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    complaint = relationship("Complaint", back_populates="evidences")

class ComplaintHistory(Base):
    __tablename__ = "complaint_histories"
    id = Column(Integer, primary_key=True, index=True)
    complaint_id = Column(Integer, ForeignKey("complaints.id"))
    action = Column(String)
    old_status = Column(String, nullable=True)
    new_status = Column(String)
    operator = Column(String)
    remark = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    complaint = relationship("Complaint", back_populates="histories")

Base.metadata.create_all(bind=engine)

class TripCreate(BaseModel):
    trip_no: str
    passenger_name: str
    passenger_phone: str
    driver_name: str
    driver_phone: str
    car_plate: str
    start_location: str
    end_location: str
    start_time: datetime
    end_time: datetime
    amount: str
    distance: str

class ComplaintCreate(BaseModel):
    trip_no: str
    complaint_type: ComplaintType
    passenger_description: str

class ComplaintUpdate(BaseModel):
    driver_feedback: Optional[str] = None
    cs_conclusion: Optional[str] = None
    status: Optional[ComplaintStatus] = None
    operator: str
    version: int

class EvidenceCreate(BaseModel):
    evidence_type: str
    content: str
    uploader: str

class ComplaintResponse(BaseModel):
    id: int
    complaint_no: str
    trip_id: int
    complaint_type: str
    passenger_description: str
    driver_feedback: Optional[str]
    cs_conclusion: Optional[str]
    status: str
    version: int
    has_new_evidence: int
    created_at: datetime
    updated_at: datetime
    trip: dict

    class Config:
        orm_mode = True

app = FastAPI(title="网约车运营后台乘客投诉升级 API")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def generate_complaint_no():
    now = datetime.now()
    return f"TS{now.strftime('%Y%m%d%H%M%S')}"

def create_history(db: Session, complaint_id: int, action: str, old_status: Optional[str], new_status: str, operator: str, remark: str = None):
    history = ComplaintHistory(
        complaint_id=complaint_id,
        action=action,
        old_status=old_status,
        new_status=new_status,
        operator=operator,
        remark=remark
    )
    db.add(history)
    db.commit()

@app.post("/api/complaints/", response_model=ComplaintResponse)
def create_complaint(complaint: ComplaintCreate, db: Session = Depends(get_db)):
    trip = db.query(Trip).filter(Trip.trip_no == complaint.trip_no).first()
    if not trip:
        raise HTTPException(status_code=404, detail="行程不存在")
    db_complaint = Complaint(
        complaint_no=generate_complaint_no(),
        trip_id=trip.id,
        complaint_type=complaint.complaint_type,
        passenger_description=complaint.passenger_description,
        status=ComplaintStatus.PENDING,
        version=1
    )
    db.add(db_complaint)
    db.commit()
    db.refresh(db_complaint)
    create_history(db, db_complaint.id, "创建投诉", None, ComplaintStatus.PENDING, "系统")
    trip_dict = {c.name: getattr(trip, c.name) for c in trip.__table__.columns}
    return {**{c.name: getattr(db_complaint, c.name) for c in db_complaint.__table__.columns}, "trip": trip_dict}

@app.get("/api/complaints/")
def list_complaints(status: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Complaint).join(Trip)
    if status:
        query = query.filter(Complaint.status == status)
    complaints = query.all()
    result = []
    for c in complaints:
        trip_dict = {col.name: getattr(c.trip, col.name) for col in c.trip.__table__.columns}
        result.append({**{col.name: getattr(c, col.name) for col in c.__table__.columns}, "trip": trip_dict})
    return result

@app.get("/api/complaints/{complaint_id}")
def get_complaint(complaint_id: int, db: Session = Depends(get_db)):
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="投诉不存在")
    trip_dict = {col.name: getattr(complaint.trip, col.name) for col in complaint.trip.__table__.columns}
    evidences = [{"id": e.id, "evidence_type": e.evidence_type, "content": e.content, "uploader": e.uploader, "uploaded_at": e.uploaded_at} for e in complaint.evidences]
    histories = [{"id": h.id, "action": h.action, "old_status": h.old_status, "new_status": h.new_status, "operator": h.operator, "remark": h.remark, "created_at": h.created_at} for h in complaint.histories]
    return {**{col.name: getattr(complaint, col.name) for col in complaint.__table__.columns}, "trip": trip_dict, "evidences": evidences, "histories": histories}

@app.put("/api/complaints/{complaint_id}")
def update_complaint(complaint_id: int, update: ComplaintUpdate, db: Session = Depends(get_db)):
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="投诉不存在")
    if complaint.version != update.version:
        raise HTTPException(status_code=409, detail=f"版本冲突：当前版本是 {complaint.version}，您提交的是 {update.version}。请刷新后重试。")
    old_status = complaint.status
    if update.driver_feedback is not None:
        complaint.driver_feedback = update.driver_feedback
    if update.cs_conclusion is not None:
        complaint.cs_conclusion = update.cs_conclusion
    if update.status and update.status != old_status:
        complaint.status = update.status
        complaint.has_new_evidence = 0
    complaint.version += 1
    db.commit()
    db.refresh(complaint)
    create_history(db, complaint.id, "更新投诉", old_status, complaint.status, update.operator, update.cs_conclusion)
    trip_dict = {col.name: getattr(complaint.trip, col.name) for col in complaint.trip.__table__.columns}
    return {**{col.name: getattr(complaint, col.name) for col in complaint.__table__.columns}, "trip": trip_dict}

@app.post("/api/complaints/{complaint_id}/evidences/")
def add_evidence(complaint_id: int, evidence: EvidenceCreate, db: Session = Depends(get_db)):
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="投诉不存在")
    db_evidence = Evidence(
        complaint_id=complaint_id,
        evidence_type=evidence.evidence_type,
        content=evidence.content,
        uploader=evidence.uploader
    )
    db.add(db_evidence)
    complaint.has_new_evidence = 1
    db.commit()
    db.refresh(db_evidence)
    create_history(db, complaint_id, "追加证据", complaint.status, complaint.status, evidence.uploader, evidence.content)
    return db_evidence

@app.get("/api/complaints/{complaint_id}/histories")
def get_histories(complaint_id: int, db: Session = Depends(get_db)):
    histories = db.query(ComplaintHistory).filter(ComplaintHistory.complaint_id == complaint_id).order_by(ComplaintHistory.created_at.desc()).all()
    return histories

@app.get("/api/complaints/export/csv")
def export_complaints(status: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Complaint).join(Trip)
    if status:
        query = query.filter(Complaint.status == status)
    complaints = query.all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["投诉单号", "行程单号", "乘客姓名", "司机姓名", "车牌号", "投诉类型", "状态", "乘客描述", "司机反馈", "客服结论", "创建时间", "更新时间"])
    for c in complaints:
        writer.writerow([
            c.complaint_no, c.trip.trip_no, c.trip.passenger_name, c.trip.driver_name, c.trip.car_plate, c.complaint_type, c.status, c.passenger_description, c.driver_feedback or "", c.cs_conclusion or "", c.created_at.strftime("%Y-%m-%d %H:%M:%S"), c.updated_at.strftime("%Y-%m-%d %H:%M:%S")
        ])
    output.seek(0)
    return StreamingResponse(output, media_type="text/csv; charset=utf-8", headers={"Content-Disposition": "attachment; filename=complaints.csv"})

@app.post("/api/trips/")
def create_trip(trip: TripCreate, db: Session = Depends(get_db)):
    db_trip = Trip(**trip.dict())
    db.add(db_trip)
    db.commit()
    db.refresh(db_trip)
    return db_trip

def init_seed_data():
    db = SessionLocal()
    if db.query(Trip).count() == 0:
        trips_data = [
            {"trip_no": "TRIP202605010001", "passenger_name": "张明", "passenger_phone": "13800138001", "driver_name": "李强", "driver_phone": "13900139001", "car_plate": "京A12345", "start_location": "北京市朝阳区望京SOHO", "end_location": "北京市海淀区中关村", "start_time": datetime(2026, 5, 1, 8, 30), "end_time": datetime(2026, 5, 1, 9, 15), "amount": "¥58.50", "distance": "18.5公里"},
            {"trip_no": "TRIP202605010002", "passenger_name": "李华", "passenger_phone": "13800138002", "driver_name": "王芳", "driver_phone": "13900139002", "car_plate": "京B67890", "start_location": "上海市浦东新区陆家嘴", "end_location": "上海市静安区南京西路", "start_time": datetime(2026, 5, 1, 14, 20), "end_time": datetime(2026, 5, 1, 15, 5), "amount": "¥42.00", "distance": "12.3公里"},
            {"trip_no": "TRIP202605010003", "passenger_name": "王芳", "passenger_phone": "13800138003", "driver_name": "赵强", "driver_phone": "13900139003", "car_plate": "京C11111", "start_location": "广州市天河区珠江新城", "end_location": "广州市白云区机场", "start_time": datetime(2026, 5, 1, 19, 0), "end_time": datetime(2026, 5, 1, 19, 45), "amount": "¥120.00", "distance": "35.0公里"}
        ]
        for t in trips_data:
            db.add(Trip(**t))
        db.commit()
        print("种子行程数据初始化完成")
    db.close()

init_seed_data()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
