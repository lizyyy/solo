from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
import json
from datetime import datetime
from data_models import Store
from core_logic import (
    version_match_questions, analyze_answer_coverage,
    compute_sequence, find_conclusion_influencers,
    link_original_to_processed, build_param_comparison
)

app = Flask(__name__, static_folder="static", static_url_path="")
CORS(app)


@app.route("/")
def index():
    return send_from_directory("static", "index.html")


# ============ Questions ============
@app.route("/api/questions", methods=["GET"])
def get_questions():
    return jsonify(Store.load("questions", []))


@app.route("/api/questions", methods=["POST"])
def save_questions():
    data = request.json or []
    Store.save("questions", data)
    return jsonify({"ok": True, "count": len(data)})


# ============ Materials ============
@app.route("/api/materials", methods=["GET"])
def get_materials():
    return jsonify(Store.load("materials", []))


@app.route("/api/materials", methods=["POST"])
def save_materials():
    data = request.json or []
    Store.save("materials", data)
    return jsonify({"ok": True, "count": len(data)})


# ============ Answers ============
@app.route("/api/answers", methods=["GET"])
def get_answers():
    return jsonify(Store.load("answers", []))


@app.route("/api/answers", methods=["POST"])
def save_answers():
    data = request.json or []
    Store.save("answers", data)
    return jsonify({"ok": True, "count": len(data)})


# ============ Notes (persistent across re-runs) ============
@app.route("/api/notes", methods=["GET"])
def get_notes():
    return jsonify(Store.load("notes", []))


@app.route("/api/notes", methods=["POST"])
def save_notes():
    data = request.json or []
    for n in data:
        if not n.get("timestamp"):
            n["timestamp"] = datetime.now().isoformat(timespec="seconds")
        if not n.get("nid"):
            n["nid"] = f"note_{abs(hash(repr(sorted(n.items())))) % 1000000}"
    Store.save("notes", data)
    return jsonify({"ok": True, "count": len(data)})


@app.route("/api/notes/add", methods=["POST"])
def add_note():
    n = request.json or {}
    notes = Store.load("notes", [])
    n["timestamp"] = datetime.now().isoformat(timespec="seconds")
    n["nid"] = n.get("nid") or f"note_{abs(hash(n['timestamp'] + n.get('content',''))) % 1000000}"
    notes.append(n)
    Store.save("notes", notes)
    return jsonify({"ok": True, "note": n})


# ============ Param sets ============
@app.route("/api/param_sets", methods=["GET"])
def get_param_sets():
    return jsonify(Store.load("param_sets", []))


@app.route("/api/param_sets", methods=["POST"])
def save_param_sets():
    data = request.json or []
    Store.save("param_sets", data)
    return jsonify({"ok": True, "count": len(data)})


# ============ Analysis: Question version groups ============
@app.route("/api/analysis/groups", methods=["GET"])
def analysis_groups():
    qs = Store.load("questions", [])
    groups = version_match_questions(qs)
    return jsonify(groups)


# ============ Analysis: Answer coverage per group ============
@app.route("/api/analysis/coverage", methods=["GET"])
def analysis_coverage():
    qs = Store.load("questions", [])
    ans = Store.load("answers", [])
    mats = Store.load("materials", [])
    groups = version_match_questions(qs)
    cov = analyze_answer_coverage(groups, ans, mats)
    return jsonify(cov)


# ============ Analysis: Compute sequence ============
@app.route("/api/analysis/compute", methods=["POST"])
def analysis_compute():
    body = request.json or {}
    pid = body.get("param_set_id", "ps_default")
    ps_list = Store.load("param_sets", [])
    ps = next((p for p in ps_list if p.get("pid") == pid), None)
    if ps is None:
        params = body.get("params", {"length": 20, "a": 1.0, "b": 0.0, "c_divisor": 1.0, "x0": 1.0})
        unit_config = body.get("unit_config", {"input": "", "output": "", "scale_input": 1.0, "scale_output": 1.0})
        qid = body.get("qid", "")
        aid = body.get("aid", "")
    else:
        params = ps.get("params", {})
        unit_config = ps.get("unit_config", {})
        qid = ps.get("qid", "")
        aid = ps.get("aid", "")
    points, calc_traces, dirty = compute_sequence(pid, params, unit_config, qid, aid)
    return jsonify({
        "param_set_id": pid,
        "params": params,
        "unit_config": unit_config,
        "points": points,
        "calc_traces": calc_traces,
        "dirty_points": dirty,
        "dirty_summary": {
            "total": len(dirty),
            "by_type": _group_by_type(dirty)
        }
    })


def _group_by_type(dirty):
    res = {}
    for d in dirty:
        for it in d.get("issues", []):
            t = it.get("type", "其他")
            sev = it.get("severity", "中")
            key = f"{t}({sev})"
            res[key] = res.get(key, 0) + 1
    return res


# ============ Analysis: Conclusion influencers ============
@app.route("/api/analysis/influencers", methods=["GET"])
def analysis_influencers():
    notes = Store.load("notes", [])
    mats = Store.load("materials", [])
    qs = Store.load("questions", [])
    ans = Store.load("answers", [])
    inf = find_conclusion_influencers(notes, mats, qs, ans)
    return jsonify(inf)


# ============ Analysis: Original <-> Processed bridge ============
@app.route("/api/analysis/bridge", methods=["GET"])
def analysis_bridge():
    qs = Store.load("questions", [])
    ans = Store.load("answers", [])
    notes = Store.load("notes", [])
    bridges = link_original_to_processed(qs, ans, notes)
    return jsonify(bridges)


# ============ Analysis: Two param set comparison ============
@app.route("/api/analysis/compare", methods=["POST"])
def analysis_compare():
    body = request.json or {}
    ids = body.get("param_set_ids", [])
    ps_list = Store.load("param_sets", [])
    picked = [p for p in ps_list if p.get("pid") in ids]
    if len(picked) < 2 and len(ids) >= 2:
        for pid in ids:
            if not any(p.get("pid") == pid for p in picked):
                picked.append({"pid": pid, "name": pid, "params": {}, "unit_config": {}, "sequence": []})
    for p in picked:
        if not p.get("sequence"):
            pts, _, _ = compute_sequence(
                p.get("pid", "p"), p.get("params", {}),
                p.get("unit_config", {}),
                p.get("qid", ""), p.get("aid", "")
            )
            p["sequence"] = pts
    result = build_param_comparison(picked)
    return jsonify(result)


# ============ Reset / Reload sample data ============
@app.route("/api/sample/load", methods=["POST"])
def load_sample():
    from sample_data import SAMPLE_QUESTIONS, SAMPLE_MATERIALS, SAMPLE_ANSWERS, SAMPLE_NOTES, SAMPLE_PARAM_SETS
    Store.save("questions", SAMPLE_QUESTIONS)
    Store.save("materials", SAMPLE_MATERIALS)
    Store.save("answers", SAMPLE_ANSWERS)
    Store.save("notes", SAMPLE_NOTES)
    Store.save("param_sets", SAMPLE_PARAM_SETS)
    return jsonify({"ok": True, "loaded": ["questions", "materials", "answers", "notes", "param_sets"]})


if __name__ == "__main__":
    os.makedirs("static", exist_ok=True)
    print("Starting server on port 5099...", flush=True)
    app.run(host="0.0.0.0", port=5099, debug=False, use_reloader=False)
