import json
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from db import get_conn, log_audit


STATUS_FLOW = [
    "IMPORTED",
    "PHOTO_REVIEWED",
    "PENDING_INSPECTOR",
    "SUMMARY_GENERATED",
    "INSPECTOR_APPROVED",
    "ARCHIVED"
]

ALIAS_RULES = """
【同一小区新旧名字边界规则】
1. 导入时自动匹配 community_aliases 表，命中则标记 has_alias_conflict=1，状态不推进到 PHOTO_REVIEWED
2. 有冲突的记录，老马补看照片后状态变为 PENDING_INSPECTOR，不归入正常，留待市政巡检员复核
3. 巡检员确认后可选择：(a)保留旧名→更新 normalized 并解除标记；(b)改用新名→更新 name 并解除标记
4. 所有改名操作记录在 audit_log，可通过 rollback_record_field 回滚
5. 别名映射表新增/停用都会触发当日摘要标记"受影响记录"
"""


def normalize_community_name(name: str) -> str:
    return name.strip().replace(" ", "").replace("　", "")


def check_alias_conflict(community_name: str) -> Tuple[bool, Optional[str]]:
    normalized = normalize_community_name(community_name)
    conn = get_conn()
    c = conn.cursor()
    row = c.execute("""
        SELECT new_name FROM community_aliases
        WHERE is_active = 1 AND (old_name = ? OR new_name = ?)
    """, (community_name, community_name)).fetchone()
    conn.close()
    if row:
        return True, row["new_name"]
    return False, None


def import_complaints(records: List[Dict[str, Any]], operator: str,
                      batch_id: Optional[str] = None) -> str:
    if batch_id is None:
        batch_id = "BATCH-" + datetime.now().strftime("%Y%m%d") + "-" + str(uuid.uuid4())[:8]
    conn = get_conn()
    c = conn.cursor()
    for idx, rec in enumerate(records, start=1):
        name = rec.get("community_name", "").strip()
        has_conflict, suggested = check_alias_conflict(name)
        c.execute("""
            INSERT OR IGNORE INTO complaint_records
            (original_line_no, import_batch_id, complaint_no, community_name,
             community_name_normalized, address, complaint_content,
             status, has_alias_conflict)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            rec.get("line_no", idx),
            batch_id,
            rec["complaint_no"],
            name,
            normalize_community_name(name),
            rec.get("address", ""),
            rec.get("complaint_content", ""),
            "IMPORTED",
            1 if has_conflict else 0
        ))
    conn.commit()
    conn.close()
    return batch_id


def get_record_by_complaint_no(complaint_no: str, batch_id: str) -> Optional[Dict[str, Any]]:
    conn = get_conn()
    c = conn.cursor()
    row = c.execute("""
        SELECT * FROM complaint_records
        WHERE complaint_no = ? AND import_batch_id = ?
    """, (complaint_no, batch_id)).fetchone()
    conn.close()
    return dict(row) if row else None


def lao_ma_review_photo(complaint_no: str, batch_id: str, photo_remark: str,
                        operator: str = "traffic_laoma") -> bool:
    rec = get_record_by_complaint_no(complaint_no, batch_id)
    if not rec:
        return False
    conn = get_conn()
    c = conn.cursor()
    old_status = rec["status"]
    old_remark = rec["photo_remark"]
    if rec["has_alias_conflict"]:
        new_status = "PENDING_INSPECTOR"
        reason = "存在小区新旧名冲突，转市政巡检员复核"
    else:
        new_status = "PHOTO_REVIEWED"
        reason = "路口照片审核完成"
    c.execute("""
        UPDATE complaint_records
        SET photo_remark = ?, photo_uploaded_by = ?, photo_uploaded_at = datetime('now'),
            status = ?
        WHERE id = ?
    """, (photo_remark, operator, new_status, rec["id"]))
    conn.commit()
    conn.close()
    log_audit(rec["id"], "photo_remark", old_remark, photo_remark, operator, "老马补看路口照片")
    log_audit(rec["id"], "status", old_status, new_status, operator, reason)
    return True


def inspector_resolve_alias(complaint_no: str, batch_id: str,
                            use_new_name: bool, operator: str = "muni_inspector") -> bool:
    rec = get_record_by_complaint_no(complaint_no, batch_id)
    if not rec or rec["has_alias_conflict"] == 0:
        return False
    conn = get_conn()
    c = conn.cursor()
    old_name = rec["community_name"]
    _, new_name = check_alias_conflict(old_name)
    final_name = new_name if use_new_name else old_name
    c.execute("""
        UPDATE complaint_records
        SET community_name = ?, community_name_normalized = ?,
            has_alias_conflict = 0, status = 'PHOTO_REVIEWED'
        WHERE id = ?
    """, (final_name, normalize_community_name(final_name), rec["id"]))
    conn.commit()
    conn.close()
    log_audit(rec["id"], "community_name", old_name, final_name, operator,
              "巡检员复核小区新旧名冲突，采用{}".format("新名" if use_new_name else "旧名"))
    log_audit(rec["id"], "has_alias_conflict", "1", "0", operator, "冲突已解决")
    log_audit(rec["id"], "status", rec["status"], "PHOTO_REVIEWED", operator, "巡检员复核通过")
    return True


def rollback_record_field(record_id: int, field_name: str, operator: str) -> bool:
    conn = get_conn()
    c = conn.cursor()
    rows = c.execute("""
        SELECT old_value FROM audit_log
        WHERE record_id = ? AND field_name = ?
        ORDER BY id DESC LIMIT 1
    """, (record_id, field_name)).fetchall()
    if not rows:
        conn.close()
        return False
    old_value = rows[0]["old_value"]
    current = c.execute("""
        SELECT {} as curr FROM complaint_records WHERE id = ?
    """.format(field_name), (record_id,)).fetchone()
    c.execute("""
        UPDATE complaint_records SET {} = ? WHERE id = ?
    """.format(field_name), (old_value, record_id))
    conn.commit()
    conn.close()
    log_audit(record_id, field_name, current["curr"], old_value, operator, "回滚操作")
    return True


def get_single_source(batch_id: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = get_conn()
    c = conn.cursor()
    if batch_id:
        rows = c.execute("""
            SELECT * FROM complaint_records WHERE import_batch_id = ?
            ORDER BY original_line_no
        """, (batch_id,)).fetchall()
    else:
        rows = c.execute("""
            SELECT * FROM complaint_records ORDER BY import_time DESC, original_line_no
        """).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def generate_daily_summary(operator: str = "summary_bot") -> Dict[str, Any]:
    today = datetime.now().strftime("%Y-%m-%d")
    records = get_single_source()
    pending = [r for r in records if r["status"] == "PENDING_INSPECTOR"]
    photo_updated = [r for r in records if r["photo_uploaded_at"]
                     and r["photo_uploaded_at"].startswith(today)]
    only_remark_changed = []
    for r in photo_updated:
        audits = get_audit_log(r["id"])
        today_audits = [a for a in audits if a["changed_at"].startswith(today)]
        fields = set(a["field_name"] for a in today_audits)
        if fields == {"photo_remark", "status"} or fields == {"photo_remark"}:
            only_remark_changed.append(r)
    summary = {
        "report_date": today,
        "total_records": len(records),
        "pending_inspector": len(pending),
        "pending_list": [r["complaint_no"] for r in pending],
        "photo_updated_today": len(photo_updated),
        "remark_only_affected": len(only_remark_changed),
        "remark_only_list": [
            {"complaint_no": r["complaint_no"], "community_name": r["community_name"],
             "remark": r["photo_remark"]}
            for r in only_remark_changed
        ],
        "summary_note": "今日需巡检员复核{}条；仅修改照片备注的有{}条，已标记请当日复核".format(
            len(pending), len(only_remark_changed)
        )
    }
    conn = get_conn()
    c = conn.cursor()
    c.execute("""
        INSERT INTO summary_reports
        (report_date, generated_by, content_json, affected_record_ids, remark)
        VALUES (?, ?, ?, ?, ?)
    """, (
        today, operator, json.dumps(summary, ensure_ascii=False),
        ",".join(str(r["id"]) for r in pending + only_remark_changed),
        summary["summary_note"]
    ))
    conn.commit()
    conn.close()
    return summary


def get_audit_log(record_id: int) -> List[Dict[str, Any]]:
    conn = get_conn()
    c = conn.cursor()
    rows = c.execute("""
        SELECT * FROM audit_log WHERE record_id = ? ORDER BY id ASC
    """, (record_id,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def add_community_alias(old_name: str, new_name: str, operator: str) -> int:
    conn = get_conn()
    c = conn.cursor()
    c.execute("""
        INSERT OR IGNORE INTO community_aliases (old_name, new_name) VALUES (?, ?)
    """, (old_name, new_name))
    c.execute("""
        UPDATE community_aliases SET is_active = 1 WHERE old_name = ? AND new_name = ?
    """, (old_name, new_name))
    row = c.execute("""
        SELECT id FROM community_aliases WHERE old_name = ? AND new_name = ?
    """, (old_name, new_name)).fetchone()
    conn.commit()
    conn.close()
    return row["id"] if row else -1


def get_alias_list() -> List[Dict[str, Any]]:
    conn = get_conn()
    c = conn.cursor()
    rows = c.execute("SELECT * FROM community_aliases ORDER BY id").fetchall()
    conn.close()
    return [dict(r) for r in rows]
