import os
import sys
import json
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config

from data_processor import MarginDataProcessor
from diff_tracker import DiffTracker


def step1_import_screenshot(data_file, run_tag, tracker):
    print("\n" + "="*70)
    print(f"【步骤1/3】除权日截图第一次导入 [{run_tag}]")
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
        os.path.join(config.PROCESSED_DATA_DIR, f'processed_step1_import_{run_tag}.csv')
    )

    tracker.register_run(f'[{run_tag}] 步骤1-第一次导入', data_file, processor)

    print(f"\n✓ 步骤1完成，输出: {os.path.basename(output_file)}")
    print_step_result(processor, f"{run_tag} - 导入后初始状态")

    return processor, output_file


def step2_supplement_tax_remark(data_file, run_tag, tracker):
    print("\n" + "="*70)
    print(f"【步骤2/3】投研助理小周补看税费率备注 [{run_tag}]")
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
    corrected = processor.detect_tax_rate_issue()

    if corrected:
        print(f"\n  📝 补录修正业务: {', '.join(corrected)}")
        for biz_id in corrected:
            for r in processor.records:
                if r['业务号'] == biz_id:
                    for h in r['_history']:
                        if h.get('action') == '税费率补录修正':
                            print(f"     业务号 {biz_id}: {h.get('old_value','?')} → {h.get('new_value','?')} | 差额 {h.get('diff','?')} | 备注: {h.get('remark','')}")

    processor.mark_normal_records()

    output_file = processor.save_processed_data(
        os.path.join(config.PROCESSED_DATA_DIR, f'processed_step2_supplement_{run_tag}.csv')
    )

    tracker.register_run(f'[{run_tag}] 步骤2-补看税费率备注', data_file, processor)
    tracker.compare_runs()

    print(f"\n✓ 步骤2完成，输出: {os.path.basename(output_file)}")
    print_step_result(processor, f"{run_tag} - 补录税费率后状态")

    return processor, output_file


def step3_update_diff_list(run_tag, tracker):
    print("\n" + "="*70)
    print(f"【步骤3/3】差异清单更新 [{run_tag}]")
    print("="*70)

    diff_report = tracker.generate_diff_report(run_tag=run_tag)
    history_file = tracker.save_history(run_tag=run_tag)

    if tracker.diff_list:
        last_diff = tracker.diff_list[-1]
        print(f"✓ 差异清单已更新，共发现 {len(last_diff['diffs'])} 处差异:")
        for diff in last_diff['diffs']:
            amount = f"{diff['差额']:+.2f}" if diff['差额'] is not None else '-'
            print(f"  - {diff['业务号']}: {diff['差异类型']} | {diff['原值']} → {diff['现值']} ({amount})")
    else:
        print("✓ 无差异记录（仅首次导入）")

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


def run_single_workflow(data_file, run_tag, tracker):
    print("\n" + "#"*70)
    print(f"# 券商两融维保提醒 - 流程演示 [{run_tag}]")
    print("#"*70)
    print(f"\n业务日期: {config.BUSINESS_DATE}")
    print(f"除权日期: {config.EX_RIGHTS_DATE}")
    print(f"印花税税率: 新={config.TAX_RATE_NEW*100:.4}%, 旧={config.TAX_RATE_OLD*100:.4}%")
    print(f"税率备注: {config.TAX_RATE_REMARK}")

    processor1, _ = step1_import_screenshot(data_file, run_tag, tracker)
    processor2, _ = step2_supplement_tax_remark(data_file, run_tag, tracker)
    diff_report, history_file = step3_update_diff_list(run_tag, tracker)

    print("\n" + "-"*70)
    print(f"【{run_tag} 流程总结】")
    print("-"*70)
    print(f"  数据文件: {os.path.basename(data_file)}")
    print(f"  差异报告: {os.path.basename(diff_report)}")
    print(f"  历史记录: {os.path.basename(history_file)}")
    print(f"  处理时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    print(f"\n🔍 [{run_tag}] 三种处理结果对比:")
    for detail in processor2.get_summary()['details']:
        biz_type = "正常记录" if detail['biz_id'] in config.NORMAL_BIZ_IDS else \
                   "拆分行记录" if detail['biz_id'] in config.SPLIT_BIZ_IDS else \
                   "补录旧口径"
        print(f"  [{biz_type}] {detail['biz_id']}: {detail['status']} | "
              f"印花税 {detail['total_tax']:.2f} | 税率 {detail['tax_rate_used']*100:.4}%")

    return tracker


def run_combined_workflow():
    print("\n" + "#"*70)
    print("# 券商两融维保提醒 - 三种材料合并运行")
    print("#"*70)
    print(f"\n业务日期: {config.BUSINESS_DATE}")
    print(f"除权日期: {config.EX_RIGHTS_DATE}")
    print(f"印花税税率: 新={config.TAX_RATE_NEW*100:.4}%, 旧={config.TAX_RATE_OLD*100:.4}%")
    print(f"税率备注: {config.TAX_RATE_REMARK}")

    tracker = DiffTracker()

    materials = [
        ('normal', os.path.join(config.RAW_DATA_DIR, 'broker_margin_data.csv'), '正常材料'),
        ('wrong', os.path.join(config.RAW_DATA_DIR, 'broker_margin_data_wrong_tax.csv'), '错口径材料'),
        ('supplement', os.path.join(config.RAW_DATA_DIR, 'broker_margin_data.csv'), '补录材料'),
    ]

    processors = {}
    for tag, data_file, label in materials:
        run_tag = tag
        processor1, _ = step1_import_screenshot(data_file, run_tag, tracker)
        processor2, _ = step2_supplement_tax_remark(data_file, run_tag, tracker)
        processors[tag] = processor2

    tracker.cross_material_compare()

    diff_report = tracker.generate_combined_report()
    history_file = tracker.save_combined_history()

    print("\n" + "="*70)
    print("【三种材料合并运行总结】")
    print("="*70)

    print("\n📊 各材料处理结果对比表:")
    print(f"  {'业务号':<18} {'类型':<10} {'正常材料':<18} {'错口径材料':<18} {'补录材料':<18}")
    print("  " + "-"*82)

    all_biz_ids = list(config.NORMAL_BIZ_IDS + config.SPLIT_BIZ_IDS + config.SUPPLEMENT_BIZ_IDS)
    for biz_id in all_biz_ids:
        biz_type = "正常记录" if biz_id in config.NORMAL_BIZ_IDS else \
                   "拆分行记录" if biz_id in config.SPLIT_BIZ_IDS else \
                   "补录旧口径"

        row = f"  {biz_id:<18} {biz_type:<10}"
        for tag in ['normal', 'wrong', 'supplement']:
            proc = processors[tag]
            for detail in proc.get_summary()['details']:
                if detail['biz_id'] == biz_id:
                    row += f" {detail['status']:<8} 税{detail['total_tax']:.0f}({detail['tax_rate_used']*100:.2f}%) "
                    break
        print(row)

    print(f"\n📁 合并差异报告: {os.path.basename(diff_report)}")
    print(f"📁 合并历史记录: {os.path.basename(history_file)}")

    print("\n📋 各材料独立处理结果文件:")
    for tag, _, _ in materials:
        step1_file = f"processed_step1_import_{tag}.csv"
        step2_file = f"processed_step2_supplement_{tag}.csv"
        print(f"  [{tag}] {step1_file}")
        print(f"  [{tag}] {step2_file}")

    print("\n🔄 重跑命令:")
    print("  python3 scripts/run_workflow.py combined   # 三种材料合并运行（推荐）")
    print("  python3 scripts/run_workflow.py normal     # 仅正常材料")
    print("  python3 scripts/run_workflow.py wrong      # 仅错口径材料")
    print("  python3 scripts/run_workflow.py supplement # 仅补录材料")
    print("  bash run_quick.sh                          # 快速全量重跑")
    print("  bash run_all.sh                            # 交互式分步演示")

    return tracker


if __name__ == '__main__':
    mode = sys.argv[1] if len(sys.argv) > 1 else 'combined'

    if mode == 'combined':
        run_combined_workflow()
    elif mode == 'normal':
        data_file = os.path.join(config.RAW_DATA_DIR, 'broker_margin_data.csv')
        tracker = DiffTracker()
        run_single_workflow(data_file, 'normal', tracker)
    elif mode == 'wrong':
        data_file = os.path.join(config.RAW_DATA_DIR, 'broker_margin_data_wrong_tax.csv')
        tracker = DiffTracker()
        run_single_workflow(data_file, 'wrong', tracker)
    elif mode == 'supplement':
        data_file = os.path.join(config.RAW_DATA_DIR, 'broker_margin_data.csv')
        tracker = DiffTracker()
        run_single_workflow(data_file, 'supplement', tracker)
    else:
        print("用法: python run_workflow.py [combined|normal|wrong|supplement]")
        print("  combined   - 三种材料合并运行，生成合并报告（推荐）")
        print("  normal     - 仅正常材料")
        print("  wrong      - 仅错口径材料")
        print("  supplement - 仅补录材料")
