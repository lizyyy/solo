#!/usr/bin/env python3
"""
热泵除霜能耗复盘 - 完整测试脚本
"""
from replay_engine import DefrostReplayEngine
from demo_data import (
    create_demo_sampling_interval,
    create_demo_defrost_records_initial,
    create_demo_temperature_calibrations,
    create_demo_manual_correction,
)
from models import RecordStatus, UnitCaliber


def test_core_logic():
    print("=" * 60)
    print("🧪 测试核心逻辑")
    print("=" * 60)

    engine = DefrostReplayEngine()

    # 1. 导入采样间隔
    print("\n1️⃣  导入采样间隔说明...")
    result = engine.import_sampling_interval(create_demo_sampling_interval())
    print(result)
    assert engine.sampling_interval is not None

    # 2. 导入除霜记录
    print("\n2️⃣  导入除霜记录...")
    result = engine.import_defrost_records(create_demo_defrost_records_initial())
    print(result)
    assert len(engine.records) == 5

    # 3. 验证三种状态
    print("\n3️⃣  验证三种记录状态...")
    statuses = {r.id: r.status for r in engine.records}
    print(f"   记录状态：{statuses}")

    # 001: 正常记录
    assert statuses["DEF-20250115-001"] == RecordStatus.NORMAL
    print("   ✅ DEF-20250115-001：顺利记录，状态正常")

    # 002: 被平均值盖掉
    assert statuses["DEF-20250115-002"] == RecordStatus.MASKED_BY_AVERAGE
    r002 = engine._find_record("DEF-20250115-002")
    assert r002.original_value == 5.2
    assert r002.masked_value is not None
    print(f"   ✅ DEF-20250115-002：被平均值盖掉，原值{r002.original_value}，盖为{r002.masked_value}")

    # 004: 超阈值太多不被盖
    assert statuses["DEF-20250115-004"] == RecordStatus.OVER_THRESHOLD
    r004 = engine._find_record("DEF-20250115-004")
    assert r004.original_value is None
    assert r004.masked_value is None
    print(f"   ✅ DEF-20250115-004：超阈值太多（7.8 > 3.5×2），不盖，留给人判断")

    # 4. 验证待复核清单
    print("\n4️⃣  验证待复核清单...")
    pending = engine.get_pending_review_records()
    print(f"   待复核记录：{len(pending)} 条")
    assert len(pending) == 2
    pending_ids = [r.id for r in pending]
    assert "DEF-20250115-002" in pending_ids
    assert "DEF-20250115-004" in pending_ids
    print("   ✅ 待复核清单正确")

    # 5. 验证单位换算说明（初始是新口径）
    print("\n5️⃣  验证单位换算说明...")
    assert engine.unit_conversion.current_caliber == UnitCaliber.NEW
    unit_text = engine.unit_conversion.get_conversion_text()
    assert "新口径" in unit_text
    print(f"   ✅ 初始口径：新口径")
    print(f"   {unit_text[:60]}...")

    # 6. 补录温度校准记录
    print("\n6️⃣  补录温度校准记录（旧口径）...")
    cals = create_demo_temperature_calibrations()
    result = engine.supplement_from_calibration(cals)
    print(result)

    # 验证单位口径自动切换
    assert engine.unit_conversion.current_caliber == UnitCaliber.OLD
    unit_text = engine.unit_conversion.get_conversion_text()
    assert "旧口径" in unit_text
    print(f"   ✅ 口径已自动切换为：旧口径")
    print(f"   {unit_text[:60]}...")

    # 验证有补录的记录
    supplemented = [r for r in engine.records if r.status == RecordStatus.SUPPLEMENTED_FROM_CALIBRATION]
    print(f"   ✅ 新增补录记录：{len(supplemented)} 条")
    for r in supplemented:
        print(f"      - {r.id}: {r.energy_consumption_kwh} kWh (旧口径)")
        assert r.caliber == UnitCaliber.OLD
        assert r.supplemented_from is not None

    # 7. 人工修正
    print("\n7️⃣  人工修正被盖掉的记录...")
    correction = create_demo_manual_correction()
    result = engine.apply_manual_correction(correction)
    print(result)

    r002 = engine._find_record("DEF-20250115-002")
    assert r002.status == RecordStatus.OVER_THRESHOLD
    assert r002.energy_consumption_kwh == 5.2
    assert r002.masked_value is None
    print("   ✅ DEF-20250115-002：已恢复原始值5.2，状态改为超阈值")

    # 8. 重跑
    print("\n8️⃣  重跑复盘...")
    result = engine.rerun("老岑", "补录校准记录后重跑")
    print(result)
    assert len(engine.replay_runs) == 1
    print("   ✅ 重跑完成，留痕成功")

    # 9. 复核三条典型记录
    print("\n9️⃣  复核三条典型记录...")

    # 顺利记录
    result = engine.review_record(
        "DEF-20250115-001", "老岑", True,
        "顺利记录：正常除霜，能耗2.8度，没问题，过了"
    )
    print(result)
    r001 = engine._find_record("DEF-20250115-001")
    assert r001.status == RecordStatus.REVIEWED_NORMAL

    # 被盖过的记录
    result = engine.review_record(
        "DEF-20250115-002", "老岑", False,
        "超阈值：5.2度超了3.5，被平均值盖过，恢复后确认是真实异常"
    )
    print(result)
    r002 = engine._find_record("DEF-20250115-002")
    assert r002.status == RecordStatus.REVIEWED_ABNORMAL

    # 补录的记录
    supplemented = [r for r in engine.records if r.status == RecordStatus.SUPPLEMENTED_FROM_CALIBRATION]
    if supplemented:
        result = engine.review_record(
            supplemented[0].id, "老岑", False,
            "校准补录：从温度校准记录补来的，旧口径数据，确实超了"
        )
        print(result)
        r = engine._find_record(supplemented[0].id)
        assert r.status == RecordStatus.REVIEWED_ABNORMAL

    # 10. 验证最终汇总
    print("\n🔟  最终汇总...")
    summary = engine.get_records_summary()
    print(summary)

    print("\n" + "=" * 60)
    print("✅ 所有核心逻辑测试通过！")
    print("=" * 60)
    return True


def test_three_step_process():
    """测试用户要求的三步流程：
    1. 采样间隔说明第一次导入
    2. 维修师傅老岑补看温度校准记录
    3. 单位换算说明更新
    中间碰到超阈值记录被平均值盖掉时，别急着归正常，留给维修师傅复核
    """
    print("\n" + "=" * 60)
    print("🧪 测试三步核心流程")
    print("=" * 60)

    engine = DefrostReplayEngine()

    # 第一步：采样间隔说明第一次导入
    print("\n📌 第一步：导入采样间隔说明")
    result = engine.import_sampling_interval(create_demo_sampling_interval())
    print(result)
    assert engine.sampling_interval is not None
    assert "第一次导入" in engine.sampling_interval.import_note
    print("✅ 采样间隔说明导入成功")

    # 导入记录，发现被盖掉的记录
    result = engine.import_defrost_records(create_demo_defrost_records_initial())
    print("\n" + result)

    masked_records = [r for r in engine.records if r.status == RecordStatus.MASKED_BY_AVERAGE]
    print(f"\n⚠️  发现 {len(masked_records)} 条被平均值盖掉的记录")
    for r in masked_records:
        print(f"   - {r.id}: 原值 {r.original_value} → 盖为 {r.masked_value}")
        print(f"     状态说明：{r.status_note.split(chr(10))[-1]}")  # 最后一行是老岑的话

    # 验证：别急着归正常，留给维修师傅复核
    for r in masked_records:
        assert "别急着归正常" in r.status_note
        assert r.status != RecordStatus.NORMAL
        assert r.status != RecordStatus.REVIEWED_NORMAL
    print("✅ 被盖掉的记录没有自动归正常，留给了维修师傅复核")

    # 第二步：维修师傅老岑补看温度校准记录
    print("\n📌 第二步：老岑师傅补看温度校准记录")
    cals = create_demo_temperature_calibrations()
    print(f"   找到 {len(cals)} 条温度校准记录")
    for c in cals:
        print(f"   - {c.record_time.strftime('%H:%M')}: {c.sensor_id} 偏移{c.calibration_offset}°C ({c.caliber_note})")

    # 第三步：单位换算说明更新
    print("\n📌 第三步：补录校准记录，单位换算说明自动更新")
    print(f"   补录前口径：{engine.unit_conversion.current_caliber}")
    print(f"   {engine.unit_conversion.get_conversion_text().split(chr(10))[1]}")

    result = engine.supplement_from_calibration(cals)
    print("\n" + result)

    print(f"\n   补录后口径：{engine.unit_conversion.current_caliber}")
    print(f"   {engine.unit_conversion.get_conversion_text().split(chr(10))[1]}")
    print(f"   更新原因：{engine.unit_conversion.update_reason}")
    print(f"   更新人：{engine.unit_conversion.updated_by}")

    assert engine.unit_conversion.current_caliber == UnitCaliber.OLD
    assert "自动切换" in engine.unit_conversion.update_reason
    assert len(engine.unit_conversion.history) >= 1
    print("✅ 单位换算说明已自动更新，并保留了历史记录")

    print("\n" + "=" * 60)
    print("✅ 三步核心流程测试通过！")
    print("=" * 60)
    return True


def test_three_record_types():
    """测试三种记录类型：
    1. 顺利记录
    2. 超阈值记录被平均值盖掉
    3. 从温度校准记录补来的旧口径
    """
    print("\n" + "=" * 60)
    print("🧪 测试三种记录类型")
    print("=" * 60)

    engine = DefrostReplayEngine()
    engine.import_sampling_interval(create_demo_sampling_interval())
    engine.import_defrost_records(create_demo_defrost_records_initial())
    engine.supplement_from_calibration(create_demo_temperature_calibrations())

    # 1. 顺利记录
    r_normal = engine._find_record("DEF-20250115-001")
    print("\n1️⃣  顺利记录：")
    print(f"   ID: {r_normal.id}")
    print(f"   时间: {r_normal.start_time.strftime('%H:%M')}")
    print(f"   耗电: {r_normal.energy_consumption_kwh} kWh")
    print(f"   状态: {r_normal.status}")
    print(f"   说明: {r_normal.status_note}")
    assert r_normal.status == RecordStatus.NORMAL
    assert r_normal.energy_consumption_kwh <= engine.threshold_kwh
    print("   ✅ 正常")

    # 2. 超阈值被平均值盖掉
    r_masked = engine._find_record("DEF-20250115-002")
    print("\n2️⃣  超阈值被平均值盖掉：")
    print(f"   ID: {r_masked.id}")
    print(f"   时间: {r_masked.start_time.strftime('%H:%M')}")
    print(f"   原始值: {r_masked.original_value} kWh")
    print(f"   被盖为: {r_masked.masked_value} kWh")
    print(f"   状态: {r_masked.status}")
    print(f"   说明: {r_masked.status_note.split(chr(10))[0]}")
    assert r_masked.original_value > engine.threshold_kwh
    assert r_masked.masked_value is not None
    print("   ✅ 被盖掉的痕迹完整保留")

    # 3. 从温度校准记录补来的旧口径
    r_supplemented = [
        r for r in engine.records
        if r.status == RecordStatus.SUPPLEMENTED_FROM_CALIBRATION
    ][0]
    print("\n3️⃣  从温度校准记录补来的旧口径：")
    print(f"   ID: {r_supplemented.id}")
    print(f"   时间: {r_supplemented.start_time.strftime('%H:%M')}")
    print(f"   耗电: {r_supplemented.energy_consumption_kwh} kWh")
    print(f"   口径: {r_supplemented.caliber}")
    print(f"   补录来源: {r_supplemented.supplemented_from}")
    print(f"   状态: {r_supplemented.status}")
    assert r_supplemented.caliber == UnitCaliber.OLD
    assert r_supplemented.supplemented_from is not None
    assert "校准记录" in r_supplemented.supplemented_from
    print("   ✅ 补录来源和口径信息完整")

    print("\n" + "=" * 60)
    print("✅ 三种记录类型测试通过！")
    print("=" * 60)
    return True


if __name__ == "__main__":
    try:
        test_core_logic()
        test_three_step_process()
        test_three_record_types()
        print("\n🎉 所有测试全部通过！")
        print("👷 老岑师傅说：这工具能处，返工都在明面上！")
    except AssertionError as e:
        print(f"\n❌ 测试失败：{e}")
        import traceback
        traceback.print_exc()
        exit(1)
    except Exception as e:
        print(f"\n❌ 发生错误：{e}")
        import traceback
        traceback.print_exc()
        exit(1)
