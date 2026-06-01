import argparse
import sys
import os
import json
from datetime import datetime
from typing import List

from .config import ParameterManager
from .estimator import HoleAreaEstimator, HoleSample, load_samples_from_file, save_results
from .anomaly import AnomalyDetector
from .explainer import ResultExplainer
from .incremental import IncrementalProcessor
from .report import ReportGenerator


def run_estimate(args):
    pm = ParameterManager(args.param_file, args.history_file)
    estimator = HoleAreaEstimator(pm)
    anomaly_detector = AnomalyDetector(pm)
    explainer = ResultExplainer(pm)
    report_gen = ReportGenerator(pm, explainer, anomaly_detector)

    print(f"[INFO] 正在加载样本: {args.input}")
    samples = load_samples_from_file(args.input)
    print(f"[INFO] 已加载 {len(samples)} 个样本")

    if args.incremental and os.path.exists(args.previous_results):
        print(f"[INFO] 增量模式，加载之前的结果: {args.previous_results}")
        inc_processor = IncrementalProcessor(pm, args.previous_results)
        print(f"[INFO] 保留了 {len(inc_processor.previous_samples)} 个历史样本的人工修正")

    print("[INFO] 开始估算孔洞面积...")
    samples = estimator.estimate(samples)

    print("[INFO] 开始异常检测...")
    samples = anomaly_detector.detect(samples)

    if args.incremental and os.path.exists(args.previous_results):
        print("[INFO] 合并历史数据（保留人工修正值）...")
        samples = inc_processor.merge_with_previous(samples)
        previous_samples = list(inc_processor.previous_samples.values())
        diff_report = inc_processor.generate_diff_report(previous_samples, samples)
        print(inc_processor.format_diff_for_display(diff_report))
        diff_path = os.path.join(os.path.dirname(args.output_results), "diff_report.json")
        inc_processor.save_diff_report(diff_report, diff_path)
        print(f"[INFO] 差异报告已保存: {diff_path}")

    for override in args.override or []:
        parts = override.split(":", 2)
        if len(parts) >= 3:
            sample_id, value, note = parts[0], float(parts[1]), parts[2]
            operator = args.operator or "unknown"
            for sample in samples:
                if sample.sample_id == sample_id:
                    sample.manual_override = value
                    sample.manual_note = note
                    sample.manual_operator = operator
                    print(f"[INFO] 样本 {sample_id} 已人工修正为 {value} ({note})")
                    break

    for note in args.add_note or []:
        parts = note.split(":", 1)
        if len(parts) == 2:
            sample_id, note_text = parts[0], parts[1]
            operator = args.operator or "unknown"
            inc_processor_temp = IncrementalProcessor(pm, None)
            if inc_processor_temp.add_manual_note(samples, sample_id, note_text, operator):
                print(f"[INFO] 已为样本 {sample_id} 添加备注")

    print(f"[INFO] 保存详细结果: {args.output_results}")
    save_results(samples, args.output_results)

    if args.output_report:
        print(f"[INFO] 生成老板汇总页: {args.output_report}")
        prev_report = args.previous_report if args.incremental else None
        report_gen.generate_executive_report(
            samples, args.output_report,
            manual_notes_path=args.manual_notes,
            previous_report_path=prev_report
        )

    if args.output_json:
        print(f"[INFO] 生成JSON导出: {args.output_json}")
        report_gen.generate_json_export(samples, args.output_json)

    if args.output_csv:
        print(f"[INFO] 生成CSV导出: {args.output_csv}")
        report_gen.generate_simple_csv(samples, args.output_csv)

    if args.output_anomaly:
        print(f"[INFO] 生成异常清单: {args.output_anomaly}")
        report_gen.generate_anomaly_report(samples, args.output_anomaly)

    anomaly_summary = anomaly_detector.get_anomaly_summary(samples)
    print("\n" + "=" * 60)
    print(explainer.generate_executive_summary(samples, anomaly_summary))
    print("=" * 60)

    return 0


def run_param(args):
    pm = ParameterManager(args.param_file, args.history_file)

    if args.action == "list":
        all_params = pm.get_all()
        user_params = pm.get_user_modified()
        diff = pm.diff_from_default()

        print("=== 参数列表 ===")
        print(f"默认参数: {len([k for k in all_params.keys() if k != '_meta'])} 个")
        print(f"用户修改: {len(diff)} 个")
        print()

        if diff:
            print("⚠️  人工调整的参数:")
            for key, info in sorted(diff.items()):
                print(f"  {key}:")
                print(f"    默认值: {info['default']}")
                print(f"    当前值: {info['current']}")
                print(f"    状态: {info['status']}")
            print()

        print("完整参数:")
        def print_params(d, prefix=""):
            for k, v in sorted(d.items()):
                if k == "_meta":
                    continue
                full_key = f"{prefix}.{k}" if prefix else k
                if isinstance(v, dict):
                    print(f"  [{full_key}]")
                    print_params(v, full_key)
                else:
                    modified = " *" if full_key in diff else ""
                    print(f"  {full_key}: {v}{modified}")

        print_params(all_params)
        print()
        print("* 标记表示该参数已被人工调整，与默认值不同")

    elif args.action == "set":
        if not args.key or not args.value:
            print("[错误] 请指定参数名和值", file=sys.stderr)
            return 1

        key = args.key
        value_str = args.value

        try:
            if "." in value_str:
                value = float(value_str)
            elif value_str.lower() in ("true", "false"):
                value = value_str.lower() == "true"
            else:
                try:
                    value = int(value_str)
                except ValueError:
                    value = value_str
        except Exception:
            value = value_str

        pm.set(key, value, operator=args.operator or "cli", note=args.note or "")
        print(f"[INFO] 已设置 {key} = {value}")

    elif args.action == "reset":
        if not args.key:
            print("[错误] 请指定要重置的参数名", file=sys.stderr)
            return 1
        if pm.reset_param(args.key, operator=args.operator or "cli", note=args.note or ""):
            print(f"[INFO] 已重置 {args.key} 为默认值")
        else:
            print(f"[INFO] 参数 {args.key} 未被修改过，无需重置")

    elif args.action == "history":
        history = pm.get_history(args.key, limit=args.limit or 50)
        if not history:
            print("[INFO] 暂无修改历史")
            return 0

        print(f"=== 参数修改历史 (最近 {len(history)} 条) ===")
        for i, entry in enumerate(history, 1):
            print(f"\n{i}. {entry['timestamp']}")
            print(f"   参数: {entry['key_path']}")
            print(f"   变更: {entry['old_value']} → {entry['new_value']}")
            print(f"   操作人: {entry['operator']}")
            if entry['note']:
                print(f"   备注: {entry['note']}")

    elif args.action == "diff":
        diff = pm.diff_from_default()
        if not diff:
            print("[INFO] 所有参数均为默认值，无差异")
            return 0

        print(f"=== 参数与默认值差异 ({len(diff)} 处) ===")
        for key, info in sorted(diff.items()):
            print(f"\n{key}:")
            print(f"  默认值: {info['default']}")
            print(f"  当前值: {info['current']}")
            print(f"  状态: {info['status']}")

    return 0


def run_explain(args):
    pm = ParameterManager(args.param_file, args.history_file)
    explainer = ResultExplainer(pm)

    if not os.path.exists(args.input):
        print(f"[错误] 文件不存在: {args.input}", file=sys.stderr)
        return 1

    with open(args.input, "r", encoding="utf-8") as f:
        data = json.load(f)

    if "samples" not in data:
        print("[错误] 结果文件格式不正确", file=sys.stderr)
        return 1

    from .estimator import HoleSample
    samples = []
    for sd in data["samples"]:
        s = HoleSample(sd["sample_id"], sd.get("raw_data", {}), sd.get("source", "unknown"))
        s.estimated_area = sd.get("estimated_area")
        s.manual_override = sd.get("manual_override")
        s.manual_note = sd.get("manual_note")
        s.manual_operator = sd.get("manual_operator")
        s.is_anomaly = sd.get("is_anomaly", False)
        s.anomaly_reasons = sd.get("anomaly_reasons", [])
        s.estimation_method = sd.get("estimation_method")
        s.processed_at = sd.get("processed_at")
        s.metadata = sd.get("metadata", {})
        s.confidence_interval = tuple(sd["confidence_interval"]) if sd.get("confidence_interval") else None
        samples.append(s)

    if args.sample_id:
        target = None
        for s in samples:
            if s.sample_id == args.sample_id:
                target = s
                break
        if not target:
            print(f"[错误] 未找到样本: {args.sample_id}", file=sys.stderr)
            return 1

        explanation = explainer.explain_sample(target)
        print(f"\n=== 样本 {target.sample_id} 详细解释 ===")
        print(f"\n结果类型: {explanation['result_type']}")
        print(f"最终面积: {explanation['final_area']:.3f} {explanation['unit']}")
        print(f"置信度: {explanation['confidence_assessment']['confidence_level']} "
              f"({explanation['confidence_assessment']['confidence_score']:.0%})")
        print(f"\n摘要: {explanation['summary']}")
        print(f"\n估算详情:")
        ed = explanation['estimation_details']
        print(f"  方法: {ed['method']} - {ed['method_explanation']}")
        print(f"  输入: {ed['input_data_summary']}")
        print(f"  来源: {ed['data_source']}")
        print(f"  处理时间: {ed['processed_at']}")

        print(f"\n置信度影响因素:")
        for factor in explanation['confidence_assessment']['contributing_factors']:
            print(f"  - {factor}")

        if 'anomaly_analysis' in explanation:
            print(f"\n异常分析:")
            for reason in explanation['anomaly_analysis']['reasons']:
                print(f"  ❌ {reason}")
            print(f"\n建议行动:")
            for action in explanation['anomaly_analysis']['suggested_actions']:
                print(f"  💡 {action}")

        print(f"\n处理建议:")
        rec = explanation['recommendation']
        print(f"  优先级: {rec['priority']}")
        for action in rec['actions']:
            print(f"  - {action}")
    else:
        for s in samples:
            exp = explainer.explain_sample(s)
            flag = "⚠️ " if s.is_anomaly else ("✏️ " if s.manual_override else "✅ ")
            print(f"{flag}{s.sample_id}: {exp['summary']}")
            print(f"   置信度: {exp['confidence_assessment']['confidence_level']} "
                  f"| 优先级: {exp['recommendation']['priority']}")

    return 0


def main():
    parser = argparse.ArgumentParser(
        description="3D网格孔洞面积估算工具 - 可追溯、可解释、保护人工操作",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 1. 先跑小包测试
  python run.py estimate -i data/samples/small_batch_test.json \\
      -o output/results_test.json -r output/report_test.md

  # 2. 补备注后增量处理完整批次
  python run.py estimate -i data/samples/batch_may_week4.json \\
      -o output/results_full.json -r output/report_full.md \\
      --incremental --previous output/results_test.json \\
      --override H-003:45.2:扫描故障人工修正 --operator 小岑 \\
      --add-note H-007:需等下周一补充样本后再判 \\
      --csv output/results_full.csv --json output/results_full.json \\
      --anomaly output/anomalies.md

  # 查看参数差异
  python run.py param diff

  # 解释特定样本
  python run.py explain -i output/results_full.json --sample H-003
        """
    )

    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    est_parser = subparsers.add_parser("estimate", help="估算孔洞面积")
    est_parser.add_argument("-i", "--input", required=True, help="样本输入文件(JSON)")
    est_parser.add_argument("-o", "--output-results", default="output/results.json",
                           help="详细结果输出文件")
    est_parser.add_argument("-r", "--output-report", default="output/report.md",
                           help="老板汇总页输出文件(Markdown)")
    est_parser.add_argument("--json", dest="output_json", default=None,
                           help="JSON格式导出文件")
    est_parser.add_argument("--csv", dest="output_csv", default=None,
                           help="CSV格式导出文件")
    est_parser.add_argument("--anomaly", dest="output_anomaly", default=None,
                           help="异常清单输出文件")
    est_parser.add_argument("--param-file", default="data/parameters.json",
                           help="参数文件路径")
    est_parser.add_argument("--history-file", default="data/history.json",
                           help="历史记录文件路径")
    est_parser.add_argument("--manual-notes", default="data/manual_notes.md",
                           help="人工备注文件路径")
    est_parser.add_argument("--incremental", action="store_true",
                           help="增量模式，保留之前的人工修正")
    est_parser.add_argument("--previous", dest="previous_results",
                           default="output/results.json",
                           help="之前的结果文件，用于增量处理")
    est_parser.add_argument("--previous-report", dest="previous_report",
                           default=None,
                           help="之前的报告文件，用于保留老板备注")
    est_parser.add_argument("--override", action="append", default=None,
                           metavar="ID:VALUE:NOTE",
                           help="人工修正样本值，格式: 样本ID:值:备注")
    est_parser.add_argument("--add-note", action="append", default=None,
                           metavar="ID:NOTE",
                           help="为样本添加备注，格式: 样本ID:备注内容")
    est_parser.add_argument("--operator", default=None,
                           help="操作人姓名")

    param_parser = subparsers.add_parser("param", help="参数管理")
    param_parser.add_argument("action", choices=["list", "set", "reset", "history", "diff"],
                             help="操作类型")
    param_parser.add_argument("--key", help="参数名 (如 hole_area_estimation.min_hole_area)")
    param_parser.add_argument("--value", help="参数值")
    param_parser.add_argument("--note", help="修改备注")
    param_parser.add_argument("--operator", default="cli", help="操作人")
    param_parser.add_argument("--limit", type=int, default=50, help="历史记录条数")
    param_parser.add_argument("--param-file", default="data/parameters.json",
                             help="参数文件路径")
    param_parser.add_argument("--history-file", default="data/history.json",
                             help="历史记录文件路径")

    exp_parser = subparsers.add_parser("explain", help="结果解释")
    exp_parser.add_argument("-i", "--input", required=True, help="结果文件(JSON)")
    exp_parser.add_argument("--sample", dest="sample_id", default=None,
                           help="要查看的样本ID，不指定则列出所有")
    exp_parser.add_argument("--param-file", default="data/parameters.json",
                           help="参数文件路径")
    exp_parser.add_argument("--history-file", default="data/history.json",
                           help="历史记录文件路径")

    args = parser.parse_args()

    if args.command is None:
        parser.print_help()
        return 1

    if args.command == "estimate":
        return run_estimate(args)
    elif args.command == "param":
        return run_param(args)
    elif args.command == "explain":
        return run_explain(args)

    return 0


if __name__ == "__main__":
    sys.exit(main())
