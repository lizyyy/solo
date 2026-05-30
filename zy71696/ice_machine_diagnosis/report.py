from __future__ import annotations

import csv
import json
import os
from datetime import datetime
from typing import List, Optional

from .models import DiagnosisResult


class ReportGenerator:
    """
    报告生成与导出模块

    设计原则:
    - 报告中所有数字和明细列表来自同一套DiagnosisResult, 不做二次加工
    - 导出报告自包含: 包含处理口径、公式说明、审计日志, 无需反查数据库
    - 支持JSON和CSV格式
    - 报告中标注数据质量, 让读者区分实测值与插补值
    """

    def __init__(self, result: DiagnosisResult):
        self.result = result

    def to_json(self, filepath: Optional[str] = None, pretty: bool = True) -> str:
        data = self._build_full_report()
        text = json.dumps(data, ensure_ascii=False, indent=2 if pretty else None)
        if filepath:
            os.makedirs(os.path.dirname(filepath) if os.path.dirname(filepath) else ".", exist_ok=True)
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(text)
        return text

    def to_csv(self, filepath: str) -> None:
        os.makedirs(os.path.dirname(filepath) if os.path.dirname(filepath) else ".", exist_ok=True)
        self._write_segments_csv(filepath)
        anomaly_path = filepath.replace(".csv", "_anomalies.csv")
        self._write_anomalies_csv(anomaly_path)
        attribution_path = filepath.replace(".csv", "_attribution.csv")
        self._write_attribution_csv(attribution_path)
        audit_path = filepath.replace(".csv", "_audit.csv")
        self._write_audit_csv(audit_path)

    def to_text(self, filepath: Optional[str] = None) -> str:
        lines = []
        r = self.result

        lines.append("=" * 70)
        lines.append("制冰机能耗异常诊断报告")
        lines.append("=" * 70)
        lines.append(f"设备编号: {r.equipment_id}")
        lines.append(f"诊断时间: {r.diagnosis_time.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"整体工况: {r.overall_grade.value}")
        lines.append("")

        lines.append("-" * 70)
        lines.append("一、能耗归因")
        lines.append("-" * 70)
        attr = r.energy_attribution
        lines.append(f"  总能耗:        {attr.total_energy_kwh:>10.2f} kWh")
        lines.append(f"  基准能耗:      {attr.base_energy_kwh:>10.2f} kWh")
        lines.append(f"  温度附加:      {attr.temperature_surcharge_kwh:>10.2f} kWh")
        lines.append(f"  开门附加:      {attr.door_surcharge_kwh:>10.2f} kWh")
        lines.append(f"  异常附加:      {attr.anomaly_surcharge_kwh:>10.2f} kWh")
        lines.append(f"  未解释:        {attr.unexplained_kwh:>10.2f} kWh")
        pct = attr.attribution_pct
        if pct:
            lines.append("")
            lines.append(f"  基准占比:      {pct.get('base_pct', 0):>9.1f}%")
            lines.append(f"  温度占比:      {pct.get('temperature_pct', 0):>9.1f}%")
            lines.append(f"  开门占比:      {pct.get('door_pct', 0):>9.1f}%")
            lines.append(f"  异常占比:      {pct.get('anomaly_pct', 0):>9.1f}%")
            lines.append(f"  未解释占比:    {pct.get('unexplained_pct', 0):>9.1f}%")
        lines.append("")

        lines.append("-" * 70)
        lines.append("二、工况分段")
        lines.append("-" * 70)
        for seg in r.condition_segments:
            lines.append(
                f"  {seg.start_time.strftime('%H:%M')}-{seg.end_time.strftime('%H:%M')}  "
                f"[{seg.grade.value:>8s}]  "
                f"SEC={seg.avg_sec_kwh_per_kg:.3f}kWh/kg  "
                f"比值={seg.sec_ratio_vs_baseline:.2f}x  "
                f"产冰={seg.total_production_kg:.1f}kg  "
                f"能耗={seg.total_energy_kwh:.2f}kWh  "
                f"环境温度={seg.avg_temperature_c:.1f}°C  "
                f"开门={seg.door_open_count}次"
            )
        lines.append("")

        lines.append("-" * 70)
        lines.append("三、异常标注")
        lines.append("-" * 70)
        if r.anomalies:
            for a in r.anomalies:
                end_str = a.end_time.strftime("%H:%M") if a.end_time else "—"
                lines.append(
                    f"  [{a.severity.value:>8s}] {a.anomaly_type.value}\n"
                    f"    时段: {a.start_time.strftime('%H:%M')}-{end_str}\n"
                    f"    详情: {a.detail}\n"
                    f"    影响记录数: {a.affected_records}"
                )
        else:
            lines.append("  无异常")
        lines.append("")

        lines.append("-" * 70)
        lines.append("四、维修建议")
        lines.append("-" * 70)
        for s in r.maintenance_suggestions:
            lines.append(
                f"  [{s.priority.value:>8s}] {s.category}\n"
                f"    建议: {s.action}\n"
                f"    依据: {s.rationale}"
            )
        lines.append("")

        lines.append("-" * 70)
        lines.append("五、处理口径")
        lines.append("-" * 70)
        lines.append(r.processing_methodology)
        lines.append("")

        lines.append("-" * 70)
        lines.append("六、审计日志 (数据处理痕迹)")
        lines.append("-" * 70)
        for entry in r.audit_trail:
            lines.append(
                f"  {entry.timestamp.strftime('%H:%M:%S')}  "
                f"字段={entry.field}  "
                f"方法={entry.method}  "
                f"原值={entry.original_value}  "
                f"调整值={entry.adjusted_value}  "
                f"原因={entry.reason}"
            )
        lines.append("")

        lines.append("=" * 70)
        lines.append("报告结束")
        lines.append("=" * 70)

        text = "\n".join(lines)
        if filepath:
            os.makedirs(os.path.dirname(filepath) if os.path.dirname(filepath) else ".", exist_ok=True)
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(text)
        return text

    def _build_full_report(self) -> dict:
        return {
            "report_header": {
                "title": "制冰机能耗异常诊断报告",
                "equipment_id": self.result.equipment_id,
                "diagnosis_time": self.result.diagnosis_time.isoformat(),
                "overall_grade": self.result.overall_grade.value,
                "report_version": "1.0",
                "consistency_declaration": (
                    "本报告所有数字和明细列表均来自同一次诊断计算结果, "
                    "未做二次加工。数据处理痕迹详见audit_trail字段。"
                ),
            },
            "energy_attribution": self.result.energy_attribution.to_dict(),
            "condition_segments": [s.to_dict() for s in self.result.condition_segments],
            "anomalies": [a.to_dict() for a in self.result.anomalies],
            "maintenance_suggestions": [s.to_dict() for s in self.result.maintenance_suggestions],
            "audit_trail": [e.to_dict() for e in self.result.audit_trail],
            "processing_methodology": self.result.processing_methodology,
        }

    def _write_segments_csv(self, filepath: str) -> None:
        with open(filepath, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([
                "start_time", "end_time", "grade", "avg_sec_kwh_per_kg",
                "sec_ratio_vs_baseline", "total_production_kg", "total_energy_kwh",
                "avg_temperature_c", "door_open_count", "anomaly_count",
            ])
            for seg in self.result.condition_segments:
                writer.writerow([
                    seg.start_time.isoformat(),
                    seg.end_time.isoformat(),
                    seg.grade.value,
                    round(seg.avg_sec_kwh_per_kg, 4),
                    round(seg.sec_ratio_vs_baseline, 4),
                    round(seg.total_production_kg, 2),
                    round(seg.total_energy_kwh, 2),
                    round(seg.avg_temperature_c, 2),
                    seg.door_open_count,
                    len(seg.anomalies),
                ])

    def _write_anomalies_csv(self, filepath: str) -> None:
        with open(filepath, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([
                "anomaly_type", "start_time", "end_time", "severity",
                "detail", "affected_records", "audit_ref",
            ])
            for a in self.result.anomalies:
                writer.writerow([
                    a.anomaly_type.value,
                    a.start_time.isoformat(),
                    a.end_time.isoformat() if a.end_time else "",
                    a.severity.value,
                    a.detail,
                    a.affected_records,
                    a.audit_ref or "",
                ])

    def _write_attribution_csv(self, filepath: str) -> None:
        with open(filepath, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["item", "value_kwh", "pct"])
            attr = self.result.energy_attribution
            pct = attr.attribution_pct
            items = [
                ("total", attr.total_energy_kwh, "100.00"),
                ("base", attr.base_energy_kwh, pct.get("base_pct", 0)),
                ("temperature_surcharge", attr.temperature_surcharge_kwh, pct.get("temperature_pct", 0)),
                ("door_surcharge", attr.door_surcharge_kwh, pct.get("door_pct", 0)),
                ("anomaly_surcharge", attr.anomaly_surcharge_kwh, pct.get("anomaly_pct", 0)),
                ("unexplained", attr.unexplained_kwh, pct.get("unexplained_pct", 0)),
            ]
            for name, val, p in items:
                writer.writerow([name, round(val, 2), p])

    def _write_audit_csv(self, filepath: str) -> None:
        with open(filepath, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([
                "timestamp", "field", "method", "original_value",
                "adjusted_value", "reason", "can_override",
            ])
            for e in self.result.audit_trail:
                writer.writerow([
                    e.timestamp.isoformat(),
                    e.field,
                    e.method,
                    e.original_value,
                    e.adjusted_value,
                    e.reason,
                    e.can_override,
                ])
