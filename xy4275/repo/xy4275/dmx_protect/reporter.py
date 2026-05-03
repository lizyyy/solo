"""
报告导出模块

用于将检测结果导出为 Markdown、CSV 和 JSON 格式的报告。
"""

import csv
import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional

from .models import (
    Issue, ProjectData, IssueType, Severity, ReviewDecision
)


class Reporter:
    """报告生成器"""
    
    def __init__(self, project: ProjectData):
        self.project = project
    
    def _generate_summary(self) -> Dict[str, Any]:
        """生成统计摘要"""
        issues = self.project.issues
        total = len(issues)
        unresolved = sum(1 for i in issues if not i.is_resolved)
        
        by_type: Dict[str, int] = {}
        by_severity: Dict[str, int] = {}
        by_decision: Dict[str, int] = {}
        
        for issue in issues:
            issue_type = issue.type.value
            by_type[issue_type] = by_type.get(issue_type, 0) + 1
            
            severity = issue.severity.value
            by_severity[severity] = by_severity.get(severity, 0) + 1
            
            decision = issue.review_decision.value
            by_decision[decision] = by_decision.get(decision, 0) + 1
        
        return {
            "total_issues": total,
            "unresolved": unresolved,
            "resolved": total - unresolved,
            "by_type": by_type,
            "by_severity": by_severity,
            "by_decision": by_decision,
            "theater_name": self.project.config.name if self.project.config else "未知剧场",
            "generated_at": datetime.now().isoformat(),
            "cues_count": len(self.project.cues),
            "fixtures_count": len(self.project.fixtures),
            "modifications_count": len(self.project.modifications),
        }
    
    def export_json(self, output_dir: str) -> str:
        """导出 JSON 格式报告"""
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        report_data = {
            "summary": self._generate_summary(),
            "issues": [issue.to_dict() for issue in self.project.issues],
            "project": {
                "config": self.project.config.to_dict() if self.project.config else None,
                "cues": [cue.to_dict() for cue in self.project.cues],
                "fixtures": [f.to_dict() for f in self.project.fixtures],
            }
        }
        
        file_path = output_path / "report.json"
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(report_data, f, ensure_ascii=False, indent=2)
        
        return str(file_path)
    
    def export_csv(self, output_dir: str) -> List[str]:
        """导出 CSV 格式报告"""
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        exported_files = []
        
        issues_file = output_path / "issues.csv"
        with open(issues_file, 'w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f)
            writer.writerow([
                "ID", "类型", "严重级别", "标题", "描述",
                "影响 CUE", "影响通道", "判定状态", "判定注释", "判定时间"
            ])
            
            for issue in self.project.issues:
                writer.writerow([
                    issue.id,
                    issue.type.value,
                    issue.severity.value,
                    issue.title,
                    issue.description.replace('\n', '; '),
                    ", ".join(issue.affected_cues),
                    ", ".join(map(str, issue.affected_channels)),
                    issue.review_decision.value,
                    issue.review_comment,
                    issue.reviewed_at.isoformat() if issue.reviewed_at else ""
                ])
        
        exported_files.append(str(issues_file))
        
        summary_file = output_path / "summary.csv"
        summary = self._generate_summary()
        
        with open(summary_file, 'w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(["项目", "值"])
            writer.writerow(["剧场名称", summary["theater_name"]])
            writer.writerow(["生成时间", summary["generated_at"]])
            writer.writerow(["CUE 总数", summary["cues_count"]])
            writer.writerow(["灯具总数", summary["fixtures_count"]])
            writer.writerow(["修改记录数", summary["modifications_count"]])
            writer.writerow(["问题总数", summary["total_issues"]])
            writer.writerow(["未解决", summary["unresolved"]])
            writer.writerow(["已解决", summary["resolved"]])
            
            writer.writerow([])
            writer.writerow(["按类型统计"])
            for issue_type, count in summary["by_type"].items():
                writer.writerow([issue_type, count])
            
            writer.writerow([])
            writer.writerow(["按严重级别统计"])
            for severity, count in summary["by_severity"].items():
                writer.writerow([severity, count])
        
        exported_files.append(str(summary_file))
        
        return exported_files
    
    def export_markdown(self, output_dir: str) -> str:
        """导出 Markdown 格式报告"""
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        summary = self._generate_summary()
        issues = self.project.issues
        
        md_content = self._generate_markdown_content(summary, issues)
        
        file_path = output_path / "report.md"
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(md_content)
        
        return str(file_path)
    
    def _generate_markdown_content(self, summary: Dict[str, Any], issues: List[Issue]) -> str:
        """生成 Markdown 内容"""
        lines = []
        
        lines.append("# 换景灯光防撞器 - 检测报告")
        lines.append("")
        lines.append(f"**剧场**: {summary['theater_name']}")
        lines.append(f"**生成时间**: {summary['generated_at']}")
        lines.append("")
        
        lines.append("## 统计摘要")
        lines.append("")
        
        lines.append("### 总体统计")
        lines.append("")
        lines.append(f"| 项目 | 数值 |")
        lines.append(f"|------|------|")
        lines.append(f"| CUE 总数 | {summary['cues_count']} |")
        lines.append(f"| 灯具总数 | {summary['fixtures_count']} |")
        lines.append(f"| 修改记录数 | {summary['modifications_count']} |")
        lines.append(f"| **问题总数** | **{summary['total_issues']}** |")
        lines.append(f"| 未解决 | {summary['unresolved']} |")
        lines.append(f"| 已解决 | {summary['resolved']} |")
        lines.append("")
        
        if summary['by_type']:
            lines.append("### 按问题类型统计")
            lines.append("")
            lines.append(f"| 类型 | 数量 |")
            lines.append(f"|------|------|")
            for issue_type, count in summary['by_type'].items():
                type_desc = self._get_type_description(issue_type)
                lines.append(f"| {type_desc} | {count} |")
            lines.append("")
        
        if summary['by_severity']:
            lines.append("### 按严重级别统计")
            lines.append("")
            lines.append(f"| 级别 | 数量 |")
            lines.append(f"|------|------|")
            for severity, count in summary['by_severity'].items():
                sev_desc = self._get_severity_description(severity)
                lines.append(f"| {sev_desc} | {count} |")
            lines.append("")
        
        if issues:
            lines.append("## 问题详情")
            lines.append("")
            
            for issue in issues:
                status_icon = "✅" if issue.is_resolved else "⚠️"
                severity_badge = self._get_severity_badge(issue.severity.value)
                
                lines.append(f"### {status_icon} [{issue.id}] {issue.title}")
                lines.append("")
                lines.append(f"**类型**: {self._get_type_description(issue.type.value)}")
                lines.append(f"**严重级别**: {severity_badge}")
                lines.append(f"**状态**: {'已处理' if issue.is_resolved else '待处理'}")
                lines.append("")
                
                lines.append("**描述**:")
                lines.append("")
                lines.append("```")
                for line in issue.description.split('\n'):
                    lines.append(line)
                lines.append("```")
                lines.append("")
                
                if issue.affected_cues:
                    lines.append(f"**影响 CUE**: {', '.join(issue.affected_cues)}")
                
                if issue.affected_channels:
                    lines.append(f"**影响通道**: {', '.join(map(str, issue.affected_channels))}")
                
                if issue.is_resolved:
                    lines.append("")
                    lines.append("**人工判定**:")
                    decision_desc = "接受（忽略此问题）" if issue.review_decision == ReviewDecision.ACCEPT else "拒绝（需要修复）"
                    lines.append(f"- 判定: {decision_desc}")
                    if issue.review_comment:
                        lines.append(f"- 注释: {issue.review_comment}")
                    if issue.reviewed_by:
                        lines.append(f"- 判定人: {issue.reviewed_by}")
                    if issue.reviewed_at:
                        lines.append(f"- 判定时间: {issue.reviewed_at.isoformat()}")
                
                lines.append("")
                lines.append("---")
                lines.append("")
        
        lines.append("## 附录")
        lines.append("")
        lines.append("### 问题类型说明")
        lines.append("")
        lines.append("- **通道冲突**: 同一时间点同一通道被多个 CUE 同时设置不同值")
        lines.append("- **时间重叠**: CUE 执行时间线存在重叠")
        lines.append("- **危险跳变**: 换景前后同一通道的亮度变化过大")
        lines.append("- **安全确认缺失**: 烟机/升降台等设备操作缺少安全确认")
        lines.append("")
        
        lines.append("### 严重级别说明")
        lines.append("")
        lines.append("- **Critical (严重)**: 必须在演出前修复的问题")
        lines.append("- **Warning (警告)**: 建议修复的问题")
        lines.append("- **Info (信息)**: 仅供参考的问题")
        lines.append("")
        
        return "\n".join(lines)
    
    def _get_type_description(self, issue_type: str) -> str:
        """获取问题类型的中文描述"""
        descriptions = {
            "channel_conflict": "通道冲突",
            "time_overlap": "时间重叠",
            "dangerous_jump": "危险跳变",
            "missing_confirmation": "安全确认缺失",
        }
        return descriptions.get(issue_type, issue_type)
    
    def _get_severity_description(self, severity: str) -> str:
        """获取严重级别的中文描述"""
        descriptions = {
            "critical": "严重",
            "warning": "警告",
            "info": "信息",
        }
        return descriptions.get(severity, severity)
    
    def _get_severity_badge(self, severity: str) -> str:
        """获取严重级别的标记"""
        badges = {
            "critical": "🔴 严重",
            "warning": "🟡 警告",
            "info": "🔵 信息",
        }
        return badges.get(severity, severity)
    
    def export_all(self, output_dir: str) -> Dict[str, Any]:
        """导出所有格式的报告"""
        json_file = self.export_json(output_dir)
        csv_files = self.export_csv(output_dir)
        md_file = self.export_markdown(output_dir)
        
        return {
            "json": json_file,
            "csv": csv_files,
            "markdown": md_file,
        }
