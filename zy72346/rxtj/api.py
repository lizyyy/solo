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
)
from .rules import AnnotationSource, ReviewStatus, BOUNDARY_RULES, DENOMINATOR_ZERO_ACTIONS


app = FastAPI(title="容斥统计优惠叠加 API", version="0.1.0")

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


@app.post("/import")
def api_import(req: ImportRequest):
    store = _get_store()
    source = AnnotationSource(req.source)
    rows = [r.dict() for r in req.rows]
    result = import_annotations(store, rows, source, changed_by=req.operator)

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
            "flagged_details": [
                {
                    "annotation_id": a.id,
                    "original_line_number": a.original_line_number,
                    "item_name": a.item_name,
                    "edge_case_type": a.edge_case_type,
                    "original_value": a.original_value,
                    "current_value": a.current_value,
                    "source": a.source.value,
                }
                for a in result.flagged
            ],
        },
    }


@app.post("/workflow/step1")
def api_workflow_step1(req: WorkflowStep1Request):
    store = _get_store()
    rows = [r.dict() for r in req.rows]
    result, state = step1_import_annotations(store, rows, changed_by=req.operator)

    return {
        "step": "import_annotations",
        "next_step": "review_sampling",
        "import_result": {
            "batch": result.batch.to_dict(),
            "changes": [ch.to_dict() for ch in result.changes],
            "flagged": [a.to_dict() for a in result.flagged],
        },
        "state": {
            "current_step": state.current_step,
            "annotation_count": state.annotation_count,
            "sampling_count": state.sampling_count,
            "flagged_count": state.flagged_count,
        },
        "evidence_summary": {
            "flagged_details": [
                {
                    "annotation_id": a.id,
                    "original_line_number": a.original_line_number,
                    "item_name": a.item_name,
                    "edge_case_type": a.edge_case_type,
                    "original_value": a.original_value,
                    "current_value": a.current_value,
                }
                for a in result.flagged
            ],
        },
    }


@app.post("/workflow/step2")
def api_workflow_step2(req: WorkflowStep2Request):
    store = _get_store()
    rows = [r.dict() for r in req.sampling_rows]
    conflict_changes, state = step2_review_sampling(store, rows, changed_by=req.operator)

    return {
        "step": "review_sampling",
        "next_step": "update_demo",
        "conflict_changes": [ch.to_dict() for ch in conflict_changes],
        "state": {
            "current_step": state.current_step,
            "annotation_count": state.annotation_count,
            "sampling_count": state.sampling_count,
            "flagged_count": state.flagged_count,
        },
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

    return {
        "step": "update_demo",
        "results": [r.to_dict() for r in results],
        "state": {
            "current_step": state.current_step,
            "annotation_count": state.annotation_count,
            "sampling_count": state.sampling_count,
            "flagged_count": state.flagged_count,
        },
        "evidence_summary": {
            "results_with_evidence": [
                {
                    "item_name": r.item_name,
                    "category": r.category,
                    "value": r.value,
                    "was_edge_case": r.was_edge_case,
                    "edge_case_type": r.edge_case_type,
                    "status": r.status.value if isinstance(r.status, ReviewStatus) else r.status,
                    "evidence": r.evidence.to_dict() if r.evidence else None,
                }
                for r in results
            ],
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
    return {
        "annotations": [a.to_dict() for a in annotations],
        "count": len(annotations),
        "evidence_summary": {
            "total": len(annotations),
            "flagged": sum(1 for a in annotations if a.status == ReviewStatus.FLAGGED),
            "edge_cases": sum(1 for a in annotations if a.is_edge_case),
        },
    }


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
    rolled = store.rollback_batch(req.batch_id)
    return {
        "batch_id": req.batch_id,
        "rolled_back_records": rolled,
    }
