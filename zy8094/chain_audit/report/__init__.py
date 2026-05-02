import csv
from datetime import datetime
from pathlib import Path
from typing import Any

from .rules import Issue
from .state_machine import SampleChain


def generate_markdown(
    chains: list[SampleChain],
    issues: list[Issue],
    athletes: list[dict[str, Any]],
    output_path: str
) -> None:
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write("# 样本链路审计报告\n\n")
        f.write(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")

        f.write("## 概览\n\n")
        f.write(f"- 运动员总数: {len(athletes)}\n")
        f.write(f"- 样本链路数: {len(chains)}\n")
        f.write(f"- 发现问题数: {len(issues)}\n\n")

        severity_counts = {}
        for issue in issues:
            severity_counts[issue.severity] = severity_counts.get(issue.severity, 0) + 1

        f.write("### 问题统计\n\n")
        for sev, count in sorted(severity_counts.items()):
            f.write(f"- {sev}: {count}\n")
        f.write("\n")

        if issues:
            f.write("## 问题详情\n\n")
            for issue in issues:
                f.write(f"### [{issue.severity.upper()}] {issue.sample_id} - {issue.category}\n\n")
                f.write(f"- **运动员ID**: {issue.athlete_id}\n")
                f.write(f"- **问题代码**: {issue.issue_id}\n")
                if issue.event_id:
                    f.write(f"- **关联事件**: {issue.event_id}\n")
                f.write(f"- **描述**: {issue.description}\n\n")

        f.write("## 样本链路详情\n\n")
        for chain in chains:
            f.write(f"### {chain.sample_id} (运动员: {chain.athlete_id})\n\n")
            f.write("| 序号 | 时间 | 事件类型 | 详情 |\n")
            f.write("|------|------|----------|------|\n")
            for i, event in enumerate(chain.sorted_events(), 1):
                details_str = ", ".join(f"{k}={v}" for k, v in event.details.items())
                f.write(f"| {i} | {event.timestamp.isoformat()} | {event.event_type} | {details_str} |\n")
            f.write("\n")


def generate_issues_csv(issues: list[Issue], output_path: str) -> None:
    with open(output_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['issue_id', 'severity', 'category', 'sample_id', 'athlete_id', 'description', 'event_id'])
        for issue in issues:
            writer.writerow([
                issue.issue_id,
                issue.severity,
                issue.category,
                issue.sample_id,
                issue.athlete_id,
                issue.description,
                issue.event_id or ''
            ])


def generate_timeline_html(
    chains: list[SampleChain],
    issues: list[Issue],
    athletes: list[dict[str, Any]],
    output_path: str
) -> None:
    issue_map = {}
    for issue in issues:
        key = f"{issue.sample_id}_{issue.event_id}" if issue.event_id else issue.sample_id
        issue_map[key] = issue

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write("<!DOCTYPE html>\n")
        f.write("<html lang='zh'>\n<head>\n")
        f.write("<meta charset='UTF-8'>\n")
        f.write("<meta name='viewport' content='width=device-width, initial-scale=1.0'>\n")
        f.write("<title>样本链路时间线</title>\n")
        f.write("<style>\n")
        f.write("body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; background: #f5f5f5; }\n")
        f.write(".chain { background: white; border-radius: 8px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }\n")
        f.write(".chain-header { font-size: 18px; font-weight: bold; margin-bottom: 15px; color: #333; }\n")
        f.write(".event { display: flex; align-items: flex-start; margin: 10px 0; padding: 10px; border-left: 3px solid #ddd; }\n")
        f.write(".event.collected { border-color: #4CAF50; }\n")
        f.write(".event.sealed { border-color: #2196F3; }\n")
        f.write(".event.handed_over { border-color: #FF9800; }\n")
        f.write(".event.stored { border-color: #9C27B0; }\n")
        f.write(".event.shipped { border-color: #00BCD4; }\n")
        f.write(".event.received_lab { border-color: #607D8B; }\n")
        f.write(".event-time { min-width: 180px; color: #666; font-size: 14px; }\n")
        f.write(".event-content { flex: 1; }\n")
        f.write(".event-type { font-weight: bold; color: #333; }\n")
        f.write(".event-details { color: #666; font-size: 14px; margin-top: 4px; }\n")
        f.write(".issue { background: #ffebee; border-left-color: #f44336 !important; }\n")
        f.write(".issue-badge { background: #f44336; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px; margin-left: 10px; }\n")
        f.write(".stats { background: #e3f2fd; padding: 15px; border-radius: 8px; margin-bottom: 20px; }\n")
        f.write("</style>\n")
        f.write("</head>\n<body>\n")

        f.write("<h1>样本链路时间线</h1>\n")
        f.write(f"<p>生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>\n")

        f.write("<div class='stats'>\n")
        f.write(f"<strong>统计:</strong> 运动员 {len(athletes)} | 样本链路 {len(chains)} | 问题 {len(issues)}\n")
        f.write("</div>\n")

        for chain in chains:
            f.write(f"<div class='chain'>\n")
            f.write(f"<div class='chain-header'>{chain.sample_id} (运动员: {chain.athlete_id})</div>\n")

            for event in chain.sorted_events():
                event_class = event.event_type.replace('_', '_')
                has_issue = False
                issue_desc = ""

                event_key = f"{chain.sample_id}_{event.event_id}"
                if event_key in issue_map:
                    has_issue = True
                    issue_desc = issue_map[event_key].description
                elif chain.sample_id in [k.split('_')[0] for k in issue_map.keys()]:
                    for k, v in issue_map.items():
                        if k.startswith(chain.sample_id) and v.event_id is None:
                            has_issue = True
                            issue_desc = v.description
                            break

                issue_class = " issue" if has_issue else ""
                badge = f"<span class='issue-badge'>{issue_desc}</span>" if has_issue else ""

                details_str = ", ".join(f"{k}: {v}" for k, v in event.details.items())

                f.write(f"<div class='event {event_class}{issue_class}'>\n")
                f.write(f"<div class='event-time'>{event.timestamp.strftime('%Y-%m-%d %H:%M:%S %Z')}</div>\n")
                f.write(f"<div class='event-content'>\n")
                f.write(f"<div class='event-type'>{event.event_type}{badge}</div>\n")
                f.write(f"<div class='event-details'>{details_str}</div>\n")
                f.write("</div>\n")
                f.write("</div>\n")

            f.write("</div>\n")

        f.write("</body>\n</html>\n")
