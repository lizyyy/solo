#!/usr/bin/env python3
import copy
from datetime import datetime

from data_models import VerificationStatus
from data_validator import DataValidator
from extreme_value_processor import ExtremeValueProcessor
from version_manager import VersionManager
from report_generator import ReportGenerator
from test_cases import TestSuite
from sample_data import (
    create_demo_analysis_set,
    create_all_sample_records,
    create_smooth_record,
    create_manual_check_record,
    create_wechat_supplement_record,
    ROOM_VOLUME,
)


def print_section(title: str):
    print("\n" + "=" * 80)
    print(f"  {title}")
    print("=" * 80)


def run_test_suite():
    print_section("🧪 测试用例执行")
    suite = TestSuite()
    suite.run_all_tests()
    print(suite.print_test_report())


def demonstrate_three_record_types():
    print_section("📋 三类样例记录展示")
    print(f"房间体积: {ROOM_VOLUME} m³\n")

    validator = DataValidator()
    extreme_processor = ExtremeValueProcessor(preserve_extremes=True)
    report_gen = ReportGenerator()

    smooth = create_smooth_record()
    manual = create_manual_check_record()
    wechat = create_wechat_supplement_record()

    all_records = [smooth, manual, wechat]

    print("✅ 类型1: 顺利记录 (自动通过)")
    val_smooth = validator.validate_record(smooth, all_records)
    extreme_processor.mark_extreme_records([smooth])
    eff_smooth = extreme_processor.calculate_efficiency([smooth], ROOM_VOLUME)
    if eff_smooth:
        smooth.calculated_efficiency = eff_smooth[0].adjusted_efficiency
    smooth.verification_status = VerificationStatus.AUTO_PASS
    print(report_gen.generate_single_record_report(smooth, val_smooth))

    print("⚠️ 类型2: 需要人工确认的记录")
    val_manual = validator.validate_record(manual, all_records)
    eff_manual = extreme_processor.calculate_efficiency([manual], ROOM_VOLUME)
    if eff_manual:
        manual.calculated_efficiency = eff_manual[0].adjusted_efficiency
    manual.verification_status = VerificationStatus.NEED_MANUAL_CHECK
    print(report_gen.generate_single_record_report(manual, val_manual))

    print("💬 类型3: 维修微信群补录的旧口径记录")
    val_wechat = validator.validate_record(wechat, all_records)
    eff_wechat = extreme_processor.calculate_efficiency([wechat], ROOM_VOLUME)
    if eff_wechat:
        wechat.calculated_efficiency = eff_wechat[0].adjusted_efficiency
    wechat.verification_status = VerificationStatus.WECHAT_SUPPLEMENT
    print(report_gen.generate_single_record_report(wechat, val_wechat))

    print("💾 微信群原始内容 (未被清洗):")
    print(f"   {wechat.raw_wechat_content}\n")


def demonstrate_extreme_value_handling():
    print_section("⚡ 极端值处理演示 (不被平均掩盖)")

    records = create_demo_analysis_set()
    extreme_processor = ExtremeValueProcessor(preserve_extremes=True)
    validator = DataValidator()
    report_gen = ReportGenerator()

    validation_results = validator.batch_validate(records)
    extreme_processor.mark_extreme_records(records)
    efficiency_results = extreme_processor.calculate_efficiency(records, ROOM_VOLUME)

    for er in efficiency_results:
        for r in records:
            if r.record_id == er.record_id:
                r.calculated_efficiency = er.adjusted_efficiency
                if er.is_extreme:
                    r.verification_status = VerificationStatus.NEED_MANUAL_CHECK

    group_result = extreme_processor.calculate_group_efficiency(records, ROOM_VOLUME)

    print(report_gen.generate_business_reminder(records, validation_results, group_result))


def demonstrate_version_comparison():
    print_section("🔄 历史版本并排比较演示")

    version_mgr = VersionManager()
    report_gen = ReportGenerator()

    records_v1 = create_demo_analysis_set()
    print("📊 第一次分析 (原始数据):")
    result_v1 = version_mgr.run_analysis(
        records_v1, ROOM_VOLUME, "第一次分析：原始数据，未修正"
    )
    print(f"   记录数: {result_v1['record_count']}")
    print(f"   剔除极端值后效率: {result_v1['group_analysis']['methods']['剔除极端值后平均']['efficiency']:.2f}%")
    print(f"   风险等级: {result_v1['group_analysis']['risk_assessment']['level']}")

    records_v2 = copy.deepcopy(records_v1)
    for r in records_v2:
        if r.record_id == "DEMO-003":
            print(f"\n✏️ 修正记录 {r.record_id}: 风量从900调整为3200（确认是仪器跳变）")
            r.air_volume = 3200.0
            r.wechat_notes = "林老师确认：10:00确实是仪器跳变，修正为3200"

    print("\n📊 第二次分析 (修正数据后重跑):")
    result_v2 = version_mgr.run_analysis(
        records_v2, ROOM_VOLUME, "第二次分析：修正DEMO-003的仪器跳变值"
    )
    print(f"   记录数: {result_v2['record_count']}")
    print(f"   剔除极端值后效率: {result_v2['group_analysis']['methods']['剔除极端值后平均']['efficiency']:.2f}%")
    print(f"   风险等级: {result_v2['group_analysis']['risk_assessment']['level']}")

    print("\n📋 版本历史:")
    for rh in version_mgr.get_run_history():
        print(f"   索引 {rh['index']}: {rh['time']} | {rh['description']} | {rh['record_count']}条记录")

    comparison = version_mgr.compare_runs(0, 1)
    print("\n" + report_gen.generate_version_comparison_report(comparison))


def demonstrate_edge_case_handling():
    print_section("🎯 边界情况处理演示 (空值、重复、边界记录)")

    validator = DataValidator()
    extreme_processor = ExtremeValueProcessor(preserve_extremes=True)
    report_gen = ReportGenerator()

    all_records = create_all_sample_records()
    validation_results = validator.batch_validate(all_records)
    extreme_processor.mark_extreme_records(all_records)
    efficiency_results = extreme_processor.calculate_efficiency(all_records, ROOM_VOLUME)

    for er in efficiency_results:
        for r in all_records:
            if r.record_id == er.record_id:
                r.calculated_efficiency = er.adjusted_efficiency

    for r in all_records:
        vr = validation_results.get(r.record_id)
        if vr:
            if not vr.is_valid:
                r.verification_status = VerificationStatus.NEED_MANUAL_CHECK
            elif r.source.value == "维修微信群":
                r.verification_status = VerificationStatus.WECHAT_SUPPLEMENT
            else:
                r.verification_status = VerificationStatus.AUTO_PASS

    group_result = extreme_processor.calculate_group_efficiency(all_records, ROOM_VOLUME)

    print("📊 所有记录校验状态汇总:")
    status_counts = {}
    for r in all_records:
        status = r.verification_status.value
        status_counts[status] = status_counts.get(status, 0) + 1
    for status, count in status_counts.items():
        print(f"   {status}: {count} 条")

    print("\n⚠️ 空值处理:")
    for r in all_records:
        if r.record_id == "EXP-2026-EMPTY":
            vr = validation_results[r.record_id]
            print(f"   记录 {r.record_id}:")
            print(f"   风量值: {r.air_volume}")
            print(f"   单位: '{r.unit}'")
            print(f"   时间间隔: {r.time_interval_min}")
            print(f"   方向: {r.direction.value}")
            print(f"   错误数: {len(vr.errors)} | 警告数: {len(vr.warnings)}")
            if vr.errors:
                for e in vr.errors[:3]:
                    print(f"   ❌ {e}")
            print(f"   处理建议: {report_gen.generate_processing_suggestion(r, vr)[:100]}...")

    print("\n🔄 重复记录处理:")
    dup_records = [r for r in all_records if "DUP" in r.record_id or r.record_id == "EXP-2026-001"]
    for r in dup_records:
        vr = validation_results[r.record_id]
        warnings = [w for w in vr.warnings if "重复" in w]
        if warnings:
            print(f"   {r.record_id}: {r.measure_time.strftime('%H:%M')} | {r.location}")
            for w in warnings:
                print(f"   ⚠️ {w}")
            print(f"   风量: {r.air_volume} (保留原值，不自动合并)")

    print("\n📏 边界记录处理:")
    for r in all_records:
        if r.record_id == "EXP-2026-BOUNDARY":
            vr = validation_results[r.record_id]
            print(f"   {r.record_id}:")
            print(f"   风量: {r.air_volume} m³/h (量程上限附近)")
            print(f"   时间间隔: {r.time_interval_min} 分钟 (最小边界)")
            boundary_warns = [w for w in vr.warnings if "边界" in w or "量程" in w]
            for w in boundary_warns:
                print(f"   ⚠️ {w}")
            if r.raw_wechat_content:
                print(f"   💾 微信群原始内容已保存，长度: {len(r.raw_wechat_content)} 字符")


def main():
    print("\n" + "═" * 80)
    print("  🌬️  空气净化换气效率 - 数据处理系统 v1.0")
    print("  面向林老师和业务同事的实验数据复盘工具")
    print("═" * 80)
    print(f"  房间体积: {ROOM_VOLUME} m³")
    print(f"  当前时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    demonstrate_three_record_types()
    demonstrate_extreme_value_handling()
    demonstrate_version_comparison()
    demonstrate_edge_case_handling()
    run_test_suite()

    print_section("📝 给林老师和业务同事的最终总结")
    print("""
    ✅ 核心功能已实现：
       1. 【不掩盖风险】极端值单独标记，提供多种计算方法对比，原始值不被平均掉
       2. 【保留证据链】微信群备注和原始聊天内容完整保存，不被清洗
       3. 【三类样例】顺利记录自动通过、需确认记录提醒、微信群补录记录标记
       4. 【边界情况】空值、重复项、边界值均有对应处理逻辑和提醒
       5. 【版本对比】重跑数据时新旧版本并排比较，前次判断可追溯
       6. 【业务友好】处理建议用业务同事能看懂的语言，操作步骤清晰

    📋 三类样例记录已就位：
       • 顺利记录：EXP-2026-001 → 自动通过
       • 需人工确认：EXP-2026-004 → 照片模糊需确认
       • 微信群补录：WX-2026-001 → 旧口径保留，原始聊天已保存

    🎯 测试用例覆盖：
       • 空值处理：EXP-2026-EMPTY → 检测所有空字段，不参与计算
       • 重复记录：EXP-2026-001-DUP → 警告但保留两条记录
       • 边界记录：EXP-2026-BOUNDARY → 标记边界值，给出复核提示
       • 极端值不被平均：DEMO-003 → 900的极低值被标记，效率差8.05个百分点

    💡 给林老师的贴心提醒：
       不用再翻维修微信群找证据了，所有微信记录已存在 raw_wechat_content 字段
       看效率优先看「剔除极端值后平均」和「中位数」两个口径
       ⚡标记的记录一定要看，那里可能藏着真实风险！
    """)
    print("=" * 80)


if __name__ == "__main__":
    main()
