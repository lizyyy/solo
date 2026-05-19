from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy import create_engine, Column, String, Integer, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime, timedelta
import pandas as pd
import uuid
import os
from typing import List, Dict, Any, Optional
from pydantic import BaseModel

DATABASE_URL = "sqlite:///./hazard_management.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

app = FastAPI(title="隐患闭环管理系统", version="1.0.0")

class Hazard(Base):
    __tablename__ = "hazards"
    
    id = Column(String, primary_key=True, index=True)
    location = Column(String, index=True, nullable=False)
    description = Column(Text, nullable=False)
    level = Column(String, default="一般")
    found_time = Column(DateTime)
    found_by = Column(String)
    status = Column(String, default="待派发")
    photos = Column(Text)
    deadline = Column(DateTime)
    merged_from = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    assignments = relationship("Assignment", back_populates="hazard")
    rectifications = relationship("Rectification", back_populates="hazard")
    reviews = relationship("Review", back_populates="hazard")

class Assignment(Base):
    __tablename__ = "assignments"
    
    id = Column(String, primary_key=True, index=True)
    hazard_id = Column(String, ForeignKey("hazards.id"))
    assignee = Column(String, nullable=False)
    assigned_time = Column(DateTime, default=datetime.utcnow)
    assigned_by = Column(String)
    
    hazard = relationship("Hazard", back_populates="assignments")

class Rectification(Base):
    __tablename__ = "rectifications"
    
    id = Column(String, primary_key=True, index=True)
    hazard_id = Column(String, ForeignKey("hazards.id"))
    rectifier = Column(String)
    rectification_time = Column(DateTime)
    description = Column(Text)
    photos = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    hazard = relationship("Hazard", back_populates="rectifications")

class Review(Base):
    __tablename__ = "reviews"
    
    id = Column(String, primary_key=True, index=True)
    hazard_id = Column(String, ForeignKey("hazards.id"))
    reviewer = Column(String, nullable=False)
    review_time = Column(DateTime, default=datetime.utcnow)
    result = Column(String, nullable=False)
    comments = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    hazard = relationship("Hazard", back_populates="reviews")

class ImportRecord(Base):
    __tablename__ = "import_records"
    
    id = Column(String, primary_key=True, index=True)
    import_time = Column(DateTime, default=datetime.utcnow)
    total_count = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)
    failed_details = Column(Text)

Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class AssignmentRequest(BaseModel):
    hazard_id: str
    assignee: str
    assigned_by: Optional[str] = None

class RectificationRequest(BaseModel):
    hazard_id: str
    rectifier: str
    description: str
    photos: Optional[str] = None

class ReviewRequest(BaseModel):
    hazard_id: str
    reviewer: str
    result: str
    comments: Optional[str] = None

class BatchOperationResult(BaseModel):
    success: List[Dict[str, Any]]
    failed: List[Dict[str, Any]]

def check_overdue(hazard: Hazard) -> Dict[str, Any]:
    if hazard.deadline and datetime.utcnow() > hazard.deadline:
        overdue_days = (datetime.utcnow() - hazard.deadline).days
        new_level = "重大" if overdue_days > 3 else "较大"
        return {
            "overdue": True,
            "overdue_days": overdue_days,
            "new_level": new_level,
            "reason": f"隐患已逾期 {overdue_days} 天，等级升级为 {new_level}"
        }
    return {"overdue": False}

def check_photos(photos_str: Optional[str]) -> Dict[str, Any]:
    if not photos_str or len(photos_str.strip()) == 0:
        return {
            "valid": False,
            "reason": "缺少整改照片，不能通过复查"
        }
    return {"valid": True}

def find_duplicate_hazards(db, location: str, description: str) -> List[Hazard]:
    return db.query(Hazard).filter(
        Hazard.location == location,
        Hazard.status.in_(["待派发", "整改中", "待复查"])
    ).all()

@app.post("/api/hazards/import", response_model=BatchOperationResult)
async def import_hazards(file: UploadFile = File(...)):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="只支持 CSV 文件")
    
    db = next(get_db())
    success_records = []
    failed_records = []
    
    try:
        df = pd.read_csv(file.file)
        required_columns = ['location', 'description', 'found_time', 'found_by']
        missing_columns = [col for col in required_columns if col not in df.columns]
        
        if missing_columns:
            raise HTTPException(status_code=400, detail=f"缺少必要列: {', '.join(missing_columns)}")
        
        for idx, row in df.iterrows():
            try:
                row_dict = row.to_dict()
                
                existing = db.query(Hazard).filter(
                    Hazard.location == row_dict['location'],
                    Hazard.description == row_dict['description'],
                    Hazard.found_by == row_dict['found_by']
                ).first()
                
                if existing:
                    failed_records.append({
                        "row": idx + 2,
                        "data": row_dict,
                        "reason": "该隐患已存在，避免重复导入"
                    })
                    continue
                
                duplicates = find_duplicate_hazards(db, row_dict['location'], row_dict['description'])
                
                hazard_id = str(uuid.uuid4())
                hazard = Hazard(
                    id=hazard_id,
                    location=row_dict['location'],
                    description=row_dict['description'],
                    level=row_dict.get('level', '一般'),
                    found_time=datetime.fromisoformat(row_dict['found_time']) if row_dict.get('found_time') else None,
                    found_by=row_dict['found_by'],
                    photos=row_dict.get('photos', ''),
                    deadline=datetime.fromisoformat(row_dict['deadline']) if row_dict.get('deadline') else None
                )
                
                if duplicates:
                    duplicate_ids = [h.id for h in duplicates]
                    hazard.merged_from = ",".join(duplicate_ids)
                    for dup in duplicates:
                        dup.status = "已合并"
                
                db.add(hazard)
                success_records.append({
                    "id": hazard_id,
                    "data": row_dict,
                    "merged": len(duplicates) > 0,
                    "merged_count": len(duplicates)
                })
                
            except Exception as e:
                failed_records.append({
                    "row": idx + 2,
                    "data": row.to_dict(),
                    "reason": str(e)
                })
        
        import_record = ImportRecord(
            id=str(uuid.uuid4()),
            total_count=len(df),
            success_count=len(success_records),
            failed_count=len(failed_records),
            failed_details=str(failed_records)
        )
        db.add(import_record)
        db.commit()
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    
    return {"success": success_records, "failed": failed_records}

@app.post("/api/hazards/assign", response_model=Dict[str, Any])
async def assign_hazard(request: AssignmentRequest):
    db = next(get_db())
    
    hazard = db.query(Hazard).filter(Hazard.id == request.hazard_id).first()
    if not hazard:
        raise HTTPException(status_code=404, detail="隐患不存在")
    
    overdue_check = check_overdue(hazard)
    if overdue_check["overdue"]:
        hazard.level = overdue_check["new_level"]
    
    existing_assignment = db.query(Assignment).filter(
        Assignment.hazard_id == request.hazard_id,
        Assignment.assignee == request.assignee
    ).first()
    
    if existing_assignment:
        return {
            "success": True,
            "idempotent": True,
            "assignment_id": existing_assignment.id,
            "reason": "该派发已存在，幂等性处理"
        }
    
    assignment_id = str(uuid.uuid4())
    assignment = Assignment(
        id=assignment_id,
        hazard_id=request.hazard_id,
        assignee=request.assignee,
        assigned_by=request.assigned_by
    )
    db.add(assignment)
    
    hazard.status = "整改中"
    hazard.updated_at = datetime.utcnow()
    
    db.commit()
    
    return {
        "success": True,
        "assignment_id": assignment_id,
        "hazard_status": hazard.status,
        "upgrade": overdue_check
    }

@app.post("/api/hazards/rectify", response_model=Dict[str, Any])
async def rectify_hazard(request: RectificationRequest):
    db = next(get_db())
    
    hazard = db.query(Hazard).filter(Hazard.id == request.hazard_id).first()
    if not hazard:
        raise HTTPException(status_code=404, detail="隐患不存在")
    
    overdue_check = check_overdue(hazard)
    
    existing_rect = db.query(Rectification).filter(
        Rectification.hazard_id == request.hazard_id,
        Rectification.rectifier == request.rectifier,
        Rectification.description == request.description
    ).first()
    
    if existing_rect:
        return {
            "success": True,
            "idempotent": True,
            "rectification_id": existing_rect.id,
            "reason": "该整改记录已存在，幂等性处理"
        }
    
    rectification_id = str(uuid.uuid4())
    rectification = Rectification(
        id=rectification_id,
        hazard_id=request.hazard_id,
        rectifier=request.rectifier,
        rectification_time=datetime.utcnow(),
        description=request.description,
        photos=request.photos
    )
    db.add(rectification)
    
    hazard.status = "待复查"
    hazard.updated_at = datetime.utcnow()
    
    db.commit()
    
    return {
        "success": True,
        "rectification_id": rectification_id,
        "hazard_status": hazard.status,
        "upgrade": overdue_check
    }

@app.post("/api/hazards/review", response_model=Dict[str, Any])
async def review_hazard(request: ReviewRequest):
    db = next(get_db())
    
    hazard = db.query(Hazard).filter(Hazard.id == request.hazard_id).first()
    if not hazard:
        raise HTTPException(status_code=404, detail="隐患不存在")
    
    rectification = db.query(Rectification).filter(
        Rectification.hazard_id == request.hazard_id
    ).order_by(Rectification.created_at.desc()).first()
    
    photo_check = check_photos(rectification.photos if rectification else None)
    
    if request.result == "通过" and not photo_check["valid"]:
        return {
            "success": False,
            "blocked": True,
            "reason": photo_check["reason"],
            "hazard_status": hazard.status
        }
    
    existing_review = db.query(Review).filter(
        Review.hazard_id == request.hazard_id,
        Review.reviewer == request.reviewer,
        Review.result == request.result
    ).first()
    
    if existing_review:
        return {
            "success": True,
            "idempotent": True,
            "review_id": existing_review.id,
            "reason": "该复查记录已存在，幂等性处理"
        }
    
    review_id = str(uuid.uuid4())
    review = Review(
        id=review_id,
        hazard_id=request.hazard_id,
        reviewer=request.reviewer,
        result=request.result,
        comments=request.comments
    )
    db.add(review)
    
    if request.result == "通过":
        hazard.status = "已归档"
    elif request.result == "不通过":
        hazard.status = "整改中"
    
    hazard.updated_at = datetime.utcnow()
    db.commit()
    
    return {
        "success": True,
        "review_id": review_id,
        "hazard_status": hazard.status,
        "photo_check": photo_check
    }

@app.get("/api/hazards")
async def list_hazards(status: Optional[str] = None):
    db = next(get_db())
    query = db.query(Hazard)
    
    if status:
        query = query.filter(Hazard.status == status)
    
    hazards = query.all()
    
    result = []
    for h in hazards:
        overdue_check = check_overdue(h)
        result.append({
            "id": h.id,
            "location": h.location,
            "description": h.description,
            "level": h.level,
            "status": h.status,
            "found_time": h.found_time.isoformat() if h.found_time else None,
            "found_by": h.found_by,
            "deadline": h.deadline.isoformat() if h.deadline else None,
            "overdue": overdue_check
        })
    
    return result

@app.get("/api/hazards/{hazard_id}")
async def get_hazard(hazard_id: str):
    db = next(get_db())
    hazard = db.query(Hazard).filter(Hazard.id == hazard_id).first()
    
    if not hazard:
        raise HTTPException(status_code=404, detail="隐患不存在")
    
    assignments = db.query(Assignment).filter(Assignment.hazard_id == hazard_id).all()
    rectifications = db.query(Rectification).filter(Rectification.hazard_id == hazard_id).all()
    reviews = db.query(Review).filter(Review.hazard_id == hazard_id).all()
    
    return {
        "hazard": {
            "id": hazard.id,
            "location": hazard.location,
            "description": hazard.description,
            "level": hazard.level,
            "status": hazard.status,
            "found_time": hazard.found_time.isoformat() if hazard.found_time else None,
            "deadline": hazard.deadline.isoformat() if hazard.deadline else None,
            "overdue": check_overdue(hazard)
        },
        "assignments": [{"id": a.id, "assignee": a.assignee, "time": a.assigned_time.isoformat()} for a in assignments],
        "rectifications": [{"id": r.id, "rectifier": r.rectifier, "time": r.rectification_time.isoformat()} for r in rectifications],
        "reviews": [{"id": r.id, "reviewer": r.reviewer, "result": r.result, "time": r.review_time.isoformat()} for r in reviews]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
