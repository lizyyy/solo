from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from .models import ConflictItem, SchedulePlan
from .state import AppState


class Exporter:
    def __init__(self, state: AppState):
        self.state = state

    def export_json(self, output_path: str, scope: str = "schedule") -> str:
        data = self._collect_view_data(scope)
        p = Path(output_path)
        p.parent.mkdir(parents=True, exist_ok=True)
        with open(p, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return str(p)

    def export_markdown(self, output_path: str, scope: str = "schedule") -> str:
        data = self._collect_view_data(scope)
        md = self._to_markdown(data, scope)
        p = Path(output_path)
        p.parent.mkdir(parents=True, exist_ok=True)
        with open(p, "w", encoding="utf-8") as f:
            f.write(md)
        return str(p)

    def _collect_view_data(self, scope: str) -> Dict[str, Any]:
        result: Dict[str, Any] = {
            "export_time": datetime.now().isoformat(),
            "filter_applied": self._filter_info(),
            "scope": scope,
        }

        if scope in ("schedule", "full"):
            plan = self.state.current_schedule()
            result["schedule"] = plan.to_dict() if plan else None

        if scope in ("conflicts", "full"):
            result["conflicts"] = {
                "items": [c.to_dict() for c in self.state.conflicts],
                "by_type": self._conflicts_by_type(),
            }

        if scope in ("audit", "full"):
            result["audit_log"] = [e.to_dict() for e in self.state.audit_log]

        if scope == "full":
            result["pieces"] = {k: v.to_dict() for k, v in self.state.filtered_pieces().items()}
            result["absences"] = {k: v.to_dict() for k, v in self.state.filtered_absences().items()}
            result["performances"] = {k: v.to_dict() for k, v in self.state.filtered_performances().items()}
            result["reports"] = {k: v.to_dict() for k, v in self.state.filtered_reports().items()}

        return result

    def _filter_info(self) -> Dict[str, Any]:
        f = self.state.current_filter
        info: Dict[str, Any] = {}
        if f.piece_ids is not None:
            info["piece_ids"] = f.piece_ids
        if f.section_ids is not None:
            info["section_ids"] = f.section_ids
        if f.date_from is not None:
            info["date_from"] = f.date_from
        if f.date_to is not None:
            info["date_to"] = f.date_to
        if f.source_filter is not None:
            info["source_filter"] = f.source_filter.value
        return info if info else {"note": "无筛选，显示全部"}

    def _conflicts_by_type(self) -> Dict[str, int]:
        counts: Dict[str, int] = {}
        for c in self.state.conflicts:
            counts[c.conflict_type.value] = counts.get(c.conflict_type.value, 0) + 1
        return counts

    def _to_markdown(self, data: Dict[str, Any], scope: str) -> str:
        lines = [
            f"# 音乐排练时长优化报告",
            f"",
            f"> 导出时间：{data['export_time'][:19]}",
            f"> 数据范围：{scope}",
        ]

        filter_info = data.get("filter_applied", {})
        if filter_info.get("note"):
            lines.append(f"> 筛选条件：{filter_info['note']}")
        else:
            parts = [f"{k}={v}" for k, v in filter_info.items()]
            lines.append(f"> 筛选条件：{', '.join(parts)}")

        lines.append("")

        if scope in ("schedule", "full") and data.get("schedule"):
            lines.extend(self._markdown_schedule(data["schedule"]))

        if scope in ("conflicts", "full") and data.get("conflicts"):
            lines.extend(self._markdown_conflicts(data["conflicts"]))

        if scope in ("audit", "full") and data.get("audit_log"):
            lines.extend(self._markdown_audit(data["audit_log"]))

        if scope == "full":
            lines.extend(self._markdown_data_overview(data))

        return "\n".join(lines)

    def _markdown_schedule(self, schedule: Dict[str, Any]) -> List[str]:
        lines = [
            "## 排练方案",
            "",
            f"| 属性 | 值 |",
            f"|------|-----|",
            f"| 方案 ID | {schedule['id'][:8]} |",
            f"| 创建时间 | {schedule['created_at'][:19]} |",
            f"| 可用时间 | {schedule['total_available_minutes']:.0f} 分钟 |",
            f"| 已分配 | {schedule['total_allocated_minutes']:.0f} 分钟 |",
            f"| 剩余 | {schedule['total_available_minutes'] - schedule['total_allocated_minutes']:.0f} 分钟 |",
            "",
            "### 排练顺序",
            "",
            "| 序号 | 曲目 | 时长(min) | 优先级 | 难度因子 | 缺勤影响 | 紧迫度 |",
            "|------|------|-----------|--------|---------|---------|--------|",
        ]
        for entry in schedule.get("entries", []):
            lines.append(
                f"| {entry['order']} | {entry['piece_name']} | {entry['allocated_minutes']:.0f} "
                f"| {entry['priority_score']:.4f} | {entry['difficulty_factor']:.4f} "
                f"| {entry['absence_impact']:.4f} | {entry['urgency_factor']:.4f} |"
            )

        if schedule.get("excluded_piece_ids"):
            lines.append("")
            lines.append("### 被排除的曲目")
            lines.append("")
            for pid in schedule["excluded_piece_ids"]:
                piece = self.state.pieces.get(pid)
                name = piece.name if piece else pid
                lines.append(f"- {name}")

        lines.append("")
        return lines

    def _markdown_conflicts(self, conflicts_data: Dict[str, Any]) -> List[str]:
        items = conflicts_data.get("items", [])
        if not items:
            return ["## 冲突检测", "", "无冲突。", ""]

        lines = ["## 冲突检测", ""]

        by_type: Dict[str, list] = {}
        for item in items:
            by_type.setdefault(item["conflict_type"], []).append(item)

        type_labels = {
            "absence_duplicate": "缺勤重复",
            "difficulty_inversion": "难度权重反转",
            "time_overrun": "时间超排",
        }

        for ctype, group in by_type.items():
            label = type_labels.get(ctype, ctype)
            lines.append(f"### {label}（{len(group)} 项）")
            lines.append("")
            lines.append("| 级别 | 说明 | 详情 |")
            lines.append("|------|------|------|")
            for item in group:
                detail_str = "; ".join(
                    f"{k}={v}" for k, v in item["details"].items()
                    if k not in ("absence_ids", "affected_ids")
                )
                lines.append(f"| {item['severity']} | {item['title']} | {detail_str} |")
            lines.append("")

        return lines

    def _markdown_audit(self, audit_log: List[Dict[str, Any]]) -> List[str]:
        lines = ["## 审计日志", ""]
        for i, entry in enumerate(audit_log):
            before_flag = "✓" if entry.get("before_snapshot") else "—"
            after_flag = "✓" if entry.get("after_snapshot") else "—"
            lines.append(
                f"| #{i} | {entry['timestamp'][:19]} | {entry['action']} "
                f"| {entry['description']} | 变更前:{before_flag} 变更后:{after_flag} |"
            )
        lines.append("")
        return lines

    def _markdown_data_overview(self, data: Dict[str, Any]) -> List[str]:
        lines = [
            "## 数据概览",
            "",
            f"- 曲目：{len(data.get('pieces', {}))} 首",
            f"- 缺勤记录：{len(data.get('absences', {}))} 条",
            f"- 演出场次：{len(data.get('performances', {}))} 场",
            f"- 排练报告：{len(data.get('reports', {}))} 份",
            "",
        ]
        return lines
