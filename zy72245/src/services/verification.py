import json
from typing import Optional, List, Dict, Any

from src.models.db import (
    get_db, _now, _uuid, init_db,
    VERIFICATION_STEP_IMPORT,
    VERIFICATION_STEP_EMAIL_REVIEW,
    VERIFICATION_STEP_BALANCE_UPDATE,
    APPROVER_STATUS_PINYIN_ONLY,
    APPROVER_STATUS_NORMAL,
    APPROVER_STATUS_PENDING_REVIEW,
    VERIFICATION_STATUS_PENDING,
    VERIFICATION_STATUS_APPROVED,
    VERIFICATION_STATUS_REJECTED,
)
from src.services.approver_checker import classify_approver
from src.services.error_messages import get_error, humanize_field


def import_transactions(transactions: List[Dict[str, Any]], db_path: Optional[str] = None) -> Dict[str, Any]:
    conn = get_db(db_path)
    c = conn.cursor()
    batch_id = _uuid()
    imported = []
    skipped = []
    errors = []

    try:
        for txn in transactions:
            tail_number = txn.get("tail_number", "").strip()
            approver = txn.get("approver", "").strip()
            amount = txn.get("amount")
            remark = txn.get("remark", "")

            if not tail_number:
                errors.append(get_error("MISSING_TAIL_NUMBER"))
                continue
            if not approver:
                errors.append(get_error("MISSING_APPROVER"))
                continue
            if amount is None:
                errors.append(get_error("MISSING_AMOUNT"))
                continue
            try:
                amount = float(amount)
            except (ValueError, TypeError):
                errors.append(get_error("INVALID_AMOUNT"))
                continue

            c.execute(
                "SELECT id FROM counter_transactions WHERE tail_number = ? AND approver = ?",
                (tail_number, approver),
            )
            if c.fetchone():
                skipped.append({
                    "tail_number": tail_number,
                    "reason": get_error("DUPLICATE_IMPORT"),
                })
                continue

            approver_status = classify_approver(approver)
            txn_id = _uuid()
            now = _now()

            c.execute(
                """INSERT INTO counter_transactions
                   (id, tail_number, amount, approver, approver_status, remark, batch_id, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (txn_id, tail_number, amount, approver, approver_status, remark, batch_id, now, now),
            )

            verif_id = _uuid()
            green_ratio = txn.get("green_ratio", 0.0)
            c.execute(
                """INSERT INTO green_bond_verifications
                   (id, transaction_id, green_ratio, verification_step, status, reviewer, supplementary_email_id, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (verif_id, txn_id, green_ratio, VERIFICATION_STEP_IMPORT,
                 VERIFICATION_STATUS_PENDING, "", "", now, now),
            )

            if approver_status == APPROVER_STATUS_PINYIN_ONLY:
                c.execute(
                    """UPDATE green_bond_verifications
                       SET status = ?, updated_at = ?
                       WHERE id = ?""",
                    (VERIFICATION_STATUS_PENDING, now, verif_id),
                )

            imported.append({
                "transaction_id": txn_id,
                "verification_id": verif_id,
                "tail_number": tail_number,
                "approver_status": approver_status,
                "pinyin_warning": (
                    get_error("PINYIN_APPROVER_DETECTED", approver=approver)
                    if approver_status == APPROVER_STATUS_PINYIN_ONLY
                    else None
                ),
            })

        tail_numbers = list({t.get("tail_number", "") for t in transactions if t.get("tail_number")})
        c.execute(
            """INSERT INTO import_batches (batch_id, tail_numbers, imported_at, transaction_count)
               VALUES (?, ?, ?, ?)""",
            (batch_id, json.dumps(tail_numbers, ensure_ascii=False), _now(), len(imported)),
        )

        conn.commit()
    finally:
        conn.close()

    return {
        "batch_id": batch_id,
        "imported_count": len(imported),
        "skipped_count": len(skipped),
        "imported": imported,
        "skipped": skipped,
        "errors": errors,
    }


def update_transaction_field(
    transaction_id: str,
    field_name: str,
    new_value: str,
    changed_by: str = "",
    db_path: Optional[str] = None,
) -> Dict[str, Any]:
    ALLOWED_FIELDS = {"remark", "approver"}
    if field_name not in ALLOWED_FIELDS:
        return {"error": f"不允许直接修改字段「{humanize_field(field_name)}」"}

    conn = get_db(db_path)
    c = conn.cursor()

    try:
        c.execute("SELECT * FROM counter_transactions WHERE id = ?", (transaction_id,))
        row = c.fetchone()
        if not row:
            return {"error": get_error("TRANSACTION_NOT_FOUND")}

        old_value = str(row[field_name]) if row[field_name] is not None else ""
        if old_value == new_value:
            return {"message": f"「{humanize_field(field_name)}」没有变化，无需更新"}

        now = _now()
        history_id = _uuid()
        c.execute(
            """INSERT INTO transaction_history
               (id, transaction_id, field_name, old_value, new_value, changed_by, changed_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (history_id, transaction_id, field_name, old_value, new_value, changed_by, now),
        )

        c.execute(
            f"UPDATE counter_transactions SET {field_name} = ?, updated_at = ? WHERE id = ?",
            (new_value, now, transaction_id),
        )

        new_approver_status = row["approver_status"]
        if field_name == "approver":
            new_approver_status = classify_approver(new_value)
            c.execute(
                "UPDATE counter_transactions SET approver_status = ?, updated_at = ? WHERE id = ?",
                (new_approver_status, now, transaction_id),
            )

        conn.commit()

        result = {
            "transaction_id": transaction_id,
            "field_name": humanize_field(field_name),
            "old_value": old_value,
            "new_value": new_value,
            "changed_by": changed_by,
            "changed_at": now,
            "approver_status": new_approver_status,
        }

        if field_name == "approver" and new_approver_status == APPROVER_STATUS_PINYIN_ONLY:
            result["warning"] = get_error("APPROVER_FIX_REQUIRES_REVIEW")
        elif field_name == "approver" and new_approver_status == APPROVER_STATUS_NORMAL:
            if row["approver_status"] == APPROVER_STATUS_PINYIN_ONLY:
                result["warning"] = get_error("APPROVER_FIX_REQUIRES_REVIEW")

        return result
    finally:
        conn.close()


def get_transaction_history(transaction_id: str, db_path: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = get_db(db_path)
    try:
        c = conn.cursor()
        c.execute(
            """SELECT id, transaction_id, field_name, old_value, new_value, changed_by, changed_at
               FROM transaction_history
               WHERE transaction_id = ?
               ORDER BY changed_at ASC""",
            (transaction_id,),
        )
        rows = c.fetchall()
        return [
            {
                "id": r["id"],
                "field_name": humanize_field(r["field_name"]),
                "field_key": r["field_name"],
                "old_value": r["old_value"],
                "new_value": r["new_value"],
                "changed_by": r["changed_by"],
                "changed_at": r["changed_at"],
            }
            for r in rows
        ]
    finally:
        conn.close()


STEP_ORDER = [VERIFICATION_STEP_IMPORT, VERIFICATION_STEP_EMAIL_REVIEW, VERIFICATION_STEP_BALANCE_UPDATE]


def advance_verification_step(
    transaction_id: str,
    target_step: str,
    operator: str = "",
    supplementary_email_id: str = "",
    new_balance: Optional[float] = None,
    db_path: Optional[str] = None,
) -> Dict[str, Any]:
    if target_step not in STEP_ORDER:
        return {"error": get_error("INVALID_STEP")}

    conn = get_db(db_path)
    c = conn.cursor()

    try:
        c.execute(
            """SELECT * FROM green_bond_verifications
               WHERE transaction_id = ?
               ORDER BY created_at DESC LIMIT 1""",
            (transaction_id,),
        )
        verif = c.fetchone()
        if not verif:
            return {"error": get_error("VERIFICATION_NOT_FOUND")}

        current_step = verif["verification_step"]
        current_idx = STEP_ORDER.index(current_step) if current_step in STEP_ORDER else -1
        target_idx = STEP_ORDER.index(target_step)

        if target_idx != current_idx + 1:
            return {
                "error": get_error(
                    "STEP_ORDER_VIOLATION",
                    detail=f"当前在「{current_step}」，不能直接跳到「{target_step}」",
                )
            }

        c.execute(
            "SELECT * FROM counter_transactions WHERE id = ?",
            (transaction_id,),
        )
        txn = c.fetchone()
        if not txn:
            return {"error": get_error("TRANSACTION_NOT_FOUND")}

        if txn["approver_status"] == APPROVER_STATUS_PINYIN_ONLY and target_step != VERIFICATION_STEP_EMAIL_REVIEW:
            return {
                "error": get_error("PINYIN_APPROVER_DETECTED", approver=txn["approver"]),
                "action_required": "请先让客户经理复核审批人信息，再继续后续步骤",
            }

        now = _now()
        new_status = VERIFICATION_STATUS_PENDING

        if target_step == VERIFICATION_STEP_BALANCE_UPDATE:
            if new_balance is None:
                return {"error": "余额更新步骤必须提供新余额"}
            balance_id = _uuid()
            c.execute(
                """INSERT INTO balance_changes
                   (id, transaction_id, old_balance, new_balance, changed_at)
                   VALUES (?, ?, ?, ?, ?)""",
                (balance_id, transaction_id, 0, new_balance, now),
            )
            new_status = VERIFICATION_STATUS_APPROVED

        verif_id = _uuid()
        c.execute(
            """INSERT INTO green_bond_verifications
               (id, transaction_id, green_ratio, verification_step, status, reviewer, supplementary_email_id, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (verif_id, transaction_id, verif["green_ratio"], target_step,
             new_status, operator, supplementary_email_id, now, now),
        )

        conn.commit()

        return {
            "verification_id": verif_id,
            "transaction_id": transaction_id,
            "previous_step": current_step,
            "current_step": target_step,
            "status": new_status,
            "approver_status": txn["approver_status"],
        }
    finally:
        conn.close()


def add_supplementary_email(
    transaction_id: str,
    sender: str,
    content: str,
    db_path: Optional[str] = None,
) -> Dict[str, Any]:
    conn = get_db(db_path)
    try:
        c = conn.cursor()
        email_id = _uuid()
        now = _now()
        c.execute(
            """INSERT INTO supplementary_emails
               (id, transaction_id, sender, content, created_at)
               VALUES (?, ?, ?, ?, ?)""",
            (email_id, transaction_id, sender, content, now),
        )
        conn.commit()
        return {
            "email_id": email_id,
            "transaction_id": transaction_id,
            "sender": sender,
            "created_at": now,
        }
    finally:
        conn.close()


def get_verification_with_trace(
    verification_id: str,
    db_path: Optional[str] = None,
) -> Dict[str, Any]:
    conn = get_db(db_path)
    try:
        c = conn.cursor()
        c.execute(
            "SELECT * FROM green_bond_verifications WHERE id = ?",
            (verification_id,),
        )
        verif = c.fetchone()
        if not verif:
            return {"error": get_error("VERIFICATION_NOT_FOUND")}

        transaction_id = verif["transaction_id"]

        c.execute("SELECT * FROM counter_transactions WHERE id = ?", (transaction_id,))
        txn = c.fetchone()

        c.execute(
            "SELECT * FROM supplementary_emails WHERE transaction_id = ? ORDER BY created_at",
            (transaction_id,),
        )
        emails = [dict(r) for r in c.fetchall()]

        c.execute(
            "SELECT * FROM balance_changes WHERE transaction_id = ? ORDER BY changed_at",
            (transaction_id,),
        )
        balances = [dict(r) for r in c.fetchall()]

        c.execute(
            """SELECT * FROM green_bond_verifications
               WHERE transaction_id = ? ORDER BY created_at""",
            (transaction_id,),
        )
        steps = [dict(r) for r in c.fetchall()]

        result = {
            "verification": dict(verif),
            "transaction": dict(txn) if txn else None,
            "supplementary_emails": emails,
            "balance_changes": balances,
            "all_steps": steps,
            "trace_links": {},
        }

        if txn:
            result["trace_links"]["transaction_detail"] = f"/api/transactions/{transaction_id}"
        if emails:
            result["trace_links"]["supplementary_emails"] = [
                f"/api/emails/{e['id']}" for e in emails
            ]
        if txn and txn["approver_status"] == APPROVER_STATUS_PINYIN_ONLY:
            result["trace_links"]["approver_review"] = f"/api/transactions/{transaction_id}/review"

        return result
    finally:
        conn.close()


def rollback_verification(
    verification_id: str,
    reason: str = "",
    db_path: Optional[str] = None,
) -> Dict[str, Any]:
    conn = get_db(db_path)
    c = conn.cursor()

    try:
        c.execute("SELECT * FROM green_bond_verifications WHERE id = ?", (verification_id,))
        verif = c.fetchone()
        if not verif:
            return {"error": get_error("VERIFICATION_NOT_FOUND")}

        transaction_id = verif["transaction_id"]
        current_step = verif["verification_step"]
        current_idx = STEP_ORDER.index(current_step) if current_step in STEP_ORDER else -1

        if current_idx <= 0:
            return {"error": get_error("ROLLBACK_FAILED", detail="已在初始步骤，无法回滚")}

        prev_step = STEP_ORDER[current_idx - 1]
        now = _now()

        c.execute(
            """DELETE FROM green_bond_verifications WHERE id = ?""",
            (verification_id,),
        )

        if current_step == VERIFICATION_STEP_BALANCE_UPDATE:
            c.execute(
                "DELETE FROM balance_changes WHERE transaction_id = ?",
                (transaction_id,),
            )

        remaining = c.execute(
            "SELECT id FROM green_bond_verifications WHERE transaction_id = ? ORDER BY created_at DESC LIMIT 1",
            (transaction_id,),
        ).fetchone()

        conn.commit()

        return {
            "rolled_back_from": current_step,
            "rolled_back_to": prev_step,
            "transaction_id": transaction_id,
            "reason": reason,
        }
    finally:
        conn.close()


def fix_approver(
    transaction_id: str,
    new_approver: str,
    operator: str = "",
    db_path: Optional[str] = None,
) -> Dict[str, Any]:
    conn = get_db(db_path)
    c = conn.cursor()

    try:
        c.execute("SELECT * FROM counter_transactions WHERE id = ?", (transaction_id,))
        txn = c.fetchone()
        if not txn:
            return {"error": get_error("TRANSACTION_NOT_FOUND")}

        old_approver = txn["approver"]
        old_status = txn["approver_status"]
        new_status = classify_approver(new_approver)
        now = _now()

        history_id = _uuid()
        c.execute(
            """INSERT INTO transaction_history
               (id, transaction_id, field_name, old_value, new_value, changed_by, changed_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (history_id, transaction_id, "approver", old_approver, new_approver, operator, now),
        )

        c.execute(
            """UPDATE counter_transactions
               SET approver = ?, approver_status = ?, updated_at = ?
               WHERE id = ?""",
            (new_approver, new_status, now, transaction_id),
        )

        conn.commit()

        result = {
            "transaction_id": transaction_id,
            "old_approver": old_approver,
            "new_approver": new_approver,
            "old_status": old_status,
            "new_status": new_status,
            "requires_review": new_status != APPROVER_STATUS_NORMAL or old_status == APPROVER_STATUS_PINYIN_ONLY,
        }

        if result["requires_review"]:
            result["message"] = get_error("APPROVER_FIX_REQUIRES_REVIEW")

        return result
    finally:
        conn.close()


def list_verifications(
    step: Optional[str] = None,
    approver_status: Optional[str] = None,
    db_path: Optional[str] = None,
) -> List[Dict[str, Any]]:
    conn = get_db(db_path)
    try:
        c = conn.cursor()

        query = """
            SELECT v.*, t.tail_number, t.approver, t.approver_status, t.amount
            FROM green_bond_verifications v
            JOIN counter_transactions t ON v.transaction_id = t.id
            WHERE 1=1
        """
        params = []

        if step:
            query += " AND v.verification_step = ?"
            params.append(step)
        if approver_status:
            query += " AND t.approver_status = ?"
            params.append(approver_status)

        query += " ORDER BY v.created_at DESC"

        c.execute(query, params)
        rows = c.fetchall()

        result = []
        seen_txn_steps = {}
        for r in rows:
            key = f"{r['transaction_id']}_{r['verification_step']}"
            if key in seen_txn_steps:
                continue
            seen_txn_steps[key] = True

            item = dict(r)
            if r["approver_status"] == APPROVER_STATUS_PINYIN_ONLY:
                item["trace_links"] = {
                    "transaction_detail": f"/api/transactions/{r['transaction_id']}",
                    "supplementary_emails": f"/api/transactions/{r['transaction_id']}/emails",
                }
            result.append(item)

        return result
    finally:
        conn.close()
