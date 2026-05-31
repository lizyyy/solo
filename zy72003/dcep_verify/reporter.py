import csv
import os
from datetime import datetime
from dcep_verify import db


def print_summary(conn):
    stats = db.get_stats(conn)
    records = db.get_all_records(conn)
    conflicts = db.get_conflicts(conn, unresolved_only=True)
    import_logs = db.get_import_logs(conn)

    print("\n" + "=" * 68)
    print("  数字人民币补贴核销 — 摘要")
    print("=" * 68)

    print(f"\n  总记录数: {stats['total_records']}")
    print(f"  总金额: {stats['total_amount']:,.2f} 元")

    status_labels = {
        "pending": "待核销",
        "verified": "已核销",
        "conflict": "有冲突",
    }
    print(f"  状态分布:")
    for status, count in stats["by_status"].items():
        label = status_labels.get(status, status)
        print(f"    {label}: {count}")
    print(f"  未解决冲突: {stats['unresolved_conflicts']}")

    if records:
        print(f"\n  各业务编号概览:")
        print(f"  {'业务编号':<18} {'收款人':<8} {'金额':>10}  {'状态':<8} {'来源'}")
        print(f"  {'-'*18} {'-'*8} {'-'*10}  {'-'*8} {'-'*12}")
        for r in records:
            label = status_labels.get(r["status"], r["status"])
            print(f"  {r['biz_id']:<18} {r['person_name']:<8} {r['amount']:>10,.2f}  {label:<8} {r['primary_source']}")

    if conflicts:
        print(f"\n  ⚠ 待处理冲突:")
        for c in conflicts:
            print(f"    #{c['id']} {c['biz_id']} 字段「{c['field_name']}」: {c['existing_value']} vs {c['incoming_value']}")

    if import_logs:
        print(f"\n  最近导入记录:")
        for log in import_logs[:5]:
            print(f"    {log['imported_at']} {log['file_name']} ({log['source_type']}) "
                  f"导入{log['inserted']}条/跳过{log['skipped']}条/冲突{log['conflicts']}条")

    print("=" * 68 + "\n")


def export_finance_detail(conn, output_path=None):
    if output_path is None:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "output")
        os.makedirs(output_dir, exist_ok=True)
        output_path = os.path.join(output_dir, f"数字人民币补贴核销明细_{ts}.csv")

    records = db.get_all_records(conn)

    status_labels = {
        "pending": "待核销",
        "verified": "已核销",
        "conflict": "有冲突",
    }

    rows = []
    for r in records:
        biz_id = r["biz_id"]
        traces = db.get_source_traces(conn, biz_id)
        notes = db.get_notes(conn, biz_id)
        attachments = db.get_attachments(conn, biz_id)
        conflicts = db.get_conflicts(conn, biz_id=biz_id, unresolved_only=False, resolved_only=False)

        trace_desc = "; ".join(
            f"{t['source_type']}({t['source_file']}第{t['source_row']}行):{t['field_name']}={t['field_value']}"
            for t in traces
        )
        def _note_str(n):
            author = f"({n['author']})" if n.get("author") else ""
            return f"[{n['source']}]{author} {n['content']}"

        note_desc = "; ".join(_note_str(n) for n in notes)
        att_desc = "; ".join(
            f"{a['att_id']}:{a['file_name']}({a['file_type']})"
            for a in attachments
        )
        conflict_desc = ""
        for c in conflicts:
            icon = "✓" if c["resolved"] else "✗"
            conflict_desc += f"[{icon}] {c['field_name']}: {c['existing_value']} vs {c['incoming_value']}; "
            if c["resolved"]:
                conflict_desc += f"解决: {c['resolution']}; "

        rows.append({
            "业务编号": biz_id,
            "收款人": r["person_name"],
            "金额(元)": f"{r['amount']:.2f}",
            "补贴类型": r.get("subsidy_type", ""),
            "核销状态": status_labels.get(r["status"], r["status"]),
            "首次来源": r["primary_source"],
            "创建时间": r["created_at"],
            "更新时间": r["updated_at"],
            "来源追踪": trace_desc,
            "备注": note_desc,
            "附件": att_desc,
            "冲突记录": conflict_desc,
        })

    fieldnames = [
        "业务编号", "收款人", "金额(元)", "补贴类型", "核销状态",
        "首次来源", "创建时间", "更新时间", "来源追踪", "备注", "附件", "冲突记录",
    ]

    with open(output_path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"\n  财务明细已导出: {output_path}")
    print(f"  共 {len(rows)} 条记录\n")
    return output_path
