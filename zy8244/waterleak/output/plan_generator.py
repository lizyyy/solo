"""
隔离计划生成器
生成CSV格式的隔离计划
"""

import csv
from typing import List

from ..analysis.leak_detection import IsolationStep


class PlanGenerator:
    """隔离计划生成器"""
    
    def generate_csv_content(self, steps: List[IsolationStep]) -> str:
        """生成CSV格式的隔离计划内容"""
        lines = []
        
        header = [
            "step_number",
            "action",
            "target_id",
            "target_type",
            "description",
            "expected_outcome",
            "safety_notes"
        ]
        lines.append(",".join(header))
        
        for step in steps:
            row = [
                str(step.step_number),
                step.action,
                step.target_id,
                step.target_type,
                self._escape_csv_field(step.description),
                self._escape_csv_field(step.expected_outcome),
                self._escape_csv_field(step.safety_notes)
            ]
            lines.append(",".join(row))
        
        return "\n".join(lines)
    
    def _escape_csv_field(self, field: str) -> str:
        """转义CSV字段"""
        if not field:
            return ""
        
        if "," in field or '"' in field or "\n" in field:
            field = field.replace('"', '""')
            return f'"{field}"'
        
        return field
    
    def write_csv(self, file_path: str, steps: List[IsolationStep]):
        """写入CSV文件"""
        with open(file_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f)
            
            writer.writerow([
                "step_number",
                "action",
                "target_id",
                "target_type",
                "description",
                "expected_outcome",
                "safety_notes"
            ])
            
            for step in steps:
                writer.writerow([
                    step.step_number,
                    step.action,
                    step.target_id,
                    step.target_type,
                    step.description,
                    step.expected_outcome,
                    step.safety_notes
                ])
