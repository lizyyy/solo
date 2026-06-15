from typing import Dict, Any, List, Tuple, Optional
from .models import (
    PipelineState,
    RecordStatus,
    ReviewAction,
    ReviewRole,
    ConflictEvidence,
)


def _append_action(
    state: PipelineState,
    sample_id: str,
    role: ReviewRole,
    actor: str,
    action: str,
    reason: str,
    before_status: RecordStatus,
    after_status: RecordStatus,
    field_changes: Optional[Dict[str, Any]] = None,
) -> None:
    state.review_history.append(
        ReviewAction(
            sample_id=sample_id,
            role=role,
            actor=actor,
            action=action,
            reason=reason,
            before_status=before_status,
            after_status=after_status,
            field_changes=field_changes or {},
        )
    )


def list_pending_items(
    state: PipelineState,
) -> Dict[str, List[Dict[str, Any]]]:
    buckets: Dict[str, List[Dict[str, Any]]] = {
        "experiment_platform": [],
        "recommend_lead": [],
    }
    for sample_id, record in state.records.items():
        if record.status in (
            RecordStatus.YAML_SUPPLEMENT_OLD_CALIBER,
            RecordStatus.CONFLICT_DETECTED,
        ):
            conflicts = [e.to_dict() for e in state.conflicts.get(sample_id, [])]
            buckets["experiment_platform"].append(
                {
                    "sample_id": sample_id,
                    "current_status": record.status.value,
                    "user_id": record.user_id,
                    "uplift_score": record.uplift_score,
                    "caliber_source": record.caliber_source,
                    "conflicts": conflicts,
                }
            )
        elif record.status == RecordStatus.PENDING_REVIEW:
            buckets["recommend_lead"].append(
                {
                    "sample_id": sample_id,
                    "current_status": record.status.value,
                    "user_id": record.user_id,
                    "uplift_score": record.uplift_score,
                    "feature_missing": record.feature_missing,
                    "default_score_applied": record.default_score_applied,
                }
            )
    return buckets


def experiment_owner_confirm(
    state: PipelineState,
    sample_id: str,
    actor: str,
    reason: str,
) -> Tuple[bool, Dict[str, Any]]:
    record = state.records.get(sample_id)
    if record is None:
        return False, {"error": f"sample_id={sample_id} 不存在"}
    if record.status not in (
        RecordStatus.YAML_SUPPLEMENT_OLD_CALIBER,
        RecordStatus.CONFLICT_DETECTED,
    ):
        return False, {
            "error": f"当前状态={record.status.value}，不需要实验平台负责人确认"
        }

    before = record.status
    field_changes: Dict[str, Any] = {
        "confirmed_caliber_source": record.caliber_source,
        "confirmed_uplift_score": record.uplift_score,
    }
    record.status = RecordStatus.CONFIRMED
    _append_action(
        state,
        sample_id=sample_id,
        role=ReviewRole.EXPERIMENT_PLATFORM,
        actor=actor,
        action="CONFIRM",
        reason=reason,
        before_status=before,
        after_status=RecordStatus.CONFIRMED,
        field_changes=field_changes,
    )
    return True, {
        "sample_id": sample_id,
        "before_status": before.value,
        "after_status": RecordStatus.CONFIRMED.value,
        "actor": actor,
        "reason": reason,
        "field_changes": field_changes,
    }


def experiment_owner_reject(
    state: PipelineState,
    sample_id: str,
    actor: str,
    reason: str,
    rollback_score: Optional[float] = None,
) -> Tuple[bool, Dict[str, Any]]:
    record = state.records.get(sample_id)
    if record is None:
        return False, {"error": f"sample_id={sample_id} 不存在"}
    if record.status not in (
        RecordStatus.YAML_SUPPLEMENT_OLD_CALIBER,
        RecordStatus.CONFLICT_DETECTED,
    ):
        return False, {
            "error": f"当前状态={record.status.value}，不需要实验平台负责人驳回"
        }

    before = record.status
    field_changes: Dict[str, Any] = {"rejected": True, "rollback_reason": reason}
    if rollback_score is not None:
        field_changes["old_uplift_score"] = record.uplift_score
        field_changes["rollback_uplift_score"] = rollback_score
        record.uplift_score = float(rollback_score)
    record.status = RecordStatus.REJECTED
    _append_action(
        state,
        sample_id=sample_id,
        role=ReviewRole.EXPERIMENT_PLATFORM,
        actor=actor,
        action="REJECT",
        reason=reason,
        before_status=before,
        after_status=RecordStatus.REJECTED,
        field_changes=field_changes,
    )
    return True, {
        "sample_id": sample_id,
        "before_status": before.value,
        "after_status": RecordStatus.REJECTED.value,
        "actor": actor,
        "reason": reason,
        "field_changes": field_changes,
    }


def recommend_lead_review(
    state: PipelineState,
    sample_id: str,
    actor: str,
    decision: str,
    reason: str,
    final_score: Optional[float] = None,
) -> Tuple[bool, Dict[str, Any]]:
    record = state.records.get(sample_id)
    if record is None:
        return False, {"error": f"sample_id={sample_id} 不存在"}
    if record.status != RecordStatus.PENDING_REVIEW:
        return False, {
            "error": f"当前状态={record.status.value}，不是待推荐负责人复核状态"
        }

    before = record.status
    decision = decision.upper()
    field_changes: Dict[str, Any] = {}
    if decision == "ACCEPT_DEFAULT":
        after = RecordStatus.REVIEW_COMPLETED
        field_changes["decision"] = "accept_default_score"
    elif decision == "OVERRIDE":
        if final_score is None:
            return False, {"error": "OVERRIDE 需要指定 final_score"}
        after = RecordStatus.REVIEW_COMPLETED
        field_changes["decision"] = "override"
        field_changes["old_score"] = record.uplift_score
        field_changes["new_score"] = float(final_score)
        record.uplift_score = float(final_score)
        record.default_score_applied = False
    else:
        return False, {"error": f"decision={decision} 不合法，可选 ACCEPT_DEFAULT / OVERRIDE"}

    record.feature_missing = True
    record.status = after
    _append_action(
        state,
        sample_id=sample_id,
        role=ReviewRole.RECOMMEND_LEAD,
        actor=actor,
        action=f"REVIEW_{decision}",
        reason=reason,
        before_status=before,
        after_status=after,
        field_changes=field_changes,
    )
    return True, {
        "sample_id": sample_id,
        "before_status": before.value,
        "after_status": after.value,
        "actor": actor,
        "decision": decision,
        "reason": reason,
        "field_changes": field_changes,
    }


def get_history_for_sample(state: PipelineState, sample_id: str) -> List[Dict[str, Any]]:
    return [
        a.to_dict()
        for a in state.review_history
        if a.sample_id == sample_id
    ]
