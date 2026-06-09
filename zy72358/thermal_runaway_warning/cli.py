from __future__ import annotations

import argparse
import json
import sys
from typing import Any, Dict, List, Optional

from .engine import ThermalRunawayEngine
from .models import ProcessingStatus
from .result_store import ResultStore
from .self_check import SelfChecker
from .workflow import Workflow

SEP = "=" * 72


def _format_status(status: ProcessingStatus) -> str:
    mapping = {
        ProcessingStatus.PENDING: "待处理",
        ProcessingStatus.THRESHOLD_EXCEEDED: "⚠️  超阈值",
        ProcessingStatus.AWAITING_REVIEW: "🔍 待复核",
        ProcessingStatus.CONFIRMED_ABNORMAL: "🔴 确认异常",
        ProcessingStatus.CONFIRMED_NORMAL: "✅ 确认正常",
        ProcessingStatus.SUPPRESSED_BY_AVERAGE: "⚠️  被平均值盖掉(待维修师傅复核)",
        ProcessingStatus.RECALCULATED: "🔄 补录重算",
    }
    return mapping.get(status, status.value)


def _print_header(title: str) -> None:
    print(f"\n{SEP}")
    print(f"  {title}")
    print(SEP)


def _print_subheader(title: str) -> None:
    dashes = "-" * max(1, (68 - len(title)) // 2)
    print(f"\n--- {title} {dashes}")


def _print_evidence_summary(store: ResultStore) -> None:
    over_results = store.get_over_threshold_results()
    suppressed = store.get_suppressed_results()

    _print_header("超阈值证据摘要（维修师傅版）")

    if not over_results and not suppressed:
        print("  当前无超阈值记录")
        return

    if over_results:
        _print_subheader("超阈值记录")
        for r in over_results:
            avg = f"{r.average_value:.2f}" if r.average_value is not None else "—"
            print(f"  传感器编号: {r.sensor_id}")
            print(f"    原始行号:   第{r.original_row}行")
            print(f"    导入原始值:  {r.original_import_value}")
            print(f"    当前值:      {r.raw_value}")
            print(f"    阈值:        {r.threshold}")
            print(f"    组内平均值:  {avg}")
            print(f"    处理状态:    {_format_status(r.status)}")
            print(f"    下一步找谁:  {r.next_reviewer or '—'}")
            if r.amended_value is not None:
                print(f"    改后值:      {r.amended_value}")
                print(f"    改值说明:    {r.amendment_note or '—'}")
            if r.review_decision:
                print(f"    原始说法:    {r.review_decision.original_statement}")
                print(f"    处理原因:    {r.review_decision.amended_reason}")
                print(f"    复核人:      {r.review_decision.decided_by}")
            if r.photos:
                print(f"    工况照片:    {len(r.photos)}张")
                for p in r.photos:
                    row_tag = f"(第{p.attached_to_original_row}行)" if p.attached_to_original_row else ""
                    print(f"      - {row_tag}{p.photo_path} ({p.description}) by {p.attached_by}")
            if r.audit_trail:
                print(f"    审计轨迹:    {len(r.audit_trail)}条")
                for a in r.audit_trail[-4:]:
                    print(f"      [{a.timestamp}] {a.field_changed}: {a.old_value} -> {a.new_value} ({a.reason})")
            print()

    if suppressed:
        _print_subheader("被平均值盖掉（仍保留在超阈值列表，不会消失）")
        for r in suppressed:
            print(f"  ⚠️  传感器编号: {r.sensor_id}, 第{r.original_row}行")
            print(f"     原始值: {r.original_import_value}, 当前值: {r.raw_value}")
            print(f"     状态: {_format_status(r.status)}")
            print(f"     → 此记录**不会**因平均值低于阈值而自动消失，仍保留在超阈值列表中请维修师傅复核")
            print()


def _print_self_check(checker: SelfChecker) -> None:
    _print_header("自检报告")
    results = checker.run_all_checks()
    all_passed = True
    for r in results:
        mark = "✅ PASS" if r["passed"] else "❌ FAIL"
        print(f"  {mark}  {r['check']}")
        print(f"        {r['detail']}")
        print(f"        期望: {r['expectation']}")
        if not r["passed"]:
            all_passed = False
    print(f"\n  自检结果: {'全部通过' if all_passed else '存在失败项，请检查'}")


def _print_replay_command(args: argparse.Namespace) -> None:
    _print_header("可复盘命令")
    cmd_parts = [sys.executable, "-m", "thermal_runaway_warning"]
    cmd_parts.append(args.command)

    if args.command == "run":
        if getattr(args, "input_file", None):
            cmd_parts.extend(["--input-file", args.input_file])
        if getattr(args, "csv_file", None):
            cmd_parts.extend(["--csv-file", args.csv_file])
        if getattr(args, "photos", None):
            cmd_parts.extend(["--photos", args.photos])
        if getattr(args, "conversions", None):
            cmd_parts.extend(["--conversions", args.conversions])
        if getattr(args, "supplement", None):
            cmd_parts.extend(["--supplement", args.supplement])
        if getattr(args, "amendments", None):
            cmd_parts.extend(["--amendments", args.amendments])
        if getattr(args, "reviews", None):
            cmd_parts.extend(["--reviews", args.reviews])
        if getattr(args, "source_name", None):
            cmd_parts.extend(["--source-name", args.source_name])
        if getattr(args, "operator", None):
            cmd_parts.extend(["--operator", args.operator])
    elif args.command == "self-check":
        pass
    elif args.command == "export":
        if getattr(args, "format", None):
            cmd_parts.extend(["--format", args.format])
        if getattr(args, "output", None):
            cmd_parts.extend(["--output", args.output])

    print(f"  {' '.join(cmd_parts)}")
    print()


def _load_json_file(path: str) -> List:
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data if isinstance(data, list) else [data]


def _read_text_file(path: str) -> str:
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def _build_common(args: argparse.Namespace) -> Dict[str, Any]:
    initial_rows: Optional[List[Dict[str, Any]]] = None
    csv_text: Optional[str] = None
    if getattr(args, "csv_file", None):
        csv_text = _read_text_file(args.csv_file)
    elif getattr(args, "input_file", None):
        initial_rows = _load_json_file(args.input_file)
    return {"rows": initial_rows, "csv_text": csv_text}


def cmd_run(args: argparse.Namespace) -> None:
    data = _build_common(args)
    if data["rows"] is None and data["csv_text"] is None:
        print("错误: run 命令需要 --input-file 或 --csv-file 参数")
        sys.exit(1)

    photo_attachments = []
    if getattr(args, "photos", None):
        photo_attachments = _load_json_file(args.photos)

    unit_conversions = []
    if getattr(args, "conversions", None):
        unit_conversions = _load_json_file(args.conversions)

    supplement_rows = None
    if getattr(args, "supplement", None):
        supplement_rows = _load_json_file(args.supplement)

    amendments = None
    if getattr(args, "amendments", None):
        amendments = _load_json_file(args.amendments)

    reviews = None
    if getattr(args, "reviews", None):
        reviews = _load_json_file(args.reviews)

    source_name = getattr(args, "source_name", "") or ""

    engine = ThermalRunawayEngine(operator=args.operator or "system")
    store = ResultStore(engine)
    workflow = Workflow(engine, store)

    result = workflow.run_full_workflow(
        initial_rows=data["rows"],
        csv_text=data["csv_text"],
        photo_attachments=photo_attachments,
        unit_conversions=unit_conversions,
        supplement_rows=supplement_rows,
        amendments=amendments,
        manual_reviews=reviews,
        source_name=source_name,
    )

    _print_header("锂电包热失控预警 — 执行结果")

    s1 = result["step1_import"]
    print(f"\n  步骤1 首次导入: 导入{s1['imported_count']}条, 跳过{s1['skipped_count']}条")
    if s1["over_threshold_sensors"]:
        print(f"          超阈值传感器: {', '.join(s1['over_threshold_sensors'])}")
    if s1["suppression_findings"]:
        for sf in s1["suppression_findings"]:
            print(f"          ⚠️  {sf['detail']}")

    s2 = result["step2_photos"]
    print(f"\n  步骤2 补看工况照片: 关联{s2['attached_count']}张")
    if s2.get("unreviewed_over_threshold_sensors"):
        print(f"          待复核传感器: {', '.join(s2['unreviewed_over_threshold_sensors'])}")
    if s2.get("note"):
        print(f"          备注: {s2['note']}")

    s3 = result["step3_unit_conversion"]
    print(f"\n  步骤3 单位换算说明更新: {len(s3['updated_conversions'])}条规则")

    if result.get("step4_amendment"):
        s4 = result["step4_amendment"]
        print(f"\n  步骤4 何工补录修正: 完成{s4['amended_count']}条")

    if result.get("step5_review"):
        s5 = result["step5_review"]
        print(f"\n  步骤5 人工复核: 完成{s5['decisions_count']}条")

    if result.get("supplement"):
        sup = result["supplement"]
        print(f"\n  补录后重算: 补录{sup['supplemented_count']}条, 新事件{sup['new_events_count']}条")

    print(f"\n  汇总: 总记录{result['summary']['total']}条, "
          f"超阈值{result['summary']['over_threshold_count']}条, "
          f"被平均值盖掉{result['summary']['suppressed_by_average_count']}条, "
          f"待复核{result['summary']['awaiting_review_count']}条")

    _print_evidence_summary(store)
    _print_replay_command(args)

    _print_subheader("CSV预览（前5行）")
    if result.get("csv_preview"):
        for line in result["csv_preview"].splitlines():
            print(f"  {line}")

    _print_subheader("完整结果(摘要JSON)")
    print(json.dumps(result["summary"], ensure_ascii=False, indent=2))


def cmd_self_check(args: argparse.Namespace) -> None:
    engine = ThermalRunawayEngine(operator="self-check")
    store = ResultStore(engine)
    checker = SelfChecker(engine, store)
    _print_self_check(checker)
    _print_replay_command(args)


def cmd_export(args: argparse.Namespace) -> None:
    data = _build_common(args)
    if data["rows"] is None and data["csv_text"] is None:
        print("错误: export 命令需要 --input-file 或 --csv-file 参数")
        sys.exit(1)

    photo_attachments = []
    if getattr(args, "photos", None):
        photo_attachments = _load_json_file(args.photos)

    unit_conversions = []
    if getattr(args, "conversions", None):
        unit_conversions = _load_json_file(args.conversions)

    amendments = None
    if getattr(args, "amendments", None):
        amendments = _load_json_file(args.amendments)

    reviews = None
    if getattr(args, "reviews", None):
        reviews = _load_json_file(args.reviews)

    engine = ThermalRunawayEngine(operator=args.operator or "system")
    store = ResultStore(engine)
    workflow = Workflow(engine, store)

    workflow.run_full_workflow(
        initial_rows=data["rows"],
        csv_text=data["csv_text"],
        photo_attachments=photo_attachments,
        unit_conversions=unit_conversions,
        amendments=amendments,
        manual_reviews=reviews,
        source_name=getattr(args, "source_name", "") or "",
    )

    fmt = args.format or "json"
    if fmt == "json":
        output = store.to_json()
    elif fmt == "csv":
        output = store.to_csv()
    else:
        print(f"错误: 不支持的格式 '{fmt}'，支持 json/csv")
        sys.exit(1)

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(output)
        print(f"已导出到 {args.output}")
    else:
        print(output)


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="thermal-runaway-warning",
        description="锂电包热失控预警系统",
    )
    subparsers = parser.add_subparsers(dest="command", help="子命令")

    run_parser = subparsers.add_parser("run", help="执行完整预警工作流")
    input_group = run_parser.add_mutually_exclusive_group()
    input_group.add_argument("--input-file", required=False, help="传感器数据JSON文件路径")
    input_group.add_argument("--csv-file", required=False, help="传感器数据CSV文件路径(中文列名自动识别)")
    run_parser.add_argument("--photos", help="工况照片关联JSON文件路径")
    run_parser.add_argument("--conversions", help="单位换算规则JSON文件路径")
    run_parser.add_argument("--supplement", help="补录数据JSON文件路径")
    run_parser.add_argument("--amendments", help="何工补录修正JSON(传感器编号+原始行号+改后值+改值说明")
    run_parser.add_argument("--reviews", help="人工复核结果JSON(传感器编号+原始行号+最终状态+原始说法+处理原因+复核人+下一步找谁")
    run_parser.add_argument("--source-name", default="", help="导入来源标记(如 '6月批次.csv)")
    run_parser.add_argument("--operator", default="system", help="操作人(如何工/维修师傅)")

    check_parser = subparsers.add_parser("self-check", help="运行自检")
    check_parser.add_argument("--operator", default="self-check", help="操作人")

    export_parser = subparsers.add_parser("export", help="导出预警结果")
    exp_input = export_parser.add_mutually_exclusive_group()
    exp_input.add_argument("--input-file", required=False, help="传感器数据JSON文件路径")
    exp_input.add_argument("--csv-file", required=False, help="传感器数据CSV文件路径")
    export_parser.add_argument("--photos", help="工况照片关联JSON文件路径")
    export_parser.add_argument("--conversions", help="单位换算规则JSON文件路径")
    export_parser.add_argument("--amendments", help="何工补录修正JSON")
    export_parser.add_argument("--reviews", help="人工复核结果JSON")
    export_parser.add_argument("--format", choices=["json", "csv"], default="json", help="导出格式")
    export_parser.add_argument("--output", help="输出文件路径")
    export_parser.add_argument("--operator", default="system", help="操作人")
    export_parser.add_argument("--source-name", default="", help="导入来源标记")

    args = parser.parse_args()

    if args.command == "run":
        cmd_run(args)
    elif args.command == "self-check":
        cmd_self_check(args)
    elif args.command == "export":
        cmd_export(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
