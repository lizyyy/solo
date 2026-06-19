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

DEFAULT_COMMUNITY_ALIASES = [
    ("阳光花园", "阳光花园小区"),
    ("丽景苑", "丽景苑小区"),
    ("翠湖苑", "翠湖苑小区"),
    ("金色家园", "金色家园小区"),
    ("春风里", "春风里社区"),
]

ALIAS_RULES = """
【同一小区新旧名字边界规则】
1. 首次导入前系统自动注入常见小区别名映射（阳光花园↔阳光花园小区等5对），可关闭
2. 导入时自动匹配 community_aliases 表，命中则标记 has_alias_conflict=1，状态不推进到 PHOTO_REVIEWED
3. 有冲突的记录，老马补看照片后状态变为 PENDING_INSPECTOR，不归入正常，留待市政巡检员复核
4. 巡检员确认后可选择：(a)保留旧名→更新 normalized 并解除标记；(b)改用新名→更新 name 并解除标记
5. 巡检员复核作为一次"操作原子"，同时修改 community_name/community_name_normalized/has_alias_conflict/status；回滚必须四者一起回
6. 所有改名、备注、状态变更都记录在 audit_log，可按记录ID或操作原子整体回滚
7. 导出明细包含：原始导入值 + 最终值 + 历次修改历史 + 审计轨迹 + 冲突分组索引，可从摘要回溯到原始材料
8. 别名映射表新增/停用都会触发当日摘要标记"受影响记录"
9. "仅修改照片备注"指已审核记录上的二次备注修改，首次照片审核（IMPORTED→PENDING/REVIEWED）不算
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


def seed_default_aliases(operator: str = "system") -> int:
    conn = get_conn()
    c = conn.cursor()
    count = c.execute("SELECT COUNT(*) as n FROM community_aliases").fetchone()["n"]
    conn.close()
    injected = 0
    if count == 0:
        for old, new in DEFAULT_COMMUNITY_ALIASES:
            aid = add_community_alias(old, new, operator)
            if aid > 0:
                injected += 1
    return injected


def import_complaints(records: List[Dict[str, Any]], operator: str,
                      batch_id: Optional[str] = None,
                      seed_aliases: bool = True) -> Tuple[str, Dict[str, Any]]:
    info = {"seed_aliases_injected": 0, "conflicts_marked": 0}
    if seed_aliases:
        info["seed_aliases_injected"] = seed_default_aliases(operator)
    if batch_id is None:
        batch_id = "BATCH-" + datetime.now().strftime("%Y%m%d") + "-" + str(uuid.uuid4())[:8]
    now_ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    conn = get_conn()
    c = conn.cursor()
    for idx, rec in enumerate(records, start=1):
        name = rec.get("community_name", "").strip()
        has_conflict, suggested = check_alias_conflict(name)
        if has_conflict:
            info["conflicts_marked"] += 1
        c.execute("""
            INSERT OR IGNORE INTO complaint_records
            (original_line_no, import_batch_id, complaint_no, community_name,
             community_name_normalized, address, complaint_content,
             import_time, status, has_alias_conflict)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            rec.get("line_no", idx),
            batch_id,
            rec["complaint_no"],
            name,
            normalize_community_name(name),
            rec.get("address", ""),
            rec.get("complaint_content", ""),
            now_ts,
            "IMPORTED",
            1 if has_conflict else 0
        ))
    conn.commit()
    conn.close()
    info["total"] = len(records)
    info["batch_id"] = batch_id
    return batch_id, info


def get_record_by_complaint_no(complaint_no: str, batch_id: str) -> Optional[Dict[str, Any]]:
    conn = get_conn()
    c = conn.cursor()
    row = c.execute("""
        SELECT * FROM complaint_records
        WHERE complaint_no = ? AND import_batch_id = ?
    """, (complaint_no, batch_id)).fetchone()
    conn.close()
    return dict(row) if row else None


def get_record_by_id(record_id: int) -> Optional[Dict[str, Any]]:
    conn = get_conn()
    c = conn.cursor()
    row = c.execute("SELECT * FROM complaint_records WHERE id = ?", (record_id,)).fetchone()
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
    is_first_review = (old_status == "IMPORTED")
    now_ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    if is_first_review:
        if rec["has_alias_conflict"]:
            new_status = "PENDING_INSPECTOR"
            reason = "存在小区新旧名冲突，转市政巡检员复核"
        else:
            new_status = "PHOTO_REVIEWED"
            reason = "路口照片审核完成"
        c.execute("""
            UPDATE complaint_records
            SET photo_remark = ?, photo_uploaded_by = ?, photo_uploaded_at = ?,
                status = ?
            WHERE id = ?
        """, (photo_remark, operator, now_ts, new_status, rec["id"]))
    else:
        c.execute("""
            UPDATE complaint_records
            SET photo_remark = ?, photo_uploaded_by = ?, photo_uploaded_at = ?
            WHERE id = ?
        """, (photo_remark, operator, now_ts, rec["id"]))
    conn.commit()
    conn.close()
    log_audit(rec["id"], "photo_remark", old_remark, photo_remark, operator,
              "老马补看路口照片" if is_first_review else "老马修改照片备注", now_ts)
    if is_first_review:
        log_audit(rec["id"], "status", old_status, new_status, operator, reason, now_ts)
    return True


def inspector_resolve_alias(complaint_no: str, batch_id: str,
                            use_new_name: bool, operator: str = "muni_inspector") -> bool:
    rec = get_record_by_complaint_no(complaint_no, batch_id)
    if not rec or rec["has_alias_conflict"] == 0:
        return False
    conn = get_conn()
    c = conn.cursor()
    old_name = rec["community_name"]
    old_normalized = rec["community_name_normalized"]
    old_conflict = rec["has_alias_conflict"]
    old_status = rec["status"]
    _, new_name = check_alias_conflict(old_name)
    final_name = new_name if use_new_name else old_name
    final_normalized = normalize_community_name(final_name)
    c.execute("""
        UPDATE complaint_records
        SET community_name = ?, community_name_normalized = ?,
            has_alias_conflict = 0, status = 'PHOTO_REVIEWED'
        WHERE id = ?
    """, (final_name, final_normalized, rec["id"]))
    conn.commit()
    conn.close()
    op_ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    log_audit(rec["id"], "community_name", old_name, final_name, operator,
              "巡检员复核小区新旧名冲突，采用{}".format("新名" if use_new_name else "旧名"), op_ts)
    log_audit(rec["id"], "community_name_normalized", old_normalized, final_normalized, operator,
              "巡检员复核同步更新标准化名", op_ts)
    log_audit(rec["id"], "has_alias_conflict", str(old_conflict), "0", operator,
              "冲突已解决", op_ts)
    log_audit(rec["id"], "status", old_status, "PHOTO_REVIEWED", operator,
              "巡检员复核通过", op_ts)
    return True


def _group_operations(audits: List[Dict[str, Any]]) -> List[List[Dict[str, Any]]]:
    groups = []
    cur_key = None
    cur_group = []
    for a in audits:
        key = (a["changed_at"], a["changed_by"])
        if key != cur_key:
            if cur_group:
                groups.append(cur_group)
            cur_group = [a]
            cur_key = key
        else:
            cur_group.append(a)
    if cur_group:
        groups.append(cur_group)
    return groups


def rollback_record_field(record_id: int, field_name: str, operator: str) -> bool:
    conn = get_conn()
    c = conn.cursor()
    rows = c.execute("""
        SELECT old_value, new_value FROM audit_log
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


def rollback_last_operation(record_id: int, operator: str) -> Dict[str, Any]:
    audits = get_audit_log(record_id)
    groups = _group_operations(audits)
    if not groups:
        return {"success": False, "reason": "无审计记录"}
    non_rollback = []
    for g in reversed(groups):
        reasons = set(a["change_reason"] or "" for a in g)
        if not any("回滚" in r for r in reasons):
            non_rollback = g
            break
    if not non_rollback:
        return {"success": False, "reason": "无可回滚的操作"}
    conn = get_conn()
    c = conn.cursor()
    fields = []
    changes = []
    for a in reversed(non_rollback):
        fname = a["field_name"]
        target = a["old_value"]
        cur = c.execute("SELECT {} as curr FROM complaint_records WHERE id = ?".format(fname),
                        (record_id,)).fetchone()
        c.execute("UPDATE complaint_records SET {} = ? WHERE id = ?".format(fname),
                  (target, record_id))
        fields.append(fname)
        changes.append((fname, str(cur["curr"]), str(target),
                        a["change_reason"] or a["field_name"]))
    conn.commit()
    conn.close()
    op_ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    for fname, cur_val, target_val, orig_reason in changes:
        log_audit(record_id, fname, cur_val, target_val, operator,
                  "按操作原子回滚（撤销：{}）".format(orig_reason), op_ts)
    return {"success": True, "fields_rolled_back": fields,
            "original_reason": non_rollback[0]["change_reason"]}


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


def get_records_original_import(batch_id: str) -> List[Dict[str, Any]]:
    return get_single_source(batch_id)


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
        has_secondary_remark = any(
            a["field_name"] == "photo_remark"
            and a["change_reason"] == "老马修改照片备注"
            for a in today_audits
        )
        if has_secondary_remark:
            only_remark_changed.append(r)
    conflict_groups: Dict[str, List[Dict[str, Any]]] = {}
    for r in records:
        if r["has_alias_conflict"] or r["status"] == "PENDING_INSPECTOR":
            _, suggested = check_alias_conflict(r["community_name"])
            key = "{}↔{}".format(r["community_name"], suggested or "(未知对端)")
            if key not in conflict_groups:
                conflict_groups[key] = []
            conflict_groups[key].append({
                "complaint_no": r["complaint_no"],
                "original_line_no": r["original_line_no"],
                "import_batch_id": r["import_batch_id"],
                "community_name_raw": r["community_name"],
                "status": r["status"],
                "audit_trail_count": len(get_audit_log(r["id"])),
            })
    pending_trace = []
    for r in pending:
        pending_trace.append({
            "complaint_no": r["complaint_no"],
            "community_name": r["community_name"],
            "original_line_no": r["original_line_no"],
            "import_batch_id": r["import_batch_id"],
            "photo_remark": r["photo_remark"],
            "lao_ma_time": r["photo_uploaded_at"],
            "record_id": r["id"],
        })
    summary = {
        "report_date": today,
        "total_records": len(records),
        "pending_inspector": len(pending),
        "pending_list": [r["complaint_no"] for r in pending],
        "pending_trace": pending_trace,
        "conflict_groups": conflict_groups,
        "photo_updated_today": len(photo_updated),
        "remark_only_affected": len(only_remark_changed),
        "remark_only_list": [
            {"complaint_no": r["complaint_no"], "community_name": r["community_name"],
             "remark": r["photo_remark"], "original_line_no": r["original_line_no"],
             "import_batch_id": r["import_batch_id"], "record_id": r["id"]}
            for r in only_remark_changed
        ],
        "summary_note": "今日需巡检员复核{}条（见pending_trace含原始行号）；仅修改照片备注的有{}条，已标记请当日复核；冲突分组见conflict_groups".format(
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


def get_all_audit_logs() -> List[Dict[str, Any]]:
    conn = get_conn()
    c = conn.cursor()
    rows = c.execute("""
        SELECT al.*, cr.complaint_no, cr.original_line_no, cr.import_batch_id
        FROM audit_log al LEFT JOIN complaint_records cr ON al.record_id = cr.id
        ORDER BY al.id ASC
    """).fetchall()
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


def build_export_package(batch_id: Optional[str] = None) -> Dict[str, Any]:
    records = get_single_source(batch_id)
    detailed_rows = []
    for r in records:
        audits = get_audit_log(r["id"])
        remark_history = []
        name_history = []
        normalized_history = []
        status_history = []
        for a in audits:
            item = {
                "at": a["changed_at"], "by": a["changed_by"],
                "from": a["old_value"] or "", "to": a["new_value"] or "",
                "reason": a["change_reason"] or "",
            }
            if a["field_name"] == "photo_remark":
                remark_history.append(item)
            elif a["field_name"] == "community_name":
                name_history.append(item)
            elif a["field_name"] == "community_name_normalized":
                normalized_history.append(item)
            elif a["field_name"] == "status":
                status_history.append(item)
        _, suggested = check_alias_conflict(r["community_name"])
        detailed_rows.append({
            "record_id": r["id"],
            "original_line_no": r["original_line_no"],
            "import_batch_id": r["import_batch_id"],
            "complaint_no": r["complaint_no"],
            "community_name_raw_imported": r["community_name"],
            "community_name_final": r["community_name"],
            "community_name_normalized_final": r["community_name_normalized"] or "",
            "community_name_suggested_pair": suggested or "",
            "address": r["address"],
            "complaint_content": r["complaint_content"],
            "status_final": r["status"],
            "has_alias_conflict_final": "是" if r["has_alias_conflict"] else "否",
            "photo_remark_final": r["photo_remark"] or "",
            "photo_uploaded_by": r["photo_uploaded_by"] or "",
            "photo_uploaded_at": r["photo_uploaded_at"] or "",
            "summary_note": r["summary_note"] or "",
            "community_name_history": json.dumps(name_history, ensure_ascii=False),
            "normalized_name_history": json.dumps(normalized_history, ensure_ascii=False),
            "photo_remark_history": json.dumps(remark_history, ensure_ascii=False),
            "status_history": json.dumps(status_history, ensure_ascii=False),
            "audit_trail_count": len(audits),
            "can_rollback": "是" if any("巡检员" in (a["change_reason"] or "") for a in audits) else "",
        })
    all_audits = get_all_audit_logs()
    audit_rows = []
    for a in all_audits:
        audit_rows.append({
            "audit_id": a["id"],
            "changed_at": a["changed_at"],
            "changed_by": a["changed_by"],
            "record_id": a["record_id"],
            "complaint_no": a.get("complaint_no") or "",
            "original_line_no": a.get("original_line_no") or "",
            "import_batch_id": a.get("import_batch_id") or "",
            "field_name": a["field_name"],
            "old_value": a["old_value"] or "",
            "new_value": a["new_value"] or "",
            "change_reason": a["change_reason"] or "",
        })
    conflict_idx_rows = []
    conflict_groups: Dict[str, List[Dict[str, Any]]] = {}
    for r in records:
        if r["has_alias_conflict"] or r["status"] in ("PENDING_INSPECTOR",):
            _, suggested = check_alias_conflict(r["community_name"])
            key = "{}↔{}".format(r["community_name"], suggested or "(未知对端)")
            if key not in conflict_groups:
                conflict_groups[key] = []
            conflict_groups[key].append({
                "complaint_no": r["complaint_no"],
                "original_line_no": r["original_line_no"],
                "import_batch_id": r["import_batch_id"],
                "status": r["status"],
                "record_id": r["id"],
            })
    for key, items in conflict_groups.items():
        for it in items:
            conflict_idx_rows.append({
                "conflict_pair": key,
                "complaint_no": it["complaint_no"],
                "original_line_no": it["original_line_no"],
                "import_batch_id": it["import_batch_id"],
                "status": it["status"],
                "record_id": it["record_id"],
                "trace_hint": "用 cli.py audit {} 查看完整轨迹".format(it["record_id"]),
            })
    pending_idx_rows = []
    for r in records:
        if r["status"] == "PENDING_INSPECTOR":
            pending_idx_rows.append({
                "complaint_no": r["complaint_no"],
                "community_name": r["community_name"],
                "original_line_no": r["original_line_no"],
                "import_batch_id": r["import_batch_id"],
                "photo_remark": r["photo_remark"] or "",
                "photo_uploaded_at": r["photo_uploaded_at"] or "",
                "record_id": r["id"],
                "trace_hint": "cli.py rollback-op {} 整体回滚此记录上一次操作".format(r["id"]),
            })
    return {
        "detailed_rows": detailed_rows,
        "audit_rows": audit_rows,
        "conflict_index": conflict_idx_rows,
        "pending_index": pending_idx_rows,
        "conflict_groups_summary": conflict_groups,
        "meta": {
            "exported_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "batch_id": batch_id or "ALL",
            "record_count": len(records),
            "audit_count": len(audit_rows),
        }
    }
