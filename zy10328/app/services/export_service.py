import json
import pandas as pd
from datetime import datetime
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from io import BytesIO

from app.models.schema import EntryAPI, DownstreamService, CallSample, HistoryRecord


def export_to_json(db: Session, entry_api_id: str, include_samples: bool = True, include_history: bool = True) -> Dict[str, Any]:
    entry_api = db.query(EntryAPI).filter(EntryAPI.id == entry_api_id).first()
    if not entry_api:
        raise ValueError(f"Entry API with id {entry_api_id} not found")
    
    result = {
        "entry_api": {
            "id": entry_api.id,
            "name": entry_api.name,
            "method": entry_api.method,
            "path": entry_api.path,
            "description": entry_api.description,
            "status": entry_api.status,
            "risk_level": entry_api.risk_level,
            "risk_description": entry_api.risk_description,
            "created_at": entry_api.created_at.isoformat(),
            "updated_at": entry_api.updated_at.isoformat()
        },
        "export_metadata": {
            "exported_at": datetime.utcnow().isoformat(),
            "format": "json",
            "version": "1.0"
        }
    }
    
    services = db.query(DownstreamService).filter(DownstreamService.entry_api_id == entry_api_id).all()
    result["downstream_services"] = [
        {
            "id": s.id,
            "service_name": s.service_name,
            "service_type": s.service_type,
            "endpoint": s.endpoint,
            "method": s.method,
            "cache_key": s.cache_key,
            "call_count": s.call_count,
            "success_count": s.success_count,
            "failure_count": s.failure_count,
            "avg_latency": s.avg_latency,
            "p50_latency": s.p50_latency,
            "p95_latency": s.p95_latency,
            "p99_latency": s.p99_latency,
            "risk_level": s.risk_level,
            "risk_description": s.risk_description
        } for s in services
    ]
    
    if include_samples:
        samples = db.query(CallSample).filter(CallSample.entry_api_id == entry_api_id).all()
        result["call_samples"] = [
            {
                "id": s.id,
                "trace_id": s.trace_id,
                "request_id": s.request_id,
                "user_id": s.user_id,
                "timestamp": s.timestamp.isoformat(),
                "status": s.status,
                "total_latency": s.total_latency,
                "category": s.category,
                "error_message": s.error_message,
                "downstream_calls": s.downstream_calls
            } for s in samples
        ]
    
    if include_history:
        history = db.query(HistoryRecord).filter(HistoryRecord.entry_api_id == entry_api_id).order_by(HistoryRecord.created_at).all()
        result["history_records"] = [
            {
                "id": h.id,
                "action": h.action,
                "operator": h.operator,
                "previous_status": h.previous_status,
                "new_status": h.new_status,
                "change_reason": h.change_reason,
                "created_at": h.created_at.isoformat()
            } for h in history
        ]
    
    return result


def export_to_excel(db: Session, entry_api_id: str, include_samples: bool = True, include_history: bool = True) -> BytesIO:
    json_data = export_to_json(db, entry_api_id, include_samples, include_history)
    
    output = BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        pd.DataFrame([json_data["entry_api"]]).to_excel(writer, sheet_name='概要', index=False)
        
        services_df = pd.DataFrame(json_data["downstream_services"])
        services_df.to_excel(writer, sheet_name='下游服务', index=False)
        
        if include_samples and json_data.get("call_samples"):
            samples_df = pd.DataFrame(json_data["call_samples"])
            samples_df.to_excel(writer, sheet_name='调用样本', index=False)
        
        if include_history and json_data.get("history_records"):
            history_df = pd.DataFrame(json_data["history_records"])
            history_df.to_excel(writer, sheet_name='历史记录', index=False)
    
    output.seek(0)
    return output


def get_profile_summary(db: Session, entry_api_id: str) -> Dict[str, Any]:
    entry_api = db.query(EntryAPI).filter(EntryAPI.id == entry_api_id).first()
    if not entry_api:
        raise ValueError(f"Entry API with id {entry_api_id} not found")
    
    samples = db.query(CallSample).filter(CallSample.entry_api_id == entry_api_id).all()
    services = db.query(DownstreamService).filter(DownstreamService.entry_api_id == entry_api_id).all()
    
    total_samples = len(samples)
    success_samples = sum(1 for s in samples if s.status == "SUCCESS")
    failed_samples = total_samples - success_samples
    
    avg_latency = sum(s.total_latency for s in samples) / total_samples if total_samples > 0 else 0
    
    return {
        "entry_api_id": entry_api_id,
        "total_samples": total_samples,
        "success_samples": success_samples,
        "failed_samples": failed_samples,
        "avg_total_latency": avg_latency,
        "downstream_count": len(services),
        "overall_risk_level": entry_api.risk_level,
        "status": entry_api.status
    }
