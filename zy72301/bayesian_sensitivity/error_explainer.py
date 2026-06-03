from __future__ import annotations

import uuid
from datetime import datetime

from .models import (
    ErrorExplanation,
    NextAction,
    ReviewStatus,
    SensitivityResult,
)


def generate_explanations(results: list[SensitivityResult]) -> list[ErrorExplanation]:
    explanations: list[ErrorExplanation] = []
    for r in results:
        exp = _explain_one(r)
        explanations.append(exp)
    return explanations


def _explain_one(result: SensitivityResult) -> ErrorExplanation:
    why_kept = _build_why_kept(result)
    missing = _build_missing(result)
    next_action, next_detail = _build_next_action(result)
    is_dup_flag = result.is_duplicate

    return ErrorExplanation(
        explanation_id=str(uuid.uuid4())[:8],
        result_id=result.result_id,
        student_id=result.student_id,
        why_kept=why_kept,
        missing_materials=missing,
        next_action=next_action,
        next_action_detail=next_detail,
        is_duplicate_flag=is_dup_flag,
        generated_at=datetime.now(),
    )


def _build_why_kept(r: SensitivityResult) -> str:
    parts: list[str] = []

    if r.is_duplicate:
        versions_str = "、".join(f"第{v}版" for v in r.duplicate_versions)
        parts.append(
            f"学生{r.student_id}对题目{r.question_id}提交了{versions_str}答案，"
            f"两版答案差异尚未复核，不能自动归为正常，必须保留等待人工判断"
        )
    else:
        parts.append(
            f"学生{r.student_id}在题目{r.question_id}的后验均值为{r.posterior_mean:.2f}"
        )

    if r.sensitivity_range > 0.15:
        parts.append(
            f"先验敏感性范围达{r.sensitivity_range:.2f}，说明后验对先验选择较敏感，"
            f"不能简单按单一先验下结论，需保留供进一步审查"
        )
    elif r.sensitivity_range > 0.05:
        parts.append(
            f"先验敏感性范围为{r.sensitivity_range:.2f}，中等敏感，结果需保留但暂不紧急"
        )

    if "无边值说明" in r.boundary_evidence:
        parts.append("目前缺少边界值说明的现场证据，无法判断先验约束是否合理，故保留")

    return "；".join(parts) if parts else "暂无异常，保留备查"


def _build_missing(r: SensitivityResult) -> list[str]:
    missing: list[str] = []

    if "无边值说明" in r.boundary_evidence:
        missing.append(f"学生{r.student_id}题目{r.question_id}的边界值说明（现场说法）")

    if r.is_duplicate:
        missing.append(f"学生{r.student_id}两版答案的差异原因说明")

    if r.sensitivity_range > 0.15 and "无边值说明" not in r.boundary_evidence:
        missing.append("更窄的先验范围约束，当前先验区间太宽导致敏感性高")

    if r.posterior_std > 0.2:
        missing.append("更多样本数据以降低后验不确定性")

    return missing


def _build_next_action(r: SensitivityResult) -> tuple[NextAction, str]:
    if r.is_duplicate:
        return (
            NextAction.FIND_BUSINESS_OPS,
            f"学生{r.student_id}对题目{r.question_id}提交了两版答案（版本"
            f"{','.join(map(str, r.duplicate_versions))}），"
            f"请业务运营确认以哪版为准，不要自动归为正常",
        )

    if "无边值说明" in r.boundary_evidence and r.sensitivity_range > 0.05:
        return (
            NextAction.SUPPLEMENT_BOUNDARY,
            f"学生{r.student_id}题目{r.question_id}无边值说明，"
            f"且敏感性范围{r.sensitivity_range:.2f}偏高，"
            f"请补录边界值说明后再重新试算",
        )

    if r.sensitivity_range > 0.15:
        return (
            NextAction.FIND_DIRECTOR_WU,
            f"学生{r.student_id}题目{r.question_id}敏感性范围{r.sensitivity_range:.2f}，"
            f"先验选择对结论影响大，需教研负责人吴老师确认先验范围是否合理",
        )

    if "无边值说明" in r.boundary_evidence:
        return (
            NextAction.SUPPLEMENT_BOUNDARY,
            f"学生{r.student_id}题目{r.question_id}尚无边值说明，请补录后再更新误差说明",
        )

    return (NextAction.NO_ACTION, "当前结果稳定，无需额外操作")


def refresh_explanations(
    results: list[SensitivityResult],
    existing: list[ErrorExplanation],
) -> list[ErrorExplanation]:
    existing_map = {e.result_id: e for e in existing}
    new_explanations: list[ErrorExplanation] = []
    for r in results:
        old = existing_map.get(r.result_id)
        new_exp = _explain_one(r)
        if old:
            new_exp.explanation_id = old.explanation_id
        new_explanations.append(new_exp)
    return new_explanations
