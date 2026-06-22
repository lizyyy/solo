from __future__ import annotations

import argparse
import json
import os
import sys
from typing import Optional

from .models import MaterialType
from .service import ReviewService, DEFAULT_GAP_HOURS


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="blade-review",
        description="风机叶片报告复核：导入/去重/异常检测/挂起/交接导出",
    )
    parser.add_argument(
        "--db",
        default=None,
        help="SQLite 数据库路径（默认: BLADE_REVIEW_DB 或 ./blade_review.db）",
    )
    parser.add_argument(
        "--gap-hours",
        type=float,
        default=DEFAULT_GAP_HOURS,
        help=f"采样断档阈值小时数（默认: {DEFAULT_GAP_HOURS}）",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("init", help="初始化数据库（空库即可使用）")

    imp = sub.add_parser("import", help="导入巡检表/补充材料/口头说明")
    imp.add_argument("--title", default=None, help="报告标题（默认: 风机叶片报告复核）")
    imp.add_argument(
        "--blade-id",
        dest="blade_ids",
        action="append",
        default=[],
        help="叶片编号（可重复传多次）",
    )
    imp.add_argument("--csv", dest="csv_path", help="巡检表 CSV 路径")
    imp.add_argument(
        "--material",
        dest="materials",
        nargs=3,
        action="append",
        default=[],
        metavar=("TYPE", "NAME", "FILE"),
        help="导入文件类材料：TYPE=(inspection_form|supplementary|verbal_note) NAME 显示名 FILE 文件路径",
    )
    imp.add_argument(
        "--verbal",
        dest="verbals",
        nargs=2,
        action="append",
        default=[],
        metavar=("NAME", "TEXT"),
        help="临时口头说明：NAME 显示名 TEXT 文字内容",
    )
    imp.add_argument("--operator", default="小宋", help="操作人")
    imp.add_argument("--report-id", default=None, help="指定合并到已有报告的ID")

    sub.add_parser("list", help="列出所有报告")

    show = sub.add_parser("show", help="显示报告概要")
    show.add_argument("--report", required=True, help="报告ID")

    hand = sub.add_parser("handover", help="生成交接班摘要")
    hand.add_argument("--report", required=True, help="报告ID")

    exp = sub.add_parser("export", help="导出报告为 JSON 或文本")
    exp.add_argument("--report", required=True, help="报告ID")
    exp.add_argument("--out", required=True, help="输出文件路径")
    exp.add_argument(
        "--format",
        choices=["json", "text"],
        default="json",
        help="导出格式（默认: json）",
    )

    res = sub.add_parser("resolve", help="确认并解决某个挂起项")
    res.add_argument("--report", required=True, help="报告ID")
    res.add_argument("--suspension", required=True, help="挂起ID")
    res.add_argument("--by", dest="by", default="现场老师", help="确认人")
    res.add_argument("--note", dest="note", required=True, help="确认说明")

    sample = sub.add_parser("demo", help="生成 README 中的演示样例（完整链路）")
    sample.add_argument(
        "--data-dir", default=None, help="样例数据目录（默认: examples）"
    )

    return parser


def cmd_init(service: ReviewService) -> int:
    print(f"[OK] 数据库已初始化: {service.db_path}")
    return 0


def cmd_import(
    service: ReviewService, args: argparse.Namespace
) -> int:
    from .models import BladeReport

    if not args.blade_ids and not args.csv_path and not args.materials and not args.verbals and not args.report_id:
        print(
            "[ERROR] 至少需要 --blade-id / --csv / --material / --verbal / --report-id 之一",
            file=sys.stderr,
        )
        return 2

    blade_ids = list(args.blade_ids) if args.blade_ids else []
    resolved_title = args.title or "风机叶片报告复核"
    if args.report_id:
        existing = service.get_report(args.report_id)
        if existing:
            if not blade_ids:
                blade_ids = list(existing.blade_ids)
            if not args.title:
                resolved_title = existing.title
    incoming = BladeReport(title=resolved_title, blade_ids=blade_ids, operator=args.operator)

    if args.csv_path:
        records = service.load_records_from_csv(args.csv_path)
        incoming.records.extend(records)
        for r in records:
            if r.blade_id and r.blade_id not in blade_ids:
                blade_ids.append(r.blade_id)
        incoming.blade_ids = blade_ids

    for mt, name, fpath in args.materials:
        mtype = MaterialType(mt)
        mat = service.load_material_from_file(fpath, name=name, material_type=mtype)
        incoming.materials.append(mat)

    for name, text in args.verbals:
        mat = service.load_material_from_text(name, text, material_type=MaterialType.VERBAL_NOTE)
        incoming.materials.append(mat)

    report, result = service.import_report(
        incoming, report_id=args.report_id, operator=args.operator
    )
    print(f"报告ID: {report.report_id}")
    print(f"新报告: {result.is_new_report}")
    print(
        f"记录: 新增 {result.records_added}, 跳过(重复) {result.records_skipped}, "
        f"人工备注保留 {result.notes_preserved}"
    )
    print(
        f"材料: 新增 {result.materials_added}, 更新(口径/改名) {result.materials_updated}, "
        f"跳过 {result.materials_skipped}"
    )
    print(f"状态: {report.status.value} | 挂起 {result.suspensions} 项")
    return 0


def cmd_list(service: ReviewService) -> int:
    rows = service.list_reports()
    if not rows:
        print("（无报告。使用 `blade-review import ...` 创建）")
        return 0
    for r in rows:
        print(
            f"{r['report_id']} | {r['status']:<9} | blades={r['blade_ids']} "
            f"| op={r['operator']} | updated={r['updated_at']} | {r['title']}"
        )
    return 0


def cmd_show(service: ReviewService, args: argparse.Namespace) -> int:
    report = service.get_report(args.report)
    if not report:
        print(f"[ERROR] 未找到报告 {args.report}", file=sys.stderr)
        return 3
    print(f"报告ID: {report.report_id}")
    print(f"标题: {report.title}")
    print(f"状态: {report.status.value}")
    print(f"操作人: {report.operator}")
    print(f"叶片: {report.blade_ids}")
    print(f"记录: {len(report.records)} 条")
    for r in report.records:
        print(
            f"  - {r.blade_id} {r.metric_name}={r.value} @ {r.timestamp.isoformat()}"
            + (f"  备注: {r.manual_note}" if r.manual_note else "")
        )
    print(f"材料: {len(report.materials)} 份")
    for m in report.materials:
        print(
            f"  - [{m.material_type.value}] {m.current_name} v{m.version}"
            + (" [改名]" if m.name_changed else "")
            + (" [口径变更]" if m.stance_changed else "")
        )
    pending = [s for s in report.suspensions if not s.resolved]
    if pending:
        print(f"待确认挂起: {len(pending)}")
        for s in pending:
            print(f"  - {s.suspension_id}: {s.reason}")
    return 0


def cmd_handover(service: ReviewService, args: argparse.Namespace) -> int:
    try:
        text = service.handover_text(args.report)
    except KeyError as e:
        print(f"[ERROR] 未找到 {e}", file=sys.stderr)
        return 3
    print(text)
    return 0


def cmd_export(service: ReviewService, args: argparse.Namespace) -> int:
    try:
        if args.format == "json":
            service.export_json(args.report, args.out)
        else:
            service.export_text(args.report, args.out)
    except KeyError as e:
        print(f"[ERROR] 未找到 {e}", file=sys.stderr)
        return 3
    print(f"[OK] 已导出 {args.format} -> {args.out}")
    return 0


def cmd_resolve(service: ReviewService, args: argparse.Namespace) -> int:
    ok, report = service.resolve_suspension(args.report, args.suspension, args.by, args.note)
    if not ok or not report:
        print(
            f"[ERROR] 未找到报告 {args.report} 或挂起 {args.suspension}（或已解决）",
            file=sys.stderr,
        )
        return 3
    print(f"[OK] 挂起已解决：{args.suspension}")
    print(f"报告新状态: {report.status.value}")
    return 0


def cmd_demo(service: ReviewService, args: argparse.Namespace) -> int:
    data_dir = args.data_dir or os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "..", "examples"
    )
    data_dir = os.path.abspath(data_dir)
    if not os.path.isdir(data_dir):
        print(f"[ERROR] 未找到样例目录: {data_dir}", file=sys.stderr)
        return 4
    script = os.path.join(data_dir, "run_sample.py")
    if not os.path.exists(script):
        print(f"[ERROR] 未找到 run_sample.py: {script}", file=sys.stderr)
        return 4
    import subprocess

    env = os.environ.copy()
    env["BLADE_REVIEW_DB"] = service.db_path
    completed = subprocess.run(
        [sys.executable, script],
        env=env,
        cwd=os.path.dirname(script),
    )
    return completed.returncode


def main(argv: Optional[list[str]] = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)
    with ReviewService(db_path=args.db, gap_hours=args.gap_hours) as service:
        if args.command == "init":
            return cmd_init(service)
        if args.command == "import":
            return cmd_import(service, args)
        if args.command == "list":
            return cmd_list(service)
        if args.command == "show":
            return cmd_show(service, args)
        if args.command == "handover":
            return cmd_handover(service, args)
        if args.command == "export":
            return cmd_export(service, args)
        if args.command == "resolve":
            return cmd_resolve(service, args)
        if args.command == "demo":
            return cmd_demo(service, args)
    parser.print_help()
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
