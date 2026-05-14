from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from sqlalchemy import create_engine, Column, String, Integer, DateTime, Text, Boolean, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
import json

DATABASE_URL = "sqlite:///./error_code.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

app = FastAPI(title="错误码知识库维护系统")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ErrorCode(Base):
    __tablename__ = "error_codes"
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, index=True)
    original_input = Column(Text)
    trigger_interface = Column(String)
    user_tip = Column(Text)
    processing_steps = Column(Text)
    status = Column(String, default="pending")
    current_version = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    versions = relationship("ErrorCodeVersion", back_populates="error_code")
    reviews = relationship("ReviewRecord", back_populates="error_code")
    hit_stats = relationship("HitStatistic", back_populates="error_code")

class ErrorCodeVersion(Base):
    __tablename__ = "error_code_versions"
    id = Column(Integer, primary_key=True, index=True)
    error_code_id = Column(Integer, ForeignKey("error_codes.id"))
    version = Column(Integer)
    trigger_interface = Column(String)
    user_tip = Column(Text)
    processing_steps = Column(Text)
    processed_result = Column(Text)
    handler = Column(String)
    handle_time = Column(DateTime)
    handle_reason = Column(Text)
    is_effective = Column(Boolean, default=False)
    effective_time = Column(DateTime)
    error_code = relationship("ErrorCode", back_populates="versions")

class ReviewRecord(Base):
    __tablename__ = "review_records"
    id = Column(Integer, primary_key=True, index=True)
    error_code_id = Column(Integer, ForeignKey("error_codes.id"))
    reviewer = Column(String)
    review_time = Column(DateTime, default=datetime.now)
    review_result = Column(String)
    review_comment = Column(Text)
    error_code = relationship("ErrorCode", back_populates="reviews")

class HitStatistic(Base):
    __tablename__ = "hit_statistics"
    id = Column(Integer, primary_key=True, index=True)
    error_code_id = Column(Integer, ForeignKey("error_codes.id"))
    hit_time = Column(DateTime, default=datetime.now)
    user_id = Column(String)
    request_id = Column(String)
    is_success = Column(Boolean, default=True)
    error_message = Column(Text)
    error_code = relationship("ErrorCode", back_populates="hit_stats")

class CorrectionRecord(Base):
    __tablename__ = "correction_records"
    id = Column(Integer, primary_key=True, index=True)
    error_code_id = Column(Integer)
    version_id = Column(Integer)
    corrector = Column(String)
    correction_time = Column(DateTime, default=datetime.now)
    correction_reason = Column(Text)
    before_correction = Column(Text)
    after_correction = Column(Text)

Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class ErrorCodeCreate(BaseModel):
    code: str
    original_input: str
    trigger_interface: Optional[str] = None
    user_tip: Optional[str] = None
    processing_steps: Optional[str] = None

class ErrorCodeUpdate(BaseModel):
    trigger_interface: Optional[str] = None
    user_tip: Optional[str] = None
    processing_steps: Optional[str] = None
    processed_result: Optional[str] = None
    handler: str
    handle_reason: str

class ReviewRequest(BaseModel):
    reviewer: str
    review_result: str
    review_comment: Optional[str] = None

class CorrectionRequest(BaseModel):
    corrector: str
    correction_reason: str
    trigger_interface: Optional[str] = None
    user_tip: Optional[str] = None
    processing_steps: Optional[str] = None

@app.post("/api/error-codes", response_model=dict)
def create_error_code(ec: ErrorCodeCreate, db: Session = Depends(get_db)):
    db_ec = db.query(ErrorCode).filter(ErrorCode.code == ec.code).first()
    if db_ec:
        raise HTTPException(status_code=400, detail="错误码已存在")
    db_ec = ErrorCode(
        code=ec.code,
        original_input=ec.original_input,
        trigger_interface=ec.trigger_interface,
        user_tip=ec.user_tip,
        processing_steps=ec.processing_steps
    )
    db.add(db_ec)
    db.commit()
    db.refresh(db_ec)
    
    db_version = ErrorCodeVersion(
        error_code_id=db_ec.id,
        version=1,
        trigger_interface=ec.trigger_interface,
        user_tip=ec.user_tip,
        processing_steps=ec.processing_steps
    )
    db.add(db_version)
    db.commit()
    return {"id": db_ec.id, "code": db_ec.code, "status": db_ec.status}

@app.get("/api/error-codes", response_model=List[dict])
def list_error_codes(status: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(ErrorCode)
    if status:
        query = query.filter(ErrorCode.status == status)
    result = []
    for ec in query.order_by(ErrorCode.updated_at.desc()).all():
        hit_count = db.query(HitStatistic).filter(HitStatistic.error_code_id == ec.id).count()
        fail_count = db.query(HitStatistic).filter(
            HitStatistic.error_code_id == ec.id,
            HitStatistic.is_success == False
        ).count()
        result.append({
            "id": ec.id,
            "code": ec.code,
            "trigger_interface": ec.trigger_interface,
            "status": ec.status,
            "current_version": ec.current_version,
            "created_at": ec.created_at.isoformat(),
            "updated_at": ec.updated_at.isoformat(),
            "hit_count": hit_count,
            "fail_count": fail_count
        })
    return result

@app.get("/api/error-codes/{ec_id}", response_model=dict)
def get_error_code(ec_id: int, db: Session = Depends(get_db)):
    ec = db.query(ErrorCode).filter(ErrorCode.id == ec_id).first()
    if not ec:
        raise HTTPException(status_code=404, detail="错误码不存在")
    
    versions = db.query(ErrorCodeVersion).filter(ErrorCodeVersion.error_code_id == ec_id).order_by(ErrorCodeVersion.version.desc()).all()
    reviews = db.query(ReviewRecord).filter(ReviewRecord.error_code_id == ec_id).order_by(ReviewRecord.review_time.desc()).all()
    
    return {
        "id": ec.id,
        "code": ec.code,
        "original_input": ec.original_input,
        "trigger_interface": ec.trigger_interface,
        "user_tip": ec.user_tip,
        "processing_steps": ec.processing_steps,
        "status": ec.status,
        "current_version": ec.current_version,
        "created_at": ec.created_at.isoformat(),
        "updated_at": ec.updated_at.isoformat(),
        "versions": [{
            "id": v.id,
            "version": v.version,
            "trigger_interface": v.trigger_interface,
            "user_tip": v.user_tip,
            "processing_steps": v.processing_steps,
            "processed_result": v.processed_result,
            "handler": v.handler,
            "handle_time": v.handle_time.isoformat() if v.handle_time else None,
            "handle_reason": v.handle_reason,
            "is_effective": v.is_effective,
            "effective_time": v.effective_time.isoformat() if v.effective_time else None
        } for v in versions],
        "reviews": [{
            "id": r.id,
            "reviewer": r.reviewer,
            "review_time": r.review_time.isoformat(),
            "review_result": r.review_result,
            "review_comment": r.review_comment
        } for r in reviews]
    }

@app.put("/api/error-codes/{ec_id}/process", response_model=dict)
def process_error_code(ec_id: int, update: ErrorCodeUpdate, db: Session = Depends(get_db)):
    ec = db.query(ErrorCode).filter(ErrorCode.id == ec_id).first()
    if not ec:
        raise HTTPException(status_code=404, detail="错误码不存在")
    
    new_version = ec.current_version + 1
    
    if update.trigger_interface:
        ec.trigger_interface = update.trigger_interface
    if update.user_tip:
        ec.user_tip = update.user_tip
    if update.processing_steps:
        ec.processing_steps = update.processing_steps
    
    db_version = ErrorCodeVersion(
        error_code_id=ec.id,
        version=new_version,
        trigger_interface=ec.trigger_interface,
        user_tip=ec.user_tip,
        processing_steps=ec.processing_steps,
        processed_result=update.processed_result,
        handler=update.handler,
        handle_time=datetime.now(),
        handle_reason=update.handle_reason
    )
    db.add(db_version)
    
    ec.current_version = new_version
    ec.status = "processed"
    db.commit()
    return {"message": "处理完成", "version": new_version}

@app.post("/api/error-codes/{ec_id}/review", response_model=dict)
def review_error_code(ec_id: int, review: ReviewRequest, db: Session = Depends(get_db)):
    ec = db.query(ErrorCode).filter(ErrorCode.id == ec_id).first()
    if not ec:
        raise HTTPException(status_code=404, detail="错误码不存在")
    
    db_review = ReviewRecord(
        error_code_id=ec_id,
        reviewer=review.reviewer,
        review_result=review.review_result,
        review_comment=review.review_comment
    )
    db.add(db_review)
    
    if review.review_result == "approved":
        latest_version = db.query(ErrorCodeVersion).filter(
            ErrorCodeVersion.error_code_id == ec_id
        ).order_by(ErrorCodeVersion.version.desc()).first()
        if latest_version:
            latest_version.is_effective = True
            latest_version.effective_time = datetime.now()
        ec.status = "effective"
    elif review.review_result == "rejected":
        ec.status = "rejected"
    
    db.commit()
    return {"message": "复核完成", "status": ec.status}

@app.post("/api/error-codes/{ec_id}/correct/{version_id}", response_model=dict)
def correct_version(ec_id: int, version_id: int, correction: CorrectionRequest, db: Session = Depends(get_db)):
    version = db.query(ErrorCodeVersion).filter(
        ErrorCodeVersion.id == version_id,
        ErrorCodeVersion.error_code_id == ec_id
    ).first()
    if not version:
        raise HTTPException(status_code=404, detail="版本不存在")
    
    before = json.dumps({
        "trigger_interface": version.trigger_interface,
        "user_tip": version.user_tip,
        "processing_steps": version.processing_steps
    })
    
    if correction.trigger_interface:
        version.trigger_interface = correction.trigger_interface
    if correction.user_tip:
        version.user_tip = correction.user_tip
    if correction.processing_steps:
        version.processing_steps = correction.processing_steps
    
    after = json.dumps({
        "trigger_interface": version.trigger_interface,
        "user_tip": version.user_tip,
        "processing_steps": version.processing_steps
    })
    
    db_correction = CorrectionRecord(
        error_code_id=ec_id,
        version_id=version_id,
        corrector=correction.corrector,
        correction_reason=correction.correction_reason,
        before_correction=before,
        after_correction=after
    )
    db.add(db_correction)
    
    ec = db.query(ErrorCode).filter(ErrorCode.id == ec_id).first()
    ec.trigger_interface = version.trigger_interface
    ec.user_tip = version.user_tip
    ec.processing_steps = version.processing_steps
    
    db.commit()
    return {"message": "修正完成", "correction_id": db_correction.id}

@app.get("/api/error-codes/{ec_id}/hit-stats", response_model=List[dict])
def get_hit_stats(ec_id: int, db: Session = Depends(get_db), is_success: Optional[bool] = None):
    query = db.query(HitStatistic).filter(HitStatistic.error_code_id == ec_id)
    if is_success is not None:
        query = query.filter(HitStatistic.is_success == is_success)
    
    result = []
    for stat in query.order_by(HitStatistic.hit_time.desc()).all():
        result.append({
            "id": stat.id,
            "hit_time": stat.hit_time.isoformat(),
            "user_id": stat.user_id,
            "request_id": stat.request_id,
            "is_success": stat.is_success,
            "error_message": stat.error_message
        })
    return result

@app.post("/api/error-codes/{ec_id}/hit", response_model=dict)
def add_hit_stat(ec_id: int, user_id: str, request_id: str, is_success: bool = True, error_message: Optional[str] = None, db: Session = Depends(get_db)):
    db_stat = HitStatistic(
        error_code_id=ec_id,
        user_id=user_id,
        request_id=request_id,
        is_success=is_success,
        error_message=error_message
    )
    db.add(db_stat)
    db.commit()
    return {"message": "命中记录已添加", "id": db_stat.id}

@app.get("/api/corrections/{ec_id}", response_model=List[dict])
def get_corrections(ec_id: int, db: Session = Depends(get_db)):
    corrections = db.query(CorrectionRecord).filter(CorrectionRecord.error_code_id == ec_id).order_by(CorrectionRecord.correction_time.desc()).all()
    return [{
        "id": c.id,
        "version_id": c.version_id,
        "corrector": c.corrector,
        "correction_time": c.correction_time.isoformat(),
        "correction_reason": c.correction_reason,
        "before_correction": c.before_correction,
        "after_correction": c.after_correction
    } for c in corrections]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
