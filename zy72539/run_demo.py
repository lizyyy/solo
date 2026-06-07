#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from demo_data import create_demo_records
from processor import AttributionProcessor


def main():
    print("\n" + "=" * 70)
    print("         模型输出成本归因 - 演示环境")
    print("=" * 70)
    
    records = create_demo_records()
    processor = AttributionProcessor()
    
    print("\n老唐：各位安全审核的同事，今天十分钟，我把'模型输出成本归因'")
    print("      里最容易扯皮的三种情况给大家过一遍，省得会后翻灰度批次。\n")
    
    input("按回车开始第一步：灰度批次导入 → ")
    print(processor.step1_import_gray_batch(records))
    
    input("\n按回车继续第二步：补看标注员留言 → ")
    print(processor.step2_review_annotator_messages(records))
    
    input("\n按回车继续第三步：评测报告更新 → ")
    print(processor.step3_update_evaluation_report(records))
    
    input("\n按回车查看完整评测报告 → ")
    print(processor.generate_evaluation_report(records))
    
    input("\n按回车查看历史操作追踪 → ")
    print(processor.generate_history_report(records))
    
    print("\n" + "=" * 70)
    print("老唐总结：")
    print("  1. 顺利记录直接归档，别浪费时间")
    print("  2. 人工改判被下一次批跑覆盖的，别急着归正常，留给你们复核")
    print("  3. 标注员留言里挖出来的旧口径，补录后要同步更新评测报告")
    print("=" * 70)
    print("\n演示结束，有问题现在问。")


if __name__ == "__main__":
    main()
