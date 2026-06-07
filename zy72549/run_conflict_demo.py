#!/usr/bin/env python3
import sys
sys.path.insert(0, '.')

from faq_cleaner.pipeline import CleaningPipeline
from faq_cleaner.sample_data import create_conflict_sample

def main():
    print("=" * 70)
    print("FAQ 自动聚类清洗 - 冲突场景演示")
    print("=" * 70)
    print()

    pipeline = CleaningPipeline(output_dir="./output")
    model_records, manual_corrections = create_conflict_sample()

    print("▶️  Step 1: 导入模型输出（检测冲突）")
    print("-" * 70)
    step1_result = pipeline.step1_import_model_output(
        records=model_records,
        batch_id="batch_conflict_20260607",
        manual_corrections=manual_corrections,
    )
    print(f"检测到冲突: {step1_result['conflict_count']} 处")
    for c in step1_result["conflicts"]:
        print(f"\n  ⚠️  冲突证据:")
        print(f"     FAQ ID: {c['faq_id']}")
        print(f"     字段: {c['field']}")
        print(f"     模型值: {c['model_value'][:60]}...")
        print(f"     人工值: {c['manual_value'][:60]}...")
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
        batch_id="batch_conflict_20260607",
        reviewer="老唐",
        conflict_resolutions=conflict_resolutions,
    )
    print(f"审核人: {step2_result['reviewer']}")
    print(f"已解决冲突: {step2_result['resolved_conflicts']}")
    print()

    print("▶️  Step 3: 生成评测报告")
    print("-" * 70)
    step3_result = pipeline.step3_generate_evaluation_report(batch_id="batch_conflict_20260607")
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
            if detail["history"]:
                print(f"  操作历史:")
                for h in detail["history"]:
                    print(f"    - [{h['time']}] {h['action']}: {h['detail']}")
    print()

    print("=" * 70)
    print("✅  冲突场景演示完成")
    print("=" * 70)
    print()
    print("🔄  可重跑命令:")
    print("   python3 run_conflict_demo.py")
    print()

if __name__ == "__main__":
    main()
