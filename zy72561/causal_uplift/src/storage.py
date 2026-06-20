import json
import os
from typing import Dict, Any, Optional

from .models import (
    PipelineState,
    CandidateRecord,
    RecordStatus,
    ConflictEvidence,
    ReviewAction,
    ReviewRole,
    ExplainableSummary,
)


STATE_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "output", "state")
os.makedirs(STATE_DIR, exist_ok=True)
DEFAULT_STATE_PATH = os.path.join(STATE_DIR, "pipeline_state.json")


def _restore_record(d: Dict[str, Any]) -> CandidateRecord:
    return CandidateRecord(
        sample_id=d["sample_id"],
        user_id=d["user_id"],
        scene=d["scene"],
        uplift_score=float(d["uplift_score"]),
        features=d.get("features", {}),
        feature_missing=bool(d.get("feature_missing", False)),
        default_score_applied=bool(d.get("default_score_applied", False)),
        status=RecordStatus(d["status"]),
        caliber_source=d.get("caliber_source", "online"),
        imported_at=d.get("imported_at", ""),
        raw_data=d.get("raw_data", {}),
    )


def _restore_conflict(d: Dict[str, Any]) -> ConflictEvidence:
    return ConflictEvidence(
        sample_id=d["sample_id"],
        field_name=d["field_name"],
        candidate_table_value=d["candidate_table_value"],
        yaml_value=d["yaml_value"],
        description=d["description"],
    )


def _restore_action(d: Dict[str, Any]) -> ReviewAction:
    return ReviewAction(
        sample_id=d["sample_id"],
        role=ReviewRole(d["role"]),
        actor=d["actor"],
        action=d["action"],
        reason=d["reason"],
        timestamp=d.get("timestamp", ""),
        before_status=RecordStatus(d["before_status"]) if d.get("before_status") else None,
        after_status=RecordStatus(d["after_status"]) if d.get("after_status") else None,
        field_changes=d.get("field_changes", {}),
    )


def _restore_summary(d: Dict[str, Any]) -> ExplainableSummary:
    return ExplainableSummary(
        sample_id=d["sample_id"],
        status=RecordStatus(d["status"]),
        summary_text=d["summary_text"],
        score_breakdown=d.get("score_breakdown", {}),
        data_sources=d.get("data_sources", []),
        review_history_refs=d.get("review_history_refs", []),
        updated_at=d.get("updated_at", ""),
    )


def save_state(state: PipelineState, path: Optional[str] = None) -> str:
    target = path or DEFAULT_STATE_PATH
    os.makedirs(os.path.dirname(target), exist_ok=True)
    payload = {
        "records": {sid: r.to_dict() for sid, r in state.records.items()},
        "conflicts": {
            sid: [e.to_dict() for e in evs] for sid, evs in state.conflicts.items()},
        "review_history": [a.to_dict() for a in state.review_history],
        "summaries": {sid: s.to_dict() for sid, s in state.summaries.items()},
    }
    with open(target, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    return target


def load_state(path: Optional[str] = None) -> PipelineState:
    target = path or DEFAULT_STATE_PATH
    if not os.path.exists(target):
        return PipelineState()
    with open(target, "r", encoding="utf-8") as f:
        payload = json.load(f)
    state = PipelineState()
    for sid, d in payload.get("records", {}).items():
        state.records[sid] = _restore_record(d)
    for sid, evs in payload.get("conflicts", {}).items():
        state.conflicts[sid] = [_restore_conflict(e) for e in evs]
    state.review_history = [_restore_action(a) for a in payload.get("review_history", [])]
    for sid, d in payload.get("summaries", {}).items():
        state.summaries[sid] = _restore_summary(d)
    return state


def clear_state(path: Optional[str] = None) -> None:
    target = path or DEFAULT_STATE_PATH
    if os.path.exists(target):
        os.remove(target)
