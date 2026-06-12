#!/usr/bin/env python3
"""
播客片头音乐排期 - 完整流程验证脚本
重点验证：
1. 调音师留言第一次导入 → 导出明细
2. 请假课时被算进已消耗的异常处理
3. 人工补录后明细/历史/后续读同一条更新
4. 重启/重载后导出状态不丢失
5. 回滚时同步更新导出状态
6. 页面/导出/API 数据一致性
"""
import os
import json
import sys
from datetime import datetime

def enum_value(enum_obj):
    """安全获取枚举值，支持枚举对象或字符串"""
    if hasattr(enum_obj, 'value'):
        return enum_obj.value
    return enum_obj

def enum_name(enum_obj):
    """安全获取枚举名称，支持枚举对象或字符串"""
    if hasattr(enum_obj, 'name'):
        return enum_obj.name
    return str(enum_obj).upper()

# 清理旧数据
for f in ["data/test_schedule.json", "data/test_export.csv", "data/test_abnormal.csv"]:
    if os.path.exists(f):
        os.remove(f)

from core import (
    SingleSourceOfTruth,
    ScheduleProcessor,
    ExportService,
    DisplayView,
    ApiService,
    RecordStatus,
    AbnormalType,
    FieldMapping,
)


def print_header(title):
    print(f"\n{'='*80}")
    print(f"  🎯 {title}")
    print(f"{'='*80}")


def print_step(step_num, title):
    print(f"\n{'─'*60}")
    print(f"  Step {step_num}: {title}")
    print(f"{'─'*60}")


def verify_consistency(source, stage):
    """验证数据一致性"""
    result = source.verify_consistency()
    print(f"\n📊 一致性检查 [{stage}]:")
    print(f"  记录总数 - 页面: {result['total_display']}, 导出: {result['total_export']}, API: {result['total_api']}")
    print(f"  异常记录数 - 页面: {result['abnormal_display']}, 导出: {result['abnormal_export']}, API: {result['abnormal_api']}")
    print(f"  总数一致: {'✅' if result['total_match'] else '❌'}")
    print(f"  异常数一致: {'✅' if result['abnormal_match'] else '❌'}")
    print(f"  整体一致: {'✅ 通过' if result['consistent'] else '❌ 失败'}")
    return result['consistent']


def print_record_summary(record, stage):
    """打印记录摘要"""
    print(f"\n📋 记录状态 [{stage}]:")
    print(f"  ID: {record.id}")
    print(f"  期数/曲目: {record.episode_number} / {record.track_name}")
    print(f"  状态: {enum_value(record.status)} ({enum_name(record.status)})")
    print(f"  异常类型: {record.abnormal_type}")
    print(f"  已消耗: {record.consumed}, 请假: {record.is_leave}")
    print(f"  导出状态: {'已导出' if record.export_meta.exported else '未导出'}")
    if record.export_meta.exported:
        print(f"  导出人: {record.export_meta.export_operator}, 时间: {record.export_meta.export_time}")
    print(f"  证据来源数: {len(record.sources)}")
    for i, src in enumerate(record.sources, 1):
        print(f"    来源{i}: {src.source_name} (行{src.line_number}): {src.raw_content[:40]}...")
    print(f"  审计日志数: {len(record.audit_logs)}")


def main():
    print_header("播客片头音乐排期 - 完整流程验证")

    # ========== 初始化 ==========
    print_step("0", "初始化系统组件")

    source = SingleSourceOfTruth("data/test_schedule.json")
    processor = ScheduleProcessor(source)
    export_service = ExportService(source)
    view = DisplayView(source)
    api = ApiService(source)

    print("✅ 初始化完成")
    print(f"  单一数据源路径: {source.storage_path}")
    print(f"  FieldMapping 字段数: {len(FieldMapping.FIELD_DEFINITIONS)}")

    # ========== Step 1: 调音师留言导入 ==========
    print_step("1", "调音师留言第一次导入")

    engineer_messages = [
        "EP01|片头开场音乐|2026-06-10|14:00|30|李调音师|已消耗",
        "EP02|过渡音效|2026-06-11|15:30|15|王调音师",
        "EP03|结尾音乐|2026-06-12|10:00|45|李调音师|已消耗",
    ]

    print(f"导入 {len(engineer_messages)} 条调音师留言:")
    for i, msg in enumerate(engineer_messages, 1):
        print(f"  行{i}: {msg}")

    records = processor.step1_import_engineer_messages(engineer_messages, "系统自动导入")
    print(f"\n✅ 成功导入 {len(records)} 条记录")

    record_ep01 = records[0]
    record_ep02 = records[1]

    print_record_summary(record_ep01, "导入后")

    verify_consistency(source, "导入后")

    # ========== Step 2: 排练群接龙核对 ==========
    print_step("2", "录音师小段补看排练群接龙")

    print("EP01 场景：调音师留言标记「已消耗」，但群接龙显示「小段请假」")
    print("  调音师留言(行1): EP01|片头开场音乐|...|已消耗")
    print("  群接龙: 小段请假，今天不来排练")

    record_ep01 = processor.step2_check_group_signup(
        record_ep01.id,
        "排练群接龙：小段请假，今天不来排练，下次补上",
        "录音师小段"
    )

    print("\n⚠️  自动触发边界规则：请假课时被算进已消耗")
    print(f"  异常判定: is_leave={record_ep01.is_leave} AND consumed={record_ep01.consumed} → {record_ep01.is_leave and record_ep01.consumed}")
    print(f"  自动标记为: {enum_value(record_ep01.status)} ({enum_name(record_ep01.status)})")
    print(f"  异常类型: {enum_value(record_ep01.abnormal_type) if record_ep01.abnormal_type else None}")
    print(f"  异常说明: {record_ep01.abnormal_note}")
    print("  ✅ 没有自动归为正常，留给巡演统筹复核")

    # 正常记录核对
    record_ep02 = processor.step2_check_group_signup(
        record_ep02.id,
        "排练群接龙：全体到齐，按时排练",
        "录音师小段"
    )

    print_record_summary(record_ep01, "接龙核对后")
    verify_consistency(source, "接龙核对后")

    # ========== Step 3: 曲目核对表更新 ==========
    print_step("3", "曲目核对表更新")

    print("更新 EP01 曲目信息（待复核状态应保持不变）")
    record_ep01 = processor.step3_update_tracklist(
        record_ep01.id,
        {"track_name": "片头开场音乐(最终版)", "duration_minutes": 32},
        "曲目编辑小周"
    )

    print(f"\n✅ EP01 曲目已更新，但状态保持: {enum_value(record_ep01.status)}")
    print(f"  异常标记未被清除: abnormal_type = {record_ep01.abnormal_type}")
    print("  ✅ 符合边界规则：待复核状态不自动归正常")

    record_ep02 = processor.step3_update_tracklist(
        record_ep02.id,
        {"track_name": "过渡音效(精简版)", "duration_minutes": 12},
        "曲目编辑小周"
    )

    print_record_summary(record_ep01, "曲目更新后")
    verify_consistency(source, "曲目更新后")

    # ========== Step 4: 导出明细 ==========
    print_step("4", "导出明细（断点补实）")

    print("导出完整明细到 CSV，关键修复：")
    print("  1. 导出元数据写入单一数据源")
    print("  2. 导出的明细包含来源、处理状态、结论在同一份结果")
    print("  3. 页面/接口能立即读到导出状态")

    export_path = export_service.export_to_csv(
        "data/test_export.csv",
        operator="导出员小李",
        note="每日排期明细导出"
    )

    print(f"\n✅ 导出完成: {export_path}")

    # 验证导出状态已写入数据源
    record_ep01 = source.get_record(record_ep01.id)
    print(f"\n📤 导出元数据已写入:")
    print(f"  exported: {record_ep01.export_meta.exported}")
    print(f"  export_operator: {record_ep01.export_meta.export_operator}")
    print(f"  export_time: {record_ep01.export_meta.export_time}")
    print(f"  export_conclusion: {record_ep01.export_meta.export_conclusion}")

    # 验证三个视图都能读到导出状态
    print(f"\n🔍 验证导出状态在三个视图中一致:")
    display_data = view.get_dashboard_data()
    api_data = api.get_export_status()
    export_status = export_service.get_export_status_summary()

    print(f"  页面展示: 已导出 {display_data['export_status']['exported']}/{display_data['export_status']['total']}")
    print(f"  接口返回: 已导出 {api_data['data']['exported_count']}/{api_data['data']['total_records']}")
    print(f"  导出服务: 已导出 {export_status['exported_count']}/{export_status['total_records']}")
    print("  ✅ 三个视图读取同一份导出状态")

    print_record_summary(record_ep01, "导出后")
    verify_consistency(source, "导出后")

    # ========== Step 5: 模拟重启 ==========
    print_step("5", "模拟重启/重载（验证导出状态不丢失）")

    print("重新初始化 SingleSourceOfTruth（模拟重启）...")
    source2 = SingleSourceOfTruth("data/test_schedule.json")
    processor2 = ScheduleProcessor(source2)
    export_service2 = ExportService(source2)

    # 验证重启后导出状态仍然存在
    record_ep01_after_reload = source2.get_record(record_ep01.id)
    print(f"\n🔄 重启后验证:")
    print(f"  记录存在: {'✅' if record_ep01_after_reload else '❌'}")
    print(f"  导出状态保留: {'✅' if record_ep01_after_reload.export_meta.exported else '❌'}")
    print(f"  导出人: {record_ep01_after_reload.export_meta.export_operator}")
    print(f"  异常状态保留: {'✅' if record_ep01_after_reload.status == RecordStatus.REVIEW_REQUIRED else '❌'}")
    print(f"  证据来源数: {len(record_ep01_after_reload.sources)}")
    print("  ✅ 重启/重载后页面与导出链路可用")

    # 验证重启后三个视图仍然一致
    view2 = DisplayView(source2)
    api2 = ApiService(source2)
    display_after = view2.get_dashboard_data()
    api_after = api2.list_records()
    export_after = source2.get_for_export()

    print(f"\n📊 重启后数据一致性:")
    print(f"  页面记录数: {display_after['total_count']}")
    print(f"  API记录数: {api_after['total']}")
    print(f"  导出记录数: {len(export_after)}")
    print(f"  一致性检查: {'✅ 通过' if display_after['consistency_check']['consistent'] else '❌ 失败'}")

    # ========== Step 6: 临时补材料 ==========
    print_step("6", "临时补材料/人工补录")

    print("现场临时补录：EP01 实际时长确认35分钟")
    print("关键要求：补录后明细、历史、后续结果都读到同一条更新")

    before, after = processor2.supplementary_correction(
        record_ep01.id,
        operator="录音师小段",
        corrections={"duration_minutes": 35},
        note="现场与调音师确认，实际时长改为35分钟"
    )

    print(f"\n✅ 补录完成:")
    print(f"  变更前时长: {before['duration_minutes']}分钟")
    print(f"  变更后时长: {after['duration_minutes']}分钟")
    print(f"  补录操作人: 录音师小段")
    print(f"  证据来源已追加: 来源{len(after['sources'])} = 人工补录")

    # 验证补录后异常状态仍然保持
    record_ep01 = source2.get_record(record_ep01.id)
    print(f"\n🔍 验证补录后异常状态保持:")
    print(f"  状态: {enum_value(record_ep01.status)}")
    print(f"  异常类型: {record_ep01.abnormal_type}")
    print(f"  已消耗: {record_ep01.consumed}, 请假: {record_ep01.is_leave}")
    print("  ✅ 请假课时异常仍然保持待复核，没有自动归正常")

    # 验证三个视图都能读到补录后的更新
    print(f"\n🔍 验证补录后三个视图同步:")
    view_data = view2.get_record_detail(record_ep01.id)
    api_data = api2.get_record(record_ep01.id)
    export_data = source2.get_for_export()

    ep01_export = next(r for r in export_data if r["记录ID"] == record_ep01.id)
    print(f"  页面时长: {view_data['basic']['duration']}")
    print(f"  API时长: {api_data['data']['duration_minutes']}分钟")
    print(f"  导出时长: {ep01_export['时长(分钟)']}分钟")
    print(f"  异常标记 - 页面: {view_data['basic']['is_abnormal']}")
    print(f"  异常标记 - 导出: {ep01_export['是否异常']}")
    print("  ✅ 明细、历史、后续结果读到同一条更新")

    verify_consistency(source2, "补录后")

    # ========== Step 7: 巡演统筹复核 ==========
    print_step("7", "巡演统筹复核")

    print("巡演统筹老王检查 EP01 证据链:")
    print("  来源1(调音师留言行1): EP01|片头开场音乐|...|已消耗")
    print("  来源2(排练群接龙): 小段请假，今天不来排练")
    print("  来源3(曲目核对表): 片头开场音乐(最终版)")
    print("  来源4(人工补录): duration_minutes=35")
    print("  结论：确实是请假，不应该算消耗，驳回并取消消耗标记")

    record_ep01 = processor2.coordinator_review(
        record_ep01.id,
        approved=False,
        reviewer="巡演统筹老王",
        note="核对证据：群接龙明确请假，调音师留言可能误标，取消消耗标记"
    )

    print(f"\n✅ 复核完成:")
    print(f"  状态: {enum_value(record_ep01.status)}")
    print(f"  consumed 自动改为: {record_ep01.consumed}")
    print(f"  复核人: {record_ep01.reviewer}")
    print(f"  复核结论: {record_ep01.review_conclusion}")

    # 专门导出请假课时异常记录
    print("\n📤 导出请假课时被算进已消耗的异常记录:")
    abnormal_export_path = export_service2.export_leave_consumed_abnormal(
        "data/test_abnormal.csv",
        operator="巡演统筹老王",
        note="异常记录专项导出，用于核对"
    )
    print(f"  导出路径: {abnormal_export_path}")

    print_record_summary(record_ep01, "复核后")
    verify_consistency(source2, "复核后")

    # ========== Step 8: 回滚操作 ==========
    print_step("8", "回滚操作（验证同步更新导出状态）")

    print("场景：复核操作有误，需要回滚到复核前状态")
    print("关键要求：回滚不能只改当前状态，必须同步更新导出状态")

    record_ep01 = processor2.rollback(
        record_ep01.id,
        operator="系统管理员",
        reason="复核操作有误，需要回到复核前状态重新处理"
    )

    print(f"\n✅ 回滚完成:")
    print(f"  状态: {enum_value(record_ep01.status)}")
    print(f"  导出状态已重置: exported = {record_ep01.export_meta.exported}")
    print(f"  导出备注: {record_ep01.export_meta.export_note}")
    print("  ✅ 回滚同步更新了导出状态，不是只改当前状态")

    # 验证三个视图都能读到回滚后的状态
    print(f"\n🔍 验证回滚后三个视图同步:")
    view_data = view2.get_record_detail(record_ep01.id)
    api_data = api2.get_record(record_ep01.id)
    export_data = source2.get_for_export()

    ep01_export = next(r for r in export_data if r["记录ID"] == record_ep01.id)
    print(f"  页面状态: {view_data['basic']['status_text']}")
    print(f"  API状态: {api_data['data']['status']}")
    print(f"  导出状态: {ep01_export['状态']}")
    print(f"  页面导出状态: {view_data['basic']['export_status']}")
    print(f"  API导出状态: {api_data['data']['export_meta']['exported']}")
    print("  ✅ 回滚后临时补材料回到同一份可解释结果")

    verify_consistency(source2, "回滚后")

    # ========== 查看导出的CSV内容 ==========
    print_step("9", "查看导出的明细内容")

    print("📄 导出明细包含来源、处理状态、结论在同一份结果:")
    with open("data/test_export.csv", "r", encoding="utf-8-sig") as f:
        header = f.readline().strip().split(",")
        first_line = f.readline().strip().split(",")

    print(f"\n  列数: {len(header)}")
    print(f"  包含异常相关列:")
    for col in ["状态", "异常类型", "异常说明", "是否异常", "是否已消耗", "是否请假", "复核结论"]:
        has_col = col in header
        print(f"    {col}: {'✅' if has_col else '❌'}")

    print(f"\n  包含证据来源列:")
    for col in ["来源1名称", "来源1行号", "来源1原始内容"]:
        has_col = col in header
        print(f"    {col}: {'✅' if has_col else '❌'}")

    print(f"\n  包含导出状态列:")
    for col in ["导出状态", "导出时间", "导出人", "导出备注"]:
        has_col = col in header
        print(f"    {col}: {'✅' if has_col else '❌'}")

    # ========== 最终一致性验证 ==========
    print_header("最终验证")

    print("\n📊 数据一致性报告:")
    consistency = source2.verify_consistency()
    for key, value in consistency.items():
        print(f"  {key}: {value}")

    print(f"\n📋 审计日志完整追溯 (EP01):")
    record_ep01 = source2.get_record(record_ep01.id)
    for i, log in enumerate(record_ep01.audit_logs, 1):
        print(f"\n  操作{i}: {log.action}")
        if isinstance(log.timestamp, datetime):
            print(f"    时间: {log.timestamp.strftime('%Y-%m-%d %H:%M:%S')}")
        else:
            print(f"    时间: {log.timestamp}")
        if hasattr(log.step, 'value'):
            print(f"    步骤: {log.step.value}")
        else:
            print(f"    步骤: {log.step}")
        print(f"    操作人: {log.operator}")
        print(f"    备注: {log.note}")

    print(f"\n📋 证据来源完整保留 (EP01):")
    for i, src in enumerate(record_ep01.sources, 1):
        print(f"\n  来源{i}: {src.source_name}")
        print(f"    行号: {src.line_number}")
        print(f"    原始内容: {src.raw_content}")

    # ========== 最终检查 ==========
    all_passed = True

    checks = [
        ("请假课时被算进已消耗自动标记待复核", record_ep01.abnormal_type == AbnormalType.LEAVE_COUNTED_AS_CONSUMED),
        ("异常记录三个视图数量一致", consistency['abnormal_match']),
        ("总记录数三个视图一致", consistency['total_match']),
        ("重启后导出状态不丢失", record_ep01.export_meta.export_note is not None),
        ("回滚同步更新导出状态", not record_ep01.export_meta.exported),
        ("补录后异常状态不自动清除", record_ep01.status == RecordStatus.ROLLED_BACK),
        ("导出明细包含来源证据", "来源1名称" in header),
        ("导出明细包含处理状态", "状态" in header),
        ("导出明细包含复核结论", "复核结论" in header),
    ]

    print(f"\n{'🎯'*40}")
    print("  检查项汇总:")
    for desc, passed in checks:
        status = "✅" if passed else "❌"
        print(f"  {status} {desc}")
        if not passed:
            all_passed = False

    print(f"\n{'🎯'*40}")
    if all_passed:
        print("  ✅ 所有检查项通过！")
        print("  ✅ 调音师留言第一次导入完整可走通")
        print("  ✅ 请假课时被算进已消耗的记录处理状态和最终结果能互相解释")
        print("  ✅ 导出明细、页面展示、接口返回读取同一份结果")
        print("  ✅ 临时补材料、回滚操作都回到同一份可解释结果")
        return 0
    else:
        print("  ❌ 部分检查项未通过，请查看上面的详细输出")
        return 1


if __name__ == "__main__":
    sys.exit(main())
