import argparse
import os
import sys
from pathlib import Path
from typing import List, Optional

from ..config.config import (
    get_data_dir,
    get_reports_dir,
    init_project,
    is_project_initialized,
    load_config,
    save_config,
)
from ..engine.rule_engine import RuleEngine
from ..engine.similarity_matcher import SimilarityMatcher
from ..parsers.glossary_parser import GlossaryParser
from ..parsers.transcript_parser import TranscriptParser
from ..reporters.reporter import ReportFormat, Reporter


def create_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="glossary-guardian",
        description="术语包离线守门员 - 会议同传/字幕团队本地术语检查工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  glossary-guardian init "2024发布会"
  glossary-guardian import-glossary terms.csv
  glossary-guardian scan transcript.srt
  glossary-guardian check
  glossary-guardian report --format markdown
        """,
    )

    parser.add_argument(
        "--version",
        action="version",
        version="%(prog)s 0.1.0",
    )

    parser.add_argument(
        "-d",
        "--directory",
        type=str,
        default=".",
        help="项目目录路径 (默认: 当前目录)",
    )

    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    init_parser = subparsers.add_parser("init", help="初始化新项目")
    init_parser.add_argument(
        "project_name",
        type=str,
        help="项目名称",
    )

    import_parser = subparsers.add_parser("import-glossary", help="导入术语包")
    import_parser.add_argument(
        "file_path",
        type=str,
        help="术语文件路径 (支持 CSV/JSON)",
    )
    import_parser.add_argument(
        "--source",
        type=str,
        default="user",
        help="术语来源标识 (默认: user)",
    )
    import_parser.add_argument(
        "--forbidden",
        action="store_true",
        help="导入禁用词表",
    )
    import_parser.add_argument(
        "--guests",
        action="store_true",
        help="导入嘉宾名单",
    )

    scan_parser = subparsers.add_parser("scan", help="扫描转写稿")
    scan_parser.add_argument(
        "file_path",
        type=str,
        help="转写稿文件路径 (支持 SRT/TXT)",
    )
    scan_parser.add_argument(
        "--source",
        type=str,
        default="scan",
        help="来源标识 (默认: scan)",
    )

    check_parser = subparsers.add_parser("check", help="执行术语检查")
    check_parser.add_argument(
        "--similarity-threshold",
        type=float,
        default=0.85,
        help="相似度阈值 (默认: 0.85)",
    )

    report_parser = subparsers.add_parser("report", help="导出检查报告")
    report_parser.add_argument(
        "--format",
        type=str,
        choices=["markdown", "csv", "json"],
        default="markdown",
        help="报告格式 (默认: markdown)",
    )
    report_parser.add_argument(
        "--output",
        type=str,
        default=None,
        help="输出文件路径 (默认: 项目 reports 目录)",
    )
    report_parser.add_argument(
        "--include-similarity",
        action="store_true",
        help="包含相似度检查结果",
    )

    list_parser = subparsers.add_parser("list", help="列出项目信息")
    list_parser.add_argument(
        "--type",
        type=str,
        choices=["glossary", "transcripts", "forbidden", "guests", "all"],
        default="all",
        help="列出类型 (默认: all)",
    )

    return parser


def cmd_init(args: argparse.Namespace):
    project_dir = Path(args.directory)

    if is_project_initialized(project_dir):
        print(f"❌ 项目已在 {project_dir} 初始化")
        sys.exit(1)

    try:
        config = init_project(project_dir, args.project_name)
        print(f"✅ 项目 '{args.project_name}' 初始化成功")
        print(f"   目录: {project_dir}")
        print(f"   创建时间: {config.created_at}")
    except Exception as e:
        print(f"❌ 初始化失败: {e}")
        sys.exit(1)


def cmd_import_glossary(args: argparse.Namespace):
    project_dir = Path(args.directory)

    if not is_project_initialized(project_dir):
        print("❌ 项目未初始化，请先运行 'init' 命令")
        sys.exit(1)

    file_path = Path(args.file_path)
    if not file_path.exists():
        print(f"❌ 文件不存在: {file_path}")
        sys.exit(1)

    config = load_config(project_dir)
    glossary_parser = GlossaryParser()

    data_dir = get_data_dir(project_dir)
    merged_file = data_dir / "merged_glossary.json"
    if merged_file.exists():
        glossary_parser.import_glossary(merged_file, "previous")

    try:
        if args.forbidden:
            glossary_parser.import_forbidden_terms(file_path)
            config.set_forbidden_terms_file(str(file_path))
            print(f"✅ 禁用词表导入成功: {file_path}")
        elif args.guests:
            glossary_parser.import_guest_list(file_path)
            config.set_guest_list_file(str(file_path))
            print(f"✅ 嘉宾名单导入成功: {file_path}")
        else:
            merged, conflicts = glossary_parser.import_glossary(file_path, args.source)
            config.add_glossary_file(str(file_path))

            print(f"✅ 术语包导入成功: {file_path}")
            print(f"   合并条目: {len(merged)}")
            if conflicts:
                print(f"   ⚠️  发现冲突: {len(conflicts)}")
                for conflict in conflicts[:5]:
                    print(f"      - {conflict}")
                if len(conflicts) > 5:
                    print(f"      ... 还有 {len(conflicts) - 5} 个冲突")

        glossary_parser.export_to_json(merged_file)
        save_config(project_dir, config)

    except Exception as e:
        print(f"❌ 导入失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


def cmd_scan(args: argparse.Namespace):
    project_dir = Path(args.directory)

    if not is_project_initialized(project_dir):
        print("❌ 项目未初始化，请先运行 'init' 命令")
        sys.exit(1)

    file_path = Path(args.file_path)
    if not file_path.exists():
        print(f"❌ 文件不存在: {file_path}")
        sys.exit(1)

    config = load_config(project_dir)
    transcript_parser = TranscriptParser()

    data_dir = get_data_dir(project_dir)
    merged_transcript_file = data_dir / "merged_transcripts.json"

    try:
        segments = transcript_parser.import_transcript(file_path, args.source)
        config.add_transcript_file(str(file_path))

        print(f"✅ 转写稿扫描成功: {file_path}")
        print(f"   片段数量: {len(segments)}")

        if segments:
            speakers = transcript_parser.get_speakers()
            if speakers:
                print(f"   识别说话人: {', '.join(speakers)}")

        save_config(project_dir, config)

    except Exception as e:
        print(f"❌ 扫描失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


def cmd_check(args: argparse.Namespace):
    project_dir = Path(args.directory)

    if not is_project_initialized(project_dir):
        print("❌ 项目未初始化，请先运行 'init' 命令")
        sys.exit(1)

    config = load_config(project_dir)
    data_dir = get_data_dir(project_dir)

    glossary_parser = GlossaryParser()
    transcript_parser = TranscriptParser()

    merged_glossary = data_dir / "merged_glossary.json"
    if merged_glossary.exists():
        try:
            glossary_parser.import_glossary(merged_glossary, "merged")
        except Exception:
            pass

    if not glossary_parser.entries:
        print("⚠️  未找到术语表，请先运行 'import-glossary' 导入术语包")

    for transcript_file in config.transcript_files:
        tf_path = Path(transcript_file)
        if tf_path.exists():
            try:
                transcript_parser.import_transcript(tf_path, "config")
            except Exception:
                pass

    if not transcript_parser.segments:
        print("⚠️  未找到转写稿，请先运行 'scan' 扫描转写稿")

    if not glossary_parser.entries and not transcript_parser.segments:
        print("❌ 没有可检查的数据")
        sys.exit(1)

    print("🔍 开始执行术语检查...")
    print("")

    rule_engine = RuleEngine(
        glossary_entries=list(glossary_parser.entries.values()),
        forbidden_terms=glossary_parser.forbidden_terms,
        guest_entries=glossary_parser.guests,
        settings=config.settings,
    )

    rule_result = rule_engine.check_all(transcript_parser.segments)

    print("📊 规则检查结果:")
    print(rule_result.summary)
    print("")

    similarity_matcher = SimilarityMatcher(
        glossary_entries=list(glossary_parser.entries.values()),
        guest_entries=glossary_parser.guests,
        threshold=args.similarity_threshold,
    )

    similarity_result = similarity_matcher.check_all(transcript_parser.segments)

    print("🔍 相似度检查结果:")
    sim_summary = similarity_result.get("summary", {})
    if sim_summary:
        print(f"   - 姓名变体问题: {sim_summary.get('total_name_variant_issues', 0)}")
        print(f"   - 翻译不一致问题: {sim_summary.get('total_inconsistent_translation_issues', 0)}")
        print(f"   - 相似上下文不同译法: {sim_summary.get('total_similar_context_issues', 0)}")
    print("")

    check_result_file = data_dir / "check_result.json"
    import json

    result_data = {
        "rule_result": {
            "issues": [i.to_dict() for i in rule_result.issues],
            "stats": rule_result.stats,
            "summary": rule_result.summary,
        },
        "similarity_result": similarity_result,
        "checked_at": __import__("datetime").datetime.now().isoformat(),
    }

    with open(check_result_file, "w", encoding="utf-8") as f:
        json.dump(result_data, f, ensure_ascii=False, indent=2)

    total_issues = len(rule_result.issues)
    if total_issues > 0:
        print(f"⚠️  共发现 {total_issues} 个问题，详情请查看报告")
    else:
        print("✅ 未发现任何问题")

    print(f"💾 检查结果已保存到: {check_result_file}")


def cmd_report(args: argparse.Namespace):
    project_dir = Path(args.directory)

    if not is_project_initialized(project_dir):
        print("❌ 项目未初始化，请先运行 'init' 命令")
        sys.exit(1)

    config = load_config(project_dir)
    data_dir = get_data_dir(project_dir)
    reports_dir = get_reports_dir(project_dir)

    check_result_file = data_dir / "check_result.json"
    if not check_result_file.exists():
        print("❌ 未找到检查结果，请先运行 'check' 命令")
        sys.exit(1)

    import json

    with open(check_result_file, "r", encoding="utf-8") as f:
        result_data = json.load(f)

    from ..engine.rule_engine import Issue, IssueSeverity, IssueType, RuleResult

    issues = []
    for issue_dict in result_data.get("rule_result", {}).get("issues", []):
        issue = Issue(
            issue_type=IssueType[issue_dict["issue_type"]],
            severity=IssueSeverity[issue_dict["severity"]],
            message=issue_dict["message"],
            location=issue_dict.get("location"),
            suggestion=issue_dict.get("suggestion"),
            details=issue_dict.get("details", {}),
            discovered_at=issue_dict.get("discovered_at", ""),
        )
        issues.append(issue)

    rule_result = RuleResult(
        issues=issues,
        stats=result_data.get("rule_result", {}).get("stats", {}),
        summary=result_data.get("rule_result", {}).get("summary", ""),
    )

    similarity_result = None
    if args.include_similarity:
        similarity_result = result_data.get("similarity_result", {})

    reporter = Reporter(
        project_name=config.project_name,
        rule_result=rule_result,
        similarity_result=similarity_result,
    )

    format_map = {
        "markdown": ReportFormat.MARKDOWN,
        "csv": ReportFormat.CSV,
        "json": ReportFormat.JSON,
    }

    report_format = format_map[args.format]

    if args.output:
        output_path = Path(args.output)
    else:
        timestamp = __import__("datetime").datetime.now().strftime("%Y%m%d_%H%M%S")
        ext_map = {"markdown": "md", "csv": "csv", "json": "json"}
        output_path = reports_dir / f"report_{timestamp}.{ext_map[args.format]}"

    try:
        reporter.export(output_path, report_format)
        print(f"✅ 报告已生成: {output_path}")
        print(f"   格式: {args.format}")
        print(f"   包含相似度检查: {'是' if args.include_similarity else '否'}")
    except Exception as e:
        print(f"❌ 报告生成失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


def cmd_list(args: argparse.Namespace):
    project_dir = Path(args.directory)

    if not is_project_initialized(project_dir):
        print("❌ 项目未初始化，请先运行 'init' 命令")
        sys.exit(1)

    config = load_config(project_dir)
    data_dir = get_data_dir(project_dir)

    glossary_parser = GlossaryParser()
    merged_glossary = data_dir / "merged_glossary.json"
    if merged_glossary.exists():
        try:
            glossary_parser.import_glossary(merged_glossary, "merged")
        except Exception:
            pass

    print(f"📋 项目: {config.project_name}")
    print(f"   创建时间: {config.created_at}")
    print(f"   更新时间: {config.updated_at}")
    print("")

    if args.type in ["all", "glossary"]:
        print("📚 术语表:")
        if glossary_parser.entries:
            print(f"   总条目数: {len(glossary_parser.entries)}")

            categories = {}
            for entry in glossary_parser.entries.values():
                cat = entry.category or "未分类"
                if cat not in categories:
                    categories[cat] = 0
                categories[cat] += 1

            if categories:
                print("   按分类:")
                for cat, count in sorted(categories.items()):
                    print(f"      - {cat}: {count}")

            abbreviations = glossary_parser.get_abbreviations()
            if abbreviations:
                print(f"   缩写定义: {len(abbreviations)}")

            duplicates = glossary_parser.get_duplicate_abbreviations()
            if duplicates:
                print(f"   ⚠️  重复缩写: {len(duplicates)}")
                for abbr, entries in duplicates.items():
                    print(f"      - {abbr}: {', '.join([e.chinese for e in entries])}")
        else:
            print("   (空)")
        print("")

    if args.type in ["all", "forbidden"]:
        print("🚫 禁用词表:")
        if glossary_parser.forbidden_terms:
            print(f"   总条目数: {len(glossary_parser.forbidden_terms)}")

            categories = {}
            for ft in glossary_parser.forbidden_terms:
                cat = ft.category or "未分类"
                if cat not in categories:
                    categories[cat] = 0
                categories[cat] += 1

            if categories:
                print("   按分类:")
                for cat, count in sorted(categories.items()):
                    print(f"      - {cat}: {count}")
        else:
            print("   (空)")
        print("")

    if args.type in ["all", "guests"]:
        print("👥 嘉宾名单:")
        if glossary_parser.guests:
            print(f"   总人数: {len(glossary_parser.guests)}")

            orgs = {}
            for guest in glossary_parser.guests:
                org = guest.organization or "未知"
                if org not in orgs:
                    orgs[org] = 0
                orgs[org] += 1

            if orgs:
                print("   按单位:")
                for org, count in sorted(orgs.items()):
                    print(f"      - {org}: {count}")
        else:
            print("   (空)")
        print("")

    if args.type in ["all", "transcripts"]:
        print("📝 转写稿:")
        if config.transcript_files:
            print(f"   文件数: {len(config.transcript_files)}")
            for tf in config.transcript_files:
                print(f"      - {tf}")
        else:
            print("   (空)")
        print("")


def main():
    parser = create_parser()
    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(0)

    command_handlers = {
        "init": cmd_init,
        "import-glossary": cmd_import_glossary,
        "scan": cmd_scan,
        "check": cmd_check,
        "report": cmd_report,
        "list": cmd_list,
    }

    handler = command_handlers.get(args.command)
    if handler:
        handler(args)
    else:
        print(f"❌ 未知命令: {args.command}")
        sys.exit(1)


if __name__ == "__main__":
    main()
