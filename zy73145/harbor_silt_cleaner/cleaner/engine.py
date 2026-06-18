import numpy as np
from collections import defaultdict
from config import DRIFT_THRESHOLD, OUTLIER_STD_THRESHOLD, SOURCE_LABELS
from models.records import SiltRecord


def _group_by_station(records):
    groups = defaultdict(list)
    for r in records:
        groups[r.station].append(r)
    return groups


def detect_drift(records):
    """检测传感器漂移：与同站同来源中位数偏差超过阈值"""
    groups = defaultdict(lambda: defaultdict(list))
    for r in records:
        if r.source in ("sensor_a", "sensor_b"):
            groups[r.station][r.source].append(r.silt_depth)

    station_source_median = {}
    for st, src_map in groups.items():
        for src, vals in src_map.items():
            if len(vals) >= 3:
                station_source_median[(st, src)] = np.median(vals)

    for r in records:
        key = (r.station, r.source)
        if key in station_source_median and r.source in ("sensor_a", "sensor_b"):
            median_val = station_source_median[key]
            if median_val > 0:
                deviation = abs(r.silt_depth - median_val) / median_val
                if deviation > DRIFT_THRESHOLD:
                    r.is_drift = True
                    if not r.drift_reason:
                        r.drift_reason = f"与同源同站中位数偏差{deviation:.1%}，疑似漂移"
    return records


def detect_outliers(records):
    """检测全局离群值（仅对正常来源数据）"""
    normal_records = [
        r for r in records
        if not r.is_drift and r.source not in ("lab_result_old", "verbal_note", "manual_override")
    ]
    if len(normal_records) < 5:
        return records

    vals = [r.silt_depth for r in normal_records]
    mean_val = np.mean(vals)
    std_val = np.std(vals)

    if std_val == 0:
        return records

    for r in normal_records:
        z = abs(r.silt_depth - mean_val) / std_val
        if z > OUTLIER_STD_THRESHOLD:
            r.is_outlier = True

    return records


def tag_source_influence(records):
    """标记各条记录对结论的影响来源"""
    for r in records:
        influence_tags = []
        if r.source == "lab_result_old":
            influence_tags.append("历史旧版数据")
        if r.is_override:
            influence_tags.append("人工改判")
        if r.source == "verbal_note":
            influence_tags.append("口头备注")
        if r.is_drift:
            influence_tags.append("传感器漂移")
        if r.is_outlier:
            influence_tags.append("统计离群")
        r._influence_tags = influence_tags
    return records


def clean_records(raw_records):
    """完整清洗流程"""
    records = [SiltRecord(**r) if isinstance(r, dict) else r for r in raw_records]

    records = detect_drift(records)
    records = detect_outliers(records)
    records = tag_source_influence(records)

    return records


def build_summary(records, filter_criteria=None):
    """
    构建汇总，包含：
    - 总体统计
    - 按站点统计
    - 按来源分布
    - 异常明细（拉动结果的关键点）
    - 筛选口径回显
    """
    normal = [r for r in records if not r.is_drift and not r.is_outlier
              and r.source not in ("lab_result_old", "verbal_note")]
    anomalies = [r for r in records if r.is_drift or r.is_outlier
                 or r.source in ("lab_result_old", "verbal_note")
                 or r.is_override]

    normal_vals = [r.silt_depth for r in normal]
    all_vals = [r.silt_depth for r in records]

    station_stats = {}
    stations = set(r.station for r in records)
    for st in sorted(stations):
        st_records = [r for r in normal if r.station == st]
        if st_records:
            st_vals = [r.silt_depth for r in st_records]
            station_stats[st] = {
                "count": len(st_vals),
                "avg_silt_depth": round(float(np.mean(st_vals)), 3),
                "max_silt_depth": round(float(np.max(st_vals)), 3),
                "min_silt_depth": round(float(np.min(st_vals)), 3),
            }

    source_dist = {}
    for r in records:
        src = r.source
        source_dist.setdefault(src, {"count": 0, "label": SOURCE_LABELS.get(src, src)})
        source_dist[src]["count"] += 1

    anomaly_details = []
    for r in anomalies:
        anomaly_details.append({
            "id": r.id,
            "station": r.station,
            "measure_time": r.measure_time,
            "silt_depth": r.silt_depth,
            "source": r.source,
            "source_label": SOURCE_LABELS.get(r.source, r.source),
            "is_drift": r.is_drift,
            "is_outlier": r.is_outlier,
            "is_override": r.is_override,
            "drift_reason": r.drift_reason,
            "override_note": r.override_note,
            "influence_tags": getattr(r, "_influence_tags", []),
            "raw_value": r.raw_value,
        })

    influence_summary = {
        "lab_result_old": sum(1 for r in records if r.source == "lab_result_old"),
        "manual_override": sum(1 for r in records if r.is_override),
        "verbal_note": sum(1 for r in records if r.source == "verbal_note"),
        "sensor_drift": sum(1 for r in records if r.is_drift),
        "statistical_outlier": sum(1 for r in records if r.is_outlier),
    }

    summary = {
        "total_records": len(records),
        "valid_records": len(normal),
        "anomaly_records": len(anomalies),
        "overall_avg_silt_depth": round(float(np.mean(normal_vals)), 3) if normal_vals else 0,
        "overall_avg_raw": round(float(np.mean(all_vals)), 3),
        "pull_up_amount": round(float(np.mean(all_vals) - np.mean(normal_vals)), 3) if normal_vals else 0,
        "station_stats": station_stats,
        "source_distribution": source_dist,
        "influence_summary": influence_summary,
        "anomaly_details": anomaly_details,
        "filter_criteria": filter_criteria or {},
    }

    return summary
