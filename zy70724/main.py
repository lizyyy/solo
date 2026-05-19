from datetime import datetime, timedelta
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Text, Boolean, ForeignKey, JSON as SQLJSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
from sqlalchemy.sql import func
import json

DATABASE_URL = "sqlite:///./sandbox_cleanup.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class CleanupStatus(str, Enum):
    PENDING = "pending"
    INVENTORY_DONE = "inventory_done"
    PRESERVATION_CHECKED = "preservation_checked"
    READY_FOR_CLEANUP = "ready_for_cleanup"
    CLEANUP_IN_PROGRESS = "cleanup_in_progress"
    CLEANUP_DONE = "cleanup_done"
    CANCELLED = "cancelled"
    REVOKED = "revoked"


class PreservationTag(str, Enum):
    NONE = "none"
    UNDER_INVESTIGATION = "under_investigation"
    EVIDENCE = "evidence"
    PENDING_REVIEW = "pending_review"


class SandboxCleanup(Base):
    __tablename__ = "sandbox_cleanup"
    id = Column(Integer, primary_key=True, index=True)
    sandbox_id = Column(String(64), unique=True, index=True)
    status = Column(String(32), default=CleanupStatus.PENDING)
    preservation_tag = Column(String(32), default=PreservationTag.NONE)
    resource_inventory = Column(SQLJSON)
    cleanup_plan = Column(SQLJSON)
    cleanup_summary = Column(SQLJSON)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    planned_cleanup_at = Column(DateTime)
    handler = Column(String(128))
    notes = Column(Text)
    revoke_reason = Column(Text)
    revoked_by = Column(String(128))
    revoked_at = Column(DateTime)
    exception_path = Column(SQLJSON)
    audit_logs = relationship("AuditLog", back_populates="cleanup")


class AuditLog(Base):
    __tablename__ = "audit_log"
    id = Column(Integer, primary_key=True, index=True)
    cleanup_id = Column(Integer, ForeignKey("sandbox_cleanup.id"))
    action = Column(String(64))
    old_status = Column(String(32))
    new_status = Column(String(32))
    operator = Column(String(128))
    reason = Column(Text)
    original_input = Column(SQLJSON)
    conclusion = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    cleanup = relationship("SandboxCleanup", back_populates="audit_logs")


Base.metadata.create_all(bind=engine)


app = FastAPI(title="沙箱资源清理保全拦截API", version="1.0.0")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class ResourceItem(BaseModel):
    resource_type: str
    resource_id: str
    size: Optional[int] = None
    metadata: Optional[dict] = None


class CleanupCreate(BaseModel):
    sandbox_id: str
    resources: List[ResourceItem]
    planned_cleanup_at: Optional[datetime] = None
    preservation_tag: PreservationTag = PreservationTag.NONE
    handler: Optional[str] = None
    notes: Optional[str] = None


class CleanupResponse(BaseModel):
    id: int
    sandbox_id: str
    status: CleanupStatus
    preservation_tag: PreservationTag
    resource_inventory: dict
    cleanup_plan: Optional[dict] = None
    cleanup_summary: Optional[dict] = None
    created_at: datetime
    updated_at: datetime
    planned_cleanup_at: Optional[datetime] = None
    handler: Optional[str] = None
    notes: Optional[str] = None
    revoke_reason: Optional[str] = None
    revoked_by: Optional[str] = None
    revoked_at: Optional[datetime] = None


class StatusUpdate(BaseModel):
    new_status: CleanupStatus
    operator: str
    reason: Optional[str] = None
    original_input: Optional[dict] = None
    conclusion: Optional[str] = None


class PreservationUpdate(BaseModel):
    preservation_tag: PreservationTag
    operator: str
    reason: Optional[str] = None
    original_input: Optional[dict] = None
    conclusion: Optional[str] = None


class RevokeRequest(BaseModel):
    reason: str
    operator: str
    original_input: Optional[dict] = None
    conclusion: Optional[str] = None


class CleanupPlanUpdate(BaseModel):
    cleanup_plan: dict
    operator: str
    reason: Optional[str] = None


class CleanupSummaryUpdate(BaseModel):
    cleanup_summary: dict
    operator: str


def create_audit_log(db: Session, cleanup_id: int, action: str, old_status: str, new_status: str, operator: str, reason: str = None, original_input: dict = None, conclusion: str = None):
    audit_log = AuditLog(
        cleanup_id=cleanup_id,
        action=action,
        old_status=old_status,
        new_status=new_status,
        operator=operator,
        reason=reason,
        original_input=original_input,
        conclusion=conclusion
    )
    db.add(audit_log)
    db.commit()


@app.post("/api/cleanup", response_model=CleanupResponse)
def create_cleanup(cleanup: CleanupCreate, db: Session = Depends(get_db)):
    existing = db.query(SandboxCleanup).filter(SandboxCleanup.sandbox_id == cleanup.sandbox_id).first()
    if existing:
        if existing.status not in [CleanupStatus.CLEANUP_DONE, CleanupStatus.CANCELLED, CleanupStatus.REVOKED]:
            raise HTTPException(status_code=409, detail=f"沙箱 {cleanup.sandbox_id} 已有进行中的清理任务")
    
    resource_dict = {
        "total_count": len(cleanup.resources),
        "resources": [r.model_dump() for r in cleanup.resources],
        "total_size": sum(r.size or 0 for r in cleanup.resources)
    }
    
    db_cleanup = SandboxCleanup(
        sandbox_id=cleanup.sandbox_id,
        status=CleanupStatus.PENDING,
        preservation_tag=cleanup.preservation_tag,
        resource_inventory=resource_dict,
        planned_cleanup_at=cleanup.planned_cleanup_at or (datetime.utcnow() + timedelta(days=7)),
        handler=cleanup.handler,
        notes=cleanup.notes
    )
    db.add(db_cleanup)
    db.commit()
    db.refresh(db_cleanup)
    
    create_audit_log(
        db, db_cleanup.id, "CREATE",
        None, CleanupStatus.PENDING,
        cleanup.handler or "system",
        reason=cleanup.notes,
        original_input=cleanup.model_dump()
    )
    
    return db_cleanup


@app.get("/api/cleanup", response_model=List[CleanupResponse])
def list_cleanups(
    status: Optional[CleanupStatus] = None,
    preservation_tag: Optional[PreservationTag] = None,
    sandbox_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(SandboxCleanup)
    if status:
        query = query.filter(SandboxCleanup.status == status)
    if preservation_tag:
        query = query.filter(SandboxCleanup.preservation_tag == preservation_tag)
    if sandbox_id:
        query = query.filter(SandboxCleanup.sandbox_id.contains(sandbox_id))
    return query.offset(skip).limit(limit).all()


@app.get("/api/cleanup/{cleanup_id}", response_model=CleanupResponse)
def get_cleanup(cleanup_id: int, db: Session = Depends(get_db)):
    cleanup = db.query(SandboxCleanup).filter(SandboxCleanup.id == cleanup_id).first()
    if not cleanup:
        raise HTTPException(status_code=404, detail="清理任务不存在")
    return cleanup


@app.patch("/api/cleanup/{cleanup_id}/status", response_model=CleanupResponse)
def update_status(cleanup_id: int, update: StatusUpdate, db: Session = Depends(get_db)):
    cleanup = db.query(SandboxCleanup).filter(SandboxCleanup.id == cleanup_id).first()
    if not cleanup:
        raise HTTPException(status_code=404, detail="清理任务不存在")
    
    if cleanup.status in [CleanupStatus.CLEANUP_DONE, CleanupStatus.CANCELLED, CleanupStatus.REVOKED]:
        raise HTTPException(status_code=400, detail="已终止的任务不可修改状态")
    
    valid_transitions = {
        CleanupStatus.PENDING: [CleanupStatus.INVENTORY_DONE, CleanupStatus.CANCELLED],
        CleanupStatus.INVENTORY_DONE: [CleanupStatus.PRESERVATION_CHECKED, CleanupStatus.CANCELLED],
        CleanupStatus.PRESERVATION_CHECKED: [CleanupStatus.READY_FOR_CLEANUP, CleanupStatus.CANCELLED],
        CleanupStatus.READY_FOR_CLEANUP: [CleanupStatus.CLEANUP_IN_PROGRESS, CleanupStatus.CANCELLED, CleanupStatus.REVOKED],
        CleanupStatus.CLEANUP_IN_PROGRESS: [CleanupStatus.CLEANUP_DONE, CleanupStatus.CANCELLED],
    }
    
    if update.new_status not in valid_transitions.get(cleanup.status, []):
        raise HTTPException(
            status_code=400,
            detail=f"无效的状态转换: {cleanup.status} -> {update.new_status}"
        )
    
    if cleanup.preservation_tag != PreservationTag.NONE and update.new_status in [CleanupStatus.READY_FOR_CLEANUP, CleanupStatus.CLEANUP_IN_PROGRESS]:
        raise HTTPException(
            status_code=403,
            detail=f"沙箱处于保全状态 ({cleanup.preservation_tag})，禁止进入清理流程"
        )
    
    old_status = cleanup.status
    cleanup.status = update.new_status
    
    create_audit_log(
        db, cleanup.id, "STATUS_UPDATE",
        old_status, update.new_status,
        update.operator,
        reason=update.reason,
        original_input=update.original_input,
        conclusion=update.conclusion
    )
    
    db.commit()
    db.refresh(cleanup)
    return cleanup


@app.patch("/api/cleanup/{cleanup_id}/preservation", response_model=CleanupResponse)
def update_preservation(cleanup_id: int, update: PreservationUpdate, db: Session = Depends(get_db)):
    cleanup = db.query(SandboxCleanup).filter(SandboxCleanup.id == cleanup_id).first()
    if not cleanup:
        raise HTTPException(status_code=404, detail="清理任务不存在")
    
    if cleanup.status in [CleanupStatus.CLEANUP_DONE, CleanupStatus.CANCELLED, CleanupStatus.REVOKED]:
        raise HTTPException(status_code=400, detail="已终止的任务不可修改保全标签")
    
    old_tag = cleanup.preservation_tag
    cleanup.preservation_tag = update.preservation_tag
    
    if update.preservation_tag != PreservationTag.NONE:
        if cleanup.status == CleanupStatus.READY_FOR_CLEANUP:
            cleanup.status = CleanupStatus.PRESERVATION_CHECKED
        elif cleanup.status == CleanupStatus.CLEANUP_IN_PROGRESS:
            raise HTTPException(status_code=400, detail="清理进行中无法设置保全，请先撤销清理")
    
    create_audit_log(
        db, cleanup.id, "PRESERVATION_UPDATE",
        old_tag, update.preservation_tag,
        update.operator,
        reason=update.reason,
        original_input=update.original_input,
        conclusion=update.conclusion
    )
    
    db.commit()
    db.refresh(cleanup)
    return cleanup


@app.patch("/api/cleanup/{cleanup_id}/revoke", response_model=CleanupResponse)
def revoke_cleanup(cleanup_id: int, revoke: RevokeRequest, db: Session = Depends(get_db)):
    cleanup = db.query(SandboxCleanup).filter(SandboxCleanup.id == cleanup_id).first()
    if not cleanup:
        raise HTTPException(status_code=404, detail="清理任务不存在")
    
    if cleanup.status not in [CleanupStatus.READY_FOR_CLEANUP, CleanupStatus.PRESERVATION_CHECKED]:
        raise HTTPException(status_code=400, detail="仅在准备清理或保全检查状态可撤销")
    
    old_status = cleanup.status
    cleanup.status = CleanupStatus.REVOKED
    cleanup.revoke_reason = revoke.reason
    cleanup.revoked_by = revoke.operator
    cleanup.revoked_at = datetime.utcnow()
    
    create_audit_log(
        db, cleanup.id, "REVOKE",
        old_status, CleanupStatus.REVOKED,
        revoke.operator,
        reason=revoke.reason,
        original_input=revoke.original_input,
        conclusion=revoke.conclusion
    )
    
    db.commit()
    db.refresh(cleanup)
    return cleanup


@app.patch("/api/cleanup/{cleanup_id}/cancel", response_model=CleanupResponse)
def cancel_cleanup(cleanup_id: int, revoke: RevokeRequest, db: Session = Depends(get_db)):
    cleanup = db.query(SandboxCleanup).filter(SandboxCleanup.id == cleanup_id).first()
    if not cleanup:
        raise HTTPException(status_code=404, detail="清理任务不存在")
    
    if cleanup.status in [CleanupStatus.CLEANUP_DONE, CleanupStatus.CANCELLED, CleanupStatus.REVOKED]:
        raise HTTPException(status_code=400, detail="任务已终止")
    
    old_status = cleanup.status
    cleanup.status = CleanupStatus.CANCELLED
    cleanup.revoke_reason = revoke.reason
    cleanup.revoked_by = revoke.operator
    cleanup.revoked_at = datetime.utcnow()
    
    create_audit_log(
        db, cleanup.id, "CANCEL",
        old_status, CleanupStatus.CANCELLED,
        revoke.operator,
        reason=revoke.reason,
        original_input=revoke.original_input,
        conclusion=revoke.conclusion
    )
    
    db.commit()
    db.refresh(cleanup)
    return cleanup


@app.patch("/api/cleanup/{cleanup_id}/plan", response_model=CleanupResponse)
def update_cleanup_plan(cleanup_id: int, update: CleanupPlanUpdate, db: Session = Depends(get_db)):
    cleanup = db.query(SandboxCleanup).filter(SandboxCleanup.id == cleanup_id).first()
    if not cleanup:
        raise HTTPException(status_code=404, detail="清理任务不存在")
    
    if cleanup.status in [CleanupStatus.CLEANUP_DONE, CleanupStatus.CANCELLED, CleanupStatus.REVOKED]:
        raise HTTPException(status_code=400, detail="已终止的任务不可修改计划")
    
    cleanup.cleanup_plan = update.cleanup_plan
    
    create_audit_log(
        db, cleanup.id, "PLAN_UPDATE",
        cleanup.status, cleanup.status,
        update.operator,
        reason=update.reason
    )
    
    db.commit()
    db.refresh(cleanup)
    return cleanup


@app.patch("/api/cleanup/{cleanup_id}/summary", response_model=CleanupResponse)
def update_cleanup_summary(cleanup_id: int, update: CleanupSummaryUpdate, db: Session = Depends(get_db)):
    cleanup = db.query(SandboxCleanup).filter(SandboxCleanup.id == cleanup_id).first()
    if not cleanup:
        raise HTTPException(status_code=404, detail="清理任务不存在")
    
    if cleanup.status != CleanupStatus.CLEANUP_IN_PROGRESS:
        raise HTTPException(status_code=400, detail="仅清理进行中可设置摘要")
    
    cleanup.cleanup_summary = update.cleanup_summary
    cleanup.status = CleanupStatus.CLEANUP_DONE
    
    create_audit_log(
        db, cleanup.id, "SUMMARY_UPDATE",
        CleanupStatus.CLEANUP_IN_PROGRESS, CleanupStatus.CLEANUP_DONE,
        update.operator
    )
    
    db.commit()
    db.refresh(cleanup)
    return cleanup


@app.get("/api/cleanup/{cleanup_id}/audit")
def get_audit_logs(cleanup_id: int, db: Session = Depends(get_db)):
    logs = db.query(AuditLog).filter(AuditLog.cleanup_id == cleanup_id).order_by(AuditLog.created_at.desc()).all()
    return [
        {
            "id": log.id,
            "action": log.action,
            "old_status": log.old_status,
            "new_status": log.new_status,
            "operator": log.operator,
            "reason": log.reason,
            "original_input": log.original_input,
            "conclusion": log.conclusion,
            "created_at": log.created_at
        }
        for log in logs
    ]


@app.get("/api/export/cleanup")
def export_cleanups(
    status: Optional[CleanupStatus] = None,
    preservation_tag: Optional[PreservationTag] = None,
    db: Session = Depends(get_db)
):
    query = db.query(SandboxCleanup)
    if status:
        query = query.filter(SandboxCleanup.status == status)
    if preservation_tag:
        query = query.filter(SandboxCleanup.preservation_tag == preservation_tag)
    
    cleanups = query.all()
    
    export_data = []
    for c in cleanups:
        audit_logs = db.query(AuditLog).filter(AuditLog.cleanup_id == c.id).all()
        export_data.append({
            "id": c.id,
            "sandbox_id": c.sandbox_id,
            "status": c.status,
            "preservation_tag": c.preservation_tag,
            "resource_inventory": c.resource_inventory,
            "cleanup_plan": c.cleanup_plan,
            "cleanup_summary": c.cleanup_summary,
            "created_at": c.created_at.isoformat(),
            "updated_at": c.updated_at.isoformat(),
            "planned_cleanup_at": c.planned_cleanup_at.isoformat() if c.planned_cleanup_at else None,
            "handler": c.handler,
            "notes": c.notes,
            "revoke_reason": c.revoke_reason,
            "revoked_by": c.revoked_by,
            "revoked_at": c.revoked_at.isoformat() if c.revoked_at else None,
            "audit_count": len(audit_logs),
            "audit_logs": [
                {
                    "action": log.action,
                    "old_status": log.old_status,
                    "new_status": log.new_status,
                    "operator": log.operator,
                    "reason": log.reason,
                    "original_input": log.original_input,
                    "conclusion": log.conclusion,
                    "created_at": log.created_at.isoformat()
                }
                for log in audit_logs
            ]
        })
    
    return JSONResponse(content={
        "export_time": datetime.utcnow().isoformat(),
        "total_count": len(export_data),
        "data": export_data
    })


@app.get("/api/stats")
def get_stats(db: Session = Depends(get_db)):
    stats = {}
    for status in CleanupStatus:
        count = db.query(SandboxCleanup).filter(SandboxCleanup.status == status).count()
        stats[status.value] = count
    
    preservation_stats = {}
    for tag in PreservationTag:
        count = db.query(SandboxCleanup).filter(SandboxCleanup.preservation_tag == tag).count()
        preservation_stats[tag.value] = count
    
    return {
        "by_status": stats,
        "by_preservation": preservation_stats
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
