from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, date
import pandas as pd
import os
from typing import List, Optional

from database import get_db, init_db, AudioRecord, QualityCheck, ApprovalRecord, TimeLine, ExportRecord, QualityStatistics
from schemas import (
    AudioRecordCreate, AudioRecordUpdate, AudioRecordResponse, AudioRecordDetail,
    QualityCheckCreate, QualityCheckResponse,
    ApprovalRecordCreate, ApprovalRecordResponse,
    TimeLineCreate, TimeLineResponse,
    QualityFlowRequest, StatisticsResponse, ExportRequest
)

app = FastAPI(title="音频质检标注系统")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup_event():
    init_db()
    os.makedirs("exports", exist_ok=True)

def add_time_line(db: Session, audio_record_id: int, event_type: str, event_description: str, operator: str):
    time_line = TimeLine(
        audio_record_id=audio_record_id,
        event_type=event_type,
        event_description=event_description,
        operator=operator
    )
    db.add(time_line)
    db.commit()

def update_statistics(db: Session):
    today = date.today().strftime("%Y-%m-%d")
    stats = db.query(QualityStatistics).filter(QualityStatistics.date == today).first()
    
    if not stats:
        stats = QualityStatistics(date=today)
        db.add(stats)
    
    total = db.query(func.count(AudioRecord.id)).filter(func.date(AudioRecord.created_at) == today).scalar() or 0
    success = db.query(func.count(AudioRecord.id)).filter(
        func.date(AudioRecord.created_at) == today,
        AudioRecord.status == "success"
    ).scalar() or 0
    blocked = db.query(func.count(AudioRecord.id)).filter(
        func.date(AudioRecord.created_at) == today,
        AudioRecord.status == "blocked"
    ).scalar() or 0
    compensation = db.query(func.count(AudioRecord.id)).filter(
        func.date(AudioRecord.created_at) == today,
        AudioRecord.status == "compensation"
    ).scalar() or 0
    manual = db.query(func.count(AudioRecord.id)).filter(
        func.date(AudioRecord.created_at) == today,
        AudioRecord.status == "manual_review"
    ).scalar() or 0
    
    avg_conf = db.query(func.avg(QualityCheck.confidence)).filter(
        func.date(QualityCheck.checked_at) == today
    ).scalar() or 0.0
    
    stats.total_count = total
    stats.success_count = success
    stats.blocked_count = blocked
    stats.compensation_count = compensation
    stats.manual_review_count = manual
    stats.avg_confidence = float(avg_conf)
    
    db.commit()

@app.post("/api/audio/", response_model=AudioRecordResponse)
def create_audio_record(record: AudioRecordCreate, db: Session = Depends(get_db)):
    db_record = AudioRecord(**record.dict())
    db.add(db_record)
    db.commit()
    db.refresh(db_record)
    
    add_time_line(db, db_record.id, "create", "创建音频记录", "system")
    update_statistics(db)
    
    return db_record

@app.get("/api/audio/", response_model=List[AudioRecordResponse])
def list_audio_records(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(AudioRecord)
    if status:
        query = query.filter(AudioRecord.status == status)
    records = query.order_by(AudioRecord.created_at.desc()).offset(skip).limit(limit).all()
    return records

@app.get("/api/audio/{record_id}", response_model=AudioRecordDetail)
def get_audio_record(record_id: int, db: Session = Depends(get_db)):
    record = db.query(AudioRecord).filter(AudioRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")
    return record

@app.put("/api/audio/{record_id}", response_model=AudioRecordResponse)
def update_audio_record(record_id: int, update: AudioRecordUpdate, db: Session = Depends(get_db)):
    record = db.query(AudioRecord).filter(AudioRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")
    
    old_noise_tags = record.noise_tags
    
    for key, value in update.dict(exclude_unset=True).items():
        setattr(record, key, value)
    
    db.commit()
    db.refresh(record)
    
    if update.noise_tags is not None and old_noise_tags != update.noise_tags:
        add_time_line(db, record_id, "update_noise_tags", f"噪声标签从 [{old_noise_tags}] 更新为 [{update.noise_tags}]", "system")
        recalculate_quality_check(db, record_id)
    
    update_statistics(db)
    return record

def recalculate_quality_check(db: Session, record_id: int):
    record = db.query(AudioRecord).filter(AudioRecord.id == record_id).first()
    if not record or not record.noise_tags:
        return
    
    noise_tags = record.noise_tags.split(",") if record.noise_tags else []
    has_critical_noise = any(tag in ["背景杂音", "人声重叠", "音频断裂"] for tag in noise_tags)
    
    check = QualityCheck(
        audio_record_id=record_id,
        check_type="auto_recalculate",
        result="blocked" if has_critical_noise else "success",
        error_reason="检测到关键噪声标签" if has_critical_noise else None,
        confidence=0.95 if has_critical_noise else 0.85,
        operator="system"
    )
    db.add(check)
    db.commit()

@app.post("/api/quality-flow/")
def process_quality_flow(request: QualityFlowRequest, db: Session = Depends(get_db)):
    record = db.query(AudioRecord).filter(AudioRecord.id == request.audio_record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")
    
    flow_map = {
        "success": ("质检通过", "success"),
        "blocked": ("质检拦截", "blocked"),
        "compensation": ("补偿处理", "compensation"),
        "manual_review": ("人工复核", "manual_review")
    }
    
    if request.flow_type not in flow_map:
        raise HTTPException(status_code=400, detail="无效的流程类型")
    
    desc, status = flow_map[request.flow_type]
    record.status = status
    
    quality_check = QualityCheck(
        audio_record_id=request.audio_record_id,
        check_type=request.flow_type,
        result=status,
        error_reason=request.error_reason,
        confidence=1.0,
        operator=request.operator
    )
    db.add(quality_check)
    
    approval = ApprovalRecord(
        audio_record_id=request.audio_record_id,
        action=request.flow_type,
        approver=request.operator,
        comment=request.comment
    )
    db.add(approval)
    
    add_time_line(db, request.audio_record_id, request.flow_type, f"{desc}: {request.comment or '无'}", request.operator)
    
    db.commit()
    update_statistics(db)
    
    return {"message": "处理成功", "status": status}

@app.get("/api/statistics/", response_model=List[StatisticsResponse])
def get_statistics(days: int = 7, db: Session = Depends(get_db)):
    stats = db.query(QualityStatistics).order_by(QualityStatistics.date.desc()).limit(days).all()
    return stats

@app.post("/api/export/")
def export_records(request: ExportRequest, db: Session = Depends(get_db)):
    query = db.query(AudioRecord)
    
    if request.start_date:
        query = query.filter(AudioRecord.created_at >= datetime.fromisoformat(request.start_date))
    if request.end_date:
        query = query.filter(AudioRecord.created_at <= datetime.fromisoformat(request.end_date))
    if request.status:
        query = query.filter(AudioRecord.status == request.status)
    
    records = query.all()
    
    data = []
    for record in records:
        data.append({
            "ID": record.id,
            "文件名": record.filename,
            "时长": record.duration,
            "转写文本": record.transcription,
            "噪声标签": record.noise_tags,
            "状态": record.status,
            "抽检比例": record.sampling_rate,
            "创建时间": record.created_at.strftime("%Y-%m-%d %H:%M:%S")
        })
    
    df = pd.DataFrame(data)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"audio_quality_export_{timestamp}.xlsx"
    file_path = f"exports/{filename}"
    
    df.to_excel(file_path, index=False, engine="openpyxl")
    
    export_record = ExportRecord(
        filename=filename,
        export_type=request.export_type,
        record_count=len(records),
        exported_by=request.exported_by,
        file_path=file_path
    )
    db.add(export_record)
    db.commit()
    
    return {"message": "导出成功", "filename": filename, "count": len(records)}

@app.get("/api/exports/")
def list_exports(db: Session = Depends(get_db)):
    exports = db.query(ExportRecord).order_by(ExportRecord.exported_at.desc()).all()
    return exports

@app.get("/api/exports/{filename}")
def download_export(filename: str):
    file_path = f"exports/{filename}"
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="文件不存在")
    return FileResponse(file_path, filename=filename)

@app.get("/api/timeline/{record_id}", response_model=List[TimeLineResponse])
def get_timeline(record_id: int, db: Session = Depends(get_db)):
    timelines = db.query(TimeLine).filter(TimeLine.audio_record_id == record_id).order_by(TimeLine.created_at.desc()).all()
    return timelines

@app.get("/api/approvals/{record_id}", response_model=List[ApprovalRecordResponse])
def get_approvals(record_id: int, db: Session = Depends(get_db)):
    approvals = db.query(ApprovalRecord).filter(ApprovalRecord.audio_record_id == record_id).order_by(ApprovalRecord.approved_at.desc()).all()
    return approvals

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
