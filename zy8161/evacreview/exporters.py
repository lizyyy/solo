import csv
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from .parsers import Dataset
from .rules import Issue, IssueSeverity, IssueType


class IssuesExporter:
    FIELD_NAMES = [
        "severity",
        "issue_type",
        "badge_id",
        "name",
        "floor",
        "location",
        "timestamp",
        "description",
    ]

    @staticmethod
    def export_csv(issues: List[Issue], output_path: Path) -> int:
        if not issues:
            with open(output_path, "w", encoding="utf-8", newline="") as f:
                writer = csv.DictWriter(f, fieldnames=IssuesExporter.FIELD_NAMES)
                writer.writeheader()
            return 0

        critical_count = sum(1 for i in issues if i.severity == IssueSeverity.CRITICAL)
        warning_count = sum(1 for i in issues if i.severity == IssueSeverity.WARNING)
        info_count = sum(1 for i in issues if i.severity == IssueSeverity.INFO)

        with open(output_path, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=IssuesExporter.FIELD_NAMES)
            writer.writeheader()
            for issue in issues:
                row = issue.to_dict()
                filtered_row = {k: row.get(k, "") for k in IssuesExporter.FIELD_NAMES}
                writer.writerow(filtered_row)

        return len(issues)

    @staticmethod
    def summarize(issues: List[Issue]) -> Dict[str, Any]:
        summary = {
            "total": len(issues),
            "by_severity": {
                "critical": 0,
                "warning": 0,
                "info": 0,
            },
            "by_type": {},
            "by_floor": {},
        }

        for issue in issues:
            summary["by_severity"][issue.severity.value] += 1

            issue_type = issue.issue_type.value
            summary["by_type"][issue_type] = summary["by_type"].get(issue_type, 0) + 1

            if issue.floor:
                floor_key = str(issue.floor)
                summary["by_floor"][floor_key] = summary["by_floor"].get(floor_key, 0) + 1

        return summary


class ReportExporter:
    @staticmethod
    def _format_time(dt: Optional[datetime]) -> str:
        if not dt:
            return "N/A"
        return dt.strftime("%Y-%m-%d %H:%M:%S")

    @staticmethod
    def _severity_to_emoji(severity: IssueSeverity) -> str:
        if severity == IssueSeverity.CRITICAL:
            return "🔴"
        elif severity == IssueSeverity.WARNING:
            return "🟡"
        else:
            return "🔵"

    @staticmethod
    def _issue_type_to_display(issue_type: IssueType) -> str:
        display_map = {
            IssueType.MISSING_MEETING_POINT: "未到集合点",
            IssueType.RETROGRADE: "逆行行为",
            IssueType.DUPLICATE_SWIPE: "重复刷卡",
            IssueType.CAMERA_GAP: "摄像头点位缺失",
            IssueType.DATA_ISSUE: "数据问题",
            IssueType.MIDNIGHT_CROSSING: "跨午夜事件",
        }
        return display_map.get(issue_type, issue_type.value)

    @staticmethod
    def export_markdown(
        dataset: Dataset,
        issues: List[Issue],
        flow_analysis: Dict[str, Any],
        warnings: List[str],
        output_path: Path,
        report_title: str = "消防演练疏散复盘报告",
    ) -> None:
        lines = []

        lines.append(f"# {report_title}")
        lines.append("")
        lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        lines.append("---")
        lines.append("")

        lines.append("## 一、演练概览")
        lines.append("")

        start_time = flow_analysis.get("start_time")
        end_time = flow_analysis.get("end_time")
        duration = flow_analysis.get("duration_minutes", 0)
        total_people = flow_analysis.get("total_people", 0)
        arrived = flow_analysis.get("arrived_at_meeting", 0)
        missing = flow_analysis.get("missing_at_meeting", 0)

        lines.append("| 项目 | 内容 |")
        lines.append("|------|------|")
        lines.append(f"| 演练开始时间 | {ReportExporter._format_time(start_time)} |")
        lines.append(f"| 演练结束时间 | {ReportExporter._format_time(end_time)} |")
        lines.append(f"| 持续时长 | {duration} 分钟 |")
        lines.append(f"| 参与人员总数 | {total_people} 人 |")
        lines.append(f"| 已到达集合点 | {arrived} 人 |")
        lines.append(f"| 未到达集合点 | {missing} 人 |")
        if missing > 0 and total_people > 0:
            lines.append(f"| 集合点到达率 | {(arrived / total_people * 100):.1f}% |")
        lines.append("")

        lines.append("### 1.1 各楼层统计")
        lines.append("")
        floor_stats = flow_analysis.get("by_floor", {})
        if floor_stats:
            lines.append("| 楼层 | 楼层名称 | 事件数 | 涉及人数 |")
            lines.append("|------|----------|--------|----------|")
            for floor_num in sorted(floor_stats.keys(), key=lambda x: int(x)):
                stat = floor_stats[floor_num]
                lines.append(
                    f"| {floor_num}F | {stat.get('floor_name', '')} | "
                    f"{stat.get('event_count', 0)} | {stat.get('people_count', 0)} |"
                )
        else:
            lines.append("*无楼层统计数据*")
        lines.append("")

        lines.append("### 1.2 数据警告")
        lines.append("")
        if warnings:
            for w in warnings:
                lines.append(f"- ⚠️  {w}")
        else:
            lines.append("*无数据警告*")
        lines.append("")

        lines.append("---")
        lines.append("")
        lines.append("## 二、问题汇总")
        lines.append("")

        issues_summarizer = IssuesExporter()
        summary = issues_summarizer.summarize(issues)

        lines.append("| 严重程度 | 数量 |")
        lines.append("|----------|------|")
        lines.append(f"| 🔴 严重 (critical) | {summary['by_severity']['critical']} |")
        lines.append(f"| 🟡 警告 (warning) | {summary['by_severity']['warning']} |")
        lines.append(f"| 🔵 信息 (info) | {summary['by_severity']['info']} |")
        lines.append(f"| **总计** | **{summary['total']}** |")
        lines.append("")

        lines.append("### 2.1 按问题类型统计")
        lines.append("")
        if summary["by_type"]:
            lines.append("| 问题类型 | 数量 |")
            lines.append("|----------|------|")
            type_names = {
                "missing_meeting_point": "未到集合点",
                "retrograde": "逆行行为",
                "duplicate_swipe": "重复刷卡",
                "camera_gap": "摄像头点位缺失",
            }
            for issue_type, count in sorted(summary["by_type"].items(), key=lambda x: -x[1]):
                display_name = type_names.get(issue_type, issue_type)
                lines.append(f"| {display_name} | {count} |")
        else:
            lines.append("*无问题类型统计*")
        lines.append("")

        lines.append("---")
        lines.append("")
        lines.append("## 三、详细问题列表")
        lines.append("")

        if issues:
            critical_issues = [i for i in issues if i.severity == IssueSeverity.CRITICAL]
            warning_issues = [i for i in issues if i.severity == IssueSeverity.WARNING]
            info_issues = [i for i in issues if i.severity == IssueSeverity.INFO]

            if critical_issues:
                lines.append("### 3.1 🔴 严重问题 (Critical)")
                lines.append("")
                for idx, issue in enumerate(critical_issues, 1):
                    lines.append(f"**问题 {idx}: {ReportExporter._issue_type_to_display(issue.issue_type)}**")
                    lines.append("")
                    lines.append(f"- **时间**: {ReportExporter._format_time(issue.timestamp)}")
                    lines.append(f"- **人员**: {issue.name or issue.badge_id or '未知'}")
                    lines.append(f"- **工号**: {issue.badge_id or 'N/A'}")
                    lines.append(f"- **楼层**: {issue.floor}F" if issue.floor else "- **楼层**: N/A")
                    lines.append(f"- **位置**: {issue.location or 'N/A'}")
                    lines.append(f"- **描述**: {issue.description}")
                    lines.append("")

            if warning_issues:
                lines.append("### 3.2 🟡 警告问题 (Warning)")
                lines.append("")
                for idx, issue in enumerate(warning_issues, 1):
                    lines.append(f"**问题 {idx}: {ReportExporter._issue_type_to_display(issue.issue_type)}**")
                    lines.append("")
                    lines.append(f"- **时间**: {ReportExporter._format_time(issue.timestamp)}")
                    lines.append(f"- **人员**: {issue.name or issue.badge_id or '未知'}")
                    lines.append(f"- **工号**: {issue.badge_id or 'N/A'}")
                    lines.append(f"- **楼层**: {issue.floor}F" if issue.floor else "- **楼层**: N/A")
                    lines.append(f"- **位置**: {issue.location or 'N/A'}")
                    lines.append(f"- **描述**: {issue.description}")
                    lines.append("")

            if info_issues:
                lines.append("### 3.3 🔵 信息问题 (Info)")
                lines.append("")
                for idx, issue in enumerate(info_issues, 1):
                    lines.append(f"**问题 {idx}: {ReportExporter._issue_type_to_display(issue.issue_type)}**")
                    lines.append("")
                    lines.append(f"- **时间**: {ReportExporter._format_time(issue.timestamp)}")
                    lines.append(f"- **描述**: {issue.description}")
                    lines.append("")
        else:
            lines.append("*未检测到任何问题*")
            lines.append("")

        lines.append("---")
        lines.append("")
        lines.append("## 四、人员疏散时间线示例")
        lines.append("")

        sample_badges = list(dataset.unique_badge_ids)[:5]
        if sample_badges:
            for badge_id in sample_badges:
                events = dataset.get_person_events(badge_id)
                badge = dataset.get_badge(badge_id)
                name = badge.name if badge else badge_id

                lines.append(f"### 4.1 {name} ({badge_id})")
                lines.append("")
                lines.append("| 时间 | 事件类型 | 位置 | 详情 |")
                lines.append("|------|----------|------|------|")
                for event in events:
                    details = event.direction or event.details.get("note", "") or "-"
                    lines.append(
                        f"| {event.timestamp.strftime('%H:%M:%S')} | "
                        f"{event.event_type} | {event.location} | {details} |"
                    )
                lines.append("")
        else:
            lines.append("*无人员数据*")
        lines.append("")

        lines.append("---")
        lines.append("")
        lines.append("## 五、配置信息")
        lines.append("")
        lines.append(f"- 已配置楼层: {len(dataset.floors)} 层")
        lines.append(f"- 已配置检查点: {len(dataset.checkpoints)} 个")
        lines.append(f"- 集合点数量: {len(dataset.meeting_points)} 个")
        lines.append(f"- 出口数量: {len(dataset.exits)} 个")
        lines.append("")

        if dataset.meeting_points:
            lines.append("### 5.1 集合点列表")
            lines.append("")
            lines.append("| 名称 | 楼层 | 位置 |")
            lines.append("|------|------|------|")
            for mp in dataset.meeting_points:
                lines.append(f"| {mp.name} | {mp.floor}F | {mp.location or '-'} |")
            lines.append("")

        lines.append("---")
        lines.append("")
        lines.append("*本报告由 Evacuation Review Tool 自动生成*")

        with open(output_path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))
