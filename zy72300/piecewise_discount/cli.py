"""
CLI 入口 —— 命令行方式使用分段函数优惠核算工具

用法：
  python -m piecewise_discount.cli demo          跑演示数据
  python -m piecewise_discount.cli calculate      单笔核算
  python -m piecewise_discount.cli gaps           断档检查
  python -m piecewise_discount.cli versions       参数版本页
"""

from __future__ import annotations

import argparse
import json
import sys

from .models import Segment, PiecewiseFunction, ScoringWeightTable, WeightEntry, BoundaryNote
from .engine import CalculationEngine
from .demo_data import load_demo_data, print_demo


def cmd_demo(_args: argparse.Namespace) -> None:
    print_demo()


def cmd_calculate(args: argparse.Namespace) -> None:
    engine = _build_engine_from_args(args)
    record = engine.calculate(
        record_id=args.record_id,
        original_price=args.price,
        function_name=args.function,
        weight_table_name=args.weight_table,
        remark=args.remark or "",
    )
    print(record.summary_line())


def cmd_gaps(args: argparse.Namespace) -> None:
    engine = _build_engine_from_args(args)
    print(engine.format_gap_report())


def cmd_versions(args: argparse.Namespace) -> None:
    engine = _build_engine_from_args(args)
    print(engine.version_manager.format_version_page())


def _build_engine_from_args(args: argparse.Namespace) -> CalculationEngine:
    engine = CalculationEngine()

    if args.function_file:
        with open(args.function_file) as f:
            data = json.load(f)
        segs = [Segment(**s) for s in data["segments"]]
        func = PiecewiseFunction(name=data["name"], segments=segs)
        engine.import_function(func)

    if args.weight_file:
        with open(args.weight_file) as f:
            data = json.load(f)
        entries = [WeightEntry(**e) for e in data["entries"]]
        table = ScoringWeightTable(
            name=data["name"], entries=entries, version=data.get("version", 1)
        )
        engine.import_weight_table(table, remark=data.get("remark", ""))

    if args.boundary_file:
        with open(args.boundary_file) as f:
            data = json.load(f)
        notes = [BoundaryNote(**n) for n in data]
        engine.import_boundary_notes(notes)

    return engine


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="piecewise_discount",
        description="分段函数优惠核算工具",
    )
    sub = parser.add_subparsers(dest="command")

    # demo
    sub.add_parser("demo", help="跑演示数据，看三种处理结果")

    # calculate
    calc = sub.add_parser("calculate", help="单笔核算")
    calc.add_argument("--record-id", required=True)
    calc.add_argument("--price", type=float, required=True)
    calc.add_argument("--function", required=True)
    calc.add_argument("--weight-table", required=True)
    calc.add_argument("--remark", default="")
    calc.add_argument("--function-file", default="")
    calc.add_argument("--weight-file", default="")
    calc.add_argument("--boundary-file", default="")

    # gaps
    gaps = sub.add_parser("gaps", help="断档检查")
    gaps.add_argument("--function-file", required=True)

    # versions
    vers = sub.add_parser("versions", help="参数版本页")
    vers.add_argument("--weight-file", required=True)

    args = parser.parse_args()

    if args.command == "demo":
        cmd_demo(args)
    elif args.command == "calculate":
        cmd_calculate(args)
    elif args.command == "gaps":
        cmd_gaps(args)
    elif args.command == "versions":
        cmd_versions(args)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
