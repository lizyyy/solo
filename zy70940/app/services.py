from sqlalchemy.orm import Session
from sqlalchemy import and_
from datetime import datetime
from typing import List, Optional, Tuple
from . import models, schemas
import uuid


def generate_batch_no() -> str:
    return f"BATCH{datetime.utcnow().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:4].upper()}"


def create_batch(db: Session, batch_in: schemas.BatchCreate) -> models.Batch:
    batch = models.Batch(
        batch_no=generate_batch_no(),
        name=batch_in.name,
        created_by=batch_in.created_by,
        remark=batch_in.remark,
        status="pending",
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)
    return batch


def get_batch(db: Session, batch_id: int) -> Optional[models.Batch]:
    return db.query(models.Batch).filter(models.Batch.id == batch_id).first()


def get_batch_detail(db: Session, batch_id: int) -> Optional[dict]:
    batch = get_batch(db, batch_id)
    if not batch:
        return None

    waybill_count = db.query(models.Waybill).filter(models.Waybill.batch_id == batch_id).count()
    penalty_count = db.query(models.PenaltyRecord).filter(models.PenaltyRecord.batch_id == batch_id).count()
    pending_count = db.query(models.PenaltyRecord).filter(
        models.PenaltyRecord.batch_id == batch_id,
        models.PenaltyRecord.status == "pending"
    ).count()

    return {
        **batch.__dict__,
        "waybill_count": waybill_count,
        "penalty_count": penalty_count,
        "pending_count": pending_count,
    }


def list_batches(db: Session, skip: int = 0, limit: int = 100, status: Optional[str] = None) -> List[models.Batch]:
    query = db.query(models.Batch)
    if status:
        query = query.filter(models.Batch.status == status)
    return query.order_by(models.Batch.created_at.desc()).offset(skip).limit(limit).all()


def update_batch_status(db: Session, batch_id: int, status: str) -> Optional[models.Batch]:
    batch = get_batch(db, batch_id)
    if batch:
        batch.status = status
        batch.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(batch)
    return batch


def create_penalty_record(db: Session, record_in: schemas.PenaltyRecordCreate) -> models.PenaltyRecord:
    waybill = db.query(models.Waybill).filter(
        models.Waybill.waybill_no == record_in.waybill_no,
        models.Waybill.batch_id == record_in.batch_id
    ).first()

    if not waybill:
        raise ValueError(f"运单号 {record_in.waybill_no} 不存在于批次中")

    record = models.PenaltyRecord(
        batch_id=record_in.batch_id,
        waybill_id=waybill.id,
        waybill_no=record_in.waybill_no,
        rule_id=record_in.rule_id,
        rule_code=record_in.rule_code,
        rule_name=record_in.rule_name,
        exception_type=record_in.exception_type,
        exception_reason=record_in.exception_reason,
        transfer_node=record_in.transfer_node,
        penalty_ratio=record_in.penalty_ratio,
        penalty_amount=record_in.penalty_amount,
        is_weather_exempt=record_in.is_weather_exempt,
        weather_reason=record_in.weather_reason,
        is_cross_transfer=record_in.is_cross_transfer,
        cross_transfer_detail=record_in.cross_transfer_detail,
        is_duplicate=record_in.is_duplicate,
        original_penalty_id=record_in.original_penalty_id,
        status="pending",
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def get_penalty_record(db: Session, record_id: int) -> Optional[models.PenaltyRecord]:
    return db.query(models.PenaltyRecord).filter(models.PenaltyRecord.id == record_id).first()


def query_penalty_records(
    db: Session,
    query: schemas.PenaltyQuery,
    skip: int = 0,
    limit: int = 1000,
) -> Tuple[List[models.PenaltyRecord], int]:
    q = db.query(models.PenaltyRecord)

    if query.transfer_node:
        q = q.filter(models.PenaltyRecord.transfer_node == query.transfer_node)
    if query.exception_type:
        q = q.filter(models.PenaltyRecord.exception_type == query.exception_type)
    if query.exception_reason:
        q = q.filter(models.PenaltyRecord.exception_reason.contains(query.exception_reason))
    if query.min_penalty_ratio is not None:
        q = q.filter(models.PenaltyRecord.penalty_ratio >= query.min_penalty_ratio)
    if query.max_penalty_ratio is not None:
        q = q.filter(models.PenaltyRecord.penalty_ratio <= query.max_penalty_ratio)
    if query.status:
        q = q.filter(models.PenaltyRecord.status == query.status)
    if query.batch_id:
        q = q.filter(models.PenaltyRecord.batch_id == query.batch_id)
    if query.start_date:
        q = q.filter(models.PenaltyRecord.created_at >= query.start_date)
    if query.end_date:
        q = q.filter(models.PenaltyRecord.created_at <= query.end_date)

    total = q.count()
    records = q.order_by(models.PenaltyRecord.created_at.desc()).offset(skip).limit(limit).all()
    return records, total


def process_penalty_records(
    db: Session,
    record_ids: List[int],
    action: str,
    reason: str,
    operator: str,
) -> List[models.PenaltyRecord]:
    valid_actions = {
        "approve": ("approved", "通过"),
        "reject": ("rejected", "驳回"),
        "return": ("returned", "退回修改"),
        "supplement": ("supplement", "要求补材料"),
        "release": ("released", "放行"),
    }

    if action not in valid_actions:
        raise ValueError(f"无效的处理动作: {action}")

    new_status, result_desc = valid_actions[action]
    processed_records = []

    for record_id in record_ids:
        record = get_penalty_record(db, record_id)
        if not record:
            continue

        old_status = record.status

        history = models.ProcessHistory(
            penalty_record_id=record_id,
            action=action,
            old_status=old_status,
            new_status=new_status,
            reason=reason,
            operator=operator,
        )
        db.add(history)

        record.status = new_status
        record.process_result = result_desc
        record.process_reason = reason
        record.processed_by = operator
        record.processed_at = datetime.utcnow()

        processed_records.append(record)

    db.commit()
    for record in processed_records:
        db.refresh(record)
    return processed_records


def get_record_detail(db: Session, record_id: int) -> Optional[dict]:
    record = get_penalty_record(db, record_id)
    if not record:
        return None

    waybill = db.query(models.Waybill).filter(models.Waybill.id == record.waybill_id).first()
    tracking = db.query(models.TrackingRecord).filter(
        models.TrackingRecord.waybill_id == record.waybill_id
    ).order_by(models.TrackingRecord.timestamp.asc()).all()
    histories = db.query(models.ProcessHistory).filter(
        models.ProcessHistory.penalty_record_id == record_id
    ).order_by(models.ProcessHistory.operated_at.asc()).all()

    return {
        "penalty_record": record,
        "waybill": waybill,
        "tracking_records": tracking,
        "process_histories": histories,
    }


def get_process_histories(db: Session, record_id: int) -> List[models.ProcessHistory]:
    return db.query(models.ProcessHistory).filter(
        models.ProcessHistory.penalty_record_id == record_id
    ).order_by(models.ProcessHistory.operated_at.asc()).all()


def analyze_waybill_abnormalities(db: Session, batch_id: int) -> List[dict]:
    waybills = db.query(models.Waybill).filter(models.Waybill.batch_id == batch_id).all()
    results = []

    for waybill in waybills:
        tracking = db.query(models.TrackingRecord).filter(
            models.TrackingRecord.waybill_id == waybill.id
        ).order_by(models.TrackingRecord.timestamp.asc()).all()

        abnormalities = detect_abnormalities(waybill, tracking)
        for abn in abnormalities:
            results.append({
                "waybill_no": waybill.waybill_no,
                "waybill_id": waybill.id,
                "batch_id": batch_id,
                **abn,
            })

    return results


def detect_abnormalities(waybill: models.Waybill, tracking: List[models.TrackingRecord]) -> List[dict]:
    abnormalities = []

    if not tracking:
        return abnormalities

    nodes = [t.node for t in tracking]
    timestamps = [t.timestamp for t in tracking]
    statuses = [t.status for t in tracking]

    if waybill.expected_delivery and waybill.actual_delivery:
        if waybill.actual_delivery > waybill.expected_delivery:
            delay_hours = (waybill.actual_delivery - waybill.expected_delivery).total_seconds() / 3600
            abnormalities.append({
                "exception_type": "超时送达",
                "exception_reason": f"实际送达时间晚于预计时间 {delay_hours:.1f} 小时",
                "transfer_node": tracking[-1].node if tracking else None,
                "penalty_ratio": min(0.5, delay_hours / 24),
            })

    for i, status in enumerate(statuses):
        if "破损" in status or "损坏" in status:
            abnormalities.append({
                "exception_type": "货物破损",
                "exception_reason": f"在 {nodes[i]} 节点发现货物破损: {status}",
                "transfer_node": nodes[i],
                "penalty_ratio": 0.3,
            })

        if "丢失" in status or "遗失" in status:
            abnormalities.append({
                "exception_type": "货物丢失",
                "exception_reason": f"在 {nodes[i]} 节点发现货物丢失: {status}",
                "transfer_node": nodes[i],
                "penalty_ratio": 1.0,
            })

        if "延误" in status or "延迟" in status:
            abnormalities.append({
                "exception_type": "中转延误",
                "exception_reason": f"在 {nodes[i]} 节点发生延误: {status}",
                "transfer_node": nodes[i],
                "penalty_ratio": 0.2,
            })

    if len(nodes) > 1:
        expected_nodes = ["揽收", "中转", "派送", "签收"]
        actual_types = [t.node_type for t in tracking if t.node_type]
        for exp in expected_nodes:
            if not any(exp in t for t in actual_types):
                abnormalities.append({
                    "exception_type": "轨迹缺失",
                    "exception_reason": f"缺少 {exp} 节点的轨迹记录",
                    "transfer_node": None,
                    "penalty_ratio": 0.1,
                })

    for i in range(1, len(timestamps)):
        gap = (timestamps[i] - timestamps[i - 1]).total_seconds() / 3600
        if gap > 48:
            abnormalities.append({
                "exception_type": "异常滞留",
                "exception_reason": f"在 {nodes[i-1]} 到 {nodes[i]} 之间滞留 {gap:.1f} 小时",
                "transfer_node": nodes[i-1],
                "penalty_ratio": 0.15,
            })

    return abnormalities


def get_all_transfer_nodes(db: Session) -> List[str]:
    results = db.query(models.PenaltyRecord.transfer_node).filter(
        models.PenaltyRecord.transfer_node.isnot(None)
    ).distinct().all()
    return [r[0] for r in results if r[0]]


def get_all_exception_types(db: Session) -> List[str]:
    results = db.query(models.PenaltyRecord.exception_type).distinct().all()
    return [r[0] for r in results if r[0]]
