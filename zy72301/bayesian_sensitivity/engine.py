from __future__ import annotations

import uuid
from collections import defaultdict
from datetime import datetime

import numpy as np
from scipy import stats

from .models import (
    BoundaryValueNote,
    CorrectionRecord,
    EvidenceSource,
    QuestionnaireRawRow,
    ReviewStatus,
    SensitivityResult,
)


_DEFAULT_PRIOR_ALPHA = 1.0
_DEFAULT_PRIOR_BETA = 1.0
_SENSITIVITY_GRID_POINTS = 5
_PURE_COMPUTED_FIELDS = {
    "posterior_mean",
    "posterior_std",
    "sensitivity_range",
    "questionnaire_evidence",
    "boundary_evidence",
    "calculated_at",
}


def _display_value(value, field: str) -> str:
    if isinstance(value, ReviewStatus):
        return value.value
    return str(value)


def _extract_likelihood(rows: list[QuestionnaireRawRow]) -> dict[str, dict[str, dict]]:
    grouped: dict[str, dict[str, dict]] = defaultdict(lambda: defaultdict(lambda: {"success": 0, "total": 0, "rows": []}))
    for row in rows:
        key = grouped[row.student_id][row.question_id]
        is_success = (row.score is not None and row.score >= row.max_score * 0.6)
        key["success"] += int(is_success)
        key["total"] += 1
        key["rows"].append(row)
    return dict(grouped)


def _extract_boundary_map(notes: list[BoundaryValueNote]) -> dict[str, dict[str | None, BoundaryValueNote]]:
    bmap: dict[str, dict[str | None, BoundaryValueNote]] = defaultdict(dict)
    for note in notes:
        bmap[note.student_id][note.question_id] = note
    return dict(bmap)


def _get_prior_bounds(
    student_id: str,
    question_id: str,
    boundary_map: dict[str, dict[str | None, BoundaryValueNote]],
) -> tuple[float, float, float, float]:
    student_notes = boundary_map.get(student_id, {})
    note = student_notes.get(question_id) or student_notes.get(None)
    if note is None:
        return _DEFAULT_PRIOR_ALPHA, _DEFAULT_PRIOR_ALPHA, _DEFAULT_PRIOR_BETA, _DEFAULT_PRIOR_BETA
    a_lo = note.prior_alpha_low if note.prior_alpha_low is not None else _DEFAULT_PRIOR_ALPHA
    a_hi = note.prior_alpha_high if note.prior_alpha_high is not None else _DEFAULT_PRIOR_ALPHA
    b_lo = note.prior_beta_low if note.prior_beta_low is not None else _DEFAULT_PRIOR_BETA
    b_hi = note.prior_beta_high if note.prior_beta_high is not None else _DEFAULT_PRIOR_BETA
    return a_lo, a_hi, b_lo, b_hi


def _compute_posterior(
    alpha: float,
    beta: float,
    successes: int,
    total: int,
) -> tuple[float, float]:
    post_alpha = alpha + successes
    post_beta = beta + (total - successes)
    dist = stats.beta(post_alpha, post_beta)
    return float(dist.mean()), float(dist.std())


def _compute_sensitivity_range(
    a_lo: float,
    a_hi: float,
    b_lo: float,
    b_hi: float,
    successes: int,
    total: int,
) -> float:
    alphas = np.linspace(a_lo, a_hi, _SENSITIVITY_GRID_POINTS)
    betas = np.linspace(b_lo, b_hi, _SENSITIVITY_GRID_POINTS)
    means = []
    for a in alphas:
        for b in betas:
            mean, _ = _compute_posterior(float(a), float(b), successes, total)
            means.append(mean)
    if not means:
        return 0.0
    return float(max(means) - min(means))


def _summarize_questionnaire_evidence(rows: list[QuestionnaireRawRow]) -> str:
    if not rows:
        return "无问卷原始行数据"
    student_id = rows[0].student_id
    question_id = rows[0].question_id
    versions = sorted(set(r.version for r in rows))
    scores = [r.score for r in rows if r.score is not None]
    parts = [f"学生{student_id}，题目{question_id}"]
    if len(versions) > 1:
        parts.append(f"提交了{len(versions)}版答案（版本{','.join(map(str, versions))}）")
    else:
        parts.append(f"提交1版答案")
    if scores:
        parts.append(f"得分{','.join(f'{s:.1f}' for s in scores)}")
    return "；".join(parts)


def _summarize_boundary_evidence(
    student_id: str,
    question_id: str,
    boundary_map: dict[str, dict[str | None, BoundaryValueNote]],
) -> str:
    student_notes = boundary_map.get(student_id, {})
    note = student_notes.get(question_id) or student_notes.get(None)
    if note is None:
        return "无边值说明"
    parts = [f"现场说法：「{note.field_observation}」"]
    if note.prior_alpha_low is not None or note.prior_alpha_high is not None:
        a_lo = note.prior_alpha_low or _DEFAULT_PRIOR_ALPHA
        a_hi = note.prior_alpha_high or _DEFAULT_PRIOR_ALPHA
        parts.append(f"先验α范围[{a_lo:.1f}, {a_hi:.1f}]")
    if note.prior_beta_low is not None or note.prior_beta_high is not None:
        b_lo = note.prior_beta_low or _DEFAULT_PRIOR_BETA
        b_hi = note.prior_beta_high or _DEFAULT_PRIOR_BETA
        parts.append(f"先验β范围[{b_lo:.1f}, {b_hi:.1f}]")
    return "；".join(parts)


def detect_duplicates(rows: list[QuestionnaireRawRow]) -> dict[str, list[int]]:
    version_map: dict[str, list[int]] = defaultdict(list)
    for row in rows:
        key = f"{row.student_id}::{row.question_id}"
        if row.version not in version_map[key]:
            version_map[key].append(row.version)
    return {k: sorted(v) for k, v in version_map.items() if len(v) > 1}


def run_sensitivity(
    questionnaire_rows: list[QuestionnaireRawRow],
    boundary_notes: list[BoundaryValueNote],
) -> list[SensitivityResult]:
    likelihood = _extract_likelihood(questionnaire_rows)
    boundary_map = _extract_boundary_map(boundary_notes)
    duplicates = detect_duplicates(questionnaire_rows)
    results: list[SensitivityResult] = []

    for student_id, questions in likelihood.items():
        for question_id, data in questions.items():
            successes = data["success"]
            total = data["total"]
            rows = data["rows"]

            a_lo, a_hi, b_lo, b_hi = _get_prior_bounds(student_id, question_id, boundary_map)

            mid_alpha = (a_lo + a_hi) / 2
            mid_beta = (b_lo + b_hi) / 2
            post_mean, post_std = _compute_posterior(mid_alpha, mid_beta, successes, total)

            sensitivity = _compute_sensitivity_range(a_lo, a_hi, b_lo, b_hi, successes, total)

            dup_key = f"{student_id}::{question_id}"
            is_dup = dup_key in duplicates
            dup_versions = duplicates.get(dup_key, [])

            has_boundary = (student_id in boundary_map) and (
                question_id in boundary_map[student_id] or None in boundary_map[student_id]
            )

            if is_dup:
                status = ReviewStatus.DUPLICATE_FLAGGED
            elif not has_boundary:
                status = ReviewStatus.PENDING_BOUNDARY
            else:
                status = ReviewStatus.PENDING_REVIEW

            results.append(
                SensitivityResult(
                    result_id=str(uuid.uuid4())[:8],
                    student_id=student_id,
                    question_id=question_id,
                    questionnaire_evidence=_summarize_questionnaire_evidence(rows),
                    boundary_evidence=_summarize_boundary_evidence(student_id, question_id, boundary_map),
                    posterior_mean=round(post_mean, 4),
                    posterior_std=round(post_std, 4),
                    sensitivity_range=round(sensitivity, 4),
                    is_duplicate=is_dup,
                    duplicate_versions=dup_versions,
                    status=status,
                    calculated_at=datetime.now(),
                )
            )

    return results


def _reconstruct_value(field: str, serialized: str, type_hint):
    if type_hint is bool:
        return serialized.lower() in ("true", "1", "yes")
    if type_hint is int:
        return int(serialized)
    if type_hint is float:
        return float(serialized)
    if type_hint is ReviewStatus:
        return ReviewStatus(serialized)
    return serialized


def merge_sensitivity_into_existing(
    fresh: list[SensitivityResult],
    existing: list[SensitivityResult],
) -> list[SensitivityResult]:
    """
    把新计算的结果合并进已有结果列表：
    - 按 (student_id, question_id) 稳定匹配；
    - 保留原 result_id、corrected_fields、corrections_history、is_duplicate、duplicate_versions；
    - 人工修正过的字段不被覆盖，按 corrected_fields 中存储的值复原；
    - 只覆盖纯计算字段：后验均值/标准差/敏感性、证据摘要、calculated_at；
    - 两版答案标记永远以"数据里有多个版本"为准，不被引擎状态覆盖。
    """
    existing_map = {
        (r.student_id, r.question_id): r for r in existing
    }
    merged: list[SensitivityResult] = []
    for f in fresh:
        key = (f.student_id, f.question_id)
        if key not in existing_map:
            merged.append(f)
            continue
        old = existing_map[key]

        base = f.model_copy(update={
            "result_id": old.result_id,
            "corrected_fields": dict(old.corrected_fields),
            "corrections_history": list(old.corrections_history),
        })

        if old.is_duplicate:
            base.is_duplicate = True
            if old.duplicate_versions:
                base.duplicate_versions = old.duplicate_versions

        if old.corrected_fields:
            raw_model = SensitivityResult.model_fields
            for field, serialized_value in old.corrected_fields.items():
                if field not in raw_model:
                    continue
                type_hint = raw_model[field].annotation
                try:
                    restored = _reconstruct_value(
                        field, serialized_value, type_hint
                    )
                    setattr(base, field, restored)
                except Exception:
                    setattr(base, field, serialized_value)

        merged.append(base)

    return merged


def build_computation_only_results(
    questionnaire_rows: list[QuestionnaireRawRow],
    boundary_notes: list[BoundaryValueNote],
) -> list[SensitivityResult]:
    """
    仅产出计算结果，不考虑已有修正痕迹，供 workflow 内部 merge 使用。
    逻辑上等价于原 run_sensitivity，但不再决定最终业务状态。
    """
    return run_sensitivity(questionnaire_rows, boundary_notes)

