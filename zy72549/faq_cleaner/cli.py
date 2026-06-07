import argparse
import json
import sys
from datetime import datetime
from .pipeline import CleaningPipeline
from .sample_data import create_sample_data, create_conflict_sample
from .models import RecordStatus


def cmd_run(args):
    pipeline = CleaningPipeline(output_dir=args.output_dir)

    model_records, manual_corrections, supplement_records = create_sample_data()

    print("=" * 70)
    print("FAQ 自动聚类清洗 - 三步流程演示")
    print("=" * 70)
    print()

    print("▶️  Step 1: 导入模型输出片段")
    print("-" * 70)
    step1_result = pipeline.step1_import_model_output(
        records=model_records,
        batch_id=args.batch_id,
        manual_corrections=manual_corrections,
    )
    print(f"批次: {step1_result['batch_id']}")
    print(f"处理记录数: {step1_result['total_processed']}")
    print(f"检测到冲突: {step1_result['conflict_count']} 处")
    if step1_result["conflicts"]:
        for c in step1_result["conflicts"]:
            print(f"  - {c['faq_id']} 字段[{c['field']}]: {c['description']}")
    print()
    print("📌  可重跑命令:")
    print(f"   {pipeline.get_replay_command(args.batch_id)}")
    print()

    print("▶️  Step 2: 算法运营老唐补看人工改判表")
    print("-" * 70)
    step2_result = pipeline.step2_review_manual_corrections(
        batch_id=args.batch_id,
        reviewer="老唐",
    )
    print(f"审核人: {step2_result['reviewer']}")
    print(f"已解决冲突: {step2_result['resolved_conflicts']}")
    print(f"待解决冲突: {step2_result['pending_conflicts']}")
    print("记录状态统计:")
    for status, count in step2_result["records_summary"].items():
        print(f"  - {status}: {count} 条")
    print()

    print("▶️  Step 2.5: 从人工改判表补录旧口径")
    print("-" * 70)
    supplement_result = pipeline.supplement_records(
        batch_id=args.batch_id,
        supplement_records=supplement_records,
    )
    print(f"补录记录数: {supplement_result['supplemented_count']}")
    print(f"补录FAQ ID: {', '.join(supplement_result['supplemented_faq_ids'])}")
    print()

    print("▶️  Step 3: 生成评测报告")
    print("-" * 70)
    step3_result = pipeline.step3_generate_evaluation_report(batch_id=args.batch_id)
    report = step3_result["report"]
    print(f"报告ID: {report['report_id']}")
    print(f"生成时间: {report['generate_time']}")
    print()
    print("📊  统计:")
    for k, v in report["statistics"].items():
        print(f"  {k}: {v}")
    print()
    print("📝  摘要:")
    for line in report["summary"].split("\n"):
        print(f"  {line}")
    print()

    print("📋  详细记录:")
    for detail in report["details"]:
        print(f"\n  FAQ ID: {detail['faq_id']}")
        print(f"  问题: {detail['question'][:50]}...")
        print(f"  状态: {detail['status']}")
        print(f"  来源: {detail['source']}")
        print(f"  需安全审核: {'是' if detail['review_required'] else '否'}")
        if detail["remarks"]:
            print(f"  备注 ({len(detail['remarks'])} 条):")
            for i, remark in enumerate(detail["remarks"], 1):
                print(f"    {i}. {remark}")
        if detail["history"]:
            print(f"  操作历史 ({len(detail['history'])} 条):")
            for h in detail["history"]:
                print(f"    - [{h['time']}] {h['action']}: {h['detail']}")
    print()

    print("=" * 70)
    print("✅  三步流程执行完成")
    print("=" * 70)
    print()
    print("🔄  完整可重跑命令:")
    print(f"   python -m faq_cleaner.cli run --batch-id {args.batch_id} --output-dir {args.output_dir}")
    print()
    print("📁  输出文件目录:")
    print(f"   {args.output_dir}/")
    print()


def cmd_run_conflict(args):
    pipeline = CleaningPipeline(output_dir=args.output_dir)

    model_records, manual_corrections = create_conflict_sample()

    print("=" * 70)
    print("FAQ 自动聚类清洗 - 冲突场景演示")
    print("=" * 70)
    print()

    print("▶️  Step 1: 导入模型输出（检测冲突）")
    print("-" * 70)
    step1_result = pipeline.step1_import_model_output(
        records=model_records,
        batch_id=args.batch_id,
        manual_corrections=manual_corrections,
    )
    print(f"检测到冲突: {step1_result['conflict_count']} 处")
    for c in step1_result["conflicts"]:
        print(f"\n  ⚠️  冲突证据:")
        print(f"     FAQ ID: {c['faq_id']}")
        print(f"     字段: {c['field']}")
        print(f"     模型值: {c['model_value']}")
        print(f"     人工值: {c['manual_value']}")
        print(f"     描述: {c['description']}")
    print()

    print("▶️  Step 2: 算法运营老唐选择 - 确认人工改判")
    print("-" * 70)
    conflict_resolutions = {
        "faq_004": {
            "accept_manual": True,
            "note": "模型确实漏了两个权益，确认采用人工改判的完整版本",
        }
    }
    step2_result = pipeline.step2_review_manual_corrections(
        batch_id=args.batch_id,
        reviewer="老唐",
        conflict_resolutions=conflict_resolutions,
    )
    print(f"审核人: {step2_result['reviewer']}")
    print(f"已解决冲突: {step2_result['resolved_conflicts']}")
    print()

    print("▶️  Step 3: 生成评测报告")
    print("-" * 70)
    step3_result = pipeline.step3_generate_evaluation_report(batch_id=args.batch_id)
    report = step3_result["report"]
    print("📝  摘要:")
    for line in report["summary"].split("\n"):
        print(f"  {line}")
    print()

    print("📋  冲突记录详情:")
    for detail in report["details"]:
        if detail["faq_id"] == "faq_004":
            print(f"\n  FAQ ID: {detail['faq_id']}")
            print(f"  最终状态: {detail['status']}")
            if detail["remarks"]:
                print(f"  备注:")
                for i, remark in enumerate(detail["remarks"], 1):
                    print(f"    {i}. {remark}")
    print()

    print("=" * 70)
    print("✅  冲突场景演示完成")
    print("=" * 70)


def cmd_history(args):
    pipeline = CleaningPipeline(output_dir=args.output_dir)
    model_records, manual_corrections, supplement_records = create_sample_data()
    pipeline.step1_import_model_output(model_records, args.batch_id, manual_corrections)

    history = pipeline.get_history(args.faq_id)
    if not history:
        print(f"未找到FAQ记录: {args.faq_id}")
        sys.exit(1)

    print("=" * 70)
    print(f"FAQ 复盘记录 - {args.faq_id}")
    print("=" * 70)
    print(f"当前状态: {history['current_status']}")
    print()
    print("📝  备注:")
    for i, remark in enumerate(history["remarks"], 1):
        print(f"  {i}. {remark}")
    print()
    print("📜  操作历史:")
    for h in history["history"]:
        print(f"  [{h['time']}]")
        print(f"    操作: {h['action']}")
        print(f"    操作人: {h['operator']}")
        print(f"    详情: {h['detail']}")
        print()


def main():
    parser = argparse.ArgumentParser(
        description="FAQ 自动聚类清洗系统 - 可复盘、可重跑"
    )
    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    run_parser = subparsers.add_parser("run", help="运行完整三步清洗流程（正常场景）")
    run_parser.add_argument("--batch-id", default="batch_20260607", help="批次ID")
    run_parser.add_argument("--output-dir", default="./output", help="输出目录")
    run_parser.set_defaults(func=cmd_run)

    conflict_parser = subparsers.add_parser("run-conflict", help="运行冲突场景演示")
    conflict_parser.add_argument("--batch-id", default="batch_conflict_20260607", help="批次ID")
    conflict_parser.add_argument("--output-dir", default="./output", help="输出目录")
    conflict_parser.set_defaults(func=cmd_run_conflict)

    history_parser = subparsers.add_parser("history", help="查看单条FAQ的历史记录")
    history_parser.add_argument("--faq-id", required=True, help="FAQ ID")
    history_parser.add_argument("--batch-id", default="batch_20260607", help="批次ID")
    history_parser.add_argument("--output-dir", default="./output", help="输出目录")
    history_parser.set_defaults(func=cmd_history)

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    args.func(args)


if __name__ == "__main__":
    main()
