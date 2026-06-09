from __future__ import annotations

from typing import Any, Dict, List, Optional

from .engine import ThermalRunawayEngine
from .models import ProcessingStatus
from .result_store import ResultStore
from .workflow import Workflow


def create_api_response(
    initial_rows: Optional[List[Dict[str, Any]]] = None,
    csv_text: Optional[str] = None,
    photo_attachments: Optional[List[Dict[str, Any]]] = None,
    unit_conversions: Optional[List[Dict[str, Any]]] = None,
    supplement_rows: Optional[List[Dict[str, Any]]] = None,
    amendments: Optional[List[Dict[str, Any]]] = None,
    manual_reviews: Optional[List[Dict[str, Any]]] = None,
    operator: str = "api",
    thresholds: Optional[Dict[str, float]] = None,
    source_name: str = "",
) -> Dict[str, Any]:
    engine = ThermalRunawayEngine(thresholds=thresholds, operator=operator)
    store = ResultStore(engine)
    workflow = Workflow(engine, store)

    result = workflow.run_full_workflow(
        initial_rows=initial_rows,
        csv_text=csv_text,
        photo_attachments=photo_attachments or [],
        unit_conversions=unit_conversions or [],
        supplement_rows=supplement_rows,
        amendments=amendments,
        manual_reviews=manual_reviews,
        source_name=source_name,
    )

    api_data = store.to_api_response()
    page_data = store.to_page_display()
    summary = store.to_summary()

    evidence: List[Dict[str, Any]] = []
    for r in store.get_over_threshold_results():
        photo_evidence = [
            {
                "path": p.photo_path,
                "description": p.description,
                "attached_by": p.attached_by,
                "attached_at": p.attached_at,
                "attached_to_original_row": p.attached_to_original_row,
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
        dec = r.review_decision
        decision = None
        if dec is not None:
            decision = {
                "original_value": dec.original_value,
                "amended_value": dec.amended_value,
                "original_statement": dec.original_statement,
                "amended_reason": dec.amended_reason,
                "next_reviewer": dec.next_reviewer,
                "decided_at": dec.decided_at,
                "decided_by": dec.decided_by,
            }
        evidence.append({
            "sensor_id": r.sensor_id,
            "original_row": r.original_row,
            "original_import_value": r.original_import_value,
            "current_value": r.raw_value,
            "display_value": r.display_value,
            "threshold": r.threshold,
            "average_value": r.average_value,
            "status": r.status.value,
            "is_over_threshold": r.is_over_threshold,
            "suppressed_by_average": r.suppressed_by_average,
            "amended_value": r.amended_value,
            "amendment_note": r.amendment_note,
            "next_reviewer": r.next_reviewer,
            "review_decision": decision,
            "photo_evidence": photo_evidence,
            "audit_evidence": audit_evidence,
        })

    return {
        "summary": summary,
        "warning_result": api_data,
        "page_display": page_data,
        "evidence_summary": evidence,
        "workflow_log": workflow.workflow_log,
        "consistency_note": (
            "summary、warning_result、page_display、evidence_summary 均来自同一份 "
            "ResultStore.build_warning_results() 结果，被平均值盖掉的记录 suppressed_by_average=True "
            "且 is_over_threshold=True，在所有视图下均不会丢失。"
        ),
    }
