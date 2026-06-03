import os
import sys
import json
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config

from data_processor import MarginDataProcessor
from diff_tracker import DiffTracker


def step1_import_screenshot(data_file, tracker):
    """第一步：除权日截图第一次导入"""
    print("\n" + "="*70)
    print("【步骤1/3】除权日截图第一次导入")
    print("="*70)

    screenshot_file = os.path.join(config.SCREENSHOT_DIR, 'ex_rights_20260601.json')
    if os.path.exists(screenshot_file):
        with open(screenshot_file, 'r', encoding='utf-8') as f:
            screenshot = json.load(f)
        print(f"✓ 已导入除权日截图: {screenshot['screenshot_id']}")
        print(f"  截图时间: {screenshot['capture_time']}")
        print(f"  除权日期: {screenshot['ex_rights_date']}")
        stocks_desc = ', '.join([f"{s['name']}({s['code']})" for s in screenshot['stocks']])
        print(f"  包含标的: {stocks_desc}")

    processor = MarginDataProcessor(data_file)
    processor.detect_split_records()
    processor.mark_normal_records()

    output_file = processor.save_processed_data(
        os.path.join(config.PROCESSED_DATA_DIR, 'processed_step1_import.csv')
    )

    tracker.register_run('步骤1-第一次导入', data_file, processor)

    print(f"\n✓ 步骤1完成，输出: {os.path.basename(output_file)}")
    print_step_result(processor, "导入后初始状态")

    return processor, output_file


def step2_supplement_tax_remark(data_file, tracker):
    """第二步：投研助理小周补看税费率备注"""
    print("\n" + "="*70)
    print("【步骤2/3】投研助理小周补看税费率备注")
    print("="*70)

    remark_file = os.path.join(config.RAW_DATA_DIR, 'tax_rate_remark.txt')
    if os.path.exists(remark_file):
        with open(remark_file, 'r', encoding='utf-8') as f:
            remark_content = f.read()
        print("✓ 已读取税费率备注文件:")
        for line in remark_content.split('\n')[:6]:
            if line.strip():
                print(f"  {line}")
        print("  ...")

    processor = MarginDataProcessor(data_file)
    processor.detect_split_records()
    processor.apply_manual_correction()
    processor.detect_tax_rate_issue()
    processor.mark_normal_records()

    output_file = processor.save_processed_data(
        os.path.join(config.PROCESSED_DATA_DIR, 'processed_step2_supplement.csv')
    )

    tracker.register_run('步骤2-补看税费率备注', data_file, processor)
    tracker.compare_runs()

    print(f"\n✓ 步骤2完成，输出: {os.path.basename(output_file)}")
    print_step_result(processor, "补录税费率后状态")

    return processor, output_file


def step3_update_diff_list(tracker):
    """第三步：差异清单更新"""
    print("\n" + "="*70)
    print("【步骤3/3】差异清单更新")
    print("="*70)

    diff_report = tracker.generate_diff_report()
    history_file = tracker.save_history()

    last_diff = tracker.diff_list[-1]
    print(f"✓ 差异清单已更新，共发现 {len(last_diff['diffs'])} 处差异:")
    for diff in last_diff['diffs']:
        amount = f"{diff['差额']:+.2f}" if diff['差额'] is not None else '-'
        print(f"  - {diff['业务号']}: {diff['差异类型']} | {diff['原值']} → {diff['现值']} ({amount})")

    print(f"\n✓ 步骤3完成")
    print(f"  差异报告: {os.path.basename(diff_report)}")
    print(f"  历史记录: {os.path.basename(history_file)}")

    return diff_report, history_file


def print_step_result(processor, title):
    summary = processor.get_summary()
    print(f"\n【{title}】")
    print(f"  总业务数: {summary['total_biz']} 笔，{summary['total_records']} 条记录")
    print(f"  正常: {summary['normal']} 笔 | 拆分行待复核: {summary['split_review']} 笔 | 已补录: {summary['supplemented']} 笔")
    for detail in summary['details']:
        status_icon = "✅" if detail['status'] == '正常' else ("⚠️ " if '待复核' in detail['status'] else "📝")
        print(f"  {status_icon} {detail['biz_id']}: {detail['status']} | "
              f"印花税 {detail['total_tax']:.2f} ({detail['tax_rate_used']*100:.4}%) | "
              f"历史操作 {detail['history_records']} 次")


def run_full_workflow(data_file, run_name):
    """运行完整三步流程"""
    print("\n" + "#"*70)
    print(f"# 券商两融维保提醒 - 完整流程演示 [{run_name}]")
    print("#"*70)
    print(f"\n业务日期: {config.BUSINESS_DATE}")
    print(f"除权日期: {config.EX_RIGHTS_DATE}")
    print(f"印花税税率: 新={config.TAX_RATE_NEW*100:.4}%, 旧={config.TAX_RATE_OLD*100:.4}%")
    print(f"税率备注: {config.TAX_RATE_REMARK}")

    tracker = DiffTracker()

    processor1, _ = step1_import_screenshot(data_file, tracker)
    processor2, _ = step2_supplement_tax_remark(data_file, tracker)
    diff_report, history_file = step3_update_diff_list(tracker)

    print("\n" + "="*70)
    print("【流程总结】")
    print("="*70)
    print(f"  数据文件: {os.path.basename(data_file)}")
    print(f"  差异报告: {os.path.basename(diff_report)}")
    print(f"  历史记录: {os.path.basename(history_file)}")
    print(f"  处理时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    print("\n🔍 三种处理结果对比:")
    for detail in processor2.get_summary()['details']:
        biz_type = "正常记录" if detail['biz_id'] in config.NORMAL_BIZ_IDS else \
                   "拆分行记录" if detail['biz_id'] in config.SPLIT_BIZ_IDS else \
                   "补录旧口径"
        print(f"  [{biz_type}] {detail['biz_id']}: {detail['status']} | "
              f"印花税 {detail['total_tax']:.2f} | 税率 {detail['tax_rate_used']*100:.4}%")

    return tracker


if __name__ == '__main__':
    mode = sys.argv[1] if len(sys.argv) > 1 else 'normal'

    if mode == 'normal':
        data_file = os.path.join(config.RAW_DATA_DIR, 'broker_margin_data.csv')
        run_full_workflow(data_file, '正常材料')
    elif mode == 'wrong':
        data_file = os.path.join(config.RAW_DATA_DIR, 'broker_margin_data_wrong_tax.csv')
        run_full_workflow(data_file, '错口径材料')
    elif mode == 'supplement':
        data_file = os.path.join(config.RAW_DATA_DIR, 'broker_margin_data.csv')
        run_full_workflow(data_file, '补录材料')
    else:
        print("用法: python run_workflow.py [normal|wrong|supplement]")
        print("  normal    - 使用正常材料运行")
        print("  wrong     - 使用错口径材料运行")
        print("  supplement - 使用补录材料运行")
