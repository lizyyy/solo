from __future__ import annotations

import csv
import io
from dataclasses import dataclass
from typing import Dict, List

from .models import (
    AttrResult,
    AttrStatus,
    AttributionRecord,
    Influence,
    SourceType,
)
from .recalc import RecalcResult


@dataclass
class MaterialAction:
    source_type: str
    source_id: str
    action: str
    reason: str


class TeacherReport:
    def __init__(self, results: List[AttrResult]) -> None:
        self.results = results

    def example_text(self) -> str:
        if not self.results:
            return "（无样例数据）"
        r = self.results[0]
        lines = [
            "样例：",
            f"  学生 {r.record.student_id} · 题目 {r.record.question_id}",
            f"  主因 → {r.record.primary_cause}（置信度 {r.record.confidence:.1%}）",
            f"  当前状态：{self._status_cn(r.record.status)}",
            f"  处理建议：{r.teacher_hint}",
        ]
        if r.record.influences:
            lines.append("  影响来源：")
            for inf in r.record.influences[-3:]:
                lines.append(f"    · {self._source_cn(inf.source_type)} {inf.source_id}: {inf.detail}")
        return "\n".join(lines)

    def rerun_note_text(self, recalc: RecalcResult) -> str:
        r = recalc.recalculated
        lines = [
            "重跑说明：",
            f"  复算后主因：{r.primary_cause}（原主因：{recalc.original.primary_cause}）",
            f"  置信度：{r.confidence:.1%}（原：{recalc.original.confidence:.1%}）",
            f"  图表/明细口径一致：{'是' if recalc.chart_detail_consistent else '否，需排查'}",
        ]
        diff_items = [(k, v) for k, v in recalc.diff_weights.items() if abs(v) > 1e-4]
        if diff_items:
            lines.append("  知识点权重变化：")
            for k, v in sorted(diff_items, key=lambda x: -abs(x[1])):
                arrow = "↑" if v > 0 else "↓"
                lines.append(f"    · {k} {arrow} {abs(v):.3f}")
        else:
            lines.append("  知识点权重变化：无显著变化")
        return "\n".join(lines)

    def csv_detail(self) -> str:
        if not self.results:
            return ""
        buf = io.StringIO()
        rows = []
        for r in self.results:
            rows.extend(r.csv_rows)
        if not rows:
            return ""
        writer = csv.DictWriter(buf, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        for row in rows:
            writer.writerow(row)
        return buf.getvalue()

    def material_actions(self) -> List[MaterialAction]:
        actions: List[MaterialAction] = []
        seen: set = set()
        for r in self.results:
            rec = r.record
            if rec.status == AttrStatus.SUSPENDED:
                key = ("suspend", rec.record_id)
                if key not in seen:
                    seen.add(key)
                    actions.append(
                        MaterialAction(
                            source_type="系统挂起",
                            source_id=rec.record_id,
                            action="排班同事先确认",
                            reason=rec.suspend_reason or "除零或边界异常",
                        )
                    )
                continue
            for inf in rec.influences:
                if inf.source_type == SourceType.PARAM_OLD and "拦截" not in inf.detail and "挂起" not in inf.detail:
                    key = ("param_old", inf.source_id)
                    if key not in seen:
                        seen.add(key)
                        actions.append(
                            MaterialAction(
                                source_type="参数表旧版",
                                source_id=inf.source_id,
                                action="核对是否要替换为现行版",
                                reason=inf.detail[:60],
                            )
                        )
                if inf.source_type in (SourceType.LATER_NOTE, SourceType.VERBAL_NOTE):
                    key = (inf.source_type.value, inf.source_id)
                    if key not in seen:
                        seen.add(key)
                        if "无可解析" in inf.detail or "未生效" in inf.detail:
                            act = "补材料：备注格式改成 '知识点=权重'，每行一条"
                        else:
                            act = "可放行：已影响结论，核对无误后归档"
                        actions.append(
                            MaterialAction(
                                source_type=self._source_cn(inf.source_type),
                                source_id=inf.source_id,
                                action=act,
                                reason=inf.detail[:60],
                            )
                        )
        return actions

    def summary_text(self) -> str:
        lines = []
        total = len(self.results)
        normal = sum(1 for r in self.results if r.record.status == AttrStatus.NORMAL)
        suspended = sum(1 for r in self.results if r.record.status == AttrStatus.SUSPENDED)
        released = sum(1 for r in self.results if r.record.status == AttrStatus.RELEASED)
        need = sum(1 for r in self.results if r.record.status == AttrStatus.NEED_MATERIAL)
        lines.append(f"合计 {total} 条：正常 {normal}，挂起 {suspended}，已放行 {released}，待补料 {need}")
        lines.append("")
        lines.append("——材料处理清单——")
        actions = self.material_actions()
        if not actions:
            lines.append("  无待办材料")
        else:
            for a in actions:
                lines.append(f"  [{a.source_type}] {a.source_id}")
                lines.append(f"    → {a.action}")
                lines.append(f"    原因：{a.reason}")
        return "\n".join(lines)

    @staticmethod
    def _status_cn(s: AttrStatus) -> str:
        return {
            AttrStatus.PENDING: "待处理",
            AttrStatus.NORMAL: "正常",
            AttrStatus.SUSPENDED: "挂起待确认",
            AttrStatus.REVISED: "已改判",
            AttrStatus.RELEASED: "已放行",
            AttrStatus.NEED_MATERIAL: "待补材料",
        }.get(s, s.value)

    @staticmethod
    def _source_cn(s: SourceType) -> str:
        return {
            SourceType.PARAM_OLD: "参数表旧版",
            SourceType.PARAM_CURRENT: "参数表现行版",
            SourceType.LATER_NOTE: "后补备注",
            SourceType.VERBAL_NOTE: "口头备注",
        }.get(s, s.value)
