"""
温升异常归因核心算法
- 温度采样断档检测并标记为异常处理
- 温升异常区间识别
- 与维修照片、备件到货的关联归因
- 晚到备件对结论影响的说明
"""
import csv
import os
from datetime import datetime, timedelta
from collections import defaultdict

TEMP_THRESHOLD = 70.0
GAP_MINUTES = 15
WINDOW_BEFORE_HOURS = 24
WINDOW_AFTER_HOURS = 12

ATTRIBUTION_FIELDS = [
    "attribution_id", "cabinet_id", "anomaly_start", "anomaly_end",
    "peak_temp", "avg_temp", "sampling_gap_flag", "gap_details",
    "linked_photo_ids", "linked_part_codes", "root_cause",
    "late_part_impact", "conclusion_confidence", "process_status",
    "anomaly_type", "trace_notes"
]

def _p(s):
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d"):
        try:
            return datetime.strptime(s.strip(), fmt)
        except (ValueError, AttributeError):
            continue
    return None

def load_csv(pth):
    with open(pth, "r", encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))

def detect_gaps_and_anomalies(sampling_rows):
    """
    对每台配电柜：
    1. 按时间排序
    2. 相邻采样点 > GAP_MINUTES 记为采样断档
    3. 温度 >= TEMP_THRESHOLD 的连续段记为温升异常
    返回 {cabinet: {"gaps": [...], "anomalies": [...]}}
    """
    by_cab = defaultdict(list)
    for r in sampling_rows:
        t = _p(r.get("timestamp", ""))
        try:
            v = float(r.get("temperature_c", 0))
        except ValueError:
            continue
        if t:
            by_cab[r.get("cabinet_id", "")].append((t, v, r))
    
    result = {}
    for cab, points in by_cab.items():
        points.sort(key=lambda x: x[0])
        gaps = []
        for i in range(1, len(points)):
            dt = (points[i][0] - points[i-1][0]).total_seconds() / 60.0
            if dt > GAP_MINUTES:
                gaps.append({
                    "gap_start": points[i-1][0].strftime("%Y-%m-%d %H:%M:%S"),
                    "gap_end": points[i][0].strftime("%Y-%m-%d %H:%M:%S"),
                    "duration_minutes": round(dt, 1),
                    "before_temp": points[i-1][1],
                    "after_temp": points[i][1]
                })
        
        anomalies = []
        cur = None
        for t, v, raw in points:
            if v >= TEMP_THRESHOLD:
                if cur is None:
                    cur = {"start": t, "end": t, "peak": v, "sum": v, "cnt": 1, "samples": [raw]}
                else:
                    cur["end"] = t
                    cur["peak"] = max(cur["peak"], v)
                    cur["sum"] += v
                    cur["cnt"] += 1
                    cur["samples"].append(raw)
            else:
                if cur is not None:
                    anomalies.append(cur)
                    cur = None
        if cur is not None:
            anomalies.append(cur)
        
        anomalies_out = []
        for a in anomalies:
            anomalies_out.append({
                "start": a["start"].strftime("%Y-%m-%d %H:%M:%S"),
                "end": a["end"].strftime("%Y-%m-%d %H:%M:%S"),
                "peak": round(a["peak"], 1),
                "avg": round(a["sum"] / max(a["cnt"], 1), 1),
                "duration_hours": round((a["end"] - a["start"]).total_seconds() / 3600.0, 2),
                "samples": a["samples"]
            })
        result[cab] = {"gaps": gaps, "anomalies": anomalies_out}
    return result

def parse_shutdown_window(s):
    """解析 '2026-06-03 00:00-06:00' 这种格式"""
    try:
        date_part, time_part = s.strip().split(" ")
        st, et = time_part.split("-")
        start = datetime.strptime(f"{date_part} {st}", "%Y-%m-%d %H:%M")
        end = datetime.strptime(f"{date_part} {et}", "%Y-%m-%d %H:%M")
        return start, end
    except Exception:
        return None, None

def analyze_late_parts(parts_rows):
    """识别晚到备件，计算晚到多久，对哪个设备哪个窗口有影响"""
    late = []
    for p in parts_rows:
        sw_start, sw_end = parse_shutdown_window(p.get("计划停机窗口", ""))
        actual = _p(p.get("实际到货时间", ""))
        if sw_end and actual and actual > sw_end:
            late_hours = round((actual - sw_end).total_seconds() / 3600.0, 1)
            late.append({
                "part_code": p.get("备件编号", ""),
                "part_name": p.get("备件名称", ""),
                "cabinet_id": p.get("对应设备", ""),
                "shutdown_window": p.get("计划停机窗口", ""),
                "shutdown_end": sw_end.strftime("%Y-%m-%d %H:%M:%S"),
                "actual_arrival": actual.strftime("%Y-%m-%d %H:%M:%S"),
                "late_hours": late_hours,
                "reason": p.get("晚到原因", "未说明"),
                "supplier": p.get("供应商", "")
            })
    return late

def link_photos_to_anomaly(anomaly, photos):
    """把维修照片关联到异常时间窗口：异常前24h ~ 异常后12h"""
    a_start = _p(anomaly["start"])
    a_end = _p(anomaly["end"])
    if not a_start or not a_end:
        return []
    linked = []
    for ph in photos:
        pt = _p(ph.get("shoot_time", ""))
        if not pt:
            continue
        if (a_start - timedelta(hours=WINDOW_BEFORE_HOURS)) <= pt <= (a_end + timedelta(hours=WINDOW_AFTER_HOURS)):
            linked.append(ph)
    return linked

def determine_root_cause(anomaly, linked_photos, late_parts, gaps, cabinet_id):
    """
    归因规则：
    - 存在采样断档覆盖异常时段开头 → 标记为 异常处理/数据缺失，结论可信度降低
    - 存在晚到备件（窗口结束后才到），且该备件对应设备 → 晚到备件→未能按时更换→持续高温
    - 有对应部位照片（散热风扇/电容等）且 suggestion="待备件/需更换" → 备件未及时更换
    - 默认：负载过高待核查
    """
    has_gap_impact = False
    gap_detail_text = ""
    a_start = _p(anomaly["start"])
    a_end = _p(anomaly["end"])
    for g in gaps:
        gs = _p(g["gap_start"])
        ge = _p(g["gap_end"])
        if gs and ge and a_start and a_end and not (ge < a_start or gs > a_end):
            has_gap_impact = True
            gap_detail_text += f"{g['gap_start']}~{g['gap_end']}({g['duration_minutes']}分钟);"
    
    matching_late = [lp for lp in late_parts if lp["cabinet_id"] == cabinet_id]
    
    photo_part_names = [p.get("part_name", "") for p in linked_photos]
    photo_suggestions = [p.get("suggestion", "") for p in linked_photos]
    
    root_cause = "常规温升，待人工确认"
    impact = ""
    confidence = "中"
    anomaly_type = "normal_overheat"
    
    if matching_late:
        lp = matching_late[0]
        root_cause = (f"{lp['part_name']}(编号{lp['part_code']})到货晚于计划停机窗口"
                      f"{lp['late_hours']}小时，导致窗口内无法更换，异常持续存在")
        impact = (f"【关键链路】计划停机窗口 {lp['shutdown_window']} 内应更换 {lp['part_name']}，"
                  f"但实际到货 {lp['actual_arrival']}（晚到{lp['late_hours']}h，原因：{lp['reason']}）。"
                  f"→ 停机窗口期未能执行更换 → 设备带病运行 → 异常从 {anomaly['start']} 持续至 {anomaly['end']}，"
                  f"峰值 {anomaly['peak']}℃。"
                  f"若按时到货并更换，预计可在窗口内消除异常并降低后续至少 {WINDOW_AFTER_HOURS}h 的温升风险。")
        confidence = "高"
        anomaly_type = "late_part_caused"
    elif "待备件" in photo_suggestions or "需更换" in photo_suggestions:
        root_cause = f"关联维修照片指示部件{','.join(set(photo_part_names))}待更换/待备件，散热能力下降"
        confidence = "中高"
        anomaly_type = "part_to_replace"
    elif has_gap_impact:
        root_cause = "数据异常：采样断档覆盖异常时段，无法完整还原温升曲线"
        confidence = "低"
        anomaly_type = "data_gap_issue"
    
    if has_gap_impact:
        anomaly_type = anomaly_type + "+data_gap"
    
    return {
        "root_cause": root_cause,
        "late_part_impact": impact,
        "confidence": confidence,
        "anomaly_type": anomaly_type,
        "sampling_gap_flag": "是" if has_gap_impact else "否",
        "gap_details": gap_detail_text
    }

def run_attribution(sampling_path, normalized_photos_path, parts_path, output_path):
    sampling = load_csv(sampling_path)
    photos = load_csv(normalized_photos_path)
    parts = load_csv(parts_path)
    
    analyzed = detect_gaps_and_anomalies(sampling)
    late_parts = analyze_late_parts(parts)
    
    attributions = []
    aid = 1
    for cab, info in analyzed.items():
        for anomaly in info["anomalies"]:
            linked_ph = link_photos_to_anomaly(anomaly, photos)
            diagnosis = determine_root_cause(anomaly, linked_ph, late_parts, info["gaps"], cab)
            
            trace_parts = []
            for lp in late_parts:
                if lp["cabinet_id"] == cab:
                    trace_parts.append(lp["part_code"])
            
            attributions.append({
                "attribution_id": f"ATTR-{aid:04d}",
                "cabinet_id": cab,
                "anomaly_start": anomaly["start"],
                "anomaly_end": anomaly["end"],
                "peak_temp": anomaly["peak"],
                "avg_temp": anomaly["avg"],
                "sampling_gap_flag": diagnosis["sampling_gap_flag"],
                "gap_details": diagnosis["gap_details"],
                "linked_photo_ids": ",".join(p["photo_id"] for p in linked_ph),
                "linked_part_codes": ",".join(trace_parts),
                "root_cause": diagnosis["root_cause"],
                "late_part_impact": diagnosis["late_part_impact"],
                "conclusion_confidence": diagnosis["confidence"],
                "process_status": "异常处理" if diagnosis["sampling_gap_flag"] == "是" or diagnosis["anomaly_type"].startswith("late") else "已归因",
                "anomaly_type": diagnosis["anomaly_type"],
                "trace_notes": f"温度样本数:{len(anomaly['samples'])};关联照片:{len(linked_ph)};晚到备件:{len(trace_parts)}"
            })
            aid += 1
        
        for g in info["gaps"]:
            gs = _p(g["gap_start"])
            ge = _p(g["gap_end"])
            linked_ph = link_photos_to_anomaly(
                {"start": g["gap_start"], "end": g["gap_end"]}, photos
            )
            attributions.append({
                "attribution_id": f"ATTR-{aid:04d}",
                "cabinet_id": cab,
                "anomaly_start": g["gap_start"],
                "anomaly_end": g["gap_end"],
                "peak_temp": max(g["before_temp"], g["after_temp"]),
                "avg_temp": round((g["before_temp"] + g["after_temp"]) / 2.0, 1),
                "sampling_gap_flag": "是",
                "gap_details": (f"独立断档条目：{g['gap_start']}~{g['gap_end']}，"
                                f"持续{g['duration_minutes']}分钟；"
                                f"断档前温度{g['before_temp']}℃→断档后{g['after_temp']}℃"),
                "linked_photo_ids": ",".join(p["photo_id"] for p in linked_ph),
                "linked_part_codes": "",
                "root_cause": (f"采样断档（{g['duration_minutes']}分钟）："
                               "该时段无温度数据，无法判断是否发生温升，按异常处理"),
                "late_part_impact": "",
                "conclusion_confidence": "低（数据缺失）",
                "process_status": "异常处理",
                "anomaly_type": "standalone_data_gap",
                "trace_notes": (f"本行为独立生成的断档条目；"
                                f"断档前温度{g['before_temp']}℃ 断档后{g['after_temp']}℃")
            })
            aid += 1
    
    fieldnames = ATTRIBUTION_FIELDS
    with open(output_path, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(attributions)
    return attributions, late_parts, analyzed

if __name__ == "__main__":
    attrs, late, _ = run_attribution(
        "data/temperature_sampling.csv",
        "output/normalized_photos.csv",
        "data/spare_parts.csv",
        "output/attribution_result.csv"
    )
    print(f"归因条目: {len(attrs)}")
    print(f"晚到备件数: {len(late)}")
    for a in attrs:
        if a["late_part_impact"]:
            print(f"  [{a['attribution_id']}] {a['cabinet_id']} 含晚到备件影响说明")
        if a["sampling_gap_flag"] == "是":
            print(f"  [{a['attribution_id']}] {a['cabinet_id']} 标记采样断档=异常处理")
