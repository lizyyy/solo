from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy.orm import Session
from datetime import datetime
import json
import io
import csv
from typing import List, Optional

from models import Base, Announcement, AnnouncementVersion, Confirmation, Withdrawal
from schemas import (
    AnnouncementCreate, AnnouncementResponse, AnnouncementVersionResponse,
    ConfirmationCreate, ConfirmationResponse, SupplementCreate,
    WithdrawalCreate, ManualCorrection, ConfirmationReportItem, ErrorLogResponse
)
from database import engine, get_db, log_audit

Base.metadata.create_all(bind=engine)

app = FastAPI(title="内部公告版本API", version="1.0.0")

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    body = await request.body()
    try:
        body_json = json.loads(body) if body else None
    except:
        body_json = body.decode() if body else None
    
    db = next(get_db())
    log_audit(
        db,
        operation_type="EXCEPTION",
        original_input={"url": str(request.url), "method": request.method, "body": body_json},
        error_message=str(exc),
        operator=None,
        ip_address=request.client.host if request.client else None
    )
    
    return JSONResponse(
        status_code=500,
        content={"detail": "服务器内部错误", "error": str(exc)}
    )

@app.post("/announcements", response_model=AnnouncementResponse, tags=["公告管理"])
async def create_announcement(announcement: AnnouncementCreate, request: Request, db: Session = Depends(get_db)):
    try:
        existing = db.query(Announcement).filter(Announcement.announcement_no == announcement.announcement_no).first()
        if existing:
            log_audit(
                db,
                operation_type="CREATE_ANNOUNCEMENT",
                original_input=announcement.model_dump(),
                error_message="公告编号已存在",
                operator=announcement.created_by,
                ip_address=request.client.host if request.client else None
            )
            raise HTTPException(status_code=400, detail="公告编号已存在")
        
        new_announcement = Announcement(
            announcement_no=announcement.announcement_no,
            title=announcement.title,
            created_by=announcement.created_by
        )
        db.add(new_announcement)
        db.flush()
        
        first_version = AnnouncementVersion(
            announcement_id=new_announcement.id,
            version=1,
            content=announcement.content,
            created_by=announcement.created_by
        )
        db.add(first_version)
        db.commit()
        db.refresh(new_announcement)
        
        result = {
            **new_announcement.__dict__,
            "latest_version": 1
        }
        
        log_audit(
            db,
            operation_type="CREATE_ANNOUNCEMENT",
            original_input=announcement.model_dump(),
            processing_result={"announcement_id": new_announcement.id, "version": 1},
            operator=announcement.created_by
        )
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        log_audit(
            db,
            operation_type="CREATE_ANNOUNCEMENT",
            original_input=announcement.model_dump(),
            error_message=str(e),
            operator=announcement.created_by
        )
        raise

@app.get("/announcements", response_model=List[AnnouncementResponse], tags=["公告管理"])
async def list_announcements(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    announcements = db.query(Announcement).offset(skip).limit(limit).all()
    result = []
    for a in announcements:
        latest_version = max(v.version for v in a.versions) if a.versions else 0
        result.append({**a.__dict__, "latest_version": latest_version})
    return result

@app.get("/announcements/{announcement_no}", tags=["公告管理"])
async def get_announcement(announcement_no: str, db: Session = Depends(get_db)):
    announcement = db.query(Announcement).filter(Announcement.announcement_no == announcement_no).first()
    if not announcement:
        raise HTTPException(status_code=404, detail="公告不存在")
    
    latest_version = max(v.version for v in announcement.versions) if announcement.versions else 0
    versions = [
        {
            "id": v.id,
            "version": v.version,
            "content": v.content,
            "created_at": v.created_at,
            "created_by": v.created_by,
            "supplement": v.supplement,
            "supplement_by": v.supplement_by,
            "supplement_at": v.supplement_at
        } for v in announcement.versions
    ]
    
    confirmations = [
        {
            "id": c.id,
            "version": c.version.version,
            "confirmer_id": c.confirmer_id,
            "confirmer_name": c.confirmer_name,
            "confirmed_at": c.confirmed_at,
            "remark": c.remark
        } for c in announcement.confirmations
    ]
    
    withdrawals = [
        {
            "id": w.id,
            "version": w.version_id,
            "withdrawn_by": w.withdrawn_by,
            "withdrawn_at": w.withdrawn_at,
            "reason": w.reason
        } for w in announcement.withdrawals
    ]
    
    return {
        "announcement_no": announcement.announcement_no,
        "title": announcement.title,
        "created_at": announcement.created_at,
        "created_by": announcement.created_by,
        "is_active": announcement.is_active,
        "latest_version": latest_version,
        "versions": versions,
        "confirmations": confirmations,
        "withdrawals": withdrawals
    }

@app.post("/announcements/{announcement_no}/versions", tags=["公告管理"])
async def create_new_version(announcement_no: str, content: str, created_by: str, request: Request, db: Session = Depends(get_db)):
    announcement = db.query(Announcement).filter(Announcement.announcement_no == announcement_no).first()
    if not announcement:
        raise HTTPException(status_code=404, detail="公告不存在")
    
    latest_version = max(v.version for v in announcement.versions) if announcement.versions else 0
    new_version = AnnouncementVersion(
        announcement_id=announcement.id,
        version=latest_version + 1,
        content=content,
        created_by=created_by
    )
    db.add(new_version)
    db.commit()
    db.refresh(new_version)
    
    log_audit(
        db,
        operation_type="CREATE_VERSION",
        original_input={"announcement_no": announcement_no, "content": content, "created_by": created_by},
        processing_result={"version": new_version.version},
        operator=created_by,
        ip_address=request.client.host if request.client else None
    )
    
    return {
        "announcement_no": announcement_no,
        "version": new_version.version,
        "created_at": new_version.created_at
    }

@app.post("/confirmations", response_model=ConfirmationResponse, tags=["确认管理"])
async def confirm_announcement(confirmation: ConfirmationCreate, request: Request, db: Session = Depends(get_db)):
    try:
        announcement = db.query(Announcement).filter(Announcement.announcement_no == confirmation.announcement_no).first()
        if not announcement:
            log_audit(
                db,
                operation_type="CONFIRM_ANNOUNCEMENT",
                original_input=confirmation.model_dump(),
                error_message="公告不存在",
                operator=confirmation.confirmer_id
            )
            raise HTTPException(status_code=404, detail="公告不存在")
        
        version = db.query(AnnouncementVersion).filter(
            AnnouncementVersion.announcement_id == announcement.id,
            AnnouncementVersion.version == confirmation.version
        ).first()
        if not version:
            log_audit(
                db,
                operation_type="CONFIRM_ANNOUNCEMENT",
                original_input=confirmation.model_dump(),
                error_message="版本不存在",
                operator=confirmation.confirmer_id
            )
            raise HTTPException(status_code=404, detail="版本不存在")
        
        existing_confirmation = db.query(Confirmation).filter(
            Confirmation.announcement_id == announcement.id,
            Confirmation.version_id == version.id,
            Confirmation.confirmer_id == confirmation.confirmer_id
        ).first()
        if existing_confirmation:
            log_audit(
                db,
                operation_type="CONFIRM_ANNOUNCEMENT",
                original_input=confirmation.model_dump(),
                error_message="该用户已确认过此版本",
                operator=confirmation.confirmer_id
            )
            raise HTTPException(status_code=400, detail="该用户已确认过此版本")
        
        new_confirmation = Confirmation(
            announcement_id=announcement.id,
            version_id=version.id,
            confirmer_id=confirmation.confirmer_id,
            confirmer_name=confirmation.confirmer_name,
            remark=confirmation.remark or ""
        )
        db.add(new_confirmation)
        db.commit()
        db.refresh(new_confirmation)
        
        log_audit(
            db,
            operation_type="CONFIRM_ANNOUNCEMENT",
            original_input=confirmation.model_dump(),
            processing_result={"confirmation_id": new_confirmation.id},
            operator=confirmation.confirmer_id,
            ip_address=request.client.host if request.client else None
        )
        
        return {
            "id": new_confirmation.id,
            "announcement_no": announcement.announcement_no,
            "version": version.version,
            "confirmer_id": new_confirmation.confirmer_id,
            "confirmer_name": new_confirmation.confirmer_name,
            "confirmed_at": new_confirmation.confirmed_at,
            "remark": new_confirmation.remark
        }
        
    except HTTPException:
        raise
    except Exception as e:
        log_audit(
            db,
            operation_type="CONFIRM_ANNOUNCEMENT",
            original_input=confirmation.model_dump(),
            error_message=str(e),
            operator=confirmation.confirmer_id
        )
        raise

@app.post("/supplements", tags=["补充说明"])
async def add_supplement(supplement: SupplementCreate, request: Request, db: Session = Depends(get_db)):
    announcement = db.query(Announcement).filter(Announcement.announcement_no == supplement.announcement_no).first()
    if not announcement:
        raise HTTPException(status_code=404, detail="公告不存在")
    
    version = db.query(AnnouncementVersion).filter(
        AnnouncementVersion.announcement_id == announcement.id,
        AnnouncementVersion.version == supplement.version
    ).first()
    if not version:
        raise HTTPException(status_code=404, detail="版本不存在")
    
    version.supplement = supplement.supplement
    version.supplement_by = supplement.supplement_by
    version.supplement_at = datetime.utcnow()
    db.commit()
    
    log_audit(
        db,
        operation_type="ADD_SUPPLEMENT",
        original_input=supplement.model_dump(),
        processing_result={"version_id": version.id},
        operator=supplement.supplement_by,
        ip_address=request.client.host if request.client else None
    )
    
    return {
        "announcement_no": supplement.announcement_no,
        "version": supplement.version,
        "supplement": supplement.supplement,
        "supplement_at": version.supplement_at
    }

@app.post("/withdrawals", tags=["撤回管理"])
async def withdraw_announcement(withdrawal: WithdrawalCreate, request: Request, db: Session = Depends(get_db)):
    announcement = db.query(Announcement).filter(Announcement.announcement_no == withdrawal.announcement_no).first()
    if not announcement:
        raise HTTPException(status_code=404, detail="公告不存在")
    
    if withdrawal.version:
        version = db.query(AnnouncementVersion).filter(
            AnnouncementVersion.announcement_id == announcement.id,
            AnnouncementVersion.version == withdrawal.version
        ).first()
        if not version:
            raise HTTPException(status_code=404, detail="版本不存在")
        
        w = Withdrawal(
            announcement_id=announcement.id,
            version_id=version.id,
            withdrawn_by=withdrawal.withdrawn_by,
            reason=withdrawal.reason
        )
        db.add(w)
    else:
        announcement.is_active = False
        for version in announcement.versions:
            w = Withdrawal(
                announcement_id=announcement.id,
                version_id=version.id,
                withdrawn_by=withdrawal.withdrawn_by,
                reason=withdrawal.reason
            )
            db.add(w)
    
    db.commit()
    
    log_audit(
        db,
        operation_type="WITHDRAW_ANNOUNCEMENT",
        original_input=withdrawal.model_dump(),
        processing_result={"announcement_id": announcement.id},
        operator=withdrawal.withdrawn_by,
        ip_address=request.client.host if request.client else None
    )
    
    return {"status": "success", "message": "撤回成功"}

@app.post("/manual-correction", tags=["人工修正"])
async def manual_correction(correction: ManualCorrection, request: Request, db: Session = Depends(get_db)):
    announcement = db.query(Announcement).filter(Announcement.announcement_no == correction.announcement_no).first()
    if not announcement:
        raise HTTPException(status_code=404, detail="公告不存在")
    
    version = db.query(AnnouncementVersion).filter(
        AnnouncementVersion.announcement_id == announcement.id,
        AnnouncementVersion.version == correction.version
    ).first()
    if not version:
        raise HTTPException(status_code=404, detail="版本不存在")
    
    changes = {}
    if correction.new_content is not None:
        changes["old_content"] = version.content
        version.content = correction.new_content
        changes["new_content"] = correction.new_content
    
    if correction.new_supplement is not None:
        changes["old_supplement"] = version.supplement
        version.supplement = correction.new_supplement
        changes["new_supplement"] = correction.new_supplement
    
    db.commit()
    
    log_audit(
        db,
        operation_type="MANUAL_CORRECTION",
        original_input={**correction.model_dump(), **changes},
        processing_result={"version_id": version.id},
        operator=correction.correction_by,
        ip_address=request.client.host if request.client else None
    )
    
    return {
        "status": "success",
        "announcement_no": correction.announcement_no,
        "version": correction.version,
        "changes_applied": list(changes.keys())
    }

@app.get("/reports/confirmations", tags=["报告导出"])
async def get_confirmation_report(announcement_no: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Confirmation).join(Announcement).join(AnnouncementVersion)
    
    if announcement_no:
        query = query.filter(Announcement.announcement_no == announcement_no)
    
    confirmations = query.all()
    withdrawn_version_ids = set(w.version_id for w in db.query(Withdrawal).all())
    
    result = []
    for c in confirmations:
        result.append(ConfirmationReportItem(
            announcement_no=c.announcement.announcement_no,
            title=c.announcement.title,
            version=c.version.version,
            confirmer_id=c.confirmer_id,
            confirmer_name=c.confirmer_name,
            confirmed_at=c.confirmed_at,
            remark=c.remark,
            is_withdrawn=c.version_id in withdrawn_version_ids
        ))
    
    return result

@app.get("/reports/confirmations/export", tags=["报告导出"])
async def export_confirmation_report(announcement_no: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Confirmation).join(Announcement).join(AnnouncementVersion)
    
    if announcement_no:
        query = query.filter(Announcement.announcement_no == announcement_no)
    
    confirmations = query.all()
    withdrawn_version_ids = set(w.version_id for w in db.query(Withdrawal).all())
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["公告编号", "标题", "版本", "确认人ID", "确认人姓名", "确认时间", "备注", "是否撤回"])
    
    for c in confirmations:
        writer.writerow([
            c.announcement.announcement_no,
            c.announcement.title,
            c.version.version,
            c.confirmer_id,
            c.confirmer_name,
            c.confirmed_at.isoformat(),
            c.remark,
            "是" if c.version_id in withdrawn_version_ids else "否"
        ])
    
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=confirmation_report_{datetime.now().strftime('%Y%m%d')}.csv"}
    )

@app.get("/audit-logs", response_model=List[ErrorLogResponse], tags=["审计日志"])
async def get_audit_logs(operation_type: Optional[str] = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    from models import AuditLog
    query = db.query(AuditLog)
    if operation_type:
        query = query.filter(AuditLog.operation_type == operation_type)
    
    logs = query.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()
    return logs

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
