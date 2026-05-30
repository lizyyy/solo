from flask import Flask, render_template, jsonify, request, send_file
import sys
from pathlib import Path
import json

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from src.engine.data_loader import DataLoader
from src.engine.margin_calculator import MarginCalculator
from src.engine.data_exporter import DataExporter
from src.engine.review_manager import ReviewManager
from src.engine.history_manager import HistoryManager

app = Flask(__name__, template_folder="../../templates", static_folder="../../static")

data_loader = DataLoader()
calculator = MarginCalculator()
exporter = DataExporter()
review_manager = ReviewManager()
history_manager = HistoryManager()

margin_records = []
credit_ledgers = []
trade_flows = []


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/load_data', methods=['POST'])
def load_data():
    global margin_records, credit_ledgers, trade_flows

    credit_ledgers = data_loader.load_credit_ledger()
    trade_flows = data_loader.load_trade_flows()
    actual_margins = data_loader.load_actual_margin()

    margin_records = calculator.calculate_all_margins(
        trades=trade_flows,
        actual_margins=actual_margins,
        ledgers=credit_ledgers
    )

    return jsonify({
        "status": "success",
        "ledger_count": len(credit_ledgers),
        "trade_count": len(trade_flows),
        "margin_count": len(margin_records)
    })


@app.route('/api/margin_records')
def get_margin_records():
    data = [record.to_dict() for record in margin_records]
    return jsonify(data)


@app.route('/api/credit_ledgers')
def get_credit_ledgers():
    data = [ledger.to_dict() for ledger in credit_ledgers]
    return jsonify(data)


@app.route('/api/trade_flows')
def get_trade_flows():
    data = [trade.to_dict() for trade in trade_flows]
    return jsonify(data)


@app.route('/api/confirm/<margin_id>', methods=['POST'])
def confirm_record(margin_id):
    data = request.json
    reviewer = data.get('reviewer', 'unknown')

    for record in margin_records:
        if record.margin_id == margin_id:
            review_manager.confirm_record(record, reviewer)
            return jsonify({"status": "success", "record": record.to_dict()})

    return jsonify({"status": "error", "message": "Record not found"}), 404


@app.route('/api/mark_pending/<margin_id>', methods=['POST'])
def mark_pending(margin_id):
    data = request.json
    reviewer = data.get('reviewer', 'unknown')
    reason = data.get('reason', '')
    next_follow_up = data.get('next_follow_up', '')

    for record in margin_records:
        if record.margin_id == margin_id:
            review_manager.mark_pending(record, reviewer, reason, next_follow_up)
            return jsonify({"status": "success", "record": record.to_dict()})

    return jsonify({"status": "error", "message": "Record not found"}), 404


@app.route('/api/manual_override/<margin_id>', methods=['POST'])
def manual_override(margin_id):
    data = request.json
    reviewer = data.get('reviewer', 'unknown')
    new_required = data.get('new_required_margin')
    new_actual = data.get('new_actual_margin')
    override_reason = data.get('override_reason', '')
    override_source = data.get('override_source', '')
    next_follow_up = data.get('next_follow_up', '')

    for record in margin_records:
        if record.margin_id == margin_id:
            review_manager.manual_override(
                record=record,
                reviewer=reviewer,
                new_required_margin=float(new_required) if new_required else None,
                new_actual_margin=float(new_actual) if new_actual else None,
                override_reason=override_reason,
                override_source=override_source,
                next_follow_up=next_follow_up
            )
            return jsonify({"status": "success", "record": record.to_dict()})

    return jsonify({"status": "error", "message": "Record not found"}), 404


@app.route('/api/export', methods=['POST'])
def export_data():
    data = request.json
    export_type = data.get('type', 'margin')

    if export_type == 'margin':
        path = exporter.export_margin_records_to_excel(margin_records)
    elif export_type == 'checklist':
        path = exporter.export_review_checklist(margin_records)
    elif export_type == 'audit':
        path = exporter.export_audit_history(review_manager.get_audit_records())
    else:
        return jsonify({"status": "error", "message": "Invalid export type"}), 400

    return jsonify({"status": "success", "path": str(path)})


@app.route('/api/save_snapshot', methods=['POST'])
def save_snapshot():
    data = request.json
    name = data.get('name')
    path = history_manager.save_snapshot(margin_records, name)
    return jsonify({"status": "success", "path": str(path)})


@app.route('/api/snapshots')
def list_snapshots():
    snapshots = history_manager.list_snapshots()
    return jsonify(snapshots)


@app.route('/api/audit_records')
def get_audit_records():
    data = [record.to_dict() for record in review_manager.get_audit_records()]
    return jsonify(data)


@app.route('/api/review_summary')
def review_summary():
    checklist = review_manager.get_review_checklist(margin_records)
    return jsonify({
        "total": checklist["total"],
        "confirmed": len(checklist["confirmed"]),
        "pending": len(checklist["pending"]),
        "manual": len(checklist["manual"])
    })


if __name__ == '__main__':
    app.run(debug=True, port=5000)
