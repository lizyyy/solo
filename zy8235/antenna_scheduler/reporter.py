#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import csv
from pathlib import Path
from typing import Dict, List, Optional
from datetime import datetime
from collections import defaultdict

from .models import (
    Issue, IssueType, IssueSeverity, 
    ScheduledPass, ScheduleValidationResult
)
from .scheduler import SchedulePlanner


class ReportExporter:
    def __init__(self):
        pass
    
    def export_issues_csv(self, 
                          result: ScheduleValidationResult,
                          output_path: str) -> str:
        path = Path(output_path)
        
        headers = [
            'issue_type', 'severity', 'message', 'pass_ids', 
            'antenna_id', 'details', 'suggestion'
        ]
        
        rows = []
        for issue in result.issues:
            row = issue.to_dict()
            rows.append(row)
        
        with open(path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=headers)
            writer.writeheader()
            writer.writerows(rows)
        
        return str(path)
    
    def export_schedule_review_md(self,
                                   result: ScheduleValidationResult,
                                   output_path: str) -> str:
        path = Path(output_path)
        
        content = self._generate_markdown_report(result)
        
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        return str(path)
    
    def _generate_markdown_report(self, result: ScheduleValidationResult) -> str:
        lines = []
        
        lines.append("# 天线排程预检报告")
        lines.append("")
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        lines.append("## 1. 概览")
        lines.append("")
        
        total_passes = len(result.passes)
        total_issues = len(result.issues)
        critical_issues = len(result.get_issues_by_severity(IssueSeverity.CRITICAL))
        high_issues = len(result.get_issues_by_severity(IssueSeverity.HIGH))
        
        lines.append(f"- 总过境任务数: **{total_passes}**")
        lines.append(f"- 总问题数: **{total_issues}**")
        lines.append(f"  - 严重问题 (CRITICAL): **{critical_issues}**")
        lines.append(f"  - 高优先级问题 (HIGH): **{high_issues}**")
        lines.append("")
        
        if critical_issues > 0:
            lines.append("⚠️ **警告: 存在严重问题，需要立即处理**")
            lines.append("")
        
        lines.append("## 2. 天线配置")
        lines.append("")
        lines.append("| 天线ID | 名称 | 方位角范围 | 仰角范围 | 转向速率 | 冷却时间 |")
        lines.append("|--------|------|------------|----------|----------|----------|")
        for ant_id, antenna in result.antennas.items():
            lines.append(
                f"| {ant_id} | {antenna.name} | "
                f"{antenna.azimuth_min}°-{antenna.azimuth_max}° | "
                f"{antenna.elevation_min}°-{antenna.elevation_max}° | "
                f"{antenna.slew_rate}°/min | {antenna.cooldown_minutes}min |"
            )
        lines.append("")
        
        lines.append("## 3. 任务优先级配置")
        lines.append("")
        lines.append("| 任务类型 | 优先级 | 可抢占 | 说明 |")
        lines.append("|----------|--------|--------|------|")
        for mission_type, priority in result.priorities.items():
            can_preempt = "是" if priority.can_preempt else "否"
            lines.append(
                f"| {mission_type} | {priority.priority_level} | {can_preempt} | "
                f"{priority.description} |"
            )
        lines.append("")
        
        lines.append("## 4. 维护计划")
        lines.append("")
        if result.maintenances:
            lines.append("| 维护ID | 天线ID | 开始时间 | 结束时间 | 原因 |")
            lines.append("|--------|--------|----------|----------|------|")
            for m_id, m in result.maintenances.items():
                lines.append(
                    f"| {m_id} | {m.antenna_id} | "
                    f"{m.start_time.strftime('%Y-%m-%d %H:%M')} | "
                    f"{m.end_time.strftime('%Y-%m-%d %H:%M')} | "
                    f"{m.reason} |"
                )
        else:
            lines.append("无维护计划。")
        lines.append("")
        
        lines.append("## 5. 问题清单")
        lines.append("")
        
        issue_types = [
            (IssueType.TIME_OVERLAP, "时间重叠问题"),
            (IssueType.MAINTENANCE_CONFLICT, "维护冲突问题"),
            (IssueType.COOLDOWN_VIOLATION, "冷却时间违规"),
            (IssueType.SLEW_TIME_VIOLATION, "转向时间违规"),
            (IssueType.VISIBILITY_VIOLATION, "可见性违规"),
            (IssueType.PRIORITY_PREEMPTION, "优先级抢占"),
            (IssueType.SAME_SATELLITE_CONSECUTIVE, "同一卫星连续过境"),
        ]
        
        for issue_type, type_name in issue_types:
            issues = result.get_issues_by_type(issue_type)
            if issues:
                lines.append(f"### 5.{list(IssueType).index(issue_type) + 1} {type_name}")
                lines.append("")
                
                for i, issue in enumerate(issues, 1):
                    severity_emoji = {
                        IssueSeverity.CRITICAL: "🔴",
                        IssueSeverity.HIGH: "🟠",
                        IssueSeverity.MEDIUM: "🟡",
                        IssueSeverity.LOW: "🟢"
                    }.get(issue.severity, "⚪")
                    
                    lines.append(f"{severity_emoji} **问题 {i}** ({issue.severity.value.upper()})")
                    lines.append(f"- 描述: {issue.message}")
                    lines.append(f"- 涉及过境: {', '.join(issue.pass_ids)}")
                    lines.append(f"- 天线: {issue.antenna_id}")
                    lines.append(f"- 建议: {issue.suggestion}")
                    lines.append("")
        
        lines.append("## 6. 排程建议")
        lines.append("")
        
        if result.scheduled_passes:
            planner = SchedulePlanner()
            timeline = planner.analyze_timeline(result.scheduled_passes)
            
            lines.append(f"- 排程时间范围: {timeline['start_time'].strftime('%Y-%m-%d %H:%M')} 至 {timeline['end_time'].strftime('%Y-%m-%d %H:%M')}")
            lines.append(f"- 总时长: {timeline['total_duration_hours']:.1f} 小时")
            lines.append("")
            
            lines.append("### 6.1 任务状态汇总")
            lines.append("")
            lines.append("| 状态 | 数量 | 说明 |")
            lines.append("|------|------|------|")
            
            status_descriptions = {
                'SCHEDULED': ('可执行', '无冲突，可正常执行'),
                'PREEMPTED': ('被抢占', '被高优先级任务抢占'),
                'CONFLICT_MAINTENANCE': ('维护冲突', '与维护计划冲突'),
                'CONFLICT_VISIBILITY': ('可见性冲突', '超出天线可视范围'),
                'CONFLICT_SAME_PRIORITY': ('同优先级冲突', '与同优先级任务冲突'),
                'CONFLICT_TIMING': ('时间冲突', '时间间隔不足'),
            }
            
            for status, count in timeline.get('pass_status_summary', {}).items():
                desc = status_descriptions.get(status, (status, ''))
                lines.append(f"| {desc[0]} | {count} | {desc[1]} |")
            lines.append("")
            
            lines.append("### 6.2 各天线排程表")
            lines.append("")
            
            antenna_groups = planner.group_passes_by_antenna(result.scheduled_passes)
            
            for ant_id, passes in antenna_groups.items():
                lines.append(f"#### 天线 {ant_id}")
                lines.append("")
                lines.append("| 过境ID | 卫星 | 开始时间 | 结束时间 | 任务类型 | 优先级 | 状态 | 备注 |")
                lines.append("|--------|------|----------|----------|----------|--------|------|------|")
                
                for sp in passes:
                    status_icon = {
                        'SCHEDULED': '✅',
                        'PREEMPTED': '❌',
                        'CONFLICT_MAINTENANCE': '⚠️',
                        'CONFLICT_VISIBILITY': '⚠️',
                        'CONFLICT_SAME_PRIORITY': '⚠️',
                        'CONFLICT_TIMING': '⚠️',
                    }.get(sp.status, '❓')
                    
                    lines.append(
                        f"| {sp.pass_obj.pass_id} | {sp.pass_obj.satellite_name} | "
                        f"{sp.pass_obj.start_time.strftime('%Y-%m-%d %H:%M')} | "
                        f"{sp.pass_obj.end_time.strftime('%Y-%m-%d %H:%M')} | "
                        f"{sp.pass_obj.mission_type} | {sp.pass_obj.priority_level} | "
                        f"{status_icon} {sp.status} | {sp.notes or '-'} |"
                    )
                lines.append("")
            
            lines.append("### 6.3 可执行任务清单")
            lines.append("")
            executable = planner.get_executable_passes(result.scheduled_passes)
            
            if executable:
                lines.append(f"共 **{len(executable)}** 个任务可执行:")
                lines.append("")
                for sp in executable:
                    cross_midnight = " [跨午夜]" if sp.pass_obj.is_cross_midnight else ""
                    lines.append(
                        f"- **{sp.pass_obj.pass_id}**: {sp.pass_obj.satellite_name} "
                        f"({sp.pass_obj.start_time.strftime('%H:%M')}-{sp.pass_obj.end_time.strftime('%H:%M')}) "
                        f"天线 {sp.pass_obj.antenna_id}{cross_midnight}"
                    )
            else:
                lines.append("无可用的可执行任务。")
            lines.append("")
            
            lines.append("### 6.4 需要处理的冲突任务")
            lines.append("")
            conflicted = planner.get_conflicted_passes(result.scheduled_passes)
            
            if conflicted:
                lines.append(f"共 **{len(conflicted)}** 个任务存在冲突:")
                lines.append("")
                for sp in conflicted:
                    lines.append(
                        f"- **{sp.pass_obj.pass_id}**: {sp.pass_obj.satellite_name} - "
                        f"状态: {sp.status}, 备注: {sp.notes or '无'}"
                    )
            else:
                lines.append("没有冲突任务。")
            lines.append("")
        
        lines.append("## 7. 优化建议")
        lines.append("")
        
        suggestions = self._generate_suggestions(result)
        if suggestions:
            for i, suggestion in enumerate(suggestions, 1):
                lines.append(f"{i}. {suggestion}")
        else:
            lines.append("当前排程配置合理，暂无特别优化建议。")
        lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append("*报告由天线排程预检工具生成*")
        
        return "\n".join(lines)
    
    def _generate_suggestions(self, result: ScheduleValidationResult) -> List[str]:
        suggestions = []
        
        time_overlaps = result.get_issues_by_type(IssueType.TIME_OVERLAP)
        if time_overlaps:
            suggestions.append(
                f"存在 {len(time_overlaps)} 个时间重叠问题，建议根据优先级规则进行调整"
            )
        
        maintenance_conflicts = result.get_issues_by_type(IssueType.MAINTENANCE_CONFLICT)
        if maintenance_conflicts:
            suggestions.append(
                f"存在 {len(maintenance_conflicts)} 个维护计划冲突，这些任务需要重新安排时间"
            )
        
        visibility_issues = result.get_issues_by_type(IssueType.VISIBILITY_VIOLATION)
        if visibility_issues:
            suggestions.append(
                f"存在 {len(visibility_issues)} 个可见性问题，需要确认卫星过境角度或调整天线配置"
            )
        
        preemptions = result.get_issues_by_type(IssueType.PRIORITY_PREEMPTION)
        if preemptions:
            suggestions.append(
                f"存在 {len(preemptions)} 个优先级抢占情况，建议评估被抢占任务是否可以调整到其他天线或时间"
            )
        
        cooldown_violations = result.get_issues_by_type(IssueType.COOLDOWN_VIOLATION)
        slew_violations = result.get_issues_by_type(IssueType.SLEW_TIME_VIOLATION)
        if cooldown_violations or slew_violations:
            total = len(cooldown_violations) + len(slew_violations)
            suggestions.append(
                f"存在 {total} 个时间间隔不足问题，需要增加过境任务之间的缓冲时间"
            )
        
        return suggestions
