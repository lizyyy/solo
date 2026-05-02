"""CSV 风险点导出模块"""

import csv
from pathlib import Path
from typing import List, Optional

from rov_tension_checker.storage.models import AnalysisRecord
from rov_tension_checker.analysis.risk_engine import RiskEvent, RiskSeverity, RiskType


class CSVExporter:
    def __init__(self):
        self.risk_type_names = {
            RiskType.TENSION_EXCEEDED: "张力超限",
            RiskType.TENSION_WARNING: "张力预警",
            RiskType.BENDING_RADIUS_VIOLATION: "弯曲半径违规",
            RiskType.BENDING_RADIUS_WARNING: "弯曲半径预警",
            RiskType.INSUFFICIENT_CABLE: "放缆不足",
            RiskType.ANGLE_ABRUPT_CHANGE: "角度突变",
            RiskType.CURRENT_ABRUPT_CHANGE: "海流突变",
            RiskType.COLLISION_RISK: "擦碰风险",
            RiskType.SLACK_CABLE: "缆线松弛"
        }
    
    def export_risks(
        self,
        record: AnalysisRecord,
        output_path: str,
        include_critical: bool = True,
        include_warning: bool = True,
        include_low: bool = False
    ) -> str:
        risks: List[RiskEvent] = []
        
        for sample in record.samples:
            for risk in sample.risks:
                if risk.severity == RiskSeverity.CRITICAL and not include_critical:
                    continue
                if risk.severity == RiskSeverity.WARNING and not include_warning:
                    continue
                if risk.severity == RiskSeverity.LOW and not include_low:
                    continue
                risks.append(risk)
        
        return self._write_risks_csv(risks, output_path, record)
    
    def _write_risks_csv(
        self,
        risks: List[RiskEvent],
        output_path: str,
        record: AnalysisRecord
    ) -> str:
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(path, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f)
            
            writer.writerow([
                "项目名称", record.project_name, "", "", "", "", ""
            ])
            writer.writerow([
                "管线编号", record.pipeline_id, "", "", "", "", ""
            ])
            writer.writerow([
                "作业日期", record.survey_date.strftime('%Y-%m-%d'), "", "", "", "", ""
            ])
            writer.writerow([])
            
            writer.writerow([
                "序号",
                "时间",
                "风险级别",
                "风险类型",
                "描述",
                "详细信息"
            ])
            
            for i, risk in enumerate(risks, 1):
                severity_name = self._get_severity_name(risk.severity)
                type_name = self.risk_type_names.get(
                    risk.risk_type,
                    risk.risk_type.value
                )
                
                details_str = self._format_details(risk.details)
                
                writer.writerow([
                    i,
                    risk.timestamp.strftime('%Y-%m-%d %H:%M:%S'),
                    severity_name,
                    type_name,
                    risk.description,
                    details_str
                ])
        
        return str(path)
    
    def _get_severity_name(self, severity: RiskSeverity) -> str:
        names = {
            RiskSeverity.CRITICAL: "关键",
            RiskSeverity.WARNING: "预警",
            RiskSeverity.LOW: "低"
        }
        return names.get(severity, severity.value)
    
    def _format_details(self, details: dict) -> str:
        if not details:
            return ""
        
        parts = []
        for key, value in details.items():
            if isinstance(value, float):
                parts.append(f"{key}: {value:.3f}")
            else:
                parts.append(f"{key}: {value}")
        
        return "; ".join(parts)
    
    def export_timeseries(
        self,
        record: AnalysisRecord,
        output_path: str
    ) -> str:
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(path, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f)
            
            writer.writerow([
                "序号",
                "时间",
                "深度(m)",
                "放缆长度(m)",
                "水平偏移(m)",
                "顶端张力(N)",
                "底端张力(N)",
                "张力比率",
                "安全裕度",
                "最小弯曲半径(m)",
                "弯曲半径位置",
                "海流速度(m/s)",
                "海流方向(度)",
                "风险数量"
            ])
            
            for sample in record.samples:
                writer.writerow([
                    sample.sample_index + 1,
                    sample.timestamp.strftime('%Y-%m-%d %H:%M:%S'),
                    f"{sample.rov_depth:.2f}" if sample.rov_depth is not None else "",
                    f"{sample.rov_cable_length:.2f}" if sample.rov_cable_length is not None else "",
                    f"{sample.horizontal_offset:.2f}" if sample.horizontal_offset is not None else "",
                    f"{sample.top_tension:.1f}" if sample.top_tension is not None else "",
                    f"{sample.bottom_tension:.1f}" if sample.bottom_tension is not None else "",
                    f"{sample.tension_ratio:.3f}" if sample.tension_ratio is not None else "",
                    f"{sample.safety_margin:.3f}" if sample.safety_margin is not None else "",
                    f"{sample.minimum_bending_radius:.4f}" if sample.minimum_bending_radius is not None else "",
                    sample.bending_radius_location or "",
                    f"{sample.current_speed:.3f}" if sample.current_speed is not None else "",
                    f"{sample.current_direction:.1f}" if sample.current_direction is not None else "",
                    len(sample.risks)
                ])
        
        return str(path)
