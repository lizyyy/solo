from flask import Blueprint, request, jsonify

from src.models.db import init_db
from src.services.verification import (
    import_transactions,
    update_transaction_field,
    get_transaction_history,
    advance_verification_step,
    add_supplementary_email,
    get_verification_with_trace,
    rollback_verification,
    fix_approver,
    confirm_review,
    list_verifications,
    export_verifications,
)

bp = Blueprint("api", __name__, url_prefix="/api")


@bp.before_request
def ensure_db():
    init_db()


@bp.route("/transactions/import", methods=["POST"])
def api_import():
    data = request.get_json(force=True)
    transactions = data.get("transactions", [])
    if not transactions:
        return jsonify({"error": "请提供柜台流水数据"}), 400
    result = import_transactions(transactions)
    status = 200 if not result.get("errors") else 207
    return jsonify(result), status


@bp.route("/transactions/<transaction_id>", methods=["GET"])
def api_get_transaction(transaction_id):
    from src.models.db import get_db
    conn = get_db()
    try:
        c = conn.cursor()
        c.execute("SELECT * FROM counter_transactions WHERE id = ?", (transaction_id,))
        row = c.fetchone()
        if not row:
            return jsonify({"error": "找不到对应的柜台流水记录"}), 404
        return jsonify(dict(row))
    finally:
        conn.close()


@bp.route("/transactions/<transaction_id>/update", methods=["PATCH"])
def api_update_field(transaction_id):
    data = request.get_json(force=True)
    field_name = data.get("field_name")
    new_value = data.get("new_value", "")
    changed_by = data.get("changed_by", "")
    if not field_name:
        return jsonify({"error": "请指定要修改的字段"}), 400
    result = update_transaction_field(transaction_id, field_name, new_value, changed_by)
    if "error" in result:
        return jsonify(result), 400
    return jsonify(result)


@bp.route("/transactions/<transaction_id>/history", methods=["GET"])
def api_transaction_history(transaction_id):
    history = get_transaction_history(transaction_id)
    return jsonify({"transaction_id": transaction_id, "history": history})


@bp.route("/transactions/<transaction_id>/fix-approver", methods=["POST"])
def api_fix_approver(transaction_id):
    data = request.get_json(force=True)
    new_approver = data.get("new_approver", "").strip()
    operator = data.get("operator", "")
    if not new_approver:
        return jsonify({"error": "审批人不能为空"}), 400
    result = fix_approver(transaction_id, new_approver, operator)
    if "error" in result:
        return jsonify(result), 400
    return jsonify(result)


@bp.route("/transactions/<transaction_id>/confirm-review", methods=["POST"])
def api_confirm_review(transaction_id):
    data = request.get_json(force=True) or {}
    reviewer = data.get("reviewer", "")
    result = confirm_review(transaction_id, reviewer)
    if "error" in result:
        return jsonify(result), 400
    return jsonify(result)


@bp.route("/verifications", methods=["GET"])
def api_list_verifications():
    step = request.args.get("step")
    approver_status = request.args.get("approver_status")
    result = list_verifications(step=step, approver_status=approver_status)
    return jsonify({"verifications": result, "total": len(result)})


@bp.route("/verifications/<verification_id>/trace", methods=["GET"])
def api_verification_trace(verification_id):
    result = get_verification_with_trace(verification_id)
    if "error" in result:
        return jsonify(result), 404
    return jsonify(result)


@bp.route("/verifications/<verification_id>/advance", methods=["POST"])
def api_advance_step(verification_id):
    data = request.get_json(force=True)
    target_step = data.get("target_step", "").strip()
    operator = data.get("operator", "")
    email_id = data.get("supplementary_email_id", "")
    new_balance = data.get("new_balance")

    from src.models.db import get_db
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT transaction_id FROM green_bond_verifications WHERE id = ?", (verification_id,))
    row = c.fetchone()
    conn.close()
    if not row:
        return jsonify({"error": "找不到对应的绿色债券投向占比核验记录"}), 404

    result = advance_verification_step(
        row["transaction_id"],
        target_step,
        operator=operator,
        supplementary_email_id=email_id,
        new_balance=new_balance,
    )
    if "error" in result:
        return jsonify(result), 400
    return jsonify(result)


@bp.route("/verifications/<verification_id>/rollback", methods=["POST"])
def api_rollback(verification_id):
    data = request.get_json(force=True) or {}
    reason = data.get("reason", "")
    result = rollback_verification(verification_id, reason)
    if "error" in result:
        return jsonify(result), 400
    return jsonify(result)


@bp.route("/transactions/<transaction_id>/emails", methods=["POST"])
def api_add_email(transaction_id):
    data = request.get_json(force=True)
    sender = data.get("sender", "").strip()
    content = data.get("content", "").strip()
    if not sender or not content:
        return jsonify({"error": "发件人和邮件内容不能为空"}), 400
    result = add_supplementary_email(transaction_id, sender, content)
    return jsonify(result), 201


@bp.route("/transactions/<transaction_id>/emails", methods=["GET"])
def api_list_emails(transaction_id):
    from src.models.db import get_db
    conn = get_db()
    try:
        c = conn.cursor()
        c.execute(
            "SELECT * FROM supplementary_emails WHERE transaction_id = ? ORDER BY created_at",
            (transaction_id,),
        )
        rows = [dict(r) for r in c.fetchall()]
        return jsonify({"emails": rows})
    finally:
        conn.close()


@bp.route("/transactions/<transaction_id>/review", methods=["GET"])
def api_review_transaction(transaction_id):
    from src.models.db import get_db
    conn = get_db()
    try:
        c = conn.cursor()
        c.execute("SELECT * FROM counter_transactions WHERE id = ?", (transaction_id,))
        txn = c.fetchone()
        if not txn:
            return jsonify({"error": "找不到对应的柜台流水记录"}), 404

        c.execute(
            "SELECT * FROM supplementary_emails WHERE transaction_id = ? ORDER BY created_at",
            (transaction_id,),
        )
        emails = [dict(r) for r in c.fetchall()]

        c.execute(
            "SELECT * FROM transaction_history WHERE transaction_id = ? ORDER BY changed_at",
            (transaction_id,),
        )
        history = [dict(r) for r in c.fetchall()]

        review_actions = {
            "fix_approver": f"/api/transactions/{transaction_id}/fix-approver",
            "confirm_review": f"/api/transactions/{transaction_id}/confirm-review",
            "view_emails": f"/api/transactions/{transaction_id}/emails",
            "add_email": f"/api/transactions/{transaction_id}/emails",
        }

        txn_dict = dict(txn)
        review_required = txn_dict.get("review_required", 0)
        if review_required:
            review_actions["confirm_review_hint"] = "审批人已修改，需复核确认后才能继续后续步骤"

        return jsonify({
            "transaction": txn_dict,
            "supplementary_emails": emails,
            "change_history": history,
            "review_actions": review_actions,
        })
    finally:
        conn.close()


@bp.route("/verifications/export", methods=["GET"])
def api_export_verifications():
    step = request.args.get("step")
    approver_status = request.args.get("approver_status")
    data = export_verifications(step=step, approver_status=approver_status)
    return jsonify(data)


@bp.route("/verifications/chart-data", methods=["GET"])
def api_chart_data():
    from src.models.db import get_db
    conn = get_db()
    try:
        c = conn.cursor()
        c.execute("""
            SELECT v.verification_step, t.approver_status, COUNT(*) as cnt
            FROM green_bond_verifications v
            JOIN counter_transactions t ON v.transaction_id = t.id
            GROUP BY v.verification_step, t.approver_status
        """)
        rows = [dict(r) for r in c.fetchall()]

        c.execute("""
            SELECT v.id as verification_id, v.transaction_id, v.verification_step, t.tail_number,
                   t.approver, t.approver_status, t.review_required, v.green_ratio
            FROM green_bond_verifications v
            JOIN counter_transactions t ON v.transaction_id = t.id
            WHERE t.approver_status = 'pinyin_only' OR t.review_required = 1
        """)
        pinyin_items = []
        for r in c.fetchall():
            row_dict = dict(r)
            row_dict["trace_links"] = {
                "detail": f"/api/verifications/{row_dict['verification_id']}/trace",
                "transaction": f"/api/transactions/{row_dict['transaction_id']}",
                "review": f"/api/transactions/{row_dict['transaction_id']}/review",
            }
            pinyin_items.append(row_dict)

        return jsonify({
            "summary": rows,
            "pinyin_approver_items": pinyin_items,
            "note": "点击拼音审批人条目可追溯到柜台流水尾号或客户经理补充邮件",
        })
    finally:
        conn.close()
