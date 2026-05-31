from dcep_verify import db


def format_conflict(c):
    lines = []
    lines.append(f"  ╔══════════════════════════════════════════════════════════════╗")
    lines.append(f"  ║ 冲突 #{c['id']}  业务编号: {c['biz_id']}")
    lines.append(f"  ╠══════════════════════════════════════════════════════════════╣")
    lines.append(f"  ║ 字段: {c['field_name']}")
    lines.append(f"  ╟──────────────────────────────────────────────────────────────╢")
    lines.append(f"  ║ 数据库现有值: {c['existing_value']}")
    lines.append(f"  ║    来源: {c['existing_source']}")
    lines.append(f"  ╟──────────────────────────────────────────────────────────────╢")
    lines.append(f"  ║ 新导入值: {c['incoming_value']}")
    lines.append(f"  ║    来源: {c['incoming_source']}")
    lines.append(f"  ╟──────────────────────────────────────────────────────────────╢")
    lines.append(f"  ║ 建议: {c['suggestion']}")
    if c["resolved"]:
        lines.append(f"  ╟──────────────────────────────────────────────────────────────╢")
        lines.append(f"  ║ 已解决: {c['resolution']}")
    lines.append(f"  ╚══════════════════════════════════════════════════════════════╝")
    return "\n".join(lines)


def list_conflicts(conn, biz_id=None, show_resolved=False):
    if show_resolved:
        conflicts = db.get_conflicts(conn, biz_id=biz_id, unresolved_only=False, resolved_only=False)
    else:
        conflicts = [c for c in db.get_conflicts(conn, biz_id=biz_id, unresolved_only=False, resolved_only=False) if not c["resolved"]]

    if not conflicts:
        print("  没有未解决的冲突")
        return

    print(f"\n  共 {len(conflicts)} 条冲突记录:\n")
    for c in conflicts:
        print(format_conflict(c))
        print()


def resolve_conflict_interactive(conn, conflict_id, action):
    conflict = conn.execute("SELECT * FROM conflicts WHERE id = ?", (conflict_id,)).fetchone()
    if not conflict:
        print(f"  未找到冲突记录 #{conflict_id}")
        return
    conflict = dict(conflict)

    if action == "keep":
        db.resolve_conflict(conn, conflict_id, f"保留现有值: {conflict['existing_value']}（来自{conflict['existing_source']}）")
        print(f"  已保留现有值「{conflict['existing_value']}」")
    elif action == "update":
        field = conflict["field_name"]
        biz_id = conflict["biz_id"]
        new_val = conflict["incoming_value"]
        if field == "amount":
            db.update_record(conn, biz_id, amount=float(new_val), status="pending")
        elif field == "person_name":
            db.update_record(conn, biz_id, person_name=new_val, status="pending")
        elif field == "subsidy_type":
            db.update_record(conn, biz_id, subsidy_type=new_val, status="pending")
        db.resolve_conflict(conn, conflict_id, f"更新为新值: {new_val}（来自{conflict['incoming_source']}）")
        print(f"  已更新为「{new_val}」，旧值已记录在冲突日志")
    else:
        print(f"  未知操作: {action}。请使用 keep 或 update")

    conn.commit()


def show_evidence(conn, biz_id):
    record = db.get_record(conn, biz_id)
    if not record:
        print(f"  未找到业务编号 {biz_id} 的记录")
        return

    print(f"\n  ╔══════════════════════════════════════════════════════════════╗")
    print(f"  ║ 业务编号: {biz_id}")
    print(f"  ║ 收款人: {record['person_name']}")
    print(f"  ║ 金额: {record['amount']} 元")
    print(f"  ║ 补贴类型: {record.get('subsidy_type', '') or '（未填写）'}")
    print(f"  ║ 状态: {record['status']}")
    print(f"  ╚══════════════════════════════════════════════════════════════╝")

    traces = db.get_source_traces(conn, biz_id)
    if traces:
        print(f"\n  来源追踪:")
        for t in traces:
            print(f"    - [{t['source_type']}] {t['field_name']} = {t['field_value']}  <- {t['source_file']} 第{t['source_row']}行")

    notes = db.get_notes(conn, biz_id)
    if notes:
        print(f"\n  备注:")
        for n in notes:
            author = f"（{n['author']}）" if n.get("author") else ""
            print(f"    - [{n['source']}]{author} {n['content']}")

    attachments = db.get_attachments(conn, biz_id)
    if attachments:
        print(f"\n  附件:")
        for a in attachments:
            print(f"    - [{a['att_id']}] {a['file_name']}（{a['file_type']}）上传于 {a['upload_time']}")

    conflicts = db.get_conflicts(conn, biz_id=biz_id, unresolved_only=False, resolved_only=False)
    if conflicts:
        print(f"\n  冲突记录:")
        for c in conflicts:
            status_icon = "[已解决]" if c["resolved"] else "[未解决]"
            print(f"    {status_icon} 字段「{c['field_name']}」: 现有={c['existing_value']} vs 新={c['incoming_value']}")
            if c["resolved"]:
                print(f"       解决方案: {c['resolution']}")

    print()
