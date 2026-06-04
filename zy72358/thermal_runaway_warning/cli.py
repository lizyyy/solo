from __future__ import annotations

import argparse
import json
import sys
from typing import List, Optional

from .engine import ThermalRunawayEngine
from .models import ProcessingStatus
from .result_store import ResultStore
from .self_check import SelfChecker
from .workflow import Workflow

SEP = "=" * 72
THIN_SEP = "-" * 72


def _format_status(status: ProcessingStatus) -> str:
    mapping = {
        ProcessingStatus.PENDING: "待处理",
        ProcessingStatus.THRESHOLD_EXCEEDED: "⚠️  超阈值",
        ProcessingStatus.AWAITING_REVIEW: "🔍 待复核",
        ProcessingStatus.CONFIRMED_ABNORMAL: "🔴 确认异常",
        ProcessingStatus.CONFIRMED_NORMAL: "✅ 确认正常",
        ProcessingStatus.SUPPRESSED_BY_AVERAGE: "⚠️  被平均值盖掉",
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

    _print_header("超阈值证据摘要")

    if not over_results and not suppressed:
        print("  当前无超阈值记录")
        return

    if over_results:
        _print_subheader("超阈值记录")
        for r in over_results:
            print(f"  传感器编号: {r.sensor_id}")
            print(f"    原始行号:   第{r.original_row}行")
            print(f"    原始值:     {r.raw_value}")
            print(f"    阈值:       {r.threshold}")
            print(f"    处理状态:   {_format_status(r.status)}")
            if r.photos:
                print(f"    工况照片:   {len(r.photos)}张")
                for p in r.photos:
                    print(f"      - {p.photo_path} ({p.description}) by {p.attached_by}")
            if r.audit_trail:
                print(f"    审计轨迹:   {len(r.audit_trail)}条")
                for a in r.audit_trail[-3:]:
                    print(f"      [{a.timestamp}] {a.field_changed}: {a.old_value} -> {a.new_value} ({a.reason})")
            print()

    if suppressed:
        _print_subheader("被平均值盖掉的记录（需复核）")
        for r in suppressed:
            print(f"  ⚠️  传感器编号: {r.sensor_id}, 第{r.original_row}行")
            print(f"     原始值: {r.raw_value}, 显示值: {r.display_value:.2f}")
            print(f"     状态: {_format_status(r.status)}")
            print(f"     → 此记录原始值超阈值但被平均值掩盖，未自动归正常，请维修师傅复核")
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
        if args.input_file:
            cmd_parts.extend(["--input-file", args.input_file])
        if args.photos:
            cmd_parts.extend(["--photos", args.photos])
        if args.conversions:
            cmd_parts.extend(["--conversions", args.conversions])
        if args.supplement:
            cmd_parts.extend(["--supplement", args.supplement])
        if args.operator:
            cmd_parts.extend(["--operator", args.operator])
    elif args.command == "self-check":
        pass
    elif args.command == "export":
        if args.format:
            cmd_parts.extend(["--format", args.format])
        if args.output:
            cmd_parts.extend(["--output", args.output])

    print(f"  {' '.join(cmd_parts)}")
    print()


def _load_json_file(path: str) -> List:
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data if isinstance(data, list) else [data]


def cmd_run(args: argparse.Namespace) -> None:
    if not args.input_file:
        print("错误: run 命令需要 --input-file 参数")
        sys.exit(1)

    initial_rows = _load_json_file(args.input_file)

    photo_attachments = []
    if args.photos:
        photo_attachments = _load_json_file(args.photos)

    unit_conversions = []
    if args.conversions:
        unit_conversions = _load_json_file(args.conversions)

    supplement_rows = []
    if args.supplement:
        supplement_rows = _load_json_file(args.supplement)

    engine = ThermalRunawayEngine(operator=args.operator or "system")
    store = ResultStore(engine)
    workflow = Workflow(engine, store)

    result = workflow.run_full_workflow(
        initial_rows=initial_rows,
        photo_attachments=photo_attachments,
        unit_conversions=unit_conversions,
        supplement_rows=supplement_rows if supplement_rows else None,
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

    if result.get("supplement"):
        sup = result["supplement"]
        print(f"\n  补录后重算: 补录{sup['supplemented_count']}条, 新事件{sup['new_events_count']}条")

    _print_evidence_summary(store)
    _print_replay_command(args)

    _print_subheader("完整结果(JSON)")
    print(json.dumps(result["final_result"], ensure_ascii=False, indent=2)[:3000])
    if len(json.dumps(result["final_result"], ensure_ascii=False)) > 3000:
        print("  ... (输出已截断，使用 export 命令获取完整结果)")


def cmd_self_check(args: argparse.Namespace) -> None:
    engine = ThermalRunawayEngine(operator="self-check")
    store = ResultStore(engine)
    checker = SelfChecker(engine, store)
    _print_self_check(checker)
    _print_replay_command(args)


def cmd_export(args: argparse.Namespace) -> None:
    if not args.input_file:
        print("错误: export 命令需要 --input-file 参数")
        sys.exit(1)

    initial_rows = _load_json_file(args.input_file)

    photo_attachments = []
    if args.photos:
        photo_attachments = _load_json_file(args.photos)

    unit_conversions = []
    if args.conversions:
        unit_conversions = _load_json_file(args.conversions)

    engine = ThermalRunawayEngine(operator=args.operator or "system")
    store = ResultStore(engine)
    workflow = Workflow(engine, store)

    workflow.run_full_workflow(
        initial_rows=initial_rows,
        photo_attachments=photo_attachments,
        unit_conversions=unit_conversions,
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
    run_parser.add_argument("--input-file", required=False, help="传感器数据JSON文件路径")
    run_parser.add_argument("--photos", help="工况照片关联JSON文件路径")
    run_parser.add_argument("--conversions", help="单位换算规则JSON文件路径")
    run_parser.add_argument("--supplement", help="补录数据JSON文件路径")
    run_parser.add_argument("--operator", default="system", help="操作人")

    check_parser = subparsers.add_parser("self-check", help="运行自检")
    check_parser.add_argument("--operator", default="self-check", help="操作人")

    export_parser = subparsers.add_parser("export", help="导出预警结果")
    export_parser.add_argument("--input-file", required=False, help="传感器数据JSON文件路径")
    export_parser.add_argument("--photos", help="工况照片关联JSON文件路径")
    export_parser.add_argument("--conversions", help="单位换算规则JSON文件路径")
    export_parser.add_argument("--format", choices=["json", "csv"], default="json", help="导出格式")
    export_parser.add_argument("--output", help="输出文件路径")
    export_parser.add_argument("--operator", default="system", help="操作人")

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
