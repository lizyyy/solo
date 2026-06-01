"""钢琴练习进步曲线 - CLI入口
"""

import argparse
import json
import sys
import os
from typing import List, Dict
from datetime import datetime

from .tracer import DataTracer
from .calculator import ProgressCalculator, ProgressScore
from .reporter import ReportGenerator


def load_json_file(filepath: str) -> Dict:
    """加载JSON文件"""
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)


def load_records(filepath: str) -> List[Dict]:
    """加载记录文件（支持JSON和JSONL）"""
    if filepath.endswith(".jsonl"):
        records = []
        with open(filepath, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    records.append(json.loads(line))
        return records
    else:
        data = load_json_file(filepath)
        if isinstance(data, list):
            return data
        return data.get("records", [])


def add_note_to_records(
    records: List[Dict], record_id: str, note: str, tracer: DataTracer
) -> List[Dict]:
    """给记录添加备注，并创建追溯"""
    updated_records = []
    for rec in records:
        rid = rec.get("record_id", "")
        if rid == record_id:
            # 添加备注字段
            if "_notes" not in rec:
                rec["_notes"] = []
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            rec["_notes"].append(f"[{timestamp}] {note}")

            # 创建追溯记录
            traces = tracer.get_record_history(record_id)
            if traces:
                tracer.add_note(traces[0].trace_id, note)

        updated_records.append(rec)

    return updated_records


def run_analyze(args):
    """运行分析"""
    # 加载参数
    params = load_json_file(args.params)

    # 初始化组件
    tracer = DataTracer()
    calculator = ProgressCalculator(params, tracer)
    reporter = ReportGenerator(tracer)

    # 加载记录
    records = load_records(args.records)

    # 加载历史样本（用于旧口径回溯）
    history_samples = []
    if args.history:
        history_samples = load_records(args.history)
        for sample in history_samples:
            sample["_source_file"] = args.history

    # 标记旧口径记录
    if args.legacy_mapping:
        legacy_map = load_json_file(args.legacy_mapping)
        for record in records:
            rid = record.get("record_id", "")
            if rid in legacy_map:
                criteria = legacy_map[rid]
                matched = tracer.find_legacy_record(
                    criteria, history_samples, rid
                )
                if matched:
                    record["_source_type"] = "legacy"
                    record["_legacy_source"] = matched

    # 计算进步曲线
    scores, summary = calculator.calculate_curve(
        records, args.records, include_prediction=not args.no_prediction)

    # 生成报告
    sections = []
    sections.append(reporter.generate_header("🎹 钢琴练习进步曲线分析报告"))
    sections.append(reporter.generate_summary(summary))
    sections.append(reporter.generate_progress_table(scores))
    sections.append(reporter.generate_exception_list(scores))

    if args.show_alerts:
        sections.append(reporter.generate_alert_summary(scores))

    if args.trace_id:
        sections.append(reporter.generate_trace_report(args.trace_id))

    # 输出报告
    reporter.print_report(sections, args.format)

    # 保存报告
    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            md_report = reporter.print_report(sections, "markdown")
            f.write(md_report)
        print(f"\n💾 报告已保存到: {args.output}")

    # 保存追溯数据
    if args.save_traces:
        trace_data = tracer.export_traces()
        with open(args.save_traces, "w", encoding="utf-8") as f:
            json.dump(trace_data, f, ensure_ascii=False, indent=2)
        print(f"🔍 追溯数据已保存到: {args.save_traces}")

    return scores, summary, tracer


def run_diff(args):
    """运行带备注补录的差异对比"""
    # 加载参数
    params = load_json_file(args.params)

    # 初始化组件
    tracer = DataTracer()
    calculator = ProgressCalculator(params, tracer)
    reporter = ReportGenerator(tracer)

    # 加载记录
    records = load_records(args.records)

    # 第一次计算（补录前）
    print("=" * 60)
    print("📊 第一次计算（补录备注前")
    print("=" * 60)
    scores_before, summary_before = calculator.calculate_curve(
        records, args.records, include_prediction=False)

    # 生成补录备注
    print(f"\n📝 补录备注: {args.note}")
    records = add_note_to_records(records, args.record_id, args.note, tracer)

    # 第二次计算（补录后）
    print("\n" + "=" * 60)
    print("📊 第二次计算（补录备注后")
    print("=" * 60)
    scores_after, summary_after = calculator.calculate_curve(
        records, args.records, include_prediction=False)

    # 生成差异报告
    sections = []
    sections.append(reporter.generate_header("🎹 备注补录差异分析报告"))
    sections.append(reporter.generate_diff_report(scores_before, scores_after, args.note))
    sections.append(reporter.generate_progress_table(scores_after))
    sections.append(reporter.generate_exception_list(scores_after))

    reporter.print_report(sections, args.format)

    # 保存报告
    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            md_report = reporter.print_report(sections, "markdown")
            f.write(md_report)
        print(f"\n💾 差异报告已保存到: {args.output}")


def run_trace(args):
    """查看单条记录的追溯链"""
    # 加载参数和记录以重建追溯
    params = load_json_file(args.params)
    tracer = DataTracer()
    calculator = ProgressCalculator(params, tracer)
    reporter = ReportGenerator(tracer)

    records = load_records(args.records)
    calculator.calculate_curve(records, args.records, include_prediction=False)

    sections = [reporter.generate_trace_report(args.record_id)]
    reporter.print_report(sections, args.format)


def main():
    parser = argparse.ArgumentParser(
        description="🎹 钢琴练习进步曲线分析系统")
    subparsers = parser.add_subparsers(dest="command", help="命令")

    # analyze 命令
    analyze_parser = subparsers.add_parser("analyze", help="分析进步曲线")
    analyze_parser.add_argument("-p", "--params", required=True, help="参数配置文件(JSON)")
    analyze_parser.add_argument("-r", "--records", required=True, help="练习记录文件(JSON/JSONL)")
    analyze_parser.add_argument("--history", help="历史样本文件（用于旧口径回溯）")
    analyze_parser.add_argument("--legacy-mapping", help="旧口径记录映射(JSON)")
    analyze_parser.add_argument("--no-prediction", action="store_true", help="关闭预测功能")
    analyze_parser.add_argument("--show-alerts", action="store_true", help="显示所有处理提醒")
    analyze_parser.add_argument("--trace-id", help="查看指定记录的追溯链")
    analyze_parser.add_argument("-o", "--output", help="输出报告文件(Markdown)")
    analyze_parser.add_argument("--save-traces", help="保存追溯数据到JSON文件")
    analyze_parser.add_argument("-f", "--format", choices=["console", "markdown"], default="console", help="输出格式")
    analyze_parser.set_defaults(func=run_analyze)

    # diff 命令
    diff_parser = subparsers.add_parser("diff", help="补录备注并对比差异")
    diff_parser.add_argument("-p", "--params", required=True, help="参数配置文件(JSON)")
    diff_parser.add_argument("-r", "--records", required=True, help="练习记录文件(JSON/JSONL)")
    diff_parser.add_argument("--record-id", required=True, help="要补录备注的记录ID")
    diff_parser.add_argument("--note", required=True, help="备注内容")
    diff_parser.add_argument("-o", "--output", help="输出差异报告文件")
    diff_parser.add_argument("-f", "--format", choices=["console", "markdown"], default="console", help="输出格式")
    diff_parser.set_defaults(func=run_diff)

    # trace 命令
    trace_parser = subparsers.add_parser("trace", help="查看记录追溯链")
    trace_parser.add_argument("-p", "--params", required=True, help="参数配置文件(JSON)")
    trace_parser.add_argument("-r", "--records", required=True, help="练习记录文件(JSON/JSONL)")
    trace_parser.add_argument("--record-id", required=True, help="记录ID")
    trace_parser.add_argument("-f", "--format", choices=["console", "markdown"], default="console", help="输出格式")
    trace_parser.set_defaults(func=run_trace)

    args = parser.parse_args()

    if args.command is None:
        parser.print_help()
        sys.exit(1)

    args.func(args)


if __name__ == "__main__":
    main()
