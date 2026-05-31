import json
from datetime import datetime
from typing import Optional
from database import query_db, execute_db, get_db
from models import (
    PaymentRecord, RefundApplication, ApprovalRecord, ManualNote,
    BatchCreate, BatchConfirm, ReconciliationEntry, ConflictResolution,
    RefundStatusUpdate, ExportRequest,
)

VALID_REFUND_STATUSES = {"pending", "approved", "processing", "completed", "rework", "rejected"}
VALID_BATCH_STATUSES = {"draft", "submitted", "confirmed", "exported"}
DUPLICATE_STRATEGIES = {"skip", "update", "conflict"}


def _now() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def _row_to_dict(row) -> Optional[dict]:
    if row is None:
        return None
    return dict(row)


def _rows_to_dicts(rows) -> list[dict]:
    return [dict(r) for r in rows]


def _build_field_diff(local_data: dict, incoming_data: dict, key_fields: list[str]) -> list[dict]:
    diffs = []
    all_keys = set(list(local_data.keys()) + list(incoming_data.keys()))
    for k in all_keys:
        if k in ("id", "imported_at"):
            continue
        local_val = local_data.get(k)
        incoming_val = incoming_data.get(k)
        if local_val != incoming_val:
            diffs.append({
                "field": k,
                "local_value": local_val,
                "incoming_value": incoming_val,
            })
    return diffs


def _build_suggestion(conflict_type: str, diffs: list[dict]) -> str:
    if not diffs:
        return "数据完全一致，可直接跳过。"

    if conflict_type == "payment_duplicate":
        changed_fields = "、".join(d["field"] for d in diffs)
        return (
            f"收款流水存在差异字段：{changed_fields}。"
            f"建议：如原始收款已入账，请选择「跳过」保留本地数据；"
            f"如确认外部数据更准确，选择「更新」覆盖本地；"
            f"如无法判断，选择「冲突」留待人工确认。"
        )

    if conflict_type == "refund_duplicate":
        status_diff = [d for d in diffs if d["field"] == "status"]
        amount_diff = [d for d in diffs if d["field"] == "refund_amount"]
        parts = []
        if status_diff:
            local_st = status_diff[0]["local_value"]
            incoming_st = status_diff[0]["incoming_value"]
            parts.append(
                f"状态从「{local_st}」变为「{incoming_st}」，"
                f"如该退款已被审批或正在处理，请勿直接更新状态，建议保留本地状态并人工核实。"
            )
        if amount_diff:
            parts.append(
                f"退款金额从 {amount_diff[0]['local_value']} 变为 {amount_diff[0]['incoming_value']}，"
                f"金额变更需审批确认，建议标记为冲突后走审批流程。"
            )
        other = [d for d in diffs if d["field"] not in ("status", "refund_amount")]
        if other:
            changed = "、".join(d["field"] for d in other)
            parts.append(f"其他差异字段：{changed}，可酌情更新。")
        return " ".join(parts)

    if conflict_type == "reconciliation_conflict":
        return (
            "月底对账表与导入数据存在金额差异，系统不会自动替您拍板。"
            "请核对两边证据后选择：以对账表为准 / 以导入数据为准 / 人工核实后再定。"
        )

    return "数据存在差异，建议人工确认后再决定跳过、更新或标记冲突。"


class PaymentService:
    @staticmethod
    def import_payments(records: list[PaymentRecord], strategy: str = "conflict") -> dict:
        if strategy not in DUPLICATE_STRATEGIES:
            strategy = "conflict"

        imported = 0
        skipped = 0
        updated = 0
        conflicts = 0
        conflict_details = []

        with get_db() as conn:
            for rec in records:
                existing = conn.execute(
                    "SELECT * FROM payment_records WHERE transaction_id = ?",
                    (rec.transaction_id,),
                ).fetchone()

                if existing is None:
                    conn.execute(
                        "INSERT INTO payment_records (transaction_id, card_no, student_name, amount, payment_time, description, source, imported_at) "
                        "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                        (rec.transaction_id, rec.card_no, rec.student_name, rec.amount,
                         rec.payment_time, rec.description, rec.source, _now()),
                    )
                    imported += 1
                else:
                    if strategy == "skip":
                        skipped += 1
                    elif strategy == "update":
                        conn.execute(
                            "UPDATE payment_records SET card_no=?, student_name=?, amount=?, "
                            "payment_time=?, description=?, source=?, imported_at=? WHERE transaction_id=?",
                            (rec.card_no, rec.student_name, rec.amount, rec.payment_time,
                             rec.description, rec.source, _now(), rec.transaction_id),
                        )
                        updated += 1
                    else:
                        local_data = dict(existing)
                        incoming_data = rec.model_dump()
                        diffs = _build_field_diff(local_data, incoming_data, ["transaction_id"])
                        if not diffs:
                            skipped += 1
                        else:
                            conflicts += 1
                            suggestion = _build_suggestion("payment_duplicate", diffs)
                            conn.execute(
                                "INSERT INTO conflicts (conflict_type, local_table, local_id, local_data, incoming_data, "
                                "field_differences, suggestion, created_at, status) VALUES (?,?,?,?,?,?,?,?,?)",
                                ("payment_duplicate", "payment_records", str(existing["id"]),
                                 json.dumps(local_data, ensure_ascii=False),
                                 json.dumps(incoming_data, ensure_ascii=False),
                                 json.dumps(diffs, ensure_ascii=False),
                                 suggestion, _now(), "open"),
                            )
                            conflict_details.append({
                                "transaction_id": rec.transaction_id,
                                "fields": [d["field"] for d in diffs],
                                "suggestion": suggestion,
                            })

            conn.execute(
                "INSERT INTO import_log (import_type, import_time, record_count, skipped_count, updated_count, conflict_count, details) "
                "VALUES (?,?,?,?,?,?,?)",
                ("payment", _now(), len(records), skipped, updated, conflicts,
                 json.dumps(conflict_details, ensure_ascii=False)),
            )

        return {
            "total": len(records),
            "imported": imported,
            "skipped": skipped,
            "updated": updated,
            "conflicts": conflicts,
            "conflict_details": conflict_details,
            "strategy_used": strategy,
            "说明": f"重复策略={strategy}：跳过{skipped}条，更新{updated}条，冲突{conflicts}条待确认",
        }

    @staticmethod
    def list_payments(transaction_id: Optional[str] = None, card_no: Optional[str] = None) -> list[dict]:
        sql = "SELECT * FROM payment_records WHERE 1=1"
        params = []
        if transaction_id:
            sql += " AND transaction_id = ?"
            params.append(transaction_id)
        if card_no:
            sql += " AND card_no = ?"
            params.append(card_no)
        sql += " ORDER BY payment_time DESC"
        rows = query_db(sql, tuple(params))
        return _rows_to_dicts(rows)


class RefundService:
    @staticmethod
    def import_refunds(records: list[RefundApplication], strategy: str = "conflict") -> dict:
        if strategy not in DUPLICATE_STRATEGIES:
            strategy = "conflict"

        imported = 0
        skipped = 0
        updated = 0
        conflicts = 0
        conflict_details = []

        with get_db() as conn:
            for rec in records:
                existing = conn.execute(
                    "SELECT * FROM refund_applications WHERE application_no = ?",
                    (rec.application_no,),
                ).fetchone()

                if existing is None:
                    conn.execute(
                        "INSERT INTO refund_applications (application_no, transaction_id, card_no, student_name, "
                        "refund_amount, reason, applicant, apply_time, status, rework_count, rework_reason, imported_at) "
                        "VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                        (rec.application_no, rec.transaction_id, rec.card_no, rec.student_name,
                         rec.refund_amount, rec.reason, rec.applicant, rec.apply_time,
                         rec.status, 0, "", _now()),
                    )
                    imported += 1
                else:
                    if strategy == "skip":
                        skipped += 1
                    elif strategy == "update":
                        new_rework_count = existing["rework_count"]
                        new_rework_reason = existing["rework_reason"]
                        if rec.status == "rework" and existing["status"] != "rework":
                            new_rework_count = existing["rework_count"] + 1
                            new_rework_reason = f"由「{existing['status']}」返工"

                        conn.execute(
                            "UPDATE refund_applications SET transaction_id=?, card_no=?, student_name=?, "
                            "refund_amount=?, reason=?, applicant=?, apply_time=?, status=?, "
                            "rework_count=?, rework_reason=?, imported_at=? WHERE application_no=?",
                            (rec.transaction_id, rec.card_no, rec.student_name, rec.refund_amount,
                             rec.reason, rec.applicant, rec.apply_time, rec.status,
                             new_rework_count, new_rework_reason, _now(), rec.application_no),
                        )
                        updated += 1
                    else:
                        local_data = dict(existing)
                        incoming_data = rec.model_dump()
                        diffs = _build_field_diff(local_data, incoming_data, ["application_no"])
                        if not diffs:
                            skipped += 1
                        else:
                            conflicts += 1
                            suggestion = _build_suggestion("refund_duplicate", diffs)
                            conn.execute(
                                "INSERT INTO conflicts (conflict_type, local_table, local_id, local_data, incoming_data, "
                                "field_differences, suggestion, created_at, status) VALUES (?,?,?,?,?,?,?,?,?)",
                                ("refund_duplicate", "refund_applications", str(existing["id"]),
                                 json.dumps(local_data, ensure_ascii=False),
                                 json.dumps(incoming_data, ensure_ascii=False),
                                 json.dumps(diffs, ensure_ascii=False),
                                 suggestion, _now(), "open"),
                            )
                            conflict_details.append({
                                "application_no": rec.application_no,
                                "fields": [d["field"] for d in diffs],
                                "suggestion": suggestion,
                            })

            conn.execute(
                "INSERT INTO import_log (import_type, import_time, record_count, skipped_count, updated_count, conflict_count, details) "
                "VALUES (?,?,?,?,?,?,?)",
                ("refund", _now(), len(records), skipped, updated, conflicts,
                 json.dumps(conflict_details, ensure_ascii=False)),
            )

        return {
            "total": len(records),
            "imported": imported,
            "skipped": skipped,
            "updated": updated,
            "conflicts": conflicts,
            "conflict_details": conflict_details,
            "strategy_used": strategy,
            "说明": f"重复策略={strategy}：跳过{skipped}条，更新{updated}条，冲突{conflicts}条待确认",
        }

    @staticmethod
    def update_status(application_no: str, update: RefundStatusUpdate) -> dict:
        if update.status not in VALID_REFUND_STATUSES:
            return {"error": f"无效状态「{update.status}」，有效值：{VALID_REFUND_STATUSES}"}

        existing = query_db(
            "SELECT * FROM refund_applications WHERE application_no = ?",
            (application_no,), one=True,
        )
        if not existing:
            return {"error": f"退款申请 {application_no} 不存在"}

        new_rework_count = existing["rework_count"]
        new_rework_reason = existing["rework_reason"]

        if update.status == "rework" and existing["status"] != "rework":
            new_rework_count = existing["rework_count"] + 1
            new_rework_reason = update.rework_reason or f"由「{existing['status']}」返工"

        execute_db(
            "UPDATE refund_applications SET status=?, rework_count=?, rework_reason=? WHERE application_no=?",
            (update.status, new_rework_count, new_rework_reason, application_no),
        )

        if update.rework_reason:
            execute_db(
                "INSERT INTO manual_notes (application_no, note_content, operator, note_time, note_type) VALUES (?,?,?,?,?)",
                (application_no, f"状态变更→{update.status}，原因：{update.rework_reason}",
                 update.operator, _now(), "status_change"),
            )

        return {
            "application_no": application_no,
            "old_status": existing["status"],
            "new_status": update.status,
            "rework_count": new_rework_count,
            "rework_reason": new_rework_reason,
            "提示": f"退款申请 {application_no} 状态已从「{existing['status']}」更新为「{update.status}」"
                    + (f"，返工次数+1" if update.status == "rework" and existing["status"] != "rework" else ""),
        }

    @staticmethod
    def list_refunds(
        application_no: Optional[str] = None,
        status: Optional[str] = None,
        card_no: Optional[str] = None,
    ) -> list[dict]:
        sql = "SELECT * FROM refund_applications WHERE 1=1"
        params = []
        if application_no:
            sql += " AND application_no = ?"
            params.append(application_no)
        if status:
            sql += " AND status = ?"
            params.append(status)
        if card_no:
            sql += " AND card_no = ?"
            params.append(card_no)
        sql += " ORDER BY apply_time DESC"
        rows = query_db(sql, tuple(params))
        return _rows_to_dicts(rows)


class ApprovalService:
    @staticmethod
    def import_approvals(records: list[ApprovalRecord]) -> dict:
        imported = 0
        skipped = 0

        with get_db() as conn:
            for rec in records:
                refund = conn.execute(
                    "SELECT application_no FROM refund_applications WHERE application_no = ?",
                    (rec.application_no,),
                ).fetchone()
                if not refund:
                    skipped += 1
                    continue

                existing = conn.execute(
                    "SELECT id FROM approval_records WHERE application_no=? AND approver=? AND approval_time=?",
                    (rec.application_no, rec.approver, rec.approval_time),
                ).fetchone()

                if existing:
                    skipped += 1
                    continue

                conn.execute(
                    "INSERT INTO approval_records (application_no, approver, approval_time, approval_result, remarks, email_subject, imported_at) "
                    "VALUES (?,?,?,?,?,?,?)",
                    (rec.application_no, rec.approver, rec.approval_time, rec.approval_result,
                     rec.remarks, rec.email_subject, _now()),
                )
                imported += 1

                if rec.approval_result == "approved":
                    conn.execute(
                        "UPDATE refund_applications SET status='approved' WHERE application_no=? AND status='pending'",
                        (rec.application_no,),
                    )

            conn.execute(
                "INSERT INTO import_log (import_type, import_time, record_count, skipped_count, updated_count, conflict_count, details) "
                "VALUES (?,?,?,?,?,?,?)",
                ("approval", _now(), len(records), skipped, 0, 0,
                 json.dumps({"skipped_no_refund": skipped}, ensure_ascii=False)),
            )

        return {
            "total": len(records),
            "imported": imported,
            "skipped": skipped,
            "说明": f"审批记录：新增{imported}条，跳过{skipped}条（无对应退款申请或重复）",
        }

    @staticmethod
    def list_approvals(application_no: Optional[str] = None) -> list[dict]:
        sql = "SELECT * FROM approval_records WHERE 1=1"
        params = []
        if application_no:
            sql += " AND application_no = ?"
            params.append(application_no)
        sql += " ORDER BY approval_time DESC"
        rows = query_db(sql, tuple(params))
        return _rows_to_dicts(rows)


class NoteService:
    @staticmethod
    def add_note(note: ManualNote) -> dict:
        refund = query_db(
            "SELECT application_no FROM refund_applications WHERE application_no = ?",
            (note.application_no,), one=True,
        )
        if not refund:
            return {"error": f"退款申请 {note.application_no} 不存在，无法添加备注"}

        execute_db(
            "INSERT INTO manual_notes (application_no, note_content, operator, note_time, note_type) VALUES (?,?,?,?,?)",
            (note.application_no, note.note_content, note.operator, note.note_time, note.note_type),
        )
        return {
            "application_no": note.application_no,
            "note_content": note.note_content,
            "operator": note.operator,
            "note_time": note.note_time,
            "提示": "备注已保存，重启服务后仍可查询",
        }

    @staticmethod
    def list_notes(application_no: Optional[str] = None) -> list[dict]:
        sql = "SELECT * FROM manual_notes WHERE 1=1"
        params = []
        if application_no:
            sql += " AND application_no = ?"
            params.append(application_no)
        sql += " ORDER BY note_time DESC"
        rows = query_db(sql, tuple(params))
        return _rows_to_dicts(rows)


class BatchService:
    @staticmethod
    def create_batch(batch: BatchCreate) -> dict:
        existing = query_db(
            "SELECT batch_no FROM batches WHERE batch_no = ?",
            (batch.batch_no,), one=True,
        )
        if existing:
            return {"error": f"批次号 {batch.batch_no} 已存在，请勿重复创建"}

        total_amount = 0.0
        total_count = 0

        with get_db() as conn:
            conn.execute(
                "INSERT INTO batches (batch_no, period_start, period_end, status, created_by, created_at, total_amount, total_count) "
                "VALUES (?,?,?,?,?,?,?,?)",
                (batch.batch_no, batch.period_start, batch.period_end, "draft",
                 batch.created_by, _now(), 0, 0),
            )
            batch_row = conn.execute(
                "SELECT id FROM batches WHERE batch_no = ?", (batch.batch_no,)
            ).fetchone()
            batch_id = batch_row["id"]

            for app_no in batch.application_nos:
                refund = conn.execute(
                    "SELECT refund_amount FROM refund_applications WHERE application_no = ?",
                    (app_no,),
                ).fetchone()
                if refund:
                    try:
                        conn.execute(
                            "INSERT INTO batch_items (batch_id, application_no) VALUES (?,?)",
                            (batch_id, app_no),
                        )
                        total_amount += refund["refund_amount"]
                        total_count += 1
                    except Exception:
                        pass

            conn.execute(
                "UPDATE batches SET total_amount=?, total_count=? WHERE id=?",
                (total_amount, total_count, batch_id),
            )

        return {
            "batch_no": batch.batch_no,
            "period": f"{batch.period_start} ~ {batch.period_end}",
            "status": "draft",
            "total_amount": total_amount,
            "total_count": total_count,
            "提示": "批次已创建（草稿状态），确认后不可随意修改，需人工拍板",
        }

    @staticmethod
    def confirm_batch(batch_no: str, confirm: BatchConfirm) -> dict:
        batch = query_db("SELECT * FROM batches WHERE batch_no = ?", (batch_no,), one=True)
        if not batch:
            return {"error": f"批次 {batch_no} 不存在"}
        if batch["status"] not in ("draft", "submitted"):
            return {"error": f"批次当前状态为「{batch['status']}」，仅草稿或已提交状态可确认"}

        execute_db(
            "UPDATE batches SET status='confirmed', confirmed_by=?, confirmed_at=? WHERE batch_no=?",
            (confirm.confirmed_by, _now(), batch_no),
        )
        return {
            "batch_no": batch_no,
            "status": "confirmed",
            "confirmed_by": confirm.confirmed_by,
            "confirmed_at": _now(),
            "提示": f"批次 {batch_no} 已由 {confirm.confirmed_by} 确认，可导出报告",
        }

    @staticmethod
    def submit_batch(batch_no: str) -> dict:
        batch = query_db("SELECT * FROM batches WHERE batch_no = ?", (batch_no,), one=True)
        if not batch:
            return {"error": f"批次 {batch_no} 不存在"}
        if batch["status"] != "draft":
            return {"error": f"仅草稿状态可提交，当前状态为「{batch['status']}」"}

        execute_db("UPDATE batches SET status='submitted' WHERE batch_no=?", (batch_no,))
        return {"batch_no": batch_no, "status": "submitted", "提示": "批次已提交，待确认"}

    @staticmethod
    def mark_exported(batch_no: str) -> dict:
        batch = query_db("SELECT * FROM batches WHERE batch_no = ?", (batch_no,), one=True)
        if not batch:
            return {"error": f"批次 {batch_no} 不存在"}
        if batch["status"] != "confirmed":
            return {"error": f"仅已确认状态可标记导出，当前状态为「{batch['status']}」"}

        execute_db("UPDATE batches SET status='exported' WHERE batch_no=?", (batch_no,))
        return {"batch_no": batch_no, "status": "exported", "提示": "批次已标记为已导出"}

    @staticmethod
    def list_batches(status: Optional[str] = None) -> list[dict]:
        sql = "SELECT * FROM batches WHERE 1=1"
        params = []
        if status:
            sql += " AND status = ?"
            params.append(status)
        sql += " ORDER BY created_at DESC"
        rows = query_db(sql, tuple(params))
        return _rows_to_dicts(rows)

    @staticmethod
    def get_batch_detail(batch_no: str) -> dict:
        batch = query_db("SELECT * FROM batches WHERE batch_no = ?", (batch_no,), one=True)
        if not batch:
            return {"error": f"批次 {batch_no} 不存在"}

        items = query_db(
            "SELECT bi.*, ra.card_no, ra.student_name, ra.refund_amount, ra.status as refund_status, ra.rework_count "
            "FROM batch_items bi JOIN refund_applications ra ON bi.application_no = ra.application_no "
            "WHERE bi.batch_id = ?",
            (batch["id"],),
        )

        notes = query_db(
            "SELECT * FROM manual_notes WHERE application_no IN "
            "(SELECT application_no FROM batch_items WHERE batch_id = ?)",
            (batch["id"],),
        )

        return {
            "batch": _row_to_dict(batch),
            "items": _rows_to_dicts(items),
            "notes": _rows_to_dicts(notes),
            "提示": "批次明细与备注来自同一份本地数据，导出报告将与此处一致",
        }


class ReconciliationService:
    @staticmethod
    def import_reconciliation(entries: list[ReconciliationEntry], strategy: str = "conflict") -> dict:
        if strategy not in DUPLICATE_STRATEGIES:
            strategy = "conflict"

        imported = 0
        skipped = 0
        updated = 0
        conflicts = 0
        conflict_details = []

        with get_db() as conn:
            for entry in entries:
                existing = conn.execute(
                    "SELECT * FROM reconciliation_table WHERE period=? AND category=? AND source=?",
                    (entry.period, entry.category, entry.source),
                ).fetchone()

                if existing is None:
                    conn.execute(
                        "INSERT INTO reconciliation_table (period, category, expected_amount, actual_amount, difference, source, description, imported_at) "
                        "VALUES (?,?,?,?,?,?,?,?)",
                        (entry.period, entry.category, entry.expected_amount, entry.actual_amount,
                         entry.difference, entry.source, entry.description, _now()),
                    )
                    imported += 1
                else:
                    if strategy == "skip":
                        skipped += 1
                    elif strategy == "update":
                        conn.execute(
                            "UPDATE reconciliation_table SET expected_amount=?, actual_amount=?, "
                            "difference=?, description=?, imported_at=? WHERE id=?",
                            (entry.expected_amount, entry.actual_amount, entry.difference,
                             entry.description, _now(), existing["id"]),
                        )
                        updated += 1
                    else:
                        local_data = dict(existing)
                        incoming_data = entry.model_dump()
                        diffs = _build_field_diff(local_data, incoming_data, ["period", "category", "source"])
                        if not diffs:
                            skipped += 1
                        else:
                            conflicts += 1
                            suggestion = _build_suggestion("reconciliation_conflict", diffs)

                            local_evidence = {
                                "对账表预期金额": local_data.get("expected_amount"),
                                "对账表实际金额": local_data.get("actual_amount"),
                                "对账表差异": local_data.get("difference"),
                                "对账表来源": local_data.get("source"),
                                "对账表描述": local_data.get("description"),
                                "对账表导入时间": local_data.get("imported_at"),
                            }
                            incoming_evidence = {
                                "导入预期金额": incoming_data.get("expected_amount"),
                                "导入实际金额": incoming_data.get("actual_amount"),
                                "导入差异": incoming_data.get("difference"),
                                "导入来源": incoming_data.get("source"),
                                "导入描述": incoming_data.get("description"),
                            }

                            conn.execute(
                                "INSERT INTO conflicts (conflict_type, local_table, local_id, local_data, incoming_data, "
                                "field_differences, suggestion, created_at, status) VALUES (?,?,?,?,?,?,?,?,?)",
                                ("reconciliation_conflict", "reconciliation_table", str(existing["id"]),
                                 json.dumps(local_evidence, ensure_ascii=False),
                                 json.dumps(incoming_evidence, ensure_ascii=False),
                                 json.dumps(diffs, ensure_ascii=False),
                                 suggestion, _now(), "open"),
                            )
                            conflict_details.append({
                                "period": entry.period,
                                "category": entry.category,
                                "fields": [d["field"] for d in diffs],
                                "对账表证据": local_evidence,
                                "导入数据证据": incoming_evidence,
                                "suggestion": suggestion,
                            })

            conn.execute(
                "INSERT INTO import_log (import_type, import_time, record_count, skipped_count, updated_count, conflict_count, details) "
                "VALUES (?,?,?,?,?,?,?)",
                ("reconciliation", _now(), len(entries), skipped, updated, conflicts,
                 json.dumps(conflict_details, ensure_ascii=False)),
            )

        return {
            "total": len(entries),
            "imported": imported,
            "skipped": skipped,
            "updated": updated,
            "conflicts": conflicts,
            "conflict_details": conflict_details,
            "strategy_used": strategy,
            "说明": f"对账数据导入：新增{imported}条，跳过{skipped}条，更新{updated}条，冲突{conflicts}条（不会自动替您拍板）",
        }

    @staticmethod
    def check_consistency(period: Optional[str] = None) -> dict:
        sql = """
            SELECT r.period, r.category, r.expected_amount as 对账表预期金额,
                   r.actual_amount as 对账表实际金额,
                   COALESCE(b.total_amount, 0) as 批次清算总额,
                   COALESCE(b.total_count, 0) as 批次清算笔数
            FROM reconciliation_table r
            LEFT JOIN (
                SELECT period_start || '~' || period_end as period, SUM(total_amount) as total_amount, SUM(total_count) as total_count
                FROM batches WHERE status IN ('confirmed', 'exported')
                GROUP BY period_start || '~' || period_end
            ) b ON r.period = b.period
            WHERE r.category = '校园一卡通退款清算'
        """
        params = []
        if period:
            sql += " AND r.period = ?"
            params.append(period)

        rows = query_db(sql, tuple(params))
        results = _rows_to_dicts(rows)

        inconsistencies = []
        for r in results:
            expected = r.get("对账表预期金额", 0) or 0
            batch_total = r.get("批次清算总额", 0) or 0
            if abs(expected - batch_total) > 0.01:
                inconsistencies.append({
                    "period": r["period"],
                    "对账表预期金额": expected,
                    "批次清算总额": batch_total,
                    "差异": round(expected - batch_total, 2),
                    "建议": (
                        f"月底对账表预期金额({expected})与已确认批次清算总额({batch_total})不一致，"
                        f"差异{round(expected - batch_total, 2)}元。"
                        f"请核实：是否有未入批次的退款？是否有对账表数据需要更新？"
                        f"不要凭猜测修改任何一方，先核对原始凭证。"
                    ),
                })

        return {
            "检查结果": "一致" if not inconsistencies else f"发现{len(inconsistencies)}处不一致",
            "不一致明细": inconsistencies,
            "提示": "对账表与清算批次的金额应一致，如不一致请先核对原始凭证再决定修改哪一方",
        }

    @staticmethod
    def list_reconciliation(period: Optional[str] = None) -> list[dict]:
        sql = "SELECT * FROM reconciliation_table WHERE 1=1"
        params = []
        if period:
            sql += " AND period = ?"
            params.append(period)
        sql += " ORDER BY period DESC"
        rows = query_db(sql, tuple(params))
        return _rows_to_dicts(rows)


class ConflictService:
    @staticmethod
    def list_conflicts(status: Optional[str] = None) -> list[dict]:
        sql = "SELECT * FROM conflicts WHERE 1=1"
        params = []
        if status:
            sql += " AND status = ?"
            params.append(status)
        sql += " ORDER BY created_at DESC"
        rows = query_db(sql, tuple(params))
        results = []
        for r in rows:
            d = dict(r)
            d["local_data"] = json.loads(d["local_data"]) if isinstance(d["local_data"], str) else d["local_data"]
            d["incoming_data"] = json.loads(d["incoming_data"]) if isinstance(d["incoming_data"], str) else d["incoming_data"]
            d["field_differences"] = json.loads(d["field_differences"]) if isinstance(d["field_differences"], str) else d["field_differences"]
            results.append(d)
        return results

    @staticmethod
    def resolve_conflict(resolution: ConflictResolution) -> dict:
        conflict = query_db("SELECT * FROM conflicts WHERE id = ?", (resolution.conflict_id,), one=True)
        if not conflict:
            return {"error": f"冲突记录 {resolution.conflict_id} 不存在"}
        if conflict["status"] == "resolved":
            return {"error": "该冲突已解决，请勿重复操作"}

        local_data = json.loads(conflict["local_data"]) if isinstance(conflict["local_data"], str) else conflict["local_data"]
        incoming_data = json.loads(conflict["incoming_data"]) if isinstance(conflict["incoming_data"], str) else conflict["incoming_data"]

        if resolution.resolution not in ("keep_local", "use_incoming", "manual_edit"):
            return {"error": "解决方案仅支持：keep_local（保留本地）、use_incoming（使用导入数据）、manual_edit（人工编辑后保留）"}

        with get_db() as conn:
            if resolution.resolution == "use_incoming" and conflict["conflict_type"] == "payment_duplicate":
                conn.execute(
                    "UPDATE payment_records SET card_no=?, student_name=?, amount=?, payment_time=?, "
                    "description=?, source=?, imported_at=? WHERE id=?",
                    (incoming_data.get("card_no", ""), incoming_data.get("student_name", ""),
                     incoming_data.get("amount", 0), incoming_data.get("payment_time", ""),
                     incoming_data.get("description", ""), incoming_data.get("source", "manual"),
                     _now(), conflict["local_id"]),
                )
            elif resolution.resolution == "use_incoming" and conflict["conflict_type"] == "refund_duplicate":
                conn.execute(
                    "UPDATE refund_applications SET transaction_id=?, card_no=?, student_name=?, "
                    "refund_amount=?, reason=?, applicant=?, apply_time=?, status=?, imported_at=? WHERE id=?",
                    (incoming_data.get("transaction_id", ""), incoming_data.get("card_no", ""),
                     incoming_data.get("student_name", ""), incoming_data.get("refund_amount", 0),
                     incoming_data.get("reason", ""), incoming_data.get("applicant", ""),
                     incoming_data.get("apply_time", ""), incoming_data.get("status", "pending"),
                     _now(), conflict["local_id"]),
                )
            elif resolution.resolution == "use_incoming" and conflict["conflict_type"] == "reconciliation_conflict":
                conn.execute(
                    "UPDATE reconciliation_table SET expected_amount=?, actual_amount=?, "
                    "difference=?, description=?, imported_at=? WHERE id=?",
                    (incoming_data.get("expected_amount", 0), incoming_data.get("actual_amount", 0),
                     incoming_data.get("difference", 0), incoming_data.get("description", ""),
                     _now(), conflict["local_id"]),
                )

            conn.execute(
                "UPDATE conflicts SET status='resolved', resolution=?, resolved_by=?, resolved_at=? WHERE id=?",
                (resolution.resolution, resolution.resolved_by, _now(), resolution.conflict_id),
            )

        resolution_labels = {
            "keep_local": "保留本地数据（以现有记录为准）",
            "use_incoming": "使用导入数据（已覆盖本地）",
            "manual_edit": "人工编辑后保留（请在原表手动修正）",
        }
        return {
            "conflict_id": resolution.conflict_id,
            "resolution": resolution.resolution,
            "resolution_label": resolution_labels[resolution.resolution],
            "resolved_by": resolution.resolved_by,
            "提示": f"冲突已解决：{resolution_labels[resolution.resolution]}，由 {resolution.resolved_by} 操作",
        }


class ExportService:
    @staticmethod
    def export_report(req: ExportRequest) -> dict:
        batch = None
        if req.batch_no:
            batch = query_db("SELECT * FROM batches WHERE batch_no = ?", (req.batch_no,), one=True)
            if not batch:
                return {"error": f"批次 {req.batch_no} 不存在"}

        if batch:
            items = query_db(
                "SELECT bi.application_no, ra.card_no, ra.student_name, ra.refund_amount, "
                "ra.status, ra.rework_count, ra.rework_reason, ra.reason, ra.apply_time "
                "FROM batch_items bi JOIN refund_applications ra ON bi.application_no = ra.application_no "
                "WHERE bi.batch_id = ?",
                (batch["id"],),
            )
            item_list = _rows_to_dicts(items)
            app_nos = [i["application_no"] for i in item_list]
        else:
            sql = "SELECT application_no, card_no, student_name, refund_amount, status, rework_count, rework_reason, reason, apply_time FROM refund_applications WHERE 1=1"
            params = []
            if req.period_start:
                sql += " AND apply_time >= ?"
                params.append(req.period_start)
            if req.period_end:
                sql += " AND apply_time <= ?"
                params.append(req.period_end)
            items = query_db(sql, tuple(params))
            item_list = _rows_to_dicts(items)
            app_nos = [i["application_no"] for i in item_list]

        notes_list = []
        approvals_list = []
        if req.include_notes and app_nos:
            placeholders = ",".join("?" * len(app_nos))
            notes_list = _rows_to_dicts(
                query_db(f"SELECT * FROM manual_notes WHERE application_no IN ({placeholders})", tuple(app_nos))
            )
        if req.include_approvals and app_nos:
            placeholders = ",".join("?" * len(app_nos))
            approvals_list = _rows_to_dicts(
                query_db(f"SELECT * FROM approval_records WHERE application_no IN ({placeholders})", tuple(app_nos))
            )

        total_refund = sum(i.get("refund_amount", 0) or 0 for i in item_list)
        completed_count = sum(1 for i in item_list if i.get("status") == "completed")
        rework_count = sum(i.get("rework_count", 0) or 0 for i in item_list)

        report = {
            "导出时间": _now(),
            "批次号": req.batch_no or "（按时间段筛选）",
            "期间": f"{batch['period_start']}~{batch['period_end']}" if batch else f"{req.period_start or '不限'}~{req.period_end or '不限'}",
            "退款明细": item_list,
            "审批记录": approvals_list,
            "人工备注": notes_list,
            "汇总": {
                "退款总笔数": len(item_list),
                "退款总金额": round(total_refund, 2),
                "已完成笔数": completed_count,
                "返工总次数": rework_count,
                "待处理笔数": len(item_list) - completed_count,
            },
            "一致性声明": "本报告所有数据来源于同一份本地数据库，与批次确认和人工备注完全一致，可供交接使用",
        }

        if batch and batch["status"] == "confirmed":
            execute_db("UPDATE batches SET status='exported' WHERE batch_no=?", (req.batch_no,))

        return report
