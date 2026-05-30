from __future__ import annotations

from typing import Dict, List, Optional

from .models import (
    ConflictItem, ConflictSeverity, ConflictType, SchedulePlan,
)
from .state import AppState


class TerminalRenderer:
    SEVERITY_ICONS = {
        ConflictSeverity.WARNING: "⚠️ ",
        ConflictSeverity.ERROR: "🚨",
    }

    TYPE_LABELS = {
        ConflictType.ABSENCE_DUPLICATE: "缺勤重复",
        ConflictType.DIFFICULTY_INVERSION: "难度权重反转",
        ConflictType.TIME_OVERRUN: "时间超排",
    }

    def __init__(self, state: AppState):
        self.state = state

    def render_schedule(self, plan: Optional[SchedulePlan] = None) -> str:
        plan = plan or self.state.current_schedule()
        if not plan:
            return "📋 当前没有排练方案。请先运行 schedule 命令生成方案。"

        lines = [
            f"🎼 排练方案 #{plan.id[:6]}（生成于 {plan.created_at[:19]}）",
            f"   可用时间：{plan.total_available_minutes:.0f} 分钟 | 已分配：{plan.total_allocated_minutes:.0f} 分钟 | 剩余：{plan.total_available_minutes - plan.total_allocated_minutes:.0f} 分钟",
            "",
            "  序号 | 曲目                    | 时长(min) | 优先级  | 难度因子 | 缺勤影响 | 紧迫度",
            "  ----+-------------------------+-----------+---------+---------+---------+--------",
        ]

        for entry in plan.entries:
            lines.append(
                f"  {entry.order:>4} | {entry.piece_name:<23} | {entry.allocated_minutes:>9.0f} | {entry.priority_score:>7.4f} | {entry.difficulty_factor:>7.4f} | {entry.absence_impact:>7.4f} | {entry.urgency_factor:>6.4f}"
            )

        if plan.excluded_piece_ids:
            lines.append("")
            lines.append(f"  ❌ 因时间不足被排除的曲目（{len(plan.excluded_piece_ids)} 首）：")
            for pid in plan.excluded_piece_ids:
                piece = self.state.pieces.get(pid)
                name = piece.name if piece else pid
                lines.append(f"     - {name}")

        return "\n".join(lines)

    def render_conflicts(self, conflicts: Optional[List[ConflictItem]] = None) -> str:
        if conflicts is None:
            conflicts = self.state.conflicts

        if not conflicts:
            return "✅ 当前没有检测到冲突。"

        by_type: Dict[ConflictType, List[ConflictItem]] = {}
        for c in conflicts:
            by_type.setdefault(c.conflict_type, []).append(c)

        lines = ["🔍 冲突检测结果（按类型拆分）", ""]

        for ctype, items in by_type.items():
            label = self.TYPE_LABELS.get(ctype, ctype.value)
            warnings = sum(1 for c in items if c.severity == ConflictSeverity.WARNING)
            errors = sum(1 for c in items if c.severity == ConflictSeverity.ERROR)
            lines.append(f"── {label}（共 {len(items)} 项：{errors} 错误 / {warnings} 警告）──")

            for item in items:
                icon = self.SEVERITY_ICONS.get(item.severity, "  ")
                lines.append(f"  {icon} {item.title}")
                if item.details:
                    for key, val in item.details.items():
                        if key in ("absence_ids", "affected_ids"):
                            continue
                        lines.append(f"     · {key}: {val}")
                lines.append("")

        return "\n".join(lines)

    def render_conflict_summary(self, summary: Dict[str, Dict[str, int]]) -> str:
        lines = ["📊 冲突统计（按类型）", ""]
        for ctype, counts in summary.items():
            label = self.TYPE_LABELS.get(ConflictType(ctype), ctype)
            lines.append(f"  {label}：{counts['total']} 项（{counts['errors']} 错误 / {counts['warnings']} 警告）")
        return "\n".join(lines)

    def render_plan_comparison(self, comparisons: List[Dict]) -> str:
        if not comparisons:
            return "📋 没有历史方案可供对比。"

        lines = ["📊 方案对比", ""]
        for comp in comparisons:
            lines.append(
                f"  方案 #{comp['plan_index']}（{comp['plan_id'][:6]}）"
                f" | 时间：{comp['total_allocated']:.0f}/{comp['total_available']:.0f} 分钟"
                f" | 排入：{comp['scheduled_count']} 首"
                f" | 排除：{comp['excluded_count']} 首"
                f" | 创建于：{comp['created_at'][:19]}"
            )
        return "\n".join(lines)

    def render_audit_log(self, entries: Optional[List[Dict]] = None) -> str:
        if entries is None:
            entries = [e.to_dict() for e in self.state.audit_log]

        if not entries:
            return "📋 审计日志为空。"

        lines = ["📝 审计日志", ""]
        for i, entry in enumerate(entries):
            has_before = entry.get("before_snapshot") is not None
            has_after = entry.get("after_snapshot") is not None
            change_marker = ""
            if has_before and has_after:
                change_marker = " [有前后对比]"
            elif has_after:
                change_marker = " [新增]"

            lines.append(
                f"  #{i} [{entry['timestamp'][:19]}] {entry['action']}: {entry['description']}{change_marker}"
            )
        return "\n".join(lines)

    def render_audit_detail(self, entry: Dict) -> str:
        lines = [
            f"📝 审计条目详情",
            f"  时间：{entry['timestamp'][:19]}",
            f"  动作：{entry['action']}",
            f"  描述：{entry['description']}",
        ]
        if entry.get("before_snapshot"):
            lines.append(f"  变更前：{self._truncate_snapshot(entry['before_snapshot'])}")
        if entry.get("after_snapshot"):
            lines.append(f"  变更后：{self._truncate_snapshot(entry['after_snapshot'])}")
        return "\n".join(lines)

    def render_data_summary(self) -> str:
        pieces = self.state.filtered_pieces()
        absences = self.state.filtered_absences()
        perfs = self.state.filtered_performances()
        reports = self.state.filtered_reports()
        sections = self.state.sections

        system_pieces = sum(1 for p in pieces.values() if p.source.value == "system")
        manual_pieces = len(pieces) - system_pieces
        system_abs = sum(1 for a in absences.values() if a.source.value == "system")
        manual_abs = len(absences) - system_abs

        lines = [
            "📂 数据概览",
            f"  曲目：{len(pieces)} 首（系统导出 {system_pieces} / 手动补录 {manual_pieces}）",
            f"  声部：{len(sections)} 个",
            f"  缺勤记录：{len(absences)} 条（系统导出 {system_abs} / 手动补录 {manual_abs}）",
            f"  演出场次：{len(perfs)} 场",
            f"  排练报告：{len(reports)} 份",
            f"  排练方案：{len(self.state.schedules)} 份",
            f"  冲突项：{len(self.state.conflicts)} 项",
            f"  审计条目：{len(self.state.audit_log)} 条",
        ]
        return "\n".join(lines)

    def render_filter(self) -> str:
        f = self.state.current_filter
        parts = []
        if f.piece_ids is not None:
            parts.append(f"曲目 ID：{f.piece_ids}")
        if f.section_ids is not None:
            parts.append(f"声部 ID：{f.section_ids}")
        if f.date_from is not None:
            parts.append(f"日期从：{f.date_from}")
        if f.date_to is not None:
            parts.append(f"日期至：{f.date_to}")
        if f.source_filter is not None:
            parts.append(f"来源：{f.source_filter.value}")
        if not parts:
            return "🔍 当前筛选：无（显示全部）"
        return "🔍 当前筛选：" + " | ".join(parts)

    def _truncate_snapshot(self, snapshot: object, max_len: int = 200) -> str:
        s = str(snapshot)
        if len(s) > max_len:
            return s[:max_len] + "..."
        return s
