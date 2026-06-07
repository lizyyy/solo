#!/usr/bin/env python3
import sys
sys.path.insert(0, '.')

from faq_cleaner.pipeline import CleaningPipeline
from faq_cleaner.sample_data import create_sample_data, create_conflict_sample
from faq_cleaner.models import RecordStatus

def main():
    print("=" * 70)
    print("FAQ 自动聚类清洗 - 三步流程演示")
    print("=" * 70)
    print()

    pipeline = CleaningPipeline(output_dir="./output")
    model_records, manual_corrections, supplement_records = create_sample_data()

    print("▶️  Step 1: 导入模型输出片段")
    print("-" * 70)
    step1_result = pipeline.step1_import_model_output(
        records=model_records,
        batch_id="batch_20260607",
        manual_corrections=manual_corrections,
    )
    print(f"批次: {step1_result['batch_id']}")
    print(f"处理记录数: {step1_result['total_processed']}")
    print(f"检测到冲突: {step1_result['conflict_count']} 处")
    print()
    print("📌  可重跑命令:")
    print(f"   python3 -m faq_cleaner.cli run --batch-id batch_20260607 --output-dir ./output")
    print()

    print("▶️  Step 2: 算法运营老唐补看人工改判表")
    print("-" * 70)
    step2_result = pipeline.step2_review_manual_corrections(
        batch_id="batch_20260607",
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
        batch_id="batch_20260607",
        supplement_records=supplement_records,
    )
    print(f"补录记录数: {supplement_result['supplemented_count']}")
    print(f"补录FAQ ID: {', '.join(supplement_result['supplemented_faq_ids'])}")
    print()

    print("▶️  Step 3: 生成评测报告")
    print("-" * 70)
    step3_result = pipeline.step3_generate_evaluation_report(batch_id="batch_20260607")
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
    print(f"   python3 run_demo.py")
    print()
    print("📁  输出文件目录:")
    print(f"   ./output/")
    print()

if __name__ == "__main__":
    main()
