"""
输出模块
实现终端摘要、Markdown报告和CSV异常样本导出功能
"""

import os
import csv
from datetime import datetime
from typing import List, Dict, Any, Optional

import click

from quality_inspector.models import (
    Violation,
    ViolationType,
    Severity,
    QualityReport,
)
from quality_inspector.validators import ValidationError


def get_violation_type_display(violation_type: ViolationType) -> str:
    """获取违规类型的显示名称"""
    display_names = {
        ViolationType.BROKEN_PROMISE: "承诺未兑现",
        ViolationType.EMOTION_ESCALATION: "情绪升级",
        ViolationType.SENSITIVE_WORD: "敏感词",
        ViolationType.TIMEOUT_RESPONSE: "超时回复",
        ViolationType.MISSING_FIELD: "字段缺失",
        ViolationType.INVALID_FORMAT: "格式错误",
    }
    return display_names.get(violation_type, violation_type.value)


def get_severity_display(severity: Severity) -> str:
    """获取严重程度的显示名称"""
    display_names = {
        Severity.CRITICAL: "严重",
        Severity.HIGH: "高",
        Severity.MEDIUM: "中",
        Severity.LOW: "低",
    }
    return display_names.get(severity, severity.value)


def get_severity_color(severity: Severity) -> str:
    """获取严重程度对应的颜色"""
    color_map = {
        Severity.CRITICAL: "red",
        Severity.HIGH: "bright_red",
        Severity.MEDIUM: "yellow",
        Severity.LOW: "green",
    }
    return color_map.get(severity, "white")


def export_terminal_summary(
    report: QualityReport,
    validation_errors: Optional[List[ValidationError]] = None,
    verbose: bool = False
):
    """
    导出终端摘要
    
    Args:
        report: 质检报告
        validation_errors: 校验错误列表
        verbose: 是否显示详细信息
    """
    validation_errors = validation_errors or []
    
    # 基本统计
    click.echo("\n" + "=" * 60)
    click.echo(click.style("                    质检结果摘要", fg="cyan", bold=True))
    click.echo("=" * 60)
    
    # 基本信息
    click.echo(f"\n生成时间: {report.generated_at.strftime('%Y-%m-%d %H:%M:%S')}")
    click.echo("-" * 60)
    
    # 对话统计
    click.echo("\n【对话统计】")
    click.echo(f"  总对话数: {report.total_conversations}")
    click.echo(click.style(f"  有效对话: {report.valid_conversations}", fg="green"))
    click.echo(click.style(f"  无效对话: {report.invalid_conversations}", fg="red" if report.invalid_conversations > 0 else "green"))
    
    # 违规统计
    stats = report.statistics
    total_violations = stats.get("total_violations", 0)
    
    click.echo("\n【违规统计】")
    click.echo(f"  总违规数: {total_violations}")
    
    if total_violations > 0:
        # 按类型统计
        click.echo("\n  按违规类型:")
        type_counts = {
            "承诺未兑现": len(report.broken_promises),
            "情绪升级": len(report.emotion_escalations),
            "敏感词": len(report.sensitive_words),
            "超时回复": len(report.timeout_responses),
        }
        
        for type_name, count in type_counts.items():
            if count > 0:
                click.echo(f"    - {type_name}: {count}")
        
        # 按严重程度统计
        click.echo("\n  按严重程度:")
        severity_counts = stats.get("by_severity", {})
        for severity in [Severity.CRITICAL, Severity.HIGH, Severity.MEDIUM, Severity.LOW]:
            count = severity_counts.get(severity.value, 0)
            if count > 0:
                color = get_severity_color(severity)
                click.echo(click.style(
                    f"    - {get_severity_display(severity)}: {count}",
                    fg=color
                ))
    
    # 校验错误
    if validation_errors:
        click.echo("\n" + "-" * 60)
        click.echo(click.style("【校验错误】", fg="red"))
        for i, error in enumerate(validation_errors[:10], 1):  # 只显示前10个
            click.echo(click.style(f"  {i}. {error}", fg="yellow"))
        
        if len(validation_errors) > 10:
            click.echo(click.style(f"  ... 还有 {len(validation_errors) - 10} 个错误", fg="yellow"))
    
    # 详细违规信息（verbose模式）
    if verbose and report.violations:
        click.echo("\n" + "-" * 60)
        click.echo(click.style("【详细违规信息】", fg="cyan"))
        
        for i, violation in enumerate(report.violations[:20], 1):  # 只显示前20个
            color = get_severity_color(violation.severity)
            type_display = get_violation_type_display(violation.violation_type)
            severity_display = get_severity_display(violation.severity)
            
            click.echo(f"\n  [{i}] {type_display} ({severity_display})")
            click.echo(click.style(f"      描述: {violation.description}", fg=color))
            
            if violation.agent_name:
                click.echo(f"      坐席: {violation.agent_name}")
            if violation.customer_name:
                click.echo(f"      客户: {violation.customer_name}")
            if violation.message_content:
                # 截断过长的内容
                content = violation.message_content
                if len(content) > 50:
                    content = content[:50] + "..."
                click.echo(f"      相关消息: {content}")
        
        if len(report.violations) > 20:
            click.echo(click.style(f"\n  ... 还有 {len(report.violations) - 20} 条违规记录", fg="yellow"))
    
    click.echo("\n" + "=" * 60)


def export_markdown_report(
    report: QualityReport,
    output_path: str,
    validation_errors: Optional[List[ValidationError]] = None
):
    """
    导出Markdown报告
    
    Args:
        report: 质检报告
        output_path: 输出文件路径
        validation_errors: 校验错误列表
    """
    validation_errors = validation_errors or []
    stats = report.statistics
    total_violations = stats.get("total_violations", 0)
    
    # 构建Markdown内容
    lines = []
    
    # 标题
    lines.append("# 客服回访录音质检报告")
    lines.append("")
    lines.append(f"> 生成时间: {report.generated_at.strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append("")
    lines.append("---")
    lines.append("")
    
    # 执行摘要
    lines.append("## 执行摘要")
    lines.append("")
    
    # 对话统计表格
    lines.append("### 对话统计")
    lines.append("")
    lines.append("| 指标 | 数值 |")
    lines.append("|------|------|")
    lines.append(f"| 总对话数 | {report.total_conversations} |")
    lines.append(f"| 有效对话 | {report.valid_conversations} |")
    lines.append(f"| 无效对话 | {report.invalid_conversations} |")
    lines.append(f"| 总违规数 | {total_violations} |")
    lines.append("")
    
    # 违规类型统计
    lines.append("### 违规类型统计")
    lines.append("")
    
    type_counts = [
        ("承诺未兑现", len(report.broken_promises)),
        ("情绪升级", len(report.emotion_escalations)),
        ("敏感词", len(report.sensitive_words)),
        ("超时回复", len(report.timeout_responses)),
    ]
    
    if any(count > 0 for _, count in type_counts):
        lines.append("| 违规类型 | 数量 |")
        lines.append("|----------|------|")
        for type_name, count in type_counts:
            if count > 0:
                lines.append(f"| {type_name} | {count} |")
    else:
        lines.append("*暂无违规记录*")
    lines.append("")
    
    # 严重程度统计
    lines.append("### 严重程度统计")
    lines.append("")
    
    severity_counts = stats.get("by_severity", {})
    has_severity = any(severity_counts.get(s.value, 0) > 0 for s in Severity)
    
    if has_severity:
        lines.append("| 严重程度 | 数量 |")
        lines.append("|----------|------|")
        for severity in [Severity.CRITICAL, Severity.HIGH, Severity.MEDIUM, Severity.LOW]:
            count = severity_counts.get(severity.value, 0)
            if count > 0:
                lines.append(f"| {get_severity_display(severity)} | {count} |")
    else:
        lines.append("*暂无严重程度统计*")
    lines.append("")
    
    # 按坐席统计
    lines.append("### 按坐席统计")
    lines.append("")
    
    agent_counts = stats.get("by_agent", {})
    if agent_counts:
        lines.append("| 坐席姓名 | 违规数量 |")
        lines.append("|----------|----------|")
        # 按违规数量排序
        sorted_agents = sorted(agent_counts.items(), key=lambda x: x[1], reverse=True)
        for agent, count in sorted_agents:
            lines.append(f"| {agent} | {count} |")
    else:
        lines.append("*暂无坐席统计*")
    lines.append("")
    
    # 校验错误
    if validation_errors:
        lines.append("---")
        lines.append("")
        lines.append("## 校验错误")
        lines.append("")
        
        for i, error in enumerate(validation_errors, 1):
            lines.append(f"### 错误 {i}")
            lines.append("")
            lines.append(f"- **错误信息**: {error.message}")
            if error.field:
                lines.append(f"- **相关字段**: {error.field}")
            if error.value is not None:
                lines.append(f"- **字段值**: `{error.value}`")
            if error.source_file:
                lines.append(f"- **源文件**: `{error.source_file}`")
            lines.append("")
    
    # 详细违规记录
    if report.violations:
        lines.append("---")
        lines.append("")
        lines.append("## 详细违规记录")
        lines.append("")
        
        # 按类型分组
        violation_groups = {
            "承诺未兑现": report.broken_promises,
            "情绪升级": report.emotion_escalations,
            "敏感词": report.sensitive_words,
            "超时回复": report.timeout_responses,
        }
        
        for group_name, violations in violation_groups.items():
            if violations:
                lines.append(f"### {group_name}")
                lines.append("")
                
                for i, violation in enumerate(violations, 1):
                    lines.append(f"#### 记录 {i}")
                    lines.append("")
                    lines.append(f"- **严重程度**: {get_severity_display(violation.severity)}")
                    lines.append(f"- **描述**: {violation.description}")
                    
                    if violation.agent_name:
                        lines.append(f"- **坐席**: {violation.agent_name}")
                    if violation.customer_name:
                        lines.append(f"- **客户**: {violation.customer_name}")
                    if violation.conversation_time:
                        lines.append(f"- **对话时间**: {violation.conversation_time.strftime('%Y-%m-%d %H:%M:%S')}")
                    if violation.message_index is not None:
                        lines.append(f"- **消息索引**: {violation.message_index}")
                    if violation.message_content:
                        lines.append(f"- **消息内容**: {violation.message_content}")
                    if violation.message_time:
                        lines.append(f"- **消息时间**: {violation.message_time.strftime('%Y-%m-%d %H:%M:%S')}")
                    
                    # 额外数据
                    if violation.extra_data:
                        lines.append(f"- **额外信息**:")
                        for key, value in violation.extra_data.items():
                            if value is not None:
                                lines.append(f"  - {key}: `{value}`")
                    
                    lines.append("")
    
    # 页脚
    lines.append("---")
    lines.append("")
    lines.append("*本报告由客服回访录音质检工具自动生成*")
    
    # 写入文件
    with open(output_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))


def export_csv_exceptions(
    report: QualityReport,
    output_path: str
):
    """
    导出异常样本为CSV
    
    Args:
        report: 质检报告
        output_path: 输出文件路径
    """
    # 定义CSV字段
    fieldnames = [
        "violation_type",
        "violation_type_display",
        "severity",
        "severity_display",
        "description",
        "conversation_id",
        "agent_name",
        "customer_name",
        "conversation_time",
        "message_index",
        "message_content",
        "message_time",
        "extra_data",
    ]
    
    # 准备数据
    rows = []
    for violation in report.violations:
        row = {
            "violation_type": violation.violation_type.value,
            "violation_type_display": get_violation_type_display(violation.violation_type),
            "severity": violation.severity.value,
            "severity_display": get_severity_display(violation.severity),
            "description": violation.description,
            "conversation_id": violation.conversation_id,
            "agent_name": violation.agent_name,
            "customer_name": violation.customer_name,
            "conversation_time": violation.conversation_time.strftime('%Y-%m-%d %H:%M:%S') if violation.conversation_time else "",
            "message_index": violation.message_index if violation.message_index is not None else "",
            "message_content": violation.message_content,
            "message_time": violation.message_time.strftime('%Y-%m-%d %H:%M:%S') if violation.message_time else "",
            "extra_data": str(violation.extra_data) if violation.extra_data else "",
        }
        rows.append(row)
    
    # 写入CSV
    with open(output_path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
