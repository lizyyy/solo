from __future__ import annotations

from typing import Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from .store import Store
from .importer import import_annotations
from .workflow import (
    step1_import_annotations,
    step2_review_sampling,
    step3_update_demo,
    get_audit_trail,
    review_flagged_annotation,
    build_unified_report,
)
from .exporter import export_report_json, export_report_csv
from .rules import AnnotationSource, ReviewStatus, BOUNDARY_RULES, DENOMINATOR_ZERO_ACTIONS


app = FastAPI(title="容斥统计优惠叠加 API", version="0.2.0")

_store: Optional[Store] = None


def _get_store() -> Store:
    global _store
    if _store is None:
        _store = Store()
    return _store


class RowInput(BaseModel):
    line_number: int = 0
    item_name: str = ""
    category: str = ""
    value: str = ""
    denominator: str = ""
    numerator: str = ""


class ImportRequest(BaseModel):
    rows: list[RowInput]
    source: str = "teacher_annotation"
    operator: str = "system"


class WorkflowStep1Request(BaseModel):
    rows: list[RowInput]
    operator: str = "system"


class WorkflowStep2Request(BaseModel):
    sampling_rows: list[RowInput]
    operator: str = "coach"


class RollbackRequest(BaseModel):
    batch_id: str
    operator: str = "system"


class ReviewRequest(BaseModel):
    annotation_id: str
    corrected_value: str
    review_reason: str
    next_contact: str
    reviewed_by: str
    corrected_denominator: Optional[str] = None
    corrected_numerator: Optional[str] = None
    mark_as_pending_after: bool = False


@app.post("/import")
def api_import(req: ImportRequest):
    store = _get_store()
    source = AnnotationSource(req.source)
    rows = [r.dict() for r in req.rows]
    result = import_annotations(store, rows, source, changed_by=req.operator)

    flagged_details = [
        {
            "annotation_id": a.id,
            "original_line_number": a.original_line_number,
            "item_name": a.item_name,
            "category": a.category,
            "edge_case_type": a.edge_case_type,
            "original_statement": a.original_value,
            "original_value": a.original_value,
            "current_value": a.current_value,
            "source": a.source.value,
        }
        for a in result.flagged
    ]

    return {
        "batch": result.batch.to_dict(),
        "changes": [ch.to_dict() for ch in result.changes],
        "flagged": [a.to_dict() for a in result.flagged],
        "evidence_summary": {
            "batch_id": result.batch.id,
            "total_rows": result.batch.total_rows,
            "new_count": result.batch.new_count,
            "unchanged_count": result.batch.unchanged_count,
            "changed_count": result.batch.changed_count,
            "flagged_count": result.batch.flagged_count,
            "flagged_details": flagged_details,
        },
    }


@app.post("/workflow/step1")
def api_workflow_step1(req: WorkflowStep1Request):
    store = _get_store()
    rows = [r.dict() for r in req.rows]
    result, state = step1_import_annotations(store, rows, changed_by=req.operator)

    flagged_details = [
        {
            "annotation_id": a.id,
            "original_line_number": a.original_line_number,
            "item_name": a.item_name,
            "edge_case_type": a.edge_case_type,
            "original_statement": a.original_value,
            "original_value": a.original_value,
            "current_value": a.current_value,
        }
        for a in result.flagged
    ]

    return {
        "step": "import_annotations",
        "next_step": "review_sampling",
        "import_result": {
            "batch": result.batch.to_dict(),
            "changes": [ch.to_dict() for ch in result.changes],
            "flagged": [a.to_dict() for a in result.flagged],
        },
        "state": state.to_dict(),
        "evidence_summary": {"flagged_details": flagged_details},
    }


@app.post("/workflow/step2")
def api_workflow_step2(req: WorkflowStep2Request):
    store = _get_store()
    rows = [r.dict() for r in req.sampling_rows]
    conflict_changes, state = step2_review_sampling(store, rows, changed_by=req.operator)

    return {
        "step": "review_sampling",
        "next_step": "review_flagged_or_demo",
        "conflict_changes": [ch.to_dict() for ch in conflict_changes],
        "state": state.to_dict(),
        "evidence_summary": {
            "conflicts": [
                {
                    "annotation_id": ch.annotation_id,
                    "old_status": ch.old_value,
                    "new_status": ch.new_value,
                    "reason": ch.reason,
                    "changed_by": ch.changed_by,
                }
                for ch in conflict_changes
            ],
        },
    }


@app.post("/workflow/step3")
def api_workflow_step3():
    store = _get_store()
    results, state = step3_update_demo(store)

    results_with_evidence = []
    for r in results:
        ev = None
        if r.evidence:
            ev = r.evidence.to_dict()
        results_with_evidence.append({
            "item_name": r.item_name,
            "category": r.category,
            "value": r.value,
            "was_edge_case": r.was_edge_case,
            "edge_case_type": r.edge_case_type,
            "status": r.status.value if isinstance(r.status, ReviewStatus) else r.status,
            "evidence": ev,
        })

    return {
        "step": "update_demo",
        "results": [r.to_dict() for r in results],
        "state": state.to_dict(),
        "evidence_summary": {"results_with_evidence": results_with_evidence},
    }


@app.post("/review")
def api_review(req: ReviewRequest):
    store = _get_store()
    try:
        ann, changes = review_flagged_annotation(
            store=store,
            annotation_id=req.annotation_id,
            corrected_value=req.corrected_value,
            review_reason=req.review_reason,
            next_contact=req.next_contact,
            reviewed_by=req.reviewed_by,
            corrected_denominator=req.corrected_denominator,
            corrected_numerator=req.corrected_numerator,
            mark_as_pending_after=req.mark_as_pending_after,
        )
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {
        "annotation": ann.to_dict(),
        "changes": [c.to_dict() for c in changes],
        "evidence_summary": {
            "original_line_number": ann.original_line_number,
            "original_statement": ann.original_value,
            "corrected_value": ann.current_value,
            "review_reason": ann.review_reason,
            "next_contact": ann.next_contact,
            "reviewed_by": ann.reviewed_by,
            "reviewed_at": ann.reviewed_at,
            "new_status": ann.status.value,
        },
    }


@app.get("/audit/{annotation_id}")
def api_audit(annotation_id: str):
    store = _get_store()
    trail = get_audit_trail(store, annotation_id)
    if "error" in trail:
        raise HTTPException(status_code=404, detail=trail["error"])
    return trail


@app.get("/annotations")
def api_list_annotations(
    source: Optional[str] = None,
    status: Optional[str] = None,
):
    store = _get_store()
    src = AnnotationSource(source) if source else None
    st = ReviewStatus(status) if status else None
    annotations = store.list_annotations(status=st, source=src)
    flagged = sum(1 for a in annotations if a.status == ReviewStatus.FLAGGED)
    reviewed = sum(1 for a in annotations if a.status == ReviewStatus.REVIEWED)
    return {
        "annotations": [a.to_dict() for a in annotations],
        "count": len(annotations),
        "evidence_summary": {
            "total": len(annotations),
            "flagged": flagged,
            "reviewed": reviewed,
            "edge_cases": sum(1 for a in annotations if a.is_edge_case),
        },
    }


@app.get("/report")
def api_report():
    store = _get_store()
    return build_unified_report(store)


@app.get("/export")
def api_export(format: str = "json"):
    store = _get_store()
    if format == "json":
        data = export_report_json(store)
        media_type = "application/json"
        content_disposition = 'attachment; filename="rxtj_report.json"'
    elif format == "csv":
        data = export_report_csv(store)
        media_type = "text/csv"
        content_disposition = 'attachment; filename="rxtj_report.csv"'
    else:
        raise HTTPException(status_code=400, detail=f"未知格式: {format}. 可选 json / csv")

    from fastapi.responses import Response
    headers = {"Content-Disposition": content_disposition}
    return Response(content=data, media_type=media_type, headers=headers)


@app.get("/rules")
def api_rules():
    return {
        "boundary_rules": {
            k: {
                "description": v["description"],
                "policy": v["policy"].value if hasattr(v["policy"], "value") else str(v["policy"]),
                "auto_fix": v["auto_fix"],
                "rollback_on_conflict": v["rollback_on_conflict"],
                "evidence_required": v["evidence_required"],
            }
            for k, v in BOUNDARY_RULES.items()
        },
        "denominator_zero_actions": {
            k.value: v for k, v in DENOMINATOR_ZERO_ACTIONS.items()
        },
    }


@app.post("/rollback")
def api_rollback(req: RollbackRequest):
    store = _get_store()
    rolled, rollback_changes = store.rollback_batch(req.batch_id, changed_by=req.operator)
    return {
        "batch_id": req.batch_id,
        "rolled_back_records": rolled,
        "rollback_changes": [c.to_dict() for c in rollback_changes],
    }
