from flask import Flask, jsonify, request
from data.generator import generate_raw_records
from cleaner.engine import clean_records, build_summary
from cleaner.snapshots import snapshot_manager
from config import SOURCE_LABELS

app = Flask(__name__)

_raw_cache = None


def _get_raw():
    global _raw_cache
    if _raw_cache is None:
        _raw_cache = generate_raw_records(70)
    return _raw_cache


def _apply_filter(records, params):
    filtered = list(records)
    if params.get("station"):
        st = params["station"]
        filtered = [r for r in filtered if r.station == st]
    if params.get("source"):
        src = params["source"]
        filtered = [r for r in filtered if r.source == src]
    if params.get("exclude_drift"):
        filtered = [r for r in filtered if not r.is_drift]
    if params.get("exclude_old") == "true":
        filtered = [r for r in filtered if r.source != "lab_result_old"]
    if params.get("exclude_verbal") == "true":
        filtered = [r for r in filtered if r.source != "verbal_note"]
    if params.get("only_valid") == "true":
        filtered = [
            r for r in filtered
            if not r.is_drift and not r.is_outlier
            and r.source not in ("lab_result_old", "verbal_note")
        ]
    return filtered


@app.route("/api/silt/clean", methods=["GET"])
def api_clean():
    """
    核心清洗接口：返回带筛选口径、汇总、异常明细的完整结果
    筛选参数：station, source, exclude_drift, exclude_old, exclude_verbal, only_valid
    """
    params = request.args.to_dict()
    raw = _get_raw()
    cleaned = clean_records(raw)
    filtered = _apply_filter(cleaned, params)
    summary = build_summary(filtered, filter_criteria=params)

    records_out = []
    for r in filtered:
        d = r.to_dict()
        d["influence_tags"] = getattr(r, "_influence_tags", [])
        d["source_label"] = SOURCE_LABELS.get(r.source, r.source)
        records_out.append(d)

    return jsonify({
        "filter_criteria": summary["filter_criteria"],
        "summary": {
            "total_records": summary["total_records"],
            "valid_records": summary["valid_records"],
            "anomaly_records": summary["anomaly_records"],
            "overall_avg_silt_depth": summary["overall_avg_silt_depth"],
            "overall_avg_raw": summary["overall_avg_raw"],
            "pull_up_amount": summary["pull_up_amount"],
            "station_stats": summary["station_stats"],
            "source_distribution": summary["source_distribution"],
            "influence_summary": summary["influence_summary"],
        },
        "anomaly_details": summary["anomaly_details"],
        "records": records_out,
    })


@app.route("/api/silt/records/<record_id>", methods=["GET"])
def api_record_detail(record_id):
    """单条记录明细下钻——点到异常时看得到哪里拉动了结果"""
    raw = _get_raw()
    cleaned = clean_records(raw)
    for r in cleaned:
        if r.id == record_id:
            d = r.to_dict()
            d["influence_tags"] = getattr(r, "_influence_tags", [])
            d["source_label"] = SOURCE_LABELS.get(r.source, r.source)
            d["impact_analysis"] = {
                "affects_overall_avg": True,
                "contribution_to_pull_up": _calc_contribution(r, cleaned),
            }
            return jsonify(d)
    return jsonify({"error": "not found"}), 404


def _calc_contribution(record, all_records):
    normal = [
        r for r in all_records
        if not r.is_drift and not r.is_outlier
        and r.source not in ("lab_result_old", "verbal_note")
    ]
    if not normal:
        return 0
    normal_avg = sum(r.silt_depth for r in normal) / len(normal)
    all_avg = sum(r.silt_depth for r in all_records) / len(all_records)
    total_pull = all_avg - normal_avg
    if total_pull == 0:
        return 0
    return round((record.silt_depth - normal_avg) / len(all_records) / total_pull, 3)


@app.route("/api/silt/snapshots", methods=["GET"])
def api_list_snapshots():
    confirmed_only = request.args.get("confirmed_only") == "true"
    return jsonify({"snapshots": snapshot_manager.list_snapshots(confirmed_only)})


@app.route("/api/silt/snapshots", methods=["POST"])
def api_create_snapshot():
    data = request.get_json(force=True, silent=True) or {}
    name = data.get("name", "未命名快照")

    params = data.get("filter_criteria", {})
    raw = _get_raw()
    cleaned = clean_records(raw)
    filtered = _apply_filter(cleaned, params)
    summary = build_summary(filtered, filter_criteria=params)

    snap = snapshot_manager.create_snapshot(name, summary, filtered, params)
    return jsonify(snap)


@app.route("/api/silt/snapshots/<snap_id>", methods=["GET"])
def api_get_snapshot(snap_id):
    snap = snapshot_manager.get_snapshot(snap_id)
    if not snap:
        return jsonify({"error": "not found"}), 404
    return jsonify(snap)


@app.route("/api/silt/snapshots/<snap_id>/confirm", methods=["POST"])
def api_confirm_snapshot(snap_id):
    data = request.get_json(force=True, silent=True) or {}
    operator = data.get("operator", "老何")
    snap = snapshot_manager.confirm_snapshot(snap_id, operator)
    if not snap:
        return jsonify({"error": "not found"}), 404
    return jsonify(snap)


@app.route("/api/silt/snapshots/compare", methods=["GET"])
def api_compare_snapshots():
    id1 = request.args.get("from")
    id2 = request.args.get("to")
    if not id1 or not id2:
        return jsonify({"error": "需要 from 和 to 参数"}), 400
    result = snapshot_manager.compare_snapshots(id1, id2)
    if not result:
        return jsonify({"error": "快照不存在"}), 404
    return jsonify(result)


@app.route("/api/silt/summary/for_meeting", methods=["GET"])
def api_for_meeting():
    """
    周一早会专用接口——直接能拿去沟通的返回
    包含：当前结论、比上次变化、异常要点、谁影响了结论
    """
    raw = _get_raw()
    cleaned = clean_records(raw)
    summary = build_summary(cleaned, filter_criteria={"view": "meeting"})

    influence_text = []
    infl = summary["influence_summary"]
    if infl["lab_result_old"] > 0:
        influence_text.append(f"混入旧版实验室数据 {infl['lab_result_old']} 条，已标注待核实")
    if infl["manual_override"] > 0:
        influence_text.append(f"人工改判 {infl['manual_override']} 条，已保留修改痕迹")
    if infl["verbal_note"] > 0:
        influence_text.append(f"口头备注 {infl['verbal_note']} 条，未计入正式结果")
    if infl["sensor_drift"] > 0:
        influence_text.append(f"检出传感器漂移 {infl['sensor_drift']} 条，已从均值中剔除")
    if infl["statistical_outlier"] > 0:
        influence_text.append(f"统计离群值 {infl['statistical_outlier']} 条")

    anomalies_top = sorted(
        summary["anomaly_details"],
        key=lambda x: x["silt_depth"],
        reverse=True,
    )[:3]

    snapshots = snapshot_manager.list_snapshots()
    last_confirmed = None
    for s in reversed(snapshots):
        if s["confirmed"]:
            last_confirmed = s
            break

    return jsonify({
        "report_title": "港湾淤积数据清洗结果（可直接用于早会沟通）",
        "generated_at": summary.get("generated_at", ""),
        "filter_criteria": summary["filter_criteria"],
        "conclusion": {
            "overall_avg_silt_depth": summary["overall_avg_silt_depth"],
            "valid_record_count": summary["valid_records"],
            "total_record_count": summary["total_records"],
            "unit": "米",
        },
        "pull_up_analysis": {
            "raw_avg": summary["overall_avg_raw"],
            "cleaned_avg": summary["overall_avg_silt_depth"],
            "pull_up_amount": summary["pull_up_amount"],
            "description": f"未清洗均值比清洗后高 {summary['pull_up_amount']} 米，主要由异常数据拉动",
        },
        "station_breakdown": summary["station_stats"],
        "source_influence": {
            "summary": infl,
            "description_lines": influence_text,
        },
        "key_anomalies": anomalies_top,
        "last_confirmed": last_confirmed,
    })


@app.route("/api/silt/sources", methods=["GET"])
def api_sources():
    return jsonify({
        "sources": [
            {"key": k, "label": v}
            for k, v in SOURCE_LABELS.items()
        ]
    })


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
