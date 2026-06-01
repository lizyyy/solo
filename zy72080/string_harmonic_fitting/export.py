import csv
import json
from datetime import datetime
from typing import List, Dict, Optional, Tuple

from .models import (
    FittingResult,
    ManualNote,
    NoteDiff,
    OutOfBoundsSample,
    save_csv,
    load_csv,
)
from .traceability import TraceLog


class Exporter:
    """
    可追溯导出器: 导出拟合结果时携带完整原因、原始来源和处理时间

    支持两种格式:
    - CSV: 适合表格工具打开，reasoning 等多值字段以 JSON 字符串嵌入
    - 可读文本: 适合人工审查，每条判断依据单独一行
    """

    def export_csv(self, results: List[FittingResult], path: str):
        save_csv(path, results)

    def export_readable(self, results: List[FittingResult], path: str):
        lines = []
        for r in results:
            lines.append("=" * 60)
            lines.append(f"拟合结果 ID: {r.result_id}")
            lines.append(f"乐器: {r.instrument}  弦序号: {r.string_index}")
            lines.append(f"拟合基频 f1 = {r.fitted_f1:.4f} Hz")
            lines.append(f"非谐性系数 B = {r.fitted_B:.8f}")
            lines.append(f"模型: f_n = n × {r.fitted_f1:.4f} × sqrt(1 + {r.fitted_B:.8f} × n²)")
            lines.append(f"处理时间: {r.timestamp}")
            lines.append("")

            lines.append("── 判断依据 ──")
            for i, reason in enumerate(r.reasoning, 1):
                lines.append(f"  {i}. {reason}")
            lines.append("")

            if r.residuals:
                lines.append("── 各泛音残差 (观测 - 拟合) ──")
                for n in sorted(r.residuals.keys()):
                    lines.append(f"  n={n}: {r.residuals[n]:+.6f} Hz")
                lines.append("")

            if r.weights_used:
                lines.append("── 使用的权重 ──")
                for n in sorted(r.weights_used.keys()):
                    lines.append(f"  n={n}: {r.weights_used[n]:.4f}")
                lines.append("")

            if r.boundary_alerts:
                lines.append("── 边界阈值告警 ──")
                for alert in r.boundary_alerts:
                    lines.append(f"  {alert}")
                lines.append("")

            if r.unit_conversion_notes:
                lines.append("── 单位换算记录 ──")
                for note in r.unit_conversion_notes:
                    lines.append(f"  {note}")
                lines.append("")

            if r.original_sources:
                lines.append("── 原始来源 ──")
                for src in r.original_sources:
                    lines.append(f"  {src}")
                lines.append("")

            if r.note_refs:
                lines.append("── 关联人工备注 ──")
                for ref in r.note_refs:
                    lines.append(f"  {ref}")
                lines.append("")

        with open(path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))

    def export_trace_log(self, trace_log: TraceLog, path: str):
        trace_log.save(path)

    def export_trace_log_readable(self, trace_log: TraceLog, path: str):
        with open(path, "w", encoding="utf-8") as f:
            f.write(trace_log.format_readable())


class NoteManager:
    """
    备注补录管理器: 老叶补录备注后，计算并说明补录前后的差异

    每条差异都记录: 哪个字段变了、变前值、变后值、原因、操作者、时间
    """

    def __init__(self, trace_log: Optional[TraceLog] = None):
        self.trace_log = trace_log or TraceLog()
        self.notes: List[ManualNote] = []
        self.diffs: List[NoteDiff] = []

    def add_note(
        self,
        note: ManualNote,
        before_result: Optional[FittingResult] = None,
        after_result: Optional[FittingResult] = None,
    ):
        self.notes.append(note)

        if before_result and after_result:
            diffs = self._compute_diffs(note, before_result, after_result)
            self.diffs.extend(diffs)

        self.trace_log.add(
            action="add_note",
            source=note.source,
            detail=f"补录备注: {note.note_text}",
            operator=note.author,
            extra={"note_id": note.note_id},
        )

    def _compute_diffs(
        self,
        note: ManualNote,
        before: FittingResult,
        after: FittingResult,
    ) -> List[NoteDiff]:
        diffs = []

        if before.fitted_f1 != after.fitted_f1:
            diffs.append(NoteDiff(
                note_id=note.note_id,
                field="fitted_f1",
                before=f"{before.fitted_f1:.4f} Hz",
                after=f"{after.fitted_f1:.4f} Hz",
                reason=f"备注[{note.note_id}]补录后重新拟合: {note.note_text}",
                author=note.author,
            ))

        if before.fitted_B != after.fitted_B:
            diffs.append(NoteDiff(
                note_id=note.note_id,
                field="fitted_B",
                before=f"{before.fitted_B:.8f}",
                after=f"{after.fitted_B:.8f}",
                reason=f"备注[{note.note_id}]补录后重新拟合: {note.note_text}",
                author=note.author,
            ))

        before_residual_keys = set(before.residuals.keys())
        after_residual_keys = set(after.residuals.keys())
        changed_residuals = []
        for n in before_residual_keys | after_residual_keys:
            b_val = before.residuals.get(n, None)
            a_val = after.residuals.get(n, None)
            if b_val != a_val:
                changed_residuals.append(f"n={n}: {b_val} → {a_val}")
        if changed_residuals:
            diffs.append(NoteDiff(
                note_id=note.note_id,
                field="residuals",
                before="see_before_result",
                after="see_after_result",
                reason=f"备注[{note.note_id}]补录后残差变化: {'; '.join(changed_residuals)}",
                author=note.author,
            ))

        if not diffs:
            diffs.append(NoteDiff(
                note_id=note.note_id,
                field="none",
                before="",
                after="",
                reason=f"备注[{note.note_id}]补录后拟合结果未发生变化",
                author=note.author,
            ))

        return diffs

    def format_diffs(self) -> str:
        lines = []
        for d in self.diffs:
            lines.append(f"── 备注补录差异 [{d.note_id}] ──")
            lines.append(f"  字段: {d.field}")
            lines.append(f"  变更前: {d.before}")
            lines.append(f"  变更后: {d.after}")
            lines.append(f"  原因: {d.reason}")
            lines.append(f"  操作者: {d.author}")
            lines.append(f"  时间: {d.timestamp}")
            lines.append("")
        return "\n".join(lines)

    def save_diffs_csv(self, path: str):
        if not self.diffs:
            return
        with open(path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=["note_id", "field", "before", "after", "reason", "author", "timestamp"])
            writer.writeheader()
            for d in self.diffs:
                writer.writerow(d.to_dict())
