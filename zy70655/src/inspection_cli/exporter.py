import json
import csv
from typing import List, Dict
from datetime import datetime
from .models import InspectionReport, InspectionRecord, DefectType, RiskLevel


class ReportExporter:
    def __init__(self):
        pass

    def export_text(self, report: InspectionReport, output_path: str) -> str:
        lines = []
        lines.append("=" * 60)
        lines.append("        巡检缺项安全分级整改报告")
        lines.append("=" * 60)
        lines.append(f"报告生成时间: {report.generated_at}")
        lines.append(f"报告日期: {report.report_date}")
        lines.append("")

        stats = self._get_statistics(report.records)
        lines.append("【总体统计】")
        lines.append(f"  总检查项: {stats['total']}")
        lines.append(f"  已完成: {stats['completed']}")
        lines.append(f"  未完成(缺项): {stats['defects']}")
        lines.append(f"  完成率: {stats['completion_rate']}%")
        lines.append("")

        lines.append("【缺项分类】")
        lines.append(f"  安全项缺项: {stats['safety_defects']} 项")
        lines.append(f"  保养项缺项: {stats['maintenance_defects']} 项")
        lines.append(f"  环境项缺项: {stats['environment_defects']} 项")
        lines.append(f"  操作项缺项: {stats['operation_defects']} 项")
        lines.append("")

        lines.append("【风险分级】")
        lines.append(f"  高风险 (需1天内整改): {stats['high_risk']} 项")
        lines.append(f"  中风险 (需3天内整改): {stats['medium_risk']} 项")
        lines.append(f"  低风险 (需7天内整改): {stats['low_risk']} 项")
        lines.append("")

        lines.append("【班组汇总】")
        lines.append("-" * 60)
        for summary in report.team_summaries:
            lines.append(f"班组: {summary.team}")
            lines.append(f"  总项数: {summary.total_items}, 已完成: {summary.completed_items}")
            lines.append(f"  完成率: {summary.completion_rate}%")
            lines.append(f"  安全项缺项: {summary.safety_defects}, 保养项缺项: {summary.maintenance_defects}")
            lines.append(f"  风险分布: 高={summary.high_risk}, 中={summary.medium_risk}, 低={summary.low_risk}")
            lines.append("")

        defects = [r for r in report.records if not r.is_completed]
        if defects:
            lines.append("【缺项明细】")
            lines.append("-" * 60)
            for idx, r in enumerate(defects, 1):
                lines.append(f"{idx}. 日期: {r.date}, 设备: {r.device_id}")
                lines.append(f"   检查项: {r.check_item}")
                lines.append(f"   班组: {r.team}, 类型: {r.defect_type.value}")
                lines.append(f"   风险等级: {r.risk_level.value}")
                lines.append(f"   整改期限: {r.rectification_deadline}")
                if r.inspector:
                    lines.append(f"   巡检人: {r.inspector}")
                if r.remark:
                    lines.append(f"   备注: {r.remark}")
                lines.append("")

        if report.errors:
            lines.append("【数据错误】")
            lines.append("-" * 60)
            for error in report.errors:
                lines.append(f"  ❌ {error}")
            lines.append("")

        lines.append("=" * 60)
        lines.append("报告结束")
        lines.append("=" * 60)

        content = "\n".join(lines)
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(content)
        return content

    def export_json(self, report: InspectionReport, output_path: str) -> str:
        data = {
            "report_info": {
                "report_date": report.report_date,
                "generated_at": report.generated_at,
            },
            "statistics": self._get_statistics(report.records),
            "team_summaries": [
                {
                    "team": s.team,
                    "total_items": s.total_items,
                    "completed_items": s.completed_items,
                    "completion_rate": s.completion_rate,
                    "safety_defects": s.safety_defects,
                    "maintenance_defects": s.maintenance_defects,
                    "high_risk": s.high_risk,
                    "medium_risk": s.medium_risk,
                    "low_risk": s.low_risk,
                }
                for s in report.team_summaries
            ],
            "defect_records": [
                self._record_to_dict(r)
                for r in report.records
                if not r.is_completed
            ],
            "all_records": [self._record_to_dict(r) for r in report.records],
            "errors": report.errors,
        }

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return json.dumps(data, ensure_ascii=False, indent=2)

    def export_csv(self, report: InspectionReport, output_path: str):
        defects = [r for r in report.records if not r.is_completed]
        with open(output_path, "w", newline="", encoding="utf-8-sig") as f:
            writer = csv.writer(f)
            writer.writerow([
                "日期", "设备编号", "检查项", "班组", "缺项类型",
                "风险等级", "整改期限", "整改负责人", "巡检人", "备注"
            ])
            for r in defects:
                writer.writerow([
                    r.date, r.device_id, r.check_item, r.team,
                    r.defect_type.value, r.risk_level.value,
                    r.rectification_deadline, r.rectification_person or "",
                    r.inspector or "", r.remark or ""
                ])

    def _get_statistics(self, records: List[InspectionRecord]) -> Dict:
        total = len(records)
        completed = sum(1 for r in records if r.is_completed)
        defects = total - completed

        return {
            "total": total,
            "completed": completed,
            "defects": defects,
            "completion_rate": round((completed / total * 100) if total > 0 else 0, 2),
            "safety_defects": sum(1 for r in records if not r.is_completed and r.defect_type == DefectType.SAFETY),
            "maintenance_defects": sum(1 for r in records if not r.is_completed and r.defect_type == DefectType.MAINTENANCE),
            "environment_defects": sum(1 for r in records if not r.is_completed and r.defect_type == DefectType.ENVIRONMENT),
            "operation_defects": sum(1 for r in records if not r.is_completed and r.defect_type == DefectType.OPERATION),
            "high_risk": sum(1 for r in records if not r.is_completed and r.risk_level == RiskLevel.HIGH),
            "medium_risk": sum(1 for r in records if not r.is_completed and r.risk_level == RiskLevel.MEDIUM),
            "low_risk": sum(1 for r in records if not r.is_completed and r.risk_level == RiskLevel.LOW),
        }

    def _record_to_dict(self, r: InspectionRecord) -> Dict:
        return {
            "date": r.date,
            "device_id": r.device_id,
            "check_item": r.check_item,
            "team": r.team,
            "defect_type": r.defect_type.value,
            "is_completed": r.is_completed,
            "inspector": r.inspector,
            "remark": r.remark,
            "risk_level": r.risk_level.value,
            "rectification_deadline": r.rectification_deadline,
            "rectification_person": r.rectification_person,
            "is_rectified": r.is_rectified,
        }
