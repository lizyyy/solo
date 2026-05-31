from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Form
from fastapi.responses import JSONResponse, FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
from datetime import datetime
from typing import List, Optional
import os
import shutil

Base = declarative_base()

class Score(Base):
    __tablename__ = "scores"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    upload_time = Column(DateTime, default=datetime.now)
    description = Column(Text)

class Recording(Base):
    __tablename__ = "recordings"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    upload_time = Column(DateTime, default=datetime.now)
    duration = Column(String(50))
    description = Column(Text)

class VoicePart(Base):
    __tablename__ = "voice_parts"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)
    description = Column(Text)

class RehearsalSession(Base):
    __tablename__ = "rehearsal_sessions"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    date = Column(DateTime, default=datetime.now)
    conductor = Column(String(100))
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.now)
    records = relationship("RehearsalRecord", back_populates="session")

class RehearsalRecord(Base):
    __tablename__ = "rehearsal_records"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("rehearsal_sessions.id"))
    score_id = Column(Integer, ForeignKey("scores.id"))
    recording_id = Column(Integer, ForeignKey("recordings.id"))
    voice_part_id = Column(Integer, ForeignKey("voice_parts.id"))
    measure_start = Column(Integer)
    measure_end = Column(Integer)
    page_number = Column(Integer)
    key_signature = Column(String(50))
    tempo = Column(String(50))
    issues = Column(Text)
    corrections = Column(Text)
    is_controversial = Column(Boolean, default=False)
    review_reason = Column(Text)
    status = Column(String(50), default="draft")
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    session = relationship("RehearsalSession", back_populates="records")
    score = relationship("Score")
    recording = relationship("Recording")
    voice_part = relationship("VoicePart")
    history = relationship("RecordHistory", back_populates="record")

class RecordHistory(Base):
    __tablename__ = "record_history"
    id = Column(Integer, primary_key=True, index=True)
    record_id = Column(Integer, ForeignKey("rehearsal_records.id"))
    change_type = Column(String(50))
    old_value = Column(Text)
    new_value = Column(Text)
    changed_by = Column(String(100))
    change_reason = Column(Text)
    changed_at = Column(DateTime, default=datetime.now)
    record = relationship("RehearsalRecord", back_populates="history")

DATABASE_URL = "sqlite:///./rehearsal.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

app = FastAPI(title="合唱声部排练系统")

os.makedirs("uploads/scores", exist_ok=True)
os.makedirs("uploads/recordings", exist_ok=True)
os.makedirs("templates", exist_ok=True)
os.makedirs("static", exist_ok=True)

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

@app.on_event("startup")
def startup_event():
    Base.metadata.create_all(bind=engine)
    db = next(get_db())
    default_parts = ["女高音Soprano", "女低音Alto", "男高音Tenor", "男低音Bass"]
    for part in default_parts:
        if not db.query(VoicePart).filter(VoicePart.name == part).first():
            db.add(VoicePart(name=part, description=f"{part}声部"))
    db.commit()

@app.get("/", response_class=HTMLResponse)
def read_root():
    with open("templates/index.html", "r", encoding="utf-8") as f:
        return f.read()

@app.post("/scores/upload")
def upload_score(name: str = Form(...), description: str = Form(""), file: UploadFile = File(...), db: Session = Depends(get_db)):
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext != ".pdf":
        raise HTTPException(status_code=400, detail="只支持PDF文件")
    file_path = f"uploads/scores/{datetime.now().strftime('%Y%m%d%H%M%S')}_{file.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    score = Score(name=name, file_path=file_path, description=description)
    db.add(score)
    db.commit()
    db.refresh(score)
    return {"id": score.id, "name": score.name, "file_path": score.file_path}

@app.get("/scores")
def list_scores(db: Session = Depends(get_db)):
    scores = db.query(Score).all()
    return [{"id": s.id, "name": s.name, "file_path": s.file_path, "upload_time": s.upload_time.isoformat()} for s in scores]

@app.get("/scores/{score_id}")
def get_score(score_id: int, db: Session = Depends(get_db)):
    score = db.query(Score).filter(Score.id == score_id).first()
    if not score:
        raise HTTPException(status_code=404, detail="曲谱不存在")
    return FileResponse(score.file_path)

@app.post("/recordings/upload")
def upload_recording(name: str = Form(...), description: str = Form(""), duration: str = Form(""), file: UploadFile = File(...), db: Session = Depends(get_db)):
    file_path = f"uploads/recordings/{datetime.now().strftime('%Y%m%d%H%M%S')}_{file.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    recording = Recording(name=name, file_path=file_path, duration=duration, description=description)
    db.add(recording)
    db.commit()
    db.refresh(recording)
    return {"id": recording.id, "name": recording.name, "file_path": recording.file_path}

@app.get("/recordings")
def list_recordings(db: Session = Depends(get_db)):
    recordings = db.query(Recording).all()
    return [{"id": r.id, "name": r.name, "file_path": r.file_path, "duration": r.duration} for r in recordings]

@app.get("/voice-parts")
def list_voice_parts(db: Session = Depends(get_db)):
    parts = db.query(VoicePart).all()
    return [{"id": p.id, "name": p.name} for p in parts]

@app.post("/sessions")
def create_session(title: str = Form(...), conductor: str = Form(""), notes: str = Form(""), db: Session = Depends(get_db)):
    session = RehearsalSession(title=title, conductor=conductor, notes=notes)
    db.add(session)
    db.commit()
    db.refresh(session)
    return {"id": session.id, "title": session.title}

@app.get("/sessions")
def list_sessions(db: Session = Depends(get_db)):
    sessions = db.query(RehearsalSession).order_by(RehearsalSession.date.desc()).all()
    return [{"id": s.id, "title": s.title, "date": s.date.isoformat(), "conductor": s.conductor} for s in sessions]

@app.post("/records")
def create_record(
    session_id: int = Form(...),
    score_id: int = Form(...),
    recording_id: int = Form(None),
    voice_part_id: int = Form(...),
    measure_start: int = Form(...),
    measure_end: int = Form(...),
    page_number: int = Form(None),
    key_signature: str = Form(""),
    tempo: str = Form(""),
    issues: str = Form(""),
    corrections: str = Form(""),
    is_controversial: bool = Form(False),
    review_reason: str = Form(""),
    changed_by: str = Form(""),
    db: Session = Depends(get_db)
):
    record = RehearsalRecord(
        session_id=session_id,
        score_id=score_id,
        recording_id=recording_id,
        voice_part_id=voice_part_id,
        measure_start=measure_start,
        measure_end=measure_end,
        page_number=page_number,
        key_signature=key_signature,
        tempo=tempo,
        issues=issues,
        corrections=corrections,
        is_controversial=is_controversial,
        review_reason=review_reason,
        status="draft"
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    history = RecordHistory(
        record_id=record.id,
        change_type="create",
        old_value="",
        new_value=f"创建记录: 小节{measure_start}-{measure_end}",
        changed_by=changed_by,
        change_reason="初始创建"
    )
    db.add(history)
    db.commit()
    return {"id": record.id, "status": "success"}

@app.get("/sessions/{session_id}/records")
def get_session_records(session_id: int, db: Session = Depends(get_db)):
    records = db.query(RehearsalRecord).filter(RehearsalRecord.session_id == session_id).all()
    result = []
    for r in records:
        result.append({
            "id": r.id,
            "session_id": r.session_id,
            "score_id": r.score_id,
            "score_name": r.score.name if r.score else "",
            "recording_id": r.recording_id,
            "recording_name": r.recording.name if r.recording else "",
            "voice_part": r.voice_part.name if r.voice_part else "",
            "measure_start": r.measure_start,
            "measure_end": r.measure_end,
            "page_number": r.page_number,
            "key_signature": r.key_signature,
            "tempo": r.tempo,
            "issues": r.issues,
            "corrections": r.corrections,
            "is_controversial": r.is_controversial,
            "review_reason": r.review_reason,
            "status": r.status,
            "created_at": r.created_at.isoformat()
        })
    return result

@app.put("/records/{record_id}/review")
def review_record(
    record_id: int,
    status: str = Form(...),
    review_reason: str = Form(""),
    corrections: str = Form(""),
    changed_by: str = Form(""),
    db: Session = Depends(get_db)
):
    record = db.query(RehearsalRecord).filter(RehearsalRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")
    old_status = record.status
    old_corrections = record.corrections
    record.status = status
    record.corrections = corrections if corrections else record.corrections
    record.review_reason = review_reason if review_reason else record.review_reason
    db.commit()
    history = RecordHistory(
        record_id=record.id,
        change_type="review",
        old_value=f"状态: {old_status}, 修正: {old_corrections}",
        new_value=f"状态: {status}, 修正: {record.corrections}",
        changed_by=changed_by,
        change_reason=review_reason or "复核更新"
    )
    db.add(history)
    db.commit()
    return {"status": "success"}

@app.get("/records/{record_id}/history")
def get_record_history(record_id: int, db: Session = Depends(get_db)):
    history = db.query(RecordHistory).filter(RecordHistory.record_id == record_id).order_by(RecordHistory.changed_at.desc()).all()
    return [{
        "id": h.id,
        "change_type": h.change_type,
        "old_value": h.old_value,
        "new_value": h.new_value,
        "changed_by": h.changed_by,
        "change_reason": h.change_reason,
        "changed_at": h.changed_at.isoformat()
    } for h in history]

@app.get("/sessions/{session_id}/export")
def export_session(session_id: int, db: Session = Depends(get_db)):
    session = db.query(RehearsalSession).filter(RehearsalSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="排练场次不存在")
    records = db.query(RehearsalRecord).filter(RehearsalRecord.session_id == session_id).all()
    content = [
        "=" * 60,
        f"排练小结: {session.title}",
        f"日期: {session.date.strftime('%Y-%m-%d %H:%M')}",
        f"指挥: {session.conductor or '未填写'}",
        f"备注: {session.notes or '无'}",
        "=" * 60,
        "",
        "排练记录详情:"
    ]
    for i, r in enumerate(records, 1):
        content.extend([
            f"\n--- 记录 #{i} ---",
            f"声部: {r.voice_part.name if r.voice_part else '未知'}",
            f"曲谱: {r.score.name if r.score else '未知'} (ID: {r.score_id})",
            f"小节范围: {r.measure_start} - {r.measure_end}",
            f"页码: {r.page_number or '未标注'}",
            f"调号: {r.key_signature or '未标注'}",
            f"速度: {r.tempo or '未标注'}",
            f"问题: {r.issues or '无'}",
            f"修正方案: {r.corrections or '无'}",
            f"状态: {r.status}",
        ])
        if r.is_controversial:
            content.append(f"⚠️ 争议点: {r.review_reason}")
        if r.recording_id:
            content.append(f"🎵 关联录音: {r.recording.name if r.recording else '未知'} (ID: {r.recording_id})")
        content.append(f"追溯链接: 记录ID={r.id}")
    content.extend([
        "\n" + "=" * 60,
        f"导出时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "下一班排练请重点关注带 ⚠️ 标记的争议项"
    ])
    export_path = f"exports/session_{session_id}.txt"
    os.makedirs("exports", exist_ok=True)
    with open(export_path, "w", encoding="utf-8") as f:
        f.write("\n".join(content))
    return FileResponse(export_path, filename=f"排练小结_{session.title}.txt")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
