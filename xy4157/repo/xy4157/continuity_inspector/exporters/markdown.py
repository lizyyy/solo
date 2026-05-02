"""
Markdown 风险报告导出器
"""

from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any

from ..models import (
    ProjectData, ContinuityIssue, IssueCategory, IssueSeverity
)


class MarkdownExporter:
    """
    导出 Markdown 格式的风险报告
    """
    
    def export(self, project: ProjectData, output_path: str):
        """导出完整的 Markdown 报告"""
        lines = []
        
        lines.extend(self._generate_header(project))
        lines.extend(self._generate_summary(project))
        lines.extend(self._generate_issues_by_category(project))
        lines.extend(self._generate_issues_by_severity(project))
        lines.extend(self._generate_issue_details(project))
        lines.extend(self._generate_audit_trail(project))
        lines.extend(self._generate_footer())
        
        content = '\n'.join(lines)
        
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(content)
    
    def _generate_header(self, project: ProjectData) -> List[str]:
        """生成报告头部"""
        lines = []
        lines.append(f"# 镜头连续性巡检报告")
        lines.append("")
        lines.append(f"> 项目名称: **{project.project_name}**")
        lines.append(f"> 拍摄日期: **{project.production_day}**")
        lines.append(f"> 生成时间: **{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}**")
        lines.append("")
        lines.append("---")
        lines.append("")
        return lines
    
    def _generate_summary(self, project: ProjectData) -> List[str]:
        """生成统计摘要"""
        lines = []
        lines.append("## 📊 检查概览")
        lines.append("")
        
        total = len(project.issues)
        approved = sum(1 for i in project.issues if i.approved)
        pending = total - approved
        
        lines.append("### 数据统计")
        lines.append("")
        lines.append("| 数据类型 | 数量 |")
        lines.append("|---------|------|")
        lines.append(f"| 通告单记录 | {len(project.call_sheet_entries)} |")
        lines.append(f"| 场记记录 | {len(project.script_notes)} |")
        lines.append(f"| 截图 | {len(project.screenshots)} |")
        lines.append(f"| 服装规则 | {len(project.costume_rules)} |")
        lines.append(f"| 道具规则 | {len(project.prop_rules)} |")
        lines.append("")
        
        lines.append("### 问题统计")
        lines.append("")
        lines.append(f"- **总问题数**: {total}")
        lines.append(f"- **已放行**: {approved}")
        lines.append(f"- **待处理**: {pending}")
        lines.append("")
        
        by_category: Dict[str, int] = {}
        by_severity: Dict[str, int] = {}
        
        for issue in project.issues:
            cat = issue.category.value
            sev = issue.severity.value
            by_category[cat] = by_category.get(cat, 0) + 1
            by_severity[sev] = by_severity.get(sev, 0) + 1
        
        if by_category:
            lines.append("### 按类别分布")
            lines.append("")
            lines.append("| 问题类别 | 数量 |")
            lines.append("|---------|------|")
            for cat, count in sorted(by_category.items()):
                lines.append(f"| {cat} | {count} |")
            lines.append("")
        
        if by_severity:
            lines.append("### 按严重程度分布")
            lines.append("")
            lines.append("| 严重程度 | 数量 |")
            lines.append("|---------|------|")
            for sev in ["严重", "高", "中", "低"]:
                if sev in by_severity:
                    count = by_severity[sev]
                    emoji = self._severity_emoji(sev)
                    lines.append(f"| {emoji} {sev} | {count} |")
            lines.append("")
        
        return lines
    
    def _generate_issues_by_category(self, project: ProjectData) -> List[str]:
        """按类别分组显示问题"""
        lines = []
        
        categories: Dict[IssueCategory, List[ContinuityIssue]] = {}
        for issue in project.issues:
            if issue.category not in categories:
                categories[issue.category] = []
            categories[issue.category].append(issue)
        
        if not categories:
            return lines
        
        lines.append("## 📋 问题详情 (按类别)")
        lines.append("")
        
        for category in sorted(categories.keys(), key=lambda c: c.value):
            issues = categories[category]
            lines.append(f"### {category.value}")
            lines.append("")
            
            for issue in issues:
                status_icon = "✅" if issue.approved else "⚠️"
                sev_icon = self._severity_emoji(issue.severity.value)
                lines.append(f"#### {status_icon} {sev_icon} 【{issue.severity.value}】{issue.issue_id}")
                lines.append("")
                lines.append(f"- **场次**: {issue.scene_id}")
                if issue.shot_number:
                    lines.append(f"- **镜号**: {issue.shot_number}")
                lines.append(f"- **描述**: {issue.description}")
                lines.append("")
                
                if issue.details:
                    lines.append("**详情**:")
                    lines.append("")
                    lines.append("```json")
                    import json
                    lines.append(json.dumps(issue.details, ensure_ascii=False, indent=2))
                    lines.append("```")
                    lines.append("")
                
                if issue.related_shots:
                    lines.append(f"- **相关镜头**: {', '.join(issue.related_shots)}")
                    lines.append("")
                
                if issue.approved:
                    lines.append(f"- **状态**: 已放行")
                    if issue.approval_notes:
                        lines.append(f"- **放行备注**: {issue.approval_notes}")
                    if issue.approved_by:
                        lines.append(f"- **操作人**: {issue.approved_by}")
                    if issue.approved_at:
                        lines.append(f"- **时间**: {issue.approved_at}")
                else:
                    lines.append(f"- **状态**: 待处理")
                
                lines.append("")
                lines.append("---")
                lines.append("")
        
        return lines
    
    def _generate_issues_by_severity(self, project: ProjectData) -> List[str]:
        """按严重程度的紧急摘要"""
        lines = []
        
        critical_issues = [i for i in project.issues if i.severity == IssueSeverity.CRITICAL and not i.approved]
        high_issues = [i for i in project.issues if i.severity == IssueSeverity.HIGH and not i.approved]
        
        if critical_issues or high_issues:
            lines.append("## 🚨 紧急问题")
            lines.append("")
            
            if critical_issues:
                lines.append("### 🔴 严重问题 (需立即处理)")
                lines.append("")
                for issue in critical_issues:
                    lines.append(f"- **{issue.issue_id}**: {issue.scene_id} - {issue.description}")
                lines.append("")
            
            if high_issues:
                lines.append("### 🟠 高优先级问题")
                lines.append("")
                for issue in high_issues:
                    lines.append(f"- **{issue.issue_id}**: {issue.scene_id} - {issue.description}")
                lines.append("")
        
        return lines
    
    def _generate_issue_details(self, project: ProjectData) -> List[str]:
        """生成问题详情表格"""
        lines = []
        
        if not project.issues:
            lines.append("## ✅ 检查结果")
            lines.append("")
            lines.append("未发现任何连续性问题!")
            lines.append("")
            return lines
        
        lines.append("## 📝 问题清单")
        lines.append("")
        lines.append("| 问题ID | 类别 | 严重程度 | 场次 | 镜号 | 描述 | 状态 |")
        lines.append("|--------|------|---------|------|------|------|------|")
        
        for issue in project.issues:
            status = "已放行" if issue.approved else "待处理"
            status_icon = "✅" if issue.approved else "⚠️"
            lines.append(
                f"| {issue.issue_id} | {issue.category.value} | "
                f"{self._severity_emoji(issue.severity.value)} {issue.severity.value} | "
                f"{issue.scene_id} | {issue.shot_number or '-'} | "
                f"{issue.description[:30]}... | {status_icon} {status} |"
            )
        
        lines.append("")
        return lines
    
    def _generate_audit_trail(self, project: ProjectData) -> List[str]:
        """生成审计日志"""
        lines = []
        
        if not project.audit_trail:
            return lines
        
        lines.append("## 📜 复核记录")
        lines.append("")
        lines.append("| 时间 | 操作人 | 动作 | 问题ID | 备注 |")
        lines.append("|------|--------|------|--------|------|")
        
        for entry in project.audit_trail[-20:]:
            action_icon = "✅" if entry.action == "APPROVE" else "❌"
            action_text = "放行" if entry.action == "APPROVE" else "拒绝"
            issue_id = entry.details.get('issue_id', '-')
            notes = entry.details.get('notes', '')[:20] if entry.details.get('notes') else '-'
            lines.append(
                f"| {entry.timestamp} | {entry.user} | "
                f"{action_icon} {action_text} | {issue_id} | {notes} |"
            )
        
        lines.append("")
        return lines
    
    def _generate_footer(self) -> List[str]:
        """生成页脚"""
        lines = []
        lines.append("---")
        lines.append("")
        lines.append("*此报告由「镜头连续性巡检员」自动生成*")
        lines.append("")
        return lines
    
    def _severity_emoji(self, severity: str) -> str:
        """获取严重程度对应的 emoji"""
        mapping = {
            "严重": "🔴",
            "高": "🟠",
            "中": "🟡",
            "低": "🔵"
        }
        return mapping.get(severity, "⚪")
