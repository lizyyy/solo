import csv
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from .config import ProjectConfig
from .models import (
    AnalysisResult,
    Risk,
    RiskType,
    RiskSeverity,
    ReviewStatus,
)


class ReportExporter:
    def __init__(self, config: ProjectConfig):
        self.config = config

    def export_markdown(
        self,
        result: AnalysisResult,
        output_path: str,
        reviewed_risks: Optional[List[Risk]] = None,
    ) -> str:
        output_path = Path(output_path)
        
        lines = []
        lines.append("# 临电负载对账报告")
        lines.append("")
        lines.append(f"**项目名称**: {self.config.project_name}")
        lines.append(f"**演出名称**: {self.config.show_name}")
        lines.append(f"**分析时间**: {result.generated_at.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"**时间窗口**: {result.time_window_minutes} 分钟")
        lines.append("")

        lines.append("## 风险汇总")
        lines.append("")
        
        summary = result.summary
        lines.append(f"| 风险等级 | 数量 |")
        lines.append(f"|----------|------|")
        lines.append(f"| 严重 (CRITICAL) | {summary['by_severity'].get('critical', 0)} |")
        lines.append(f"| 高 (HIGH) | {summary['by_severity'].get('high', 0)} |")
        lines.append(f"| 中 (MEDIUM) | {summary['by_severity'].get('medium', 0)} |")
        lines.append(f"| 低 (LOW) | {summary['by_severity'].get('low', 0)} |")
        lines.append("")

        lines.append(f"| 风险类型 | 数量 |")
        lines.append(f"|----------|------|")
        lines.append(f"| 持续超载 | {summary['by_type'].get('sustained_overload', 0)} |")
        lines.append(f"| 三相不平衡 | {summary['by_type'].get('phase_imbalance', 0)} |")
        lines.append(f"| 计划外上电 | {summary['by_type'].get('unplanned_power', 0)} |")
        lines.append(f"| 时间偏差 | {summary['by_type'].get('time_deviation', 0)} |")
        lines.append("")

        lines.append("## 峰值负载汇总")
        lines.append("")
        lines.append("| 回路 | 峰值电流 (A) | 额定电流 (A) | 使用率 (%) |")
        lines.append("|------|-------------|--------------|-----------|")
        
        for circuit in self.config.circuits:
            peak = result.peak_loads.get(circuit.id, 0.0)
            utilization = (peak / circuit.rated_current * 100) if circuit.rated_current > 0 else 0
            lines.append(
                f"| {circuit.id} ({circuit.name}) | {peak:.2f} | "
                f"{circuit.rated_current:.1f} | {utilization:.1f}% |"
            )
        lines.append("")

        risk_map = {}
        if reviewed_risks:
            risk_map = {r.id: r for r in reviewed_risks}

        severity_order = [RiskSeverity.CRITICAL, RiskSeverity.HIGH, RiskSeverity.MEDIUM, RiskSeverity.LOW]
        severity_names = {
            RiskSeverity.CRITICAL: "严重",
            RiskSeverity.HIGH: "高",
            RiskSeverity.MEDIUM: "中",
            RiskSeverity.LOW: "低",
        }

        type_order = [
            RiskType.SUSTAINED_OVERLOAD,
            RiskType.PHASE_IMBALANCE,
            RiskType.UNPLANNED_POWER,
            RiskType.TIME_DEVIATION,
        ]
        type_names = {
            RiskType.SUSTAINED_OVERLOAD: "持续超载",
            RiskType.PHASE_IMBALANCE: "三相不平衡",
            RiskType.UNPLANNED_POWER: "计划外上电",
            RiskType.TIME_DEVIATION: "时间偏差",
        }

        for risk_type in type_order:
            type_risks = [r for r in result.all_risks if r.risk_type == risk_type]
            if not type_risks:
                continue

            lines.append(f"## {type_names[risk_type]}风险详情")
            lines.append("")

            for severity in severity_order:
                severity_risks = [r for r in type_risks if r.severity == severity]
                if not severity_risks:
                    continue

                lines.append(f"### {severity_names[severity]}等级")
                lines.append("")

                for i, risk in enumerate(severity_risks, 1):
                    reviewed_risk = risk_map.get(risk.id)
                    review_status = reviewed_risk.review_status if reviewed_risk else ReviewStatus.PENDING
                    review_note = reviewed_risk.review_note if reviewed_risk else None

                    lines.append(f"#### 风险 {i}")
                    lines.append("")
                    lines.append(f"**消息**: {risk.message}")
                    lines.append(f"**时间**: {risk.timestamp.strftime('%Y-%m-%d %H:%M:%S')}")
                    if risk.circuit_id:
                        lines.append(f"**回路**: {risk.circuit_id}")
                    if risk.device_id:
                        lines.append(f"**设备ID**: {risk.device_id}")
                    if risk.device_name:
                        lines.append(f"**设备名称**: {risk.device_name}")
                    
                    status_icon = {
                        ReviewStatus.PENDING: "⏳",
                        ReviewStatus.CONFIRMED: "✅",
                        ReviewStatus.IGNORED: "❌",
                    }.get(review_status, "⏳")
                    
                    lines.append(f"**复核状态**: {status_icon} {review_status.value}")
                    if review_note:
                        lines.append(f"**复核备注**: {review_note}")

                    if risk.details:
                        lines.append("")
                        lines.append("**详情**:")
                        lines.append("```")
                        for key, value in risk.details.items():
                            lines.append(f"  {key}: {value}")
                        lines.append("```")
                    
                    lines.append("")

        with open(output_path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))
        
        return str(output_path)

    def export_risk_csv(
        self,
        result: AnalysisResult,
        output_path: str,
        reviewed_risks: Optional[List[Risk]] = None,
    ) -> str:
        output_path = Path(output_path)
        
        risk_map = {}
        if reviewed_risks:
            risk_map = {r.id: r for r in reviewed_risks}

        fieldnames = [
            "id", "risk_type", "severity", "message", "timestamp",
            "circuit_id", "device_id", "device_name",
            "review_status", "review_note", "details_json",
        ]

        with open(output_path, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()

            for risk in result.all_risks:
                reviewed_risk = risk_map.get(risk.id)
                review_status = reviewed_risk.review_status.value if reviewed_risk else ReviewStatus.PENDING.value
                review_note = reviewed_risk.review_note if reviewed_risk else None

                row = {
                    "id": risk.id,
                    "risk_type": risk.risk_type.value,
                    "severity": risk.severity.value,
                    "message": risk.message,
                    "timestamp": risk.timestamp.isoformat(),
                    "circuit_id": risk.circuit_id or "",
                    "device_id": risk.device_id or "",
                    "device_name": risk.device_name or "",
                    "review_status": review_status,
                    "review_note": review_note or "",
                    "details_json": str(risk.details),
                }
                writer.writerow(row)

        return str(output_path)
