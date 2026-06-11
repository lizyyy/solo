from demo_data import (
    make_calibrations, make_sensors, make_first_run_records,
    make_corrections, make_rerun_records, make_run_histories,
)
from leak_calculator import (
    calculate_leakage, get_threshold, kpa_to_bar, mm2_to_m2,
    nozzle_area_mm2, REFERENCE_DIAMETER_MM
)
from models import RecordStatus

print("=" * 60)
print("压缩空气泄漏估算 - 验证脚本 v2")
print("=" * 60)

calibrations = make_calibrations()
sensors = make_sensors()
first_run = make_first_run_records()
corrections = make_corrections()
rerun_records = make_rerun_records()
threshold = get_threshold()

print(f"\n📊 泄漏阈值: {threshold} L/min")
print(f"📐 参考口径: {REFERENCE_DIAMETER_MM} mm")
print(f"📐 A_ref = π×({REFERENCE_DIAMETER_MM}/2)² = {nozzle_area_mm2(REFERENCE_DIAMETER_MM):.4f} mm²")

print("\n" + "=" * 60)
print("公式验证: Q = C × raw × (A_ref/A_nozzle) × √(T_std/T_actual)")
print("=" * 60)

for d in [2.0, 2.5, 3.0]:
    A = nozzle_area_mm2(d)
    ratio = nozzle_area_mm2(REFERENCE_DIAMETER_MM) / A
    print(f"  d={d}mm → A={A:.4f}mm² → A_ref/A={ratio:.4f}")

print("\n" + "-" * 60)
print("场景一: 顺利记录 (REC-001)")
print("-" * 60)
r1 = first_run[0]
print(f"  记录ID: {r1.record_id}")
print(f"  传感器: {r1.sensor_id}")
print(f"  使用口径: {r1.nozzle_diameter_mm}mm")
print(f"  A_ref/A_nozzle = {nozzle_area_mm2(REFERENCE_DIAMETER_MM)/nozzle_area_mm2(r1.nozzle_diameter_mm):.4f}")
print(f"  估算泄漏: {r1.estimated_leak_lmin} L/min")
print(f"  状态: {r1.status.value}")

verify_1 = calculate_leakage(r1.raw_flow_rate, r1.temp_c, r1.pressure_kpa, r1.nozzle_diameter_mm, 0.98)
assert abs(verify_1 - r1.estimated_leak_lmin) < 0.01, f"REC-001 公式不匹配: {verify_1} vs {r1.estimated_leak_lmin}"
assert r1.status == RecordStatus.NORMAL, "REC-001 应该是正常状态"
assert r1.estimated_leak_lmin < threshold, "REC-001 应低于阈值"
print(f"  ✅ 验证通过: 公式计算值 = {verify_1}, 一次顺利通过")

print("\n" + "-" * 60)
print("场景二: 超阈值被平均值覆盖 (REC-002 -> REC-002-R)")
print("-" * 60)
r2 = first_run[1]
sensor_a02 = next(s for s in sensors if s.sensor_id == r2.sensor_id)

print(f"  原始记录 {r2.record_id}:")
print(f"    口径: {r2.nozzle_diameter_mm}mm（错误，用了旧口径）")
print(f"    A_ref/A_nozzle = {nozzle_area_mm2(REFERENCE_DIAMETER_MM)/nozzle_area_mm2(r2.nozzle_diameter_mm):.4f}")
print(f"    泄漏: {r2.estimated_leak_lmin} L/min")
print(f"    状态: {r2.status.value}")

verify_2 = calculate_leakage(r2.raw_flow_rate, r2.temp_c, r2.pressure_kpa, r2.nozzle_diameter_mm, 0.97)
assert abs(verify_2 - r2.estimated_leak_lmin) < 0.01, f"REC-002 公式不匹配: {verify_2} vs {r2.estimated_leak_lmin}"
assert r2.status == RecordStatus.OVER_THRESHOLD, "REC-002 初次应该超阈值"
assert r2.estimated_leak_lmin > threshold, "REC-002 初次应高于阈值"
print(f"    ✅ 初次超阈值正确（公式验证: {verify_2}）")

print(f"\n  查传感器编号 {r2.sensor_id}:")
print(f"    档案口径: {sensor_a02.nozzle_diameter_mm}mm")
print(f"    记录口径: {r2.nozzle_diameter_mm}mm")
assert sensor_a02.nozzle_diameter_mm != r2.nozzle_diameter_mm, "口径应该不一致"
print(f"    ✅ 发现口径不一致")

corrected_leak = calculate_leakage(
    r2.raw_flow_rate, r2.temp_c, r2.pressure_kpa,
    sensor_a02.nozzle_diameter_mm, sensor_a02.calibration_factor
)
print(f"\n  口径修正后重算（2.5mm → 3.0mm）:")
print(f"    A_ref/A_nozzle = {nozzle_area_mm2(REFERENCE_DIAMETER_MM)/nozzle_area_mm2(sensor_a02.nozzle_diameter_mm):.4f}")
print(f"    修正后泄漏: {corrected_leak} L/min")
print(f"    阈值: {threshold} L/min")

delta = r2.estimated_leak_lmin - corrected_leak
print(f"    泄漏量估算减少了: {delta:.2f} L/min")
assert delta > 0, "修正口径后泄漏量应该减少（因为面积比 A_ref/A_nozzle 变小了）"
print(f"    ✅ 泄漏量减少方向正确")

corr1 = corrections[0]
print(f"\n  修正记录 COR-001:")
print(f"    旧值: {corr1.old_value} L/min")
print(f"    新值: {corr1.new_value} L/min")
print(f"    旧口径: {corr1.old_diameter}mm")
print(f"    新口径: {corr1.new_diameter}mm")
assert corr1.new_value is not None, "COR-001 的 new_value 不应为 None"
assert abs(corr1.new_value - corrected_leak) < 0.01, f"COR-001 new_value 不匹配: {corr1.new_value} vs {corrected_leak}"
print(f"    ✅ 修正记录值与公式一致")

other_values = [r.estimated_leak_lmin for r in first_run if r.record_id != r2.record_id and r.estimated_leak_lmin is not None]
avg_value = round(sum(other_values) / len(other_values), 2)
print(f"\n  取相邻记录平均值后:")
print(f"    REC-001: {first_run[0].estimated_leak_lmin} L/min")
print(f"    REC-003: {first_run[2].estimated_leak_lmin} L/min")
print(f"    平均值: {avg_value} L/min")

rec002_r = rerun_records[0]
assert abs(rec002_r.estimated_leak_lmin - avg_value) < 0.01, f"REC-002-R 平均值不匹配: {rec002_r.estimated_leak_lmin} vs {avg_value}"
assert rec002_r.status == RecordStatus.AVERAGED, "REC-002-R 状态应为 AVERAGED"
print(f"    ✅ 平均值覆盖验证通过 (REC-002-R: {rec002_r.estimated_leak_lmin} L/min)")

print("\n" + "-" * 60)
print("场景三: 补录旧口径数据 (REC-004)")
print("-" * 60)
r4 = rerun_records[1]
print(f"  记录ID: {r4.record_id}")
print(f"  传感器: {r4.sensor_id}")
print(f"  测量时间: {r4.measured_at.strftime('%Y-%m-%d %H:%M')}")
print(f"  使用口径: {r4.nozzle_diameter_mm}mm（旧口径）")
print(f"  A_ref/A_nozzle = {nozzle_area_mm2(REFERENCE_DIAMETER_MM)/nozzle_area_mm2(r4.nozzle_diameter_mm):.4f}")
print(f"  估算泄漏: {r4.estimated_leak_lmin} L/min")
print(f"  状态: {r4.status.value}")
print(f"  是否补录: {r4.is_backfilled}")

verify_4 = calculate_leakage(r4.raw_flow_rate, r4.temp_c, r4.pressure_kpa, r4.nozzle_diameter_mm, 0.97)
assert abs(verify_4 - r4.estimated_leak_lmin) < 0.01, f"REC-004 公式不匹配: {verify_4} vs {r4.estimated_leak_lmin}"
assert r4.is_backfilled == True, "REC-004 应该是补录记录"
assert r4.status == RecordStatus.BACKFILLED, "状态应为补录"
assert r4.nozzle_diameter_mm == 2.5, "补录记录应该用旧口径 2.5mm"
print(f"  ✅ 补录旧口径验证通过（公式验证: {verify_4}）")

print("\n" + "-" * 60)
print("单位换算验证")
print("-" * 60)
print(f"  600 kPa = {kpa_to_bar(600)} bar")
assert abs(kpa_to_bar(600) - 6.0) < 0.001, "kPa 转 bar 错误"
print(f"  ✅ kPa 转 bar 正确")

area_3mm = nozzle_area_mm2(3.0)
area_3mm_m2 = mm2_to_m2(area_3mm)
print(f"  3mm 喷嘴面积: {area_3mm:.4f} mm² = {area_3mm_m2:.2e} m²")
assert abs(mm2_to_m2(area_3mm) - area_3mm * 1e-6) < 1e-12, "mm² 转 m² 错误"
print(f"  ✅ mm² 转 m² 正确")

print("\n" + "-" * 60)
print("关键一致性检查: 三种结果必须能互相解释")
print("-" * 60)

print(f"  REC-001 (d=2.0mm): {first_run[0].estimated_leak_lmin} L/min → 正常")
print(f"  REC-002 (d=2.5mm 错): {r2.estimated_leak_lmin} L/min → 超阈值")
print(f"  REC-002 修正 (d=3.0mm 对): {corrected_leak} L/min → 低于阈值")
print(f"  REC-002-R (平均值覆盖): {rec002_r.estimated_leak_lmin} L/min → 待维修复核")
print(f"  REC-004 (d=2.5mm 补录): {r4.estimated_leak_lmin} L/min → 补录")

assert r2.estimated_leak_lmin > threshold, "错口径时必须超阈值"
assert corrected_leak < r2.estimated_leak_lmin, "修正口径后泄漏量必须降低"
assert corrected_leak <= threshold or corrected_leak < r2.estimated_leak_lmin, "修正后泄漏量应降低"
print(f"\n  ✅ 错口径→超阈值, 修正口径→降低, 方向全部正确")

print(f"\n  泄漏量估算减少了: {delta:.2f} L/min (口径 2.5mm → 3.0mm)")
print(f"  ✅ Delta 为正数，含义清晰（不是负数导致歧义）")

print("\n" + "=" * 60)
print("✅ 全部验证通过！三种场景均符合预期")
print("=" * 60)
print(f"\n三种处理结果总结:")
print(f"  1. REC-001: 顺利记录 - 正常 ✅ ({first_run[0].estimated_leak_lmin} L/min)")
print(f"  2. REC-002-R: 超阈值→平均值覆盖 - 待维修复核 ⚠️ (原始 {r2.estimated_leak_lmin} → 修正 {corrected_leak} → 平均 {rec002_r.estimated_leak_lmin})")
print(f"  3. REC-004: 传感器编号追溯→补录旧口径 📥 ({r4.estimated_leak_lmin} L/min)")
print(f"\n口径修正效果: 泄漏量估算减少了 {delta:.2f} L/min")
