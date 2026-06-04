#!/usr/bin/env python3
"""完整演示流程 - 模拟小祁从第一次导入到最终复盘的全过程"""

import sys
import os
import time
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from models import ProcessingType, RecordStatus
from store import DataStore
from importer import DataImporter
from annotation import AnnotationManager
from grouping import GroupingEngine
from auditor import AuditExporter
from demo_data import DemoDataGenerator


def print_header(title):
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70)


def print_step(step_num, description):
    print(f"\n📌 步骤 {step_num}: {description}")
    print("-" * 50)


def simulate_full_demo():
    """模拟完整的业务运营催结果场景"""

    data_dir = "data"
    store = DataStore(data_dir)
    importer = DataImporter(store)
    annotation_manager = AnnotationManager(store)
    grouping_engine = GroupingEngine(store)
    auditor = AuditExporter(store)

    print_header("🌙 距离度量门店分群 - 业务运营催结果场景模拟")
    print("\n背景：晚上22:00，业务运营催结果，小祁只能翻旧公式截图...")
    print("      但有一条记录同一学生交了两版答案，结论不敢直接发...\n")

    time.sleep(1)

    # ========== 第一部分：初始化演示数据 ==========
    print_header("第一部分：初始化演示数据")
    generator = DemoDataGenerator(data_dir)
    demo_results = generator.generate_all()

    records = store.get_all_records()
    smooth = [r for r in records if r.processing_type == ProcessingType.SMOOTH][0]
    duplicate = [r for r in records if r.processing_type == ProcessingType.DUPLICATE][0]
    old_std = [r for r in records if r.processing_type == ProcessingType.OLD_STANDARD_SUPPLEMENT][0]

    print(f"\n✅ 三条演示记录已创建:")
    print(f"  1. {smooth.store_name} ({smooth.record_id}) - 顺利记录")
    print(f"  2. {duplicate.store_name} ({duplicate.record_id}) - 同一学生两版答案 ⚠️")
    print(f"  3. {old_std.store_name} ({old_std.record_id}) - 旧口径补录")

    time.sleep(1)

    # ========== 第二部分：旧公式截图第一次导入 ==========
    print_header("第二部分：旧公式截图第一次导入（小祁操作）")

    for idx, record in enumerate([smooth, duplicate, old_std], 1):
        print_step(idx, f"导入旧公式截图 - {record.store_name}")
        screenshot = record.screenshot_refs[0]
        print(f"  📸 截图ID: {screenshot.screenshot_id}")
        print(f"  📝 描述: {screenshot.description}")
        print(f"  🔢 公式: {screenshot.formula_text}")
        print(f"  ⏰ 导入时间: {screenshot.imported_at.strftime('%H:%M:%S')}")

    time.sleep(1)

    # ========== 第三部分：导入学生答案，检测重复 ==========
    print_header("第三部分：导入学生答案，自动检测同一学生两版答案")

    print_step(1, f"导入{smooth.store_name}的学生答案（无重复）")
    ans = smooth.student_answers[0]
    print(f"  👤 学生: {ans.student_name} (v{ans.version})")
    print(f"  📊 数据: 人流={ans.content['foot_traffic']}, 销售额={ans.content['sales_amount']}, 复购={ans.content['customer_loyalty']}")
    print(f"  ✅ 状态: {smooth.status.value}")
    print(f"  📝 误差说明: {smooth.error_explanation.current_text}")

    print_step(2, f"导入{duplicate.store_name}的学生答案（同一学生两版 ⚠️）")
    for i, ans in enumerate(duplicate.student_answers, 1):
        dup_mark = " ⚠️ 重复" if ans.is_duplicate else ""
        print(f"  👤 版本{i}: {ans.student_name} (v{ans.version}){dup_mark}")
        print(f"     📊 人流={ans.content['foot_traffic']}, 销售额={ans.content['sales_amount']}, 复购={ans.content['customer_loyalty']}")
        print(f"     📝 备注: {ans.content['notes']}")
        print(f"     ⏰ 提交时间: {ans.submission_time.strftime('%H:%M:%S')}")
    print(f"\n  ⚠️  系统检测到同一学生交了{len(duplicate.get_duplicate_answers())}版答案")
    print(f"  🔴 当前状态: {duplicate.status.value}")
    print(f"  📝 误差说明: {duplicate.error_explanation.current_text}")
    print(f"  💡 关键细节: 不自动归正常，留给业务运营复核")

    print_step(3, f"导入{old_std.store_name}的学生答案（无重复）")
    ans = old_std.student_answers[0]
    print(f"  👤 学生: {ans.student_name} (v{ans.version})")
    print(f"  📊 数据: 人流={ans.content['foot_traffic']}, 销售额={ans.content['sales_amount']}, 复购={ans.content['customer_loyalty']}")

    time.sleep(1)

    # ========== 第四部分：标记待复核 ==========
    print_header("第四部分：标记待业务运营复核（小祁操作）")

    print_step(1, f"标记{duplicate.store_name}待业务运营复核")
    print(f"  🔄 状态变更: {RecordStatus.DUPLICATE_DETECTED.value} → {RecordStatus.PENDING_REVIEW.value}")
    print(f"  📝 误差说明: {duplicate.error_explanation.current_text}")
    print(f"  ⏸️  分群被阻止: 待复核记录不能运行分群")

    time.sleep(1)

    # ========== 第五部分：第一次分群 ==========
    print_header("第五部分：第一次分群（小祁操作）")

    print_step(1, f"运行{smooth.store_name}分群")
    smooth_result = store.get_grouping_result(smooth.record_id)
    print(f"  🎯 分群结果: {smooth_result.final_group}")
    print(f"  📈 置信度: {smooth_result.confidence:.2%}")
    print(f"  ✅ 状态: {smooth.status.value}")

    print_step(2, f"尝试运行{duplicate.store_name}分群（被阻止）")
    print(f"  ⏸️  分群被阻止")
    print(f"  ❌ 原因: {duplicate.status.value}")
    print(f"  📝 误差说明: {duplicate.error_explanation.current_text}")

    print_step(3, f"运行{old_std.store_name}第一次分群")
    old_std_result_first = store.get_grouping_result(old_std.record_id)
    print(f"  🎯 初始分群: {old_std_result_first.final_group}")
    print(f"  📈 置信度: {old_std_result_first.confidence:.2%}")

    time.sleep(1)

    # ========== 第六部分：小祁补看老师批注 ==========
    print_header("第六部分：小祁补看老师批注，误差说明更新")

    print_step(1, f"补录{old_std.store_name}的李老师批注")
    ann = old_std.annotations[0]
    print(f"  👨‍🏫 老师: {ann.teacher_name}")
    print(f"  💬 批注: {ann.content}")
    print(f"  📌 旧口径参考: {ann.old_standard_reference}")
    print(f"  🔄 误差说明更新: {ann.error_explanation_update}")

    print_step(2, f"查看误差说明历史")
    for i, hist in enumerate(old_std.error_explanation.history, 1):
        print(f"  版本{i}:")
        print(f"    旧值: {hist['old_text']}")
        print(f"    新值: {hist['new_text']}")
        print(f"    更新人: {hist['updated_by']}")

    print_step(3, f"人工修正 - 应用旧口径")
    print(f"  ✏️  修正说明: {old_std.manual_correction_note}")
    print(f"  🔄 状态: {RecordStatus.MANUAL_CORRECTED.value}")

    time.sleep(1)

    # ========== 第七部分：重跑分群 ==========
    print_header("第七部分：重跑分群（小祁操作）")

    print_step(1, f"重跑{old_std.store_name}分群（第{old_std.re_run_count}次）")
    old_std_result_final = store.get_grouping_result(old_std.record_id)
    print(f"  🎯 最终分群: {old_std_result_final.final_group}")
    print(f"  📈 置信度: {old_std_result_final.confidence:.2%}")
    print(f"  🔄 状态: {old_std.status.value}")
    print(f"  📝 误差说明: {old_std.error_explanation.current_text}")

    time.sleep(1)

    # ========== 第八部分：三种处理结果对比 ==========
    print_header("第八部分：三种处理结果对比")

    results = store.get_all_results()

    print("\n📊 对比表格:")
    print("-" * 90)
    print(f"{'门店名称':<20} {'处理类型':<20} {'最终分群':<15} {'置信度':<10} {'状态':<15}")
    print("-" * 90)

    smooth_result = store.get_grouping_result(smooth.record_id)
    old_std_result = store.get_grouping_result(old_std.record_id)

    print(f"{smooth.store_name:<20} {smooth.processing_type.value:<20} {smooth_result.final_group:<15} {smooth_result.confidence:>7.2%}  {smooth.status.value:<15}")
    print(f"{duplicate.store_name:<20} {duplicate.processing_type.value:<20} {'待复核':<15} {'-':<10} {duplicate.status.value:<15}")
    print(f"{old_std.store_name:<20} {old_std.processing_type.value:<20} {old_std_result.final_group:<15} {old_std_result.confidence:>7.2%}  {old_std.status.value:<15}")

    print("\n💡 三种结果差异说明:")
    print(f"  1. 顺利记录: 直接分群为 {smooth_result.final_group}，置信度 {smooth_result.confidence:.2%}")
    print(f"  2. 两版答案: 检测到重复，状态为【{duplicate.status.value}】，暂不分群")
    print(f"     ⚠️  关键点: 不自动归正常，留给业务运营复核")
    print(f"  3. 旧口径补录: 先分群，补录批注后人工修正，重跑后为 {old_std_result.final_group}")
    print(f"     📌 应用了旧口径: {old_std.annotations[0].old_standard_reference}")

    time.sleep(1)

    # ========== 第九部分：导出复盘记录 ==========
    print_header("第九部分：导出复盘记录（给业务运营和新人培训用）")

    print_step(1, "导出所有复盘记录")
    output_dir = "audit_reports"
    paths = auditor.export_all_audit_trails(output_dir)
    summary_path = auditor.generate_summary_report(output_dir)

    print(f"  ✅ 已导出 {len(paths)} 条复盘记录:")
    for p in paths:
        print(f"     - {p}")
    print(f"  ✅ 汇总报告: {summary_path}")

    print_step(2, "生成可重跑命令")
    print("\n  🔄 复盘国贸商城店（两版答案）可重跑命令:")
    for cmd in auditor._generate_replay_commands(duplicate):
        if cmd.strip():
            print(f"    {cmd}")

    time.sleep(1)

    # ========== 第十部分：总结 ==========
    print_header("第十部分：总结 - 给新人讲流程")

    print("\n📚 完整流程回顾:")
    print("""
  1. 旧公式截图导入
     → 保存公式文本和截图引用，保留原始依据

  2. 导入学生答案
     → 系统自动检测同一学生是否交了多版答案
     → 检测到重复时：不自动归正常，标记【待业务运营复核】

  3. 误差说明管理
     → 每次补录老师批注时，误差说明自动更新
     → 保留完整更新历史，可追溯

  4. 分群算法
     → 待复核的记录不能运行分群
     → 应用旧口径的记录，分数会自动调整
     → 支持多次重跑，记录每次运行结果

  5. 复盘与可追溯
     → 每条记录有完整的操作日志和事件时间线
     → 导出的复盘记录包含所有可重跑命令
     → 三种处理结果对比明显，方便新人理解
    """)

    print("🎯 关键细节（会看的细节）:")
    print("  ✅ 旧公式截图第一次导入 → 有记录")
    print("  ✅ 小祁补看老师批注 → 误差说明跟着变")
    print("  ✅ 同一学生交了两版答案 → 别急着归正常，留给业务运营复核")
    print("  ✅ 有一次人工修正和一次重跑 → 完整流程")
    print("  ✅ 三种处理结果不同 → 对比清晰")

    print("\n" + "=" * 70)
    print("🎉 演示完成！距离度量门店分群系统已就绪")
    print("=" * 70)
    print("\n💡 后续操作命令:")
    print("  python cli.py summary          # 查看汇总")
    print("  python cli.py show --record-id <id>  # 查看单条详情")
    print("  python cli.py demo-flow        # 查看演示流程")
    print("  python cli.py export-all       # 导出所有复盘记录")
    print("  python cli.py re-run --record-id <id>  # 重跑任一条记录")
    print("")

    return demo_results


if __name__ == "__main__":
    import shutil

    if os.path.exists("data"):
        shutil.rmtree("data")
    if os.path.exists("audit_reports"):
        shutil.rmtree("audit_reports")

    simulate_full_demo()
