from typing import Dict, Any, List, Optional
from .models import (
    PipelineState,
    RecordStatus,
    ExplainableSummary,
)
from .reviewer import get_history_for_sample


def _score_breakdown(record, params: Dict[str, Any]) -> Dict[str, Any]:
    caliber_key = record.caliber_source
    if caliber_key == "yaml_supplement":
        calibers = params.get("caliber_definitions", {})
        v2 = calibers.get("v2", {})
        weights = v2.get("feature_weights", {})
    else:
        calibers = params.get("caliber_definitions", {})
        current = calibers.get(params["pipeline"]["current_caliber_version"], {})
        weights = current.get("feature_weights", {})
    breakdown = {
        "final_score": round(record.uplift_score, 4),
        "caliber_source": record.caliber_source,
        "feature_weights": weights,
        "available_features": list(record.features.keys()),
        "feature_values": record.features,
    }
    if record.default_score_applied:
        breakdown["default_score_applied"] = True
        breakdown["default_score_value"] = params["pipeline"]["default_score"]
    return breakdown


def _summary_text(record, conflicts, history) -> str:
    status = record.status
    if status == RecordStatus.NORMAL:
        return (
            f"[正常记录] sample_id={record.sample_id}，线上特征齐全，"
            f"uplift_score={record.uplift_score}，口径来源=online，无需复核。"
        )
    if status == RecordStatus.FEATURE_MISSING_DEFAULT:
        return (
            f"[特征缺失-默认分] sample_id={record.sample_id}，线上 avg_purchase_30d/ctr_7d 未返回，"
            f"给了默认分 uplift_score={record.uplift_score}，暂不归正常，等待推荐负责人复核。"
        )
    if status == RecordStatus.PENDING_REVIEW:
        return (
            f"[待推荐负责人复核] sample_id={record.sample_id}，线上特征缺失，已给默认分 "
            f"uplift_score={record.uplift_score}，需要推荐负责人确认接受或覆盖。"
        )
    if status == RecordStatus.YAML_SUPPLEMENT_OLD_CALIBER:
        conflict_txt = "; ".join(c.description for c in conflicts) if conflicts else "无"
        return (
            f"[YAML补录旧口径] sample_id={record.sample_id}，召回候选表为旧口径，"
            f"从参数YAML补录重算，uplift_score={record.uplift_score}。冲突证据: {conflict_txt}。"
            f"等待实验平台负责人阿越确认或驳回。"
        )
    if status == RecordStatus.CONFLICT_DETECTED:
        conflict_txt = "; ".join(c.description for c in conflicts) if conflicts else "无"
        return (
            f"[冲突待处理] sample_id={record.sample_id}，召回候选表与参数YAML存在矛盾，"
            f"冲突证据: {conflict_txt}，需实验平台负责人阿越裁定。"
        )
    if status == RecordStatus.CONFIRMED:
        last_confirm = [h for h in history if h["action"] == "CONFIRM"][-1] if history else None
        who = last_confirm["actor"] if last_confirm else "阿越"
        reason = last_confirm["reason"] if last_confirm else "已确认"
        return (
            f"[已确认] sample_id={record.sample_id}，由{who}确认，理由: {reason}。"
            f"最终 uplift_score={record.uplift_score}。"
        )
    if status == RecordStatus.REJECTED:
        last_rej = [h for h in history if h["action"] == "REJECT"][-1] if history else None
        who = last_rej["actor"] if last_rej else "阿越"
        reason = last_rej["reason"] if last_rej else "已驳回"
        return (
            f"[已驳回] sample_id={record.sample_id}，由{who}驳回，理由: {reason}。"
            f"最终 uplift_score={record.uplift_score}。"
        )
    if status == RecordStatus.REVIEW_COMPLETED:
        last = history[-1] if history else None
        who = last["actor"] if last else "推荐负责人"
        reason = last["reason"] if last else "已完成"
        decision = last["field_changes"].get("decision", "") if last else ""
        return (
            f"[推荐复核完成] sample_id={record.sample_id}，决策={decision}，"
            f"由{who}处理，理由: {reason}。最终 uplift_score={record.uplift_score}。"
        )
    return f"sample_id={record.sample_id} status={status.value}"


def refresh_summaries(
    state: PipelineState, params: Dict[str, Any]
) -> List[Dict[str, Any]]:
    refreshed: List[Dict[str, Any]] = []
    for sample_id, record in state.records.items():
        history = get_history_for_sample(state, sample_id)
        conflicts = state.conflicts.get(sample_id, [])
        data_sources = ["召回候选表(online)"]
        if record.caliber_source == "yaml_supplement":
            data_sources.append("参数YAML补录")
        if record.default_score_applied:
            data_sources.append("默认分兜底")
        refs = [h["timestamp"] for h in history]
        summary = ExplainableSummary(
            sample_id=sample_id,
            status=record.status,
            summary_text=_summary_text(record, conflicts, history),
            score_breakdown=_score_breakdown(record, params),
            data_sources=data_sources,
            review_history_refs=refs,
        )
        state.summaries[sample_id] = summary
        refreshed.append(summary.to_dict())
    return refreshed


def lookup_summary_by_sample(
    state: PipelineState, sample_id: str
) -> Optional[Dict[str, Any]]:
    s = state.summaries.get(sample_id)
    return s.to_dict() if s else None
