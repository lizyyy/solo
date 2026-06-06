#!/usr/bin/env python3
"""
播客片头音乐排期 - 完整流程演示
场景：请假课时被算进已消耗的完整处理流程
"""
import os
import json
from core import (
    SingleSourceOfTruth,
    ScheduleProcessor,
    RecordStatus,
    AbnormalType,
)


def print_separator(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")


def print_record_status(record, step):
    print(f"\n[{step}] 记录 {record.id} 状态:")
    print(f"  期数: {record.episode_number}")
    print(f"  曲目: {record.track_name}")
    print(f"  状态: {record.status.value} ({record.status.name})")
    print(f"  异常类型: {record.abnormal_type}")
    print(f"  异常说明: {record.abnormal_note}")
    print(f"  是否已消耗: {record.consumed}")
    print(f"  是否请假: {record.is_leave}")
    print(f"  当前步骤: {record.current_step.value}")
    print(f"  证据来源数: {len(record.sources)}")
    for i, src in enumerate(record.sources, 1):
        print(f"    来源{i}: {src.source_name}, 行号: {src.line_number}")
        print(f"      原文: {src.raw_content[:50]}...")


def verify_consistency(source):
    """验证三个视图的数据一致性"""
    print_separator("验证数据一致性：页面/导出/API 读取同一份数据")

    display_data = source.get_for_display()
    export_data = source.get_for_export()
    api_data = source.get_for_api()

    print(f"页面展示记录数: {len(display_data)}")
    print(f"导出明细记录数: {len(export_data)}")
    print(f"API返回记录数: {len(api_data)}")

    assert len(display_data) == len(export_data) == len(api_data), "记录数不一致！"

    abnormal_display = [r for r in display_data if r["is_abnormal"]]
    abnormal_export = [r for r in export_data if r["状态"] not in ["正常", "待处理", "复核通过"]]
    abnormal_api = [r for r in api_data if r["status"] not in ["pending", "normal", "review_approved"]]

    print(f"\n异常记录数 - 页面: {len(abnormal_display)}")
    print(f"异常记录数 - 导出: {len(abnormal_export)}")
    print(f"异常记录数 - API: {len(abnormal_api)}")

    assert len(abnormal_display) == len(abnormal_export) == len(abnormal_api), "异常记录数不一致！"

    print("\n✅ 数据一致性验证通过：三个视图读取同一份结果")


def main():
    if os.path.exists("data/demo_schedule.json"):
        os.remove("data/demo_schedule.json")

    source = SingleSourceOfTruth("data/demo_schedule.json")
    processor = ScheduleProcessor(source)

    print_separator("场景：请假课时被算进已消耗的完整处理")
    print("故事背景：调音师留言已确认并标记为已消耗，但排练群接龙中小段请假了")
    print("关键要求：不能自动归正常，必须留给巡演统筹复核")

    # ========== Step 1: 调音师留言导入 ==========
    print_separator("Step 1: 调音师留言导入")
    engineer_messages = [
        "EP01|片头开场音乐|2026-06-10|14:00|30|李调音师|已消耗",
        "EP02|过渡音效|2026-06-11|15:30|15|王调音师",
        "EP03|结尾音乐|2026-06-12|10:00|45|李调音师|已消耗",
    ]
    print(f"导入 {len(engineer_messages)} 条调音师留言...")
    records = processor.step1_import_engineer_messages(engineer_messages, "系统自动导入")
    for r in records:
        print_record_status(r, "导入后")

    # ========== Step 2: 录音师小段补看排练群接龙 ==========
    print_separator("Step 2: 录音师小段补看排练群接龙")
    print("EP01 发现问题：群接龙里小段写了「请假」，但调音师留言已标记「已消耗」")

    record_ep01 = records[0]
    record_ep01 = processor.step2_check_group_signup(
        record_ep01.id,
        "排练群接龙：小段请假，今天不来排练，下次补上",
        "录音师小段"
    )
    print_record_status(record_ep01, "接龙核对后")

    print("\n⚠️  关键点：")
    print(f"  - 状态自动变为: {record_ep01.status.value} (待统筹复核)")
    print(f"  - 异常类型: {record_ep01.abnormal_type.value}")
    print(f"  - 没有自动归为正常，留给巡演统筹处理")

    # 核对另一条正常记录
    record_ep02 = records[1]
    record_ep02 = processor.step2_check_group_signup(
        record_ep02.id,
        "排练群接龙：全体到齐",
        "录音师小段"
    )
    print_record_status(record_ep02, "接龙核对后(正常)")

    # ========== Step 3: 曲目核对表更新 ==========
    print_separator("Step 3: 曲目核对表更新")
    print("更新 EP01 曲目信息（待复核状态应保持不变）")

    record_ep01 = processor.step3_update_tracklist(
        record_ep01.id,
        {"track_name": "片头开场音乐(最终版)", "duration_minutes": 32},
        "曲目编辑小周"
    )
    print_record_status(record_ep01, "曲目更新后")

    print("\n⚠️  关键点：")
    print(f"  - 曲目已更新，但状态仍为: {record_ep01.status.value}")
    print(f"  - 异常标记未被清除，等待统筹复核")

    # 正常记录的 Step 3
    record_ep02 = processor.step3_update_tracklist(
        record_ep02.id,
        {"track_name": "过渡音效(精简版)", "duration_minutes": 12},
        "曲目编辑小周"
    )
    print_record_status(record_ep02, "曲目更新后(正常)")

    # ========== 巡演统筹复核 ==========
    print_separator("巡演统筹复核 EP01")
    print("统筹老王检查证据链：")
    print("  1. 调音师留言第1行：标记了「已消耗」")
    print("  2. 排练群接龙：小段「请假」")
    print("  结论：确实是请假，不应该算消耗，驳回并取消消耗标记")

    record_ep01 = processor.coordinator_review(
        record_ep01.id,
        approved=False,
        reviewer="巡演统筹老王",
        note="核对证据：群接龙明确请假，调音师留言可能误标，取消消耗标记"
    )
    print_record_status(record_ep01, "复核驳回后")

    print("\n✅ 复核结果：")
    print(f"  - 状态: {record_ep01.status.value}")
    print(f"  - consumed 已自动改为: {record_ep01.consumed}")
    print(f"  - 复核人: {record_ep01.reviewer}")

    # ========== 验证证据链 ==========
    print_separator("证据链追溯：查看 EP01 完整审计日志")
    for i, log in enumerate(record_ep01.audit_logs, 1):
        print(f"\n操作 {i}: {log.action}")
        print(f"  时间: {log.timestamp.strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"  步骤: {log.step.value}")
        print(f"  操作人: {log.operator}")
        print(f"  备注: {log.note}")

    print("\n证据来源列表:")
    for src in record_ep01.sources:
        print(f"  - [{src.source_name}] 第{src.line_number}行: {src.raw_content}")

    # ========== 数据一致性验证 ==========
    verify_consistency(source)

    # ========== 导出演示 ==========
    print_separator("导出演示")
    from core.export import ExportService
    export_service = ExportService(source)
    export_service.export_to_csv("data/demo_export.csv")
    export_service.export_abnormal_only("data/demo_abnormal.csv")
    print("已导出完整明细到 data/demo_export.csv")
    print("已导出异常记录到 data/demo_abnormal.csv")

    # ========== API 演示 ==========
    print_separator("API 接口演示")
    from core.api import ApiService
    api = ApiService(source)
    result = api.get_abnormal_summary()
    print(f"异常汇总接口返回: {json.dumps(result['data'], ensure_ascii=False, indent=2)}")

    print_separator("演示完成")
    print("\n🎯 核心目标达成:")
    print("  ✅ 三步流程走通：导入 → 接龙核对 → 曲目更新")
    print("  ✅ 请假课时被算进已消耗 → 自动标记待复核，不自动归正常")
    print("  ✅ 证据链完整：原始行号、人工改动、处理状态全程留痕")
    print("  ✅ 数据一致：页面/导出/API 读取同一份结果")
    print("  ✅ 边界规则固化在代码里，不是口头约定")


if __name__ == "__main__":
    main()
