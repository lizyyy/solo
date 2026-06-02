#!/usr/bin/env python3
"""推荐系统冷启动解释 - 模型评测工具 CLI"""

import argparse
import sys
import os
import json
from typing import List

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.engine import EvaluationEngine
from src.schemas import AnomalyType


def main():
    parser = argparse.ArgumentParser(
        description="推荐系统冷启动解释 - 模型评测工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例用法:
  # 列出可用的模型版本
  python main.py --list-versions

  # 评测指定版本
  python main.py --evaluate v1

  # 对比两个版本
  python main.py --compare v1 v2

  # 查看指定类型的异常
  python main.py --anomalies v1 --type label_conflict

  # 查看单个样本详情
  python main.py --sample v1 CS_001

  # 自定义数据目录和输出目录
  python main.py --evaluate v1 --data-dir ./data --output-dir ./output
        """
    )

    parser.add_argument(
        "--data-dir",
        type=str,
        default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "data"),
        help="数据目录路径 (默认: ./data)"
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default=None,
        help="输出目录路径 (默认: <data-dir>/reports)"
    )
    parser.add_argument(
        "--boundary-threshold",
        type=float,
        default=0.95,
        help="边界异常检测阈值 (默认: 0.95)"
    )
    parser.add_argument(
        "--null-threshold",
        type=float,
        default=0.3,
        help="空值异常严重程度阈值 (默认: 0.3)"
    )

    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument(
        "--list-versions",
        action="store_true",
        help="列出所有可用的模型版本"
    )
    group.add_argument(
        "--evaluate",
        type=str,
        metavar="VERSION",
        help="评测指定模型版本"
    )
    group.add_argument(
        "--compare",
        type=str,
        nargs=2,
        metavar=("VERSION_A", "VERSION_B"),
        help="对比两个模型版本"
    )
    group.add_argument(
        "--anomalies",
        type=str,
        metavar="VERSION",
        help="查看指定版本的异常清单"
    )
    group.add_argument(
        "--sample",
        type=str,
        nargs=2,
        metavar=("VERSION", "SAMPLE_ID"),
        help="查看指定版本下单个样本的评测详情"
    )

    parser.add_argument(
        "--type",
        type=str,
        choices=[t.value for t in AnomalyType],
        default=None,
        help="筛选指定类型的异常 (与 --anomalies 配合使用)"
    )
    parser.add_argument(
        "--no-save",
        action="store_true",
        help="不保存报告文件，仅在控制台输出"
    )

    args = parser.parse_args()

    engine = EvaluationEngine(
        data_dir=args.data_dir,
        output_dir=args.output_dir,
        boundary_threshold=args.boundary_threshold,
        null_threshold=args.null_threshold
    )

    if args.list_versions:
        versions = engine.list_versions()
        if versions:
            print("可用的模型版本:")
            for v in versions:
                print(f"  - {v}")
        else:
            print("未找到任何模型版本。")
            print(f"请在 {args.data_dir}/model_outputs/ 下创建版本目录。")

    elif args.evaluate:
        version = args.evaluate
        print(f"正在评测模型版本: {version}")
        print("=" * 60)
        report = engine.evaluate(version, save_reports=not args.no_save)

        print(f"\n📊 评测完成")
        print(f"  总样本数: {report.total_samples}")
        print(f"  有效样本数: {report.valid_samples}")
        print(f"  异常总数: {len(report.anomalies)}")

        print(f"\n📈 指标汇总:")
        for key, value in sorted(report.metrics_summary.items()):
            print(f"  {key}: {value:.4f}")

        if report.anomalies:
            print(f"\n⚠️  异常分类统计:")
            from collections import Counter
            stats = Counter(a.anomaly_type.value for a in report.anomalies)
            for atype, count in sorted(stats.items()):
                severity = max(a.severity for a in report.anomalies if a.anomaly_type.value == atype)
                print(f"  {atype}: {count} 条 (最严重: {severity})")

        if not args.no_save:
            print(f"\n💾 报告已保存到: {engine.output_dir}")
            print("  - eval_report_*.json  (完整JSON报告)")
            print("  - eval_summary_*.md   (摘要Markdown)")
            print("  - anomalies_*.md      (异常清单)")

    elif args.compare:
        v1, v2 = args.compare
        print(f"正在对比模型版本: {v1} vs {v2}")
        print("=" * 60)
        comparison = engine.compare_versions(v1, v2, save_reports=not args.no_save)

        print(f"\n📊 指标对比:")
        print(f"{'指标':<30} {v1:>10} {v2:>10} {'变化':>10} {'变化率':>12}")
        print("-" * 72)
        for metric, vals in sorted(comparison["metrics_comparison"].items()):
            delta = vals["delta"]
            sign = "+" if delta >= 0 else ""
            pct = vals["change_pct"]
            pct_str = f"{sign}{pct:.2f}%" if pct != float("inf") else "N/A"
            arrow = "↑" if delta > 0 else "↓" if delta < 0 else "-"
            print(f"{metric:<30} {vals[v1]:>10.4f} {vals[v2]:>10.4f} {sign}{delta:>9.4f} {pct_str:>12} {arrow}")

        print(f"\n⚠️  异常对比:")
        print(f"{'异常类型':<25} {v1:>8} {v2:>8} {'变化':>8}")
        print("-" * 52)
        for atype, vals in sorted(comparison["anomaly_comparison"].items()):
            delta = vals["delta"]
            sign = "+" if delta >= 0 else ""
            print(f"{atype:<25} {vals[v1]:>8} {vals[v2]:>8} {sign}{delta:>7}")

        if not args.no_save:
            print(f"\n💾 对比报告已保存到: {engine.output_dir}")

    elif args.anomalies:
        version = args.anomalies
        anomaly_type = AnomalyType(args.type) if args.type else None
        type_str = f" ({args.type})" if args.type else ""
        print(f"版本 {version} 的异常清单{type_str}:")
        print("=" * 60)

        anomalies = engine.get_anomalies_by_type(version, anomaly_type)
        if not anomalies:
            print("未发现异常。")
        else:
            for a in anomalies:
                severity_icon = {
                    "critical": "🔴",
                    "error": "🟠",
                    "warning": "🟡"
                }.get(a["severity"], "⚪")
                print(f"\n{severity_icon} [{a['anomaly_type']}] 样本 {a['sample_id']}")
                print(f"   严重程度: {a['severity']}")
                print(f"   描述: {a['description']}")
                print(f"   来源: {a['details'].get('source', 'unknown')}")
                if 'reviewer' in a['details']:
                    print(f"   复核人: {a['details']['reviewer']}")
                if 'review_comment' in a['details']:
                    print(f"   复核意见: {a['details']['review_comment']}")

    elif args.sample:
        version, sample_id = args.sample
        print(f"样本 {sample_id} 在版本 {version} 下的评测详情:")
        print("=" * 60)

        eval_data = engine.get_evaluation_by_sample_id(version, sample_id)
        if not eval_data:
            print(f"未找到样本 {sample_id} 的评测数据。")
        else:
            print(json.dumps(eval_data, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
