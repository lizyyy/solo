from __future__ import annotations

import argparse
import json
import os
import sys
from typing import List, Optional

from .models import ScheduleInput
from .reporter import (
    export_reports,
    format_detail_text,
    format_summary_text,
    generate_detail,
    generate_summary,
)
from .solver import IPSolver
from .store import Store


def _default_output_dir() -> str:
    return os.path.join(os.getcwd(), "output")


def _default_db_path() -> str:
    d = os.path.join(os.getcwd(), ".scheduler")
    os.makedirs(d, exist_ok=True)
    return os.path.join(d, "scheduler.db")


def cmd_solve(args: argparse.Namespace) -> int:
    data = ScheduleInput.load(args.data)
    errors = data.validate()
    if errors:
        print("输入数据校验失败:", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        return 1
    solver = IPSolver(data)
    result = solver.solve(time_limit=args.time_limit)
    store = Store(_default_db_path())
    store.save(data, result)
    summary = generate_summary(data, result)
    print(format_summary_text(summary))
    if result.feasible:
        detail = generate_detail(data, result)
        print()
        print(format_detail_text(detail))
    output_dir = args.output or _default_output_dir()
    fmts = ["json", "csv", "text"]
    exported = export_reports(data, result, output_dir, formats=fmts)
    print()
    print(f"报告已导出到: {output_dir}")
    for p in exported:
        print(f"  {os.path.basename(p)}")
    return 0


def cmd_history(args: argparse.Namespace) -> int:
    store = Store(_default_db_path())
    runs = store.list_runs(limit=args.limit)
    if not runs:
        print("暂无历史记录")
        return 0
    print(f"{'运行ID':<20} {'时间':<22} {'可行':<6} {'目标值':<12} {'状态'}")
    print("-" * 75)
    for r in runs:
        feasible = "是" if r["feasible"] else "否"
        obj = str(r["objective_value"]) if r["objective_value"] is not None else "-"
        print(
            f"{r['run_id']:<20} {r['timestamp']:<22} "
            f"{feasible:<6} {obj:<12} {r['solver_status']}"
        )
    return 0


def cmd_report(args: argparse.Namespace) -> int:
    store = Store(_default_db_path())
    loaded = store.load(args.run_id)
    if loaded is None:
        print(f"运行 {args.run_id} 不存在", file=sys.stderr)
        return 1
    data, result = loaded
    fmt = args.format or "text"
    if fmt == "text":
        summary = generate_summary(data, result)
        detail = generate_detail(data, result)
        print(format_summary_text(summary))
        print()
        print(format_detail_text(detail))
    elif fmt == "json":
        summary = generate_summary(data, result)
        detail = generate_detail(data, result)
        print(json.dumps({"summary": summary, "detail": detail}, ensure_ascii=False, indent=2))
    elif fmt == "csv":
        output_dir = args.output or _default_output_dir()
        exported = export_reports(data, result, output_dir, formats=["csv"])
        print(f"CSV 已导出:")
        for p in exported:
            print(f"  {p}")
    else:
        print(f"不支持格式: {fmt}", file=sys.stderr)
        return 1
    return 0


def cmd_validate(args: argparse.Namespace) -> int:
    data = ScheduleInput.load(args.data)
    errors = data.validate()
    if errors:
        print("数据校验发现问题:")
        for e in errors:
            print(f"  [错误] {e}")
        return 1
    print("数据校验通过")
    for o in data.orders:
        avail = data.available_shifts_for_order(o)
        if not avail:
            print(f"  [警告] 订单 {o.id} 无可用班次")
        else:
            print(f"  订单 {o.id}: {len(avail)} 个可用班次")
    return 0


def cmd_verify(args: argparse.Namespace) -> int:
    store = Store(_default_db_path())
    result = store.verify_integrity(args.run_id)
    if "error" in result:
        print(result["error"], file=sys.stderr)
        return 1
    print(f"运行ID:       {result['run_id']}")
    print(f"输入哈希匹配: {'是' if result['input_hash_match'] else '否'}")
    print(f"存储哈希:     {result['stored_input_hash']}")
    print(f"计算哈希:     {result['computed_input_hash']}")
    print(f"校验时间:     {result['timestamp']}")
    return 0 if result["input_hash_match"] else 1


def cmd_supplement(args: argparse.Namespace) -> int:
    extra = ScheduleInput.load(args.data)
    store = Store(_default_db_path())
    result = store.supplement_and_resolve(
        args.run_id, extra, time_limit=args.time_limit
    )
    if result is None:
        print(f"运行 {args.run_id} 不存在", file=sys.stderr)
        return 1
    loaded = store.load(result.run_id)
    if loaded is None:
        print("内部错误: 保存后无法加载", file=sys.stderr)
        return 1
    data, result = loaded
    summary = generate_summary(data, result)
    print(format_summary_text(summary))
    output_dir = args.output or _default_output_dir()
    exported = export_reports(data, result, output_dir, formats=["json", "csv", "text"])
    print()
    print(f"补充数据后重新排产完成, 报告已导出:")
    for p in exported:
        print(f"  {os.path.basename(p)}")
    return 0


def cmd_delete(args: argparse.Namespace) -> int:
    store = Store(_default_db_path())
    ok = store.delete_run(args.run_id)
    if ok:
        print(f"已删除运行 {args.run_id}")
        return 0
    else:
        print(f"运行 {args.run_id} 不存在", file=sys.stderr)
        return 1


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="scheduler",
        description="排产整数规划器 - 基于整数规划的小工厂排产优化工具",
    )
    sub = parser.add_subparsers(dest="command", help="可用命令")

    p_solve = sub.add_parser("solve", help="执行排产求解")
    p_solve.add_argument("--data", required=True, help="输入数据 JSON 文件路径")
    p_solve.add_argument("--output", help="报告输出目录 (默认: ./output)")
    p_solve.add_argument("--time-limit", type=int, default=300, help="求解时间限制(秒)")

    p_history = sub.add_parser("history", help="查看历史记录")
    p_history.add_argument("--limit", type=int, default=20, help="显示条数")

    p_report = sub.add_parser("report", help="导出/查看历史排产报告")
    p_report.add_argument("run_id", help="运行ID")
    p_report.add_argument("--format", choices=["text", "json", "csv"], default="text")
    p_report.add_argument("--output", help="CSV 输出目录")

    p_validate = sub.add_parser("validate", help="仅校验输入数据")
    p_validate.add_argument("--data", required=True, help="输入数据 JSON 文件路径")

    p_verify = sub.add_parser("verify", help="校验历史数据完整性")
    p_verify.add_argument("run_id", help="运行ID")

    p_supplement = sub.add_parser("supplement", help="补充数据并重新求解")
    p_supplement.add_argument("run_id", help="基于哪个运行ID补充")
    p_supplement.add_argument("--data", required=True, help="补充数据 JSON 文件路径")
    p_supplement.add_argument("--output", help="报告输出目录")
    p_supplement.add_argument("--time-limit", type=int, default=300)

    p_delete = sub.add_parser("delete", help="删除历史记录")
    p_delete.add_argument("run_id", help="运行ID")

    return parser


def main(argv: Optional[List[str]] = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if args.command is None:
        parser.print_help()
        return 0
    dispatch = {
        "solve": cmd_solve,
        "history": cmd_history,
        "report": cmd_report,
        "validate": cmd_validate,
        "verify": cmd_verify,
        "supplement": cmd_supplement,
        "delete": cmd_delete,
    }
    handler = dispatch.get(args.command)
    if handler is None:
        parser.print_help()
        return 1
    return handler(args)
