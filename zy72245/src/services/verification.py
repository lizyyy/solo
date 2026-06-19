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
                   (id, tail_number, amount, approver, approver_status, review_required, remark, batch_id, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (txn_id, tail_number, amount, approver, approver_status, 0, remark, batch_id, now, now),
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
        review_required = row["review_required"] if "review_required" in row.keys() else 0
        if field_name == "approver":
            new_approver_status = classify_approver(new_value)
            needs_review = (
                row["approver_status"] == APPROVER_STATUS_PINYIN_ONLY
                or new_approver_status == APPROVER_STATUS_PINYIN_ONLY
            )
            review_required = 1 if needs_review else review_required
            c.execute(
                "UPDATE counter_transactions SET approver_status = ?, review_required = ?, updated_at = ? WHERE id = ?",
                (new_approver_status, review_required, now, transaction_id),
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
            "review_required": bool(review_required) if field_name == "approver" else None,
        }

        if field_name == "approver" and review_required:
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

        review_required = txn["review_required"] if "review_required" in txn.keys() else 0
        if review_required and target_step == VERIFICATION_STEP_BALANCE_UPDATE:
            return {
                "error": get_error("REVIEW_NOT_CONFIRMED"),
                "action_required": "审批人已修改，请先通过复核确认后再进入余额更新步骤",
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
                f"/api/transactions/{transaction_id}/emails" for _ in emails
            ]
        if txn and (txn["approver_status"] == APPROVER_STATUS_PINYIN_ONLY or (txn["review_required"] if "review_required" in txn.keys() else 0)):
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
        needs_review = old_status == APPROVER_STATUS_PINYIN_ONLY
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
               SET approver = ?, approver_status = ?, review_required = ?, updated_at = ?
               WHERE id = ?""",
            (new_approver, new_status, 1 if needs_review else 0, now, transaction_id),
        )

        conn.commit()

        result = {
            "transaction_id": transaction_id,
            "old_approver": old_approver,
            "new_approver": new_approver,
            "old_status": old_status,
            "new_status": new_status,
            "review_required": needs_review,
        }

        if needs_review:
            result["message"] = get_error("APPROVER_FIX_REQUIRES_REVIEW")

        return result
    finally:
        conn.close()


def confirm_review(
    transaction_id: str,
    reviewer: str = "",
    db_path: Optional[str] = None,
) -> Dict[str, Any]:
    conn = get_db(db_path)
    c = conn.cursor()

    try:
        c.execute("SELECT * FROM counter_transactions WHERE id = ?", (transaction_id,))
        txn = c.fetchone()
        if not txn:
            return {"error": get_error("TRANSACTION_NOT_FOUND")}

        review_required = txn["review_required"] if "review_required" in txn.keys() else 0
        if not review_required:
            return {"message": "该记录无需复核确认"}

        now = _now()
        history_id = _uuid()
        c.execute(
            """INSERT INTO transaction_history
               (id, transaction_id, field_name, old_value, new_value, changed_by, changed_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (history_id, transaction_id, "review_required", "1", "0", reviewer, now),
        )

        c.execute(
            """UPDATE counter_transactions
               SET review_required = 0, updated_at = ?
               WHERE id = ?""",
            (now, transaction_id),
        )

        conn.commit()

        return {
            "transaction_id": transaction_id,
            "review_required": False,
            "reviewer": reviewer,
            "confirmed_at": now,
        }
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
            SELECT v.*, t.tail_number, t.approver, t.approver_status, t.review_required, t.amount
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
            review_required = r["review_required"] if "review_required" in r.keys() else 0
            if r["approver_status"] == APPROVER_STATUS_PINYIN_ONLY or review_required:
                item["trace_links"] = {
                    "transaction_detail": f"/api/transactions/{r['transaction_id']}",
                    "supplementary_emails": f"/api/transactions/{r['transaction_id']}/emails",
                    "approver_review": f"/api/transactions/{r['transaction_id']}/review",
                }
            result.append(item)

        return result
    finally:
        conn.close()


def export_verifications(
    step: Optional[str] = None,
    approver_status: Optional[str] = None,
    db_path: Optional[str] = None,
) -> Dict[str, Any]:
    conn = get_db(db_path)
    try:
        c = conn.cursor()

        query = """
            SELECT DISTINCT
                t.id AS transaction_id,
                t.tail_number,
                t.amount,
                t.approver,
                t.approver_status,
                t.review_required,
                t.remark,
                t.batch_id,
                t.created_at,
                t.updated_at
            FROM counter_transactions t
            WHERE 1=1
        """
        params = []
        if approver_status:
            query += " AND t.approver_status = ?"
            params.append(approver_status)

        query += " ORDER BY t.created_at DESC"

        c.execute(query, params)
        txn_rows = [dict(r) for r in c.fetchall()]

        txn_ids = [r["transaction_id"] for r in txn_rows]
        placeholders = ",".join("?" * len(txn_ids)) if txn_ids else "''"

        verif_map = {}
        if txn_ids:
            c.execute(
                f"""
                SELECT transaction_id, id AS verification_id,
                       green_ratio, verification_step, status, reviewer,
                       supplementary_email_id, created_at, updated_at
                FROM green_bond_verifications
                WHERE transaction_id IN ({placeholders})
                ORDER BY created_at DESC
                """,
                txn_ids,
            )
            for v in c.fetchall():
                vid = v["transaction_id"]
                verif_map.setdefault(vid, []).append(dict(v))

        email_map = {}
        if txn_ids:
            c.execute(
                f"""
                SELECT id, transaction_id, sender, content, created_at
                FROM supplementary_emails
                WHERE transaction_id IN ({placeholders})
                ORDER BY created_at ASC
                """,
                txn_ids,
            )
            for e in c.fetchall():
                tid = e["transaction_id"]
                email_map.setdefault(tid, []).append(dict(e))

        balance_map = {}
        if txn_ids:
            c.execute(
                f"""
                SELECT id, transaction_id, old_balance, new_balance, changed_at
                FROM balance_changes
                WHERE transaction_id IN ({placeholders})
                ORDER BY changed_at ASC
                """,
                txn_ids,
            )
            for b in c.fetchall():
                tid = b["transaction_id"]
                balance_map.setdefault(tid, []).append(dict(b))

        history_map = {}
        if txn_ids:
            c.execute(
                f"""
                SELECT id, transaction_id, field_name, old_value, new_value, changed_by, changed_at
                FROM transaction_history
                WHERE transaction_id IN ({placeholders})
                ORDER BY changed_at ASC
                """,
                txn_ids,
            )
            for h in c.fetchall():
                tid = h["transaction_id"]
                history_map.setdefault(tid, []).append({
                    "field_name": humanize_field(h["field_name"]),
                    "field_key": h["field_name"],
                    "old_value": h["old_value"],
                    "new_value": h["new_value"],
                    "changed_by": h["changed_by"],
                    "changed_at": h["changed_at"],
                })

        rows = []
        status_display = {
            APPROVER_STATUS_PINYIN_ONLY: "审批人仅拼音（待复核）",
            APPROVER_STATUS_NORMAL: "审批人正常",
        }
        step_display = {
            VERIFICATION_STEP_IMPORT: "第1步-柜台流水尾号导入",
            VERIFICATION_STEP_EMAIL_REVIEW: "第2步-补看客户经理补充邮件",
            VERIFICATION_STEP_BALANCE_UPDATE: "第3步-余额变化表更新",
        }
        review_display = {0: "无需复核", 1: "待复核确认"}

        for txn in txn_rows:
            tid = txn["transaction_id"]
            verifs = verif_map.get(tid, [])
            last_verif = verifs[0] if verifs else {}

            pinyin_only = txn["approver_status"] == APPROVER_STATUS_PINYIN_ONLY
            review_req = bool(txn.get("review_required", 0))

            block_reason = None
            if pinyin_only and last_verif.get("verification_step") != VERIFICATION_STEP_IMPORT:
                block_reason = "拼音审批人未解决"
            elif review_req and last_verif.get("verification_step") == VERIFICATION_STEP_EMAIL_REVIEW:
                block_reason = "审批人已修改，尚未复核确认"

            export_row = {
                "柜台流水尾号": txn["tail_number"],
                "金额": txn["amount"],
                "审批人": txn["approver"],
                "审批人状态": status_display.get(txn["approver_status"], txn["approver_status"]),
                "复核状态": review_display.get(txn.get("review_required", 0), "未知"),
                "是否需复核": "是" if (pinyin_only or review_req) else "否",
                "绿色债券投向占比": last_verif.get("green_ratio", 0),
                "当前核验步骤": step_display.get(last_verif.get("verification_step", ""),
                                              last_verif.get("verification_step", "-")),
                "核验状态": "待处理" if last_verif.get("status") == VERIFICATION_STATUS_PENDING
                           else "已通过" if last_verif.get("status") == VERIFICATION_STATUS_APPROVED
                           else last_verif.get("status", "-"),
                "流程阻断原因": block_reason if block_reason else "无",
                "备注": txn.get("remark", ""),
                "客户经理补充邮件数量": len(email_map.get(tid, [])),
                "余额变更次数": len(balance_map.get(tid, [])),
                "变更历史条目数": len(history_map.get(tid, [])),
                "导入时间": txn["created_at"],
                "最后更新时间": txn["updated_at"],
                "transaction_id": tid,
                "_detail": {
                    "all_verification_steps": verifs,
                    "supplementary_emails": email_map.get(tid, []),
                    "balance_changes": balance_map.get(tid, []),
                    "change_history": history_map.get(tid, []),
                },
            }
            rows.append(export_row)

        pinyin_count = sum(1 for r in rows if r["审批人状态"] == status_display[APPROVER_STATUS_PINYIN_ONLY])
        review_pending_count = sum(1 for r in rows if r["复核状态"] == "待复核确认")
        approved_count = sum(1 for r in rows if r["核验状态"] == "已通过")
        blocked_count = sum(1 for r in rows if r["流程阻断原因"] != "无")

        return {
            "exported_at": _now(),
            "summary": {
                "总记录数": len(rows),
                "拼音审批人记录数": pinyin_count,
                "待复核确认记录数": review_pending_count,
                "已通过核验记录数": approved_count,
                "流程阻断记录数": blocked_count,
                "已完成余额更新记录数": len(balance_map),
            },
            "rules": {
                "改为中文名后仍需复核": "是",
                "所有改审批人的入口都必须复核": "是",
                "复核通过后方可继续余额更新": "是",
            },
            "rows": rows,
        }
    finally:
        conn.close()
