from __future__ import annotations

import csv
import io
import json
from typing import Any, Dict, List, Optional

from .engine import ThermalRunawayEngine
from .models import WarningResult


class ResultStore:
    def __init__(self, engine: ThermalRunawayEngine):
        self._engine = engine
        self._cached_results: Optional[List[WarningResult]] = None
        self._dirty = True

    def invalidate(self) -> None:
        self._dirty = True
        self._cached_results = None

    def _ensure_results(self) -> List[WarningResult]:
        if self._dirty or self._cached_results is None:
            self._cached_results = self._engine.build_warning_results()
            self._dirty = False
        return self._cached_results

    def get_results(self) -> List[WarningResult]:
        return self._ensure_results()

    def get_results_dicts(self) -> List[Dict[str, Any]]:
        return [r.to_dict() for r in self._ensure_results()]

    def get_over_threshold_results(self) -> List[WarningResult]:
        return [r for r in self._ensure_results() if r.is_over_threshold]

    def get_suppressed_results(self) -> List[WarningResult]:
        return [r for r in self._ensure_results() if r.suppressed_by_average]

    def get_results_by_sensor(self, sensor_id: str) -> List[WarningResult]:
        return [r for r in self._ensure_results() if r.sensor_id == sensor_id]

    def to_json(self, indent: int = 2) -> str:
        return json.dumps(self.get_results_dicts(), ensure_ascii=False, indent=indent)

    def to_csv(self) -> str:
        results = self._ensure_results()
        if not results:
            return ""
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "传感器编号", "原始行号", "时间戳",
            "导入时原始值", "当前值", "改后值",
            "单位", "阈值", "平均值",
            "处理状态", "超阈值", "被平均值盖掉",
            "工况照片数", "审计记录数", "单位换算",
            "下一步找谁", "改值说明", "原始说法", "处理原因",
        ])
        for r in results:
            conv = ""
            if r.unit_conversion:
                conv = f"{r.unit_conversion.from_unit}->{r.unit_conversion.to_unit}(x{r.unit_conversion.factor})"
            orig_stmt = ""
            amended_reason = ""
            if r.review_decision:
                orig_stmt = r.review_decision.original_statement
                amended_reason = r.review_decision.amended_reason
            avg_text = f"{r.average_value:.2f}" if r.average_value is not None else ""
            writer.writerow([
                r.sensor_id,
                r.original_row,
                r.timestamp,
                r.original_import_value,
                r.raw_value,
                r.amended_value if r.amended_value is not None else "",
                r.unit,
                r.threshold,
                avg_text,
                _status_label(r),
                "是" if r.is_over_threshold else "否",
                "是" if r.suppressed_by_average else "否",
                len(r.photos),
                len(r.audit_trail),
                conv,
                r.next_reviewer,
                r.amendment_note,
                orig_stmt,
                amended_reason,
            ])
        return output.getvalue()

    def to_api_response(self) -> Dict[str, Any]:
        results = self._ensure_results()
        over_threshold = [r for r in results if r.is_over_threshold]
        suppressed = [r for r in results if r.suppressed_by_average]

        evidence_summary: List[Dict[str, Any]] = []
        for r in over_threshold:
            photo_summaries = [
                {
                    "path": p.photo_path,
                    "desc": p.description,
                    "by": p.attached_by,
                    "attached_to_original_row": p.attached_to_original_row,
                }
                for p in r.photos
            ]
            audit_summary = [
                {
                    "time": a.timestamp,
                    "field": a.field_changed,
                    "old": str(a.old_value),
                    "new": str(a.new_value),
                    "by": a.changed_by,
                    "reason": a.reason,
                }
                for a in r.audit_trail
            ]
            dec = r.review_decision
            decision_dict = None
            if dec is not None:
                decision_dict = {
                    "original_value": dec.original_value,
                    "amended_value": dec.amended_value,
                    "original_statement": dec.original_statement,
                    "amended_reason": dec.amended_reason,
                    "next_reviewer": dec.next_reviewer,
                    "decided_at": dec.decided_at,
                    "decided_by": dec.decided_by,
                }
            evidence_summary.append({
                "sensor_id": r.sensor_id,
                "original_row": r.original_row,
                "original_import_value": r.original_import_value,
                "current_value": r.raw_value,
                "display_value": r.display_value,
                "threshold": r.threshold,
                "average_value": r.average_value,
                "status": r.status.value,
                "is_over_threshold": r.is_over_threshold,
                "suppressed_by_average": r.suppressed_by_average,
                "photos": photo_summaries,
                "audit_trail": audit_summary,
                "next_reviewer": r.next_reviewer,
                "amendment_note": r.amendment_note,
                "review_decision": decision_dict,
            })

        return {
            "total_records": len(results),
            "over_threshold_count": len(over_threshold),
            "suppressed_count": len(suppressed),
            "evidence_summary": evidence_summary,
            "details": self.get_results_dicts(),
            "unified_source_note": (
                "列表、详情、摘要、导出四部分均读取 build_warning_results 同一份结果，"
                "超阈值被平均值盖掉的记录 status=suppressed_by_average 会在 is_over_threshold=True 下可见"
            ),
        }

    def to_page_display(self) -> List[Dict[str, Any]]:
        results = self._ensure_results()
        display: List[Dict[str, Any]] = []
        for r in results:
            status_label = _status_label(r)
            photos = []
            for p in r.photos:
                row_tag = f"(第{p.attached_to_original_row}行)" if p.attached_to_original_row else ""
                photos.append(f"{row_tag}{p.description or p.photo_path} by {p.attached_by}")
            dec = r.review_decision
            avg = f"{r.average_value:.2f}" if r.average_value is not None else "-"
            display.append({
                "传感器编号": r.sensor_id,
                "原始行号": r.original_row,
                "时间戳": r.timestamp,
                "导入原始值": r.original_import_value,
                "当前值": r.raw_value,
                "改后值": r.amended_value if r.amended_value is not None else "无",
                "显示值": f"{r.display_value:.2f}",
                "单位": r.unit,
                "阈值": r.threshold,
                "平均值": avg,
                "状态": status_label,
                "超阈值": "⚠️ 是" if r.is_over_threshold else "否",
                "被平均值盖掉": "⚠️ 是" if r.suppressed_by_average else "否",
                "改值说明": r.amendment_note or "无",
                "下一步找谁": r.next_reviewer or "无",
                "原始说法": dec.original_statement if dec else "无",
                "处理原因": dec.amended_reason if dec else "无",
                "复核人": dec.decided_by if dec else "无",
                "工况照片": "; ".join(photos) if photos else "无",
                "审计记录数": len(r.audit_trail),
            })
        return display

    def to_summary(self) -> Dict[str, Any]:
        results = self._ensure_results()
        over = [r for r in results if r.is_over_threshold]
        suppressed = [r for r in results if r.suppressed_by_average]
        awaiting = [r for r in results if r.status.value == "awaiting_review"]
        return {
            "total": len(results),
            "over_threshold_count": len(over),
            "suppressed_by_average_count": len(suppressed),
            "awaiting_review_count": len(awaiting),
            "confirmed_abnormal": sum(1 for r in results if r.status.value == "confirmed_abnormal"),
            "confirmed_normal": sum(1 for r in results if r.status.value == "confirmed_normal"),
            "next_reviewer_needed": [
                {
                    "sensor_id": r.sensor_id,
                    "original_row": r.original_row,
                    "next_reviewer": r.next_reviewer,
                    "suppressed": r.suppressed_by_average,
                }
                for r in over
                if r.next_reviewer
            ],
            "note": "summary/to_api_response/to_page_display/to_json/to_csv 均读取同一份 WarningResult",
        }


def _status_label(r: WarningResult) -> str:
    mapping = {
        "pending": "待处理",
        "threshold_exceeded": "⚠️ 超阈值",
        "awaiting_review": "🔍 待复核",
        "confirmed_abnormal": "🔴 确认异常",
        "confirmed_normal": "✅ 确认正常",
        "suppressed_by_average": "⚠️ 被平均值盖掉(待维修师傅复核)",
        "recalculated": "🔄 补录重算",
    }
    label = mapping.get(r.status.value, r.status.value)
    if r.suppressed_by_average and "平均值盖掉" not in label:
        label += " (有平均值掩盖风险)"
    return label
