"""
数据导出模块
"""

import csv
from pathlib import Path
from typing import List, Dict, Any, Optional

from smoke_cli.models import ZoneAnalysis, ValidationError, IssueType


def export_issues(
    analyses: List[ZoneAnalysis],
    validation_errors: List[ValidationError],
    output_path: str,
) -> str:
    all_issues = []

    for analysis in analyses:
        for issue in analysis.issues:
            all_issues.append({
                "zone_id": issue.get("zone_id", ""),
                "zone_name": issue.get("zone_name", ""),
                "issue_type": issue.get("issue_type", ""),
                "description": issue.get("description", ""),
                "time": issue.get("time", ""),
                "severity": _get_severity(issue.get("issue_type", "")),
                "details": _format_details(issue),
            })

    for error in validation_errors:
        all_issues.append({
            "zone_id": "",
            "zone_name": "",
            "issue_type": error.issue_type.value,
            "description": error.message,
            "time": "",
            "severity": _get_severity(error.issue_type.value),
            "details": f"文件: {error.file_path}, 行号: {error.line_number or 'N/A'}, 字段: {error.field_name or 'N/A'}, 原始值: {error.raw_value or 'N/A'}",
        })

    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    fieldnames = [
        "zone_id", "zone_name", "issue_type",
        "description", "time", "severity", "details"
    ]

    with open(output_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for issue in all_issues:
            writer.writerow(issue)

    return str(output_path)


def export_smoke_review(
    analyses: List[ZoneAnalysis],
    validation_errors: List[ValidationError],
    output_path: str,
) -> str:
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    content = []
    content.append("# 排烟联动复核报告")
    content.append("")
    content.append(f"生成时间: {_current_time_str()}")
    content.append("")

    critical_count = 0
    warning_count = 0
    info_count = 0

    for analysis in analyses:
        for issue in analysis.issues:
            severity = _get_severity(issue.get("issue_type", ""))
            if severity == "CRITICAL":
                critical_count += 1
            elif severity == "WARNING":
                warning_count += 1
            else:
                info_count += 1

    for error in validation_errors:
        severity = _get_severity(error.issue_type.value)
        if severity == "CRITICAL":
            critical_count += 1
        elif severity == "WARNING":
            warning_count += 1
        else:
            info_count += 1

    content.append("## 摘要")
    content.append("")
    content.append(f"- **严重问题**: {critical_count} 个")
    content.append(f"- **警告**: {warning_count} 个")
    content.append(f"- **信息**: {info_count} 个")
    content.append(f"- **检查的防烟分区**: {len(analyses)} 个")
    content.append("")

    if validation_errors:
        content.append("## 数据验证错误")
        content.append("")
        content.append("以下是数据文件验证中发现的问题:")
        content.append("")

        for idx, error in enumerate(validation_errors, 1):
            content.append(f"### 错误 {idx}: {error.issue_type.value}")
            content.append(f"- **严重程度**: {_get_severity(error.issue_type.value)}")
            content.append(f"- **文件**: {error.file_path}")
            if error.line_number:
                content.append(f"- **行号**: {error.line_number}")
            if error.field_name:
                content.append(f"- **字段**: {error.field_name}")
            content.append(f"- **描述**: {error.message}")
            if error.raw_value:
                content.append(f"- **原始值**: `{error.raw_value}`")
            content.append("")

    content.append("## 防烟分区分析详情")
    content.append("")

    for analysis in analyses:
        content.append(f"### 防烟分区: {analysis.zone_name} ({analysis.zone_id})")
        content.append(f"- **楼层**: {analysis.floor}F")
        if analysis.start_delay_seconds is not None:
            content.append(f"- **启动延迟**: {analysis.start_delay_seconds:.1f} 秒")
        if analysis.effective_exhaust_volume is not None:
            content.append(f"- **有效排烟量**: {analysis.effective_exhaust_volume:.2f} m³")
        content.append("")

        if analysis.timeline:
            content.append("#### 事件时间线")
            content.append("")
            content.append("| 时间 | 事件类型 | 设备 | 数值 |")
            content.append("|------|----------|------|------|")
            for event in analysis.timeline:
                value_str = f"{event.value:.2f}" if event.value is not None else "-"
                content.append(f"| {event.time.strftime('%Y-%m-%d %H:%M:%S')} | {event.event_type.value} | {event.device_id} | {value_str} |")
            content.append("")

        if analysis.issues:
            content.append("#### 发现的问题")
            content.append("")
            for idx, issue in enumerate(analysis.issues, 1):
                severity = _get_severity(issue.get("issue_type", ""))
                content.append(f"**问题 {idx}** ({severity}): {issue.get('description', '')}")
                if issue.get("time"):
                    content.append(f"- 时间: {issue.get('time')}")
                for key, value in issue.items():
                    if key not in ["zone_id", "zone_name", "issue_type", "description", "time"]:
                        content.append(f"- {key}: {value}")
                content.append("")

        content.append("---")
        content.append("")

    content.append("## 附录")
    content.append("")
    content.append("### 问题类型说明")
    content.append("")
    content.append("- `midnight_event_misassignment`: 跨午夜事件归属错误 - 事件发生在午夜前后，可能存在日期归属错误")
    content.append("- `fan_start_without_damper_open`: 风机启动但阀门未开 - 风机已启动但对应阀门未打开，存在排烟无效风险")
    content.append("- `sensor_gap`: 传感器断采 - 传感器数据存在连续缺失")
    content.append("- `missing_field`: 缺少字段 - 数据文件中缺少必需字段")
    content.append("- `invalid_value`: 无效值 - 字段值格式或内容无效")
    content.append("- `delay_exceeded`: 延迟超标 - 风机启动延迟超过规定阈值")
    content.append("")

    with open(output_path, "w", encoding="utf-8") as f:
        f.write("\n".join(content))

    return str(output_path)


def _get_severity(issue_type: str) -> str:
    critical_types = [
        IssueType.MIDNIGHT_EVENT_MISASSIGNMENT.value,
        IssueType.FAN_NO_DAMPER.value,
        IssueType.DELAY_EXCEEDED.value,
    ]
    warning_types = [
        IssueType.SENSOR_GAP.value,
    ]

    if issue_type in critical_types:
        return "CRITICAL"
    elif issue_type in warning_types:
        return "WARNING"
    else:
        return "INFO"


def _format_details(issue: Dict[str, Any]) -> str:
    parts = []
    for key, value in issue.items():
        if key not in ["zone_id", "zone_name", "issue_type", "description", "time"]:
            parts.append(f"{key}={value}")
    return ", ".join(parts)


def _current_time_str() -> str:
    from datetime import datetime
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")
