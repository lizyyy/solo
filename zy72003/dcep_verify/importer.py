import os
import csv
import pandas as pd
from dcep_verify import db

SOURCE_COLUMNS = {
    "收款流水": {
        "required": ["业务编号", "收款人", "金额(元)"],
        "optional": ["收款时间", "补贴类型", "备注"],
        "biz_id": "业务编号",
        "person_name": "收款人",
        "amount": "金额(元)",
        "subsidy_type": "补贴类型",
        "note": "备注",
    },
    "退款申请": {
        "required": ["业务编号", "收款人", "退款金额(元)"],
        "optional": ["申请时间", "原因", "审批状态"],
        "biz_id": "业务编号",
        "person_name": "收款人",
        "amount": "退款金额(元)",
        "subsidy_type": None,
        "note": "原因",
    },
    "审批邮件": {
        "required": ["业务编号", "审批意见"],
        "optional": ["发件人", "时间", "邮件主题"],
        "biz_id": "业务编号",
        "note_content": "审批意见",
        "note_author": "发件人",
    },
    "手写备注": {
        "required": ["业务编号", "备注内容"],
        "optional": ["记录人", "时间"],
        "biz_id": "业务编号",
        "note_content": "备注内容",
        "note_author": "记录人",
    },
    "附件索引": {
        "required": ["附件编号", "业务编号", "文件名", "类型"],
        "optional": ["上传时间"],
        "biz_id": "业务编号",
        "att_id": "附件编号",
        "file_name": "文件名",
        "file_type": "类型",
        "upload_time": "上传时间",
    },
    "合同扫描补录": {
        "required": ["业务编号", "收款人", "金额(元)"],
        "optional": ["补贴类型", "合同编号", "补录说明"],
        "biz_id": "业务编号",
        "person_name": "收款人",
        "amount": "金额(元)",
        "subsidy_type": "补贴类型",
        "note": "补录说明",
    },
}


def detect_source_type(df):
    cols = set(df.columns.tolist())
    best_match = None
    best_score = 0
    for stype, mapping in SOURCE_COLUMNS.items():
        required = set(mapping["required"])
        optional = set(mapping.get("optional", []))
        req_matched = len(required & cols)
        opt_matched = len(optional & cols)
        score = req_matched * 10 + opt_matched
        if score > best_score:
            best_score = score
            best_match = stype
    return best_match


def read_file(file_path):
    ext = os.path.splitext(file_path)[1].lower()
    if ext in (".xlsx", ".xls"):
        df = pd.read_excel(file_path, dtype=str)
    elif ext == ".csv":
        df = pd.read_csv(file_path, dtype=str)
    else:
        raise ValueError(f"不支持的文件格式: {ext}")
    df = df.fillna("")
    return df


def _compare_field(existing_val, incoming_val):
    if existing_val is None and incoming_val == "":
        return True
    if existing_val == "" and incoming_val is None:
        return True
    try:
        return abs(float(str(existing_val)) - float(str(incoming_val))) < 0.005
    except (ValueError, TypeError):
        pass
    return str(existing_val).strip() == str(incoming_val).strip()


def _make_suggestion(field_name, existing_val, incoming_val, existing_source, incoming_source):
    is_amount = field_name in ("amount", "金额(元)")
    is_contract = "合同" in incoming_source or "扫描" in incoming_source or "补录" in incoming_source
    if is_amount and is_contract:
        return (
            f"⚠ 金额冲突：数据库中为 {existing_val} 元（来自{existing_source}），"
            f"合同扫描件显示 {incoming_val} 元。"
            f"→ 建议：请对照合同原件核实，确认以哪个金额为准，再手动更新。"
            f"不要自动覆盖，两边都有可能是对的。"
        )
    if is_amount:
        return (
            f"⚠ 金额冲突：数据库中为 {existing_val} 元（来自{existing_source}），"
            f"新数据为 {incoming_val} 元（来自{incoming_source}）。"
            f"→ 建议：先确认新数据来源是否可靠，再决定是更新还是保留。"
        )
    return (
        f"⚠ 字段「{field_name}」不一致："
        f"数据库为「{existing_val}」（来自{existing_source}），"
        f"新数据为「{incoming_val}」（来自{incoming_source}）。"
        f"→ 建议：核实两边信息，确认后手动处理。"
    )


def import_file(file_path, source_type=None, conn=None):
    close_conn = False
    if conn is None:
        db.init_db()
        conn = db.get_connection()
        close_conn = True

    df = read_file(file_path)
    file_name = os.path.basename(file_path)

    if source_type is None:
        source_type = detect_source_type(df)
    if source_type is None:
        if close_conn:
            conn.close()
        raise ValueError(f"无法自动识别来源类型，请用 --source-type 指定。文件列名: {df.columns.tolist()}")

    mapping = SOURCE_COLUMNS.get(source_type)
    if mapping is None:
        if close_conn:
            conn.close()
        raise ValueError(f"未知的来源类型: {source_type}")

    missing = [c for c in mapping["required"] if c not in df.columns]
    if missing:
        if close_conn:
            conn.close()
        raise ValueError(f"文件 {file_name} 缺少必需列: {missing}")

    total_rows = len(df)
    inserted = 0
    skipped = 0
    conflict_count = 0

    is_note_source = source_type in ("审批邮件", "手写备注")
    is_attachment_source = source_type == "附件索引"

    for idx, row in df.iterrows():
        row_num = idx + 2
        biz_id = str(row[mapping["biz_id"]]).strip()

        if not biz_id:
            continue

        if is_attachment_source:
            att_id = str(row[mapping["att_id"]]).strip()
            file_name_att = str(row[mapping["file_name"]]).strip()
            file_type = str(row[mapping["file_type"]]).strip()
            upload_time = str(row.get(mapping.get("upload_time", ""), "")).strip()
            added = db.insert_attachment(conn, att_id, biz_id, file_name_att, file_type, upload_time)
            if added:
                inserted += 1
            else:
                skipped += 1
            continue

        if is_note_source:
            note_content = str(row[mapping["note_content"]]).strip()
            note_author = str(row.get(mapping.get("note_author", ""), "")).strip()
            if db.record_exists(conn, biz_id):
                db.insert_note(conn, biz_id, note_content, source_type, note_author or None)
                inserted += 1
            else:
                db.insert_note(conn, biz_id, note_content, source_type, note_author or None)
                inserted += 1
            continue

        person_name = str(row[mapping["person_name"]]).strip()
        amount_str = str(row[mapping["amount"]]).strip()
        try:
            amount = float(amount_str)
        except ValueError:
            amount = 0.0

        subsidy_type = ""
        if mapping.get("subsidy_type") and mapping["subsidy_type"] in row:
            subsidy_type = str(row[mapping["subsidy_type"]]).strip()

        note_text = ""
        if mapping.get("note") and mapping["note"] in row:
            note_text = str(row[mapping["note"]]).strip()

        if not db.record_exists(conn, biz_id):
            db.insert_record(conn, biz_id, person_name, amount, subsidy_type, source_type, file_name, row_num)
            if note_text:
                db.insert_note(conn, biz_id, note_text, source_type)
            inserted += 1
        else:
            existing = db.get_record(conn, biz_id)
            has_conflict = False

            field_checks = [
                ("person_name", existing["person_name"], person_name),
                ("amount", str(existing["amount"]), str(amount)),
                ("subsidy_type", existing.get("subsidy_type", ""), subsidy_type),
            ]

            for field_name, existing_val, incoming_val in field_checks:
                if field_name == "subsidy_type" and (not incoming_val or not existing_val):
                    continue
                if _compare_field(existing_val, incoming_val):
                    continue
                resolved = db.get_conflicts(conn, biz_id=biz_id, unresolved_only=False, resolved_only=True)
                already_handled = any(
                    c["field_name"] == field_name and c["resolved"] and (
                        c["incoming_value"] == incoming_val or c["existing_value"] == incoming_val
                    )
                    for c in resolved
                )
                if already_handled:
                    continue
                existing_unresolved = db.get_conflicts(conn, biz_id=biz_id, unresolved_only=True)
                already_pending = any(
                    c["field_name"] == field_name and c["incoming_value"] == incoming_val
                    for c in existing_unresolved
                )
                if already_pending:
                    continue
                suggestion = _make_suggestion(field_name, existing_val, incoming_val, existing["primary_source"], f"{source_type}({file_name})")
                db.insert_conflict(conn, biz_id, field_name, existing_val, incoming_val, existing["primary_source"], f"{source_type}({file_name})", suggestion)
                has_conflict = True

            if has_conflict:
                conflict_count += 1
                db.update_record(conn, biz_id, status="conflict")
                if note_text:
                    db.insert_note(conn, biz_id, note_text, source_type)
            else:
                skipped += 1
                if note_text and source_type != existing.get("primary_source"):
                    db.insert_note(conn, biz_id, note_text, source_type)

    db.insert_import_log(conn, file_name, source_type, total_rows, inserted, skipped, conflict_count)
    conn.commit()

    if close_conn:
        conn.close()

    return {
        "file": file_name,
        "source_type": source_type,
        "total_rows": total_rows,
        "inserted": inserted,
        "skipped": skipped,
        "conflicts": conflict_count,
    }


def import_batch(file_paths, source_type=None, conn=None):
    close_conn = False
    if conn is None:
        db.init_db()
        conn = db.get_connection()
        close_conn = True

    results = []
    for fp in file_paths:
        try:
            result = import_file(fp, source_type=source_type, conn=conn)
            results.append(result)
        except Exception as e:
            results.append({"file": os.path.basename(fp), "error": str(e)})

    if close_conn:
        conn.close()

    return results
