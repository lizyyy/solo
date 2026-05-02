"""CSV风险清单导出器"""

import csv
from typing import List, Optional, Dict, Any

from ..models import (
    ValidationResult, ValidationIssue,
    CalculationResult, ZoneResult,
    IssueSeverity, IssueCategory
)


class CSVExporter:
    
    def __init__(self):
        pass
    
    def export_risk_list(
        self,
        validation_result: ValidationResult,
        calculation_result: CalculationResult,
        output_path: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        
        rows = []
        
        for issue in validation_result.issues:
            row = {
                "type": "数据校验",
                "severity": self._severity_to_string(issue.severity),
                "category": self._category_to_string(issue.category),
                "zone_id": issue.affected_zone or "",
                "zone_name": "",
                "sensor_id": issue.affected_sensor or "",
                "spectrum_id": issue.affected_spectrum or "",
                "affected_hour": issue.affected_hour if issue.affected_hour is not None else "",
                "message": issue.message,
                "suggested_action": issue.suggested_action,
                "issue_id": issue.issue_id
            }
            rows.append(row)
        
        for zone_result in calculation_result.zone_results:
            if zone_result.risk_level in ["high", "medium"]:
                for warning in zone_result.warnings:
                    row = {
                        "type": "计算风险",
                        "severity": "高" if zone_result.risk_level == "high" else "中",
                        "category": "DLI异常",
                        "zone_id": zone_result.zone_id,
                        "zone_name": zone_result.zone_name,
                        "sensor_id": "",
                        "spectrum_id": "",
                        "affected_hour": "",
                        "message": warning,
                        "suggested_action": self._get_suggestion_for_dli_issue(zone_result),
                        "issue_id": ""
                    }
                    rows.append(row)
        
        if calculation_result.budget_status == "over_budget":
            row = {
                "type": "预算风险",
                "severity": "高",
                "category": "预算超限",
                "zone_id": "",
                "zone_name": "",
                "sensor_id": "",
                "spectrum_id": "",
                "affected_hour": "",
                "message": (
                    f"总成本 {calculation_result.total_estimated_cost:.2f} 元 "
                    f"超出预算 {calculation_result.budget_limit:.2f} 元"
                ),
                "suggested_action": "优先在谷电时段补光，或降低部分分区的功率",
                "issue_id": ""
            }
            rows.append(row)
        
        if output_path:
            self._write_csv(output_path, rows)
        
        return rows
    
    def export_zone_summary(
        self,
        calculation_result: CalculationResult,
        output_path: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        
        rows = []
        
        for zone_result in calculation_result.zone_results:
            row = {
                "zone_id": zone_result.zone_id,
                "zone_name": zone_result.zone_name,
                "crop_type": zone_result.crop_type,
                "natural_dli": f"{zone_result.natural_dli:.2f}",
                "supplemental_dli": f"{zone_result.supplemental_dli:.2f}",
                "total_dli": f"{zone_result.total_dli:.2f}",
                "target_dli": f"{zone_result.target_dli:.2f}",
                "min_dli": f"{zone_result.min_dli:.2f}",
                "max_dli": f"{zone_result.max_dli:.2f}",
                "dli_status": self._dli_status_to_string(zone_result.dli_status),
                "dli_deficit": f"{zone_result.dli_deficit:.2f}",
                "dli_excess": f"{zone_result.dli_excess:.2f}",
                "blue_red_ratio": f"{zone_result.blue_red_ratio:.3f}",
                "estimated_energy_kwh": f"{zone_result.estimated_energy:.2f}",
                "estimated_cost": f"{zone_result.estimated_cost:.2f}",
                "risk_level": self._risk_level_to_string(zone_result.risk_level),
                "warning_count": len(zone_result.warnings)
            }
            rows.append(row)
        
        if output_path:
            self._write_csv(output_path, rows)
        
        return rows
    
    def export_hourly_analysis(
        self,
        calculation_result: CalculationResult,
        output_path: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        
        rows = []
        
        for zone_result in calculation_result.zone_results:
            for hour, hour_data in zone_result.hourly_analysis.items():
                row = {
                    "zone_id": zone_result.zone_id,
                    "zone_name": zone_result.zone_name,
                    "hour": hour,
                    "natural_ppfd": f"{hour_data.get('natural_ppfd', 0):.1f}",
                    "supplemental_ppfd": f"{hour_data.get('supplemental_ppfd', 0):.1f}",
                    "total_ppfd": f"{hour_data.get('total_ppfd', 0):.1f}",
                    "natural_dli": f"{hour_data.get('natural_dli', 0):.3f}",
                    "supplemental_dli": f"{hour_data.get('supplemental_dli', 0):.3f}",
                    "total_dli": f"{hour_data.get('total_dli', 0):.3f}",
                    "power_percentage": f"{hour_data.get('power_percentage', 0):.0f}",
                    "price_per_kwh": f"{hour_data.get('price_per_kwh', 0):.4f}",
                    "in_photoperiod": "是" if hour_data.get('in_photoperiod', False) else "否"
                }
                rows.append(row)
        
        if output_path:
            self._write_csv(output_path, rows)
        
        return rows
    
    def export_light_plan(
        self,
        light_plan,
        zones: list = None,
        output_path: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        
        rows = []
        
        for interval in light_plan.intervals:
            zone_name = interval.zone_id
            if zones:
                for z in zones:
                    if z.zone_id == interval.zone_id:
                        zone_name = z.zone_name
                        break
            
            row = {
                "zone_id": interval.zone_id,
                "zone_name": zone_name,
                "start_hour": f"{interval.start_hour:02d}:00",
                "end_hour": f"{interval.end_hour:02d}:00",
                "duration_hours": interval.duration_hours,
                "power_percentage": f"{interval.power_percentage:.0f}%",
                "priority": self._priority_to_string(interval.priority),
                "estimated_ppfd": f"{interval.estimated_ppfd:.1f}",
                "estimated_dli_contribution": f"{interval.estimated_dli_contribution:.3f}",
                "estimated_energy_kwh": f"{interval.estimated_energy:.3f}",
                "estimated_cost": f"{interval.estimated_cost:.2f}",
                "notes": interval.notes
            }
            rows.append(row)
        
        if output_path:
            self._write_csv(output_path, rows)
        
        return rows
    
    def _write_csv(self, filepath: str, rows: List[Dict[str, Any]]) -> None:
        
        if not rows:
            return
        
        fieldnames = list(rows[0].keys())
        
        with open(filepath, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)
    
    def _severity_to_string(self, severity) -> str:
        if severity == IssueSeverity.CRITICAL:
            return "严重"
        elif severity == IssueSeverity.WARNING:
            return "警告"
        elif severity == IssueSeverity.INFO:
            return "信息"
        return str(severity)
    
    def _category_to_string(self, category) -> str:
        category_map = {
            IssueCategory.SENSOR_MISSING: "传感器缺测",
            IssueCategory.SENSOR_ANOMALY: "传感器异常",
            IssueCategory.POWER_CONFLICT: "功率冲突",
            IssueCategory.THRESHOLD_VIOLATION: "阈值越界",
            IssueCategory.BUDGET_EXCEEDED: "预算超限",
            IssueCategory.DATA_INCONSISTENCY: "数据不一致",
            IssueCategory.SPECTRUM_MISMATCH: "光谱不匹配"
        }
        return category_map.get(category, str(category))
    
    def _dli_status_to_string(self, status: str) -> str:
        status_map = {
            "deficient": "不足",
            "excessive": "过量",
            "optimal": "最优",
            "acceptable": "可接受"
        }
        return status_map.get(status, status)
    
    def _risk_level_to_string(self, level: str) -> str:
        level_map = {
            "high": "高",
            "medium": "中",
            "low": "低"
        }
        return level_map.get(level, level)
    
    def _priority_to_string(self, priority) -> str:
        from ..models import PriorityLevel
        priority_map = {
            PriorityLevel.HIGH: "高",
            PriorityLevel.MEDIUM: "中",
            PriorityLevel.LOW: "低"
        }
        return priority_map.get(priority, str(priority))
    
    def _get_suggestion_for_dli_issue(self, zone_result: ZoneResult) -> str:
        if zone_result.dli_deficit > 0:
            return f"建议增加补光时长或提高功率，需要补充 {zone_result.dli_deficit:.1f} DLI"
        elif zone_result.dli_excess > 0:
            return f"建议减少补光时长或降低功率，过量 {zone_result.dli_excess:.1f} DLI (烧苗风险)"
        return ""
