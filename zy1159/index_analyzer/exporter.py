"""
Report Exporter - Exports analysis results to Markdown, JSON, and CSV formats.
"""

import csv
import json
from datetime import datetime
from io import StringIO
from typing import Any, Dict, List, Optional, Union

from .models import (
    AnalysisResult,
    CandidateIndex,
    IndexIssue,
    IndexIssueType,
    ReportFormat,
    SimulationResult,
)


class ReportExporter:
    def __init__(self):
        self.timestamp = datetime.now()
    
    def export(
        self,
        analysis_result: AnalysisResult,
        format: ReportFormat,
        simulation_results: Optional[List[SimulationResult]] = None,
    ) -> str:
        if format == ReportFormat.JSON:
            return self._export_json(analysis_result, simulation_results)
        elif format == ReportFormat.CSV:
            return self._export_csv(analysis_result, simulation_results)
        elif format == ReportFormat.MARKDOWN:
            return self._export_markdown(analysis_result, simulation_results)
        else:
            raise ValueError(f"Unknown format: {format}")
    
    def _export_json(
        self,
        analysis_result: AnalysisResult,
        simulation_results: Optional[List[SimulationResult]] = None,
    ) -> str:
        data = analysis_result.model_dump(mode="json")
        
        if simulation_results:
            data["simulations"] = [s.model_dump(mode="json") for s in simulation_results]
        
        data["exported_at"] = self.timestamp.isoformat()
        
        return json.dumps(data, indent=2, ensure_ascii=False)
    
    def _export_csv(
        self,
        analysis_result: AnalysisResult,
        simulation_results: Optional[List[SimulationResult]] = None,
    ) -> str:
        output = StringIO()
        writer = csv.writer(output)
        
        writer.writerow(["=== Index Issues ==="])
        writer.writerow([
            "Issue Type", "Table Name", "Index Name", "Severity", 
            "Columns", "Description", "Suggestions"
        ])
        
        for issue in analysis_result.issues:
            writer.writerow([
                issue.issue_type.value,
                issue.table_name,
                issue.index_name or "",
                issue.severity,
                ", ".join(issue.columns) if issue.columns else "",
                issue.description,
                "; ".join(issue.suggestions),
            ])
        
        writer.writerow([])
        writer.writerow(["=== Candidate Indexes ==="])
        writer.writerow([
            "Index Name", "Table Name", "Columns", "Index Type",
            "Queries Covered", "Performance Improvement %", "Write Cost Increase %",
            "Net Score", "Conflicting Indexes"
        ])
        
        for candidate in analysis_result.candidate_indexes:
            writer.writerow([
                candidate.index_name,
                candidate.table_name,
                ", ".join(candidate.columns),
                candidate.index_type.value,
                candidate.estimated_coverage_queries,
                f"{candidate.estimated_performance_improvement_pct:.1f}",
                f"{candidate.estimated_write_cost_increase_pct:.1f}",
                f"{candidate.net_score:.1f}",
                ", ".join(candidate.conficting_indexes),
            ])
        
        if simulation_results:
            writer.writerow([])
            writer.writerow(["=== Simulation Results ==="])
            writer.writerow([
                "Candidate Index", "Table", "Overall Score Change",
                "Queries Improved", "Write Cost Increase %", "Risk Level"
            ])
            
            for result in simulation_results:
                writer.writerow([
                    result.candidate_index.index_name,
                    result.candidate_index.table_name,
                    f"{result.overall_score_change:.1f}",
                    len(result.query_improvements),
                    f"{result.write_cost_analysis.get('estimated_increase_pct', 0):.1f}",
                    result.write_cost_analysis.get("risk_level", "unknown"),
                ])
        
        writer.writerow([])
        writer.writerow(["=== Summary ==="])
        writer.writerow(["Metric", "Value"])
        writer.writerow(["Database Type", analysis_result.database_type.value])
        writer.writerow(["Tables Analyzed", analysis_result.tables_analyzed])
        writer.writerow(["Queries Analyzed", analysis_result.queries_analyzed])
        writer.writerow(["Total Issues", len(analysis_result.issues)])
        writer.writerow(["Critical Issues", sum(1 for i in analysis_result.issues if i.severity == "critical")])
        writer.writerow(["High Issues", sum(1 for i in analysis_result.issues if i.severity == "high")])
        writer.writerow(["Medium Issues", sum(1 for i in analysis_result.issues if i.severity == "medium")])
        writer.writerow(["Low Issues", sum(1 for i in analysis_result.issues if i.severity == "low")])
        writer.writerow(["Candidate Indexes", len(analysis_result.candidate_indexes)])
        writer.writerow(["Exported At", self.timestamp.isoformat()])
        
        return output.getvalue()
    
    def _export_markdown(
        self,
        analysis_result: AnalysisResult,
        simulation_results: Optional[List[SimulationResult]] = None,
    ) -> str:
        lines = []
        
        lines.append(f"# 数据库索引分析报告")
        lines.append("")
        lines.append(f"> 生成时间: {self.timestamp.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"> 数据库类型: {analysis_result.database_type.value.upper()}")
        lines.append("")
        
        lines.append("## 执行摘要")
        lines.append("")
        
        summary = analysis_result.summary
        
        lines.append("| 指标 | 数值 |")
        lines.append("|------|------|")
        lines.append(f"| 分析的表数 | {analysis_result.tables_analyzed} |")
        lines.append(f"| 分析的查询数 | {analysis_result.queries_analyzed} |")
        lines.append(f"| 发现的问题总数 | {len(analysis_result.issues)} |")
        lines.append(f"| 建议的候选索引 | {len(analysis_result.candidate_indexes)} |")
        lines.append("")
        
        critical = sum(1 for i in analysis_result.issues if i.severity == "critical")
        high = sum(1 for i in analysis_result.issues if i.severity == "high")
        medium = sum(1 for i in analysis_result.issues if i.severity == "medium")
        low = sum(1 for i in analysis_result.issues if i.severity == "low")
        
        lines.append("### 问题严重程度分布")
        lines.append("")
        lines.append("| 严重程度 | 数量 |")
        lines.append("|----------|------|")
        lines.append(f"| Critical (严重) | {critical} |")
        lines.append(f"| High (高) | {high} |")
        lines.append(f"| Medium (中) | {medium} |")
        lines.append(f"| Low (低) | {low} |")
        lines.append("")
        
        if analysis_result.issues:
            lines.append("---")
            lines.append("")
            lines.append("## 发现的索引问题")
            lines.append("")
            
            issue_types = {
                IndexIssueType.MISSING: "缺失索引",
                IndexIssueType.REDUNDANT: "冗余索引",
                IndexIssueType.INEFFICIENT: "低效索引",
                IndexIssueType.UNUSED: "未使用索引",
                IndexIssueType.DUPLICATE: "重复索引",
            }
            
            for issue_type, type_name in issue_types.items():
                type_issues = [i for i in analysis_result.issues if i.issue_type == issue_type]
                if not type_issues:
                    continue
                
                lines.append(f"### {type_name}")
                lines.append("")
                
                for i, issue in enumerate(type_issues, 1):
                    severity_badge = self._get_severity_badge(issue.severity)
                    
                    lines.append(f"#### 问题 {i}: {severity_badge}")
                    lines.append("")
                    lines.append(f"- **表名**: `{issue.table_name}`")
                    if issue.index_name:
                        lines.append(f"- **索引名**: `{issue.index_name}`")
                    if issue.columns:
                        lines.append(f"- **涉及列**: `{', '.join(issue.columns)}`")
                    lines.append("")
                    lines.append(f"**描述**: {issue.description}")
                    lines.append("")
                    
                    if issue.estimated_impact:
                        lines.append("**预估影响**:")
                        lines.append("")
                        for key, value in issue.estimated_impact.items():
                            if isinstance(value, float):
                                lines.append(f"- `{key}`: {value:.2f}")
                            else:
                                lines.append(f"- `{key}`: {value}")
                        lines.append("")
                    
                    if issue.suggestions:
                        lines.append("**建议**:")
                        lines.append("")
                        for suggestion in issue.suggestions:
                            lines.append(f"- {suggestion}")
                        lines.append("")
        
        if analysis_result.candidate_indexes:
            lines.append("---")
            lines.append("")
            lines.append("## 建议的候选索引")
            lines.append("")
            
            lines.append("| # | 索引名称 | 表名 | 列 | 覆盖查询数 | 性能提升 % | 写入成本 % | 净得分 |")
            lines.append("|---|----------|------|-----|-----------|-----------|-----------|--------|")
            
            for i, candidate in enumerate(analysis_result.candidate_indexes, 1):
                lines.append(
                    f"| {i} | `{candidate.index_name}` | `{candidate.table_name}` | "
                    f"`{', '.join(candidate.columns)}` | {candidate.estimated_coverage_queries} | "
                    f"{candidate.estimated_performance_improvement_pct:.1f} | "
                    f"{candidate.estimated_write_cost_increase_pct:.1f} | "
                    f"{candidate.net_score:.1f} |"
                )
            
            lines.append("")
            
            for i, candidate in enumerate(analysis_result.candidate_indexes, 1):
                if candidate.conficting_indexes or candidate.supported_queries:
                    lines.append(f"### 候选索引 {i}: `{candidate.index_name}`")
                    lines.append("")
                    
                    if candidate.conficting_indexes:
                        lines.append("**冲突索引**:")
                        for idx in candidate.conficting_indexes:
                            lines.append(f"- `{idx}`")
                        lines.append("")
                    
                    if candidate.supported_queries:
                        lines.append(f"**支持的查询数**: {len(candidate.supported_queries)}")
                        lines.append("")
        
        if simulation_results:
            lines.append("---")
            lines.append("")
            lines.append("## 模拟结果")
            lines.append("")
            
            for i, result in enumerate(simulation_results, 1):
                candidate = result.candidate_index
                lines.append(f"### 模拟 {i}: 添加索引 `{candidate.index_name}`")
                lines.append("")
                
                if result.query_improvements:
                    lines.append("#### 查询性能提升")
                    lines.append("")
                    lines.append("| 查询 ID | 原执行时间 (ms) | 预估执行时间 (ms) | 提升 % | 原因 |")
                    lines.append("|---------|-----------------|-------------------|--------|------|")
                    
                    for q in result.query_improvements:
                        lines.append(
                            f"| {q['query_id']} | {q['original_execution_time_ms']:.2f} | "
                            f"{q['estimated_execution_time_ms']:.2f} | {q['improvement_pct']:.1f}% | "
                            f"{q['reason']} |"
                        )
                    lines.append("")
                
                lines.append("#### 写入成本分析")
                lines.append("")
                
                write_analysis = result.write_cost_analysis
                for key, value in write_analysis.items():
                    if isinstance(value, float):
                        lines.append(f"- **{key}**: {value:.2f}")
                    else:
                        lines.append(f"- **{key}**: {value}")
                lines.append("")
                
                lines.append(f"**综合得分变化**: {result.overall_score_change:+.2f}")
                lines.append("")
        
        if analysis_result.recommendations:
            lines.append("---")
            lines.append("")
            lines.append("## 主要建议")
            lines.append("")
            
            for i, rec in enumerate(analysis_result.recommendations, 1):
                lines.append(f"{i}. {rec}")
            lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append("## 附录")
        lines.append("")
        lines.append("### 术语说明")
        lines.append("")
        lines.append("- **缺失索引**: 经常用于 WHERE 子句但没有索引的列")
        lines.append("- **冗余索引**: 被其他索引覆盖的索引（如前缀索引）")
        lines.append("- **低效索引**: 选择性低或列数过多的索引")
        lines.append("- **未使用索引**: 根据分析的查询似乎从未被使用的索引")
        lines.append("- **重复索引**: 与其他索引具有相同列和类型的索引")
        lines.append("")
        lines.append("### 严重程度说明")
        lines.append("")
        lines.append("- **Critical**: 需要立即关注，可能导致严重性能问题")
        lines.append("- **High**: 应尽快修复，对性能有显著影响")
        lines.append("- **Medium**: 建议修复，可能在高负载下导致问题")
        lines.append("- **Low**: 可以在方便时修复，影响较小")
        lines.append("")
        
        return "\n".join(lines)
    
    def _get_severity_badge(self, severity: str) -> str:
        badges = {
            "critical": "🔴 **Critical**",
            "high": "🟠 **High**",
            "medium": "🟡 **Medium**",
            "low": "🟢 **Low**",
        }
        return badges.get(severity, severity)
    
    def export_issues_only(
        self,
        issues: List[IndexIssue],
        format: ReportFormat,
    ) -> str:
        if format == ReportFormat.JSON:
            return json.dumps([i.model_dump(mode="json") for i in issues], indent=2, ensure_ascii=False)
        elif format == ReportFormat.CSV:
            output = StringIO()
            writer = csv.writer(output)
            writer.writerow([
                "Issue Type", "Table Name", "Index Name", "Severity",
                "Columns", "Description"
            ])
            for issue in issues:
                writer.writerow([
                    issue.issue_type.value,
                    issue.table_name,
                    issue.index_name or "",
                    issue.severity,
                    ", ".join(issue.columns) if issue.columns else "",
                    issue.description,
                ])
            return output.getvalue()
        else:
            lines = ["# 索引问题列表", ""]
            for i, issue in enumerate(issues, 1):
                lines.append(f"## 问题 {i}: {issue.issue_type.value}")
                lines.append(f"- **表**: `{issue.table_name}`")
                if issue.index_name:
                    lines.append(f"- **索引**: `{issue.index_name}`")
                lines.append(f"- **严重程度**: {self._get_severity_badge(issue.severity)}")
                lines.append("")
                lines.append(f"**描述**: {issue.description}")
                lines.append("")
                if issue.suggestions:
                    lines.append("**建议**:")
                    for s in issue.suggestions:
                        lines.append(f"- {s}")
                lines.append("")
            return "\n".join(lines)
    
    def export_candidates_only(
        self,
        candidates: List[CandidateIndex],
        format: ReportFormat,
    ) -> str:
        if format == ReportFormat.JSON:
            return json.dumps([c.model_dump(mode="json") for c in candidates], indent=2, ensure_ascii=False)
        elif format == ReportFormat.CSV:
            output = StringIO()
            writer = csv.writer(output)
            writer.writerow([
                "Index Name", "Table Name", "Columns", "Index Type",
                "Queries Covered", "Performance Improvement %", "Write Cost Increase %", "Net Score"
            ])
            for c in candidates:
                writer.writerow([
                    c.index_name,
                    c.table_name,
                    ", ".join(c.columns),
                    c.index_type.value,
                    c.estimated_coverage_queries,
                    f"{c.estimated_performance_improvement_pct:.1f}",
                    f"{c.estimated_write_cost_increase_pct:.1f}",
                    f"{c.net_score:.1f}",
                ])
            return output.getvalue()
        else:
            lines = ["# 候选索引建议", ""]
            lines.append("| # | 索引名称 | 表名 | 列 | 净得分 |")
            lines.append("|---|----------|------|-----|--------|")
            for i, c in enumerate(candidates, 1):
                lines.append(
                    f"| {i} | `{c.index_name}` | `{c.table_name}` | "
                    f"`{', '.join(c.columns)}` | {c.net_score:.1f} |"
                )
            lines.append("")
            
            for i, c in enumerate(candidates, 1):
                lines.append(f"## 候选索引 {i}: `{c.index_name}`")
                lines.append("")
                lines.append(f"- **表**: `{c.table_name}`")
                lines.append(f"- **列**: `{', '.join(c.columns)}`")
                lines.append(f"- **类型**: {c.index_type.value}")
                lines.append("")
                lines.append("### 性能预估")
                lines.append(f"- **覆盖查询数**: {c.estimated_coverage_queries}")
                lines.append(f"- **预估性能提升**: {c.estimated_performance_improvement_pct:.1f}%")
                lines.append(f"- **预估写入成本增加**: {c.estimated_write_cost_increase_pct:.1f}%")
                lines.append(f"- **净得分**: {c.net_score:.1f}")
                lines.append("")
                
                if c.conficting_indexes:
                    lines.append("### 冲突索引")
                    for idx in c.conficting_indexes:
                        lines.append(f"- `{idx}`")
                    lines.append("")
            
            return "\n".join(lines)
