"""
CSV 问题表导出器
"""

import csv
from pathlib import Path
from typing import List, Any

from ..models import (
    ProjectData, ContinuityIssue
)


class CSVExporter:
    """
    导出 CSV 格式的问题表
    """
    
    def export(self, project: ProjectData, output_path: str):
        """导出问题列表到 CSV"""
        rows = []
        
        headers = [
            "问题ID",
            "类别",
            "严重程度",
            "场次",
            "镜号",
            "描述",
            "详情",
            "相关镜头",
            "状态",
            "放行备注",
            "操作人",
            "时间"
        ]
        
        for issue in project.issues:
            import json
            details_str = json.dumps(issue.details, ensure_ascii=False) if issue.details else ""
            related_shots = ", ".join(issue.related_shots) if issue.related_shots else ""
            status = "已放行" if issue.approved else "待处理"
            
            row = [
                issue.issue_id,
                issue.category.value,
                issue.severity.value,
                issue.scene_id,
                issue.shot_number or "",
                issue.description,
                details_str,
                related_shots,
                status,
                issue.approval_notes,
                issue.approved_by,
                issue.approved_at or ""
            ]
            rows.append(row)
        
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(headers)
            writer.writerows(rows)
    
    def export_audit_trail(self, project: ProjectData, output_path: str):
        """导出审计日志到 CSV"""
        rows = []
        
        headers = [
            "时间",
            "操作人",
            "动作",
            "问题ID",
            "问题类别",
            "问题严重程度",
            "场次",
            "镜号",
            "问题描述",
            "备注"
        ]
        
        for entry in project.audit_trail:
            details = entry.details or {}
            action_text = "放行" if entry.action == "APPROVE" else "拒绝"
            
            row = [
                entry.timestamp,
                entry.user,
                action_text,
                details.get('issue_id', ''),
                details.get('issue_category', ''),
                details.get('issue_severity', ''),
                details.get('scene', ''),
                details.get('shot', '') or '',
                details.get('description', ''),
                details.get('notes', '')
            ]
            rows.append(row)
        
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(headers)
            writer.writerows(rows)
    
    def export_statistics(self, project: ProjectData, output_path: str):
        """导出统计信息到 CSV"""
        from collections import defaultdict
        
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            
            writer.writerow(["项目统计"])
            writer.writerow(["项目名称", project.project_name])
            writer.writerow(["拍摄日期", project.production_day])
            writer.writerow([])
            
            writer.writerow(["数据统计"])
            writer.writerow(["数据类型", "数量"])
            writer.writerow(["通告单记录", len(project.call_sheet_entries)])
            writer.writerow(["场记记录", len(project.script_notes)])
            writer.writerow(["截图", len(project.screenshots)])
            writer.writerow(["服装规则", len(project.costume_rules)])
            writer.writerow(["道具规则", len(project.prop_rules)])
            writer.writerow([])
            
            by_category = defaultdict(lambda: {"total": 0, "approved": 0, "pending": 0})
            by_severity = defaultdict(lambda: {"total": 0, "approved": 0, "pending": 0})
            
            for issue in project.issues:
                cat = issue.category.value
                sev = issue.severity.value
                
                by_category[cat]["total"] += 1
                by_severity[sev]["total"] += 1
                
                if issue.approved:
                    by_category[cat]["approved"] += 1
                    by_severity[sev]["approved"] += 1
                else:
                    by_category[cat]["pending"] += 1
                    by_severity[sev]["pending"] += 1
            
            writer.writerow(["问题统计 - 按类别"])
            writer.writerow(["类别", "总数", "已放行", "待处理"])
            for cat, stats in sorted(by_category.items()):
                writer.writerow([cat, stats["total"], stats["approved"], stats["pending"]])
            writer.writerow([])
            
            writer.writerow(["问题统计 - 按严重程度"])
            writer.writerow(["严重程度", "总数", "已放行", "待处理"])
            for sev in ["严重", "高", "中", "低"]:
                if sev in by_severity:
                    stats = by_severity[sev]
                    writer.writerow([sev, stats["total"], stats["approved"], stats["pending"]])
