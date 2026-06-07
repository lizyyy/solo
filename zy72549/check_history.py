#!/usr/bin/env python3
import sys
sys.path.insert(0, '.')

from faq_cleaner.pipeline import CleaningPipeline
from faq_cleaner.sample_data import create_sample_data

def main():
    pipeline = CleaningPipeline(output_dir="./output")
    model_records, manual_corrections, supplement_records = create_sample_data()
    pipeline.step1_import_model_output(model_records, "batch_20260607", manual_corrections)
    pipeline.supplement_records("batch_20260607", supplement_records)

    print("=" * 70)
    print("FAQ 历史记录复盘演示")
    print("=" * 70)

    for faq_id in ["faq_001", "faq_002", "faq_003"]:
        history = pipeline.get_history(faq_id)
        if history:
            print(f"\n📜  {faq_id} 的完整历史:")
            print(f"   当前状态: {history['current_status']}")
            if history["remarks"]:
                print(f"   备注 ({len(history['remarks'])} 条):")
                for i, remark in enumerate(history["remarks"], 1):
                    print(f"     {i}. {remark}")
            if history["history"]:
                print(f"   操作轨迹 ({len(history['history'])} 步):")
                for h in history["history"]:
                    print(f"     - [{h['time']}] {h['action']}: {h['detail']}")

    print()
    print("=" * 70)
    print("🔄  复盘命令:")
    print("   python3 check_history.py")
    print("=" * 70)

if __name__ == "__main__":
    main()
