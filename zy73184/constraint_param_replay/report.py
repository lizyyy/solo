import json
import os
from typing import Dict, Any, List
from datetime import datetime

from .models import ReplayReport, RowStatus


class ReportGenerator:
    def __init__(self, output_dir: str = "output"):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)

    def _format_source_detail_tag(self, sd):
        tags = []
        if sd.affects_value:
            tags.append("改值")
        if sd.affects_judgment:
            tags.append("改判断")
        if not tags:
            tags.append("仅说明")
        return "、".join(tags)

    def generate_text_report(self, report: ReplayReport) -> str:
        lines = []
        lines.append("=" * 70)
        lines.append("  约束规划参数回放 - 一页式复核报告")
        lines.append("=" * 70)
        lines.append("")

        lines.append("【基本信息】")
        lines.append(f"  参数版本: {report.param_version}")
        lines.append(f"  生成时间: {report.timestamp}")
        lines.append("")

        s = report.summary
        lines.append("【统计概览】")
        lines.append(f"  总计:       {s.total} 行")
        lines.append(f"  已处理:     {s.processed} 行")
        lines.append(f"  坏行:       {s.bad} 行")
        lines.append(f"  跳过行:     {s.skipped} 行")
        lines.append(f"  排序不稳定: {s.sort_unstable} 行")
        lines.append("")

        lines.append("【影响统计】")
        lines.append(f"  受晚到附件影响: {s.affected_by_attachment} 行")
        lines.append(f"  受口头备注影响: {s.affected_by_note} 行")
        lines.append(f"  受旧版答案影响: {s.affected_by_old_history} 行")
        lines.append(f"  有单位换算:     {s.has_unit_conversion} 行")
        lines.append("")

        if s.by_source:
            lines.append("【按来源分布】")
            for src, cnt in sorted(s.by_source.items()):
                lines.append(f"  {src}: {cnt} 行")
            lines.append("")

        if s.by_formula:
            lines.append("【按公式分布】")
            for formula, cnt in sorted(s.by_formula.items()):
                lines.append(f"  {formula}: {cnt} 行")
            lines.append("")

        if report.abnormal_points:
            lines.append("【异常点】")
            for i, ab in enumerate(report.abnormal_points, 1):
                lines.append(f"  {i}. [{ab['type']}] {ab['row_id']}: {ab['detail']}")
            lines.append("")

        if report.judgment_changes:
            lines.append("【判断调整记录】")
            for j in report.judgment_changes:
                lines.append(f"  [{j.timestamp}] {j.operator or '未知操作人'}")
                lines.append(f"    旧判断: {j.old_judgment}")
                lines.append(f"    新判断: {j.new_judgment}")
                lines.append(f"    说明:   {j.reason}")
            lines.append("")

        if report.sort_unstable_rows:
            lines.append("【排序不稳定记录（单独拎出，不混入正常结果）】")
            for row in report.sort_unstable_rows:
                lines.append(f"  - {row.row_id}: {row.sort_unstable_reason}")
                lines.append(f"    当前值: {row.value} {row.unit}")
                lines.append(f"    解释: {row.explanation}")
                lines.append(f"    来源: {', '.join(sd.source_type.label + '(' + self._format_source_detail_tag(sd) + ')' for sd in row.source_details)}")
            lines.append("")

        if report.bad_rows:
            lines.append("【坏行明细】")
            for row in report.bad_rows:
                lines.append(f"  - {row.row_id or '(空ID)'}: {row.error_msg}")
            lines.append("")

        if report.skipped_rows:
            lines.append("【跳过行明细】")
            for row in report.skipped_rows:
                lines.append(f"  - {row.row_id}: {row.skip_reason}")
            lines.append("")

        affected_rows = [r for r in report.rows if (
            r.status == RowStatus.PROCESSED or r.status == RowStatus.SORT_UNSTABLE
        ) and (
            r.affected_by_attachment or r.affected_by_note or r.affected_by_old_history
        )]
        if affected_rows:
            lines.append("【受影响记录明细（按记录可查来源与差异）】")
            for row in affected_rows:
                lines.append(f"  ▶ {row.row_id}")
                lines.append(f"    最终值: {row.value} {row.unit}")
                if row.base_value is not None and row.value_diff:
                    lines.append(f"    基准值: {row.base_value} {row.base_unit}")
                    lines.append(f"    差  异: {row.value_diff}")
                if row.formula_name:
                    ver_str = f" (版本: {row.formula_version})" if row.formula_version else ""
                    lines.append(f"    公  式: {row.formula_name}{ver_str}")
                lines.append(f"    解  释: {row.explanation}")
                if row.unit_conversion_basis:
                    lines.append(f"    单位依据: {row.unit_conversion_basis}")
                if row.source_details:
                    lines.append(f"    来源详情:")
                    for sd in row.source_details:
                        tag = self._format_source_detail_tag(sd)
                        file_info = f" [文件: {sd.file_name}]" if sd.file_name else ""
                        ver_info = f" [版本: {sd.version}]" if sd.version else ""
                        lines.append(f"      · [{sd.source_type.label}, {tag}]{file_info}{ver_info}")
                        lines.append(f"        内容摘要: {sd.content_summary}")
                        if sd.impact_description:
                            lines.append(f"        影响说明: {sd.impact_description}")
                lines.append("")

        if report.unit_mismatch_notes:
            lines.append("【单位换算说明】")
            for note in report.unit_mismatch_notes:
                lines.append(f"  - {note}")
            lines.append("")

        lines.append("【已处理行总览】")
        processed_rows = [r for r in report.rows if r.status == RowStatus.PROCESSED]
        for row in processed_rows[:20]:
            sources_str = ", ".join(s.label for s in row.sources)
            lines.append(f"  {row.row_id}: {row.value} {row.unit}  (来源: {sources_str})")
            if row.explanation:
                lines.append(f"         解释: {row.explanation}")
        if len(processed_rows) > 20:
            lines.append(f"  ... 共 {len(processed_rows)} 行，仅展示前20行")
        lines.append("")

        lines.append("=" * 70)
        lines.append("  报告结束")
        lines.append("=" * 70)

        return "\n".join(lines)

    def generate_json_report(self, report: ReplayReport) -> Dict[str, Any]:
        def _row_to_dict(r):
            return {
                "row_id": r.row_id,
                "value": r.value,
                "unit": r.unit,
                "formula_name": r.formula_name,
                "formula_version": r.formula_version,
                "status": r.status.value,
                "base_value": r.base_value,
                "base_unit": r.base_unit,
                "base_formula_name": r.base_formula_name,
                "base_source": r.base_source,
                "sources": [s.value for s in r.sources],
                "source_details": [
                    {
                        "source_type": sd.source_type.value,
                        "source_label": sd.source_type.label,
                        "file_name": sd.file_name,
                        "content_summary": sd.content_summary,
                        "affects_value": sd.affects_value,
                        "affects_judgment": sd.affects_judgment,
                        "impact_description": sd.impact_description,
                        "version": sd.version,
                    }
                    for sd in r.source_details
                ],
                "affected_by_attachment": r.affected_by_attachment,
                "affected_by_note": r.affected_by_note,
                "affected_by_old_history": r.affected_by_old_history,
                "value_diff": r.value_diff,
                "unit_conversion_basis": r.unit_conversion_basis,
                "explanation": r.explanation,
                "error_msg": r.error_msg,
                "skip_reason": r.skip_reason,
                "sort_unstable_reason": r.sort_unstable_reason,
                "judgments": [
                    {
                        "timestamp": j.timestamp,
                        "old_judgment": j.old_judgment,
                        "new_judgment": j.new_judgment,
                        "reason": j.reason,
                        "operator": j.operator,
                    }
                    for j in r.judgments
                ],
            }

        return {
            "param_version": report.param_version,
            "timestamp": report.timestamp,
            "summary": report.summary.to_dict(),
            "abnormal_points": report.abnormal_points,
            "unit_mismatch_notes": report.unit_mismatch_notes,
            "sort_unstable_rows": [_row_to_dict(r) for r in report.sort_unstable_rows],
            "bad_rows": [_row_to_dict(r) for r in report.bad_rows],
            "skipped_rows": [_row_to_dict(r) for r in report.skipped_rows],
            "processed_rows": [
                _row_to_dict(r) for r in report.rows if r.status == RowStatus.PROCESSED
            ],
            "all_rows": [_row_to_dict(r) for r in report.rows],
            "judgment_changes": [
                {
                    "timestamp": j.timestamp,
                    "old_judgment": j.old_judgment,
                    "new_judgment": j.new_judgment,
                    "reason": j.reason,
                    "operator": j.operator,
                }
                for j in report.judgment_changes
            ],
        }

    def save_report(self, report: ReplayReport, filename: str = None):
        if not filename:
            ts = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"replay_report_{report.param_version}_{ts}"

        txt_path = os.path.join(self.output_dir, f"{filename}.txt")
        json_path = os.path.join(self.output_dir, f"{filename}.json")

        text_report = self.generate_text_report(report)
        with open(txt_path, "w", encoding="utf-8") as f:
            f.write(text_report)

        json_report = self.generate_json_report(report)
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(json_report, f, ensure_ascii=False, indent=2)

        return txt_path, json_path

    def save_judgment_change(self, row_id: str, old_judgment: str, new_judgment: str,
                              reason: str, operator: str = ""):
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        record = {
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "row_id": row_id,
            "old_judgment": old_judgment,
            "new_judgment": new_judgment,
            "reason": reason,
            "operator": operator,
        }

        filepath = os.path.join(self.output_dir, "judgment_changes.jsonl")
        with open(filepath, "a", encoding="utf-8") as f:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")

        return filepath
