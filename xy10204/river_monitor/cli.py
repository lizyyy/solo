"""CLI 主入口 - 河道水位巡测异常分析命令行工具"""

import argparse
import pandas as pd
import os
import logging
from datetime import datetime

from .config import (
    DEFAULT_DATA_DIR, DEFAULT_REPORT_DIR, DEFAULT_HISTORY_DIR,
    DEFAULT_TIME_FORMAT, DATA_COLUMNS
)
from .alignment import TimeSeriesAligner
from .missing import MissingDataMarker
from .anomaly import AnomalyDetector
from .history import HistoryManager
from .sample_data import SampleDataGenerator

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


def load_csv_data(filepath: str) -> pd.DataFrame:
    """加载CSV数据"""
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"文件不存在: {filepath}")
    df = pd.read_csv(filepath)
    logger.info(f"加载数据: {filepath} ({len(df)} 条记录)")
    return df


def cmd_generate_samples(args):
    """生成样例数据命令"""
    generator = SampleDataGenerator(args.data_dir)

    if args.type == "all":
        types = ["normal", "anomaly", "misaligned"]
    else:
        types = [args.type]

    for dtype in types:
        paths = generator.save_sample_data(dtype)
        print(f"✓ 已生成 {dtype} 类型样例数据:")
        for name, path in paths.items():
            print(f"    {name}: {path}")

    print("\n样例数据已保存到", args.data_dir)


def cmd_align(args):
    """多源数据对齐命令"""
    data_files = {}

    if args.water_level:
        data_files["water_level"] = load_csv_data(args.water_level)
    if args.rainfall:
        data_files["rainfall"] = load_csv_data(args.rainfall)
    if args.gate_opening:
        data_files["gate_opening"] = load_csv_data(args.gate_opening)

    if not data_files:
        print("错误: 请至少提供一个数据文件")
        return

    aligner = TimeSeriesAligner(sample_interval=args.interval)
    aligned = aligner.align_multisource(data_files, args.station_id)

    output_path = args.output
    if not output_path:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_path = f"aligned_data_{timestamp}.csv"

    aligned.to_csv(output_path, index=False)
    print(f"✓ 对齐完成，结果保存到: {output_path}")
    print(f"  总时间点数: {len(aligned)}")
    print(f"  时间范围: {aligned['timestamp'].min()} 至 {aligned['timestamp'].max()}")


def cmd_missing(args):
    """缺测标记命令"""
    df = load_csv_data(args.input)

    if "timestamp" not in df.columns:
        print("错误: 数据中缺少 timestamp 列")
        return

    df["timestamp"] = pd.to_datetime(df["timestamp"], format=DEFAULT_TIME_FORMAT)

    marker = MissingDataMarker()
    marked = marker.mark_missing(df)
    validated = marker.validate_values(marked)
    summary = marker.get_missing_summary(validated)

    report = marker.generate_report(validated)
    print(report)

    if args.output:
        validated.to_csv(args.output, index=False)
        print(f"\n✓ 带标记的数据已保存到: {args.output}")


def cmd_detect(args):
    """异常检测命令"""
    df = load_csv_data(args.input)

    if "timestamp" not in df.columns:
        print("错误: 数据中缺少 timestamp 列")
        return

    df["timestamp"] = pd.to_datetime(df["timestamp"], format=DEFAULT_TIME_FORMAT)

    detector = AnomalyDetector()
    anomalies = detector.detect_all(df)

    print(f"检测到 {anomalies['total_count']} 个异常")
    print("-" * 50)

    for anom_type, anom_list in [
        ("水位突涨", anomalies.get("water_level_spikes", [])),
        ("雨量突增", anomalies.get("rainfall_spikes", [])),
        ("闸门开度突变", anomalies.get("gate_opening_changes", []))
    ]:
        if anom_list:
            print(f"\n{anom_type} ({len(anom_list)} 条):")
            for i, anom in enumerate(anom_list, 1):
                if "rate_m_per_hour" in anom:
                    rate = anom["rate_m_per_hour"]
                else:
                    rate = anom.get("rate_mm_per_hour", 0)
                print(f"  [{i}] {anom['timestamp']} - 速率: {rate}")

    if anomalies.get("correlated_anomalies"):
        print(f"\n异常关联分析 ({len(anomalies['correlated_anomalies'])} 条):")
        for i, anom in enumerate(anomalies["correlated_anomalies"], 1):
            print(f"  [{i}] {anom['timestamp']} - {anom['possible_cause']}")


def cmd_history(args):
    """历史记录命令"""
    history_mgr = HistoryManager(args.history_dir)

    if args.action == "list":
        summary = history_mgr.get_history_summary(args.data_type)
        print(summary)

    elif args.action == "save":
        if not args.input:
            print("错误: 请指定输入文件")
            return
        if not args.data_type:
            print("错误: 请指定数据类型 (--data-type)")
            return

        df = load_csv_data(args.input)
        version_id = history_mgr.save_version(
            df, args.data_type, args.operation or "manual_save",
            args.comment or ""
        )
        print(f"✓ 已保存版本: {version_id}")

    elif args.action == "load":
        if not args.version_id:
            print("错误: 请指定版本ID")
            return
        df = history_mgr.load_version(args.version_id)

        output = args.output or f"version_{args.version_id}.csv"
        df.to_csv(output, index=False)
        print(f"✓ 已加载版本 {args.version_id} 到: {output}")

    elif args.action == "compare":
        if not (args.version_id and args.version_id2):
            print("错误: 请指定两个版本ID进行比较")
            return

        diff = history_mgr.compare_versions(
            args.version_id, args.version_id2, args.data_type or "all"
        )

        print(f"版本对比: {args.version_id} vs {args.version_id2}")
        print("-" * 50)
        print(f"新增记录: {diff['added_count']} 条")
        print(f"删除记录: {diff['removed_count']} 条")
        print(f"修改记录: {diff['modified_count']} 条")

        if diff["modified"]:
            print(f"\n详细修改:")
            for m in diff["modified"][:5]:
                print(f"  记录: {m['key']}")
                for col, change in m["changes"].items():
                    print(f"    {col}: {change['old']} -> {change['new']}")

            if len(diff["modified"]) > 5:
                print(f"  ... 还有 {len(diff['modified']) - 5} 条修改")


def cmd_report(args):
    """生成完整报告命令"""
    data_files = {}

    if args.water_level:
        data_files["water_level"] = load_csv_data(args.water_level)
    if args.rainfall:
        data_files["rainfall"] = load_csv_data(args.rainfall)
    if args.gate_opening:
        data_files["gate_opening"] = load_csv_data(args.gate_opening)

    if not data_files:
        print("错误: 请至少提供一个数据文件")
        return

    print("\n" + "=" * 60)
    print("开始分析流程...")
    print("=" * 60)

    print("\n[步骤1] 多源数据对齐...")
    aligner = TimeSeriesAligner(sample_interval=args.interval)
    aligned = aligner.align_multisource(data_files, args.station_id)
    print(f"  ✓ 完成，共 {len(aligned)} 个时间点")

    print("\n[步骤2] 缺测数据标记...")
    marker = MissingDataMarker()
    marked = marker.mark_missing(aligned)
    validated = marker.validate_values(marked)
    summary = marker.get_missing_summary(validated)
    print(f"  ✓ 完成")

    print("\n[步骤3] 异常检测...")
    detector = AnomalyDetector()
    anomalies = detector.detect_all(aligned)
    print(f"  ✓ 完成，检测到 {anomalies['total_count']} 个异常")

    print("\n[步骤4] 生成报告...")
    from .report import ReportGenerator
    reporter = ReportGenerator(args.report_dir)

    text_report = reporter.generate_text_report(
        aligned, summary, anomalies, args.station_id
    )
    text_path = reporter.save_text_report(text_report, args.station_id)
    print(f"  ✓ 文本报告: {text_path}")

    if args.chart:
        chart_path = reporter.generate_chart_report(
            aligned, anomalies, args.station_id
        )
        if chart_path:
            print(f"  ✓ 图表报告: {chart_path}")

    print("\n" + "=" * 60)
    print("分析完成！报告摘要:")
    print("=" * 60)
    print(text_report)


def cmd_demo(args):
    """演示命令"""
    print("\n" + "=" * 60)
    print("河道水位巡测异常分析 CLI - 演示模式")
    print("=" * 60)

    if args.mode == "normal":
        print("\n>>> 模式1: 正常数据演示（无异常）")
        data_type = "normal"
    else:
        print("\n>>> 模式2: 异常数据演示（触发异常）")
        data_type = "anomaly"

    generator = SampleDataGenerator(DEFAULT_DATA_DIR)
    paths = generator.save_sample_data(data_type)

    print(f"\n[演示步骤1] 生成样例数据: {data_type}")
    print(f"  水位数据: {paths['water_level']}")
    print(f"  雨量数据: {paths['rainfall']}")
    print(f"  闸门数据: {paths['gate_opening']}")

    aligner = TimeSeriesAligner()

    water_df = load_csv_data(paths["water_level"])
    rain_df = load_csv_data(paths["rainfall"])
    gate_df = load_csv_data(paths["gate_opening"])

    data_frames = {
        "water_level": water_df,
        "rainfall": rain_df,
        "gate_opening": gate_df
    }

    print("\n[演示步骤2] 多源数据对齐...")
    aligned = aligner.align_multisource(data_frames)
    print(f"  对齐完成: 共 {len(aligned)} 个时间点")

    print("\n[演示步骤3] 缺测标记和验证...")
    marker = MissingDataMarker()
    marked = marker.mark_missing(aligned)
    validated = marker.validate_values(marked)
    summary = marker.get_missing_summary(validated)
    print(f"  总记录数: {summary.get('total_records', 0)}")

    print("\n[演示步骤4] 异常检测...")
    detector = AnomalyDetector()
    anomalies = detector.detect_all(aligned)

    if anomalies["total_count"] > 0:
        print(f"  ⚠ 检测到 {anomalies['total_count']} 个异常:")
        for type_name, anom_list in [
            ("水位突涨", anomalies["water_level_spikes"]),
            ("雨量突增", anomalies["rainfall_spikes"]),
            ("闸门开度突变", anomalies["gate_opening_changes"])
        ]:
            if anom_list:
                print(f"    - {type_name}: {len(anom_list)} 条")
    else:
        print(f"  ✓ 未检测到异常")

    print("\n[演示步骤5] 生成报告...")
    from .report import ReportGenerator
    reporter = ReportGenerator(DEFAULT_REPORT_DIR)

    text_report = reporter.generate_text_report(
        aligned, summary, anomalies
    )
    text_path = reporter.save_text_report(text_report)
    print(f"  文本报告: {text_path}")

    if args.chart:
        chart_path = reporter.generate_chart_report(aligned, anomalies)
        if chart_path:
            print(f"  图表报告: {chart_path}")

    print("\n" + "=" * 60)
    print("演示完成！")
    print("=" * 60)

    if args.mode == "anomaly":
        print("\n触发的异常详情:")
        print("-" * 40)
        for anom in anomalies["water_level_spikes"]:
            print(f"  时间: {anom['timestamp']}")
            print(f"  变化: {anom['previous_level']}m -> {anom['current_level']}m")
            print(f"  速率: {anom['rate_m_per_hour']} m/h (阈值: {anom['threshold']} m/h)")


def main():
    parser = argparse.ArgumentParser(
        description="河道水位巡测异常分析 CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
使用示例:
  # 生成所有样例数据
  python -m river_monitor generate --type all

  # 正常数据演示（最短路径）
  python -m river_monitor demo --mode normal

  # 触发异常演示
  python -m river_monitor demo --mode anomaly --chart

  # 完整分析流程
  python -m river_monitor report \\
    --water-level data/water_level_normal.csv \\
    --rainfall data/rainfall_normal.csv \\
    --gate-opening data/gate_opening_normal.csv \\
    --chart

  # 查看历史记录
  python -m river_monitor history --action list
        """
    )

    subparsers = parser.add_subparsers(title="命令", dest="command",
                                     help="可用命令")

    gen_parser = subparsers.add_parser("generate", help="生成样例数据")
    gen_parser.add_argument("--type", choices=["normal", "anomaly", "misaligned", "all"],
                          default="normal", help="数据类型")
    gen_parser.add_argument("--data-dir", default=DEFAULT_DATA_DIR,
                          help="数据目录")
    gen_parser.set_defaults(func=cmd_generate_samples)

    align_parser = subparsers.add_parser("align", help="多源数据对齐")
    align_parser.add_argument("--water-level", help="水位数据CSV文件")
    align_parser.add_argument("--rainfall", help="雨量数据CSV文件")
    align_parser.add_argument("--gate-opening", help="闸门开度数据CSV文件")
    align_parser.add_argument("--station-id", help="站点ID")
    align_parser.add_argument("--interval", type=int, default=60,
                            help="采样间隔（分钟）")
    align_parser.add_argument("--output", "-o", help="输出文件")
    align_parser.set_defaults(func=cmd_align)

    missing_parser = subparsers.add_parser("missing", help="缺测标记")
    missing_parser.add_argument("--input", "-i", required=True, help="输入CSV文件")
    missing_parser.add_argument("--output", "-o", help="输出带标记的CSV文件")
    missing_parser.set_defaults(func=cmd_missing)

    detect_parser = subparsers.add_parser("detect", help="异常检测")
    detect_parser.add_argument("--input", "-i", required=True, help="输入CSV文件")
    detect_parser.set_defaults(func=cmd_detect)

    hist_parser = subparsers.add_parser("history", help="历史记录管理")
    hist_parser.add_argument("--action", choices=["list", "save", "load", "compare"],
                           required=True, help="操作类型")
    hist_parser.add_argument("--history-dir", default=DEFAULT_HISTORY_DIR,
                           help="历史记录目录")
    hist_parser.add_argument("--data-type", help="数据类型")
    hist_parser.add_argument("--input", "-i", help="输入文件（save时用）")
    hist_parser.add_argument("--output", "-o", help="输出文件（load时用）")
    hist_parser.add_argument("--version-id", help="版本ID")
    hist_parser.add_argument("--version-id2", help="第二个版本ID（compare时用）")
    hist_parser.add_argument("--operation", help="操作名称（save时用）")
    hist_parser.add_argument("--comment", help="注释（save时用）")
    hist_parser.set_defaults(func=cmd_history)

    report_parser = subparsers.add_parser("report", help="生成完整分析报告")
    report_parser.add_argument("--water-level", help="水位数据CSV文件")
    report_parser.add_argument("--rainfall", help="雨量数据CSV文件")
    report_parser.add_argument("--gate-opening", help="闸门开度数据CSV文件")
    report_parser.add_argument("--station-id", help="站点ID")
    report_parser.add_argument("--interval", type=int, default=60,
                             help="采样间隔（分钟）")
    report_parser.add_argument("--chart", action="store_true", help="生成图表报告")
    report_parser.add_argument("--report-dir", default=DEFAULT_REPORT_DIR,
                             help="报告目录")
    report_parser.set_defaults(func=cmd_report)

    demo_parser = subparsers.add_parser("demo", help="演示模式")
    demo_parser.add_argument("--mode", choices=["normal", "anomaly"],
                           default="normal", help="演示模式")
    demo_parser.add_argument("--chart", action="store_true", help="生成图表")
    demo_parser.set_defaults(func=cmd_demo)

    args = parser.parse_args()

    if not hasattr(args, "func"):
        parser.print_help()
        return

    args.func(args)


if __name__ == "__main__":
    main()
