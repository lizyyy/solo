from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import os

from models import (
    RecordStatus, DataSource,
    create_batch, create_revenue_record,
    confirm_record, suspend_record, flag_discrepancy,
    get_record, get_records_by_batch, get_batch,
    get_all_batches, get_all_records,
    get_discrepancy_list, get_summary
)
from exporter import export_discrepancy_list, export_full_report, EXPORT_DIR

app = Flask(__name__)
CORS(app)


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "message": "新能源充电桩收益归集服务运行正常"})


@app.route("/api/batches", methods=["GET"])
def list_batches():
    batches = get_all_batches()
    return jsonify({"data": batches})


@app.route("/api/batches", methods=["POST"])
def new_batch():
    data = request.json or {}
    period = data.get("period", "")
    operator = data.get("operator", "系统")
    batch = create_batch(period, operator)
    return jsonify({"data": batch}), 201


@app.route("/api/batches/<batch_no>", methods=["GET"])
def get_batch_detail(batch_no):
    batch = get_batch(batch_no)
    if not batch:
        return jsonify({"error": "批次不存在"}), 404
    records = get_records_by_batch(batch_no)
    summary = get_summary(batch_no)
    return jsonify({"data": {"batch": batch, "records": records, "summary": summary}})


@app.route("/api/batches/<batch_no>/summary", methods=["GET"])
def get_batch_summary(batch_no):
    batch = get_batch(batch_no)
    if not batch:
        return jsonify({"error": "批次不存在"}), 404
    summary = get_summary(batch_no)
    return jsonify({"data": summary})


@app.route("/api/batches/<batch_no>/discrepancies", methods=["GET"])
def get_batch_discrepancies(batch_no):
    batch = get_batch(batch_no)
    if not batch:
        return jsonify({"error": "批次不存在"}), 404
    records = get_discrepancy_list(batch_no)
    return jsonify({"data": records})


@app.route("/api/records", methods=["GET"])
def list_records():
    batch_no = request.args.get("batch_no")
    status = request.args.get("status")
    if batch_no:
        records = get_records_by_batch(batch_no)
    else:
        records = get_all_records()
    if status:
        records = [r for r in records if r["status"] == status]
    return jsonify({"data": records})


@app.route("/api/records", methods=["POST"])
def new_record():
    data = request.json or {}
    required_fields = ["batch_no", "source", "source_ref", "pile_no",
                       "transaction_date", "expected_amount"]
    for field in required_fields:
        if field not in data:
            return jsonify({"error": f"缺少必填字段：{field}"}), 400

    record = create_revenue_record(
        batch_no=data["batch_no"],
        source=data["source"],
        source_ref=data["source_ref"],
        pile_no=data["pile_no"],
        transaction_date=data["transaction_date"],
        expected_amount=float(data["expected_amount"]),
        actual_amount=float(data["actual_amount"]) if data.get("actual_amount") is not None else None,
        original_remarks=data.get("original_remarks", ""),
        operator=data.get("operator", "系统"),
        period=data.get("period", "")
    )
    return jsonify({"data": record}), 201


@app.route("/api/records/<record_id>", methods=["GET"])
def get_record_detail(record_id):
    record = get_record(record_id)
    if not record:
        return jsonify({"error": "记录不存在"}), 404
    return jsonify({"data": record})


@app.route("/api/records/<record_id>/confirm", methods=["POST"])
def api_confirm_record(record_id):
    data = request.json or {}
    operator = data.get("operator", "系统")
    reason = data.get("reason", "")
    notes = data.get("notes", "")
    if not reason:
        return jsonify({"error": "请输入确认原因"}), 400
    record = confirm_record(record_id, operator, reason, notes)
    if not record:
        return jsonify({"error": "记录不存在"}), 404
    return jsonify({"data": record})


@app.route("/api/records/<record_id>/suspend", methods=["POST"])
def api_suspend_record(record_id):
    data = request.json or {}
    operator = data.get("operator", "系统")
    reason = data.get("reason", "")
    notes = data.get("notes", "")
    if not reason:
        return jsonify({"error": "请输入挂起原因"}), 400
    record = suspend_record(record_id, operator, reason, notes)
    if not record:
        return jsonify({"error": "记录不存在"}), 404
    return jsonify({"data": record})


@app.route("/api/records/<record_id>/discrepancy", methods=["POST"])
def api_flag_discrepancy(record_id):
    data = request.json or {}
    operator = data.get("operator", "系统")
    reason = data.get("reason", "")
    notes = data.get("notes", "")
    if not reason:
        return jsonify({"error": "请输入差异原因"}), 400
    record = flag_discrepancy(record_id, operator, reason, notes)
    if not record:
        return jsonify({"error": "记录不存在"}), 404
    return jsonify({"data": record})


@app.route("/api/discrepancies", methods=["GET"])
def list_discrepancies():
    batch_no = request.args.get("batch_no")
    records = get_discrepancy_list(batch_no)
    return jsonify({"data": records})


@app.route("/api/summary", methods=["GET"])
def api_summary():
    batch_no = request.args.get("batch_no")
    summary = get_summary(batch_no)
    return jsonify({"data": summary})


@app.route("/api/export/discrepancies", methods=["GET"])
def api_export_discrepancies():
    batch_no = request.args.get("batch_no")
    fmt = request.args.get("format", "csv")
    filepath = export_discrepancy_list(batch_no, fmt)
    filename = os.path.basename(filepath)
    return send_from_directory(EXPORT_DIR, filename, as_attachment=True)


@app.route("/api/export/report", methods=["GET"])
def api_export_report():
    batch_no = request.args.get("batch_no")
    fmt = request.args.get("format", "csv")
    filepath = export_full_report(batch_no, fmt)
    filename = os.path.basename(filepath)
    return send_from_directory(EXPORT_DIR, filename, as_attachment=True)


@app.route("/api/meta/statuses", methods=["GET"])
def get_statuses():
    return jsonify({"data": RecordStatus.STATUS_LABELS})


@app.route("/api/meta/sources", methods=["GET"])
def get_sources():
    return jsonify({"data": DataSource.SOURCE_LABELS})


if __name__ == "__main__":
    print("🚀 新能源充电桩收益归集服务启动中...")
    print("📡 API服务地址：http://127.0.0.1:5000")
    print("📖 API文档：")
    print("   GET  /api/health              - 健康检查")
    print("   GET  /api/batches             - 批次列表")
    print("   POST /api/batches             - 创建批次")
    print("   GET  /api/batches/<no>        - 批次详情")
    print("   GET  /api/records             - 记录列表")
    print("   POST /api/records             - 创建记录")
    print("   GET  /api/records/<id>        - 记录详情")
    print("   POST /api/records/<id>/confirm - 确认记录")
    print("   POST /api/records/<id>/suspend - 挂起记录")
    print("   GET  /api/discrepancies       - 差异清单")
    print("   GET  /api/summary             - 归集汇总")
    print("   GET  /api/export/discrepancies - 导出差异清单")
    print("   GET  /api/export/report       - 导出完整报告")
    app.run(host="127.0.0.1", port=5000, debug=False)
