import json
from datetime import datetime
from typing import Optional
from models import get_conn


VALID_TRANSITIONS = {
    "待处理": ["处理中", "已放行", "需补货"],
    "处理中": ["已放行", "需补货", "退回"],
    "待分派": ["处理中", "已分配"],
    "已分配": ["处理中"],
    "退回": ["处理中"],
}


def _log_action(cursor, record_id, action, old, new, operator, remark=None):
    cursor.execute("""
        INSERT INTO handle_log (warning_record_id, action, old_value, new_value, operator, operated_at, remark)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        record_id, action,
        json.dumps(old, ensure_ascii=False) if old is not None else None,
        json.dumps(new, ensure_ascii=False) if new is not None else None,
        operator, datetime.now().isoformat(), remark
    ))


def handle_warning_record(record_id: int, new_status: str,
                          handle_remark: Optional[str] = None,
                          conclusion: Optional[str] = None,
                          operator: str = "维保主管") -> dict:
    conn = get_conn()
    c = conn.cursor()
    try:
        row = c.execute("SELECT * FROM warning_record WHERE id=?", (record_id,)).fetchone()
        if not row:
            return {"success": False, "error": f"预警记录#{record_id}不存在"}

        old_status = row["status"]
        if new_status != old_status and new_status not in VALID_TRANSITIONS.get(old_status, [new_status]):
            return {"success": False, "error": f"非法状态流转: {old_status} -> {new_status}"}

        updates = ["status=?", "handled_at=?", "handled_by=?"]
        params = [new_status, datetime.now().isoformat(), operator]

        if handle_remark is not None:
            updates.append("handle_remark=?")
            params.append(handle_remark)
        if conclusion is not None:
            updates.append("conclusion=?")
            params.append(conclusion)

        params.append(record_id)
        c.execute(f"UPDATE warning_record SET {', '.join(updates)} WHERE id=?", params)

        old_val = {"status": old_status, "handle_remark": row["handle_remark"], "conclusion": row["conclusion"]}
        new_val = {"status": new_status, "handle_remark": handle_remark or row["handle_remark"], "conclusion": conclusion or row["conclusion"]}
        _log_action(c, record_id, "状态更新/结论填写", old_val, new_val, operator, handle_remark)

        queue_map = {"待处理": "待分派", "处理中": "处理中", "已放行": "已结案", "需补货": "已结案-补货", "退回": "退回"}
        queue_status = queue_map.get(new_status, new_status)
        file_conclusion = conclusion or ("放行" if new_status == "已放行" else ("补货" if new_status == "需补货" else ""))

        q = c.execute("SELECT * FROM anomaly_queue WHERE warning_record_id=?", (record_id,)).fetchone()
        if q:
            old_q = {"queue_status": q["queue_status"], "file_conclusion": q["file_conclusion"]}
            c.execute("""
                UPDATE anomaly_queue
                SET queue_status=?, file_conclusion=?, updated_at=?
                WHERE warning_record_id=?
            """, (queue_status, file_conclusion, datetime.now().isoformat(), record_id))
            new_q = {"queue_status": queue_status, "file_conclusion": file_conclusion}
            _log_action(c, record_id, "异常队列联动更新", old_q, new_q, operator)

        conn.commit()
        return {"success": True, "record_id": record_id, "new_status": new_status,
                "queue_status": queue_status, "file_conclusion": file_conclusion}
    except Exception as e:
        conn.rollback()
        return {"success": False, "error": str(e)}
    finally:
        conn.close()


def update_manual_remark(spare_part_id: int, manual_remark: str, operator: str = "人工") -> dict:
    conn = get_conn()
    c = conn.cursor()
    try:
        row = c.execute("SELECT manual_remark FROM spare_parts WHERE id=?", (spare_part_id,)).fetchone()
        if not row:
            return {"success": False, "error": f"备件#{spare_part_id}不存在"}
        c.execute("UPDATE spare_parts SET manual_remark=? WHERE id=?", (manual_remark, spare_part_id))
        conn.commit()
        return {"success": True, "spare_part_id": spare_part_id,
                "old": row["manual_remark"], "new": manual_remark}
    finally:
        conn.close()
