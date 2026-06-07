import uuid
import yaml
import pandas as pd
from typing import List, Optional, Tuple
from pathlib import Path

from .models import (
    RecallCandidate,
    ThresholdParams,
    ThresholdResult,
    TrialRun,
    AuditLog,
    PlaybackReport,
    PlaybackItem,
    SampleStatus,
    NextAction,
)


def load_candidates_from_csv(file_path: str) -> List[RecallCandidate]:
    df = pd.read_csv(file_path)
    candidates = []
    for _, row in df.iterrows():
        candidate = RecallCandidate(
            sample_id=str(row.get("sample_id", str(uuid.uuid4()))),
            content=str(row.get("content", "")),
            semantic_score=float(row.get("semantic_score", 0.0)),
            category=str(row.get("category", "未分类")),
            is_minority=bool(row.get("is_minority", False)),
        )
        candidates.append(candidate)
    return candidates


def load_params_from_yaml(file_path: str) -> ThresholdParams:
    with open(file_path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    return ThresholdParams(**data)


def save_params_to_yaml(params: ThresholdParams, file_path: str) -> None:
    with open(file_path, "w", encoding="utf-8") as f:
        yaml.dump(params.model_dump(), f, allow_unicode=True, default_flow_style=False)


def calculate_adjusted_score(
    candidate: RecallCandidate,
    params: ThresholdParams,
    minority_ratio: float,
) -> Tuple[float, bool, SampleStatus, str, List[str], NextAction]:
    base_score = candidate.semantic_score
    is_minority = candidate.is_minority
    missing = []
    next_action = NextAction.NONE
    status = SampleStatus.NORMAL
    why_kept = ""

    if is_minority and params.minority_boost_enabled:
        if minority_ratio < params.min_minority_ratio:
            adjusted_score = base_score * params.minority_weight
            why_kept = f"少数类样本（{candidate.category}），当前少数类占比{minority_ratio:.1%}低于阈值{params.min_minority_ratio:.1%}，应用加权系数{params.minority_weight}提升得分"
            status = SampleStatus.MINORITY_MASKED
            next_action = NextAction.ALGO_ENGINEER
            missing = ["补充该类别标注样本量数据", "确认少数类加权策略合理性"]
        else:
            adjusted_score = base_score
            why_kept = f"少数类样本（{candidate.category}），但少数类占比{minority_ratio:.1%}达标，按原得分计算"
    else:
        adjusted_score = base_score
        if base_score >= params.dedup_threshold:
            why_kept = f"语义相似度得分{base_score:.3f} ≥ 阈值{params.dedup_threshold}，通过去重检测"
        else:
            why_kept = f"语义相似度得分{base_score:.3f} < 阈值{params.dedup_threshold}，未通过去重检测"

    if adjusted_score >= params.dedup_threshold:
        passed = True
    else:
        passed = False

    return adjusted_score, passed, status, why_kept, missing, next_action


def run_threshold_trial(
    candidates: List[RecallCandidate],
    params: ThresholdParams,
    operator: str = "system",
    reason: str = "初始阈值试算",
) -> TrialRun:
    run_id = f"run_{uuid.uuid4().hex[:8]}"
    
    minority_count = sum(1 for c in candidates if c.is_minority)
    total_count = len(candidates)
    minority_ratio = minority_count / total_count if total_count > 0 else 0.0

    results = []
    for candidate in candidates:
        adjusted_score, passed, status, why_kept, missing, next_action = calculate_adjusted_score(
            candidate, params, minority_ratio
        )
        result = ThresholdResult(
            sample_id=candidate.sample_id,
            original_score=candidate.semantic_score,
            adjusted_score=adjusted_score,
            passed=passed,
            status=status,
            why_kept=why_kept,
            missing_materials=missing,
            next_action=next_action,
            is_minority=candidate.is_minority,
        )
        results.append(result)

    audit_log = AuditLog(
        operator=operator,
        action="run_trial",
        reason=reason,
        affected_samples=[c.sample_id for c in candidates],
    )

    return TrialRun(
        run_id=run_id,
        params=params,
        candidates=candidates,
        results=results,
        audit_logs=[audit_log],
    )


def apply_manual_correction(
    trial_run: TrialRun,
    sample_id: str,
    operator: str,
    reason: str,
    new_status: Optional[SampleStatus] = None,
    new_next_action: Optional[NextAction] = None,
    custom_why_kept: Optional[str] = None,
) -> TrialRun:
    new_results = []
    affected = []
    
    for result in trial_run.results:
        if result.sample_id == sample_id:
            updated = result.model_copy(deep=True)
            if new_status:
                updated.status = new_status
            if new_next_action:
                updated.next_action = new_next_action
            if custom_why_kept:
                updated.why_kept = custom_why_kept
            new_results.append(updated)
            affected.append(sample_id)
        else:
            new_results.append(result)

    audit_log = AuditLog(
        operator=operator,
        action="manual_correction",
        reason=reason,
        affected_samples=affected,
    )

    new_audit_logs = trial_run.audit_logs + [audit_log]
    
    return TrialRun(
        run_id=f"{trial_run.run_id}_corrected",
        params=trial_run.params,
        candidates=trial_run.candidates,
        results=new_results,
        audit_logs=new_audit_logs,
        is_manual_correction=True,
    )


def rerun_with_new_params(
    trial_run: TrialRun,
    new_params: ThresholdParams,
    operator: str,
    reason: str,
) -> TrialRun:
    new_run = run_threshold_trial(
        candidates=trial_run.candidates,
        params=new_params,
        operator=operator,
        reason=reason,
    )
    
    all_audits = trial_run.audit_logs + new_run.audit_logs
    
    return TrialRun(
        run_id=f"rerun_{uuid.uuid4().hex[:8]}",
        params=new_params,
        candidates=trial_run.candidates,
        results=new_run.results,
        audit_logs=all_audits,
    )


def generate_playback_report(trial_run: TrialRun) -> PlaybackReport:
    params = trial_run.params
    results = trial_run.results
    
    total = len(results)
    passed = sum(1 for r in results if r.passed)
    removed = total - passed
    minority_masked = sum(1 for r in results if r.status == SampleStatus.MINORITY_MASKED)
    
    items = []
    for result in results:
        candidate = next(
            (c for c in trial_run.candidates if c.sample_id == result.sample_id),
            None,
        )
        
        minority_note = None
        if result.status == SampleStatus.MINORITY_MASKED:
            minority_note = "⚠️ 该样本为少数类，已被总指标盖住，需算法工程师复核确认是否保留"
        elif result.is_minority and result.status == SampleStatus.NORMAL:
            minority_note = "ℹ️ 该样本为少数类，当前占比达标，按正常流程处理"
        
        item = PlaybackItem(
            sample_id=result.sample_id,
            content=candidate.content if candidate else "",
            category=candidate.category if candidate else "",
            original_score=result.original_score,
            adjusted_score=result.adjusted_score,
            threshold=params.dedup_threshold,
            passed=result.passed,
            status=result.status,
            explanation=result.why_kept,
            missing_materials=result.missing_materials,
            next_action=result.next_action,
            is_minority=result.is_minority,
            minority_note=minority_note,
        )
        items.append(item)
    
    summary_parts = [
        f"本次试算共处理 {total} 条样本",
        f"通过阈值：{passed} 条（{passed/total:.1%}）",
        f"被过滤：{removed} 条（{removed/total:.1%}）",
    ]
    if minority_masked > 0:
        summary_parts.append(
            f"⚠️ 注意：有 {minority_masked} 条少数类样本被总指标盖住，需算法工程师复核"
        )
    summary = "，".join(summary_parts) + "。"
    
    next_steps = []
    if minority_masked > 0:
        next_steps.append(
            f"联系算法工程师复核 {minority_masked} 条被总指标盖住的少数类样本"
        )
    has_op_tasks = any(r.next_action == NextAction.OPERATIONS for r in results)
    if has_op_tasks:
        next_steps.append("评测运营小孟补充缺失材料并确认样本状态")
    if not next_steps:
        next_steps.append("所有样本处理完毕，可确认最终结果")
    
    return PlaybackReport(
        run_id=trial_run.run_id,
        params=params,
        total_samples=total,
        passed_count=passed,
        removed_count=removed,
        minority_masked_count=minority_masked,
        items=items,
        summary=summary,
        next_steps=next_steps,
    )
