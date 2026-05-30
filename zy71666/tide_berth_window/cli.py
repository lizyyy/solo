"""命令行接口 (CLI)。

提供完整的命令行工具，支持：
- 数据导入（潮位、风速、船舶、泊位、调度备注）
- 单条/批量靠泊窗口计算
- 窗口筛选和导出
- 报告生成
- 版本管理
"""

from __future__ import annotations

import argparse
import sys
from datetime import datetime, timedelta
from typing import List, Optional

import pytz

from .calculator import SafetyCalculator, SafetyThreshold
from .data_importer import DataImporter
from .exceptions import TideBerthException
from .models import Ship, Berth
from .window_manager import WindowFilter, WindowManager


def create_parser() -> argparse.ArgumentParser:
    """创建命令行参数解析器。"""
    parser = argparse.ArgumentParser(
        prog="tide-berth",
        description="潮汐码头靠泊窗口分析工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 导入数据并计算靠泊窗口
  tide-berth calculate --tide tide.csv --wind wind.csv --ship ship.csv --berth berth.csv \\
    --start 2025-06-01 --end 2025-06-07 --output report.txt

  # 批量处理多船多泊位
  tide-berth batch --jobs jobs.json --output timeline.csv

  # 查看数据导入报告
  tide-berth import-report --tide tide.csv --wind wind.csv

  # 列出数据版本
  tide-berth list-versions --tide tide.csv --tide tide_v2.csv
        """,
    )

    subparsers = parser.add_subparsers(dest="command", required=True)

    # ========== calculate 命令 ==========
    calc_parser = subparsers.add_parser(
        "calculate",
        help="计算单条靠泊窗口",
        description="为单艘船舶在单个泊位计算靠泊窗口",
    )
    _add_import_args(calc_parser)
    _add_time_range_args(calc_parser)
    _add_threshold_args(calc_parser)
    _add_filter_args(calc_parser)
    calc_parser.add_argument("--ship-index", type=int, default=0, help="使用第N条船舶数据（从0开始）")
    calc_parser.add_argument("--berth-index", type=int, default=0, help="使用第N个泊位数据（从0开始）")
    calc_parser.add_argument("--check-point", type=str, help="检查指定时间点的安全性 (格式: YYYY-MM-DD HH:MM)")
    calc_parser.add_argument("--output", type=str, help="输出报告文件路径")
    calc_parser.add_argument("--export-timeline", type=str, help="导出时间轴JSON文件路径")
    calc_parser.add_argument("--export-csv", type=str, help="导出时间轴CSV文件路径")

    # ========== batch 命令 ==========
    batch_parser = subparsers.add_parser(
        "batch",
        help="批量计算靠泊窗口",
        description="批量处理多船多泊位的靠泊窗口计算",
    )
    _add_import_args(batch_parser)
    _add_time_range_args(batch_parser)
    _add_threshold_args(batch_parser)
    _add_filter_args(batch_parser)
    batch_parser.add_argument("--jobs", type=str, help="批量作业配置JSON文件路径")
    batch_parser.add_argument("--all-combinations", action="store_true", help="计算所有船舶x泊位组合")
    batch_parser.add_argument("--output", type=str, help="输出报告文件路径")
    batch_parser.add_argument("--export-timeline", type=str, help="导出时间轴JSON文件路径")
    batch_parser.add_argument("--export-csv", type=str, help="导出时间轴CSV文件路径")

    # ========== import-report 命令 ==========
    import_parser = subparsers.add_parser(
        "import-report",
        help="生成数据导入报告",
        description="检查数据导入情况，列出错误和冲突",
    )
    _add_import_args(import_parser)
    import_parser.add_argument("--output", type=str, help="输出报告文件路径")

    # ========== list-versions 命令 ==========
    version_parser = subparsers.add_parser(
        "list-versions",
        help="列出所有数据版本",
        description="查看已导入的数据版本信息",
    )
    _add_import_args(version_parser)

    # ========== check-point 命令 ==========
    check_parser = subparsers.add_parser(
        "check-point",
        help="检查指定时间点的安全性",
        description="详细检查单个时间点的所有安全校验项",
    )
    _add_import_args(check_parser)
    _add_threshold_args(check_parser)
    check_parser.add_argument("--time", type=str, required=True, help="检查时间 (格式: YYYY-MM-DD HH:MM)")
    check_parser.add_argument("--ship-index", type=int, default=0, help="使用第N条船舶数据")
    check_parser.add_argument("--berth-index", type=int, default=0, help="使用第N个泊位数据")

    return parser


def _add_import_args(parser: argparse.ArgumentParser) -> None:
    """添加数据导入相关参数。"""
    parser.add_argument("--tide", action="append", default=[], help="潮位数据文件（可多次指定，多版本保留）")
    parser.add_argument("--wind", action="append", default=[], help="风速数据文件（可多次指定）")
    parser.add_argument("--ship", action="append", default=[], help="船舶数据文件（可多次指定）")
    parser.add_argument("--berth", action="append", default=[], help="泊位数据文件（可多次指定）")
    parser.add_argument("--notes", action="append", default=[], help="调度备注文件（可多次指定）")
    parser.add_argument("--timezone", type=str, default="Asia/Shanghai", help="默认时区（默认: Asia/Shanghai）")


def _add_time_range_args(parser: argparse.ArgumentParser) -> None:
    """添加时间范围参数。"""
    parser.add_argument("--start", type=str, required=True, help="搜索起始时间 (格式: YYYY-MM-DD 或 YYYY-MM-DD HH:MM)")
    parser.add_argument("--end", type=str, required=True, help="搜索结束时间 (格式: YYYY-MM-DD 或 YYYY-MM-DD HH:MM)")


def _add_threshold_args(parser: argparse.ArgumentParser) -> None:
    """添加安全阈值参数。"""
    parser.add_argument("--ukc", type=float, help="龙骨下富余水深（米）")
    parser.add_argument("--wind-limit", type=float, help="风速限制（米/秒）")
    parser.add_argument("--poor-maneuver-wind-limit", type=float, help="操纵性差船舶的风速限制")
    parser.add_argument("--min-window", type=int, help="最小窗口时长（分钟）")
    parser.add_argument("--time-step", type=int, help="计算时间步长（分钟）")
    parser.add_argument("--no-uncertainty-buffer", action="store_true", help="不使用潮位不确定度作为安全缓冲")
    parser.add_argument("--no-gust-check", action="store_true", help="不使用阵风进行风速校验")
    parser.add_argument("--no-channel-check", action="store_true", help="不检查航道水深")


def _add_filter_args(parser: argparse.ArgumentParser) -> None:
    """添加筛选参数。"""
    parser.add_argument("--filter-ship", type=str, help="按船舶IMO或名称筛选")
    parser.add_argument("--filter-berth", type=str, help="按泊位ID筛选")
    parser.add_argument("--filter-min-duration", type=int, help="最小窗口时长（分钟）")
    parser.add_argument("--filter-min-depth", type=float, help="最小水深余量（米）")
    parser.add_argument("--filter-max-wind", type=float, help="最大允许风速（米/秒）")
    parser.add_argument("--filter-min-confidence", type=float, help="最小置信度 (0-1)")
    parser.add_argument("--filter-exclude-conflicts", action="store_true", help="排除有冲突的窗口")
    parser.add_argument("--sort-by", type=str, default="start_time",
                        choices=["start_time", "end_time", "duration", "depth_margin", "wind_speed", "confidence"],
                        help="排序方式")
    parser.add_argument("--sort-reverse", action="store_true", help="降序排序")


def _parse_time(time_str: str, timezone: str) -> datetime:
    """解析时间字符串。"""
    from dateutil import parser as date_parser
    tz = pytz.timezone(timezone)

    try:
        dt = date_parser.parse(time_str)
        if dt.tzinfo is None:
            dt = tz.localize(dt)
        return dt
    except Exception as e:
        raise TideBerthException(
            f"无法解析时间字符串: '{time_str}'",
            details={"format_hint": "YYYY-MM-DD 或 YYYY-MM-DD HH:MM"},
        ) from e


def _import_data(args: argparse.Namespace) -> DataImporter:
    """导入所有数据文件。"""
    importer = DataImporter(default_timezone=args.timezone)

    for tide_file in args.tide:
        try:
            importer.import_tide_data(tide_file)
        except TideBerthException as e:
            print(f"⚠️  导入潮位文件 {tide_file} 时出错: {e}")

    for wind_file in args.wind:
        try:
            importer.import_wind_data(wind_file)
        except TideBerthException as e:
            print(f"⚠️  导入风速文件 {wind_file} 时出错: {e}")

    for ship_file in args.ship:
        try:
            importer.import_ship_data(ship_file)
        except TideBerthException as e:
            print(f"⚠️  导入船舶文件 {ship_file} 时出错: {e}")

    for berth_file in args.berth:
        try:
            importer.import_berth_data(berth_file)
        except TideBerthException as e:
            print(f"⚠️  导入泊位文件 {berth_file} 时出错: {e}")

    for notes_file in args.notes:
        try:
            importer.import_note_data(notes_file)
        except TideBerthException as e:
            print(f"⚠️  导入备注文件 {notes_file} 时出错: {e}")

    return importer


def _build_threshold(args: argparse.Namespace) -> SafetyThreshold:
    """根据参数构建安全阈值。"""
    threshold = SafetyThreshold()

    if args.ukc is not None:
        threshold.under_keel_margin = args.ukc
    if args.wind_limit is not None:
        threshold.wind_limit_default = args.wind_limit
    if args.poor_maneuver_wind_limit is not None:
        threshold.wind_limit_for_poor_maneuver = args.poor_maneuver_wind_limit
    if args.min_window is not None:
        threshold.min_window_minutes = args.min_window
    if args.time_step is not None:
        threshold.time_step_minutes = args.time_step
    if args.no_uncertainty_buffer:
        threshold.use_uncertainty_buffer = False
    if args.no_gust_check:
        threshold.use_gust_for_wind_check = False
    if args.no_channel_check:
        threshold.channel_depth_check = False

    return threshold


def _build_filter(args: argparse.Namespace, timezone: str) -> WindowFilter:
    """根据参数构建筛选器。"""
    f = WindowFilter()

    if hasattr(args, "filter_ship") and args.filter_ship:
        if args.filter_ship.isdigit() and len(args.filter_ship) == 7:
            f.ship_imo = args.filter_ship
        else:
            f.ship_name = args.filter_ship
    if hasattr(args, "filter_berth") and args.filter_berth:
        f.berth_id = args.filter_berth
    if hasattr(args, "filter_min_duration") and args.filter_min_duration:
        f.min_duration_minutes = args.filter_min_duration
    if hasattr(args, "filter_min_depth") and args.filter_min_depth:
        f.min_depth_margin = args.filter_min_depth
    if hasattr(args, "filter_max_wind") and args.filter_max_wind:
        f.max_wind_speed = args.filter_max_wind
    if hasattr(args, "filter_min_confidence") and args.filter_min_confidence:
        f.min_confidence = args.filter_min_confidence
    if hasattr(args, "filter_exclude_conflicts") and args.filter_exclude_conflicts:
        f.exclude_conflicts = True

    return f


def cmd_calculate(args: argparse.Namespace) -> int:
    """执行 calculate 命令。"""
    importer = _import_data(args)
    threshold = _build_threshold(args)
    filter_obj = _build_filter(args, args.timezone)
    calculator = SafetyCalculator(threshold)
    manager = WindowManager(calculator)

    # 获取潮位曲线和风速预报
    tide_curve = importer._build_tide_curve()
    wind_forecast = importer._build_wind_forecast()
    notes = importer.get_active_notes()
    ships = importer.get_active_ships()
    berths = importer.get_active_berths()

    if not tide_curve.readings:
        print("❌ 没有有效的潮位数据")
        return 1
    if not wind_forecast.readings:
        print("❌ 没有有效的风速数据")
        return 1
    if not ships:
        print("❌ 没有有效的船舶数据")
        return 1
    if not berths:
        print("❌ 没有有效的泊位数据")
        return 1

    if args.ship_index >= len(ships):
        print(f"❌ 船舶索引 {args.ship_index} 超出范围，共 {len(ships)} 条船舶数据")
        return 1
    if args.berth_index >= len(berths):
        print(f"❌ 泊位索引 {args.berth_index} 超出范围，共 {len(berths)} 个泊位数据")
        return 1

    ship = ships[args.ship_index]
    berth = berths[args.berth_index]

    start_time = _parse_time(args.start, args.timezone)
    end_time = _parse_time(args.end, args.timezone)

    # 检查单个时间点
    if args.check_point:
        check_time = _parse_time(args.check_point, args.timezone)
        result = calculator.check_point(check_time, ship, berth, tide_curve, wind_forecast, notes)
        print(result.explain())
        return 0

    # 查找窗口
    print(f"正在计算靠泊窗口...")
    print(f"船舶: {ship.name} (IMO: {ship.imo}, 吃水: {ship.draft}m)")
    print(f"泊位: {berth.name} ({berth.berth_id}, 设计水深: {berth.design_depth}m)")
    print(f"时间范围: {start_time.strftime('%Y-%m-%d %H:%M')} ~ {end_time.strftime('%Y-%m-%d %H:%M')}")
    print()

    windows = calculator.find_windows(start_time, end_time, ship, berth, tide_curve, wind_forecast, notes)

    # 筛选和排序
    windows = [w for w in windows if filter_obj.matches(w)]
    sort_key = getattr(args, "sort_by", "start_time")
    sort_reverse = getattr(args, "sort_reverse", False)
    windows = manager.sort(windows, key=sort_key, reverse=sort_reverse)

    manager.add_windows(windows)

    # 输出报告
    report = manager.generate_report()
    print(report)

    if args.output:
        manager.save_report(args.output)
        print(f"\n✅ 报告已保存到: {args.output}")

    if args.export_timeline:
        manager.export_timeline_json(filepath=args.export_timeline)
        print(f"✅ 时间轴JSON已保存到: {args.export_timeline}")

    if args.export_csv:
        manager.export_timeline_csv(filepath=args.export_csv)
        print(f"✅ 时间轴CSV已保存到: {args.export_csv}")

    # 导入报告
    if importer.import_errors or importer.data_conflicts:
        print("\n" + importer.get_import_report())

    return 0


def cmd_batch(args: argparse.Namespace) -> int:
    """执行 batch 命令。"""
    importer = _import_data(args)
    threshold = _build_threshold(args)
    filter_obj = _build_filter(args, args.timezone)
    calculator = SafetyCalculator(threshold)
    manager = WindowManager(calculator)

    tide_curve = importer._build_tide_curve()
    wind_forecast = importer._build_wind_forecast()
    notes = importer.get_active_notes()
    ships = importer.get_active_ships()
    berths = importer.get_active_berths()

    if not tide_curve.readings:
        print("❌ 没有有效的潮位数据")
        return 1
    if not wind_forecast.readings:
        print("❌ 没有有效的风速数据")
        return 1
    if not ships:
        print("❌ 没有有效的船舶数据")
        return 1
    if not berths:
        print("❌ 没有有效的泊位数据")
        return 1

    start_time = _parse_time(args.start, args.timezone)
    end_time = _parse_time(args.end, args.timezone)

    jobs = []

    if args.all_combinations:
        # 计算所有船舶x泊位组合
        for ship in ships:
            for berth in berths:
                jobs.append({
                    "start_time": start_time,
                    "end_time": end_time,
                    "ship": ship,
                    "berth": berth,
                    "tide_curve": tide_curve,
                    "wind_forecast": wind_forecast,
                    "notes": notes,
                })
        print(f"批量处理: {len(ships)} 艘船舶 x {len(berths)} 个泊位 = {len(jobs)} 个组合")
    elif args.jobs:
        # 从JSON文件读取作业配置
        import json
        with open(args.jobs, "r", encoding="utf-8") as f:
            job_configs = json.load(f)

        for cfg in job_configs:
            ship = next((s for s in ships if s.imo == cfg.get("ship_imo") or s.name == cfg.get("ship_name")), None)
            berth = next((b for b in berths if b.berth_id == cfg.get("berth_id")), None)

            if not ship:
                print(f"⚠️  未找到船舶: imo={cfg.get('ship_imo')}, name={cfg.get('ship_name')}")
                continue
            if not berth:
                print(f"⚠️  未找到泊位: {cfg.get('berth_id')}")
                continue

            job_start = _parse_time(cfg.get("start") or args.start, args.timezone)
            job_end = _parse_time(cfg.get("end") or args.end, args.timezone)

            jobs.append({
                "start_time": job_start,
                "end_time": job_end,
                "ship": ship,
                "berth": berth,
                "tide_curve": tide_curve,
                "wind_forecast": wind_forecast,
                "notes": notes,
            })
        print(f"批量处理: {len(jobs)} 个作业")
    else:
        print("❌ 必须指定 --all-combinations 或 --jobs 参数")
        return 1

    print(f"时间范围: {start_time.strftime('%Y-%m-%d %H:%M')} ~ {end_time.strftime('%Y-%m-%d %H:%M')}")
    print()

    sort_key = getattr(args, "sort_by", "start_time")
    windows = manager.batch_process(jobs, filter_obj=filter_obj, sort_key=sort_key)

    # 输出报告
    report = manager.generate_report()
    print(report)

    if args.output:
        manager.save_report(args.output)
        print(f"\n✅ 报告已保存到: {args.output}")

    if args.export_timeline:
        manager.export_timeline_json(filepath=args.export_timeline)
        print(f"✅ 时间轴JSON已保存到: {args.export_timeline}")

    if args.export_csv:
        manager.export_timeline_csv(filepath=args.export_csv)
        print(f"✅ 时间轴CSV已保存到: {args.export_csv}")

    # 导入报告
    if importer.import_errors or importer.data_conflicts:
        print("\n" + importer.get_import_report())

    return 0


def cmd_import_report(args: argparse.Namespace) -> int:
    """执行 import-report 命令。"""
    importer = _import_data(args)
    report = importer.get_import_report()
    print(report)

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(report)
        print(f"\n✅ 报告已保存到: {args.output}")

    return 0


def cmd_list_versions(args: argparse.Namespace) -> int:
    """执行 list-versions 命令。"""
    importer = _import_data(args)
    versions = importer.list_versions()

    print(f"{'版本ID':<30} {'类型':<8} {'状态':<6} {'导入时间':<20} {'文件'}")
    print("-" * 100)

    for v in versions:
        status = "✅ 活跃" if v["is_active"] else "⭕ 停用"
        print(f"{v['version_id']:<30} {v['data_type']:<8} {status:<6} "
              f"{v['imported_at'][:19]:<20} {v['source_file']}")

    return 0


def cmd_check_point(args: argparse.Namespace) -> int:
    """执行 check-point 命令。"""
    importer = _import_data(args)
    threshold = _build_threshold(args)
    calculator = SafetyCalculator(threshold)

    tide_curve = importer._build_tide_curve()
    wind_forecast = importer._build_wind_forecast()
    notes = importer.get_active_notes()
    ships = importer.get_active_ships()
    berths = importer.get_active_berths()

    if not tide_curve.readings:
        print("❌ 没有有效的潮位数据")
        return 1
    if not wind_forecast.readings:
        print("❌ 没有有效的风速数据")
        return 1
    if not ships:
        print("❌ 没有有效的船舶数据")
        return 1
    if not berths:
        print("❌ 没有有效的泊位数据")
        return 1

    ship = ships[args.ship_index]
    berth = berths[args.berth_index]
    check_time = _parse_time(args.time, args.timezone)

    result = calculator.check_point(check_time, ship, berth, tide_curve, wind_forecast, notes)
    print(result.explain())

    return 0


def main(argv: Optional[List[str]] = None) -> int:
    """主入口函数。"""
    parser = create_parser()
    args = parser.parse_args(argv)

    try:
        if args.command == "calculate":
            return cmd_calculate(args)
        elif args.command == "batch":
            return cmd_batch(args)
        elif args.command == "import-report":
            return cmd_import_report(args)
        elif args.command == "list-versions":
            return cmd_list_versions(args)
        elif args.command == "check-point":
            return cmd_check_point(args)
        else:
            parser.print_help()
            return 1
    except TideBerthException as e:
        print(f"\n❌ 错误: {e}")
        return 1
    except KeyboardInterrupt:
        print("\n⏹️  用户中断")
        return 130
    except Exception as e:
        print(f"\n❌ 未预期的错误: {type(e).__name__}: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
