#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
报告导出模块
负责将分析结果导出为 Markdown、HTML、JSON 格式的报告
"""

import json
import os
from datetime import datetime
from typing import Dict, List, Optional, Any
from pathlib import Path

from .diff_detector import Change, ChangeType
from .risk_engine import RiskAssessment, RiskLevel


class ReportExporter:
    """
    报告导出器
    负责将分析结果导出为各种格式的报告
    """
    
    def __init__(self, export_dir: Optional[str] = None):
        """
        初始化报告导出器
        
        Args:
            export_dir: 导出目录路径
        """
        if export_dir is None:
            export_dir = os.getcwd()
        
        self.export_dir = Path(export_dir)
        self.export_dir.mkdir(parents=True, exist_ok=True)
    
    def _generate_id(self) -> str:
        """
        生成唯一 ID
        
        Returns:
            唯一 ID 字符串
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        return f"report_{timestamp}"
    
    def _format_risk_level(self, level: str) -> str:
        """
        格式化风险等级（用于 Markdown/HTML）
        
        Args:
            level: 风险等级字符串
            
        Returns:
            格式化后的风险等级
        """
        level_colors = {
            "严重": "🔴 严重",
            "高": "🟠 高",
            "中": "🟡 中",
            "低": "🟢 低"
        }
        return level_colors.get(level, level)
    
    def _format_change_type(self, change_type: str) -> str:
        """
        格式化变化类型
        
        Args:
            change_type: 变化类型字符串
            
        Returns:
            格式化后的变化类型
        """
        type_icons = {
            "新增": "➕ 新增",
            "删除": "➖ 删除",
            "修改": "✏️ 修改",
            "弱化": "⚠️ 弱化",
            "加重": "📈 加重",
            "表述模糊": "❓ 表述模糊"
        }
        return type_icons.get(change_type, change_type)
    
    def export_json(
        self,
        project_name: str,
        versions: List[str],
        changes: List[Change],
        assessments: Dict[str, List[RiskAssessment]],
        summary: Optional[Dict[str, Any]] = None,
        filename: Optional[str] = None
    ) -> str:
        """
        导出为 JSON 格式报告
        
        Args:
            project_name: 项目名称
            versions: 版本列表
            changes: 变化列表
            assessments: 风险评估结果
            summary: 摘要数据
            filename: 输出文件名（不含扩展名）
            
        Returns:
            导出文件的完整路径
        """
        if filename is None:
            filename = self._generate_id()
        
        # 准备数据
        report_data = {
            "project_name": project_name,
            "generated_at": datetime.now().isoformat(),
            "versions": versions,
            "summary": summary or self._generate_summary(changes, assessments),
            "changes": self._changes_to_dict(changes),
            "assessments": self._assessments_to_dict(assessments)
        }
        
        # 写入文件
        filepath = self.export_dir / f"{filename}.json"
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(report_data, f, ensure_ascii=False, indent=2)
        
        return str(filepath)
    
    def export_markdown(
        self,
        project_name: str,
        versions: List[str],
        changes: List[Change],
        assessments: Dict[str, List[RiskAssessment]],
        summary: Optional[Dict[str, Any]] = None,
        filename: Optional[str] = None,
        include_details: bool = True
    ) -> str:
        """
        导出为 Markdown 格式报告
        
        Args:
            project_name: 项目名称
            versions: 版本列表
            changes: 变化列表
            assessments: 风险评估结果
            summary: 摘要数据
            filename: 输出文件名（不含扩展名）
            include_details: 是否包含详细内容
            
        Returns:
            导出文件的完整路径
        """
        if filename is None:
            filename = self._generate_id()
        
        if summary is None:
            summary = self._generate_summary(changes, assessments)
        
        # 构建 Markdown 内容
        md_lines = []
        
        # 标题
        md_lines.append(f"# 合同版本差异与风险分析报告")
        md_lines.append("")
        md_lines.append(f"**项目名称**: {project_name}")
        md_lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        md_lines.append(f"**对比版本**: {', '.join(versions)}")
        md_lines.append("")
        
        # 摘要
        md_lines.append("## 📊 分析摘要")
        md_lines.append("")
        
        md_lines.append("### 变化统计")
        md_lines.append("")
        md_lines.append(f"- **总变化数**: {summary.get('total_changes', 0)}")
        md_lines.append(f"- **风险评估数**: {summary.get('total_assessments', 0)}")
        md_lines.append("")
        
        # 变化类型统计
        change_types = summary.get('change_types', {})
        if change_types:
            md_lines.append("### 变化类型分布")
            md_lines.append("")
            for change_type, count in change_types.items():
                md_lines.append(f"- {self._format_change_type(change_type)}: {count} 处")
            md_lines.append("")
        
        # 风险等级统计
        risk_levels = summary.get('risk_levels', {})
        if risk_levels:
            md_lines.append("### 风险等级分布")
            md_lines.append("")
            for level, count in risk_levels.items():
                if count > 0:
                    md_lines.append(f"- {self._format_risk_level(level)}: {count} 项")
            md_lines.append("")
        
        # 按类别统计
        categories = summary.get('categories', {})
        if categories:
            md_lines.append("### 涉及类别")
            md_lines.append("")
            for category, count in categories.items():
                md_lines.append(f"- **{category}**: {count} 处变化")
            md_lines.append("")
        
        # 详细风险分析
        if include_details:
            md_lines.append("## 🔍 详细风险分析")
            md_lines.append("")
            
            # 按风险等级分组展示
            risk_groups = self._group_by_risk_level(changes, assessments)
            
            for level in ["严重", "高", "中", "低"]:
                if level not in risk_groups or not risk_groups[level]:
                    continue
                
                level_changes = risk_groups[level]
                md_lines.append(f"### {self._format_risk_level(level)} 风险 ({len(level_changes)} 项)")
                md_lines.append("")
                
                for change_data in level_changes:
                    change = change_data["change"]
                    change_assessments = change_data["assessments"]
                    
                    md_lines.append(f"#### {self._format_change_type(change.change_type.value)} - {change.category}")
                    md_lines.append("")
                    
                    # 证据片段
                    if change.evidence_old:
                        md_lines.append("**旧版本内容**:")
                        md_lines.append("```")
                        md_lines.append(change.evidence_old)
                        md_lines.append("```")
                        md_lines.append("")
                    
                    if change.evidence_new:
                        md_lines.append("**新版本内容**:")
                        md_lines.append("```")
                        md_lines.append(change.evidence_new)
                        md_lines.append("```")
                        md_lines.append("")
                    
                    # 风险评估
                    if change_assessments:
                        md_lines.append("**风险评估**:")
                        md_lines.append("")
                        for assessment in change_assessments:
                            md_lines.append(f"- **规则**: {assessment.rule_name}")
                            if assessment.matched_triggers:
                                md_lines.append(f"  - 匹配关键词: {', '.join(assessment.matched_triggers)}")
                            md_lines.append("")
                        
                        # 建议追问句
                        all_questions = set()
                        for assessment in change_assessments:
                            for q in assessment.suggested_questions:
                                all_questions.add(q)
                        
                        if all_questions:
                            md_lines.append("**建议追问**:")
                            md_lines.append("")
                            for q in all_questions:
                                md_lines.append(f"1. {q}")
                            md_lines.append("")
                    
                    md_lines.append("---")
                    md_lines.append("")
        
        # 写入文件
        filepath = self.export_dir / f"{filename}.md"
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write('\n'.join(md_lines))
        
        return str(filepath)
    
    def export_html(
        self,
        project_name: str,
        versions: List[str],
        changes: List[Change],
        assessments: Dict[str, List[RiskAssessment]],
        summary: Optional[Dict[str, Any]] = None,
        filename: Optional[str] = None,
        include_details: bool = True
    ) -> str:
        """
        导出为 HTML 格式报告
        
        Args:
            project_name: 项目名称
            versions: 版本列表
            changes: 变化列表
            assessments: 风险评估结果
            summary: 摘要数据
            filename: 输出文件名（不含扩展名）
            include_details: 是否包含详细内容
            
        Returns:
            导出文件的完整路径
        """
        if filename is None:
            filename = self._generate_id()
        
        if summary is None:
            summary = self._generate_summary(changes, assessments)
        
        # 构建 HTML 内容
        html_content = self._generate_html_content(
            project_name, versions, changes, assessments, summary, include_details
        )
        
        # 写入文件
        filepath = self.export_dir / f"{filename}.html"
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(html_content)
        
        return str(filepath)
    
    def _generate_html_content(
        self,
        project_name: str,
        versions: List[str],
        changes: List[Change],
        assessments: Dict[str, List[RiskAssessment]],
        summary: Dict[str, Any],
        include_details: bool
    ) -> str:
        """
        生成 HTML 内容
        
        Args:
            各种参数
            
        Returns:
            HTML 字符串
        """
        # 风险等级颜色映射
        risk_colors = {
            "严重": {"bg": "#dc3545", "text": "white"},
            "高": {"bg": "#fd7e14", "text": "white"},
            "中": {"bg": "#ffc107", "text": "dark"},
            "低": {"bg": "#28a745", "text": "white"}
        }
        
        # 变化类型颜色映射
        change_colors = {
            "新增": {"bg": "#d4edda", "text": "#155724"},
            "删除": {"bg": "#f8d7da", "text": "#721c24"},
            "修改": {"bg": "#fff3cd", "text": "#856404"},
            "弱化": {"bg": "#ffe5d0", "text": "#853d04"},
            "加重": {"bg": "#d1ecf1", "text": "#0c5460"},
            "表述模糊": {"bg": "#e2e3e5", "text": "#383d41"}
        }
        
        # 开始构建 HTML
        html_parts = []
        
        html_parts.append('<!DOCTYPE html>')
        html_parts.append('<html lang="zh-CN">')
        html_parts.append('<head>')
        html_parts.append('    <meta charset="UTF-8">')
        html_parts.append('    <meta name="viewport" content="width=device-width, initial-scale=1.0">')
        html_parts.append(f'    <title>合同差异分析报告 - {project_name}</title>')
        html_parts.append('    <style>')
        html_parts.append('        * { margin: 0; padding: 0; box-sizing: border-box; }')
        html_parts.append('        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; line-height: 1.6; color: #333; max-width: 1200px; margin: 0 auto; padding: 20px; }')
        html_parts.append('        h1, h2, h3, h4 { margin-top: 1.5em; margin-bottom: 0.5em; font-weight: 600; }')
        html_parts.append('        h1 { font-size: 2em; border-bottom: 2px solid #007bff; padding-bottom: 10px; }')
        html_parts.append('        h2 { font-size: 1.5em; color: #007bff; }')
        html_parts.append('        h3 { font-size: 1.25em; }')
        html_parts.append('        .summary-card { background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0; }')
        html_parts.append('        .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }')
        html_parts.append('        .stat-item { background: white; border: 1px solid #dee2e6; border-radius: 8px; padding: 15px; text-align: center; }')
        html_parts.append('        .stat-value { font-size: 2em; font-weight: bold; color: #007bff; }')
        html_parts.append('        .stat-label { color: #6c757d; font-size: 0.9em; }')
        html_parts.append('        .risk-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-weight: 600; font-size: 0.85em; }')
        html_parts.append('        .change-card { background: white; border: 1px solid #dee2e6; border-radius: 8px; margin: 15px 0; overflow: hidden; }')
        html_parts.append('        .change-header { padding: 15px; background: #f8f9fa; border-bottom: 1px solid #dee2e6; }')
        html_parts.append('        .change-body { padding: 15px; }')
        html_parts.append('        .code-block { background: #282c34; color: #abb2bf; padding: 15px; border-radius: 6px; font-family: "Fira Code", Consolas, monospace; font-size: 0.9em; overflow-x: auto; margin: 10px 0; }')
        html_parts.append('        .code-label { font-size: 0.85em; color: #6c757d; margin-bottom: 5px; }')
        html_parts.append('        .question-list { margin-top: 10px; padding-left: 20px; }')
        html_parts.append('        .question-list li { margin: 5px 0; color: #495057; }')
        html_parts.append('        hr { border: none; border-top: 1px solid #dee2e6; margin: 20px 0; }')
        html_parts.append('        .metadata { color: #6c757d; font-size: 0.9em; margin: 10px 0; }')
        html_parts.append('        .metadata span { margin-right: 20px; }')
        html_parts.append('    </style>')
        html_parts.append('</head>')
        html_parts.append('<body>')
        
        # 标题
        html_parts.append(f'<h1>合同版本差异与风险分析报告</h1>')
        
        # 元数据
        html_parts.append('<div class="metadata">')
        html_parts.append(f'    <span><strong>项目名称:</strong> {project_name}</span>')
        html_parts.append(f'    <span><strong>生成时间:</strong> {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}</span>')
        html_parts.append(f'    <span><strong>对比版本:</strong> {", ".join(versions)}</span>')
        html_parts.append('</div>')
        
        # 摘要
        html_parts.append('<h2>📊 分析摘要</h2>')
        html_parts.append('<div class="summary-card">')
        
        # 统计数据
        html_parts.append('<div class="stat-grid">')
        html_parts.append(f'    <div class="stat-item"><div class="stat-value">{summary.get("total_changes", 0)}</div><div class="stat-label">总变化数</div></div>')
        html_parts.append(f'    <div class="stat-item"><div class="stat-value">{summary.get("total_assessments", 0)}</div><div class="stat-label">风险评估数</div></div>')
        
        # 风险等级统计
        risk_levels = summary.get('risk_levels', {})
        for level in ["严重", "高", "中", "低"]:
            count = risk_levels.get(level, 0)
            color = risk_colors.get(level, {"bg": "#6c757d", "text": "white"})
            html_parts.append(f'    <div class="stat-item"><div class="stat-value" style="color: {color["bg"]}">{count}</div><div class="stat-label">{level}风险</div></div>')
        
        html_parts.append('</div>')
        
        # 变化类型分布
        change_types = summary.get('change_types', {})
        if change_types:
            html_parts.append('<h3>变化类型分布</h3>')
            html_parts.append('<div style="display: flex; flex-wrap: wrap; gap: 10px; margin-top: 10px;">')
            for change_type, count in change_types.items():
                color = change_colors.get(change_type, {"bg": "#e2e3e5", "text": "#383d41"})
                html_parts.append(f'    <span class="risk-badge" style="background: {color["bg"]}; color: {color["text"]}">{change_type}: {count}</span>')
            html_parts.append('</div>')
        
        # 涉及类别
        categories = summary.get('categories', {})
        if categories:
            html_parts.append('<h3 style="margin-top: 20px;">涉及类别</h3>')
            html_parts.append('<div style="display: flex; flex-wrap: wrap; gap: 10px; margin-top: 10px;">')
            for category, count in categories.items():
                html_parts.append(f'    <span class="risk-badge" style="background: #e7f1ff; color: #004085;"><strong>{category}</strong>: {count} 处</span>')
            html_parts.append('</div>')
        
        html_parts.append('</div>')
        
        # 详细风险分析
        if include_details:
            html_parts.append('<h2>🔍 详细风险分析</h2>')
            
            # 按风险等级分组展示
            risk_groups = self._group_by_risk_level(changes, assessments)
            
            for level in ["严重", "高", "中", "低"]:
                if level not in risk_groups or not risk_groups[level]:
                    continue
                
                level_changes = risk_groups[level]
                color = risk_colors.get(level, {"bg": "#6c757d", "text": "white"})
                
                html_parts.append(f'<h3><span class="risk-badge" style="background: {color["bg"]}; color: {color["text"]}">{level} 风险</span> ({len(level_changes)} 项)</h3>')
                
                for change_data in level_changes:
                    change = change_data["change"]
                    change_assessments = change_data["assessments"]
                    
                    change_color = change_colors.get(change.change_type.value, {"bg": "#e2e3e5", "text": "#383d41"})
                    
                    html_parts.append('<div class="change-card">')
                    html_parts.append(f'    <div class="change-header">')
                    html_parts.append(f'        <span class="risk-badge" style="background: {change_color["bg"]}; color: {change_color["text"]}">{change.change_type.value}</span>')
                    html_parts.append(f'        <span style="margin-left: 10px; font-weight: 600;">{change.category}</span>')
                    html_parts.append('    </div>')
                    html_parts.append('    <div class="change-body">')
                    
                    # 证据片段
                    if change.evidence_old:
                        html_parts.append('        <div class="code-label">📄 旧版本内容:</div>')
                        html_parts.append(f'        <div class="code-block">{self._escape_html(change.evidence_old)}</div>')
                    
                    if change.evidence_new:
                        html_parts.append('        <div class="code-label">📝 新版本内容:</div>')
                        html_parts.append(f'        <div class="code-block">{self._escape_html(change.evidence_new)}</div>')
                    
                    # 风险评估
                    if change_assessments:
                        html_parts.append('        <div style="margin-top: 15px;">')
                        html_parts.append('            <strong>⚠️ 风险评估:</strong>')
                        html_parts.append('            <ul style="margin-top: 10px; padding-left: 20px;">')
                        for assessment in change_assessments:
                            html_parts.append(f'                <li><strong>{assessment.rule_name}</strong>')
                            if assessment.matched_triggers:
                                html_parts.append(f'                    <br><span style="color: #6c757d; font-size: 0.9em;">匹配关键词: {", ".join(assessment.matched_triggers)}</span>')
                            html_parts.append('                </li>')
                        html_parts.append('            </ul>')
                        html_parts.append('        </div>')
                        
                        # 建议追问句
                        all_questions = set()
                        for assessment in change_assessments:
                            for q in assessment.suggested_questions:
                                all_questions.add(q)
                        
                        if all_questions:
                            html_parts.append('        <div style="margin-top: 15px;">')
                            html_parts.append('            <strong>❓ 建议追问:</strong>')
                            html_parts.append('            <ol class="question-list">')
                            for q in all_questions:
                                html_parts.append(f'                <li>{self._escape_html(q)}</li>')
                            html_parts.append('            </ol>')
                            html_parts.append('        </div>')
                    
                    html_parts.append('    </div>')
                    html_parts.append('</div>')
        
        html_parts.append('</body>')
        html_parts.append('</html>')
        
        return '\n'.join(html_parts)
    
    def _escape_html(self, text: str) -> str:
        """
        转义 HTML 特殊字符
        
        Args:
            text: 原始文本
            
        Returns:
            转义后的文本
        """
        if not text:
            return ""
        return (text.replace('&', '&amp;')
                    .replace('<', '&lt;')
                    .replace('>', '&gt;')
                    .replace('"', '&quot;')
                    .replace("'", '&#039;'))
    
    def _generate_summary(
        self,
        changes: List[Change],
        assessments: Dict[str, List[RiskAssessment]]
    ) -> Dict[str, Any]:
        """
        生成分析摘要
        
        Args:
            changes: 变化列表
            assessments: 风险评估结果
            
        Returns:
            摘要字典
        """
        # 统计变化类型
        change_type_counts = {}
        category_counts = {}
        
        for change in changes:
            # 变化类型统计
            change_type = change.change_type.value
            if change_type not in change_type_counts:
                change_type_counts[change_type] = 0
            change_type_counts[change_type] += 1
            
            # 类别统计
            category = change.category
            if category not in category_counts:
                category_counts[category] = 0
            category_counts[category] += 1
        
        # 统计风险等级
        risk_level_counts = {
            "严重": 0,
            "高": 0,
            "中": 0,
            "低": 0
        }
        
        for change_id, assessment_list in assessments.items():
            for assessment in assessment_list:
                level = assessment.risk_level.value
                if level in risk_level_counts:
                    risk_level_counts[level] += 1
                else:
                    risk_level_counts[level] = 1
        
        return {
            "total_changes": len(changes),
            "total_assessments": sum(len(a) for a in assessments.values()),
            "change_types": change_type_counts,
            "categories": category_counts,
            "risk_levels": risk_level_counts,
            "generated_at": datetime.now().isoformat()
        }
    
    def _group_by_risk_level(
        self,
        changes: List[Change],
        assessments: Dict[str, List[RiskAssessment]]
    ) -> Dict[str, List[Dict]]:
        """
        按风险等级分组变化
        
        Args:
            changes: 变化列表
            assessments: 风险评估结果
            
        Returns:
            按风险等级分组的字典
        """
        groups = defaultdict(list)
        
        for change in changes:
            change_assessments = assessments.get(change.id, [])
            
            if change_assessments:
                # 找到最高风险等级
                highest_level = "低"
                level_order = {"严重": 4, "高": 3, "中": 2, "低": 1}
                
                for assessment in change_assessments:
                    level = assessment.risk_level.value
                    if level_order.get(level, 0) > level_order.get(highest_level, 0):
                        highest_level = level
                
                groups[highest_level].append({
                    "change": change,
                    "assessments": change_assessments
                })
            else:
                # 没有风险评估，默认低风险
                groups["低"].append({
                    "change": change,
                    "assessments": []
                })
        
        return dict(groups)
    
    def _changes_to_dict(self, changes: List[Change]) -> List[Dict[str, Any]]:
        """
        将变化列表转换为字典列表
        
        Args:
            changes: 变化列表
            
        Returns:
            字典列表
        """
        result = []
        for change in changes:
            result.append({
                "id": change.id,
                "change_type": change.change_type.value,
                "category": change.category,
                "old_content": change.old_content,
                "new_content": change.new_content,
                "evidence_old": change.evidence_old,
                "evidence_new": change.evidence_new,
                "old_start_line": change.old_start_line,
                "old_end_line": change.old_end_line,
                "new_start_line": change.new_start_line,
                "new_end_line": change.new_end_line,
                "similarity_score": change.similarity_score,
                "risk_level": change.risk_level,
                "suggested_questions": change.suggested_questions,
                "metadata": change.metadata
            })
        return result
    
    def _assessments_to_dict(
        self, 
        assessments: Dict[str, List[RiskAssessment]]
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        将风险评估结果转换为字典
        
        Args:
            assessments: 风险评估结果
            
        Returns:
            字典
        """
        result = {}
        for change_id, assessment_list in assessments.items():
            result[change_id] = []
            for assessment in assessment_list:
                result[change_id].append({
                    "change_id": assessment.change_id,
                    "rule_id": assessment.rule_id,
                    "rule_name": assessment.rule_name,
                    "risk_level": assessment.risk_level.value,
                    "confidence": assessment.confidence,
                    "matched_triggers": assessment.matched_triggers,
                    "evidence": assessment.evidence,
                    "suggested_questions": assessment.suggested_questions,
                    "metadata": assessment.metadata
                })
        return result
