import json
import subprocess
import sys

result = subprocess.run(
    ["python3", "-m", "art_transport.cli",
     "--artworks", "sample_data/artworks.json",
     "--cities", "sample_data/cities.json",
     "--routes", "sample_data/routes.json",
     "--constraints", "sample_data/constraints.json",
     "--source-name", "gallery_sample",
     "--source-version", "1.0",
     "--show-formulas",
     "--show-intermediates"],
    capture_output=True, text=True, cwd="/Users/lzy/pro/solo/workspaces/zy71460"
)
if result.returncode != 0:
    print("CLI failed:", result.stderr)
    sys.exit(1)

data = json.loads(result.stdout)

print("=== 数据来源 ===")
for k, v in data["data_sources"].items():
    print(f"  {k}: {v['file']} (source={v['source']}, ver={v['version']})")

print()
print("=== 约束配置 ===")
c = data["constraint_config"]
for k in ["max_insurance_per_batch_cny", "high_value_threshold_cny",
          "temp_violation_penalty_per_degree_hour", "route_duplication_penalty"]:
    print(f"  {k}: {c[k]}")
print(f"  权重: insurance={c['insurance_risk_weight']}, temp={c['temp_risk_weight']}, time={c['time_risk_weight']}")

print()
print("=== 批次结果 ===")
for pr in data["path_results"]:
    fd = pr["formula_detail"]
    reasons = fd.get("special_handling_reasons", [])
    flag = " [需特殊处理]" if fd.get("requires_special_handling") else ""
    print(f"  {pr['batch_id']}: {len(pr['artworks'])}件, "
          f"保额={pr['total_insurance_cny']/1e4:.0f}万, "
          f"综合风险={pr['composite_risk_score']:.4f}{flag}")
    if reasons:
        print(f"    原因: {reasons}")
    for v in pr.get("temp_violations", []):
        print(f"    温控违规: {v['artwork_id']} 在 {v['route_id']}, "
              f"偏离{v['violation_degrees_c']}度, 度*时={v['degree_hours']}, "
              f"罚金={v['penalty_cny']}元")
    for e in pr.get("insurance_exposures", []):
        if e["exceeds_batch_limit"]:
            print(f"    保险超限: {e['artwork_id']}, 超出{e['over_limit_amount_cny']}元")

print()
print("=== 警告 ===")
for w in data["warnings"]:
    print(f"  [{w['severity']}] {w['warning_type']}")
    print(f"    影响批次: {w['affected_batch_ids']}")
    print(f"    影响作品: {w['affected_artwork_ids']}")
    print(f"    影响路线: {w['affected_route_ids']}")

print()
print("=== 公式示例 (B-002) ===")
pr2 = data["path_results"][1]
for k, v in pr2["formula_detail"].items():
    if isinstance(v, dict) and "formula" in v:
        print(f"  {k}: {v['formula']}")
        print(f"    输入: {v['inputs']}")
        res = v.get("result", v.get("adjusted_composite", "N/A"))
        print(f"    结果: {res}")

print()
print("=== 总结 ===")
s = data["summary"]
print(f"  批次数: {s['total_batches']}")
print(f"  作品数: {s['total_artworks']}")
print(f"  总保额: {s['total_insurance_cny']/1e6:.1f}M CNY")
print(f"  警告数: {s['warnings_count']} (高={s['high_severity_warnings']}, 中={s['medium_severity_warnings']})")
print(f"  需特殊处理批次: {s['batches_requiring_special_handling']}")
print(f"  风险分范围: {s['risk_score_range']}")
print()
print("ALL CHECKS PASSED")
