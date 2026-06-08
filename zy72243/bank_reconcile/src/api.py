import os
import sys
import json
from datetime import datetime
from flask import Flask, jsonify, request, render_template

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src import init_db, ReviewManager, AuditManager, BankStatementImporter
from src.visualizer import Visualizer

TEMPLATE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "templates")
app = Flask(__name__, template_folder=TEMPLATE_DIR)
init_db()

reviewer = ReviewManager()
auditor = AuditManager()
visualizer = Visualizer()


@app.route("/")
def index():
    """小看板首页"""
    pending_items = reviewer.get_pending_reviews()
    batches = []
    try:
        from src.database import get_session
        from src.models import ClearingBatch
        session = get_session()
        batches = session.query(ClearingBatch).order_by(ClearingBatch.created_at.desc()).all()
        batches = [{
            "id": b.id,
            "batch_no": b.batch_no,
            "status": b.status,
            "total_records": b.total_records,
            "mixed_currency_count": b.mixed_currency_count,
            "import_date": b.import_date.strftime("%Y-%m-%d %H:%M") if b.import_date else ""
        } for b in batches]
    except Exception:
        pass

    return render_template("index.html",
                           pending_count=len(pending_items),
                           batches=batches,
                           pending_items=pending_items[:10])


@app.route("/api/batches")
def api_batches():
    """获取所有批次列表"""
    from src.database import get_session
    from src.models import ClearingBatch
    session = get_session()
    batches = session.query(ClearingBatch).order_by(ClearingBatch.created_at.desc()).all()
    return jsonify([{
        "id": b.id,
        "batch_no": b.batch_no,
        "status": b.status,
        "total_records": b.total_records,
        "mixed_currency_count": b.mixed_currency_count
    } for b in batches])


@app.route("/api/batch/<batch_no>")
def api_batch_detail(batch_no):
    """获取批次详情"""
    batch = reviewer.get_batch_summary(batch_no)
    if not batch:
        return jsonify({"error": "批次不存在"}), 404

    from src.database import get_session
    from src.models import TransactionRecord
    session = get_session()
    batch_id = batch["id"]
    transactions = session.query(TransactionRecord).filter_by(batch_id=batch_id).all()

    return jsonify({
        "batch": batch,
        "transactions": [{
            "id": t.id,
            "transaction_no": t.transaction_no,
            "summary": t.summary,
            "amount": t.amount,
            "currency": t.currency,
            "has_mixed_currency": t.has_mixed_currency,
            "is_reviewed": t.is_reviewed,
            "amount_column_raw": t.amount_column_raw
        } for t in transactions]
    })


@app.route("/api/transaction/<int:txn_id>")
def api_transaction(txn_id):
    """获取交易详情（含审计明细和关联信息）"""
    data = reviewer.get_transaction_with_audit(txn_id)
    if not data:
        return jsonify({"error": "交易不存在"}), 404
    return jsonify(data)


@app.route("/api/pending")
def api_pending():
    """获取待复核列表"""
    batch_no = request.args.get("batch_no")
    review_type = request.args.get("review_type")
    items = reviewer.get_pending_reviews(batch_no, review_type)
    return jsonify(items)


@app.route("/api/holiday", methods=["POST"])
def api_add_holiday():
    """补录节假日顺延说明"""
    data = request.json
    try:
        orig_dt = datetime.strptime(data["original_date"], "%Y-%m-%d")
        adj_dt = datetime.strptime(data["adjusted_date"], "%Y-%m-%d")
    except (KeyError, ValueError):
        return jsonify({"error": "日期格式错误，请使用 YYYY-MM-DD"}), 400

    result = reviewer.add_holiday_adjustment(
        data["batch_no"], orig_dt, adj_dt,
        data.get("reason", ""), data.get("operator_note", "")
    )
    if result:
        return jsonify({"success": True, "result": result})
    return jsonify({"error": "批次不存在"}), 404


@app.route("/api/review", methods=["POST"])
def api_review():
    """复核币种混合问题"""
    data = request.json
    try:
        txn_id = int(data["transaction_id"])
    except (KeyError, ValueError, TypeError):
        return jsonify({"error": "交易ID错误"}), 400

    result = reviewer.review_mixed_currency(
        txn_id,
        data.get("review_note", ""),
        data.get("reviewed_by"),
        data.get("mark_normal", False)
    )
    if result:
        return jsonify({"success": True, "result": result})
    return jsonify({"error": "交易不存在"}), 404


@app.route("/api/report/<batch_no>")
def api_report(batch_no):
    """获取审计报告"""
    output_format = request.args.get("format", "json")
    result = auditor.generate_audit_report(batch_no, output_format)
    if not result:
        return jsonify({"error": "批次不存在"}), 404

    if output_format == "json":
        report_data = json.loads(result)
        return jsonify(report_data)

    from flask import Response
    mime = "text/html" if output_format == "html" else "text/plain"
    return Response(result, mimetype=mime + "; charset=utf-8")


@app.route("/api/chart/<chart_type>/<batch_no>")
def api_chart(chart_type, batch_no):
    """获取图表数据"""
    if chart_type == "currency_3d":
        return jsonify(visualizer.generate_currency_3d_chart(batch_no))
    elif chart_type == "status_pie":
        return jsonify(visualizer.generate_status_pie_chart(batch_no))
    elif chart_type == "timeline":
        return jsonify(visualizer.generate_timeline_chart(batch_no))
    else:
        return jsonify({"error": "不支持的图表类型"}), 400


@app.route("/batch/<batch_no>")
def view_batch(batch_no):
    """批次详情页"""
    batch = reviewer.get_batch_summary(batch_no)
    if not batch:
        return "批次不存在", 404

    from src.database import get_session
    from src.models import TransactionRecord, AuditTrail
    session = get_session()
    batch_id = batch["id"]
    transactions = session.query(TransactionRecord).filter_by(batch_id=batch_id).all()
    batch_audits = session.query(AuditTrail).filter_by(batch_id=batch_id).all()

    return render_template("batch_detail.html",
                           batch=batch,
                           transactions=transactions,
                           batch_audits=batch_audits)


@app.route("/transaction/<int:txn_id>")
def view_transaction(txn_id):
    """交易详情页（点币种混合后可回到批次和节假日说明）"""
    data = reviewer.get_transaction_with_audit(txn_id)
    if not data:
        return "交易不存在", 404

    chart_data = None
    if data["batch"]:
        chart_data = visualizer.generate_currency_3d_chart(data["batch"]["batch_no"])

    return render_template("transaction_detail.html",
                           data=data,
                           chart_data=chart_data)


@app.route("/visualization/<batch_no>")
def visualization(batch_no):
    """3D/图表展示页"""
    currency_3d = visualizer.generate_currency_3d_chart(batch_no)
    status_pie = visualizer.generate_status_pie_chart(batch_no)
    timeline = visualizer.generate_timeline_chart(batch_no)

    return render_template("visualization.html",
                           batch_no=batch_no,
                           currency_3d=currency_3d,
                           status_pie=status_pie,
                           timeline=timeline)


if __name__ == "__main__":
    app.run(debug=True)
