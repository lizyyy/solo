#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Markdown复核单导出器
"""

from datetime import datetime
from typing import List, Dict, Any, Optional

from models.data_models import (
    Project, Clause, RiskItem, RedlineRule,
    RiskLevel, RiskStatus
)


class MarkdownExporter:
    """Markdown复核单导出器"""
    
    def __init__(self):
        self.include_all_clauses = False
        self.include_comments = True
    
    def export(self, project: Project, output_path: str):
        """导出Markdown复核单"""
        content = self._generate_content(project)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(content)
    
    def _generate_content(self, project: Project) -> str:
        """生成Markdown内容"""
        lines = []
        
        lines.append(f"# 条款红线复核单")
        lines.append("")
        lines.append(f"**项目名称**: {project.name}")
        lines.append(f"**项目ID**: {project.project_id}")
        lines.append(f"**版本**: {project.version}")
        lines.append(f"**导出时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"**复核状态**: {self._format_review_status(project.review_status.value if project.review_status else 'not_reviewed')}")
        lines.append("")
        
        summary = self._generate_summary(project)
        lines.extend(summary)
        lines.append("")
        
        lines.append("---")
        lines.append("")
        
        risk_sections = self._generate_risk_sections(project)
        lines.extend(risk_sections)
        lines.append("")
        
        lines.append("---")
        lines.append("")
        
        clause_sections = self._generate_clause_sections(project)
        lines.extend(clause_sections)
        lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append("*本文档由条款红线落点器自动生成*")
        
        return "\n".join(lines)
    
    def _format_review_status(self, status: str) -> str:
        """格式化复核状态"""
        status_map = {
            "not_reviewed": "🔴 未复核",
            "in_review": "🟡 复核中",
            "approved": "🟢 已通过",
            "rejected": "🔴 已驳回"
        }
        return status_map.get(status, status)
    
    def _generate_summary(self, project: Project) -> List[str]:
        """生成摘要部分"""
        lines = []
        
        risks = project.risks
        mandatory_rules = [r for r in project.rules if r.is_mandatory]
        mandatory_risks = [r for r in risks if r.rule_id in [mr.rule_id for mr in mandatory_rules]]
        
        pending_count = sum(1 for r in risks if r.status == RiskStatus.PENDING)
        confirmed_count = sum(1 for r in risks if r.status == RiskStatus.CONFIRMED)
        resolved_count = sum(1 for r in risks if r.status == RiskStatus.RESOLVED)
        dismissed_count = sum(1 for r in risks if r.status == RiskStatus.DISMISSED)
        duplicate_count = sum(1 for r in risks if r.is_duplicate)
        
        critical_count = sum(1 for r in risks if r.risk_level == RiskLevel.CRITICAL)
        high_count = sum(1 for r in risks if r.risk_level == RiskLevel.HIGH)
        medium_count = sum(1 for r in risks if r.risk_level == RiskLevel.MEDIUM)
        low_count = sum(1 for r in risks if r.risk_level == RiskLevel.LOW)
        
        lines.append("## 复核摘要")
        lines.append("")
        lines.append("### 风险统计")
        lines.append("")
        lines.append("| 风险级别 | 数量 |")
        lines.append("|----------|------|")
        lines.append(f"| 🔴 严重 | {critical_count} |")
        lines.append(f"| 🟠 高 | {high_count} |")
        lines.append(f"| 🟡 中 | {medium_count} |")
        lines.append(f"| 🟢 低 | {low_count} |")
        lines.append("")
        
        lines.append("### 处理状态")
        lines.append("")
        lines.append("| 状态 | 数量 |")
        lines.append("|------|------|")
        lines.append(f"| ⏳ 待处理 | {pending_count} |")
        lines.append(f"| ✅ 已确认 | {confirmed_count} |")
        lines.append(f"| ✔️ 已解决 | {resolved_count} |")
        lines.append(f"| ❌ 已驳回 | {dismissed_count} |")
        lines.append(f"| 🔄 重复风险 | {duplicate_count} |")
        lines.append("")
        
        lines.append("### 必改条款检查")
        lines.append("")
        if mandatory_risks:
            unresolved_mandatory = [r for r in mandatory_risks if r.status in (RiskStatus.PENDING, RiskStatus.CONFIRMED)]
            if unresolved_mandatory:
                lines.append(f"⚠️ **存在 {len(unresolved_mandatory)} 个未解决的必改风险项，请优先处理**")
                lines.append("")
                for i, risk in enumerate(unresolved_mandatory, 1):
                    lines.append(f"{i}. {self._format_risk_brief(risk, project)}")
            else:
                lines.append("✅ 所有必改风险项已处理完毕")
        else:
            lines.append("本次未涉及必改条款")
        
        return lines
    
    def _format_risk_brief(self, risk: RiskItem, project: Project) -> str:
        """格式化风险摘要"""
        clause = self._find_clause(project.clauses, risk.clause_id)
        clause_title = clause.title if clause else f"条款 {risk.clause_id}"
        
        level_icons = {
            RiskLevel.CRITICAL: "🔴",
            RiskLevel.HIGH: "🟠",
            RiskLevel.MEDIUM: "🟡",
            RiskLevel.LOW: "🟢"
        }
        
        status_icons = {
            RiskStatus.PENDING: "⏳",
            RiskStatus.CONFIRMED: "✅",
            RiskStatus.RESOLVED: "✔️",
            RiskStatus.DISMISSED: "❌"
        }
        
        icon = level_icons.get(risk.risk_level, "⚪")
        status_icon = status_icons.get(risk.status, "⚪")
        
        return f"{icon} {status_icon} [{clause_title}] {', '.join(risk.matched_keywords) if risk.matched_keywords else '规则匹配'}"
    
    def _find_clause(self, clauses: List[Clause], clause_id: str) -> Optional[Clause]:
        """查找条款"""
        for clause in clauses:
            if clause.clause_id == clause_id:
                return clause
            found = self._find_clause(clause.children, clause_id)
            if found:
                return found
        return None
    
    def _generate_risk_sections(self, project: Project) -> List[str]:
        """生成风险详情部分"""
        lines = []
        risks = project.risks
        
        if not risks:
            lines.append("## 风险检测结果")
            lines.append("")
            lines.append("✅ 未检测到任何风险项")
            return lines
        
        levels = [
            (RiskLevel.CRITICAL, "严重风险"),
            (RiskLevel.HIGH, "高风险"),
            (RiskLevel.MEDIUM, "中等风险"),
            (RiskLevel.LOW, "低风险")
        ]
        
        level_icons = {
            RiskLevel.CRITICAL: "🔴",
            RiskLevel.HIGH: "🟠",
            RiskLevel.MEDIUM: "🟡",
            RiskLevel.LOW: "🟢"
        }
        
        for level, title in levels:
            level_risks = [r for r in risks if r.risk_level == level]
            if level_risks:
                icon = level_icons[level]
                lines.append(f"## {icon} {title} ({len(level_risks)})")
                lines.append("")
                
                for i, risk in enumerate(level_risks, 1):
                    lines.extend(self._format_risk_detail(risk, project, i))
                    lines.append("")
                
                lines.append("")
        
        return lines
    
    def _format_risk_detail(self, risk: RiskItem, project: Project, index: int) -> List[str]:
        """格式化风险详情"""
        lines = []
        
        clause = self._find_clause(project.clauses, risk.clause_id)
        clause_title = clause.title if clause else f"条款 {risk.clause_id}"
        
        status_map = {
            RiskStatus.PENDING: "⏳ 待处理",
            RiskStatus.CONFIRMED: "✅ 已确认",
            RiskStatus.RESOLVED: "✔️ 已解决",
            RiskStatus.DISMISSED: "❌ 已驳回"
        }
        
        lines.append(f"### {index}. {clause_title}")
        lines.append("")
        lines.append(f"- **状态**: {status_map.get(risk.status, str(risk.status))}")
        lines.append(f"- **风险类型**: {risk.risk_type}")
        
        if risk.matched_keywords:
            lines.append(f"- **命中关键词**: {', '.join(risk.matched_keywords)}")
        
        if risk.reviewer_note:
            lines.append(f"- **复核备注**: {risk.reviewer_note}")
        
        if risk.is_duplicate:
            lines.append(f"- ⚠️ **重复风险**: 与 {risk.duplicate_of} 重复")
        
        if clause:
            lines.append("")
            lines.append("**条款内容**:")
            lines.append("")
            lines.append("```")
            lines.append(clause.content[:500] + ("..." if len(clause.content) > 500 else ""))
            lines.append("```")
        
        return lines
    
    def _generate_clause_sections(self, project: Project) -> List[str]:
        """生成条款树部分"""
        lines = []
        
        lines.append("## 条款结构")
        lines.append("")
        
        if not project.clauses:
            lines.append("无条款数据")
            return lines
        
        for clause in project.clauses:
            lines.extend(self._format_clause_tree(clause, 0))
        
        return lines
    
    def _format_clause_tree(self, clause: Clause, depth: int) -> List[str]:
        """格式化条款树"""
        lines = []
        indent = "  " * depth
        
        clause_risks = [r for r in clause.children if False]
        clause_risks = []
        
        for risk in clause.children:
            if risk.clause_id == clause.clause_id:
                clause_risks.append(risk)
        
        risk_indicator = ""
        if clause_risks:
            critical = any(r.risk_level == RiskLevel.CRITICAL for r in clause_risks)
            high = any(r.risk_level == RiskLevel.HIGH for r in clause_risks)
            if critical:
                risk_indicator = " 🔴"
            elif high:
                risk_indicator = " 🟠"
        
        lines.append(f"{indent}- **{clause.title}**{risk_indicator}")
        
        for child in clause.children:
            lines.extend(self._format_clause_tree(child, depth + 1))
        
        return lines
