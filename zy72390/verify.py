from demo_data import (
    make_calibrations, make_sensors, make_first_run_records,
    make_corrections, make_rerun_records, make_run_histories,
    get_threshold
)
from leak_calculator import (
    calculate_leakage, check_threshold, average_with_surroundings,
    kpa_to_bar, mm2_to_m2, apply_calibration_correction
)
from models import RecordStatus

print("=" * 60)
print("压缩空气泄漏估算 - 验证脚本")
print("=" * 60)

calibrations = make_calibrations()
sensors = make_sensors()
first_run = make_first_run_records()
corrections = make_corrections()
rerun_records = make_rerun_records()
run_histories = make_run_histories()
threshold = get_threshold()

print(f"\n📊 泄漏阈值: {threshold} L/min")

print("\n" + "-" * 60)
print("场景一: 顺利记录 (REC-001)")
print("-" * 60)
r1 = first_run[0]
print(f"  记录ID: {r1.record_id}")
print(f"  传感器: {r1.sensor_id}")
print(f"  使用口径: {r1.nozzle_diameter_mm}mm")
print(f"  估算泄漏: {r1.estimated_leak_lmin} L/min")
print(f"  状态: {r1.status.value}")
assert r1.status == RecordStatus.NORMAL, "REC-001 应该是正常状态"
assert r1.estimated_leak_lmin < threshold, "REC-001 应低于阈值"
print("  ✅ 验证通过: 一次顺利通过")

print("\n" + "-" * 60)
print("场景二: 超阈值被平均值覆盖 (REC-002 -> REC-002-R)")
print("-" * 60)
r2 = first_run[1]
print(f"  原始记录 {r2.record_id}:")
print(f"    口径: {r2.nozzle_diameter_mm}mm")
print(f"    泄漏: {r2.estimated_leak_lmin} L/min")
print(f"    状态: {r2.status.value}")
assert r2.status == RecordStatus.OVER_THRESHOLD, "REC-002 初次应该超阈值"
assert r2.estimated_leak_lmin > threshold, "REC-002 初次应高于阈值"
print("    ✅ 初次超阈值正确")

sensor = next(s for s in sensors if s.sensor_id == r2.sensor_id)
print(f"\n  查传感器编号 {r2.sensor_id}:")
print(f"    档案口径: {sensor.nozzle_diameter_mm}mm")
print(f"    记录口径: {r2.nozzle_diameter_mm}mm")
assert sensor.nozzle_diameter_mm != r2.nozzle_diameter_mm, "口径应该不一致"
print("    ✅ 发现口径不一致")

corrected_leak = calculate_leakage(
    r2.raw_flow_rate, r2.temp_c, r2.pressure_kpa,
    sensor.nozzle_diameter_mm, sensor.calibration_factor
)
print(f"\n  口径修正后重算:")
print(f"    修正后泄漏: {corrected_leak} L/min")
print(f"    阈值: {threshold} L/min")

avg_val, avg_rec = average_with_surroundings(r2, first_run, r2.sensor_id)
print(f"\n  取相邻记录平均值后:")
print(f"    平均值: {avg_val} L/min")
print(f"    新记录ID: {avg_rec.record_id}")
print(f"    新状态: {avg_rec.status.value}")
assert avg_rec.status == RecordStatus.AVERAGED, "平均值覆盖后状态应为 AVERAGED"
print(f"    ⚠️  虽平均值 {avg_val} L/min 在阈值内")
print(f"    ⚠️  但不自动归为正常，标记为待维修复核")
print("    ✅ 平均值覆盖验证通过")

print("\n" + "-" * 60)
print("场景三: 补录旧口径数据 (REC-004)")
print("-" * 60)
r4 = rerun_records[1]
print(f"  记录ID: {r4.record_id}")
print(f"  传感器: {r4.sensor_id}")
print(f"  测量时间: {r4.measured_at.strftime('%Y-%m-%d %H:%M')}")
print(f"  使用口径: {r4.nozzle_diameter_mm}mm")
print(f"  原始口径: {r4.original_diameter_mm}mm")
print(f"  估算泄漏: {r4.estimated_leak_lmin} L/min")
print(f"  状态: {r4.status.value}")
print(f"  是否补录: {r4.is_backfilled}")
assert r4.is_backfilled == True, "REC-004 应该是补录记录"
assert r4.status == RecordStatus.BACKFILLED, "状态应为补录"
assert r4.nozzle_diameter_mm == 2.5, "补录记录应该用旧口径 2.5mm"
print("  ✅ 补录旧口径验证通过")

print("\n" + "-" * 60)
print("单位换算验证")
print("-" * 60)
print(f"  600 kPa = {kpa_to_bar(600)} bar")
assert abs(kpa_to_bar(600) - 6.0) < 0.001, "kPa 转 bar 错误"
print("  ✅ kPa 转 bar 正确")

area_mm2 = 3.1416 * (3.0 / 2) ** 2
print(f"  {area_mm2:.2f} mm² = {mm2_to_m2(area_mm2):.2e} m²")
assert abs(mm2_to_m2(area_mm2) - area_mm2 * 1e-6) < 1e-12, "mm² 转 m² 错误"
print("  ✅ mm² 转 m² 正确")

print("\n" + "-" * 60)
print("修正记录验证")
print("-" * 60)
corr1 = corrections[0]
print(f"  修正ID: {corr1.correction_id}")
print(f"  类型: {corr1.correction_type.value}")
print(f"  关联记录: {corr1.record_id}")
print(f"  口径: {corr1.old_diameter}mm → {corr1.new_diameter}mm")
print(f"  原因: {corr1.reason}")
assert corr1.correction_type.value == "传感器编号补查"
print("  ✅ 传感器编号补查修正记录正确")

corr2 = corrections[1]
print(f"\n  修正ID: {corr2.correction_id}")
print(f"  类型: {corr2.correction_type.value}")
print(f"  原因: {corr2.reason}")
assert corr2.correction_type.value == "单位换算说明更新"
print("  ✅ 单位换算说明更新记录正确")

print("\n" + "-" * 60)
print("运行历史验证")
print("-" * 60)
for rh in run_histories:
    print(f"  {rh.run_id}: {rh.description}")
    print(f"    操作人: {rh.operator}")
    print(f"    记录数: {len(rh.record_ids)}")
    print(f"    修正数: {len(rh.correction_ids)}")
assert len(run_histories) == 2, "应该有两次运行历史"
assert run_histories[1].correction_ids, "第二次运行应该有关联修正"
print("  ✅ 运行历史验证通过")

print("\n" + "=" * 60)
print("✅ 全部验证通过！三种场景均符合预期")
print("=" * 60)
print("\n三种处理结果总结:")
print("  1. REC-001: 顺利记录 - 正常 ✅")
print("  2. REC-002-R: 超阈值→平均值覆盖 - 待维修复核 ⚠️")
print("  3. REC-004: 传感器编号追溯→补录旧口径 📥")
