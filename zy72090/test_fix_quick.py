import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from tidal_power_predictor.core.calculator import (
    TidalPredictionInput, TidalPowerCalculator, is_old_portal_source,
)
from tidal_power_predictor.core.data_processor import TidalDataProcessor
from datetime import datetime

print("=" * 60)
print("  修复验证 - 快速自测")
print("=" * 60)

# ========== 测试1：旧口径识别 ==========
print("\n[1] 旧口径别名识别测试:")
test_cases = [
    ("old_portal", True),
    ("旧系统导出", True),
    ("旧系统", True),
    ("老板汇总页", True),
    ("汇总页", True),
    ("旧口径", True),
    ("历史数据", True),
    ("手动录入", False),
    ("现场测量", False),
    ("", False),
    (None, False),
]

all_pass = True
for src, expected in test_cases:
    result = is_old_portal_source(src)
    status = "✓" if result == expected else "✗"
    if result != expected:
        all_pass = False
    print(f"  {status} '{src}' -> {result} (期望: {expected})")

assert all_pass, "旧口径识别测试失败"
print("  ✓ 全部通过")

# ========== 测试2：成功/待确认状态与置信度 ==========
print("\n[2] 旧口径记录状态与置信度测试:")

calc = TidalPowerCalculator()

# 正常记录
normal = TidalPredictionInput(
    record_id="TEST-001",
    timestamp=datetime.now(),
    station_name="测试站",
    tidal_range=5.0,
    flow_rate=500,
    turbine_efficiency=0.8,
    data_source="manual",
)
result_normal = calc.calculate_power(normal)
print(f"  正常记录: status={result_normal.status}, confidence={result_normal.confidence_score:.2f}")
assert result_normal.status == "success", f"期望 success，实际 {result_normal.status}"
assert result_normal.confidence_score == 0.85, f"期望 0.85，实际 {result_normal.confidence_score}"

# 旧口径记录
old_portal = TidalPredictionInput(
    record_id="TEST-002",
    timestamp=datetime.now(),
    station_name="测试站2",
    tidal_range=5.0,
    flow_rate=500,
    turbine_efficiency=0.8,
    data_source="旧系统导出",
)
result_old = calc.calculate_power(old_portal)
print(f"  旧口径记录: status={result_old.status}, confidence={result_old.confidence_score:.2f}")
assert result_old.status == "needs_review", f"期望 needs_review，实际 {result_old.status}"
assert result_old.confidence_score == 0.85 * 0.8, f"期望 {0.85*0.8:.3f}，实际 {result_old.confidence_score}"
print("  ✓ 全部通过")

# ========== 测试3：总功率只统计success ==========
print("\n[3] 总功率统计口径测试:")

processor = TidalDataProcessor()

records = [
    TidalPredictionInput(
        record_id="S001", timestamp=datetime.now(), station_name="站A",
        tidal_range=5.0, flow_rate=1000, data_source="手动录入",
    ),
    TidalPredictionInput(
        record_id="R001", timestamp=datetime.now(), station_name="站B",
        tidal_range=0.3, flow_rate=1000, data_source="手动录入",  # 潮差小 -> needs_review
    ),
    TidalPredictionInput(
        record_id="F001", timestamp=datetime.now(), station_name="",
        tidal_range=5.0, flow_rate=1000, data_source="手动录入",  # 无站名 -> failed
    ),
]

results, summary = processor.process_batch(records)

print(f"  总记录: {summary.total_records}")
print(f"  success: {summary.success_count}")
print(f"  needs_review: {summary.needs_review_count}")
print(f"  failed: {summary.failed_count}")
print(f"  总功率: {summary.total_power_kwh:.2f} kW")

assert summary.total_records == 3
assert summary.success_count == 1, f"期望 1 条成功，实际 {summary.success_count}"
assert summary.needs_review_count == 1, f"期望 1 条待确认，实际 {summary.needs_review_count}"
assert summary.failed_count == 1, f"期望 1 条失败，实际 {summary.failed_count}"

# 总功率应该只等于成功那1条的功率
success_power = [r.predicted_power for r in results if r.status == "success"]
assert len(success_power) == 1
assert abs(summary.total_power_kwh - success_power[0]) < 0.01, \
    f"总功率应该只统计success，期望 {success_power[0]:.2f}，实际 {summary.total_power_kwh:.2f}"
print("  ✓ 总功率只统计 success 记录")

# ========== 测试4：旧口径计数 ==========
print("\n[4] 旧口径计数测试:")

records2 = [
    TidalPredictionInput(
        record_id="O001", timestamp=datetime.now(), station_name="站X",
        tidal_range=5.0, flow_rate=500, data_source="旧系统导出",
    ),
    TidalPredictionInput(
        record_id="O002", timestamp=datetime.now(), station_name="站Y",
        tidal_range=6.0, flow_rate=600, data_source="老板汇总页",
    ),
    TidalPredictionInput(
        record_id="N001", timestamp=datetime.now(), station_name="站Z",
        tidal_range=5.0, flow_rate=500, data_source="手动录入",
    ),
]

results2, summary2 = processor.process_batch(records2)
print(f"  旧口径数量: {summary2.old_portal_count} (期望: 2)")
assert summary2.old_portal_count == 2, f"期望 2 条旧口径，实际 {summary2.old_portal_count}"
print("  ✓ 旧口径计数正确")

print("\n" + "=" * 60)
print("  ✅ 所有快速自测通过！")
print("=" * 60)
