"""命令行入口 - 置信区间样本量试算工具"""

import argparse
import json
import sys
from typing import List

from .models import RecordStatus, SampleRecord, CounterExample
from .workflow import CISampleWorkflow
from demo_data.demo_dataset import (
    WEIGHT_TABLE_DATA,
    SAMPLE_RECORDS_DATA,
    OLD_FORMULA_SCREENSHOT_DATA,
    get_demo_summary,
    DEMO_FLOW_SCRIPT,
)


def _print_records_table(records: List[SampleRecord], title: str = "记录列表", weight_table=None):
    """打印记录表格"""
    print(f"\n{'='*100}")
    print(f"  {title}")
    print(f"{'='*100}")
    print(f"  {'记录ID':<14} {'课程名称':<20} {'老师':<10} {'分数':<8} {'CI下限':<14} {'阈值':<14} {'状态':<14} {'边界标记':<10}")
    print(f"  {'-'*96}")

    status_colors = {
        'normal': '\033[92m',
        'need_review': '\033[93m',
        'abnormal': '\033[91m',
        'manual_fixed': '\033[96m',
        'rerun': '\033[95m',
        'pending': '\033[90m',
    }
    reset_color = '\033[0m'

    for r in records:
        threshold = "-"
        if weight_table:
            rule = weight_table.find_rule(r.score)
            if rule:
                threshold = f"{rule.threshold:.10f}"
        elif r.weight > 0 and r.weight != 1.0:
            threshold = f"{r.weight:.4f}"

        status_color = status_colors.get(r.status.value, '')
        boundary_mark = " ⚠️ 是" if r.boundary_equal_to_threshold else "   否"
        status_display = f"{status_color}{r.status.value:<14}{reset_color}"

        print(f"  {r.record_id:<14} {r.course_name:<20} {r.teacher_name:<10} "
              f"{r.score:<8.1f} {r.ci_lower:<14.10f} {threshold:<14} "
              f"{status_display} {boundary_mark:<10}")
    print(f"{'='*100}\n")


def _print_counter_examples(examples: List[CounterExample], title: str = "反例列表"):
    """打印反例列表"""
    print(f"\n{'='*100}")
    print(f"  {title}")
    print(f"{'='*100}")
    print(f"  {'反例ID':<12} {'关联记录':<14} {'课程':<18} {'类型':<22} {'公式版本':<10} {'状态':<10}")
    print(f"  {'-'*96}")

    for ce in examples:
        status = "✅ 已解决" if ce.resolved else "❌ 待处理"
        print(f"  {ce.case_id:<12} {ce.record_id:<14} {ce.course_name:<18} "
              f"{ce.issue_type:<22} {ce.formula_version:<10} {status:<10}")
        print(f"    描述: {ce.description}")
        if ce.evidence:
            print(f"    证据: {ce.evidence}")
        print()
    print(f"{'='*100}\n")


def _print_record_detail(record: SampleRecord):
    """打印单条记录详情"""
    print(f"\n{'═'*80}")
    print(f"  记录详情: {record.record_id}")
    print(f"{'═'*80}")
    print(f"  课程名称:     {record.course_name}")
    print(f"  任课老师:     {record.teacher_name}")
    print(f"  分数:         {record.score:.1f} 分")
    print(f"  样本量:       {record.sample_size}")
    print(f"  通过人数:     {record.pass_count}")
    print(f"  通过率:       {record.pass_rate:.4%}")
    print(f"  权重:         {record.weight:.2f}")
    print(f"{'─'*80}")
    print(f"  置信区间:     [{record.ci_lower:.10f}, {record.ci_upper:.6f}]")
    print(f"  CI下限:       {record.ci_lower:.12f}")
    print(f"  状态:         {record.status.value}")
    print(f"  边界标记:     {'是 ⚠️' if record.boundary_equal_to_threshold else '否'}")
    print(f"  数据来源:     {record.data_source.value}")
    print(f"  公式版本:     {record.formula_version}")
    print(f"{'─'*80}")
    if record.review_note:
        print(f"  复核备注:     {record.review_note}")
    if record.fix_history:
        print(f"  修正历史:")
        for i, h in enumerate(record.fix_history, 1):
            print(f"    {i}. {h.get('timestamp', '')}: {h.get('before', '')} → {h.get('after', '')}")
            print(f"       操作人: {h.get('operator', '')}, 备注: {h.get('note', '')}")
    print(f"{'═'*80}\n")


def cmd_demo(args):
    """运行完整演示流程"""
    print(get_demo_summary())

    print("\n▶️  开始运行完整演示流程...\n")

    wf = CISampleWorkflow()

    # ===== 第1步：导入评分权重表 =====
    step_info = DEMO_FLOW_SCRIPT[0]
    print(f"\n{'='*80}")
    print(f"  {step_info['step']}: {step_info['action']}")
    print(f"{'='*80}")
    print(f"  描述: {step_info['description']}")
    print(f"  要点: {step_info['key_point']}")
    print()

    weight_table = wf.step1_import_weight_table(WEIGHT_TABLE_DATA)
    print(f"  ✅ 导入成功: {weight_table.name} (版本: {weight_table.version})")
    print(f"  表格ID: {weight_table.table_id}")
    print(f"  规则数量: {len(weight_table.rules)} 条")
    print()
    for rule in weight_table.rules:
        mark = " 🔴 边界值精确匹配" if "边界值" in rule.description else ""
        print(f"    {rule.score_range}分: 权重={rule.weight}, 阈值={rule.threshold:.12f}{mark}")

    input("\n按回车键继续下一步...")

    # ===== 第2步：导入样本记录并试算 =====
    step_info = DEMO_FLOW_SCRIPT[1]
    print(f"\n{'='*80}")
    print(f"  {step_info['step']}: {step_info['action']}")
    print(f"{'='*80}")
    print(f"  描述: {step_info['description']}")
    print(f"  要点: {step_info['key_point']}")
    print()

    records = wf.step2_import_sample_records(SAMPLE_RECORDS_DATA)
    _print_records_table(records, "试算结果", weight_table=weight_table)

    boundary_cases = wf.get_boundary_cases()
    print(f"  🚨 边界值待复核记录: {len(boundary_cases)} 条")
    for r in boundary_cases:
        print(f"     - {r.record_id}: {r.course_name}")
        print(f"       {r.review_note}")

    summary = wf.get_workflow_summary()
    print(f"\n  📊 状态统计: {summary['status_summary']}")

    input("\n按回车键继续下一步...")

    # ===== 第3步：补录旧公式截图 =====
    step_info = DEMO_FLOW_SCRIPT[2]
    print(f"\n{'='*80}")
    print(f"  {step_info['step']}: {step_info['action']}")
    print(f"{'='*80}")
    print(f"  描述: {step_info['description']}")
    print(f"  要点: {step_info['key_point']}")
    print()

    print(f"  📋 补录前反例数量: {len(wf.get_counter_examples())}")
    print()

    counter_example, old_record = wf.step3_process_old_formula_screenshot(
        OLD_FORMULA_SCREENSHOT_DATA,
        target_record_id="REC-2024-003",
    )

    print(f"  ✅ 旧公式截图处理完成")
    print(f"  截图ID: {OLD_FORMULA_SCREENSHOT_DATA['screenshot_id']}")
    print(f"  旧公式: {OLD_FORMULA_SCREENSHOT_DATA['old_formula_text']}")
    print(f"  旧通过率: {OLD_FORMULA_SCREENSHOT_DATA['old_pass_rate']:.4%}")
    print(f"  旧阈值: {OLD_FORMULA_SCREENSHOT_DATA['old_threshold']}")
    print()
    print(f"  🔄 反例列表已自动更新！")
    print(f"  新反例ID: {counter_example.case_id}")
    print(f"  反例类型: {counter_example.issue_type}")
    print(f"  反例描述: {counter_example.description}")
    print()
    print(f"  📋 补录后反例数量: {len(wf.get_counter_examples())}")

    _print_counter_examples(wf.get_counter_examples(), "更新后的反例列表")

    all_records = wf.get_all_records()
    _print_records_table(all_records, "补录旧口径后的完整记录列表", weight_table=weight_table)

    input("\n按回车键继续下一步...")

    # ===== 第4步：人工修正边界案例 =====
    step_info = DEMO_FLOW_SCRIPT[3]
    print(f"\n{'='*80}")
    print(f"  {step_info['step']}: {step_info['action']}")
    print(f"{'='*80}")
    print(f"  描述: {step_info['description']}")
    print(f"  要点: {step_info['key_point']}")
    print()

    boundary_record = wf.get_record("REC-2024-002")
    print(f"  📋 修正前记录状态:")
    _print_record_detail(boundary_record)

    fixed_record = wf.manual_fix_record(
        record_id="REC-2024-002",
        operator="任课老师刘主任",
        new_status=RecordStatus.MANUAL_FIXED,
        note="2024期末考班级整体评分呈正态分布，中位数82分，确认教学效果达标，边界值情况予以通过",
    )

    print(f"  ✅ 人工修正完成")
    print(f"  📋 修正后记录状态:")
    _print_record_detail(fixed_record)

    input("\n按回车键继续下一步...")

    # ===== 第5步：重跑旧口径记录 =====
    step_info = DEMO_FLOW_SCRIPT[4]
    print(f"\n{'='*80}")
    print(f"  {step_info['step']}: {step_info['action']}")
    print(f"{'='*80}")
    print(f"  描述: {step_info['description']}")
    print(f"  要点: {step_info['key_point']}")
    print()

    old_record = wf.get_record("REC-2024-003-old")
    print(f"  📋 重跑前旧口径记录:")
    _print_record_detail(old_record)

    print(f"  🔧 修正旧口径统计错误：原通过人数应为79人（原统计漏算6名缓考通过学生）")
    old_record.pass_count = 79
    old_record.pass_rate = 79 / 100

    rerun_record_obj = wf.rerun_single_record(
        record_id="REC-2024-003-old",
        operator="运营规划阿岚",
        note="修正统计口径错误，补录6名缓考通过学生后重跑",
    )

    print(f"  ✅ 重跑完成")
    print(f"  📋 重跑后记录状态:")
    _print_record_detail(rerun_record_obj)

    # ===== 最终总结 =====
    print(f"\n{'═'*80}")
    print(f"  🎉 演示流程完成！最终结果汇总")
    print(f"{'═'*80}")

    final_summary = wf.get_workflow_summary()
    print(json.dumps(final_summary, ensure_ascii=False, indent=2))

    all_final_records = wf.get_all_records()
    _print_records_table(all_final_records, "最终记录列表", weight_table=weight_table)

    counter_examples = wf.get_counter_examples()
    _print_counter_examples(counter_examples, "最终反例列表")

    print(f"\n{'═'*80}")
    print(f"  📚 三种处理结果对比（给新人讲解用）")
    print(f"{'═'*80}")
    print(f"  {'记录':<20} {'初始状态':<16} {'最终状态':<16} {'处理方式':<20}")
    print(f"  {'─'*72}")
    print(f"  {'REC-2024-001 (顺利)':<20} {'NORMAL':<16} {'NORMAL':<16} {'直接通过':<20}")
    print(f"  {'REC-2024-002 (边界)':<20} {'NEED_REVIEW ⚠️':<16} {'MANUAL_FIXED':<16} {'任课老师复核':<20}")
    print(f"  {'REC-2024-003 (旧口径)':<20} {'NORMAL':<16} {'NORMAL':<16} {'补录截图→反例→重跑':<20}")
    print(f"  {'REC-2024-003-old':<20} {'ABNORMAL':<16} {'RERUN→NORMAL':<16} {'修正统计→重跑':<20}")
    print(f"{'═'*80}\n")

    print("""
    💡 给运营规划阿岚的小贴士：
    1. 开会前10分钟，直接运行 `python3 -m ci_sample_calc demo` 即可展示完整流程
    2. 边界值等于阈值会自动标⚠️，不用再翻评分权重表查
    3. 补录旧公式截图后，反例列表自动更新，无需手动维护
    4. 演示数据是小而真的教学案例，给新人讲一遍就懂
    """)


def cmd_import_weight(args):
    """导入评分权重表"""
    wf = CISampleWorkflow()
    if args.demo:
        table = wf.step1_import_weight_table(WEIGHT_TABLE_DATA)
    elif args.file:
        source = "csv" if args.file.endswith(".csv") else "json"
        table = wf.step1_import_weight_table({}, source=source, file_path=args.file)
    else:
        print("❌ 请指定 --demo 或 --file 参数")
        return

    print(f"✅ 导入成功: {table.name} (版本: {table.version})")
    for rule in table.rules:
        print(f"  {rule.score_range}: 权重={rule.weight}, 阈值={rule.threshold}")


def cmd_calculate(args):
    """计算样本记录"""
    wf = CISampleWorkflow()
    wf.step1_import_weight_table(WEIGHT_TABLE_DATA)
    weight_table = wf.weight_manager.get_active_table()

    if args.demo:
        records = wf.step2_import_sample_records(SAMPLE_RECORDS_DATA)
    else:
        print("❌ 请指定 --demo 参数")
        return

    _print_records_table(records, weight_table=weight_table)

    boundary_cases = wf.get_boundary_cases()
    if boundary_cases:
        print(f"\n⚠️  边界值待复核记录 ({len(boundary_cases)} 条):")
        for r in boundary_cases:
            print(f"  - {r.record_id}: {r.course_name}")
            print(f"    {r.review_note}")


def cmd_screenshot(args):
    """补录旧公式截图"""
    wf = CISampleWorkflow()
    wf.step1_import_weight_table(WEIGHT_TABLE_DATA)
    wf.step2_import_sample_records(SAMPLE_RECORDS_DATA)

    before_count = len(wf.get_counter_examples())
    print(f"📋 补录前反例数量: {before_count}")

    counter_example, old_record = wf.step3_process_old_formula_screenshot(
        OLD_FORMULA_SCREENSHOT_DATA,
        target_record_id=args.record_id or "REC-2024-003",
    )

    after_count = len(wf.get_counter_examples())
    print(f"✅ 补录完成，反例数量: {after_count} (+{after_count - before_count})")
    print(f"新反例: {counter_example.case_id} - {counter_example.description}")

    _print_counter_examples(wf.get_counter_examples())


def cmd_list(args):
    """列出记录或反例"""
    wf = CISampleWorkflow()
    wf.step1_import_weight_table(WEIGHT_TABLE_DATA)
    wf.step2_import_sample_records(SAMPLE_RECORDS_DATA)
    wf.step3_process_old_formula_screenshot(
        OLD_FORMULA_SCREENSHOT_DATA,
        target_record_id="REC-2024-003",
    )
    weight_table = wf.weight_manager.get_active_table()

    if args.type == "records":
        records = wf.get_all_records()
        if args.status:
            records = [r for r in records if r.status.value == args.status]
        if args.boundary:
            records = [r for r in records if r.boundary_equal_to_threshold]
        _print_records_table(records, weight_table=weight_table)
    elif args.type == "counter-examples":
        examples = wf.get_counter_examples(unresolved_only=args.unresolved)
        _print_counter_examples(examples)
    elif args.type == "boundary":
        boundary = wf.get_boundary_cases()
        _print_records_table(boundary, "待任课老师复核的边界值记录", weight_table=weight_table)


def cmd_show(args):
    """显示单条记录详情"""
    wf = CISampleWorkflow()
    wf.step1_import_weight_table(WEIGHT_TABLE_DATA)
    wf.step2_import_sample_records(SAMPLE_RECORDS_DATA)
    wf.step3_process_old_formula_screenshot(
        OLD_FORMULA_SCREENSHOT_DATA,
        target_record_id="REC-2024-003",
    )

    record = wf.get_record(args.record_id)
    if record:
        _print_record_detail(record)
    else:
        print(f"❌ 未找到记录: {args.record_id}")


def cmd_manual_fix(args):
    """人工修正记录"""
    wf = CISampleWorkflow()
    wf.step1_import_weight_table(WEIGHT_TABLE_DATA)
    wf.step2_import_sample_records(SAMPLE_RECORDS_DATA)

    record = wf.manual_fix_record(
        record_id=args.record_id,
        operator=args.operator,
        new_status=RecordStatus(args.status),
        note=args.note,
    )
    print(f"✅ 修正完成: {record.record_id} → {record.status.value}")
    _print_record_detail(record)


def cmd_rerun(args):
    """重跑单条记录"""
    wf = CISampleWorkflow()
    wf.step1_import_weight_table(WEIGHT_TABLE_DATA)
    wf.step2_import_sample_records(SAMPLE_RECORDS_DATA)

    record = wf.rerun_single_record(
        record_id=args.record_id,
        operator=args.operator,
        note=args.note,
    )
    print(f"✅ 重跑完成: {record.record_id} → {record.status.value}")
    _print_record_detail(record)


def cmd_summary(args):
    """显示工作流摘要"""
    wf = CISampleWorkflow()
    wf.step1_import_weight_table(WEIGHT_TABLE_DATA)
    wf.step2_import_sample_records(SAMPLE_RECORDS_DATA)
    wf.step3_process_old_formula_screenshot(
        OLD_FORMULA_SCREENSHOT_DATA,
        target_record_id="REC-2024-003",
    )

    summary = wf.get_workflow_summary()
    print(json.dumps(summary, ensure_ascii=False, indent=2))


def main():
    parser = argparse.ArgumentParser(
        prog="ci-sample-calc",
        description="置信区间样本量试算工具 - 运营规划阿岚专用",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python3 -m ci_sample_calc demo                  # 一键运行完整演示流程（开会前10分钟用）
  python3 -m ci_sample_calc list boundary          # 查看待复核的边界值记录
  python3 -m ci_sample_calc list counter-examples  # 查看反例列表
  python3 -m ci_sample_calc show REC-2024-002     # 查看单条记录详情
  python3 -m ci_sample_calc screenshot             # 补录旧公式截图
        """,
    )

    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    # demo 命令
    demo_parser = subparsers.add_parser("demo", help="运行完整演示流程")
    demo_parser.set_defaults(func=cmd_demo)

    # import-weight 命令
    import_parser = subparsers.add_parser("import-weight", help="导入评分权重表")
    import_parser.add_argument("--demo", action="store_true", help="使用演示数据")
    import_parser.add_argument("--file", help="从CSV或JSON文件导入")
    import_parser.set_defaults(func=cmd_import_weight)

    # calculate 命令
    calc_parser = subparsers.add_parser("calculate", help="计算样本记录")
    calc_parser.add_argument("--demo", action="store_true", help="使用演示数据")
    calc_parser.set_defaults(func=cmd_calculate)

    # screenshot 命令
    shot_parser = subparsers.add_parser("screenshot", help="补录旧公式截图")
    shot_parser.add_argument("--record-id", help="目标记录ID")
    shot_parser.set_defaults(func=cmd_screenshot)

    # list 命令
    list_parser = subparsers.add_parser("list", help="列出记录或反例")
    list_parser.add_argument(
        "type",
        choices=["records", "counter-examples", "boundary"],
        help="列出类型",
    )
    list_parser.add_argument("--status", help="按状态过滤")
    list_parser.add_argument("--boundary", action="store_true", help="只显示边界记录")
    list_parser.add_argument("--unresolved", action="store_true", help="只显示未解决反例")
    list_parser.set_defaults(func=cmd_list)

    # show 命令
    show_parser = subparsers.add_parser("show", help="显示记录详情")
    show_parser.add_argument("record_id", help="记录ID")
    show_parser.set_defaults(func=cmd_show)

    # manual-fix 命令
    fix_parser = subparsers.add_parser("manual-fix", help="人工修正记录")
    fix_parser.add_argument("record_id", help="记录ID")
    fix_parser.add_argument("--operator", required=True, help="操作人")
    fix_parser.add_argument("--status", required=True, help="新状态")
    fix_parser.add_argument("--note", required=True, help="修正备注")
    fix_parser.set_defaults(func=cmd_manual_fix)

    # rerun 命令
    rerun_parser = subparsers.add_parser("rerun", help="重跑记录")
    rerun_parser.add_argument("record_id", help="记录ID")
    rerun_parser.add_argument("--operator", required=True, help="操作人")
    rerun_parser.add_argument("--note", help="重跑备注")
    rerun_parser.set_defaults(func=cmd_rerun)

    # summary 命令
    summary_parser = subparsers.add_parser("summary", help="显示工作流摘要")
    summary_parser.set_defaults(func=cmd_summary)

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    args.func(args)


if __name__ == "__main__":
    main()
