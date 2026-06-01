#!/usr/bin/env python3
import argparse
import csv
import json
import os
import sys
from datetime import datetime

from .models import RoyaltyRecord
from .engine import RoyaltyEngine
from .field_map import FieldMapper
from .params import ParamStore
from .conflict import ConflictDetector
from .audit import AuditLogger
from .report import ReportGenerator


def load_csv(filepath: str, mapper: FieldMapper, source: str = ""):
    records = []
    all_warnings = []
    header_map = None
    with open(filepath, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        headers = reader.fieldnames or []
        header_map, unmapped = mapper.map_headers(headers)
        if unmapped:
            all_warnings.append(f"未映射的列: {', '.join(unmapped)}")

        for row in reader:
            record, warnings = mapper.row_to_record(row, source=source)
            records.append(record)
            all_warnings.extend(warnings)

    return records, all_warnings, header_map


def cmd_run(args):
    mapper = FieldMapper()
    param_store = ParamStore(work_dir=args.work_dir)
    audit_logger = AuditLogger()
    engine = RoyaltyEngine(param_store=param_store, audit_logger=audit_logger)
    detector = ConflictDetector(param_store=param_store)
    reporter = ReportGenerator(output_dir=args.output_dir)

    records, warnings, header_map = load_csv(args.input, mapper, source=args.input)

    if warnings:
        print("【导入警告】")
        for w in warnings:
            print(f"  {w}")
        print()

    for rec in records:
        if param_store.is_exception(rec.record_id):
            rec.is_exception = True
            rec.exception_note = param_store.get_exception_note(rec.record_id)

    conflicts = detector.detect_batch(records)

    if conflicts:
        print("【参数冲突】以下参数表与导入数据不一致，请确认：")
        for c in conflicts:
            print(f"  记录 {c.record_id} 字段 '{c.field_name}': 参数表={c.param_value} vs 导入={c.data_value}")
            print(f"    建议: {c.suggestion}")
        print()

    results = engine.calculate_batch(records)

    for rec in records:
        if rec.decay_factor is not None:
            param_store.set(rec.record_id, "decay_factor", rec.decay_factor)
        if rec.platform_share is not None:
            param_store.set(rec.record_id, "platform_share", rec.platform_share)
        if rec.rights_share is not None:
            param_store.set(rec.record_id, "rights_share", rec.rights_share)

    all_audit = audit_logger.get_entries()

    detail_path = reporter.generate_detail(results, conflicts, all_audit)
    summary_path = reporter.generate_summary(results)
    csv_path = reporter.generate_csv(results)
    conflict_path = reporter.generate_conflict_report(conflicts)

    print("【计算完成】")
    print(f"  处理记录: {len(results)} 条")
    print(f"  例外记录: {sum(1 for r in results if r.is_exception)} 条")
    print(f"  冲突记录: {len(conflicts)} 处")
    print()
    print("【报告文件】")
    print(f"  明细: {detail_path}")
    print(f"  汇总: {summary_path}")
    print(f"  CSV:  {csv_path}")
    print(f"  冲突: {conflict_path}")


def cmd_update_param(args):
    param_store = ParamStore(work_dir=args.work_dir)
    audit_logger = AuditLogger()

    old_val = param_store.get(args.record_id, args.field)
    param_store.set(args.record_id, args.field, float(args.value), manually_adjusted=True)
    audit_logger.log_param_update(
        args.record_id, args.field, old_val, float(args.value), manual=True
    )
    print(f"已更新: 记录 {args.record_id} 的 {args.field} = {args.value} (人工调整，后续运行不会被覆盖)")


def cmd_mark_exception(args):
    param_store = ParamStore(work_dir=args.work_dir)
    audit_logger = AuditLogger()

    param_store.mark_exception(args.record_id, note=args.note)
    audit_logger.log_exception(args.record_id, note=args.note)
    print(f"已标记: 记录 {args.record_id} 为例外 (备注: {args.note})")


def cmd_show_param(args):
    param_store = ParamStore(work_dir=args.work_dir)
    all_params = param_store.get_all(args.record_id)
    if not all_params:
        print(f"记录 {args.record_id} 无持久化参数")
        return

    print(f"记录 {args.record_id} 持久化参数:")
    for field, info in all_params.items():
        if isinstance(info, dict):
            manual_tag = " [人工调整]" if info.get("manually_adjusted") else ""
            print(f"  {field} = {info.get('value')}{manual_tag} (更新于: {info.get('updated_at', '未知')})")


def cmd_check_conflicts(args):
    mapper = FieldMapper()
    param_store = ParamStore(work_dir=args.work_dir)
    detector = ConflictDetector(param_store=param_store)
    reporter = ReportGenerator(output_dir=args.output_dir)

    records, warnings, _ = load_csv(args.input, mapper, source=args.input)
    conflicts = detector.detect_batch(records)

    if not conflicts:
        print("无冲突。参数表与导入数据一致。")
        return

    conflict_path = reporter.generate_conflict_report(conflicts)
    print(f"发现 {len(conflicts)} 处冲突，详情: {conflict_path}")
    for c in conflicts:
        print(f"  记录 {c.record_id} 字段 '{c.field_name}': 参数表={c.param_value} vs 导入={c.data_value}")


def main():
    parser = argparse.ArgumentParser(
        prog="music-royalty",
        description="音乐版权长尾收益计算工具 — 公式透明、单位明确、结果可追溯",
    )
    parser.add_argument("--work-dir", default=".", help="工作目录（存放持久化参数）")
    parser.add_argument("--output-dir", default="./output", help="报告输出目录")

    subparsers = parser.add_subparsers(dest="command", help="子命令")

    run_parser = subparsers.add_parser("run", help="运行计算")
    run_parser.add_argument("input", help="输入CSV文件路径")

    update_parser = subparsers.add_parser("update-param", help="人工更新参数（不会被默认值覆盖）")
    update_parser.add_argument("record_id", help="记录ID")
    update_parser.add_argument("field", help="字段名 (decay_factor/platform_share/rights_share)")
    update_parser.add_argument("value", help="新值")

    exception_parser = subparsers.add_parser("mark-exception", help="标记记录为例外")
    exception_parser.add_argument("record_id", help="记录ID")
    exception_parser.add_argument("--note", default="", help="例外备注")

    show_parser = subparsers.add_parser("show-param", help="查看持久化参数")
    show_parser.add_argument("record_id", help="记录ID")

    conflict_parser = subparsers.add_parser("check-conflicts", help="仅检查参数冲突")
    conflict_parser.add_argument("input", help="输入CSV文件路径")

    args = parser.parse_args()

    if args.command == "run":
        cmd_run(args)
    elif args.command == "update-param":
        cmd_update_param(args)
    elif args.command == "mark-exception":
        cmd_mark_exception(args)
    elif args.command == "show-param":
        cmd_show_param(args)
    elif args.command == "check-conflicts":
        cmd_check_conflicts(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
