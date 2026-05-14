from sqlalchemy.orm import Session
from datetime import datetime
import pandas as pd
import json
import os
from typing import Dict, Any, List

from ..models import OAuthSession, CallbackLog, TokenExchange, TimelineEvent, ExportRecord
from ..schemas import ExportRequest

EXPORT_DIR = "./exports"
os.makedirs(EXPORT_DIR, exist_ok=True)


def export_sessions(db: Session, export_request: ExportRequest) -> ExportRecord:
    filters = export_request.filters or {}
    query = db.query(OAuthSession)
    
    if filters.get("status_path"):
        query = query.filter(OAuthSession.status_path == filters["status_path"])
    
    sessions = query.all()
    
    data = []
    for session in sessions:
        callbacks = db.query(CallbackLog).filter(CallbackLog.session_id == session.id).all()
        token_exchanges = db.query(TokenExchange).filter(TokenExchange.session_id == session.id).all()
        
        data.append({
            "session_id": session.id,
            "state": session.state,
            "client_id": session.client_id,
            "redirect_uri": session.redirect_uri,
            "scope": session.scope,
            "status": session.status,
            "status_path": session.status_path,
            "error_message": session.error_message,
            "created_at": session.created_at.isoformat(),
            "updated_at": session.updated_at.isoformat(),
            "callback_count": len(callbacks),
            "token_exchange_count": len(token_exchanges)
        })
    
    return _save_export(db, data, export_request, "sessions")


def export_callbacks(db: Session, export_request: ExportRequest) -> ExportRecord:
    filters = export_request.filters or {}
    query = db.query(CallbackLog)
    
    if filters.get("session_id"):
        query = query.filter(CallbackLog.session_id == filters["session_id"])
    
    callbacks = query.all()
    
    data = []
    for cb in callbacks:
        data.append({
            "callback_id": cb.id,
            "session_id": cb.session_id,
            "state": cb.state,
            "code": cb.code,
            "error": cb.error,
            "error_description": cb.error_description,
            "query_params": json.dumps(cb.query_params) if cb.query_params else None,
            "received_at": cb.received_at.isoformat(),
            "ip_address": cb.ip_address,
            "user_agent": cb.user_agent
        })
    
    return _save_export(db, data, export_request, "callbacks")


def export_token_exchanges(db: Session, export_request: ExportRequest) -> ExportRecord:
    filters = export_request.filters or {}
    query = db.query(TokenExchange)
    
    if filters.get("session_id"):
        query = query.filter(TokenExchange.session_id == filters["session_id"])
    
    exchanges = query.all()
    
    data = []
    for te in exchanges:
        data.append({
            "exchange_id": te.id,
            "session_id": te.session_id,
            "state": te.state,
            "code": te.code,
            "grant_type": te.grant_type,
            "status_code": te.status_code,
            "success": te.success,
            "error": te.error,
            "error_description": te.error_description,
            "expires_in": te.expires_in,
            "token_type": te.token_type,
            "scope": te.scope,
            "requested_at": te.requested_at.isoformat(),
            "completed_at": te.completed_at.isoformat() if te.completed_at else None
        })
    
    return _save_export(db, data, export_request, "token_exchanges")


def export_timeline(db: Session, export_request: ExportRequest) -> ExportRecord:
    filters = export_request.filters or {}
    query = db.query(TimelineEvent)
    
    if filters.get("session_id"):
        query = query.filter(TimelineEvent.session_id == filters["session_id"])
    
    events = query.all()
    
    data = []
    for event in events:
        data.append({
            "event_id": event.id,
            "session_id": event.session_id,
            "event_type": event.event_type,
            "title": event.title,
            "description": event.description,
            "data": json.dumps(event.data) if event.data else None,
            "timestamp": event.timestamp.isoformat(),
            "status": event.status,
            "path": event.path
        })
    
    return _save_export(db, data, export_request, "timeline")


def export_full_report(db: Session, export_request: ExportRequest) -> ExportRecord:
    sessions = db.query(OAuthSession).all()
    
    data = []
    for session in sessions:
        callbacks = db.query(CallbackLog).filter(CallbackLog.session_id == session.id).all()
        token_exchanges = db.query(TokenExchange).filter(TokenExchange.session_id == session.id).all()
        timeline = db.query(TimelineEvent).filter(TimelineEvent.session_id == session.id).all()
        
        session_data = {
            "session_id": session.id,
            "state": session.state,
            "client_id": session.client_id,
            "redirect_uri": session.redirect_uri,
            "scope": session.scope,
            "status": session.status,
            "status_path": session.status_path,
            "error_message": session.error_message,
            "created_at": session.created_at.isoformat(),
            "updated_at": session.updated_at.isoformat(),
        }
        
        for i, cb in enumerate(callbacks):
            session_data[f"callback_{i}_state"] = cb.state
            session_data[f"callback_{i}_code"] = cb.code
            session_data[f"callback_{i}_error"] = cb.error
            session_data[f"callback_{i}_received_at"] = cb.received_at.isoformat()
        
        for i, te in enumerate(token_exchanges):
            session_data[f"token_{i}_success"] = te.success
            session_data[f"token_{i}_error"] = te.error
            session_data[f"token_{i}_requested_at"] = te.requested_at.isoformat()
        
        data.append(session_data)
    
    return _save_export(db, data, export_request, "full_report")


def _save_export(db: Session, data: List[Dict], export_request: ExportRequest, export_type: str) -> ExportRecord:
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{export_type}_{timestamp}.{export_request.format}"
    file_path = os.path.join(EXPORT_DIR, filename)
    
    df = pd.DataFrame(data)
    
    if export_request.format == "csv":
        df.to_csv(file_path, index=False, encoding='utf-8-sig')
    elif export_request.format == "xlsx":
        df.to_excel(file_path, index=False)
    elif export_request.format == "json":
        df.to_json(file_path, orient='records', force_ascii=False, indent=2)
    
    export_record = ExportRecord(
        export_type=export_type,
        format=export_request.format,
        filename=filename,
        file_path=file_path,
        filters=export_request.filters,
        record_count=len(data),
        created_at=datetime.utcnow(),
        created_by="system"
    )
    
    db.add(export_record)
    db.commit()
    db.refresh(export_record)
    
    return export_record


def get_export_records(db: Session, skip: int = 0, limit: int = 100) -> List[ExportRecord]:
    return db.query(ExportRecord).order_by(ExportRecord.created_at.desc()).offset(skip).limit(limit).all()


def get_export_file_path(export_id: int, db: Session) -> str:
    record = db.query(ExportRecord).filter(ExportRecord.id == export_id).first()
    if record and os.path.exists(record.file_path):
        return record.file_path
    return None
