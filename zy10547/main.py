from datetime import datetime
from enum import Enum
from typing import List, Optional
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
import json
import csv
from io import StringIO
from fastapi.responses import StreamingResponse

SQLALCHEMY_DATABASE_URL = "sqlite:///./knowledge_hits.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class HitStatus(str, Enum):
    HIT = "hit"
    EXPIRED = "expired"
    FEEDBACK_PENDING = "feedback_pending"
    FEEDBACK_RECEIVED = "feedback_received"
    REVISION_CONFIRMED = "revision_confirmed"
    EXCEPTION = "exception"

class KnowledgeHit(Base):
    __tablename__ = "knowledge_hits"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, index=True, nullable=False)
    knowledge_entry = Column(String, nullable=False)
    knowledge_id = Column(String, index=True)
    hit_reason = Column(Text, nullable=False)
    is_expired = Column(Boolean, default=False)
    expire_date = Column(DateTime)
    status = Column(String, default=HitStatus.HIT)
    feedback = Column(Text)
    feedback_by = Column(String)
    feedback_at = Column(DateTime)
    revision_note = Column(Text)
    revised_by = Column(String)
    revised_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    raw_input = Column(Text)
    processing_notes = Column(Text)
    is_manually_corrected = Column(Boolean, default=False)
    corrected_by = Column(String)
    corrections = Column(Text)
    reports = relationship("HitReport", back_populates="knowledge_hit")

class HitReport(Base):
    __tablename__ = "hit_reports"
    
    id = Column(Integer, primary_key=True, index=True)
    knowledge_hit_id = Column(Integer, ForeignKey("knowledge_hits.id"))
    report_type = Column(String)
    report_content = Column(Text)
    generated_by = Column(String)
    generated_at = Column(DateTime, default=datetime.utcnow)
    knowledge_hit = relationship("KnowledgeHit", back_populates="reports")

Base.metadata.create_all(bind=engine)

class KnowledgeHitCreate(BaseModel):
    session_id: str
    knowledge_entry: str
    knowledge_id: Optional[str] = None
    hit_reason: str
    is_expired: bool = False
    expire_date: Optional[datetime] = None
    raw_input: Optional[str] = None

class KnowledgeHitResponse(BaseModel):
    id: int
    session_id: str
    knowledge_entry: str
    knowledge_id: Optional[str]
    hit_reason: str
    is_expired: bool
    expire_date: Optional[datetime]
    status: str
    feedback: Optional[str]
    feedback_by: Optional[str]
    feedback_at: Optional[datetime]
    revision_note: Optional[str]
    revised_by: Optional[str]
    revised_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    is_manually_corrected: bool
    corrected_by: Optional[str]

    class Config:
        orm_mode = True

class FeedbackSubmit(BaseModel):
    feedback: str
    feedback_by: str

class RevisionConfirm(BaseModel):
    revision_note: str
    revised_by: str

class ManualCorrection(BaseModel):
    knowledge_entry: Optional[str] = None
    hit_reason: Optional[str] = None
    is_expired: Optional[bool] = None
    status: Optional[str] = None
    corrected_by: str
    correction_note: str

app = FastAPI(title="客服知识命中API", version="1.0.0")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.post("/api/knowledge-hits/", response_model=KnowledgeHitResponse)
def create_knowledge_hit(hit: KnowledgeHitCreate):
    db = next(get_db())
    try:
        status = HitStatus.HIT
        if hit.is_expired:
            status = HitStatus.EXPIRED
        
        if hit.expire_date and hit.expire_date < datetime.utcnow():
            status = HitStatus.EXPIRED
        
        db_hit = KnowledgeHit(
            session_id=hit.session_id,
            knowledge_entry=hit.knowledge_entry,
            knowledge_id=hit.knowledge_id,
            hit_reason=hit.hit_reason,
            is_expired=hit.is_expired or (hit.expire_date < datetime.utcnow() if hit.expire_date else False),
            expire_date=hit.expire_date,
            status=status,
            raw_input=hit.raw_input or json.dumps(hit.dict(), ensure_ascii=False)
        )
        db.add(db_hit)
        db.commit()
        db.refresh(db_hit)
        return db_hit
    except Exception as e:
        db_hit = KnowledgeHit(
            session_id=hit.session_id or "unknown",
            knowledge_entry=hit.knowledge_entry or "unknown",
            hit_reason=hit.hit_reason or "unknown",
            status=HitStatus.EXCEPTION,
            raw_input=json.dumps(hit.dict(), ensure_ascii=False),
            processing_notes=f"Exception: {str(e)}"
        )
        db.add(db_hit)
        db.commit()
        db.refresh(db_hit)
        raise HTTPException(status_code=500, detail=f"处理异常，已记录: {str(e)}")

@app.get("/api/knowledge-hits/", response_model=List[KnowledgeHitResponse])
def list_knowledge_hits(
    session_id: Optional[str] = None,
    status: Optional[str] = None,
    is_expired: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100
):
    db = next(get_db())
    query = db.query(KnowledgeHit)
    if session_id:
        query = query.filter(KnowledgeHit.session_id == session_id)
    if status:
        query = query.filter(KnowledgeHit.status == status)
    if is_expired is not None:
        query = query.filter(KnowledgeHit.is_expired == is_expired)
    return query.offset(skip).limit(limit).all()

@app.get("/api/knowledge-hits/{hit_id}", response_model=KnowledgeHitResponse)
def get_knowledge_hit(hit_id: int):
    db = next(get_db())
    hit = db.query(KnowledgeHit).filter(KnowledgeHit.id == hit_id).first()
    if not hit:
        raise HTTPException(status_code=404, detail="记录未找到")
    return hit

@app.patch("/api/knowledge-hits/{hit_id}/status")
def update_hit_status(hit_id: int, status: str):
    db = next(get_db())
    hit = db.query(KnowledgeHit).filter(KnowledgeHit.id == hit_id).first()
    if not hit:
        raise HTTPException(status_code=404, detail="记录未找到")
    
    valid_statuses = [s.value for s in HitStatus]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"无效状态，有效值: {valid_statuses}")
    
    hit.status = status
    hit.updated_at = datetime.utcnow()
    db.commit()
    return {"message": "状态已更新", "new_status": status}

@app.post("/api/knowledge-hits/{hit_id}/feedback")
def submit_feedback(hit_id: int, feedback: FeedbackSubmit):
    db = next(get_db())
    hit = db.query(KnowledgeHit).filter(KnowledgeHit.id == hit_id).first()
    if not hit:
        raise HTTPException(status_code=404, detail="记录未找到")
    
    hit.feedback = feedback.feedback
    hit.feedback_by = feedback.feedback_by
    hit.feedback_at = datetime.utcnow()
    hit.status = HitStatus.FEEDBACK_RECEIVED
    hit.updated_at = datetime.utcnow()
    db.commit()
    return {"message": "反馈已提交"}

@app.post("/api/knowledge-hits/{hit_id}/confirm-revision")
def confirm_revision(hit_id: int, revision: RevisionConfirm):
    db = next(get_db())
    hit = db.query(KnowledgeHit).filter(KnowledgeHit.id == hit_id).first()
    if not hit:
        raise HTTPException(status_code=404, detail="记录未找到")
    
    hit.revision_note = revision.revision_note
    hit.revised_by = revision.revised_by
    hit.revised_at = datetime.utcnow()
    hit.status = HitStatus.REVISION_CONFIRMED
    hit.updated_at = datetime.utcnow()
    db.commit()
    return {"message": "修订已确认"}

@app.patch("/api/knowledge-hits/{hit_id}/manual-correct")
def manual_correct(hit_id: int, correction: ManualCorrection):
    db = next(get_db())
    hit = db.query(KnowledgeHit).filter(KnowledgeHit.id == hit_id).first()
    if not hit:
        raise HTTPException(status_code=404, detail="记录未找到")
    
    corrections_made = {}
    if correction.knowledge_entry is not None:
        corrections_made["knowledge_entry"] = {"old": hit.knowledge_entry, "new": correction.knowledge_entry}
        hit.knowledge_entry = correction.knowledge_entry
    if correction.hit_reason is not None:
        corrections_made["hit_reason"] = {"old": hit.hit_reason, "new": correction.hit_reason}
        hit.hit_reason = correction.hit_reason
    if correction.is_expired is not None:
        corrections_made["is_expired"] = {"old": hit.is_expired, "new": correction.is_expired}
        hit.is_expired = correction.is_expired
    if correction.status is not None:
        corrections_made["status"] = {"old": hit.status, "new": correction.status}
        hit.status = correction.status
    
    hit.is_manually_corrected = True
    hit.corrected_by = correction.corrected_by
    hit.corrections = json.dumps({
        "changes": corrections_made,
        "note": correction.correction_note
    }, ensure_ascii=False)
    hit.updated_at = datetime.utcnow()
    db.commit()
    return {"message": "人工修正已应用", "corrections": corrections_made}

@app.get("/api/knowledge-hits/{hit_id}/raw")
def get_raw_input(hit_id: int):
    db = next(get_db())
    hit = db.query(KnowledgeHit).filter(KnowledgeHit.id == hit_id).first()
    if not hit:
        raise HTTPException(status_code=404, detail="记录未找到")
    return {
        "raw_input": hit.raw_input,
        "processing_notes": hit.processing_notes,
        "corrections": hit.corrections
    }

@app.get("/api/knowledge-hits/export/csv")
def export_csv(
    session_id: Optional[str] = None,
    status: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None
):
    db = next(get_db())
    query = db.query(KnowledgeHit)
    if session_id:
        query = query.filter(KnowledgeHit.session_id == session_id)
    if status:
        query = query.filter(KnowledgeHit.status == status)
    if start_date:
        query = query.filter(KnowledgeHit.created_at >= start_date)
    if end_date:
        query = query.filter(KnowledgeHit.created_at <= end_date)
    
    hits = query.all()
    
    output = StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "ID", "会话编号", "知识条目", "知识ID", "命中原因", "是否过期",
        "过期日期", "状态", "反馈", "反馈人", "反馈时间", "修订说明",
        "修订人", "修订时间", "创建时间", "是否人工修正", "修正人"
    ])
    
    for hit in hits:
        writer.writerow([
            hit.id, hit.session_id, hit.knowledge_entry, hit.knowledge_id,
            hit.hit_reason, hit.is_expired, hit.expire_date, hit.status,
            hit.feedback, hit.feedback_by, hit.feedback_at, hit.revision_note,
            hit.revised_by, hit.revised_at, hit.created_at,
            hit.is_manually_corrected, hit.corrected_by
        ])
    
    output.seek(0)
    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=knowledge_hits.csv"}
    )

@app.post("/api/knowledge-hits/{hit_id}/report")
def generate_report(hit_id: int, report_type: str = "full"):
    db = next(get_db())
    hit = db.query(KnowledgeHit).filter(KnowledgeHit.id == hit_id).first()
    if not hit:
        raise HTTPException(status_code=404, detail="记录未找到")
    
    report_content = {
        "hit_id": hit.id,
        "session_id": hit.session_id,
        "knowledge_entry": hit.knowledge_entry,
        "hit_reason": hit.hit_reason,
        "is_expired": hit.is_expired,
        "status": hit.status,
        "feedback": hit.feedback,
        "revision_note": hit.revision_note,
        "timeline": {
            "created_at": hit.created_at.isoformat() if hit.created_at else None,
            "feedback_at": hit.feedback_at.isoformat() if hit.feedback_at else None,
            "revised_at": hit.revised_at.isoformat() if hit.revised_at else None,
            "updated_at": hit.updated_at.isoformat() if hit.updated_at else None,
        },
        "manual_correction": {
            "is_corrected": hit.is_manually_corrected,
            "corrected_by": hit.corrected_by,
            "details": json.loads(hit.corrections) if hit.corrections else None
        },
        "generated_at": datetime.utcnow().isoformat()
    }
    
    db_report = HitReport(
        knowledge_hit_id=hit.id,
        report_type=report_type,
        report_content=json.dumps(report_content, ensure_ascii=False),
        generated_by="system"
    )
    db.add(db_report)
    db.commit()
    
    return report_content

@app.get("/api/health")
def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
