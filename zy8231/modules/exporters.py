import csv
import json
from datetime import datetime
from typing import List, Dict, Any
import os

from .data_models import (
    AnalysisResult, Issue, IssueType, RiskLevel,
    ZoneCoverage, Schedule, Layout
)


class IssuesExporter:
    @staticmethod
    def export_to_csv(analysis_result: AnalysisResult, output_path: str) -> bool:
        try:
            with open(output_path, 'w', encoding='utf-8', newline='') as f:
                writer = csv.writer(f)
                
                writer.writerow([
                    '序号', '问题类型', '严重程度', '区域', '救生员',
                    '描述', '详情', '生成时间'
                ])
                
                for idx, issue in enumerate(analysis_result.all_issues, 1):
                    details_str = json.dumps(issue.details, ensure_ascii=False, default=str)
                    
                    writer.writerow([
                        idx,
                        issue.issue_type.value,
                        issue.severity.value,
                        issue.zone_id or '-',
                        issue.lifeguard_name or '-',
                        issue.description,
                        details_str,
                        datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                    ])
            
            return True
        except Exception as e:
            print(f"导出 issues.csv 失败: {e}")
            return False


class DutyReviewExporter:
    @staticmethod
    def export_to_markdown(
        analysis_result: AnalysisResult,
        layout: Layout,
        schedule: Schedule,
        output_path: str
    ) -> bool:
        try:
            lines = []
            
            lines.append("# 救生员值勤审查报告")
            lines.append("")
            lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            lines.append("")
            
            lines.append("## 一、概览")
            lines.append("")
            lines.append("| 指标 | 数值 |")
            lines.append("|------|------|")
            lines.append(f"| 总区域数 | {analysis_result.summary.get('total_zones', 0)} |")
            lines.append(f"| 总班次 | {analysis_result.summary.get('total_shifts', 0)} |")
            lines.append(f"| 总问题数 | {analysis_result.summary.get('total_issues', 0)} |")
            lines.append("")
            
            severity_stats = analysis_result.summary.get('issue_by_severity', {})
            lines.append("### 问题严重程度分布")
            lines.append("")
            lines.append("| 严重程度 | 数量 |")
            lines.append("|----------|------|")
            for severity in ['critical', 'high', 'medium', 'low']:
                count = severity_stats.get(severity, 0)
                lines.append(f"| {severity} | {count} |")
            lines.append("")
            
            type_stats = analysis_result.summary.get('issue_by_type', {})
            lines.append("### 问题类型分布")
            lines.append("")
            lines.append("| 问题类型 | 数量 |")
            lines.append("|----------|------|")
            for issue_type, count in type_stats.items():
                lines.append(f"| {issue_type} | {count} |")
            lines.append("")
            
            lines.append("## 二、详细问题列表")
            lines.append("")
            
            issues_by_severity: Dict[str, List[Issue]] = {
                'critical': [],
                'high': [],
                'medium': [],
                'low': []
            }
            
            for issue in analysis_result.all_issues:
                severity = issue.severity.value
                if severity in issues_by_severity:
                    issues_by_severity[severity].append(issue)
            
            severity_labels = {
                'critical': '严重 (Critical)',
                'high': '高 (High)',
                'medium': '中 (Medium)',
                'low': '低 (Low)'
            }
            
            for severity in ['critical', 'high', 'medium', 'low']:
                issues = issues_by_severity.get(severity, [])
                if not issues:
                    continue
                
                lines.append(f"### {severity_labels[severity]}")
                lines.append("")
                
                for idx, issue in enumerate(issues, 1):
                    lines.append(f"**{idx}. {issue.issue_type.value}**")
                    lines.append("")
                    lines.append(f"- **描述**: {issue.description}")
                    if issue.zone_id:
                        lines.append(f"- **区域**: {issue.zone_id}")
                    if issue.lifeguard_name:
                        lines.append(f"- **救生员**: {issue.lifeguard_name}")
                    
                    if issue.details:
                        lines.append("")
                        lines.append("  **详情**:")
                        for key, value in issue.details.items():
                            lines.append(f"  - {key}: {value}")
                    
                    lines.append("")
            
            lines.append("## 三、时段覆盖分析")
            lines.append("")
            
            time_slots = analysis_result.time_slots
            lines.append("| 时段 | 区域 | 救生员 | 访客数 | 风险等级 | 状态 |")
            lines.append("|------|------|--------|--------|----------|------|")
            
            for zone_id, coverages in analysis_result.zone_coverages.items():
                for coverage in coverages:
                    lifeguards_str = "、".join(coverage.assigned_lifeguards) if coverage.assigned_lifeguards else "无"
                    status = "已覆盖" if coverage.is_covered else "未覆盖"
                    
                    lines.append((
                        f"| {coverage.time_slot} | {coverage.zone_name} | {lifeguards_str} | "
                        f"{coverage.visitor_count} | {coverage.risk_level.value} | {status} |"
                    ))
            
            lines.append("")
            
            lines.append("## 四、建议措施")
            lines.append("")
            
            critical_count = len(issues_by_severity.get('critical', []))
            high_count = len(issues_by_severity.get('high', []))
            
            if critical_count > 0:
                lines.append(f"### 紧急措施 ({critical_count} 个严重问题)")
                lines.append("")
                lines.append("1. **儿童区域缺岗**: 立即安排替补救生员填补儿童区域空缺")
                lines.append("2. **盯防盲区**: 立即调整班次分配，覆盖所有高风险区域")
                lines.append("3. **严重超时**: 立即安排换岗，让超时救生员休息")
                lines.append("")
            
            if high_count > 0:
                lines.append(f"### 重要措施 ({high_count} 个高风险问题)")
                lines.append("")
                lines.append("1. **盲区问题**: 重新评估区域覆盖，确保每个区域都有救生员")
                lines.append("2. **疲劳超时**: 优化班次安排，避免连续值勤时间过长")
                lines.append("3. **打卡缺失**: 检查打卡系统，确保救生员按时打卡")
                lines.append("")
            
            lines.append("### 常规改进")
            lines.append("")
            lines.append("1. 定期检查救生员疲劳状态，避免连续值勤超过2小时")
            lines.append("2. 确保儿童区域始终有至少2名救生员")
            lines.append("3. 高风险区域（深水区、跳水区）需要额外关注")
            lines.append("4. 建立完善的打卡和巡检制度")
            lines.append("")
            
            lines.append("---")
            lines.append("")
            lines.append("*本报告由救生员盲区排查系统自动生成*")
            
            content = "\n".join(lines)
            
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(content)
            
            return True
        except Exception as e:
            print(f"导出 duty_review.md 失败: {e}")
            return False
