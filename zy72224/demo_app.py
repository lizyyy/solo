import json
from flask import Flask, jsonify, request, send_from_directory
from rebalance_review import (
    RebalanceReviewEngine,
    RebalanceWorkflow,
    TraceabilityService,
    ReviewRecord,
    TaxRateNote,
    CounterTransaction,
    BalanceChangeEntry,
    ApproverBoundaryRule,
    ReviewStatus,
    WorkflowPhase,
    PinyinVerdict,
)
from rebalance_review.workflow import PinyinInterceptError, WorkflowError

app = Flask(__name__, static_folder="static", static_url_path="/static")

engine = RebalanceReviewEngine()
workflow = RebalanceWorkflow(engine)
trace_svc = TraceabilityService()
records: dict[str, ReviewRecord] = {}


def _record_to_dict(record: ReviewRecord) -> dict:
    return {
        "id": record.id,
        "portfolio_name": record.portfolio_name,
        "approver_name": record.approver_name,
        "approver_pinyin_verdict": record.approver_pinyin_verdict.value,
        "status": record.status.value,
        "workflow_phase": record.workflow_phase.value,
        "tax_notes": [
            {
                "id": n.id,
                "tax_category": n.tax_category,
                "rate": n.rate,
                "remark": n.remark,
                "approver_name": n.approver_name,
                "source_file": n.source_file,
            }
            for n in record.tax_notes
        ],
        "counter_transactions": [
            {
                "id": tx.id,
                "tail_number": tx.tail_number,
                "amount": tx.amount,
                "description": tx.description,
                "linked_tax_note_id": tx.linked_tax_note_id,
            }
            for tx in record.counter_transactions
        ],
        "balance_entries": [
            {
                "id": e.id,
                "account": e.account,
                "before_balance": e.before_balance,
                "after_balance": e.after_balance,
                "change_reason": e.change_reason,
                "linked_counter_tx_id": e.linked_counter_tx_id,
            }
            for e in record.balance_entries
        ],
        "history": [
            {
                "id": h.id,
                "field_name": h.field_name,
                "target_id": h.target_id,
                "old_value": h.old_value,
                "new_value": h.new_value,
                "changed_by": h.changed_by,
                "change_type": h.change_type,
                "summary": h.diff_summary(),
            }
            for h in record.history
        ],
    }


@app.route("/")
def index():
    return send_from_directory("static", "index.html")


@app.route("/api/boundary/<name>", methods=["GET"])
def check_boundary(name):
    verdict = engine.detect_pinyin(name)
    description = engine.describe_boundary_decision(name)
    return jsonify({"name": name, "verdict": verdict.value, "description": description})


@app.route("/api/records", methods=["POST"])
def create_record():
    data = request.json or {}
    record = engine.create_record(
        portfolio_name=data.get("portfolio_name", ""),
        approver_name=data.get("approver_name", ""),
    )
    records[record.id] = record
    return jsonify(_record_to_dict(record)), 201


@app.route("/api/records/<record_id>", methods=["GET"])
def get_record(record_id):
    record = records.get(record_id)
    if not record:
        return jsonify({"error": "record not found"}), 404
    return jsonify(_record_to_dict(record))


@app.route("/api/records", methods=["GET"])
def list_records():
    return jsonify([_record_to_dict(r) for r in records.values()])


@app.route("/api/records/<record_id>/import-tax-notes", methods=["POST"])
def import_tax_notes(record_id):
    record = records.get(record_id)
    if not record:
        return jsonify({"error": "record not found"}), 404
    data = request.json or {}
    notes_data = data.get("notes", [])
    operator = data.get("operator", "system")
    notes = [
        TaxRateNote(
            tax_category=n.get("tax_category", ""),
            rate=n.get("rate", 0.0),
            remark=n.get("remark", ""),
            approver_name=n.get("approver_name", ""),
            source_file=n.get("source_file", ""),
        )
        for n in notes_data
    ]
    try:
        added = workflow.step_import_tax_notes(record, notes, operator)
        return jsonify({
            "record": _record_to_dict(record),
            "added_count": len(added),
            "added_notes": [{"id": n.id, "remark": n.remark} for n in added],
        })
    except PinyinInterceptError as e:
        return jsonify({
            "record": _record_to_dict(record),
            "error": str(e),
            "error_type": "PinyinInterceptError",
            "intercepted": True,
        }), 409
    except WorkflowError as e:
        return jsonify({"error": str(e), "error_type": "WorkflowError"}), 400


@app.route("/api/records/<record_id>/check-counter-transactions", methods=["POST"])
def check_counter_transactions(record_id):
    record = records.get(record_id)
    if not record:
        return jsonify({"error": "record not found"}), 404
    data = request.json or {}
    txs_data = data.get("transactions", [])
    operator = data.get("operator", "risk_control")
    txs = [
        CounterTransaction(
            tail_number=t.get("tail_number", ""),
            amount=t.get("amount", 0.0),
            description=t.get("description", ""),
            linked_tax_note_id=t.get("linked_tax_note_id"),
        )
        for t in txs_data
    ]
    try:
        added = workflow.step_check_counter_transactions(record, txs, operator)
        return jsonify({
            "record": _record_to_dict(record),
            "added_count": len(added),
        })
    except PinyinInterceptError as e:
        return jsonify({
            "record": _record_to_dict(record),
            "error": str(e),
            "error_type": "PinyinInterceptError",
            "intercepted": True,
        }), 409
    except WorkflowError as e:
        return jsonify({"error": str(e), "error_type": "WorkflowError"}), 400


@app.route("/api/records/<record_id>/update-balance", methods=["POST"])
def update_balance(record_id):
    record = records.get(record_id)
    if not record:
        return jsonify({"error": "record not found"}), 404
    data = request.json or {}
    entries_data = data.get("entries", [])
    operator = data.get("operator", "system")
    entries = [
        BalanceChangeEntry(
            account=e.get("account", ""),
            before_balance=e.get("before_balance", 0.0),
            after_balance=e.get("after_balance", 0.0),
            change_reason=e.get("change_reason", ""),
            linked_counter_tx_id=e.get("linked_counter_tx_id"),
        )
        for e in entries_data
    ]
    try:
        added = workflow.step_update_balance(record, entries, operator)
        return jsonify({
            "record": _record_to_dict(record),
            "added_count": len(added),
        })
    except PinyinInterceptError as e:
        return jsonify({
            "record": _record_to_dict(record),
            "error": str(e),
            "error_type": "PinyinInterceptError",
            "intercepted": True,
        }), 409
    except WorkflowError as e:
        return jsonify({"error": str(e), "error_type": "WorkflowError"}), 400


@app.route("/api/records/<record_id>/update-remark", methods=["POST"])
def update_remark(record_id):
    record = records.get(record_id)
    if not record:
        return jsonify({"error": "record not found"}), 404
    data = request.json or {}
    note_id = data.get("note_id", "")
    new_remark = data.get("new_remark", "")
    operator = data.get("operator", "system")
    history = engine.update_note_remark(record, note_id, new_remark, operator)
    if not history:
        return jsonify({"error": "note not found"}), 404
    return jsonify({
        "record": _record_to_dict(record),
        "history": {
            "id": history.id,
            "field_name": history.field_name,
            "target_id": history.target_id,
            "old_value": history.old_value,
            "new_value": history.new_value,
            "changed_by": history.changed_by,
            "change_type": history.change_type,
            "summary": history.diff_summary(),
        },
    })


@app.route("/api/records/<record_id>/rollback", methods=["POST"])
def rollback(record_id):
    record = records.get(record_id)
    if not record:
        return jsonify({"error": "record not found"}), 404
    data = request.json or {}
    history_id = data.get("history_id", "")
    operator = data.get("operator", "system")
    success = engine.rollback_record(record, history_id, operator)
    if not success:
        return jsonify({"error": "history entry not found"}), 404
    note_remarks = {n.id: n.remark for n in record.tax_notes}
    return jsonify({
        "record": _record_to_dict(record),
        "success": True,
        "note_remarks_after_rollback": note_remarks,
    })


@app.route("/api/records/<record_id>/resolve-pinyin", methods=["POST"])
def resolve_pinyin(record_id):
    record = records.get(record_id)
    if not record:
        return jsonify({"error": "record not found"}), 404
    data = request.json or {}
    confirmed_name = data.get("confirmed_name", "")
    operator = data.get("operator", "client_manager")
    workflow.resolve_pinyin_flag(record, confirmed_name, operator)
    return jsonify({"record": _record_to_dict(record)})


@app.route("/api/records/<record_id>/trace", methods=["GET"])
def trace(record_id):
    record = records.get(record_id)
    if not record:
        return jsonify({"error": "record not found"}), 404
    from_type = request.args.get("from_type", "")
    from_id = request.args.get("from_id", "")
    chain = trace_svc.full_evidence_chain(record, from_type, from_id)
    result = []
    for link in chain:
        detail = trace_svc.get_source_detail(record, link.display_type, link.display_id)
        result.append({
            "display_type": link.display_type,
            "display_id": link.display_id,
            "label": link.label,
            "back_ref_type": link.back_ref_type,
            "back_ref_id": link.back_ref_id,
            "detail": detail,
        })
    return jsonify({"chain": result})


@app.route("/api/records/<record_id>/history-diff", methods=["GET"])
def history_diff(record_id):
    record = records.get(record_id)
    if not record:
        return jsonify({"error": "record not found"}), 404
    diffs = engine.get_history_diff(record)
    return jsonify({"diffs": diffs})


@app.route("/api/demo/rollback-scenario", methods=["POST"])
def demo_rollback_scenario():
    record = engine.create_record("回滚测试组合", "张三")
    records[record.id] = record

    note = TaxRateNote(tax_category="增值税", rate=0.06, remark="原始备注", approver_name="张三")
    engine.import_tax_notes(record, [note], "老秦")

    h1 = engine.update_note_remark(record, note.id, "第一次改", "老秦")
    h2 = engine.update_note_remark(record, note.id, "第二次改", "老秦")

    state_before = _record_to_dict(record)
    remark_before = note.remark

    success = engine.rollback_record(record, h1.id, "管理员")
    remark_after = note.remark
    state_after = _record_to_dict(record)

    return jsonify({
        "record_id": record.id,
        "note_id": note.id,
        "h1_id": h1.id,
        "h2_id": h2.id,
        "remark_before_rollback": remark_before,
        "remark_after_rollback": remark_after,
        "rollback_success": success,
        "rollback_target": h1.id,
        "expected_remark_after": "第一次改",
        "actual_remark_after": remark_after,
        "remark_correctly_restored": remark_after == "第一次改",
        "status_after": record.status.value,
        "state_before": state_before,
        "state_after": state_after,
    })


if __name__ == "__main__":
    app.run(debug=True, port=5000)
