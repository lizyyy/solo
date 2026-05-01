import argparse
import sys
from datetime import timedelta
from pathlib import Path
from typing import List, Optional

from .models import ProjectState, IssueType
from .subtitle_parser import (
    parse_subtitle_file, parse_chapters_file, parse_rules_file,
    export_srt, export_vtt
)
from .timeline_validator import validate_timeline, get_issue_summary
from .rule_engine import RuleEngine, create_default_rules
from .mask_mapper import MaskMapper
from .exporter import (
    export_report, export_clip_csv, export_timeline_json,
    export_sanitized_subtitles
)
from .project_manager import ProjectManager


def cmd_import(args):
    pm = ProjectManager(args.work_dir)

    if args.work_dir:
        pm.load_state()

    if args.subtitle:
        try:
            subtitles = parse_subtitle_file(args.subtitle)
            pm.state.subtitles = subtitles
            print(f"[OK] 导入字幕文件: {args.subtitle}")
            print(f"     共 {len(subtitles)} 条字幕")
        except Exception as e:
            print(f"[ERROR] 导入字幕文件失败: {e}")
            sys.exit(1)

    if args.chapter:
        try:
            chapters = parse_chapters_file(args.chapter)
            pm.state.chapters = chapters
            print(f"[OK] 导入章节文件: {args.chapter}")
            print(f"     共 {len(chapters)} 个章节")
        except Exception as e:
            print(f"[ERROR] 导入章节文件失败: {e}")
            sys.exit(1)

    if args.rules:
        try:
            rules = parse_rules_file(args.rules)
            pm.state.rules = rules
            print(f"[OK] 导入规则文件: {args.rules}")
            print(f"     共 {len(rules)} 条规则")
        except Exception as e:
            print(f"[ERROR] 导入规则文件失败: {e}")
            sys.exit(1)

    if args.default_rules:
        default_rules = create_default_rules()
        pm.state.rules = default_rules
        print(f"[OK] 加载默认规则: 共 {len(default_rules)} 条")

    if pm.save_state():
        print(f"[OK] 状态已保存")
    else:
        print(f"[WARNING] 状态保存失败")

    return 0


def cmd_scan(args):
    pm = ProjectManager(args.work_dir)

    if not pm.load_state():
        print(f"[ERROR] 未找到项目状态，请先运行 import 命令")
        sys.exit(1)

    if not pm.state.subtitles:
        print(f"[ERROR] 未导入字幕文件")
        sys.exit(1)

    print("[INFO] 开始扫描...")

    max_duration = timedelta(seconds=args.max_sentence_duration)

    timeline_issues = validate_timeline(
        pm.state.subtitles,
        pm.state.chapters if pm.state.chapters else None,
        max_duration
    )

    if pm.state.rules:
        engine = RuleEngine(pm.state.rules)
        starting_id = len(timeline_issues) + 1
        sensitive_issues = engine.scan_for_sensitive_words(pm.state.subtitles, starting_id)
        all_issues = timeline_issues + sensitive_issues
    else:
        all_issues = timeline_issues
        print("[WARNING] 未加载敏感词规则，跳过敏感词检测")

    pm.state.issues = all_issues

    summary = get_issue_summary(all_issues)

    print("")
    print("=" * 40)
    print("扫描结果汇总")
    print("=" * 40)
    print(f"总问题数: {summary['total']}")
    print("")
    print("按问题类型:")
    for issue_type, count in summary["by_type"].items():
        type_name = {
            "overlap": "重叠字幕",
            "long_sentence": "断句过长",
            "sensitive_word": "敏感词命中",
            "out_of_chapter": "章节外片段"
        }.get(issue_type, issue_type)
        print(f"  {type_name}: {count}")
    print("")
    print("按严重程度:")
    print(f"  高 (high): {summary['by_severity']['high']}")
    print(f"  中 (medium): {summary['by_severity']['medium']}")
    print(f"  低 (low): {summary['by_severity']['low']}")
    print("")

    if args.verbose and all_issues:
        print("问题详情:")
        print("-" * 40)
        for issue in all_issues:
            severity_icon = {
                "high": "🔴",
                "medium": "🟡",
                "low": "🟢"
            }.get(issue.severity, "⚪")

            type_name = {
                IssueType.OVERLAP: "重叠",
                IssueType.LONG_SENTENCE: "断句长",
                IssueType.SENSITIVE_WORD: "敏感词",
                IssueType.OUT_OF_CHAPTER: "章节外"
            }.get(issue.issue_type, "未知")

            print(f"#{issue.id} {severity_icon} [{type_name}] 字幕#{issue.subtitle_id}")
            print(f"     {issue.description}")
            print("")

    if pm.save_state():
        print(f"[OK] 扫描结果已保存")
    else:
        print(f"[WARNING] 状态保存失败")

    return 0


def cmd_mask(args):
    pm = ProjectManager(args.work_dir)

    if not pm.load_state():
        print(f"[ERROR] 未找到项目状态，请先运行 import 和 scan 命令")
        sys.exit(1)

    if not pm.state.subtitles:
        print(f"[ERROR] 未导入字幕文件")
        sys.exit(1)

    if not pm.state.rules:
        print(f"[ERROR] 未加载敏感词规则")
        sys.exit(1)

    print("[INFO] 开始脱敏处理...")

    engine = RuleEngine(pm.state.rules)
    mapper = MaskMapper()

    sanitized_subtitles, mask_mappings = mapper.mask_all_subtitles(pm.state.subtitles, engine)

    pm.state.sanitized_subtitles = sanitized_subtitles
    pm.state.mask_mappings = mask_mappings

    stats = mapper.get_statistics()

    for issue in pm.state.issues:
        if issue.issue_type == IssueType.SENSITIVE_WORD and issue.sensitive_match:
            for mapping in mask_mappings:
                if mapping.original_text == issue.sensitive_match:
                    issue.mask_value = mapping.masked_text
                    break

    print("")
    print("=" * 40)
    print("脱敏结果汇总")
    print("=" * 40)
    print(f"脱敏项总数: {stats['total_masked_items']}")
    print("")
    print("按类别:")
    for category, count in stats["by_category"].items():
        print(f"  {category}: {count}")
    print("")

    sensitive_count = len([s for s in sanitized_subtitles if s.has_sensitive])
    print(f"包含敏感内容的字幕: {sensitive_count} / {len(sanitized_subtitles)}")
    print("")

    if args.verbose and stats["global_mappings"]:
        print("脱敏映射表:")
        print("-" * 40)
        for original, masked in stats["global_mappings"].items():
            print(f"  {original} -> {masked}")
        print("")

    if pm.save_state():
        print(f"[OK] 脱敏结果已保存")
    else:
        print(f"[WARNING] 状态保存失败")

    return 0


def cmd_export(args):
    pm = ProjectManager(args.work_dir)

    if not pm.load_state():
        print(f"[ERROR] 未找到项目状态")
        sys.exit(1)

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    base_name = args.name or "podcast_sanitized"

    print(f"[INFO] 导出到: {output_dir}")

    exported = []

    if args.report:
        report_path = output_dir / f"{base_name}_report.md"
        export_report(pm.state, str(report_path), args.report_title)
        exported.append(f"报告: {report_path}")

    if args.clips:
        clips_path = output_dir / f"{base_name}_clips.csv"

        if not pm.state.clip_segments and pm.state.chapters:
            _generate_clip_segments(pm.state)

        export_clip_csv(pm.state.clip_segments, str(clips_path))
        exported.append(f"切片表: {clips_path}")

    if args.timeline:
        timeline_path = output_dir / f"{base_name}_timeline.json"
        export_timeline_json(pm.state, str(timeline_path))
        exported.append(f"时间轴: {timeline_path}")

    if args.subtitle:
        if pm.state.sanitized_subtitles:
            srt_path = output_dir / f"{base_name}_masked.srt"
            export_sanitized_subtitles(pm.state.sanitized_subtitles, str(srt_path), "srt")
            exported.append(f"脱敏字幕(SRT): {srt_path}")

            vtt_path = output_dir / f"{base_name}_masked.vtt"
            export_sanitized_subtitles(pm.state.sanitized_subtitles, str(vtt_path), "vtt")
            exported.append(f"脱敏字幕(VTT): {vtt_path}")
        else:
            print("[WARNING] 未执行 mask 命令，跳过脱敏字幕导出")

    if args.all:
        report_path = output_dir / f"{base_name}_report.md"
        export_report(pm.state, str(report_path), args.report_title)
        exported.append(f"报告: {report_path}")

        if not pm.state.clip_segments and pm.state.chapters:
            _generate_clip_segments(pm.state)
        clips_path = output_dir / f"{base_name}_clips.csv"
        export_clip_csv(pm.state.clip_segments, str(clips_path))
        exported.append(f"切片表: {clips_path}")

        timeline_path = output_dir / f"{base_name}_timeline.json"
        export_timeline_json(pm.state, str(timeline_path))
        exported.append(f"时间轴: {timeline_path}")

        if pm.state.sanitized_subtitles:
            srt_path = output_dir / f"{base_name}_masked.srt"
            export_sanitized_subtitles(pm.state.sanitized_subtitles, str(srt_path), "srt")
            exported.append(f"脱敏字幕(SRT): {srt_path}")

            vtt_path = output_dir / f"{base_name}_masked.vtt"
            export_sanitized_subtitles(pm.state.sanitized_subtitles, str(vtt_path), "vtt")
            exported.append(f"脱敏字幕(VTT): {vtt_path}")

    print("")
    print("=" * 40)
    print("导出完成")
    print("=" * 40)
    for item in exported:
        print(f"[OK] {item}")

    return 0


def _generate_clip_segments(state: ProjectState):
    from .models import ClipSegment

    segments: List[ClipSegment] = []
    segment_id = 1

    sorted_subs = sorted(state.subtitles, key=lambda x: x.start_time)

    if state.chapters:
        sorted_chapters = sorted(state.chapters, key=lambda x: x.start_time)

        for chapter in sorted_chapters:
            chapter_subs = []
            for sub in sorted_subs:
                sub_in = sub.start_time >= chapter.start_time
                if chapter.end_time:
                    sub_in = sub_in and sub.start_time < chapter.end_time
                if sub_in:
                    chapter_subs.append(sub)

            if chapter_subs:
                start_time = chapter_subs[0].start_time
                end_time = chapter_subs[-1].end_time
                subtitle_ids = [s.id for s in chapter_subs]

                has_sensitive = False
                for mapping in state.mask_mappings:
                    if mapping.subtitle_id in subtitle_ids:
                        has_sensitive = True
                        break

                segments.append(ClipSegment(
                    id=segment_id,
                    start_time=start_time,
                    end_time=end_time,
                    title=chapter.title,
                    subtitle_ids=subtitle_ids,
                    has_sensitive=has_sensitive,
                    chapter_id=chapter.id,
                    chapter_title=chapter.title
                ))
                segment_id += 1

        out_of_chapter_subs = []
        for sub in sorted_subs:
            sub_in_chapter = False
            for chapter in sorted_chapters:
                sub_in = sub.start_time >= chapter.start_time
                if chapter.end_time:
                    sub_in = sub_in and sub.start_time < chapter.end_time
                if sub_in:
                    sub_in_chapter = True
                    break
            if not sub_in_chapter:
                out_of_chapter_subs.append(sub)

        if out_of_chapter_subs:
            start_time = out_of_chapter_subs[0].start_time
            end_time = out_of_chapter_subs[-1].end_time
            subtitle_ids = [s.id for s in out_of_chapter_subs]

            has_sensitive = False
            for mapping in state.mask_mappings:
                if mapping.subtitle_id in subtitle_ids:
                    has_sensitive = True
                    break

            segments.append(ClipSegment(
                id=segment_id,
                start_time=start_time,
                end_time=end_time,
                title="章节外片段",
                subtitle_ids=subtitle_ids,
                has_sensitive=has_sensitive
            ))

    else:
        if sorted_subs:
            start_time = sorted_subs[0].start_time
            end_time = sorted_subs[-1].end_time
            subtitle_ids = [s.id for s in sorted_subs]

            has_sensitive = len(state.mask_mappings) > 0

            segments.append(ClipSegment(
                id=1,
                start_time=start_time,
                end_time=end_time,
                title="完整内容",
                subtitle_ids=subtitle_ids,
                has_sensitive=has_sensitive
            ))

    state.clip_segments = segments


def main():
    parser = argparse.ArgumentParser(
        prog="podcast-sanitizer",
        description="访谈字幕脱敏切片器 - 播客剪辑助理工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
使用示例:
  # 导入文件
  podcast-sanitizer import --subtitle podcast.srt --chapter chapters.csv --rules sensitive_rules.csv

  # 扫描问题
  podcast-sanitizer scan --verbose

  # 脱敏处理
  podcast-sanitizer mask --verbose

  # 导出全部
  podcast-sanitizer export --all --output-dir ./output
        """
    )

    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    import_parser = subparsers.add_parser("import", help="导入字幕、章节和规则文件")
    import_parser.add_argument("--subtitle", "-s", type=str, help="字幕文件路径 (.srt 或 .vtt)")
    import_parser.add_argument("--chapter", "-c", type=str, help="章节CSV文件路径")
    import_parser.add_argument("--rules", "-r", type=str, help="敏感词规则CSV文件路径")
    import_parser.add_argument("--default-rules", action="store_true", help="使用默认敏感词规则")
    import_parser.add_argument("--work-dir", "-w", type=str, default=".", help="工作目录 (默认: 当前目录)")

    scan_parser = subparsers.add_parser("scan", help="扫描时间轴问题和敏感词")
    scan_parser.add_argument("--max-sentence-duration", type=int, default=8, help="最大断句时长(秒)，默认8秒")
    scan_parser.add_argument("--verbose", "-v", action="store_true", help="显示详细信息")
    scan_parser.add_argument("--work-dir", "-w", type=str, default=".", help="工作目录 (默认: 当前目录)")

    mask_parser = subparsers.add_parser("mask", help="生成脱敏字幕和映射表")
    mask_parser.add_argument("--verbose", "-v", action="store_true", help="显示详细信息")
    mask_parser.add_argument("--work-dir", "-w", type=str, default=".", help="工作目录 (默认: 当前目录)")

    export_parser = subparsers.add_parser("export", help="导出审核报告、切片表和时间轴")
    export_parser.add_argument("--report", action="store_true", help="导出Markdown审核报告")
    export_parser.add_argument("--clips", action="store_true", help="导出CSV切片表")
    export_parser.add_argument("--timeline", action="store_true", help="导出JSON时间轴")
    export_parser.add_argument("--subtitle", action="store_true", help="导出脱敏字幕")
    export_parser.add_argument("--all", action="store_true", help="导出所有文件")
    export_parser.add_argument("--output-dir", "-o", type=str, default="./output", help="输出目录")
    export_parser.add_argument("--name", "-n", type=str, default="podcast_sanitized", help="输出文件名基础")
    export_parser.add_argument("--report-title", type=str, default="播客字幕审核报告", help="报告标题")
    export_parser.add_argument("--work-dir", "-w", type=str, default=".", help="工作目录 (默认: 当前目录)")

    args = parser.parse_args()

    if args.command is None:
        parser.print_help()
        sys.exit(0)

    if args.command == "import":
        sys.exit(cmd_import(args))
    elif args.command == "scan":
        sys.exit(cmd_scan(args))
    elif args.command == "mask":
        sys.exit(cmd_mask(args))
    elif args.command == "export":
        sys.exit(cmd_export(args))
    else:
        parser.print_help()
        sys.exit(0)


if __name__ == "__main__":
    main()
