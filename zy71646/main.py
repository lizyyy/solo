"""
游戏掉落概率校准系统 - 主入口
"""
import argparse
import os
import sys
from datetime import datetime

from drop_calibration import (
    DataSourceType,
    CalibrationParams,
    BatchProcessor,
    BatchFile,
    ExportConfig,
    scan_directory,
)


def parse_args():
    parser = argparse.ArgumentParser(
        description="游戏掉落概率校准系统 - 比较配置概率与真实掉落是否偏离",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例用法:
  # 1. 生成示例数据
  python main.py generate

  # 2. 运行完整校准流程
  python main.py run --config examples/sample_data/drop_config.csv \
                     --logs examples/sample_data/player_logs.csv \
                     --item-pool examples/sample_data/item_pool.csv \
                     --activity examples/sample_data/activity_period.csv \
                     --complaint examples/sample_data/complaint_records.csv \
                     --start 2026-05-01 --end 2026-05-20

  # 3. 扫描目录自动发现文件并运行
  python main.py scan --dir examples/sample_data

  # 4. 使用示例数据运行测试
  python main.py test
        """,
    )

    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    sp_generate = subparsers.add_parser("generate", help="生成示例测试数据")

    sp_run = subparsers.add_parser("run", help="运行校准流程")
    sp_run.add_argument("--config", action="append", default=[], help="掉落配置文件路径 (可多次指定)")
    sp_run.add_argument("--logs", action="append", default=[], help="玩家日志文件路径 (可多次指定)")
    sp_run.add_argument("--item-pool", action="append", default=[], help="道具池文件路径 (可多次指定)")
    sp_run.add_argument("--activity", action="append", default=[], help="活动时段文件路径 (可多次指定)")
    sp_run.add_argument("--complaint", action="append", default=[], help="投诉记录文件路径 (可多次指定)")
    sp_run.add_argument("--start", required=True, help="开始时间 (YYYY-MM-DD 或 YYYY-MM-DD HH:MM:SS)")
    sp_run.add_argument("--end", required=True, help="结束时间 (YYYY-MM-DD 或 YYYY-MM-DD HH:MM:SS)")
    sp_run.add_argument("--output-dir", default="./reports", help="输出目录 (默认: ./reports)")
    sp_run.add_argument("--report-name", default="drop_calibration", help="报告名称 (默认: drop_calibration)")
    sp_run.add_argument("--formats", default="xlsx,json,html", help="导出格式 (默认: xlsx,json,html)")
    sp_run.add_argument("--confidence", type=float, default=0.95, help="置信水平 (默认: 0.95)")
    sp_run.add_argument("--significance", type=float, default=0.05, help="显著性水平 (默认: 0.05)")
    sp_run.add_argument("--no-deduplicate", action="store_true", help="禁用去重")
    sp_run.add_argument("--no-activity", action="store_true", help="禁用活动加成")
    sp_run.add_argument("--no-normalize", action="store_true", help="禁用概率归一化")
    sp_run.add_argument("--fail-fast", action="store_true", help="遇到错误立即停止")
    sp_run.add_argument("--group-by", default="pool_id", help="分组字段 (默认: pool_id)")
    sp_run.add_argument("--notes", default="", help="校准说明")

    sp_scan = subparsers.add_parser("scan", help="扫描目录自动发现文件并运行校准")
    sp_scan.add_argument("--dir", required=True, help="数据目录")
    sp_scan.add_argument("--start", required=True, help="开始时间")
    sp_scan.add_argument("--end", required=True, help="结束时间")
    sp_scan.add_argument("--output-dir", default="./reports", help="输出目录")
    sp_scan.add_argument("--report-name", default="drop_calibration", help="报告名称")

    sp_test = subparsers.add_parser("test", help="运行完整测试流程")

    return parser.parse_args()


def parse_datetime_str(s: str) -> datetime:
    formats = [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y-%m-%d",
        "%Y/%m/%d %H:%M:%S",
        "%Y/%m/%d",
    ]
    for fmt in formats:
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    raise ValueError(f"无法解析日期时间: {s}")


def cmd_generate(args):
    print("生成示例测试数据...")
    from examples.generate_sample_data import generate_all
    generate_all()
    return True


def build_batch_files(args) -> list:
    batch_files = []

    source_type_map = {
        "config": DataSourceType.DROP_CONFIG,
        "logs": DataSourceType.PLAYER_LOG,
        "item_pool": DataSourceType.ITEM_POOL,
        "activity": DataSourceType.ACTIVITY_PERIOD,
        "complaint": DataSourceType.COMPLAINT_RECORD,
    }

    for attr, source_type in source_type_map.items():
        paths = getattr(args, attr, []) or []
        for i, path in enumerate(paths):
            if not os.path.exists(path):
                print(f"⚠️  文件不存在: {path}")
                continue
            batch_files.append(BatchFile(
                file_path=path,
                source_type=source_type,
                version=f"1.{i}",
                import_notes=f"命令行导入: {os.path.basename(path)}",
            ))

    return batch_files


def run_calibration(batch_files, start_time, end_time, args):
    try:
        start_dt = parse_datetime_str(start_time)
        end_dt = parse_datetime_str(end_time)
    except ValueError as e:
        print(f"❌ {e}")
        return False

    params = CalibrationParams(
        start_time=start_dt,
        end_time=end_dt,
        confidence_level=args.confidence if hasattr(args, 'confidence') else 0.95,
        significance_level=args.significance if hasattr(args, 'significance') else 0.05,
        min_sample_size=30,
        deviation_warning_threshold=0.1,
        deviation_critical_threshold=0.3,
        deduplicate_enabled=not args.no_deduplicate if hasattr(args, 'no_deduplicate') else True,
        activity_bonus_enabled=not args.no_activity if hasattr(args, 'no_activity') else True,
        probability_normalization_enabled=not args.no_normalize if hasattr(args, 'no_normalize') else True,
        group_by=[args.group_by] if hasattr(args, 'group_by') else ["pool_id"],
        notes=args.notes if hasattr(args, 'notes') else "",
    )

    formats = args.formats.split(",") if hasattr(args, 'formats') else ["xlsx", "json", "html"]
    export_config = ExportConfig(
        output_dir=args.output_dir,
        report_name=args.report_name,
        include_charts=True,
        include_params=True,
        include_anomalies=True,
        include_data_sources=True,
        formats=formats,
        chart_dpi=150,
    )

    fail_fast = args.fail_fast if hasattr(args, 'fail_fast') else False
    processor = BatchProcessor(fail_fast=fail_fast)

    print(f"\n🚀 开始校准...")
    print(f"   时间范围: {start_dt} ~ {end_dt}")
    print(f"   数据文件: {len(batch_files)} 个")
    print(f"   筛选哈希: {params.get_filter_hash()}")

    result = processor.run_full_pipeline(
        batch_files=batch_files,
        params=params,
        export_config=export_config,
    )

    print(f"\n{'='*60}")
    print("校准结果摘要")
    print(f"{'='*60}")
    print(f"   批次ID: {result.batch_id}")
    print(f"   处理文件: {result.files_processed} 个 (失败: {result.files_failed})")
    print(f"   处理成功: {'是' if result.success else '否'}")
    print(f"   错误数: {len(result.errors)}")

    if result.cleaning_result:
        dr = result.cleaning_result.deduplicate
        ab = result.cleaning_result.activity_bonus
        print(f"\n   数据清洗:")
        print(f"     去重: {dr.duplicate_count:,} / {dr.total_records:,} 条重复")
        print(f"     活动加成: {ab.records_with_activity:,} 条记录应用加成")

    if result.test_result:
        tr = result.test_result
        print(f"\n   概率检验:")
        print(f"     总样本: {tr.filtered_logs:,} 条")
        print(f"     道具池: {tr.total_pools} 个")
        print(f"     道具数: {tr.total_items} 个")

        sig_pools = sum(1 for chi in tr.pool_chi_square.values() if chi.get("significant", False))
        sig_items = sum(1 for item in tr.item_stats.values() if item.is_significant)
        print(f"     显著偏离的池子: {sig_pools} 个")
        print(f"     显著偏离的道具: {sig_items} 个")

    if result.anomaly_report:
        ar = result.anomaly_report
        print(f"\n   异常检测:")
        print(f"     严重异常: {ar.critical_count} 个")
        print(f"     警告异常: {ar.warning_count} 个")
        print(f"     信息提示: {ar.info_count} 个")

    if result.exported_files:
        print(f"\n   导出报告:")
        for fmt, path in result.exported_files.items():
            print(f"     {fmt.upper()}: {path}")

    if result.errors:
        print(f"\n⚠️  错误详情:")
        for i, err in enumerate(result.errors[:10], 1):
            print(f"   {i}. {err}")

    if ar and ar.critical_count > 0:
        print(f"\n🚨 发现 {ar.critical_count} 个严重异常，请检查报告！")
    elif result.success:
        print(f"\n✅ 校准完成！请查看报告获取详细结果。")

    return result.success


def cmd_run(args):
    batch_files = build_batch_files(args)
    if not batch_files:
        print("❌ 没有指定任何数据文件！")
        return False
    return run_calibration(batch_files, args.start, args.end, args)


def cmd_scan(args):
    print(f"扫描目录: {args.dir}")
    batch_files = scan_directory(args.dir)
    if not batch_files:
        print("❌ 未发现任何数据文件！")
        return False
    print(f"发现 {len(batch_files)} 个数据文件:")
    for bf in batch_files:
        print(f"  - {bf.source_type.value}: {os.path.basename(bf.file_path)}")
    return run_calibration(batch_files, args.start, args.end, args)


def cmd_test(args):
    print("运行完整测试流程...")
    print()

    if not os.path.exists("examples/sample_data"):
        print("步骤0: 生成示例数据")
        from examples.generate_sample_data import generate_all
        generate_all()
        print()

    from examples.test_calibration import main as test_main
    return test_main()


def main():
    args = parse_args()

    if args.command is None:
        print("❌ 请指定命令！使用 --help 查看帮助。")
        return 1

    commands = {
        "generate": cmd_generate,
        "run": cmd_run,
        "scan": cmd_scan,
        "test": cmd_test,
    }

    func = commands.get(args.command)
    if func is None:
        print(f"❌ 未知命令: {args.command}")
        return 1

    try:
        success = func(args)
        return 0 if success else 1
    except KeyboardInterrupt:
        print("\n⚠️  用户中断")
        return 130
    except Exception as e:
        print(f"\n❌ 程序异常: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
