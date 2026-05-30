from typing import List, Dict, Any
from .physics import ShotParams, ShotResult, compute_trajectory, format_result_detail
from .validation import validate_shot_record, apply_corrections, format_validation_report


def compare_shots(records: List[Dict[str, Any]]) -> str:
    if len(records) < 2:
        return "至少需要2条记录才能对比"

    lines = []
    lines.append("=" * 70)
    lines.append("参数对比")
    lines.append("-" * 70)

    results: List[Dict[str, Any]] = []

    for idx, rec in enumerate(records):
        issues = validate_shot_record(rec)
        corrected = apply_corrections(rec, issues)

        angle = corrected.get("angle_deg")
        velocity = corrected.get("velocity_ms")
        if angle is None or velocity is None:
            results.append({
                "index": idx + 1,
                "name": rec.get("player_name", f"记录{idx + 1}"),
                "result": None,
                "issues": issues,
                "corrected": corrected,
            })
            continue

        params = ShotParams(
            angle_deg=angle,
            velocity_ms=velocity,
            release_height=corrected.get("release_height", 1.95),
            rim_height=corrected.get("rim_height", 3.048),
            rim_distance=corrected.get("rim_distance", 4.225),
        )
        shot_result = compute_trajectory(params)
        shot_result.correction_log = corrected.get("_corrections", [])

        results.append({
            "index": idx + 1,
            "name": rec.get("player_name", f"记录{idx + 1}"),
            "result": shot_result,
            "issues": issues,
            "corrected": corrected,
        })

    header_fields = ["角度(°)", "速度(m/s)", "出手高(m)", "偏差(m)", "入筐角(°)", "最高点(m)", "命中"]
    header = f"{'#':>3} {'姓名':<8} " + " ".join(f"{h:<10}" for h in header_fields)
    lines.append(header)
    lines.append("-" * len(header))

    for r in results:
        if r["result"] is None:
            lines.append(f"{r['index']:>3} {r['name']:<8} [数据不足，无法计算]")
            continue
        sr = r["result"]
        p = sr.params
        hit_str = "✓" if sr.hit else "✗"
        dev = f"{sr.y_deviation:+.3f}" if sr.y_deviation is not None else "N/A"
        entry = f"{sr.entry_angle_deg:.1f}" if sr.entry_angle_deg is not None else "N/A"
        apex = f"{sr.apex_height:.2f}" if sr.apex_height is not None else "N/A"
        line = (f"{r['index']:>3} {r['name']:<8} "
                f"{p.angle_deg:<10.2f} {p.velocity_ms:<10.2f} {p.release_height:<10.2f} "
                f"{dev:<10} {entry:<10} {apex:<10} {hit_str}")
        lines.append(line)

    lines.append("-" * 70)

    for r in results:
        if r["issues"]:
            lines.append(f"\n--- 记录{r['index']} {r['name']} 校验 ---")
            lines.append(format_validation_report(r["issues"]))
        if r["result"] and r["result"].correction_log:
            lines.append(f"  修正记录:")
            for c in r["result"].correction_log:
                lines.append(f"    → {c}")

    lines.append("=" * 70)
    return "\n".join(lines)
