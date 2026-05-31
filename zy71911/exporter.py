import os
import csv
from typing import List
from datetime import datetime
from models import CheckResult, Issue, IssueStatus
from utils import Config, format_time


class Exporter:
    def __init__(self):
        Config.ensure_dirs()
        self.export_dir = Config.EXPORT_DIR

    def _format_issue_for_export(self, issue: Issue) -> dict:
        time_range = (
            f"{format_time(issue.time_segment.start_time)} - "
            f"{format_time(issue.time_segment.end_time)}"
        )

        return {
            "时间范围": time_range,
            "问题类型": issue.issue_type.value,
            "问题描述": issue.description,
            "判断理由": issue.reason,
            "下一步操作": issue.next_action.value,
            "当前状态": issue.status.value,
            "置信度": f"{int(issue.confidence * 100)}%",
            "问题ID": issue.issue_id,
            "备注": issue.notes or "",
        }

    def export_to_csv(self, result: CheckResult, filename: str = None) -> str:
        if not filename:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"{result.episode_id}_v{result.check_version:03d}_{timestamp}.csv"

        filepath = os.path.join(self.export_dir, filename)

        issues_sorted = sorted(
            result.issues, key=lambda x: x.time_segment.start_time
        )

        with open(filepath, "w", encoding="utf-8-sig", newline="") as f:
            fieldnames = [
                "时间范围",
                "问题类型",
                "问题描述",
                "判断理由",
                "下一步操作",
                "当前状态",
                "置信度",
                "问题ID",
                "备注",
            ]
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()

            for issue in issues_sorted:
                writer.writerow(self._format_issue_for_export(issue))

        return filepath

    def export_to_text(self, result: CheckResult, filename: str = None) -> str:
        if not filename:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"{result.episode_id}_v{result.check_version:03d}_{timestamp}.txt"

        filepath = os.path.join(self.export_dir, filename)

        issues_sorted = sorted(
            result.issues, key=lambda x: x.time_segment.start_time
        )

        pending_issues = [
            i for i in issues_sorted if i.status == IssueStatus.PENDING
        ]
        confirmed_issues = [
            i for i in issues_sorted if i.status == IssueStatus.CONFIRMED
        ]
        resolved_issues = [
            i for i in issues_sorted if i.status == IssueStatus.RESOLVED
        ]
        ignored_issues = [
            i for i in issues_sorted if i.status == IssueStatus.IGNORED
        ]

        with open(filepath, "w", encoding="utf-8") as f:
            f.write("=" * 70 + "\n")
            f.write(f"有声书口误清单 - {result.episode_id}\n")
            f.write(f"版本：v{result.check_version}\n")
            f.write(f"检查时间：{result.checked_at.strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"问题总数：{result.total_issues}\n")
            f.write(
                f"待处理：{len(pending_issues)} | "
                f"已确认：{len(confirmed_issues)} | "
                f"已解决：{len(resolved_issues)} | "
                f"已忽略：{len(ignored_issues)}\n"
            )
            f.write("=" * 70 + "\n\n")

            if pending_issues:
                f.write("【待处理问题】\n")
                f.write("-" * 50 + "\n")
                for idx, issue in enumerate(pending_issues, 1):
                    self._write_issue(f, idx, issue)
                f.write("\n")

            if confirmed_issues:
                f.write("【已确认待修复】\n")
                f.write("-" * 50 + "\n")
                for idx, issue in enumerate(confirmed_issues, 1):
                    self._write_issue(f, idx, issue)
                f.write("\n")

            if resolved_issues:
                f.write("【已解决】\n")
                f.write("-" * 50 + "\n")
                for idx, issue in enumerate(resolved_issues, 1):
                    self._write_issue(f, idx, issue, show_resolved=True)
                f.write("\n")

            if result.notes:
                f.write("【备注】\n")
                f.write(result.notes + "\n")

            f.write("\n" + "=" * 70 + "\n")
            f.write("交班提示：\n")
            f.write("- 按时间顺序核对原始音轨\n")
            f.write("- 处理完请更新状态\n")
            f.write("- 有疑问请标注备注\n")
            f.write("=" * 70 + "\n")

        return filepath

    def _write_issue(self, f, idx: int, issue: Issue, show_resolved: bool = False):
        time_range = (
            f"{format_time(issue.time_segment.start_time)} - "
            f"{format_time(issue.time_segment.end_time)}"
        )

        f.write(f"\n{idx}. [{issue.issue_type.value}] {time_range}\n")
        f.write(f"   问题：{issue.description}\n")
        f.write(f"   原因：{issue.reason}\n")
        if show_resolved:
            f.write(f"   处理结果：{issue.notes or '已解决'}\n")
        else:
            f.write(f"   下一步：{issue.next_action.value}\n")
        f.write(f"   问题ID：{issue.issue_id}\n")

    def export_launch_checklist(
        self, result: CheckResult, filename: str = None
    ) -> str:
        """导出上线前检查清单 - 供下一班继续处理"""
        if not filename:
            timestamp = datetime.now().strftime("%Y%m%d")
            filename = f"{result.episode_id}_上线清单_v{result.check_version:03d}_{timestamp}.txt"

        filepath = os.path.join(self.export_dir, filename)

        issues_sorted = sorted(
            result.issues, key=lambda x: x.time_segment.start_time
        )

        active_issues = [
            i
            for i in issues_sorted
            if i.status in [IssueStatus.PENDING, IssueStatus.CONFIRMED]
        ]

        with open(filepath, "w", encoding="utf-8") as f:
            f.write(f"节目：{result.episode_id}\n")
            f.write(f"版本：v{result.check_version}\n")
            f.write(f"导出时间：{datetime.now().strftime('%Y-%m-%d %H:%M')}\n")
            f.write(
                f"待处理问题：{len(active_issues)} / {result.total_issues}\n"
            )
            f.write("-" * 40 + "\n\n")

            if not active_issues:
                f.write("✅ 所有问题已处理完毕，可以上线！\n")
            else:
                f.write("【待核对清单】\n\n")
                for idx, issue in enumerate(active_issues, 1):
                    time_range = (
                        f"{format_time(issue.time_segment.start_time)} - "
                        f"{format_time(issue.time_segment.end_time)}"
                    )
                    f.write(
                        f"[{' ' if issue.status == IssueStatus.PENDING else '✓'}] "
                        f"{idx}. {time_range}\n"
                    )
                    f.write(f"    类型：{issue.issue_type.value}\n")
                    f.write(f"    操作：{issue.next_action.value}\n")
                    f.write(f"    说明：{issue.description}\n")
                    f.write(f"    ID：{issue.issue_id}\n")
                    f.write("\n")

                f.write("-" * 40 + "\n")
                f.write("【操作说明】\n")
                f.write("- [ ] 表示待处理，处理完打勾或更新状态\n")
                f.write("- 核对原始音轨后确认问题\n")
                f.write("- 需要剪辑的标记位置\n")
                f.write("- 完成后重新运行检查\n")

        return filepath
