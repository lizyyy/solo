from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple
import json
import hashlib

from .models import (
    Tenant, UsageMetric, Incident, AnomalyWindow, AttributionClue,
    ActionItem, IncidentSummary, IncidentStatus, ClueSource
)
from . import schemas

def generate_incident_key(tenant_id: str, metric_name: str, window_start: datetime) -> str:
    key_string = f"{tenant_id}:{metric_name}:{window_start.isoformat()}"
    return hashlib.md5(key_string.encode()).hexdigest()

def get_or_create_tenant(db: Session, tenant_data: schemas.TenantCreate) -> Tenant:
    tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_data.tenant_id).first()
    if tenant:
        return tenant
    tenant = Tenant(
        tenant_id=tenant_data.tenant_id,
        name=tenant_data.name,
        email=tenant_data.email
    )
    db.add(tenant)
    db.commit()
    db.refresh(tenant)
    return tenant

def detect_anomaly_window(
    db: Session,
    tenant_id: int,
    metric_name: str,
    start_time: datetime,
    end_time: datetime,
    threshold_percent: float = 50.0
) -> Tuple[bool, Optional[Dict]]:
    metrics = db.query(UsageMetric).filter(
        UsageMetric.tenant_id == tenant_id,
        UsageMetric.metric_name == metric_name,
        UsageMetric.timestamp >= start_time,
        UsageMetric.timestamp <= end_time
    ).order_by(UsageMetric.timestamp).all()
    
    if not metrics:
        return False, None
    
    values = [m.metric_value for m in metrics]
    baseline = sum(values) / len(values) if values else 0
    
    if baseline == 0:
        return False, None
    
    peak = max(values)
    deviation = ((peak - baseline) / baseline) * 100
    
    if deviation >= threshold_percent:
        severity = "critical" if deviation >= 200 else "high" if deviation >= 100 else "medium"
        return True, {
            "peak_value": peak,
            "baseline_value": baseline,
            "deviation_percent": deviation,
            "severity": severity
        }
    
    return False, None

def merge_clues(db: Session, incident_id: int, new_clues: List[Dict]) -> List[AttributionClue]:
    existing_clues = db.query(AttributionClue).filter(
        AttributionClue.incident_id == incident_id
    ).all()
    existing_keys = {c.clue_key for c in existing_clues}
    
    merged = []
    for clue_data in new_clues:
        clue_key = clue_data.get("clue_key")
        if clue_key and clue_key in existing_keys:
            continue
        
        clue = AttributionClue(
            incident_id=incident_id,
            clue_key=clue_key or hashlib.md5(json.dumps(clue_data).encode()).hexdigest(),
            source=clue_data.get("source", ClueSource.CORRELATION),
            title=clue_data.get("title", "Unknown Clue"),
            description=clue_data.get("description"),
            confidence=clue_data.get("confidence", 0.0),
            raw_data=json.dumps(clue_data.get("raw_data", {}))
        )
        db.add(clue)
        merged.append(clue)
    
    db.commit()
    return merged

def create_incident(
    db: Session,
    incident_data: schemas.IncidentCreate,
    original_input: str
) -> Incident:
    tenant = get_or_create_tenant(db, incident_data.tenant)
    
    incident_key = generate_incident_key(
        incident_data.tenant.tenant_id,
        incident_data.metric_name,
        incident_data.window_start
    )
    
    existing_incident = db.query(Incident).filter(
        Incident.incident_key == incident_key
    ).first()
    if existing_incident:
        return existing_incident
    
    is_anomaly, anomaly_info = detect_anomaly_window(
        db,
        tenant.id,
        incident_data.metric_name,
        incident_data.window_start,
        incident_data.window_end,
        incident_data.threshold_percent
    )
    
    incident = Incident(
        tenant_id=tenant.id,
        incident_key=incident_key,
        title=incident_data.title or f"Anomaly detected for {incident_data.metric_name}",
        description=incident_data.description,
        status=IncidentStatus.DETECTED if is_anomaly else IncidentStatus.ANALYZING,
        severity=anomaly_info.get("severity", "medium") if anomaly_info else "low",
        original_input=original_input,
        processing_result=json.dumps({
            "is_anomaly": is_anomaly,
            "anomaly_info": anomaly_info
        })
    )
    db.add(incident)
    db.commit()
    db.refresh(incident)
    
    if is_anomaly and anomaly_info:
        usage_metric = UsageMetric(
            tenant_id=tenant.id,
            metric_name=incident_data.metric_name,
            metric_value=anomaly_info["peak_value"],
            unit=incident_data.unit or "requests",
            timestamp=incident_data.window_end,
            baseline_value=anomaly_info["baseline_value"],
            deviation_percent=anomaly_info["deviation_percent"]
        )
        db.add(usage_metric)
        db.commit()
        db.refresh(usage_metric)
        
        anomaly_window = AnomalyWindow(
            incident_id=incident.id,
            usage_metric_id=usage_metric.id,
            window_start=incident_data.window_start,
            window_end=incident_data.window_end,
            peak_value=anomaly_info["peak_value"],
            baseline_value=anomaly_info["baseline_value"],
            deviation_percent=anomaly_info["deviation_percent"],
            severity=anomaly_info["severity"]
        )
        db.add(anomaly_window)
        db.commit()
    
    if incident_data.attribution_clues:
        merge_clues(db, incident.id, incident_data.attribution_clues)
    
    return incident

def get_incident(db: Session, incident_id: int) -> Optional[Incident]:
    return db.query(Incident).filter(Incident.id == incident_id).first()

def get_incident_by_key(db: Session, incident_key: str) -> Optional[Incident]:
    return db.query(Incident).filter(Incident.incident_key == incident_key).first()

def list_incidents(
    db: Session,
    tenant_id: Optional[str] = None,
    status: Optional[IncidentStatus] = None,
    skip: int = 0,
    limit: int = 100
) -> List[Incident]:
    query = db.query(Incident)
    if tenant_id:
        query = query.join(Tenant).filter(Tenant.tenant_id == tenant_id)
    if status:
        query = query.filter(Incident.status == status)
    return query.order_by(Incident.detected_at.desc()).offset(skip).limit(limit).all()

def update_incident_status(
    db: Session,
    incident_id: int,
    new_status: IncidentStatus,
    comment: Optional[str] = None
) -> Optional[Incident]:
    incident = get_incident(db, incident_id)
    if not incident:
        return None
    
    incident.status = new_status
    
    now = datetime.utcnow()
    if new_status == IncidentStatus.CONFIRMED:
        incident.confirmed_at = now
    elif new_status == IncidentStatus.RESOLVED:
        incident.resolved_at = now
    elif new_status == IncidentStatus.CLOSED:
        incident.closed_at = now
    
    db.commit()
    db.refresh(incident)
    return incident

def add_attribution_clue(
    db: Session,
    incident_id: int,
    clue_data: schemas.AttributionClueCreate
) -> Optional[AttributionClue]:
    incident = get_incident(db, incident_id)
    if not incident:
        return None
    
    clues = merge_clues(db, incident_id, [clue_data.model_dump()])
    return clues[0] if clues else None

def add_action_item(
    db: Session,
    incident_id: int,
    action_data: schemas.ActionItemCreate
) -> Optional[ActionItem]:
    incident = get_incident(db, incident_id)
    if not incident:
        return None
    
    action = ActionItem(
        incident_id=incident_id,
        clue_id=action_data.clue_id,
        action_type=action_data.action_type,
        description=action_data.description,
        owner=action_data.owner,
        status="pending"
    )
    db.add(action)
    db.commit()
    db.refresh(action)
    return action

def manual_correction(
    db: Session,
    incident_id: int,
    correction_data: schemas.ManualCorrection
) -> Optional[Incident]:
    incident = get_incident(db, incident_id)
    if not incident:
        return None
    
    if correction_data.severity:
        incident.severity = correction_data.severity
    
    if correction_data.title:
        incident.title = correction_data.title
    
    if correction_data.description:
        incident.description = correction_data.description
    
    if correction_data.processing_result:
        current_result = json.loads(incident.processing_result or "{}")
        current_result.update(correction_data.processing_result)
        current_result["manually_corrected"] = True
        current_result["correction_comment"] = correction_data.comment
        incident.processing_result = json.dumps(current_result)
    
    for window in incident.anomaly_windows:
        if correction_data.baseline_adjustment is not None:
            new_baseline = window.baseline_value * (1 + correction_data.baseline_adjustment / 100)
            new_deviation = ((window.peak_value - new_baseline) / new_baseline) * 100
            window.baseline_value = new_baseline
            window.deviation_percent = new_deviation
    
    db.commit()
    db.refresh(incident)
    
    if correction_data.reclaculate:
        reclaculate_incident(db, incident_id)
    
    return incident

def reclaculate_incident(db: Session, incident_id: int) -> Optional[Incident]:
    incident = get_incident(db, incident_id)
    if not incident:
        return None
    
    for window in incident.anomaly_windows:
        metric = db.query(UsageMetric).filter(
            UsageMetric.id == window.usage_metric_id
        ).first()
        if metric:
            metric.baseline_value = window.baseline_value
            metric.deviation_percent = window.deviation_percent
    
    db.commit()
    db.refresh(incident)
    return incident

def export_incident_summary(
    db: Session,
    incident_id: int
) -> Optional[Dict]:
    incident = get_incident(db, incident_id)
    if not incident:
        return None
    
    summary = incident.summary
    if not summary:
        summary = IncidentSummary(
            incident_id=incident_id,
            root_cause="",
            impact_assessment="",
            resolution_summary="",
            lessons_learned=""
        )
        db.add(summary)
        db.commit()
        db.refresh(summary)
    
    summary.exported_at = datetime.utcnow()
    db.commit()
    
    return {
        "incident_id": incident.id,
        "incident_key": incident.incident_key,
        "tenant": {
            "tenant_id": incident.tenant.tenant_id,
            "name": incident.tenant.name
        },
        "title": incident.title,
        "description": incident.description,
        "status": incident.status,
        "severity": incident.severity,
        "timeline": {
            "detected_at": incident.detected_at,
            "confirmed_at": incident.confirmed_at,
            "resolved_at": incident.resolved_at,
            "closed_at": incident.closed_at
        },
        "anomaly_windows": [
            {
                "window_start": w.window_start,
                "window_end": w.window_end,
                "peak_value": w.peak_value,
                "baseline_value": w.baseline_value,
                "deviation_percent": w.deviation_percent,
                "severity": w.severity
            }
            for w in incident.anomaly_windows
        ],
        "attribution_clues": [
            {
                "source": c.source,
                "title": c.title,
                "description": c.description,
                "confidence": c.confidence,
                "is_manual": c.is_manual
            }
            for c in incident.attribution_clues
        ],
        "action_items": [
            {
                "action_type": a.action_type,
                "description": a.description,
                "owner": a.owner,
                "status": a.status,
                "created_at": a.created_at,
                "completed_at": a.completed_at
            }
            for a in incident.action_items
        ],
        "summary": {
            "root_cause": summary.root_cause,
            "impact_assessment": summary.impact_assessment,
            "resolution_summary": summary.resolution_summary,
            "lessons_learned": summary.lessons_learned,
            "exported_at": summary.exported_at
        },
        "original_input": incident.original_input,
        "processing_result": json.loads(incident.processing_result) if incident.processing_result else {}
    }

def update_summary(
    db: Session,
    incident_id: int,
    summary_data: schemas.IncidentSummaryUpdate
) -> Optional[IncidentSummary]:
    incident = get_incident(db, incident_id)
    if not incident:
        return None
    
    summary = incident.summary
    if not summary:
        summary = IncidentSummary(incident_id=incident_id)
        db.add(summary)
    
    if summary_data.root_cause is not None:
        summary.root_cause = summary_data.root_cause
    if summary_data.impact_assessment is not None:
        summary.impact_assessment = summary_data.impact_assessment
    if summary_data.resolution_summary is not None:
        summary.resolution_summary = summary_data.resolution_summary
    if summary_data.lessons_learned is not None:
        summary.lessons_learned = summary_data.lessons_learned
    
    db.commit()
    db.refresh(summary)
    return summary
