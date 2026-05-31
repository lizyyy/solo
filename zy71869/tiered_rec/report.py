from __future__ import annotations

from collections import defaultdict
from typing import IO

from tiered_rec.models import (
    DifficultyTier,
    ProcessingStatus,
    RecommendationResult,
)
from tiered_rec.errors import status_label, issue_to_human


def generate_review_draft(
    results: list[RecommendationResult],
    output: IO[str] | None = None,
    include_score_detail: bool = True,
) -> str:
    confirmed = [r for r in results if r.status == ProcessingStatus.CONFIRMED]
    pending = [r for r in results if r.status == ProcessingStatus.PENDING]
    manual = [r for r in results if r.status == ProcessingStatus.MANUAL_OVERRIDE]

    lines: list[str] = []
    lines.append("=" * 60)
    lines.append("竞赛题分层推荐 — 讲评稿")
    lines.append("=" * 60)
    lines.append("")

    _section(lines, "一、已确认记录", confirmed, include_score_detail)
    _section(lines, "二、待补充记录", pending, include_score_detail)
    _section(lines, "三、人工修改记录", manual, include_score_detail)

    lines.append("")
    lines.append("=" * 60)
    lines.append("处理口径说明")
    lines.append("=" * 60)
    lines.append("")
    lines.append("• 已确认：系统判定无异常，可直接用于讲评。")
    lines.append("• 待补充：存在等价答案误判或评分步骤不匹配，需相关组别确认后补充。")
    lines.append("• 人工修改：一线教师已手动修改推荐结果，以修改后内容为准。")
    lines.append("")

    all_issues = []
    for r in results:
        all_issues.extend(r.equivalent_issues)
    if all_issues:
        lines.append("-" * 40)
        lines.append("等价答案误判清单")
        lines.append("-" * 40)
        for issue in all_issues:
            lines.append(f"  {issue_to_human(issue)}")
        lines.append("")

    text = "\n".join(lines)
    if output is not None:
        output.write(text)
    return text


def _section(
    lines: list[str],
    title: str,
    results: list[RecommendationResult],
    include_score_detail: bool,
) -> None:
    lines.append(f"{'─' * 40}")
    lines.append(title)
    lines.append(f"{'─' * 40}")
    if not results:
        lines.append("  （无）")
        lines.append("")
        return

    by_tier: dict[DifficultyTier, list[RecommendationResult]] = defaultdict(list)
    for r in results:
        by_tier[r.tier].append(r)

    for tier in [DifficultyTier.BASIC, DifficultyTier.INTERMEDIATE, DifficultyTier.ADVANCED]:
        tier_results = by_tier.get(tier, [])
        if not tier_results:
            continue
        lines.append(f"  【{tier.value}】")
        for r in tier_results:
            status_str = status_label(r.status)
            line = f"    题目 {r.question_id} ｜ 推荐组别：{', '.join(r.recommended_to)} ｜ 状态：{status_str}"
            if r.manual_override_note:
                line += f" ｜ 修改备注：{r.manual_override_note}"
            lines.append(line)
            if include_score_detail and r.score_summary:
                total = r.score_summary.get("total_reviews", 0)
                avg = r.score_summary.get("avg_score", 0)
                mismatches = r.score_summary.get("step_mismatch_count", 0)
                lines.append(f"      讲评数：{total}  平均得分：{avg}", )
                if mismatches > 0:
                    lines.append(f"      ⚠ 有 {mismatches} 处分步得分超出满分，需核实")
            for issue in r.equivalent_issues:
                lines.append(f"      ⚠ {issue_to_human(issue)}")
        lines.append("")
