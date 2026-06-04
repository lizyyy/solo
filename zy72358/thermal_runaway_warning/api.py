from __future__ import annotations

from typing import Any, Dict, List, Optional

from .engine import ThermalRunawayEngine
from .models import ProcessingStatus
from .result_store import ResultStore
from .workflow import Workflow


def create_api_response(
    initial_rows: List[Dict[str, Any]],
    photo_attachments: Optional[List[Dict[str, str]]] = None,
    unit_conversions: Optional[List[Dict[str, Any]]] = None,
    supplement_rows: Optional[List[Dict[str, Any]]] = None,
    operator: str = "api",
    thresholds: Optional[Dict[str, float]] = None,
) -> Dict[str, Any]:
    engine = ThermalRunawayEngine(thresholds=thresholds, operator=operator)
    store = ResultStore(engine)
    workflow = Workflow(engine, store)

    result = workflow.run_full_workflow(
        initial_rows=initial_rows,
        photo_attachments=photo_attachments or [],
        unit_conversions=unit_conversions or [],
        supplement_rows=supplement_rows,
    )

    api_data = store.to_api_response()

    evidence: List[Dict[str, Any]] = []
    for r in store.get_over_threshold_results():
        photo_evidence = [
            {
                "path": p.photo_path,
                "description": p.description,
                "attached_by": p.attached_by,
                "attached_at": p.attached_at,
            }
            for p in r.photos
        ]
        audit_evidence = [
            {
                "timestamp": a.timestamp,
                "field": a.field_changed,
                "old_value": str(a.old_value),
                "new_value": str(a.new_value),
                "changed_by": a.changed_by,
                "reason": a.reason,
            }
            for a in r.audit_trail
        ]
        evidence.append({
            "sensor_id": r.sensor_id,
            "original_row": r.original_row,
            "raw_value": r.raw_value,
            "threshold": r.threshold,
            "status": r.status.value,
            "suppressed_by_average": r.suppressed_by_average,
            "photo_evidence": photo_evidence,
            "audit_evidence": audit_evidence,
        })

    return {
        "warning_result": api_data,
        "evidence_summary": evidence,
        "workflow_log": workflow.workflow_log,
    }
