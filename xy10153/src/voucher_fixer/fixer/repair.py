from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional

from ..analyzer import (
    DuplicateAnalysis,
    GapAnalysis,
    ReverseAnalysis,
)
from ..models.voucher import Voucher, VoucherBatch, VoucherStatus, VoucherType


class FixActionType(str, Enum):
    INSERT_PLACEHOLDER = "insert_placeholder"
    REMOVE_DUPLICATE = "remove_duplicate"
    RENUMBER = "renumber"
    RESOLVE_REVERSAL = "resolve_reversal"
    MARK_UNUSABLE = "mark_unusable"


@dataclass
class FixAction:
    id: str
    action_type: FixActionType
    title: str
    description: str
    impact: str
    source_reference: str
    details: Dict = field(default_factory=dict)
    can_auto_apply: bool = False
    risk_level: str = "medium"


@dataclass
class RepairPlan:
    actions: List[FixAction] = field(default_factory=list)
    summary: Dict = field(default_factory=dict)
    can_auto_apply: bool = False

    def has_actions(self) -> bool:
        return len(self.actions) > 0


class RepairPlanner:
    def __init__(self):
        self._action_id_counter = 0

    def generate_plan(
        self,
        batch: VoucherBatch,
        gap_analysis: GapAnalysis,
        dup_analysis: DuplicateAnalysis,
        reverse_analysis: ReverseAnalysis,
    ) -> RepairPlan:
        plan = RepairPlan()
        self._action_id_counter = 0

        self._add_gap_fixes(plan, gap_analysis)
        self._add_duplicate_fixes(plan, dup_analysis)
        self._add_reversal_fixes(plan, reverse_analysis)

        all_auto = all(a.can_auto_apply for a in plan.actions)
        plan.can_auto_apply = all_auto and len(plan.actions) > 0

        plan.summary = {
            "total_issues": len(plan.actions),
            "auto_applicable": sum(1 for a in plan.actions if a.can_auto_apply),
            "high_risk": sum(1 for a in plan.actions if a.risk_level == "high"),
            "action_types": {},
        }
        for a in plan.actions:
            t = a.action_type.value
            plan.summary["action_types"][t] = plan.summary["action_types"].get(t, 0) + 1

        return plan

    def _add_gap_fixes(self, plan: RepairPlan, gap_analysis: GapAnalysis):
        by_type: Dict[VoucherType, List] = {}
        for issue in gap_analysis.issues:
            by_type.setdefault(issue.voucher_type, []).append(issue)

        for vtype, issues in by_type.items():
            first = issues[0]
            plan.actions.append(
                FixAction(
                    id=self._next_id(),
                    action_type=FixActionType.INSERT_PLACEHOLDER,
                    title=f"{vtype.value}字凭证断号 ({len(issues)} 处)",
                    description=self._build_gap_description(vtype, issues),
                    impact="插入占位凭证或重新编号均可修复",
                    source_reference=first.detail,
                    details={
                        "voucher_type": vtype.value,
                        "missing_numbers": [i.missing_number for i in issues],
                        "count": len(issues),
                    },
                    can_auto_apply=True,
                    risk_level="low",
                )
            )

    def _build_gap_description(self, vtype: VoucherType, issues: List) -> str:
        missing = sorted({i.missing_number for i in issues})
        ranges = self._to_ranges(missing)
        return (
            f"检测到 {vtype.value} 字凭证断号，缺失编号: "
            + ", ".join(ranges)
            + f"。共 {len(missing)} 个编号。"
        )

    def _to_ranges(self, numbers: List[int]) -> List[str]:
        if not numbers:
            return []
        ranges = []
        start = numbers[0]
        end = numbers[0]
        for n in numbers[1:]:
            if n == end + 1:
                end = n
            else:
                ranges.append(f"{start}-{end}" if start != end else str(start))
                start = n
                end = n
        ranges.append(f"{start}-{end}" if start != end else str(start))
        return ranges

    def _add_duplicate_fixes(self, plan: RepairPlan, dup_analysis: DuplicateAnalysis):
        for issue in dup_analysis.issues:
            sources = [
                f"{v.source_file}:{v.line_number}" for v in issue.vouchers
            ]
            plan.actions.append(
                FixAction(
                    id=self._next_id(),
                    action_type=FixActionType.REMOVE_DUPLICATE,
                    title=(
                        f"{issue.voucher_type.value}"
                        f"{issue.voucher_number} 重复 ({issue.count} 次)"
                    ),
                    description=(
                        f"凭证 {issue.voucher_type.value}"
                        f"{issue.voucher_number} 出现 {issue.count} 次。"
                    ),
                    impact="需要确认保留哪一个，其余删除或重新编号",
                    source_reference=" | ".join(sources),
                    details={
                        "voucher_type": issue.voucher_type.value,
                        "voucher_number": issue.voucher_number,
                        "count": issue.count,
                        "sources": sources,
                    },
                    can_auto_apply=False,
                    risk_level="high",
                )
            )

    def _add_reversal_fixes(
        self, plan: RepairPlan, reverse_analysis: ReverseAnalysis
    ):
        for pair in reverse_analysis.pairs:
            plan.actions.append(
                FixAction(
                    id=self._next_id(),
                    action_type=FixActionType.RESOLVE_REVERSAL,
                    title=(
                        f"冲销配对: {pair.original.voucher_type.value}"
                        f"{pair.original.voucher_number} <-> "
                        f"{pair.reversal.voucher_type.value}"
                        f"{pair.reversal.voucher_number}"
                    ),
                    description=(
                        f"匹配方式: {pair.matched_by}, "
                        f"置信度: {pair.confidence:.0%}, "
                        f"日期差: {pair.date_diff_days} 天"
                    ),
                    impact="已建立配对关系，可在报告中查看",
                    source_reference=(
                        f"{pair.original.source_file}:{pair.original.line_number} | "
                        f"{pair.reversal.source_file}:{pair.reversal.line_number}"
                    ),
                    details={
                        "original_id": pair.original.id,
                        "reversal_id": pair.reversal.id,
                        "matched_by": pair.matched_by,
                        "confidence": pair.confidence,
                        "date_diff_days": pair.date_diff_days,
                    },
                    can_auto_apply=True,
                    risk_level="low",
                )
            )

        for um in reverse_analysis.unmatched_reversals:
            v = um.voucher
            possible_refs = [
                f"{p.source_file}:{p.line_number}" for p in um.possible_matches
            ]
            plan.actions.append(
                FixAction(
                    id=self._next_id(),
                    action_type=FixActionType.RESOLVE_REVERSAL,
                    title=(
                        f"未配对冲销: {v.voucher_type.value}"
                        f"{v.voucher_number}"
                    ),
                    description=(
                        f"{um.reason}。摘要: {v.description or '无'}"
                    ),
                    impact="需要人工确认原凭证或标记为独立凭证",
                    source_reference=f"{v.source_file}:{v.line_number}",
                    details={
                        "voucher_id": v.id,
                        "reason": um.reason,
                        "possible_matches": possible_refs,
                    },
                    can_auto_apply=False,
                    risk_level="medium",
                )
            )

    def _next_id(self) -> str:
        self._action_id_counter += 1
        return f"FIX-{self._action_id_counter:03d}"
