import uuid
from collections import defaultdict
from subsidy_reconciler.db import Database
from subsidy_reconciler.models import (
    SOURCE_PAYMENT,
    SOURCE_APPROVAL_EMAIL,
    SOURCE_REFUND,
    SOURCE_MANUAL_NOTE,
    STATUS_CONFIRMED,
    STATUS_PENDING_MATERIAL,
    STATUS_PENDING_MANUAL,
    STATUS_OLD_STANDARD,
    STATUS_OVERRIDDEN,
    SOURCE_TYPE_LABELS,
    STATUS_LABELS,
)


def reconcile(db=None):
    if db is None:
        db = Database()

    records = db.get_all_records()
    if not records:
        return {"matched": 0, "unmatched": 0, "discrepancies": [], "groups": []}

    date_movie_groups = defaultdict(list)
    for r in records:
        key = f"{r['subsidy_date']}|{r['movie_name']}"
        date_movie_groups[key].append(r)

    matched = 0
    unmatched = 0
    discrepancies = []
    groups = []

    for key, group_records in date_movie_groups.items():
        subsidy_date, movie_name = key.split("|", 1)
        group_id = uuid.uuid4().hex[:8]

        payments = [r for r in group_records if r["source_type"] == SOURCE_PAYMENT]
        approvals = [r for r in group_records if r["source_type"] == SOURCE_APPROVAL_EMAIL]
        refunds = [r for r in group_records if r["source_type"] == SOURCE_REFUND]
        notes = [r for r in group_records if r["source_type"] == SOURCE_MANUAL_NOTE]

        has_approval = len(approvals) > 0
        has_payment = len(payments) > 0

        for r in group_records:
            db.update_match_group(r["record_hash"], group_id)

        group_info = {
            "group_id": group_id,
            "date": subsidy_date,
            "movie": movie_name,
            "records": group_records,
            "has_approval": has_approval,
            "has_payment": has_payment,
            "has_refund": len(refunds) > 0,
            "has_note": len(notes) > 0,
        }

        if has_payment and has_approval:
            payment_total = sum(p["subsidy_amount"] for p in payments)
            approval_total = sum(a["subsidy_amount"] for a in approvals)

            if abs(payment_total - approval_total) < 0.01:
                for r in group_records:
                    if r["status"] in (STATUS_OLD_STANDARD, STATUS_OVERRIDDEN):
                        continue
                    if r["source_type"] == SOURCE_REFUND:
                        db.update_status(
                            r["record_hash"], STATUS_PENDING_MANUAL,
                            f"退款待人工确认(同组收款{payment_total}与审批{approval_total}已匹配) [组{group_id}]"
                        )
                    elif r["source_type"] == SOURCE_MANUAL_NOTE and r["status"] == STATUS_PENDING_MATERIAL:
                        db.update_status(
                            r["record_hash"], STATUS_PENDING_MATERIAL,
                            f"手写备注待补材料(同组收款与审批已匹配) [组{group_id}]"
                        )
                    else:
                        db.update_status(
                            r["record_hash"], STATUS_CONFIRMED,
                            f"对账通过: 收款{payment_total}与审批{approval_total}一致 [组{group_id}]"
                        )
                matched += len(group_records)
                group_info["result"] = "matched"
                group_info["detail"] = f"收款{payment_total}与审批{approval_total}一致"
            else:
                diff = payment_total - approval_total
                for r in group_records:
                    if r["status"] not in (STATUS_OLD_STANDARD, STATUS_OVERRIDDEN):
                        db.update_status(
                            r["record_hash"], STATUS_PENDING_MANUAL,
                            f"对账差异: 收款{payment_total}与审批{approval_total}相差{diff:.2f} [组{group_id}]"
                        )
                discrepancies.append({
                    "group_id": group_id, "date": subsidy_date,
                    "movie": movie_name, "payment_total": payment_total,
                    "approval_total": approval_total, "diff": diff,
                })
                group_info["result"] = "discrepancy"
                group_info["detail"] = f"差额{diff:.2f}"
                matched += len(group_records)

        elif has_payment and not has_approval:
            for r in group_records:
                if r["source_type"] == SOURCE_PAYMENT and r["status"] not in (STATUS_OLD_STANDARD, STATUS_OVERRIDDEN):
                    db.update_status(
                        r["record_hash"], STATUS_PENDING_MATERIAL,
                        f"缺少审批邮件对应: 收款{r['subsidy_amount']}无审批记录 [组{group_id}]"
                    )
            unmatched += len(payments)
            group_info["result"] = "missing_approval"
            group_info["detail"] = "缺少审批邮件"

        elif has_approval and not has_payment:
            for r in group_records:
                if r["source_type"] == SOURCE_APPROVAL_EMAIL and r["status"] not in (STATUS_OLD_STANDARD, STATUS_OVERRIDDEN):
                    db.update_status(
                        r["record_hash"], STATUS_PENDING_MATERIAL,
                        f"缺少收款流水对应: 审批{r['subsidy_amount']}无收款记录 [组{group_id}]"
                    )
            unmatched += len(approvals)
            group_info["result"] = "missing_payment"
            group_info["detail"] = "缺少收款流水"

        else:
            for r in group_records:
                if r["status"] == STATUS_PENDING_MATERIAL and r["status"] not in (STATUS_OLD_STANDARD, STATUS_OVERRIDDEN):
                    db.update_status(
                        r["record_hash"], STATUS_PENDING_MATERIAL,
                        f"仅{SOURCE_TYPE_LABELS.get(r['source_type'], r['source_type'])}记录，无交叉验证 [组{group_id}]"
                    )
            unmatched += len(group_records)
            group_info["result"] = "isolated"
            group_info["detail"] = "无交叉验证"

        groups.append(group_info)

    return {
        "matched": matched,
        "unmatched": unmatched,
        "discrepancies": discrepancies,
        "groups": groups,
    }
