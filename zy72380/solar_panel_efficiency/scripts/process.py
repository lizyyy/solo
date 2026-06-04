import json
import os
import sys
from datetime import datetime
from copy import deepcopy

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(PROJECT_ROOT, "data")
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "output")

QUALITY_STATUSES = {
    "normal": "正常",
    "gap_detected": "采样间隙-待质检员复核",
    "photo_supplemented": "工况照片补录-旧口径",
    "qa_passed": "质检通过",
    "qa_rejected": "质检驳回",
}

OLD_CALIBRATION_FACTOR = 0.98
NEW_CALIBRATION_FACTOR = 1.00


def load_samples():
    with open(os.path.join(DATA_DIR, "samples.json"), "r", encoding="utf-8") as f:
        return json.load(f)


def calc_efficiency(record, calibration_factor=NEW_CALIBRATION_FACTOR):
    results = []
    for point in record["data"]:
        inlet = point["inlet_temp"]
        outlet = point["outlet_temp"]
        irradiance = point["irradiance"]
        flow_rate_lpm = point["flow_rate"]
        cp = 4186
        delta_t = (outlet - inlet) * calibration_factor
        flow_rate_kg_s = flow_rate_lpm / 60.0
        q_useful = flow_rate_kg_s * cp * delta_t
        a_collector = 2.0
        q_solar = irradiance * a_collector
        if q_solar > 0:
            eff = (q_useful / q_solar) * 100
        else:
            eff = 0.0
        source = point.get("source", "sensor")
        calibration = point.get("calibration", "new")
        results.append({
            "time": point["time"],
            "inlet_temp": inlet,
            "outlet_temp": outlet,
            "irradiance": irradiance,
            "efficiency_percent": round(eff, 2),
            "source": source,
            "calibration": calibration,
        })
    return results


def step1_import(data):
    print("=" * 64)
    print("步骤1：传感器编号第一次导入")
    print("=" * 64)
    imported = []
    for rec in data["records"]:
        status = rec["status"]
        if status == "gap_detected":
            quality_status = "gap_detected"
        elif status == "photo_supplemented":
            quality_status = "photo_supplemented"
        else:
            quality_status = "normal"
        imported_rec = deepcopy(rec)
        imported_rec["quality_status"] = quality_status
        imported_rec["quality_status_label"] = QUALITY_STATUSES[quality_status]
        imported.append(imported_rec)
        print(f"  传感器 {rec['sensor_id']}: {rec['sensor_type']}")
        print(f"    采样区间: {rec['sampling_start']} ~ {rec['sampling_end']}")
        print(f"    预期点数: {rec['expected_points']}, 实际点数: {rec['actual_points']}")
        if quality_status == "gap_detected":
            gap_s = rec.get("gap_start", "")
            gap_e = rec.get("gap_end", "")
            print(f"    ⚠ 检测到采样间隙: {gap_s} ~ {gap_e}")
            print(f"    → 状态: {QUALITY_STATUSES[quality_status]}（不自动归正常，留给质检员复核）")
        elif quality_status == "photo_supplemented":
            print(f"    ℹ 工况照片补录: {rec['photo_reference']}")
            print(f"    → 状态: {QUALITY_STATUSES[quality_status]}")
        else:
            print(f"    → 状态: {QUALITY_STATUSES[quality_status]}")
        print()
    return imported


def step2_photo_review(imported):
    print("=" * 64)
    print("步骤2：林老师补看工况照片")
    print("=" * 64)
    reviewed = deepcopy(imported)
    for rec in reviewed:
        photo_ref = rec.get("photo_reference")
        if photo_ref:
            print(f"  传感器 {rec['sensor_id']}: 工况照片 {photo_ref}")
            if rec["quality_status"] == "gap_detected":
                print(f"    → 发现间隙时段10:30-11:00在照片中有对应读数")
                print(f"    → 林老师查看照片：照片中有旧口径仪表读数，可补录")
                print(f"    → 但采样时间缺了半小时，不急着归正常，留给质检员复核")
                print(f"    → 已记录照片参考，状态保持：{QUALITY_STATUSES['gap_detected']}")
                rec["correction_log"].append({
                    "step": len(rec["correction_log"]) + 1,
                    "action": "photo_review",
                    "timestamp": datetime.now().isoformat(timespec="seconds"),
                    "operator": "林老师",
                    "detail": f"查看了{photo_ref}，照片中有旧口径仪表读数可供补录，但需质检员复核后再决定",
                })
                gap_start = rec.get("gap_start")
                gap_end = rec.get("gap_end")
                if gap_start:
                    print(f"    → 间隙时段: {gap_start} ~ {gap_end}")
                    print(f"    → 照片可补录，但需质检员确认后才执行补录操作")
            elif rec["quality_status"] == "photo_supplemented":
                print(f"    → 已在导入时完成补录（旧口径），此处仅确认")
                print(f"    → 旧口径校准系数={OLD_CALIBRATION_FACTOR}，效率值可能偏高约2%")
            print()
        else:
            print(f"  传感器 {rec['sensor_id']}: 无工况照片（正常记录，无需补录）")
            print()
    return reviewed


def step3_review_chart(reviewed):
    print("=" * 64)
    print("步骤3：实验复盘图更新")
    print("=" * 64)
    chart_data = []
    history_records = []
    for rec in reviewed:
        calibration_factor = NEW_CALIBRATION_FACTOR
        has_old = any(p.get("calibration") == "old" for p in rec["data"])
        if has_old:
            calibration_factor = OLD_CALIBRATION_FACTOR
        eff_results = calc_efficiency(rec, calibration_factor=1.0)
        for p in rec["data"]:
            if p.get("calibration") == "old":
                p_idx = rec["data"].index(p)
                eff_results[p_idx]["calibration"] = "old"
                eff_results[p_idx]["efficiency_percent"] = round(
                    eff_results[p_idx]["efficiency_percent"] * OLD_CALIBRATION_FACTOR, 2
                )
        avg_eff = sum(e["efficiency_percent"] for e in eff_results) / len(eff_results) if eff_results else 0
        sensor_chart = {
            "sensor_id": rec["sensor_id"],
            "quality_status": rec["quality_status"],
            "quality_status_label": QUALITY_STATUSES[rec["quality_status"]],
            "avg_efficiency": round(avg_eff, 2),
            "data_points": len(eff_results),
            "has_gap": rec["actual_points"] < rec["expected_points"],
            "has_old_calibration": has_old,
            "efficiency_series": eff_results,
        }
        chart_data.append(sensor_chart)
        sensor_history = {
            "sensor_id": rec["sensor_id"],
            "operator": rec.get("note", ""),
            "status": rec["quality_status"],
            "status_label": QUALITY_STATUSES[rec["quality_status"]],
            "correction_steps": rec["correction_log"],
            "avg_efficiency": round(avg_eff, 2),
            "calibration_note": "旧口径(0.98)补录，效率偏高约2%" if has_old else "标准校准",
        }
        history_records.append(sensor_history)
        print(f"  传感器 {rec['sensor_id']}:")
        print(f"    质量状态: {QUALITY_STATUSES[rec['quality_status']]}")
        print(f"    数据点数: {len(eff_results)}")
        print(f"    平均效率: {avg_eff:.2f}%")
        if has_old:
            print(f"    ⚠ 含旧口径补录点，已乘以校准系数{OLD_CALIBRATION_FACTOR}")
        if rec["quality_status"] == "gap_detected":
            print(f"    ⚠ 采样间隙未修复，等待质检员复核")
        print()
    return chart_data, history_records


def save_outputs(chart_data, history_records):
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    chart_path = os.path.join(OUTPUT_DIR, "review_chart.json")
    history_path = os.path.join(OUTPUT_DIR, "history_records.json")
    with open(chart_path, "w", encoding="utf-8") as f:
        json.dump(chart_data, f, ensure_ascii=False, indent=2)
    with open(history_path, "w", encoding="utf-8") as f:
        json.dump(history_records, f, ensure_ascii=False, indent=2)
    return chart_path, history_path


def print_comparison(chart_data):
    print("=" * 64)
    print("三种处理结果对比")
    print("=" * 64)
    print(f"{'传感器':<10} {'质量状态':<28} {'平均效率':<10} {'旧口径':<6} {'间隙':<6}")
    print("-" * 64)
    for item in chart_data:
        print(
            f"{item['sensor_id']:<10} "
            f"{item['quality_status_label']:<28} "
            f"{item['avg_efficiency']:<10.2f} "
            f"{'是' if item['has_old_calibration'] else '否':<6} "
            f"{'是' if item['has_gap'] else '否':<6}"
        )
    print()
    normal = [c for c in chart_data if c["quality_status"] == "normal"]
    gap = [c for c in chart_data if c["quality_status"] == "gap_detected"]
    supplemented = [c for c in chart_data if c["quality_status"] == "photo_supplemented"]
    if normal:
        print(f"  顺利记录 {normal[0]['sensor_id']}: 效率 {normal[0]['avg_efficiency']:.2f}%，数据完整，直接可用")
    if gap:
        print(f"  缺失记录 {gap[0]['sensor_id']}: 效率 {gap[0]['avg_efficiency']:.2f}%，间隙未修复，等待质检员复核")
    if supplemented:
        print(f"  补录记录 {supplemented[0]['sensor_id']}: 效率 {supplemented[0]['avg_efficiency']:.2f}%，旧口径补录，需注意偏高")
    print()


def print_rerun_command():
    print("=" * 64)
    print("可重新跑的命令")
    print("=" * 64)
    print("  python3 scripts/process.py           # 完整流程")
    print("  python3 scripts/process.py --step 1   # 仅导入")
    print("  python3 scripts/process.py --step 2   # 仅补看工况照片")
    print("  python3 scripts/process.py --step 3   # 仅复盘图更新")
    print("  bash run_demo.sh                     # 一键重跑（清空output后重跑）")
    print()


def main():
    step_filter = None
    if "--step" in sys.argv:
        idx = sys.argv.index("--step")
        if idx + 1 < len(sys.argv):
            step_filter = int(sys.argv[idx + 1])

    data = load_samples()
    print(f"\n实验项目: {data['experiment']}")
    print(f"操作人员: {data['operator']}")
    print(f"实验日期: {data['date']}")
    print(f"记录条数: {len(data['records'])}\n")

    if step_filter is None or step_filter == 1:
        imported = step1_import(data)
    else:
        imported = deepcopy(data["records"])
        for rec in imported:
            rec["quality_status"] = rec["status"]
            rec["quality_status_label"] = QUALITY_STATUSES.get(rec["status"], rec["status"])

    if step_filter is None or step_filter == 2:
        reviewed = step2_photo_review(imported)
    else:
        reviewed = imported

    if step_filter is None or step_filter == 3:
        chart_data, history_records = step3_review_chart(reviewed)
        chart_path, history_path = save_outputs(chart_data, history_records)
        print(f"复盘图已保存: {chart_path}")
        print(f"历史记录已保存: {history_path}")
        print()
        print_comparison(chart_data)

    print_rerun_command()


if __name__ == "__main__":
    main()
