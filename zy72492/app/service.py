from datetime import datetime
from typing import List, Tuple, Dict, Optional
from .models import (
    HeatmapResult, HeatmapCell, DispatchOrder, Status,
    AuditLog, AuditAction, SamplingTime, RecordType, SamplingRecord
)
from .store import store
import uuid


def generate_id() -> str:
    return str(uuid.uuid4())[:8]


def generate_heatmap(operator: str, reason: Optional[str] = None) -> HeatmapResult:
    version = store.heatmap_version + 1
    cells: List[HeatmapCell] = []
    notes: List[str] = []

    for point_id, point in store.points.items():
        records = store.get_records_by_point(point_id)
        orders = store.get_orders_by_point(point_id)

        day_records = [r for r in records if r.sampling_time == SamplingTime.DAY and r.has_coverage]
        night_records = [r for r in records if r.sampling_time == SamplingTime.NIGHT and r.has_coverage]

        has_day_coverage = len(day_records) > 0
        has_night_coverage = len(night_records) > 0

        day_score = sum(r.score for r in day_records) / len(day_records) if day_records else 0
        night_score = sum(r.score for r in night_records) / len(night_records) if night_records else 0

        if has_day_coverage and has_night_coverage:
            score = (day_score + night_score) / 2
            status = Status.NORMAL
            cell_reason = None
        elif has_day_coverage and not has_night_coverage:
            score = day_score * 0.6
            status = Status.LOW_COVERAGE
            cell_reason = "晚上缺采样导致热力图偏低，需补录晚间数据"
            notes.append(f"{point.name}: {cell_reason}")
        elif not has_day_coverage and has_night_coverage:
            score = night_score * 0.7
            status = Status.LOW_COVERAGE
            cell_reason = "白天缺采样导致热力图偏低，需补录日间数据"
            notes.append(f"{point.name}: {cell_reason}")
        else:
            score = 0
            status = Status.LOW_COVERAGE
            cell_reason = "完全无采样数据"

        pending_orders = [o for o in orders if o.status == Status.PENDING_REVIEW]
        corrected_orders = [o for o in orders if o.status == Status.CORRECTED]
        if pending_orders:
            status = Status.PENDING_REVIEW
            cell_reason = pending_orders[0].missing_reason or "待街道规划员复核"
        elif corrected_orders:
            status = Status.CORRECTED
            cell_reason = corrected_orders[0].missing_reason or "人工修正"

        related_order_ids = [o.id for o in orders]

        cell = HeatmapCell(
            point_id=point_id,
            score=round(score, 2),
            status=status,
            reason=cell_reason,
            has_day_coverage=has_day_coverage,
            has_night_coverage=has_night_coverage,
            related_orders=related_order_ids
        )
        cells.append(cell)

    heatmap = HeatmapResult(
        generated_at=datetime.now(),
        cells=cells,
        version=version,
        notes=notes
    )

    store.add_heatmap(heatmap)

    audit = AuditLog(
        id=generate_id(),
        action=AuditAction.RERUN,
        operator=operator,
        reason=reason or f"热力图重跑，版本升级至v{version}",
        changes={"heatmap_version": version, "notes_count": len(notes)}
    )
    store.add_audit(audit)

    for order in store.orders.values():
        for cell in cells:
            if cell.point_id == order.point_id:
                old_score = order.heatmap_score
                new_status = cell.status

                if order.status == Status.CORRECTED and cell.status == Status.LOW_COVERAGE:
                    new_status = Status.CORRECTED

                store.update_order(
                    order.id,
                    heatmap_score=cell.score,
                    status=new_status
                )

                if new_status == Status.LOW_COVERAGE and order.responsible_person != "街道规划员":
                    store.update_order(
                        order.id,
                        responsible_person="街道规划员",
                        next_action="请街道规划员复核晚间采样情况"
                    )

    return heatmap


def import_construction_notice(
    point_id: str,
    title: str,
    description: str,
    operator: str
) -> Tuple[DispatchOrder, HeatmapResult]:
    record_id = generate_id()
    record = SamplingRecord(
        id=record_id,
        point_id=point_id,
        record_type=RecordType.CONSTRUCTION_NOTICE,
        sampling_time=SamplingTime.DAY,
        has_coverage=True,
        score=0.8,
        data={"title": title, "description": description},
        created_by=operator
    )
    store.add_record(record)

    order_id = generate_id()
    order = DispatchOrder(
        id=order_id,
        title=title,
        description=description,
        point_id=point_id,
        status=Status.LOW_COVERAGE,
        heatmap_score=0.48,
        missing_reason="施工告示已导入，但缺少晚间采样和无障碍坡道记录",
        next_action="请市政巡检员小付补录无障碍坡道记录和晚间采样数据",
        responsible_person="市政巡检员小付",
        records=[record_id]
    )
    store.add_order(order)

    audit = AuditLog(
        id=generate_id(),
        order_id=order_id,
        action=AuditAction.IMPORT,
        operator=operator,
        reason="导入施工告示",
        changes={"record_added": record_id, "order_created": order_id}
    )
    store.add_audit(audit)

    heatmap = generate_heatmap(operator, reason=f"导入施工告示: {title}")

    return order, heatmap


def supplement_ramp_record(
    order_id: str,
    ramp_description: str,
    operator: str,
    is_night: bool = False
) -> Tuple[DispatchOrder, HeatmapResult]:
    order = store.orders.get(order_id)
    if not order:
        raise ValueError(f"派单 {order_id} 不存在")

    old_status = order.status
    old_reason = order.missing_reason

    record_id = generate_id()
    sampling_time = SamplingTime.NIGHT if is_night else SamplingTime.DAY
    record = SamplingRecord(
        id=record_id,
        point_id=order.point_id,
        record_type=RecordType.RAMP_RECORD,
        sampling_time=sampling_time,
        has_coverage=True,
        score=0.9,
        data={"ramp_description": ramp_description},
        created_by=operator
    )
    store.add_record(record)

    order.records.append(record_id)

    records = store.get_records_by_point(order.point_id)
    night_records = [r for r in records if r.sampling_time == SamplingTime.NIGHT and r.has_coverage]
    day_records = [r for r in records if r.sampling_time == SamplingTime.DAY and r.has_coverage]

    has_night = len(night_records) > 0
    has_ramp_night = any(r.record_type == RecordType.RAMP_RECORD and r.sampling_time == SamplingTime.NIGHT for r in records)
    has_ramp_day = any(r.record_type == RecordType.RAMP_RECORD and r.sampling_time == SamplingTime.DAY for r in records)

    if has_night and has_ramp_night and has_ramp_day:
        new_status = Status.NORMAL
        new_reason = "数据完整，已包含日间/晚间采样及无障碍坡道记录"
        next_action = "无"
        responsible = None
    elif not has_night:
        new_status = Status.LOW_COVERAGE
        new_reason = "已补录无障碍坡道记录，但仍缺少晚间采样，热力图偏低"
        next_action = "请街道规划员复核，确认是否需要补充晚间采样"
        responsible = "街道规划员"
    else:
        new_status = Status.SUPPLEMENTED
        new_reason = "已补录无障碍坡道记录"
        next_action = "请街道规划员复核"
        responsible = "街道规划员"

    store.update_order(
        order_id,
        status=new_status,
        missing_reason=new_reason,
        next_action=next_action,
        responsible_person=responsible
    )

    audit = AuditLog(
        id=generate_id(),
        order_id=order_id,
        action=AuditAction.SUPPLEMENT,
        operator=operator,
        reason=f"补录无障碍坡道记录（{sampling_time.value}）",
        changes={
            "record_added": record_id,
            "old_status": old_status.value if old_status else None,
            "new_status": new_status.value,
            "old_reason": old_reason,
            "new_reason": new_reason
        }
    )
    store.add_audit(audit)

    heatmap = generate_heatmap(operator, reason=f"补录无障碍坡道记录: {ramp_description[:30]}")

    return order, heatmap


def manual_correct(
    order_id: str,
    new_status: Status,
    new_reason: str,
    operator: str,
    correction_note: str
) -> Tuple[DispatchOrder, HeatmapResult]:
    order = store.orders.get(order_id)
    if not order:
        raise ValueError(f"派单 {order_id} 不存在")

    old_status = order.status
    old_reason = order.missing_reason

    store.update_order(
        order_id,
        status=new_status,
        missing_reason=new_reason,
        next_action="已人工修正",
        responsible_person=None
    )

    audit = AuditLog(
        id=generate_id(),
        order_id=order_id,
        action=AuditAction.CORRECT,
        operator=operator,
        reason=correction_note,
        changes={
            "old_status": old_status.value,
            "new_status": new_status.value,
            "old_reason": old_reason,
            "new_reason": new_reason
        }
    )
    store.add_audit(audit)

    heatmap = generate_heatmap(operator, reason=f"人工修正: {correction_note[:30]}")

    return order, heatmap


def review_order(
    order_id: str,
    approved: bool,
    reviewer: str,
    review_note: str
) -> Tuple[DispatchOrder, HeatmapResult]:
    order = store.orders.get(order_id)
    if not order:
        raise ValueError(f"派单 {order_id} 不存在")

    old_status = order.status

    if approved:
        new_status = Status.NORMAL
        new_reason = f"街道规划员复核通过: {review_note}"
        next_action = "无"
    else:
        new_status = Status.LOW_COVERAGE
        new_reason = f"街道规划员复核不通过，需补充: {review_note}"
        next_action = "请市政巡检员小付补充数据"

    store.update_order(
        order_id,
        status=new_status,
        missing_reason=new_reason,
        next_action=next_action,
        responsible_person="市政巡检员小付" if not approved else None
    )

    audit = AuditLog(
        id=generate_id(),
        order_id=order_id,
        action=AuditAction.REVIEW,
        operator=reviewer,
        reason=review_note,
        changes={
            "old_status": old_status.value,
            "new_status": new_status.value,
            "approved": approved
        }
    )
    store.add_audit(audit)

    heatmap = generate_heatmap(reviewer, reason=f"复核: {'通过' if approved else '不通过'}")

    return order, heatmap


def get_order_detail(order_id: str) -> Dict:
    order = store.orders.get(order_id)
    if not order:
        return {}

    point = store.points.get(order.point_id)
    records = [store.records.get(r_id) for r_id in order.records if store.records.get(r_id)]
    audit_logs = store.get_audit_by_order(order_id)

    return {
        "order": order.model_dump(),
        "point": point.model_dump() if point else None,
        "records": [r.model_dump() for r in records],
        "audit_logs": [a.model_dump() for a in audit_logs]
    }
