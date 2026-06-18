#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
海草床调查异常预警 - 命令行入口
参数名和错误提示保持稳定，供日常脚本调用
"""

import sys
import argparse
import json
import traceback
from datetime import datetime

sys.path.insert(0, ".")
from src import (
    SeagrassAlert,
    HistoryTracker,
    ERROR_MESSAGES,
)


def print_separator(char="=", length=60):
    print(char * length)


def print_header(title):
    print_separator()
    print(f"  {title}")
    print_separator()


def print_error(message):
    print(f"\n❌ 错误: {message}", file=sys.stderr)


def print_success(message):
    print(f"\n✅ {message}")


def cmd_run(args):
    """
    运行异常预警分析
    稳定参数: --config, --input-dir, --output-csv, --case-id, --operator, --conclusion, --save-history
    """
    try:
        print_header("海草床调查异常预警 - 启动分析")
        print(f"启动时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

        alert = SeagrassAlert(config_path=args.config)

        if args.input_dir:
            alert.config["input_dir"] = args.input_dir

        print(f"输入目录: {alert.config['input_dir']}")
        print(f"输出目录: {alert.config['output_dir']}")
        print()

        print("正在分析数据...")
        summary = alert.run_analysis()

        print_separator("-")
        print("分析摘要:")
        print(f"  总记录数: {summary['total_records']}")
        print(f"  异常记录: {summary['anomaly_count']}")
        print(f"  正常记录: {summary['normal_count']}")
        print()

        if summary["anomaly_by_type"]:
            print("异常类型分布:")
            for atype, count in summary["anomaly_by_type"].items():
                print(f"  - {atype}: {count} 条")
            print()

        if summary["source_impact"]:
            print("各数据源对结论的影响:")
            for source, impacts in summary["source_impact"].items():
                print(f"  📄 {source}:")
                for impact in impacts:
                    print(f"     → {impact}")
            print()

        print("异常记录明细:")
        has_anomaly = False
        for result in alert.alert_results:
            if result["is_anomaly"]:
                has_anomaly = True
                status = "⚠️  异常"
                print(
                    f"  [{result['record_id']}] {status} | "
                    f"{result['timestamp']} | "
                    f"{result['source_type']} | "
                    f"{result['metric_name']}={result['metric_value']} | "
                    f"类型: {result['anomaly_type']}"
                )
                if result["notes"]:
                    print(f"     备注: {result['notes']}")
                if result["affected_conclusion"]:
                    print(f"     影响: {result['affected_conclusion']}")

        if not has_anomaly:
            print("  无异常记录")
        print()

        csv_path = None
        if args.output_csv:
            csv_path = alert.export_csv(args.output_csv)
        else:
            csv_path = alert.export_csv()
        print_success(f"CSV明细已导出: {csv_path}")

        if args.save_history and args.case_id:
            tracker = HistoryTracker(alert.config)
            version, version_dir = tracker.save_version(
                case_id=args.case_id,
                alert_results=alert.alert_results,
                summary=summary,
                operator=args.operator or "未知",
                conclusion=args.conclusion or "待复核",
                change_reason=args.change_reason or "",
                new_notes=args.new_notes or [],
            )
            print_success(
                f"历史版本已保存: 案例 {args.case_id}, 版本 v{version:03d}"
            )
            print(f"  存储位置: {version_dir}")

        print_separator()
        print_success("分析完成")

        return 0

    except FileNotFoundError as e:
        print_error(str(e))
        return 1
    except ValueError as e:
        print_error(str(e))
        return 2
    except IOError as e:
        print_error(str(e))
        return 3
    except Exception as e:
        print_error(
            f"[SEAGRASS_ERROR_999] 未知错误: {str(e)}\n{traceback.format_exc()}"
        )
        return 99


def cmd_history(args):
    """查看历史记录"""
    try:
        alert = SeagrassAlert(config_path=args.config)
        tracker = HistoryTracker(alert.config)

        if args.action == "list-cases":
            print_header("历史案例列表")
            cases = tracker.list_all_cases()
            if not cases:
                print("暂无历史案例")
                return 0
            for case in cases:
                print(
                    f"  📁 {case['case_id']} | "
                    f"最新版本: v{case['latest_version']:03d} | "
                    f"创建时间: {case['created_at']}"
                )
                for v in case["versions"]:
                    print(
                        f"     v{v['version']:03d} | {v['timestamp']} | "
                        f"{v['operator']} | 结论: {v['conclusion']}"
                    )
                print()

        elif args.action == "list-versions":
            print_header(f"案例 {args.case_id} 版本列表")
            versions = tracker.list_versions(args.case_id)
            if not versions:
                print("暂无版本记录")
                return 0
            for v in versions:
                print(
                    f"  v{v['version']:03d} | {v['timestamp']} | "
                    f"{v['operator']} | 结论: {v['conclusion']}"
                )
                if v["change_reason"]:
                    print(f"     改判原因: {v['change_reason']}")

        elif args.action == "show":
            print_header(f"案例 {args.case_id} 版本 v{args.version:03d} 详情")
            data = tracker.load_version(args.case_id, args.version)
            if not data:
                print_error(f"版本不存在")
                return 1

            if "metadata" in data:
                meta = data["metadata"]
                print(f"版本: v{args.version:03d}")
                print(f"时间: {meta['timestamp']}")
                print(f"操作员: {meta['operator']}")
                print(f"结论: {meta['conclusion']}")
                if meta["change_reason"]:
                    print(f"改判原因: {meta['change_reason']}")
                print(f"异常数: {meta['anomaly_count']} / {meta['total_records']}")
                print()

            if "source_files" in data:
                print("原始数据文件:")
                for f in data["source_files"]:
                    print(f"  - {f}")
                print()

            if "new_notes" in data:
                print("新增备注:")
                for note in data["new_notes"]:
                    print(f"  - {note}")
                print()

            if "alert_results" in data:
                print("预警结果:")
                for r in data["alert_results"]:
                    if str(r.get("is_anomaly", "")).lower() in ["true", "1", "yes"]:
                        print(
                            f"  [{r['record_id']}] ⚠️  {r['metric_name']}={r['metric_value']} | "
                            f"{r['anomaly_type']}"
                        )

        elif args.action == "compare":
            print_header(
                f"版本比较: {args.case_id} v{args.version_old:03d} → v{args.version_new:03d}"
            )
            diff = tracker.compare_versions(
                args.case_id, args.version_old, args.version_new
            )

            if "error" in diff:
                print_error(diff["error"])
                return 1

            print(f"原结论: {diff['conclusion_old']}")
            print(f"新结论: {diff['conclusion_new']}")
            if diff["change_reason"]:
                print(f"改判原因: {diff['change_reason']}")
            print()
            print(
                f"异常数变化: {diff['anomaly_count_old']} → {diff['anomaly_count_new']}"
            )
            print()

            if diff["new_source_files"]:
                print("新增数据文件:")
                for f in diff["new_source_files"]:
                    print(f"  + {f}")
                print()

            if diff["new_notes"]:
                print("新增备注:")
                for note in diff["new_notes"]:
                    print(f"  + {note}")
                print()

            if diff["changed_results"]:
                print("结果变更:")
                for change in diff["changed_results"]:
                    old_status = "新增" if change.get("is_new_record") else (
                        "异常" if str(change.get("is_anomaly_old", "")).lower() == "true" else "正常"
                    )
                    new_status = (
                        "异常" if str(change.get("is_anomaly_new", "")).lower() == "true" else "正常"
                    )
                    print(
                        f"  [{change['record_id']}] {old_status} → {new_status} | "
                        f"{change['metric_name']}={change['metric_value']}"
                    )
                    if change.get("notes"):
                        print(f"     备注: {change['notes']}")

        print_separator()
        return 0

    except Exception as e:
        print_error(str(e))
        return 1


def cmd_export_csv(args):
    """导出CSV明细"""
    try:
        print_header("导出CSV明细")
        alert = SeagrassAlert(config_path=args.config)
        alert.run_analysis()

        if args.output:
            csv_path = alert.export_csv(args.output)
        else:
            csv_path = alert.export_csv()

        print_success(f"CSV明细已导出: {csv_path}")
        return 0

    except Exception as e:
        print_error(str(e))
        return 1


def main():
    parser = argparse.ArgumentParser(
        prog="seagrass_alert",
        description="海草床调查异常预警系统",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
使用示例:
  # 1. 启动分析（最常用）
  python run_seagrass_alert.py run --case-id CASE001 --operator 小宋 --conclusion "待复核" --save-history

  # 2. 出错重跑（指定输入目录）
  python run_seagrass_alert.py run --input-dir data/raw --case-id CASE001 --operator 小宋 --save-history

  # 3. 查看CSV明细（输出目录固定在 output/csv/）
  ls output/csv/

  # 4. 查看历史版本
  python run_seagrass_alert.py history list-versions --case-id CASE001

  # 5. 比较版本差异
  python run_seagrass_alert.py history compare --case-id CASE001 --version-old 1 --version-new 2
        """,
    )

    parser.add_argument(
        "--config",
        type=str,
        default="config.yaml",
        help="配置文件路径 (默认: config.yaml)",
    )

    subparsers = parser.add_subparsers(dest="command", required=True)

    # run 子命令 - 参数名保持稳定
    parser_run = subparsers.add_parser(
        "run",
        help="运行异常预警分析",
        description="运行海草床调查异常预警分析",
    )
    parser_run.add_argument(
        "--input-dir",
        type=str,
        default=None,
        help="输入数据目录，覆盖配置文件中的路径",
    )
    parser_run.add_argument(
        "--output-csv",
        type=str,
        default=None,
        help="CSV输出路径，默认自动生成在 output/csv/",
    )
    parser_run.add_argument(
        "--case-id",
        type=str,
        default=None,
        help="案例ID，用于保存历史记录",
    )
    parser_run.add_argument(
        "--operator",
        type=str,
        default=None,
        help="操作员姓名",
    )
    parser_run.add_argument(
        "--conclusion",
        type=str,
        default=None,
        help="复核结论",
    )
    parser_run.add_argument(
        "--change-reason",
        type=str,
        default="",
        help="改判原因（补录时填写）",
    )
    parser_run.add_argument(
        "--new-notes",
        type=str,
        nargs="+",
        default=None,
        help="新增备注（可多个）",
    )
    parser_run.add_argument(
        "--save-history",
        action="store_true",
        help="保存到历史记录",
    )
    parser_run.set_defaults(func=cmd_run)

    # history 子命令
    parser_history = subparsers.add_parser(
        "history",
        help="历史记录管理",
        description="查看和管理历史记录",
    )
    parser_history.add_argument(
        "action",
        type=str,
        choices=["list-cases", "list-versions", "show", "compare"],
        help="操作类型",
    )
    parser_history.add_argument(
        "--case-id",
        type=str,
        default=None,
        help="案例ID",
    )
    parser_history.add_argument(
        "--version",
        type=int,
        default=None,
        help="版本号（用于 show）",
    )
    parser_history.add_argument(
        "--version-old",
        type=int,
        default=None,
        help="旧版本号（用于 compare）",
    )
    parser_history.add_argument(
        "--version-new",
        type=int,
        default=None,
        help="新版本号（用于 compare）",
    )
    parser_history.set_defaults(func=cmd_history)

    # export-csv 子命令
    parser_export = subparsers.add_parser(
        "export-csv",
        help="导出CSV明细",
        description="导出最新分析结果为CSV",
    )
    parser_export.add_argument(
        "--output",
        type=str,
        default=None,
        help="CSV输出路径",
    )
    parser_export.set_defaults(func=cmd_export_csv)

    args = parser.parse_args()

    try:
        return args.func(args)
    except KeyboardInterrupt:
        print("\n⚠️  用户中断")
        return 130


if __name__ == "__main__":
    sys.exit(main())
