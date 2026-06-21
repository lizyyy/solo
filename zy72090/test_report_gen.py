import sys
import os
import tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from tidal_power_predictor.core.calculator import TidalPredictionInput, TidalPowerCalculator
from tidal_power_predictor.core.data_processor import TidalDataProcessor
from tidal_power_predictor.report.generator import ReportGenerator
from datetime import datetime

print("=" * 60)
print("  报告生成验证")
print("=" * 60)

calc = TidalPowerCalculator()
processor = TidalDataProcessor()
report_gen = ReportGenerator()

records = [
    TidalPredictionInput(
        record_id="T001", timestamp=datetime.now(), station_name="象山港潮汐电站",
        tidal_range=5.2, flow_rate=850, turbine_efficiency=0.82,
        data_source="手动录入", notes="正常大潮",
    ),
    TidalPredictionInput(
        record_id="T002", timestamp=datetime.now(), station_name="三门湾潮汐电站",
        tidal_range=0.3, flow_rate=200, turbine_efficiency=0.8,
        data_source="手动录入", notes="小潮差",
    ),
    TidalPredictionInput(
        record_id="T003", timestamp=datetime.now(), station_name="乐清湾潮汐电站",
        tidal_range=6.0, flow_rate=1000, turbine_efficiency=0.85,
        data_source="旧系统导出", notes="老板汇总页来的",
    ),
]

results, summary = processor.process_batch(records)

print(f"\n统计:")
print(f"  总记录: {summary.total_records}")
print(f"  成功: {summary.success_count}")
print(f"  待确认: {summary.needs_review_count}")
print(f"  失败: {summary.failed_count}")
print(f"  旧口径: {summary.old_portal_count}")
print(f"  成功总功率: {summary.total_power_kwh:.2f} kW")

# 生成报告
tmpfile = os.path.join(tempfile.gettempdir(), "test_report.html")
report_gen.generate_html_report(results, summary, tmpfile)
print(f"\n报告已生成: {tmpfile}")
print(f"文件大小: {os.path.getsize(tmpfile)} bytes")

# 验证报告内容
with open(tmpfile, 'r', encoding='utf-8') as f:
    content = f.read()

checks = [
    ("Chart.js", "chart" in content.lower() or "Chart" in content),
    ("象山港潮汐电站", "象山港潮汐电站" in content),
    ("T001", "T001" in content),
    ("T003 旧口径", "旧系统导出" in content),
    ("总功率", str(round(summary.total_power_kwh, 0))[:5] in content or "总功率" in content),
    ("公式说明", "公式" in content),
    ("边界值", "边界" in content or "潮差" in content),
    ("图表点击联动", "highlightTableRow" in content or "onclick" in content.lower()),
]

print("\n报告内容验证:")
all_ok = True
for name, ok in checks:
    status = "✓" if ok else "✗"
    if not ok:
        all_ok = False
    print(f"  {status} {name}")

assert all_ok, "报告内容验证失败"
print("\n  ✓ 报告生成及内容验证全部通过")
