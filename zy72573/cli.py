#!/usr/bin/env python3
import argparse
import json
import sys
import os
from pathlib import Path

from models import TrialRecord
from core import (
    import_feature_snapshot, import_training_log,
    generate_summary, apply_correction, create_run,
    create_trial, load_trial, calculate_temperature
)


def print_banner():
    print("=" * 60)
    print("  知识蒸馏温度试算工具 (Knowledge Distillation Temp Trial)")
    print("=" * 60)
    print()


def print_summary(summary, verbose=False):
    print(f"\n{'='*60}")
    print(f"  可解释摘要 v{summary.version}")
    print(f"{'='*60}")
    print(f"生成时间: {summary.generated_at}")
    print(f"置信度: {summary.confidence}")
    print(f"推荐温度: {summary.temperature_result}")
    print()
    print(f"结论: {summary.conclusion}")
    print()
    print(f"下一步: {summary.next_action}")
    print()
    print(f"是否有训练日志: {'是' if summary.has_training_log else '否'}")
    print(f"是否有人工修正: {'是' if summary.has_correction else '否'}")
    if summary.default_features:
        print(f"使用默认值的特征: {', '.join(summary.default_features)}")
    if summary.missing_materials:
        print(f"缺失材料: {', '.join(summary.missing_materials)}")
    print()
    if verbose and summary.notes:
        print("备注:")
        for note in summary.notes:
            print(f"  - {note}")
    print()


def cmd_init(args):
    trial = create_trial()
    save_path = args.output or f"trial_{trial.trial_id}.json"
    trial.save(save_path)
    print(f"✓ 已创建新的试算记录: {trial.trial_id}")
    print(f"  保存到: {save_path}")
    return trial, save_path


def cmd_import(args):
    if not os.path.exists(args.trial):
        print(f"错误: 试算记录文件不存在: {args.trial}")
        sys.exit(1)

    trial = load_trial(args.trial)
    snapshot = import_feature_snapshot(args.file)
    trial.snapshot = snapshot
    trial.status = "snapshot_imported"

    summary = generate_summary(snapshot)
    trial.summaries.append(summary)

    run = create_run(snapshot, "import_snapshot", {"file": args.file})
    trial.runs.append(run)

    trial.save(args.trial)

    print(f"✓ 特征快照已导入: {snapshot.snapshot_id}")
    print(f"  特征数量: {len(snapshot.features)}")
    default_count = sum(1 for f in snapshot.features if f.is_default)
    if default_count > 0:
        print(f"  ⚠️  检测到 {default_count} 个特征使用默认值")
    print_summary(summary, verbose=args.verbose)

    return trial, args.trial


def cmd_add_log(args):
    if not os.path.exists(args.trial):
        print(f"错误: 试算记录文件不存在: {args.trial}")
        sys.exit(1)

    trial = load_trial(args.trial)
    if not trial.snapshot:
        print("错误: 请先导入特征快照")
        sys.exit(1)

    training_log = import_training_log(args.file, trial.snapshot.snapshot_id)
    trial.training_log = training_log
    trial.status = "log_added"

    prev_summary = trial.summaries[-1] if trial.summaries else None
    summary = generate_summary(
        trial.snapshot, training_log, trial.corrections, prev_summary
    )
    trial.summaries.append(summary)

    run = create_run(
        trial.snapshot, "add_training_log",
        {"file": args.file}, summary.temperature_result
    )
    trial.runs.append(run)

    trial.save(args.trial)

    print(f"✓ 训练日志已补录: {training_log.log_id}")
    print(f"  记录点数: {len(training_log.points)}")
    if training_log.points:
        latest = training_log.points[-1]
        print(f"  最新步: step={latest.step}, acc={latest.accuracy:.4f}")
    print_summary(summary, verbose=args.verbose)

    return trial, args.trial


def cmd_correct(args):
    if not os.path.exists(args.trial):
        print(f"错误: 试算记录文件不存在: {args.trial}")
        sys.exit(1)

    trial = load_trial(args.trial)
    if not trial.snapshot:
        print("错误: 请先导入特征快照")
        sys.exit(1)

    corrections = {}
    for item in args.corrections:
        if '=' in item:
            name, val = item.split('=', 1)
            corrections[name.strip()] = float(val.strip())

    if not corrections:
        print("错误: 请提供修正值，格式为 feature_name=value")
        sys.exit(1)

    correction = apply_correction(
        trial.snapshot, corrections,
        args.by or "anonymous", args.reason or "人工修正"
    )
    trial.corrections.append(correction)
    trial.status = "corrected"

    prev_summary = trial.summaries[-1] if trial.summaries else None
    summary = generate_summary(
        trial.snapshot, trial.training_log, trial.corrections, prev_summary
    )
    trial.summaries.append(summary)

    run = create_run(
        trial.snapshot, "manual_correction",
        {"corrections": corrections, "by": args.by, "reason": args.reason},
        summary.temperature_result
    )
    trial.runs.append(run)

    trial.save(args.trial)

    print(f"✓ 人工修正已应用")
    print(f"  修正人: {correction.corrected_by}")
    print(f"  修正原因: {correction.reason}")
    print(f"  修正内容: {json.dumps(corrections, ensure_ascii=False)}")
    print_summary(summary, verbose=args.verbose)

    return trial, args.trial


def cmd_rerun(args):
    if not os.path.exists(args.trial):
        print(f"错误: 试算记录文件不存在: {args.trial}")
        sys.exit(1)

    trial = load_trial(args.trial)
    if not trial.snapshot:
        print("错误: 请先导入特征快照")
        sys.exit(1)

    temp, details = calculate_temperature(
        trial.snapshot, trial.training_log,
        trial.corrections[-1] if trial.corrections else None
    )

    prev_summary = trial.summaries[-1] if trial.summaries else None
    summary = generate_summary(
        trial.snapshot, trial.training_log, trial.corrections, prev_summary
    )
    trial.summaries.append(summary)

    run = create_run(
        trial.snapshot, "rerun",
        {"note": args.note or "手动重跑"}, temp
    )
    trial.runs.append(run)
    trial.status = "rerun"

    trial.save(args.trial)

    print(f"✓ 重跑完成")
    print(f"  推荐温度: {temp}")
    print_summary(summary, verbose=args.verbose)

    return trial, args.trial


def cmd_summary(args):
    if not os.path.exists(args.trial):
        print(f"错误: 试算记录文件不存在: {args.trial}")
        sys.exit(1)

    trial = load_trial(args.trial)

    if not trial.summaries:
        print("暂无摘要记录")
        return

    if args.version:
        target = None
        for s in trial.summaries:
            if s.version == args.version:
                target = s
                break
        if target:
            print_summary(target, verbose=True)
        else:
            print(f"错误: 找不到版本 v{args.version}")
    elif args.all:
        for s in trial.summaries:
            print_summary(s, verbose=args.verbose)
    else:
        print_summary(trial.summaries[-1], verbose=args.verbose)


def cmd_status(args):
    if not os.path.exists(args.trial):
        print(f"错误: 试算记录文件不存在: {args.trial}")
        sys.exit(1)

    trial = load_trial(args.trial)

    print(f"\n{'='*60}")
    print(f"  试算记录状态")
    print(f"{'='*60}")
    print(f"试算ID: {trial.trial_id}")
    print(f"创建时间: {trial.created_at}")
    print(f"当前状态: {trial.status}")
    print()

    print(f"特征快照: {'已导入' if trial.snapshot else '未导入'}")
    if trial.snapshot:
        print(f"  ID: {trial.snapshot.snapshot_id}")
        print(f"  特征数: {len(trial.snapshot.features)}")
        default_count = sum(1 for f in trial.snapshot.features if f.is_default)
        print(f"  默认值特征: {default_count}")
    print()

    print(f"训练日志: {'已补录' if trial.training_log else '未补录'}")
    if trial.training_log:
        print(f"  ID: {trial.training_log.log_id}")
        print(f"  记录点数: {len(trial.training_log.points)}")
    print()

    print(f"人工修正: {len(trial.corrections)} 次")
    print(f"摘要版本: {len(trial.summaries)} 个")
    print(f"运行记录: {len(trial.runs)} 条")
    print()

    if trial.summaries:
        latest = trial.summaries[-1]
        print(f"最新摘要 v{latest.version}:")
        print(f"  结论: {latest.conclusion}")
        print(f"  下一步: {latest.next_action}")
    print()


def cmd_demo(args):
    print_banner()
    print("正在运行完整演示流程...\n")

    base_dir = Path(__file__).parent
    demo_dir = base_dir / "data" / "demo"

    trial_path = base_dir / "demo_trial.json"

    print("--- 步骤1: 创建试算记录 ---")
    trial = create_trial()
    print(f"✓ 创建试算记录: {trial.trial_id}")
    print()

    print("--- 步骤2: 导入特征快照 ---")
    snap_path = demo_dir / "feature_snapshot.json"
    snapshot = import_feature_snapshot(str(snap_path))
    trial.snapshot = snapshot
    trial.status = "snapshot_imported"
    summary1 = generate_summary(snapshot)
    trial.summaries.append(summary1)
    run1 = create_run(snapshot, "import_snapshot", {"file": str(snap_path)})
    trial.runs.append(run1)
    print(f"✓ 特征快照已导入: {snapshot.snapshot_id}")
    print(f"  特征数量: {len(snapshot.features)}")
    default_count = sum(1 for f in snapshot.features if f.is_default)
    print(f"  ⚠️  检测到 {default_count} 个特征使用默认值")
    print_summary(summary1)
    print()

    print("--- 步骤3: 推荐策略老唐补看训练日志曲线 ---")
    log_path = demo_dir / "training_log.json"
    training_log = import_training_log(str(log_path), snapshot.snapshot_id)
    trial.training_log = training_log
    trial.status = "log_added"
    summary2 = generate_summary(snapshot, training_log, [], summary1)
    trial.summaries.append(summary2)
    run2 = create_run(snapshot, "add_training_log", {"file": str(log_path)}, summary2.temperature_result)
    trial.runs.append(run2)
    print(f"✓ 训练日志已补录")
    print(f"  记录点数: {len(training_log.points)}")
    print_summary(summary2)
    print()

    print("--- 步骤4: 人工修正（推荐策略老唐修正 ---")
    correction = apply_correction(
        snapshot,
        {"teacher_confidence": 0.92},
        "推荐策略老唐",
        "回看训练日志后发现教师模型实际置信度更高"
    )
    trial.corrections.append(correction)
    trial.status = "corrected"
    summary3 = generate_summary(snapshot, training_log, [correction], summary2)
    trial.summaries.append(summary3)
    run3 = create_run(snapshot, "manual_correction", {
        "corrections": {"teacher_confidence": 0.92},
        "by": "推荐策略老唐",
        "reason": "回看训练日志后发现教师模型实际置信度更高"
    }, summary3.temperature_result)
    trial.runs.append(run3)
    print(f"✓ 人工修正已应用")
    print(f"  修正人: 推荐策略老唐")
    print(f"  修正内容: teacher_confidence: 0.85 -> 0.92")
    print_summary(summary3)
    print()

    print("--- 步骤5: 重跑验证 ---")
    summary4 = generate_summary(snapshot, training_log, [correction], summary3)
    trial.summaries.append(summary4)
    run4 = create_run(snapshot, "rerun", {"note": "人工修正后重跑验证"}, summary4.temperature_result)
    trial.runs.append(run4)
    trial.status = "completed"
    print(f"✓ 重跑验证完成")
    print_summary(summary4, verbose=True)
    print()

    trial.save(str(trial_path))
    print(f"✓ 演示试算记录已保存到: {trial_path}")
    print()
    print("="*60)
    print("  演示流程完成！")
    print("="*60)
    print()
    print("可复现的命令:")
    print(f"  1. 初始化: python cli.py init --output {trial_path}")
    print(f"  2. 导入特征: python cli.py import --trial {trial_path} --file {snap_path}")
    print(f"  3. 补录日志: python cli.py add-log --trial {trial_path} --file {log_path}")
    print(f"  4. 人工修正: python cli.py correct --trial {trial_path} --corrections teacher_confidence=0.92 --by '推荐策略老唐' --reason '回看训练日志后发现教师模型实际置信度更高'")
    print(f"  5. 重跑验证: python cli.py rerun --trial {trial_path} --note '人工修正后重跑验证'")
    print(f"  查看状态: python cli.py status --trial {trial_path}")
    print(f"  查看摘要: python cli.py summary --trial {trial_path}")
    print()


def main():
    parser = argparse.ArgumentParser(
        description="知识蒸馏温度试算工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  %(prog)s demo
  %(prog)s init --output my_trial.json
  %(prog)s import --trial my_trial.json --file features.json
  %(prog)s add-log --trial my_trial.json --file training_log.json
  %(prog)s correct --trial my_trial.json --corrections teacher_confidence=0.9 --by "老唐"
  %(prog)s rerun --trial my_trial.json
  %(prog)s summary --trial my_trial.json
  %(prog)s status --trial my_trial.json
        """
    )
    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    p_init = subparsers.add_parser("init", help="创建新的试算记录")
    p_init.add_argument("--output", "-o", help="输出文件路径")
    p_init.set_defaults(func=cmd_init)

    p_import = subparsers.add_parser("import", help="导入特征快照")
    p_import.add_argument("--trial", "-t", required=True, help="试算记录文件")
    p_import.add_argument("--file", "-f", required=True, help="特征快照文件")
    p_import.add_argument("--verbose", "-v", action="store_true", help="显示详细信息")
    p_import.set_defaults(func=cmd_import)

    p_add_log = subparsers.add_parser("add-log", help="补录训练日志")
    p_add_log.add_argument("--trial", "-t", required=True, help="试算记录文件")
    p_add_log.add_argument("--file", "-f", required=True, help="训练日志文件")
    p_add_log.add_argument("--verbose", "-v", action="store_true", help="显示详细信息")
    p_add_log.set_defaults(func=cmd_add_log)

    p_correct = subparsers.add_parser("correct", help="应用人工修正")
    p_correct.add_argument("--trial", "-t", required=True, help="试算记录文件")
    p_correct.add_argument("--corrections", "-c", nargs="+", required=True,
                          help="修正值，格式: feature_name=value")
    p_correct.add_argument("--by", "-b", help="修正人")
    p_correct.add_argument("--reason", "-r", help="修正原因")
    p_correct.add_argument("--verbose", "-v", action="store_true", help="显示详细信息")
    p_correct.set_defaults(func=cmd_correct)

    p_rerun = subparsers.add_parser("rerun", help="重跑温度计算")
    p_rerun.add_argument("--trial", "-t", required=True, help="试算记录文件")
    p_rerun.add_argument("--note", "-n", help="重跑说明")
    p_rerun.add_argument("--verbose", "-v", action="store_true", help="显示详细信息")
    p_rerun.set_defaults(func=cmd_rerun)

    p_summary = subparsers.add_parser("summary", help="查看可解释摘要")
    p_summary.add_argument("--trial", "-t", required=True, help="试算记录文件")
    p_summary.add_argument("--version", "-v", type=int, help="指定摘要版本")
    p_summary.add_argument("--all", "-a", action="store_true", help="显示所有版本")
    p_summary.add_argument("--verbose", action="store_true", help="显示详细信息")
    p_summary.set_defaults(func=cmd_summary)

    p_status = subparsers.add_parser("status", help="查看试算记录状态")
    p_status.add_argument("--trial", "-t", required=True, help="试算记录文件")
    p_status.set_defaults(func=cmd_status)

    p_demo = subparsers.add_parser("demo", help="运行完整演示流程")
    p_demo.set_defaults(func=cmd_demo)

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return

    if args.command != "demo":
        print_banner()

    args.func(args)


if __name__ == "__main__":
    main()
