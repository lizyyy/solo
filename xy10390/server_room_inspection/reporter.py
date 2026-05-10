"""
日报生成和导出模块
"""

import csv
import json
from datetime import datetime
from typing import Dict, Any, List
from .storage import DataStore
from .models import Risk
from .config import RISK_LEVELS


class DailyReporter:
    """日报生成器"""

    def __init__(self, store: DataStore):
        self.store = store

    def _get_level_display(self, level: str) -> str:
        return RISK_LEVELS.get(level, {}).get("name", level)

    def _get_risk_priority(self, risk: Risk) -> int:
        return RISK_LEVELS.get(risk.level, {}).get("priority", 99)

    def generate_report(self, date: str) -> Dict[str, Any]:
        """生成日报"""
        inspections = self.store.get_inspections_by_date(date)
        ups_list = self.store.get_ups_by_date(date)
        ac_alarms = self.store.get_ac_alarms_by_date(date)
        risks = self.store.get_risks_by_date(date)
        review = self.store.get_review_by_date(date)

        if review:
            risks = [r for r in risks if r.type != "MISSING_REVIEW"]

        sorted_risks = sorted(risks, key=self._get_risk_priority)

        high_risks = [r for r in sorted_risks if r.level == "high"]
        medium_risks = [r for r in sorted_risks if r.level == "medium"]
        low_risks = [r for r in sorted_risks if r.level == "low"]

        unhandled_alarms = [
            a for a in ac_alarms
            if a.status not in ("已处理", "已恢复", "已关闭")
        ]

        status = "正常"
        if high_risks:
            status = "异常(高危)"
        elif medium_risks:
            status = "异常(中危)"
        elif low_risks:
            status = "注意"

        report = {
            "date": date,
            "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "status": status,
            "summary": {
                "inspections_count": len(inspections),
                "ups_count": len(ups_list),
                "alarms_count": len(ac_alarms),
                "unhandled_alarms_count": len(unhandled_alarms),
                "risks_by_level": {
                    "high": len(high_risks),
                    "medium": len(medium_risks),
                    "low": len(low_risks)
                },
                "review_status": "已完成" if review else "未完成",
                "reviewer": review.reviewer if review else "无"
            },
            "details": {
                "inspections": [
                    {
                        "time": r.inspection_time,
                        "room": r.room_name,
                        "inspector": r.inspector,
                        "temp": f"{r.temperature}{r.temperature_unit}",
                        "humidity": f"{r.humidity}{r.humidity_unit}"
                    } for r in inspections
                ],
                "ups": [
                    {
                        "time": u.inspection_time,
                        "name": u.ups_name,
                        "battery": f"{u.battery_voltage}V",
                        "load": f"{u.load_percent}%",
                        "status": u.status
                    } for u in ups_list
                ],
                "alarms": [
                    {
                        "time": a.alarm_time,
                        "name": a.ac_name,
                        "code": a.alarm_code,
                        "message": a.alarm_message,
                        "status": a.status
                    } for a in ac_alarms
                ]
            },
            "risks": {
                "high": [self._risk_to_dict(r) for r in high_risks],
                "medium": [self._risk_to_dict(r) for r in medium_risks],
                "low": [self._risk_to_dict(r) for r in low_risks]
            },
            "suggestions": self._generate_suggestions(high_risks, medium_risks, low_risks)
        }

        return report

    def _risk_to_dict(self, risk: Risk) -> Dict[str, Any]:
        return {
            "risk_id": risk.risk_id,
            "code": risk.code,
            "type": risk.type,
            "level": self._get_level_display(risk.level),
            "source": risk.source,
            "message": risk.message,
            "suggestion": risk.suggestion,
            "status": risk.status,
            "reviewed": risk.reviewed
        }

    def _generate_suggestions(self, high_risks: List[Risk],
                              medium_risks: List[Risk],
                              low_risks: List[Risk]) -> List[Dict[str, Any]]:
        """生成处理建议"""
        suggestions = []

        if high_risks:
            suggestions.append({
                "priority": "紧急",
                "action": "立即处理高危风险",
                "items": [r.suggestion for r in high_risks]
            })

        if medium_risks:
            suggestions.append({
                "priority": "高",
                "action": "计划处理中危风险",
                "items": [r.suggestion for r in medium_risks]
            })

        if low_risks:
            suggestions.append({
                "priority": "一般",
                "action": "关注并跟进",
                "items": [r.suggestion for r in low_risks]
            })

        return suggestions

    def export_report(self, date: str, file_path: str, format: str = "txt"):
        """导出报告"""
        report = self.generate_report(date)

        if format == "txt":
            self._export_txt(report, file_path)
        elif format == "json":
            self._export_json(report, file_path)
        elif format == "csv":
            self._export_csv(report, file_path)
        else:
            raise ValueError(f"不支持的格式: {format}")

    def _export_txt(self, report: Dict[str, Any], file_path: str):
        """导出为文本格式"""
        lines = []
        lines.append("=" * 80)
        lines.append(f"机房巡检日报 - {report['date']}")
        lines.append(f"生成时间: {report['generated_at']}")
        lines.append(f"整体状态: {report['status']}")
        lines.append("=" * 80)

        s = report["summary"]
        lines.append("\n【数据概览】")
        lines.append(f"  巡检记录: {s['inspections_count']} 条")
        lines.append(f"  UPS状态: {s['ups_count']} 条")
        lines.append(f"  空调告警: {s['alarms_count']} 条")
        lines.append(f"  未处理告警: {s['unhandled_alarms_count']} 条")
        lines.append(f"  复核状态: {s['review_status']}")
        lines.append(f"  风险统计: 高危{s['risks_by_level']['high']} 中危{s['risks_by_level']['medium']} 低危{s['risks_by_level']['low']}")

        if report["risks"]["high"] or report["risks"]["medium"] or report["risks"]["low"]:
            lines.append("\n" + "-" * 80)
            lines.append("【风险详情】")
            lines.append("-" * 80)

            for level_name, level_key in [("高危", "high"), ("中危", "medium"), ("低危", "low")]:
                risks = report["risks"][level_key]
                if risks:
                    lines.append(f"\n◆ {level_name}风险 ({len(risks)}项):")
                    for i, r in enumerate(risks, 1):
                        lines.append(f"  [{i}] {r['code']} - {r['source']}")
                        lines.append(f"      描述: {r['message']}")
                        lines.append(f"      建议: {r['suggestion']}")
                        lines.append(f"      状态: {r['status']}")

        if report["suggestions"]:
            lines.append("\n" + "-" * 80)
            lines.append("【处理建议】")
            lines.append("-" * 80)
            for sug in report["suggestions"]:
                lines.append(f"\n▶ [{sug['priority']}] {sug['action']}")
                for item in sug["items"]:
                    lines.append(f"   • {item}")

        lines.append("\n" + "=" * 80)
        lines.append("报告结束")
        lines.append("=" * 80)

        with open(file_path, 'w', encoding='utf-8') as f:
            f.write("\n".join(lines))

    def _export_json(self, report: Dict[str, Any], file_path: str):
        """导出为JSON格式"""
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2)

    def _export_csv(self, report: Dict[str, Any], file_path: str):
        """导出为CSV格式（仅风险数据）"""
        all_risks = []
        for level_key in ["high", "medium", "low"]:
            all_risks.extend(report["risks"][level_key])

        if not all_risks:
            with open(file_path, 'w', encoding='utf-8-sig', newline='') as f:
                f.write("无风险数据\n")
            return

        with open(file_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=all_risks[0].keys())
            writer.writeheader()
            writer.writerows(all_risks)
