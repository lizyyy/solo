import argparse
import sys
from pathlib import Path
from datetime import datetime
import json
import logging

from .config import AppConfig
from .data_loader import DataLoader
from .deduplicator import DeduplicationEngine
from .review import ReviewManager
from .report_generator import ReportGenerator
from .data_models import LabelType

logging.basicConfig(level=logging.INFO, format="%(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


def run_pipeline(args):
    logger.info("=== 算法竞赛题解去重 - 开始处理 ===")

    logs_path = Path(args.logs) if args.logs else Path("data/evaluation_logs.jsonl")
    ann_path = Path(args.annotations) if args.annotations else Path("data/annotation_table.csv")
    conflict_path = Path(args.conflicts) if args.conflicts else Path("data/conflict_cases.json")
    config_path = Path(args.config) if args.config else Path("data/threshold_config.yaml")
    report_dir = args.report_dir if args.report_dir else "reports"

    for p in [logs_path, ann_path, conflict_path, config_path]:
        if not p.exists():
            logger.error(f"文件不存在: {p}")
            sys.exit(1)

    logger.info("加载配置...")
    config = AppConfig.load_from_yaml(config_path)

    logger.info("加载数据...")
    loader = DataLoader()
    records, annotations, conflicts = loader.load_all(logs_path, ann_path, conflict_path)
    data_stats = loader.get_statistics()

    logger.info("\n=== 数据统计 ===")
    for k, v in data_stats.items():
        if isinstance(v, dict):
            logger.info(f"  {k}:")
            for kk, vv in v.items():
                logger.info(f"    {kk}: {vv}")
        else:
            logger.info(f"  {k}: {v}")

    logger.info("\n执行去重处理...")
    engine = DeduplicationEngine(config)
    processed = engine.process(records, annotations, conflicts)
    dedup_summary = engine.get_summary()

    logger.info("\n=== 去重结果 ===")
    for k, v in dedup_summary.items():
        if isinstance(v, dict):
            logger.info(f"  {k}:")
            for kk, vv in v.items():
                logger.info(f"    {kk}: {vv}")
        else:
            logger.info(f"  {k}: {v}")

    logger.info("\n检测标注冲突...")
    review_manager = ReviewManager(config)
    label_conflicts = review_manager.detect_label_conflicts(processed)
    if label_conflicts:
        logger.info(f"发现 {len(label_conflicts)} 条标注冲突，已加入复核清单")
    else:
        logger.info("未发现标注冲突")

    if args.apply_decisions:
        try:
            with open(args.apply_decisions, "r", encoding="utf-8") as f:
                decisions = json.load(f)
            logger.info(f"从 {args.apply_decisions} 加载人工决策，共 {len(decisions)} 条")
            review_manager.batch_apply_decisions(processed, decisions)
        except Exception as e:
            logger.warning(f"加载人工决策失败: {e}")

    logger.info("\n生成报告...")
    reporter = ReportGenerator(config, report_dir=report_dir)
    run_info = {
        "操作员": args.operator or "system",
        "数据文件": logs_path.name,
        "标注文件": ann_path.name,
        "阈值配置": config_path.name,
    }

    report_path = reporter.generate(processed, data_stats, run_info)

    logger.info("\n=== 处理完成 ===")
    logger.info(f"报告已生成: {report_path}")
    logger.info(f"JSON数据已同步保存: {report_path.replace('.md', '.json')}")

    need_review = sum(1 for p in processed if p.needs_review)
    if need_review > 0:
        logger.warning(f"\n⚠️  还有 {need_review} 条样本需要人工复核")
        logger.warning("请查看报告中的「人工复核清单」章节")

    logger.info("\n=== 标签分布汇总 ===")
    from collections import defaultdict
    label_counts = defaultdict(int)
    for p in processed:
        label_counts[p.get_final_label().value] += 1
    for label, count in label_counts.items():
        logger.info(f"  {label}: {count} 条")

    return 0


def list_reports(args):
    from .metrics import VersionManager

    reporter = VersionManager(report_dir=args.report_dir or "reports")
    reports = reporter.list_existing_reports()

    if not reports:
        print("暂无历史报告")
        return 0

    print("=== 历史报告列表 ===")
    print("")
    for i, rep in enumerate(reports, 1):
        print(f"{i}. {rep['filename']}")
        print(f"   创建时间: {rep['created_time']}")
        print(f"   文件大小: {rep['size_bytes']} bytes")
        print(f"   路径: {rep['path']}")
        print("")

    return 0


def show_sample(args):
    config_path = Path(args.config) if args.config else Path("data/threshold_config.yaml")
    config = AppConfig.load_from_yaml(config_path)

    logs_path = Path(args.logs) if args.logs else Path("data/evaluation_logs.jsonl")
    loader = DataLoader()
    records = loader.load_evaluation_logs(logs_path)

    target = [r for r in records if r.sample_id == args.sample_id]
    if not target:
        logger.error(f"未找到样本 {args.sample_id}")
        return 1

    print(f"=== 样本 {args.sample_id} 的所有评测记录 ===")
    print("")
    for i, r in enumerate(target, 1):
        print(f"记录 {i}: {r.record_id}")
        print(f"  模型版本: {r.model_version}")
        print(f"  分数: {r.score}")
        print(f"  时间: {r.timestamp}")
        print(f"  输出: {r.model_output[:100]}..." if len(r.model_output) > 100 else f"  输出: {r.model_output}")
        print("")

    if len(target) >= 2 and args.compare:
        from .similarity import RecordComparator
        comparator = RecordComparator()
        sim, details = comparator.compare(target[0], target[1])
        print(f"=== 记录1 vs 记录2 相似度分析 ===")
        print(f"  最终相似度: {sim}")
        for k, v in details.items():
            print(f"  {k}: {v}")

    return 0


def main():
    parser = argparse.ArgumentParser(
        prog="dedup",
        description="算法竞赛题解去重工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 运行完整去重流程并生成报告
  python -m src.cli run --operator 小乔

  # 查看历史报告列表
  python -m src.cli list

  # 查看某个样本的所有评测记录
  python -m src.cli show S001 --compare

  # 使用自定义配置
  python -m src.cli run --config my_config.yaml --operator 张三
        """,
    )

    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    run_parser = subparsers.add_parser("run", help="运行去重流程")
    run_parser.add_argument("--logs", help="评测日志文件路径")
    run_parser.add_argument("--annotations", help="标注表文件路径")
    run_parser.add_argument("--conflicts", help="冲突案例文件路径")
    run_parser.add_argument("--config", help="阈值配置文件路径")
    run_parser.add_argument("--report-dir", help="报告输出目录")
    run_parser.add_argument("--operator", default="system", help="操作员姓名")
    run_parser.add_argument("--apply-decisions", help="从JSON文件批量应用人工决策")

    list_parser = subparsers.add_parser("list", help="列出历史报告")
    list_parser.add_argument("--report-dir", help="报告目录")

    show_parser = subparsers.add_parser("show", help="查看样本详情")
    show_parser.add_argument("sample_id", help="样本ID")
    show_parser.add_argument("--logs", help="评测日志文件路径")
    show_parser.add_argument("--config", help="阈值配置文件路径")
    show_parser.add_argument("--compare", action="store_true", help="比较前两条记录的相似度")

    args = parser.parse_args()

    if args.command == "run":
        sys.exit(run_pipeline(args))
    elif args.command == "list":
        sys.exit(list_reports(args))
    elif args.command == "show":
        sys.exit(show_sample(args))
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
