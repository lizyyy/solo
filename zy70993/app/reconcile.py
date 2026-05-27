import hashlib
import json
from typing import Dict, List, Tuple

from sqlalchemy.orm import Session

from app import models, schemas
from app.parsers import parse_refund_table, parse_subsidy_json, parse_swipe_csv


MEAL_ORDER = {"早餐": 1, "午餐": 2, "晚餐": 3, "夜宵": 4}
UNKNOWN_MEAL_ORDER = 99


def compute_idempotency_key(
    batch_name: str,
    month: str,
    swipe_bytes: bytes,
    subsidy_bytes: bytes,
    refund_bytes: bytes,
) -> str:
    h = hashlib.sha256()
    h.update(batch_name.encode("utf-8"))
    h.update(b"|")
    h.update(month.encode("utf-8"))
    h.update(b"|")
    h.update(hashlib.sha256(swipe_bytes).digest())
    h.update(b"|")
    h.update(hashlib.sha256(subsidy_bytes).digest())
    h.update(b"|")
    h.update(hashlib.sha256(refund_bytes).digest())
    return h.hexdigest()


def parse_and_validate(
    swipe_csv: str,
    subsidy_json: str,
    refund_text: str,
    refund_fmt: str,
) -> Tuple[List[schemas.SwipeItem], List[schemas.SubsidyItem], List[schemas.RefundItem]]:
    swipes = parse_swipe_csv(swipe_csv)
    subsidies = parse_subsidy_json(subsidy_json)
    refunds = parse_refund_table(refund_text, refund_fmt)
    return swipes, subsidies, refunds


def _meal_rank(meal_type: str) -> int:
    return MEAL_ORDER.get(meal_type, UNKNOWN_MEAL_ORDER)


def run_reconciliation(batch_id: int, db: Session) -> Dict:
    batch = db.query(models.Batch).filter(models.Batch.id == batch_id).one()

    if batch.status == "reconciled":
        results = db.query(models.ReconciliationResult).filter(
            models.ReconciliationResult.batch_id == batch_id
        ).all()
        return _build_report(batch, results)

    db.query(models.ReconciliationResult).filter(
        models.ReconciliationResult.batch_id == batch_id
    ).delete(synchronize_session=False)

    subsidies = db.query(models.SubsidyRecord).filter(
        models.SubsidyRecord.batch_id == batch_id
    ).all()
    subsidy_by_student: Dict[str, models.SubsidyRecord] = {}
    for s in subsidies:
        subsidy_by_student.setdefault(s.student_id, s)

    refunds = db.query(models.RefundRecord).filter(
        models.RefundRecord.batch_id == batch_id
    ).all()
    refunds_by_student: Dict[str, List[models.RefundRecord]] = {}
    for r in refunds:
        refunds_by_student.setdefault(r.student_id, []).append(r)
    for rs in refunds_by_student.values():
        rs.sort(key=lambda x: x.refund_time)

    swipes = db.query(models.SwipeRecord).filter(
        models.SwipeRecord.batch_id == batch_id
    ).order_by(
        models.SwipeRecord.student_id,
        models.SwipeRecord.swipe_time,
    ).all()

    used_refund_ids: set = set()
    consumed_by_student: Dict[str, float] = {}
    seen_student_meal_day: Dict[Tuple[str, str, str], int] = {}

    created: List[models.ReconciliationResult] = []

    for swipe in swipes:
        subsidy = subsidy_by_student.get(swipe.student_id)
        reasons: List[str] = []
        suggestion_parts: List[str] = []
        status = "normal"
        consumed_before = consumed_by_student.get(swipe.student_id, 0.0)
        subsidy_limit = subsidy.monthly_limit if subsidy else 0.0
        matched_refund_id = None
        source_trace = f"原始刷卡批次 #{batch.id} 刷卡记录 #{swipe.id} @ {swipe.swipe_time.isoformat()} 餐次={swipe.meal_type} 设备={swipe.device} 原始={swipe.raw}"

        if not subsidy:
            status = "failed"
            reasons.append("学生不在当月补贴名单中")
            suggestion_parts.append("确认该生是否享受补贴，漏录则补名单后重跑")
        else:
            day = swipe.swipe_time.strftime("%Y-%m-%d")
            key = (swipe.student_id, day, swipe.meal_type)
            seen_student_meal_day[key] = seen_student_meal_day.get(key, 0) + 1
            if seen_student_meal_day[key] > 1:
                status = "failed"
                reasons.append(f"{day} 同一餐次 {swipe.meal_type} 重复领取")
                suggestion_parts.append("核对是否误刷/重复上报，保留首次、其余作废或联系本人")

            if (
                consumed_before + swipe.amount > subsidy_limit
                and status == "normal"
            ):
                status = "failed"
                reasons.append(
                    f"超出月度补贴上限: 已用 {consumed_before:.2f} + 本次 {swipe.amount:.2f} > 上限 {subsidy_limit:.2f}"
                )
                suggestion_parts.append("超出部分转为自费或追加补贴额度后重跑")

            if status == "normal":
                refunds_for_student = refunds_by_student.get(swipe.student_id, [])
                for r in refunds_for_student:
                    if r.id in used_refund_ids:
                        continue
                    if r.related_meal_type and r.related_meal_type != swipe.meal_type:
                        continue
                    if abs(r.refund_amount - swipe.amount) > 0.01:
                        continue
                    if r.refund_time.date() == swipe.swipe_time.date():
                        used_refund_ids.add(r.id)
                        matched_refund_id = r.id
                        status = "pending"
                        reasons.append(f"与退款记录 #{r.id} 金额/餐次/日期匹配，疑似退餐返还")
                        suggestion_parts.append("联系食堂确认是否退餐，若确认则扣回本次补贴并标记退餐")
                        source_trace += f" | 匹配退款记录 #{r.id} 原因={r.reason}"
                        break

        if status == "pending" and not reasons:
            reasons.append("待人工确认")

        consumed_by_student[swipe.student_id] = consumed_before + swipe.amount

        if status != "failed":
            result_reason = "; ".join(reasons)
            result_suggestion = "; ".join(suggestion_parts)
        else:
            result_reason = "; ".join(reasons)
            result_suggestion = "; ".join(suggestion_parts)

        created.append(models.ReconciliationResult(
            batch_id=batch.id,
            swipe_id=swipe.id,
            student_id=swipe.student_id,
            month=batch.month,
            status=status,
            reason=result_reason,
            suggestion=result_suggestion,
            consumed_before_this=round(consumed_before, 2),
            subsidy_limit=round(subsidy_limit, 2),
            matched_refund_id=matched_refund_id,
            source_trace=source_trace,
        ))

    db.add_all(created)
    batch.status = "reconciled"
    batch.note = f"已对账: 正常 {sum(1 for r in created if r.status == 'normal')}, " \
                 f"待确认 {sum(1 for r in created if r.status == 'pending')}, " \
                 f"失败 {sum(1 for r in created if r.status == 'failed')}"
    db.commit()

    for r in created:
        db.refresh(r)
    return _build_report(batch, created)


def _build_report(batch: models.Batch, results: List[models.ReconciliationResult]) -> Dict:
    normal = [r for r in results if r.status == "normal"]
    pending = [r for r in results if r.status == "pending"]
    failed = [r for r in results if r.status == "failed"]
    return {
        "batch_id": batch.id,
        "month": batch.month,
        "total": len(results),
        "normal_count": len(normal),
        "pending_count": len(pending),
        "failed_count": len(failed),
        "normal": normal,
        "pending": pending,
        "failed": failed,
    }
