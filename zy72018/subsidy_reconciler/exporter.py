import csv
import os
from datetime import datetime
from subsidy_reconciler.db import Database
from subsidy_reconciler.models import (
    STATUS_CONFIRMED,
    STATUS_PENDING_MATERIAL,
    STATUS_PENDING_MANUAL,
    STATUS_OLD_STANDARD,
    STATUS_OVERRIDDEN,
    STATUS_LABELS,
    SOURCE_TYPE_LABELS,
    ACTION_LABELS,
)


def print_summary(db=None):
    if db is None:
        db = Database()

    summary = db.get_status_summary()
    all_records = db.get_all_records()

    total = sum(s["count"] for s in summary.values())
    total_amount = sum(s["amount"] for s in summary.values())

    print("=" * 60)
    print("  电影票补贴结算 - 状态摘要")
    print("=" * 60)
    print(f"  总记录数: {total}    总金额: ¥{total_amount:,.2f}")
    print("-" * 60)

    for status in [STATUS_CONFIRMED, STATUS_PENDING_MANUAL, STATUS_PENDING_MATERIAL,
                   STATUS_OLD_STANDARD, STATUS_OVERRIDDEN]:
        info = summary.get(status, {"count": 0, "amount": 0})
        label = STATUS_LABELS.get(status, status)
        print(f"  {label:8s}  {info['count']:3d} 条  ¥{info['amount']:>10,.2f}")

    print("=" * 60)

    if total > 0:
        print()
        print("  最近10条记录:")
        print("-" * 60)
        for r in all_records[:10]:
            src = SOURCE_TYPE_LABELS.get(r["source_type"], r["source_type"])
            st = STATUS_LABELS.get(r["status"], r["status"])
            print(f"  {r['subsidy_date']} | {r['movie_name'][:8]:8s} | "
                  f"¥{r['subsidy_amount']:>8,.2f} | {src:6s} | {st}")
            if r.get("judgment_reason"):
                print(f"         ↳ {r['judgment_reason'][:50]}")
        print()

    logs = db.get_import_logs()
    if logs:
        print("  导入历史:")
        print("-" * 60)
        for log in logs[:5]:
            print(f"  [{log['timestamp']}] {log['file_name']} "
                  f"({SOURCE_TYPE_LABELS.get(log['file_type'], log['file_type'])}) "
                  f"导入{log['imported']} 跳过{log['skipped']} "
                  f"更新{log['updated']} 冲突{log['conflicted']}")
        print()


def export_detail(output_dir="output", db=None):
    if db is None:
        db = Database()

    os.makedirs(output_dir, exist_ok=True)

    now = datetime.now().strftime("%Y%m%d_%H%M%S")
    detail_file = os.path.join(output_dir, f"电影票补贴结算明细_{now}.csv")
    summary_file = os.path.join(output_dir, f"电影票补贴结算报告_{now}.csv")
    audit_file = os.path.join(output_dir, f"电影票补贴结算审计_{now}.csv")

    all_records = db.get_all_records()
    status_summary = db.get_status_summary()

    confirmed = [r for r in all_records if r["status"] == STATUS_CONFIRMED]
    pending_material = [r for r in all_records if r["status"] == STATUS_PENDING_MATERIAL]
    pending_manual = [r for r in all_records if r["status"] == STATUS_PENDING_MANUAL]
    old_standard = [r for r in all_records if r["status"] == STATUS_OLD_STANDARD]
    overridden = [r for r in all_records if r["status"] == STATUS_OVERRIDDEN]

    with open(detail_file, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow([
            "分区", "记录哈希", "补贴日期", "影片名称", "票数", "补贴金额",
            "来源类型", "来源文件", "来源行号", "状态", "判断原因",
            "匹配组", "备注", "导入批次", "创建时间", "更新时间"
        ])

        sections = [
            ("已确认", confirmed),
            ("待补材料", pending_material),
            ("待人工确认", pending_manual),
            ("旧口径", old_standard),
            ("人工改判", overridden),
        ]

        for section_name, records in sections:
            for r in records:
                writer.writerow([
                    section_name,
                    r["record_hash"],
                    r["subsidy_date"],
                    r["movie_name"],
                    r["ticket_count"],
                    f"{r['subsidy_amount']:.2f}",
                    SOURCE_TYPE_LABELS.get(r["source_type"], r["source_type"]),
                    r["source_file"],
                    r["source_line"],
                    STATUS_LABELS.get(r["status"], r["status"]),
                    r["judgment_reason"],
                    r["match_group"],
                    (r["remark"] or "").strip(),
                    r["import_batch"],
                    r["created_at"],
                    r["updated_at"],
                ])

    with open(summary_file, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["状态", "记录数", "金额合计"])

        total_count = 0
        total_amount = 0.0
        for section_name, records in sections:
            count = len(records)
            amount = sum(r["subsidy_amount"] for r in records)
            total_count += count
            total_amount += amount
            writer.writerow([section_name, count, f"{amount:.2f}"])

        writer.writerow(["合计", total_count, f"{total_amount:.2f}"])

        writer.writerow([])
        writer.writerow(["=== 差异清单 ==="])
        writer.writerow(["记录哈希", "补贴日期", "影片名称", "金额", "来源", "判断原因"])

        discrepancy_records = [r for r in all_records
                               if r["status"] in (STATUS_PENDING_MANUAL,
                                                   STATUS_PENDING_MATERIAL)]
        for r in discrepancy_records:
            writer.writerow([
                r["record_hash"], r["subsidy_date"], r["movie_name"],
                f"{r['subsidy_amount']:.2f}",
                SOURCE_TYPE_LABELS.get(r["source_type"], r["source_type"]),
                r["judgment_reason"],
            ])

    audit_records = db.get_audit_trail()
    with open(audit_file, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["时间", "记录哈希", "动作", "详情", "操作者"])
        for a in audit_records:
            writer.writerow([
                a["timestamp"], a["record_hash"],
                ACTION_LABELS.get(a["action"], a["action"]),
                a["detail"], a["operator"],
            ])

    print("=" * 60)
    print("  电影票补贴结算 - 导出完成")
    print("=" * 60)
    print(f"  已确认:   {len(confirmed):3d} 条  ¥{sum(r['subsidy_amount'] for r in confirmed):>10,.2f}")
    print(f"  待补材料: {len(pending_material):3d} 条  ¥{sum(r['subsidy_amount'] for r in pending_material):>10,.2f}")
    print(f"  待人工确认: {len(pending_manual):3d} 条  ¥{sum(r['subsidy_amount'] for r in pending_manual):>10,.2f}")
    print(f"  旧口径:   {len(old_standard):3d} 条  ¥{sum(r['subsidy_amount'] for r in old_standard):>10,.2f}")
    print(f"  人工改判: {len(overridden):3d} 条  ¥{sum(r['subsidy_amount'] for r in overridden):>10,.2f}")
    print("-" * 60)
    print(f"  明细文件: {detail_file}")
    print(f"  报告文件: {summary_file}")
    print(f"  审计文件: {audit_file}")
    print("=" * 60)

    return {
        "detail_file": detail_file,
        "summary_file": summary_file,
        "audit_file": audit_file,
        "counts": {
            "confirmed": len(confirmed),
            "pending_material": len(pending_material),
            "pending_manual": len(pending_manual),
            "old_standard": len(old_standard),
            "overridden": len(overridden),
        }
    }
