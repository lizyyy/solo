from typing import List, Optional
from datetime import datetime
import store
from models import GpsReleaseRecord, Status


def process_batch(
    batch_id: Optional[str] = None,
    db_path: str = store.DB_PATH,
) -> dict:
    conn = store.get_conn(db_path)
    records = store.list_records(conn, batch_id=batch_id)
    results = {"processed": 0, "auto_completed": 0, "still_pending": 0, "still_review": 0, "actions": []}

    for rec in records:
        if rec.status == Status.COMPLETED.value or rec.status == Status.REJECTED.value:
            continue

        if rec.status == Status.CONFIRMED.value:
            store.update_status(conn, rec.contract_no, Status.COMPLETED.value)
            results["auto_completed"] += 1
            results["actions"].append({
                "contract_no": rec.contract_no,
                "action": "auto_completed",
                "reason": "已确认记录自动完成",
            })
            results["processed"] += 1
            continue

        if rec.status == Status.PENDING.value:
            reasons = rec.needs_review_reasons()
            if not reasons:
                store.update_status(conn, rec.contract_no, Status.COMPLETED.value)
                results["auto_completed"] += 1
                results["actions"].append({
                    "contract_no": rec.contract_no,
                    "action": "auto_completed",
                    "reason": "字段完整、金额一致，自动完成",
                })
            else:
                store.update_status(conn, rec.contract_no, Status.NEEDS_REVIEW.value)
                results["still_review"] += 1
                results["actions"].append({
                    "contract_no": rec.contract_no,
                    "action": "needs_review",
                    "reason": "; ".join(reasons),
                })
            results["processed"] += 1
            continue

        if rec.status == Status.NEEDS_REVIEW.value:
            reasons = rec.needs_review_reasons()
            if not reasons:
                store.update_status(conn, rec.contract_no, Status.COMPLETED.value)
                results["auto_completed"] += 1
                results["actions"].append({
                    "contract_no": rec.contract_no,
                    "action": "auto_completed",
                    "reason": "补材料后问题解决，自动完成",
                })
                results["processed"] += 1
            else:
                results["still_review"] += 1
                results["actions"].append({
                    "contract_no": rec.contract_no,
                    "action": "still_needs_review",
                    "reason": "; ".join(reasons),
                })

    conn.close()
    return results


def confirm_record(
    contract_no: str,
    action: str,
    confirmed_by: str,
    db_path: str = store.DB_PATH,
) -> dict:
    conn = store.get_conn(db_path)
    rec = store.get_record(conn, contract_no)
    if not rec:
        conn.close()
        return {"error": f"合同号 {contract_no} 不存在"}

    if rec.status not in [Status.NEEDS_REVIEW.value, Status.PENDING.value, Status.CONFIRMED.value]:
        conn.close()
        return {"error": f"合同号 {contract_no} 当前状态为 {rec.status}，无法执行此操作"}

    if action == "confirm":
        store.update_status(conn, contract_no, Status.CONFIRMED.value, confirmed_by=confirmed_by)
        result = {"contract_no": contract_no, "action": "confirmed", "by": confirmed_by}
    elif action == "reject":
        store.update_status(conn, contract_no, Status.REJECTED.value, confirmed_by=confirmed_by)
        result = {"contract_no": contract_no, "action": "rejected", "by": confirmed_by}
    else:
        conn.close()
        return {"error": f"不支持的操作: {action}"}

    conn.close()
    return result


def get_record_detail(contract_no: str, db_path: str = store.DB_PATH) -> Optional[dict]:
    conn = store.get_conn(db_path)
    rec = store.get_record(conn, contract_no)
    conn.close()
    if not rec:
        return None
    d = rec.to_dict()
    d["needs_review_reasons"] = rec.needs_review_reasons()
    d["missing_fields"] = rec.missing_fields()
    return d
