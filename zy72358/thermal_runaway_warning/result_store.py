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
            "传感器编号", "原始行号", "时间戳", "原始值", "显示值",
            "单位", "阈值", "处理状态", "超阈值", "被平均值盖掉",
            "工况照片数", "审计记录数", "单位换算",
        ])
        for r in results:
            conv = ""
            if r.unit_conversion:
                conv = f"{r.unit_conversion.from_unit}->{r.unit_conversion.to_unit}(x{r.unit_conversion.factor})"
            writer.writerow([
                r.sensor_id,
                r.original_row,
                r.timestamp,
                r.raw_value,
                f"{r.display_value:.4f}",
                r.unit,
                r.threshold,
                r.status.value,
                r.is_over_threshold,
                r.suppressed_by_average,
                len(r.photos),
                len(r.audit_trail),
                conv,
            ])
        return output.getvalue()

    def to_api_response(self) -> Dict[str, Any]:
        results = self._ensure_results()
        over_threshold = [r for r in results if r.is_over_threshold]
        suppressed = [r for r in results if r.suppressed_by_average]

        evidence_summary: List[Dict[str, Any]] = []
        for r in over_threshold:
            photo_summaries = [
                {"path": p.photo_path, "desc": p.description, "by": p.attached_by}
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
            evidence_summary.append({
                "sensor_id": r.sensor_id,
                "original_row": r.original_row,
                "raw_value": r.raw_value,
                "threshold": r.threshold,
                "status": r.status.value,
                "suppressed_by_average": r.suppressed_by_average,
                "photos": photo_summaries,
                "audit_trail": audit_summary,
            })

        return {
            "total_records": len(results),
            "over_threshold_count": len(over_threshold),
            "suppressed_count": len(suppressed),
            "evidence_summary": evidence_summary,
            "details": self.get_results_dicts(),
        }

    def to_page_display(self) -> List[Dict[str, Any]]:
        results = self._ensure_results()
        display: List[Dict[str, Any]] = []
        for r in results:
            status_label = _status_label(r)
            display.append({
                "传感器编号": r.sensor_id,
                "原始行号": r.original_row,
                "时间戳": r.timestamp,
                "原始值": r.raw_value,
                "显示值": f"{r.display_value:.2f}",
                "单位": r.unit,
                "阈值": r.threshold,
                "状态": status_label,
                "超阈值": "⚠️ 是" if r.is_over_threshold else "否",
                "被平均值盖掉": "⚠️ 是" if r.suppressed_by_average else "否",
                "工况照片": ", ".join(p.description or p.photo_path for p in r.photos) or "无",
                "审计记录数": len(r.audit_trail),
            })
        return display


def _status_label(r: WarningResult) -> str:
    mapping = {
        "pending": "待处理",
        "threshold_exceeded": "⚠️ 超阈值",
        "awaiting_review": "🔍 待复核",
        "confirmed_abnormal": "🔴 确认异常",
        "confirmed_normal": "✅ 确认正常",
        "suppressed_by_average": "⚠️ 被平均值盖掉",
        "recalculated": "🔄 补录重算",
    }
    return mapping.get(r.status.value, r.status.value)
