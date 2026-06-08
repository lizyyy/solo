import os
import json
import io
import csv
from typing import Optional
from flask import Flask, request, jsonify, send_from_directory, send_file, Response
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))

from src.workflow import Workflow
from src.result_store import ResultStore
from src.evidence import ProcessingStatus

app = Flask(__name__, static_folder="web/static", template_folder="web/templates")
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
OUTPUT_DIR = os.path.join(BASE_DIR, "outputs")
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

WORKFLOWS: dict[str, Workflow] = {}
DEFAULT_WF_ID = "default"


def get_wf(wf_id: str = DEFAULT_WF_ID) -> Workflow:
    if wf_id not in WORKFLOWS:
        ResultStore.reset()
        WORKFLOWS[wf_id] = Workflow()
    return WORKFLOWS[wf_id]


@app.route("/")
def index():
    return send_from_directory("web/templates", "index.html")


@app.route("/api/reset", methods=["POST"])
def api_reset():
    global WORKFLOWS
    ResultStore.reset()
    WORKFLOWS = {}
    return jsonify({"status": "ok"})


@app.route("/api/import/sample", methods=["POST"])
def api_import_sample():
    wf = get_wf()
    sample_path = os.path.join(BASE_DIR, "sample_data.csv")
    result = wf.step1_import(sample_path, ["denominator"], ["count_a", "count_b"])
    wf.step3_update_demo()
    return _full_state(wf)


@app.route("/api/import/csv", methods=["POST"])
def api_import_csv():
    wf = get_wf()
    if "file" not in request.files:
        return jsonify({"error": "no file"}), 400
    file = request.files["file"]
    denom_fields = request.form.get("denominator_fields", "denominator").split(",")
    count_fields = request.form.get("count_fields", "count_a,count_b").split(",")
    denom_fields = [f.strip() for f in denom_fields if f.strip()]
    count_fields = [f.strip() for f in count_fields if f.strip()]
    filename = os.path.join(UPLOAD_DIR, file.filename)
    file.save(filename)
    result = wf.step1_import(filename, denom_fields, count_fields)
    wf.step3_update_demo()
    return _full_state(wf)


@app.route("/api/import/rows", methods=["POST"])
def api_import_rows():
    wf = get_wf()
    data = request.get_json(force=True)
    rows = data.get("rows", [])
    denom_fields = data.get("denominator_fields", ["denominator"])
    count_fields = data.get("count_fields", ["count_a", "count_b"])
    result = wf.step1_import(rows, denom_fields, count_fields)
    wf.step3_update_demo()
    return _full_state(wf)


@app.route("/api/state", methods=["GET"])
def api_state():
    wf = get_wf()
    return _full_state(wf)


@app.route("/api/evidence/<evidence_id>", methods=["GET"])
def api_evidence_detail(evidence_id):
    wf = get_wf()
    detail = wf.get_evidence_full_detail(evidence_id)
    if detail is None:
        return jsonify({"error": "not found"}), 404
    return jsonify(detail)


@app.route("/api/supplement", methods=["POST"])
def api_supplement():
    wf = get_wf()
    data = request.get_json(force=True)
    evidence_id = data["evidence_id"]
    new_values = data.get("new_values", {})
    supplemented_by = data.get("supplemented_by", "实验助理")
    result = wf.step2_supplement(evidence_id, new_values, supplemented_by)
    if "error" in result:
        return jsonify(result), 400
    wf.step3_update_demo()
    return _full_state(wf, action_result={"supplement": result})


@app.route("/api/review", methods=["POST"])
def api_review():
    wf = get_wf()
    data = request.get_json(force=True)
    evidence_id = data["evidence_id"]
    confirmed = bool(data["confirmed_normal"])
    note = data.get("note", "")
    reviewer = data.get("reviewer", "数据复核人")
    result = wf.reviewer_confirm(evidence_id, confirmed, note, reviewer)
    if "error" in result:
        return jsonify(result), 400
    wf.step3_update_demo()
    return _full_state(wf, action_result={"review": result})


@app.route("/api/selfcheck", methods=["GET"])
def api_selfcheck():
    wf = get_wf()
    results = wf.checker.run_all()
    return jsonify({"checks": results})


@app.route("/api/export/<kind>", methods=["GET"])
def api_export(kind):
    wf = get_wf()
    if kind == "cleaned_csv":
        out = io.StringIO()
        rows = wf.store.get_cleaned_rows()
        if not rows:
            return Response("", mimetype="text/csv")
        writer = csv.DictWriter(out, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
        return Response(out.getvalue(), mimetype="text/csv",
                        headers={"Content-Disposition": "attachment; filename=cleaned.csv"})
    if kind == "anomaly_csv":
        out = io.StringIO()
        rows = wf.store.get_anomaly_rows()
        if not rows:
            return Response("", mimetype="text/csv")
        writer = csv.DictWriter(out, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
        return Response(out.getvalue(), mimetype="text/csv",
                        headers={"Content-Disposition": "attachment; filename=anomaly.csv"})
    if kind == "result_json":
        payload = {
            "result": wf.store.get_export_data(),
            "evidence": [r.to_dict() for r in wf.evidence.all_records()],
            "workflow_log": wf.get_workflow_log(),
        }
        return Response(json.dumps(payload, ensure_ascii=False, indent=2), mimetype="application/json",
                        headers={"Content-Disposition": "attachment; filename=result.json"})
    if kind == "report":
        report = _build_report(wf)
        return Response(report, mimetype="text/markdown",
                        headers={"Content-Disposition": "attachment; filename=report.md"})
    return jsonify({"error": "unknown kind"}), 400


def _build_report(wf: Workflow) -> str:
    lines = []
    lines.append("# 卡方检验问卷清洗报告")
    lines.append("")
    summary = wf.store.get_summary()
    lines.append("## 摘要")
    for k, v in summary.items():
        if k == "chi_square":
            continue
        lines.append(f"- {k}: {v}")
    chi = wf.store.get_chi_square_result() or {}
    lines.append("")
    lines.append("## 卡方检验结果")
    lines.append(f"- χ² = {chi.get('chi_square')}")
    lines.append(f"- df = {chi.get('df')}")
    lines.append(f"- p = {chi.get('p_value')}")
    if chi.get("error"):
        lines.append(f"- error: {chi['error']}")
    lines.append("")
    lines.append("## 证据列表")
    for r in wf.evidence.all_records():
        rd = r.to_dict()
        lines.append(f"- [{rd['current_status']}] {rd['evidence_id']} 行{rd['original_row']} {rd['anomaly_type']}")
        lines.append(f"    - 原始值: {rd['original_value']}")
        if rd.get("original_statement"):
            lines.append(f"    - 原始说法: {rd['original_statement']}")
        if rd.get("supplemented_values"):
            lines.append(f"    - 改后值: {rd['supplemented_values']} (补录人: {rd.get('supplemented_by','')})")
        if rd.get("review_reason"):
            lines.append(f"    - 处理原因: {rd['review_reason']} (复核人: {rd.get('reviewer','')})")
        if rd.get("next_step"):
            lines.append(f"    - 下一步: {rd['next_step']}")
    lines.append("")
    lines.append("## 自检结果")
    for c in wf.checker.run_all():
        lines.append(f"- [{c['status']}] {c['check']}: {c['detail']}")
    return "\n".join(lines)


def _full_state(wf: Workflow, action_result: Optional[dict] = None) -> dict:
    data = wf.store.get_api_response()
    evidence = [r.to_dict() for r in wf.evidence.all_records()]
    summary = wf.get_evidence_summary()
    log = wf.get_workflow_log()
    payload = {
        **data,
        "evidence": evidence,
        "evidence_summary": summary,
        "workflow_log": log,
    }
    if action_result:
        payload["last_action"] = action_result
    return jsonify(payload)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5001"))
    print(f"启动卡方检验问卷清洗 Web 交互计算器: http://127.0.0.1:{port}/")
    app.run(host="127.0.0.1", port=port, debug=False)
