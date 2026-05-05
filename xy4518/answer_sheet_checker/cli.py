"""命令行工具。"""

import argparse
import os
import sys
from pathlib import Path
from typing import Optional


def main():
    """命令行入口。"""
    parser = argparse.ArgumentParser(
        prog="asc",
        description="答题卡回收核对自动化工具 - Answer Sheet Checker",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例用法:
  # 执行核查
  asc check --seat-table data/seat_table.csv --sheets-folder data/sheets 
            --absent-list data/absent_list.csv --batch data/batch.json

  # 指定工作目录
  asc check --work-dir ./exam_2024 --seat-table seat_table.csv ...

  # 启动网页界面
  asc web --port 5000

  # 导出结果
  asc export --result output/check_result_XXX.json --output-dir ./reports
        """,
    )

    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    check_parser = subparsers.add_parser("check", help="执行核查")
    check_parser.add_argument(
        "--work-dir", "-w", default=".", help="工作目录 (默认: 当前目录)"
    )
    check_parser.add_argument(
        "--seat-table", "-s", required=True, help="座位表 CSV 文件路径"
    )
    check_parser.add_argument(
        "--sheets-folder", "-f", required=True, help="答题卡文件夹路径"
    )
    check_parser.add_argument(
        "--absent-list", "-a", required=True, help="缺考签名单 CSV 文件路径"
    )
    check_parser.add_argument(
        "--batch", "-b", required=True, help="阅卷批次 JSON 文件路径"
    )
    check_parser.add_argument(
        "--no-remarks", action="store_true", help="不保留之前的备注"
    )
    check_parser.add_argument(
        "--output-dir", "-o", default=None, help="输出目录 (默认: work_dir/output)"
    )

    web_parser = subparsers.add_parser("web", help="启动网页界面")
    web_parser.add_argument(
        "--work-dir", "-w", default=".", help="工作目录 (默认: 当前目录)"
    )
    web_parser.add_argument(
        "--port", "-p", type=int, default=5000, help="端口号 (默认: 5000)"
    )
    web_parser.add_argument(
        "--host", default="127.0.0.1", help="监听地址 (默认: 127.0.0.1)"
    )

    export_parser = subparsers.add_parser("export", help="导出结果")
    export_parser.add_argument(
        "--result", "-r", required=True, help="检查结果 JSON 文件路径"
    )
    export_parser.add_argument(
        "--output-dir", "-o", default="./output", help="输出目录"
    )
    export_parser.add_argument(
        "--base-name", "-n", default=None, help="输出文件基础名称"
    )

    args = parser.parse_args()

    if args.command == "check":
        run_check(args)
    elif args.command == "web":
        run_web(args)
    elif args.command == "export":
        run_export(args)
    else:
        parser.print_help()


def run_check(args):
    """执行核查命令。"""
    from .engine import CheckEngine

    work_dir = Path(args.work_dir).absolute()

    def resolve_path(path: str) -> str:
        p = Path(path)
        if p.is_absolute():
            return str(p)
        return str(work_dir / p)

    engine = CheckEngine(work_dir=str(work_dir))

    try:
        result = engine.run_check(
            seat_table_path=resolve_path(args.seat_table),
            sheets_folder=resolve_path(args.sheets_folder),
            absent_list_path=resolve_path(args.absent_list),
            grading_batch_path=resolve_path(args.batch),
            preserve_remarks=not args.no_remarks,
        )

        engine.export_result(
            result=result,
            output_dir=resolve_path(args.output_dir) if args.output_dir else None,
        )

        print()
        print("=" * 50)
        print("核查流程完成！")
        print("=" * 50)

    except Exception as e:
        print(f"错误: {e}")
        sys.exit(1)


def run_web(args):
    """启动网页界面。"""
    work_dir = Path(args.work_dir).absolute()
    os.environ["ASC_WORK_DIR"] = str(work_dir)

    print(f"工作目录: {work_dir}")
    print(f"启动网页界面: http://{args.host}:{args.port}")
    print()
    print("按 Ctrl+C 停止服务器")
    print()

    from .web import create_app

    app = create_app(work_dir=str(work_dir))
    app.run(host=args.host, port=args.port, debug=True, use_reloader=False)


def run_export(args):
    """执行导出命令。"""
    import json

    from .exporter import Exporter
    from .models import (
        AbsentRecord,
        CheckResult,
        GradingBatch,
        Issue,
        IssueSeverity,
        IssueType,
        RoomStatistics,
        Student,
    )

    result_path = Path(args.result)
    if not result_path.exists():
        print(f"错误: 结果文件不存在: {result_path}")
        sys.exit(1)

    with open(result_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    batch_info = data.get("batch_info", {})
    grading_batch = GradingBatch(
        batch_id=batch_info.get("batch_id", ""),
        exam_name=batch_info.get("exam_name", ""),
        exam_date=batch_info.get("exam_date", ""),
        course_code=batch_info.get("course_code", ""),
        course_name=batch_info.get("course_name", ""),
        total_students=batch_info.get("total_students", 0),
        rooms=batch_info.get("rooms", []),
    )

    from datetime import datetime

    result = CheckResult(
        batch_id=grading_batch.batch_id,
        generated_at=datetime.now(),
        statistics={},
        all_issues=[],
        scanned_sheets={},
        student_roster={},
        absent_records={},
        grading_batch=grading_batch,
        remark_store=data.get("remarks", {}),
    )

    issues_data = data.get("issues", {})
    all_issues = []

    severity_map = {
        "critical": IssueSeverity.CRITICAL,
        "major": IssueSeverity.MAJOR,
        "minor": IssueSeverity.MINOR,
    }

    for severity_str, issues_list in issues_data.items():
        severity = severity_map.get(severity_str, IssueSeverity.MAJOR)
        for issue_data in issues_list:
            issue_type_str = issue_data.get("issue_type", "")
            try:
                issue_type = IssueType(issue_type_str)
            except ValueError:
                continue

            issue = Issue(
                issue_type=issue_type,
                severity=severity,
                description=issue_data.get("description", ""),
                affected_barcodes=issue_data.get("affected_barcodes", []),
                affected_files=issue_data.get("affected_files", []),
                room_number=issue_data.get("room_number"),
                recommendation=issue_data.get("recommendation"),
                notes=issue_data.get("notes"),
            )
            all_issues.append(issue)

    result.all_issues = all_issues

    stats_data = data.get("statistics", {})
    statistics = {}
    for room, stat_dict in stats_data.items():
        stats = RoomStatistics(
            room_number=room,
            total_students=stat_dict.get("total_students", 0),
            present_students=stat_dict.get("present_students", 0),
            absent_students=stat_dict.get("absent_students", 0),
            scanned_sheets=stat_dict.get("scanned_sheets", 0),
            missing_sheets=stat_dict.get("missing_sheets", 0),
            duplicate_count=stat_dict.get("duplicate_count", 0),
            issues=[],
        )
        statistics[room] = stats
    result.statistics = statistics

    Exporter.export_result(
        result=result,
        output_dir=args.output_dir,
        base_name=args.base_name,
    )

    print(f"导出完成: {args.output_dir}")


if __name__ == "__main__":
    main()
