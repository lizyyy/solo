import os
import sys
import argparse
from datetime import datetime
from typing import List, Optional

from models import EpisodeContext, CheckResult, Issue, IssueStatus, TimeSegment, IssueType, NextAction
from subtitle_processor import SubtitleParser, MuteSegmentDetector
from mispeak_detector import MispeakDetector
from history_manager import HistoryManager
from guest_manager import GuestListManager
from exporter import Exporter
from utils import Config, format_time


class PodcastChecker:
    def __init__(self):
        Config.ensure_dirs()
        self.subtitle_parser = SubtitleParser()
        self.mute_detector = MuteSegmentDetector()
        self.history_manager = HistoryManager()
        self.guest_manager = GuestListManager()
        self.exporter = Exporter()

    def run_check(
        self,
        episode_id: str,
        subtitle_path: str,
        episode_title: str = None,
        guest_list_path: str = None,
        ad_script_path: str = None,
        merge_history: bool = True,
    ) -> CheckResult:
        print(f"🔍 开始检查节目：{episode_id}")

        subtitles = self.subtitle_parser.parse_file(subtitle_path)
        print(f"   解析字幕：{len(subtitles)} 行")

        context = EpisodeContext(
            episode_id=episode_id,
            episode_title=episode_title or episode_id,
            subtitle_path=subtitle_path,
        )

        guest_list = []
        if guest_list_path and os.path.exists(guest_list_path):
            with open(guest_list_path, "r", encoding="utf-8") as f:
                guest_list = self.guest_manager.parse_guest_list(f.read())
            context.guest_list = guest_list
            print(f"   嘉宾名单：{len(guest_list)} 人")

        ad_scripts = []
        if ad_script_path and os.path.exists(ad_script_path):
            ad_scripts = self._parse_ad_scripts(ad_script_path)
            context.ad_scripts = ad_scripts
            print(f"   广告口播：{len(ad_scripts)} 条")

        version = self.history_manager.get_next_version(episode_id)
        print(f"   检查版本：v{version}")

        issues = []
        issues.extend(self._detect_mute_segments(subtitles))
        issues.extend(self._detect_misspeaks(subtitles, guest_list, ad_scripts, episode_id))

        print(f"   发现问题：{len(issues)} 个")

        if merge_history and version > 1:
            prev_version = version - 1
            print(f"   合并历史状态（v{prev_version}）...")
            issues = self.history_manager.merge_with_previous_status(
                issues, episode_id, prev_version
            )

        result = CheckResult(
            episode_id=episode_id,
            check_version=version,
            issues=issues,
            notes=f"自动检查于 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        )

        self.history_manager.save_check_result(result)
        print(f"✅ 检查完成，结果已保存")

        return result

    def _detect_mute_segments(self, subtitles) -> List[Issue]:
        gaps = self.mute_detector.detect_gaps(subtitles)
        issues = []

        for idx, gap in enumerate(gaps):
            time_str = (
                f"{format_time(gap.start_time)} - {format_time(gap.end_time)}"
            )
            issues.append(
                Issue(
                    issue_id=f"mute_{idx}",
                    issue_type=IssueType.MUTE_SEGMENT,
                    time_segment=gap,
                    description=f"时间 {time_str}：检测到静音段（{gap.duration:.1f}秒）",
                    reason=f"两条字幕之间间隔 {gap.duration:.1f} 秒，超过阈值 {self.mute_detector.threshold} 秒，可能需要剪辑或保留。",
                    next_action=NextAction.CHECK_AUDIO,
                    status=IssueStatus.PENDING,
                    confidence=1.0,
                )
            )

        return issues

    def _detect_misspeaks(
        self, subtitles, guest_list, ad_scripts, episode_id
    ) -> List[Issue]:
        from mispeak_detector import MispeakDetector
        detector = MispeakDetector(episode_id)
        return detector.detect_all(subtitles, guest_list, ad_scripts)

    def _parse_ad_scripts(self, filepath: str) -> List:
        from models import AdScript

        ad_scripts = []
        with open(filepath, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                parts = line.split("|")
                if len(parts) >= 3:
                    from utils import parse_time
                    start = parse_time(parts[0])
                    end = parse_time(parts[1])
                    text = parts[2].strip()
                    ad_scripts.append(
                        AdScript(
                            time_segment=TimeSegment(start, end),
                            expected_text=text,
                        )
                    )
        return ad_scripts

    def update_guest_list(
        self, episode_id: str, guest_list_path: str, note: str = None
    ):
        with open(guest_list_path, "r", encoding="utf-8") as f:
            guests = self.guest_manager.parse_guest_list(f.read())

        version, diffs = self.guest_manager.save_guest_list(
            episode_id, guests, note
        )

        if diffs:
            print(f"⚠️  嘉宾名单已更新为 v{version}")
            print(self.guest_manager.format_diff_message(diffs))
        else:
            print(f"✅ 嘉宾名单已保存 v{version}（无变更）")

        return version, diffs

    def export_results(
        self,
        episode_id: str,
        version: int = None,
        export_type: str = "all",
    ):
        if version is None:
            version = self.history_manager.get_latest_version(episode_id)
            if version is None:
                print(f"❌ 未找到节目 {episode_id} 的检查记录")
                return

        result = self.history_manager.load_check_result(episode_id, version)
        if not result:
            print(f"❌ 未找到版本 v{version} 的检查结果")
            return

        print(f"📤 导出节目 {episode_id} v{version}...")

        if export_type in ["all", "csv"]:
            path = self.exporter.export_to_csv(result)
            print(f"   CSV: {path}")

        if export_type in ["all", "txt"]:
            path = self.exporter.export_to_text(result)
            print(f"   详细报告: {path}")

        if export_type in ["all", "checklist"]:
            path = self.exporter.export_launch_checklist(result)
            print(f"   上线清单: {path}")

        print("✅ 导出完成")

    def show_history(self, episode_id: str):
        history = self.history_manager.get_episode_history(episode_id)
        if not history:
            print(f"ℹ️  节目 {episode_id} 暂无检查记录")
            return

        print(f"\n📋 节目 {episode_id} 检查历史：")
        print("-" * 60)
        for record in history:
            print(
                f"v{record.check_version:03d} | "
                f"{record.check_time.strftime('%Y-%m-%d %H:%M')} | "
                f"问题: {record.issue_count:02d} | "
                f"已解决: {record.resolved_count:02d}"
            )
        print("-" * 60)

    def show_issues(
        self, episode_id: str, version: int = None, status_filter: str = None
    ):
        if version is None:
            version = self.history_manager.get_latest_version(episode_id)
            if version is None:
                print(f"❌ 未找到节目 {episode_id} 的检查记录")
                return

        result = self.history_manager.load_check_result(episode_id, version)
        if not result:
            print(f"❌ 未找到版本 v{version} 的检查结果")
            return

        issues = sorted(result.issues, key=lambda x: x.time_segment.start_time)

        if status_filter:
            issues = [
                i for i in issues if i.status.value == status_filter
            ]

        print(f"\n🔍 节目 {episode_id} v{version} 问题列表 ({len(issues)} 个)：")
        print("-" * 70)

        for idx, issue in enumerate(issues, 1):
            time_str = f"{format_time(issue.time_segment.start_time)} - {format_time(issue.time_segment.end_time)}"
            status_icon = {
                "待处理": "[ ]",
                "已确认": "[✓]",
                "已解决": "[x]",
                "已忽略": "[-]",
            }.get(issue.status.value, "[?]")

            print(
                f"{status_icon} {idx:02d}. "
                f"[{issue.issue_type.value}] "
                f"{time_str}"
            )
            print(f"     {issue.description}")
            print(f"     → {issue.next_action.value}")
            print()


def main():
    parser = argparse.ArgumentParser(description="有声书口误清单检查工具")
    subparsers = parser.add_subparsers(dest="command", help="命令")

    check_parser = subparsers.add_parser("check", help="运行检查")
    check_parser.add_argument("episode_id", help="节目ID")
    check_parser.add_argument("subtitle_path", help="字幕文件路径")
    check_parser.add_argument("--title", help="节目标题")
    check_parser.add_argument("--guests", help="嘉宾名单路径")
    check_parser.add_argument("--ads", help="广告口播表路径")
    check_parser.add_argument(
        "--no-merge", action="store_true", help="不合并历史状态"
    )

    export_parser = subparsers.add_parser("export", help="导出结果")
    export_parser.add_argument("episode_id", help="节目ID")
    export_parser.add_argument("--version", type=int, help="版本号")
    export_parser.add_argument(
        "--type",
        choices=["all", "csv", "txt", "checklist"],
        default="all",
        help="导出类型",
    )

    history_parser = subparsers.add_parser("history", help="查看历史")
    history_parser.add_argument("episode_id", help="节目ID")

    show_parser = subparsers.add_parser("show", help="查看问题")
    show_parser.add_argument("episode_id", help="节目ID")
    show_parser.add_argument("--version", type=int, help="版本号")
    show_parser.add_argument(
        "--status", choices=["待处理", "已确认", "已解决", "已忽略"], help="状态过滤"
    )

    guest_parser = subparsers.add_parser("guests", help="更新嘉宾名单")
    guest_parser.add_argument("episode_id", help="节目ID")
    guest_parser.add_argument("guest_list_path", help="嘉宾名单路径")
    guest_parser.add_argument("--note", help="变更说明")

    args = parser.parse_args()

    checker = PodcastChecker()

    if args.command == "check":
        checker.run_check(
            episode_id=args.episode_id,
            subtitle_path=args.subtitle_path,
            episode_title=args.title,
            guest_list_path=args.guests,
            ad_script_path=args.ads,
            merge_history=not args.no_merge,
        )

    elif args.command == "export":
        checker.export_results(
            episode_id=args.episode_id,
            version=args.version,
            export_type=args.type,
        )

    elif args.command == "history":
        checker.show_history(args.episode_id)

    elif args.command == "show":
        checker.show_issues(
            episode_id=args.episode_id,
            version=args.version,
            status_filter=args.status,
        )

    elif args.command == "guests":
        checker.update_guest_list(
            episode_id=args.episode_id,
            guest_list_path=args.guest_list_path,
            note=args.note,
        )

    else:
        parser.print_help()


if __name__ == "__main__":
    main()
