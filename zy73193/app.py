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
    answers = Store.load("answers", [])
    materials = Store.load("materials", [])
    notes = Store.load("notes", [])
    ps = next((p for p in ps_list if p.get("pid") == pid), None)

    if ps is None:
        params = body.get("params", {"length": 20, "a": 1.0, "b": 0.0, "c_divisor": 1.0, "x0": 1.0})
        unit_config = body.get("unit_config", {"input": "", "output": "", "scale_input": 1.0, "scale_output": 1.0})
        qid = body.get("qid", "")
        aid = body.get("aid", "")
        param_set_name = body.get("param_set_name", pid)
    else:
        params = ps.get("params", {})
        if body.get("params"):
            params = body["params"]
        unit_config = ps.get("unit_config", {})
        if body.get("unit_config"):
            unit_config = body["unit_config"]
        qid = ps.get("qid", body.get("qid", ""))
        aid = ps.get("aid", body.get("aid", ""))
        param_set_name = ps.get("name", body.get("param_set_name", pid))

    answer = next((a for a in answers if a.get("aid") == aid), None)
    material = None
    if answer and answer.get("material_mid"):
        material = next((m for m in materials if m.get("mid") == answer["material_mid"]), None)

    related_notes = [n for n in notes if
        (n.get("target_type") == "question" and n.get("target_id") == qid) or
        (n.get("target_type") == "answer" and n.get("target_id") == aid) or
        (material and n.get("target_type") == "material" and n.get("target_id") == material.get("mid"))]

    points, calc_traces, dirty = compute_sequence(pid, params, unit_config, qid, aid)

    response = {
        "param_set_id": pid,
        "param_set_name": param_set_name,
        "ps_index": body.get("ps_index", ""),
        "params": params,
        "unit_config": unit_config,
        "qid": qid,
        "aid": aid,
        "question": next((q for q in Store.load("questions", []) if q.get("qid") == qid), None),
        "answer": answer,
        "material": material,
        "notes": related_notes,
        "points": points,
        "calc_traces": calc_traces,
        "dirty_points": dirty,
        "dirty_summary": {
            "total": len(dirty),
            "by_type": _group_by_type(dirty)
        }
    }
    return jsonify(response)


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
    answers = Store.load("answers", [])
    materials = Store.load("materials", [])
    questions = Store.load("questions", [])
    notes = Store.load("notes", [])

    picked = []
    for pid in ids:
        ps = next((p for p in ps_list if p.get("pid") == pid), None)
        if ps is None:
            ps = {
                "pid": pid, "name": pid,
                "params": body.get(f"params_{pid}", {}),
                "unit_config": body.get(f"unit_config_{pid}", {}),
                "qid": body.get(f"qid_{pid}", ""),
                "aid": body.get(f"aid_{pid}", "")
            }
        if not ps.get("sequence"):
            qid = ps.get("qid", "")
            aid = ps.get("aid", "")
            pts, calc_traces, dirty = compute_sequence(
                ps.get("pid", "p"), ps.get("params", {}),
                ps.get("unit_config", {}), qid, aid
            )
            ps["sequence"] = pts
            ps["calc_traces"] = calc_traces
            ps["dirty_points"] = dirty
            ps["dirty_summary"] = {"total": len(dirty), "by_type": _group_by_type(dirty)}
            ps["answer"] = next((a for a in answers if a.get("aid") == aid), None)
            ps["question"] = next((q for q in questions if q.get("qid") == qid), None)
            ps["material"] = next((m for m in materials if m.get("mid") == (ps["answer"].get("material_mid") if ps["answer"] else None)), None) if ps["answer"] else None
        picked.append(ps)

    result = build_param_comparison(picked)
    result["comparison"] = result.pop("diff_rows", [])
    result["param_sets_detail"] = [
        {
            "param_set_id": p["pid"],
            "param_set_name": p.get("name", p["pid"]),
            "params": p.get("params", {}),
            "unit_config": p.get("unit_config", {}),
            "qid": p.get("qid", ""),
            "aid": p.get("aid", ""),
            "question": p.get("question"),
            "answer": p.get("answer"),
            "material": p.get("material"),
            "notes": [n for n in notes if n.get("target_id") in (p.get("qid"), p.get("aid"))],
            "points": p.get("sequence", []),
            "dirty_summary": p.get("dirty_summary", {"total": 0, "by_type": {}})
        } for p in picked
    ]
    return jsonify(result)


# ============ Analysis: Export report ============
@app.route("/api/analysis/export", methods=["POST"])
def analysis_export():
    body = request.json or {}
    ids = body.get("param_set_ids", [])
    ps_list = Store.load("param_sets", [])
    answers = Store.load("answers", [])
    materials = Store.load("materials", [])
    questions = Store.load("questions", [])
    notes = Store.load("notes", [])

    picked = []
    for pid in ids:
        ps = next((p for p in ps_list if p.get("pid") == pid), None)
        if ps is None:
            ps = {
                "pid": pid, "name": pid,
                "params": body.get(f"params_{pid}", {}),
                "unit_config": body.get(f"unit_config_{pid}", {}),
                "qid": body.get(f"qid_{pid}", ""),
                "aid": body.get(f"aid_{pid}", "")
            }
        if not ps.get("sequence"):
            qid = ps.get("qid", "")
            aid = ps.get("aid", "")
            pts, calc_traces, dirty = compute_sequence(
                ps.get("pid", "p"), ps.get("params", {}),
                ps.get("unit_config", {}), qid, aid
            )
            ps["sequence"] = pts
            ps["calc_traces"] = calc_traces
            ps["dirty_points"] = dirty
            ps["dirty_summary"] = {"total": len(dirty), "by_type": _group_by_type(dirty)}
            ps["answer"] = next((a for a in answers if a.get("aid") == aid), None)
            ps["question"] = next((q for q in questions if q.get("qid") == qid), None)
            ps["material"] = next((m for m in materials if m.get("mid") == (ps["answer"].get("material_mid") if ps["answer"] else None)), None) if ps["answer"] else None
        picked.append(ps)

    comp = build_param_comparison(picked)

    lines = []
    lines.append("=" * 70)
    lines.append("数列递推图表解释 · 分析报告")
    lines.append("=" * 70)
    lines.append(f"生成时间: {datetime.now().isoformat(timespec='seconds')}")
    lines.append(f"题目分组: {picked[0].get('question', {}).get('title', '—') if picked else '—'}")
    lines.append("")

    lines.append("━ " * 35)
    lines.append("一、参数组概览")
    lines.append("━ " * 35)
    for i, p in enumerate(picked):
        q = p.get("question") or {}
        a = p.get("answer") or {}
        m = p.get("material") or {}
        ds = p.get("dirty_summary", {})
        lines.append(f"\n【参数组 {i+1}】 {p.get('name', p.get('pid',''))}")
        lines.append(f"  参数组ID: {p.get('pid','')}")
        lines.append(f"  关联题目: {q.get('qid','—')} ({q.get('version','—')}) — {q.get('title','')}")
        lines.append(f"  关联答案: {a.get('aid','—')} ({a.get('version','—')})")
        lines.append(f"  关联材料: {m.get('current_name','—')}" + (f" [临时改名]" if m.get("is_temporary_rename") else ""))
        if m.get("previous_names"):
            lines.append(f"    曾用名: {' → '.join(m['previous_names'])}")
            if m.get("rename_time"):
                lines.append(f"    改名记录: {m.get('rename_time','')} {m.get('renamed_by','')}")
        lines.append(f"  递推参数: a={p['params'].get('a')}, b={p['params'].get('b')}, "
                     f"c_divisor={p['params'].get('c_divisor')}, x0={p['params'].get('x0')}, 长度={p['params'].get('length')}")
        uc = p.get("unit_config", {})
        lines.append(f"  单位换算: 输入({uc.get('input','')}) ×{uc.get('scale_input',1)} → 计算 → ×{uc.get('scale_output',1)} → 输出({uc.get('output','')})")
        if a.get("unit_conversion"):
            lines.append(f"  单位说明: {a['unit_conversion']}")
        lines.append(f"  异常点总数: {ds.get('total', 0)}")
        for t, cnt in (ds.get("by_type", {}) or {}).items():
            lines.append(f"    - {t}: {cnt} 处")
        lines.append(f"  答案处理结果: {a.get('processed_result','—')}")

    lines.append("\n" + "━ " * 35)
    lines.append("二、参数差异汇总")
    lines.append("━ " * 35)
    pdiff = comp.get("params_diff", {})
    for k, v in pdiff.items():
        lines.append(f"  {k}: {v.get('set1')} {'≠' if v.get('different') else '='} {v.get('set2')}")
    lines.append("")
    lines.append(f"  总点数: {comp.get('summary',{}).get('total_points',0)}")
    lines.append(f"  有差异点数: {comp.get('summary',{}).get('points_with_difference',0)}")
    lines.append(f"  参数组A异常点: {comp.get('summary',{}).get('anomalies_set1',0)}")
    lines.append(f"  参数组B异常点: {comp.get('summary',{}).get('anomalies_set2',0)}")

    lines.append("\n" + "━ " * 35)
    lines.append("三、除零边界说明")
    lines.append("━ " * 35)
    has_div0 = False
    for i, p in enumerate(picked):
        for d in p.get("dirty_points", []):
            for issue in d.get("issues", []):
                if "除零" in issue.get("type", ""):
                    has_div0 = True
                    lines.append(f"  [参数组 {i+1}] 第 {d['index']} 步: {issue.get('detail','')}")
    if not has_div0:
        lines.append("  未检测到除零边界问题。")

    lines.append("\n" + "━ " * 35)
    lines.append("四、单位换算过程")
    lines.append("━ " * 35)
    for i, p in enumerate(picked):
        uc = p.get("unit_config", {})
        a = p.get("answer") or {}
        lines.append(f"\n  【参数组 {i+1}】{p.get('name','')}")
        lines.append(f"    输入单位: {uc.get('input','—')}")
        lines.append(f"    输出单位: {uc.get('output','—')}")
        lines.append(f"    输入换算系数: ×{uc.get('scale_input',1)}")
        lines.append(f"    输出换算系数: ×{uc.get('scale_output',1)}")
        if a.get("unit_conversion"):
            lines.append(f"    说明: {a['unit_conversion']}")
        if p.get("calc_traces") and len(p["calc_traces"]) > 0:
            uc_trace = p["calc_traces"][0].get("unit_conversion")
            if uc_trace:
                lines.append(f"    换算详情: {uc_trace.get('detail','')}")

    lines.append("\n" + "━ " * 35)
    lines.append("五、材料溯源明细")
    lines.append("━ " * 35)
    seen_mids = set()
    for p in picked:
        m = p.get("material")
        if m and m.get("mid") not in seen_mids:
            seen_mids.add(m.get("mid"))
            lines.append(f"\n  材料 {m.get('mid','')}: {m.get('current_name','')}")
            lines.append(f"    类型: {m.get('source_type','—')}")
            if m.get("is_temporary_rename"):
                lines.append(f"    ⚠️  临时改名: 是")
            if m.get("previous_names"):
                lines.append(f"    曾用名: {' → '.join(m['previous_names'])}")
            if m.get("rename_time"):
                lines.append(f"    改名记录: {m.get('rename_time','')} · {m.get('renamed_by','')}")
            if m.get("content"):
                lines.append(f"    内容摘要: {m['content']}")
            lines.append(f"    关联题目ID: {', '.join(m.get('linked_qids',[]) or ['—'])}")
        q = p.get("question")
        if q:
            lines.append(f"\n  题目 {q.get('qid','')} ({q.get('version','')}): {q.get('title','')}")
            lines.append(f"    来源文件: {q.get('source_file','—')}")
            lines.append(f"    原文: {q.get('original_text','—')[:200]}")
        a = p.get("answer")
        if a:
            lines.append(f"\n  答案 {a.get('aid','')} ({a.get('version','')}):")
            lines.append(f"    答案原文: {a.get('answer_text','—')[:150]}")
            lines.append(f"    处理结果: {a.get('processed_result','—')}")

    lines.append("\n" + "━ " * 35)
    lines.append("六、备注与口头说明")
    lines.append("━ " * 35)
    all_qids = [p.get("qid","") for p in picked if p.get("qid")]
    all_aids = [p.get("aid","") for p in picked if p.get("aid")]
    all_mids = [p.get("material",{}).get("mid","") for p in picked if p.get("material",{}).get("mid")]
    relevant_notes = [n for n in notes if
        (n.get("target_type") == "question" and n.get("target_id") in all_qids) or
        (n.get("target_type") == "answer" and n.get("target_id") in all_aids) or
        (n.get("target_type") == "material" and n.get("target_id") in all_mids)]
    if relevant_notes:
        for n in relevant_notes:
            lines.append(f"\n  [{n.get('note_type','—')}] {n.get('target_type','')}:{n.get('target_id','')}")
            lines.append(f"    内容: {n.get('content','')}")
            lines.append(f"    作者: {n.get('author','—')} · 时间: {n.get('timestamp','—')}")
    else:
        lines.append("  暂无相关备注。")

    lines.append("\n" + "━ " * 35)
    lines.append("七、逐点数值对照（前30点）")
    lines.append("━ " * 35)
    rows = comp.get("diff_rows", [])[:30]
    header = f"  {'i':>4} | {picked[0].get('name','Set1')[:18]:>18} | {picked[1].get('name','Set2')[:18]:>18} | {'|Δ|':>10} | {'相对差':>8}"
    lines.append(header)
    lines.append("  " + "-" * (len(header) - 2))
    for row in rows:
        v1 = "—" if row.get("v1") is None else f"{row['v1']:.6f}"
        v2 = "—" if row.get("v2") is None else f"{row['v2']:.6f}"
        ad = "—" if row.get("abs_diff") is None else f"{row['abs_diff']:.3e}"
        rd = "—" if row.get("rel_diff") is None else f"{row['rel_diff']*100:.3f}%"
        mark = " ⚠️" if row.get("anomaly_1") or row.get("anomaly_2") else ""
        lines.append(f"  {row['index']:>4} | {v1:>18} | {v2:>18} | {ad:>10} | {rd:>8}{mark}")

    lines.append("\n" + "=" * 70)
    lines.append("报告结束")
    lines.append("=" * 70)

    content = "\n".join(lines)
    filename = f"数列递推分析报告_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
    return jsonify({
        "filename": filename,
        "content": content,
        "param_set_ids": ids
    })


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
