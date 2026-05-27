from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Set
from datetime import datetime, timedelta
import uuid
from collections import defaultdict

from . import models, schemas
from .models import (
    ReconciliationStatus, ReviewStatus, DiscrepancyType, DataSource,
    Alarm, Inspection, WorkOrder, ReconciliationRecord, Discrepancy,
    ReviewHistory, ReconciliationBatch
)


TIME_WINDOW_HOURS = 48


def create_reconciliation_batch(
    db: Session, 
    batch_data: schemas.ReconciliationBatchCreate
) -> ReconciliationBatch:
    """创建对账批次"""
    batch = ReconciliationBatch(
        batch_id=batch_data.batch_id,
        name=batch_data.name,
        description=batch_data.description,
        created_by=batch_data.created_by,
        status="created"
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)
    return batch


def _group_by_pole(alarms, inspections, work_orders):
    """按灯杆分组数据，用于识别同杆多灯场景"""
    pole_map: Dict[str, Dict] = defaultdict(lambda: {
        "light_ids": set(),
        "alarms": [],
        "inspections": [],
        "work_orders": []
    })
    
    for alarm in alarms:
        pole_map[alarm.pole_id]["light_ids"].add(alarm.light_id)
        pole_map[alarm.pole_id]["alarms"].append(alarm)
    
    for inspection in inspections:
        pole_map[inspection.pole_id]["light_ids"].add(inspection.light_id)
        pole_map[inspection.pole_id]["inspections"].append(inspection)
    
    for wo in work_orders:
        pole_map[wo.pole_id]["light_ids"].add(wo.light_id)
        pole_map[wo.pole_id]["work_orders"].append(wo)
    
    return pole_map


def _group_by_pole_and_light(alarms, inspections, work_orders):
    """按灯杆和灯具分组数据"""
    pole_light_map: Dict[str, Dict] = defaultdict(lambda: {
        "alarms": [],
        "inspections": [],
        "work_orders": []
    })
    
    for alarm in alarms:
        key = f"{alarm.pole_id}||{alarm.light_id}"
        pole_light_map[key]["alarms"].append(alarm)
    
    for inspection in inspections:
        key = f"{inspection.pole_id}||{inspection.light_id}"
        pole_light_map[key]["inspections"].append(inspection)
    
    for wo in work_orders:
        key = f"{wo.pole_id}||{wo.light_id}"
        pole_light_map[key]["work_orders"].append(wo)
    
    return pole_light_map


def _find_matching_records(records, target_time, time_window_hours):
    """在时间窗口内查找匹配记录"""
    window = timedelta(hours=time_window_hours)
    matches = []
    for record in records:
        record_time = None
        if isinstance(record, Alarm):
            record_time = record.alarm_time
        elif isinstance(record, Inspection):
            record_time = record.inspection_time
        elif isinstance(record, WorkOrder):
            record_time = record.report_time
        
        if record_time and abs((record_time - target_time).total_seconds()) <= window.total_seconds():
            matches.append(record)
    return matches


def _create_discrepancy(
    db: Session,
    record_id: int,
    dtype: DiscrepancyType,
    description: str,
    source: DataSource
) -> Discrepancy:
    """创建差异记录"""
    discrepancy = Discrepancy(
        record_id=record_id,
        type=dtype,
        description=description,
        source=source,
        is_resolved=False
    )
    db.add(discrepancy)
    return discrepancy


def _check_false_alarm(alarm: Alarm) -> bool:
    """检查是否为误报"""
    if alarm.is_false_alarm:
        return True
    
    false_alarm_keywords = ['测试', '误报', '系统异常', '重启恢复', '临时干扰']
    for keyword in false_alarm_keywords:
        if keyword in alarm.description or keyword in alarm.status:
            return True
    
    return False


def _check_repair_retest(work_order: WorkOrder) -> bool:
    """检查是否为修复复测"""
    return work_order.is_retest or (work_order.retest_result is not None)


def run_reconciliation(db: Session, batch_id: str) -> schemas.ReconciliationResult:
    """执行自动比对"""
    batch = db.query(ReconciliationBatch).filter(
        ReconciliationBatch.batch_id == batch_id
    ).first()
    
    if not batch:
        raise ValueError(f"对账批次不存在: {batch_id}")
    
    db.query(ReconciliationRecord).filter(
        ReconciliationRecord.batch_id == batch_id
    ).delete()
    db.commit()
    
    alarms = db.query(Alarm).all()
    inspections = db.query(Inspection).all()
    work_orders = db.query(WorkOrder).all()
    
    pole_map = _group_by_pole(alarms, inspections, work_orders)
    pole_light_map = _group_by_pole_and_light(alarms, inspections, work_orders)
    
    pole_light_count = {pid: len(data["light_ids"]) for pid, data in pole_map.items()}
    
    matched_count = 0
    discrepancy_count = 0
    
    for key, data in pole_light_map.items():
        pole_id, light_id = key.split('||', 1)
        
        record_alarms = data["alarms"]
        record_inspections = data["inspections"]
        record_work_orders = data["work_orders"]
        
        if not record_alarms and not record_inspections and not record_work_orders:
            continue
        
        is_multi_light_pole = pole_light_count.get(pole_id, 1) > 1
        
        main_alarm = record_alarms[0] if record_alarms else None
        main_inspection = record_inspections[0] if record_inspections else None
        main_work_order = record_work_orders[0] if record_work_orders else None
        
        reconciliation_id = f"{batch_id}||{key}"
        rec_record = ReconciliationRecord(
            batch_id=batch_id,
            reconciliation_id=reconciliation_id,
            pole_id=pole_id,
            light_id=light_id,
            alarm_id=main_alarm.id if main_alarm else None,
            inspection_id=main_inspection.id if main_inspection else None,
            work_order_id=main_work_order.id if main_work_order else None,
            status=ReconciliationStatus.DISCREPANCY,
            review_status=ReviewStatus.PENDING
        )
        db.add(rec_record)
        db.flush()
        
        if is_multi_light_pole:
            _create_discrepancy(
                db, rec_record.id,
                DiscrepancyType.MULTI_LIGHT_SAME_POLE,
                f"同杆多灯场景: 灯杆 {pole_id} 下共有 {pole_light_count[pole_id]} 个灯具需要对账，本记录为 {light_id}，请结合同杆其他灯具记录综合判断",
                DataSource.ALARM
            )
        
        if len(record_alarms) > 1:
            _create_discrepancy(
                db, rec_record.id,
                DiscrepancyType.MULTI_LIGHT_SAME_POLE,
                f"同一灯具多条告警: 发现 {len(record_alarms)} 条告警记录关联此灯杆灯具",
                DataSource.ALARM
            )
        
        is_matched, discrepancies = _match_single_record(
            db, rec_record, main_alarm, main_inspection, main_work_order, batch_id
        )
        
        if is_matched and len(discrepancies) == 0:
            rec_record.status = ReconciliationStatus.MATCHED
            matched_count += 1
        else:
            discrepancy_count += 1
    
    total_records = matched_count + discrepancy_count
    batch.status = "completed"
    batch.total_records = total_records
    batch.matched_count = matched_count
    batch.discrepancy_count = discrepancy_count
    batch.reviewed_count = 0
    batch.completed_at = datetime.now()
    
    db.commit()
    
    records = db.query(ReconciliationRecord).filter(
        ReconciliationRecord.batch_id == batch_id
    ).all()
    
    pending_review = discrepancy_count
    
    return schemas.ReconciliationResult(
        batch_id=batch_id,
        total_records=total_records,
        matched_count=matched_count,
        discrepancy_count=discrepancy_count,
        pending_review=pending_review,
        records=records
    )


def _match_single_record(
    db: Session,
    rec_record: ReconciliationRecord,
    alarm: Optional[Alarm],
    inspection: Optional[Inspection],
    work_order: Optional[WorkOrder],
    batch_id: str
):
    """单条记录匹配"""
    discrepancies = []
    is_matched = True
    
    if not alarm:
        discrepancies.append(_create_discrepancy(
            db, rec_record.id,
            DiscrepancyType.MISSING_ALARM,
            "缺少对应的告警记录",
            DataSource.WORK_ORDER if work_order else DataSource.INSPECTION
        ))
        is_matched = False
    elif _check_false_alarm(alarm):
        discrepancies.append(_create_discrepancy(
            db, rec_record.id,
            DiscrepancyType.FALSE_ALARM,
            f"疑似误报: {alarm.false_alarm_reason or '告警描述包含误报特征'}",
            DataSource.ALARM
        ))
        is_matched = False
    
    if not inspection:
        discrepancies.append(_create_discrepancy(
            db, rec_record.id,
            DiscrepancyType.MISSING_INSPECTION,
            "缺少对应的人工巡查记录",
            DataSource.ALARM if alarm else DataSource.WORK_ORDER
        ))
        is_matched = False
    
    if not work_order:
        discrepancies.append(_create_discrepancy(
            db, rec_record.id,
            DiscrepancyType.MISSING_WORK_ORDER,
            "缺少对应的维修单记录",
            DataSource.ALARM if alarm else DataSource.INSPECTION
        ))
        is_matched = False
    elif _check_repair_retest(work_order):
        discrepancies.append(_create_discrepancy(
            db, rec_record.id,
            DiscrepancyType.REPAIR_RETEST,
            f"修复复测记录: 复测结果={work_order.retest_result or '未填写'}",
            DataSource.WORK_ORDER
        ))
    
    if alarm and inspection and work_order:
        time_diff_ai = abs((alarm.alarm_time - inspection.inspection_time).total_seconds())
        if time_diff_ai > TIME_WINDOW_HOURS * 3600:
            discrepancies.append(_create_discrepancy(
                db, rec_record.id,
                DiscrepancyType.TIME_MISMATCH,
                f"告警与巡查时间相差 {time_diff_ai/3600:.1f} 小时，超出 {TIME_WINDOW_HOURS} 小时窗口",
                DataSource.INSPECTION
            ))
            is_matched = False
        
        time_diff_aw = abs((alarm.alarm_time - work_order.report_time).total_seconds())
        if time_diff_aw > TIME_WINDOW_HOURS * 3600:
            discrepancies.append(_create_discrepancy(
                db, rec_record.id,
                DiscrepancyType.TIME_MISMATCH,
                f"告警与派单时间相差 {time_diff_aw/3600:.1f} 小时，超出 {TIME_WINDOW_HOURS} 小时窗口",
                DataSource.WORK_ORDER
            ))
            is_matched = False
    
    if alarm and work_order and alarm.status != '已修复' and work_order.status == '已完成':
        discrepancies.append(_create_discrepancy(
            db, rec_record.id,
            DiscrepancyType.STATUS_MISMATCH,
            f"状态不匹配: 告警状态={alarm.status}, 维修单状态={work_order.status}",
            DataSource.WORK_ORDER
        ))
        is_matched = False
    
    db.flush()
    return is_matched, discrepancies


def get_reconciliation_summary(db: Session, batch_id: str) -> dict:
    """获取对账汇总信息"""
    batch = db.query(ReconciliationBatch).filter(
        ReconciliationBatch.batch_id == batch_id
    ).first()
    
    if not batch:
        return None
    
    records = db.query(ReconciliationRecord).filter(
        ReconciliationRecord.batch_id == batch_id
    ).all()
    
    summary = {
        "batch_id": batch_id,
        "batch_name": batch.name,
        "created_at": batch.created_at,
        "total_records": len(records),
        "status": batch.status,
        "by_status": {
            "matched": 0,
            "discrepancy": 0,
            "reviewed": 0
        },
        "by_review_status": {
            "pending": 0,
            "approved": 0,
            "rejected": 0,
            "needs_more_info": 0
        },
        "discrepancy_types": {}
    }
    
    for record in records:
        summary["by_status"][record.status.value] += 1
        summary["by_review_status"][record.review_status.value] += 1
        
        for disc in record.discrepancies:
            dtype = disc.type.value
            if dtype not in summary["discrepancy_types"]:
                summary["discrepancy_types"][dtype] = {"count": 0, "resolved": 0}
            summary["discrepancy_types"][dtype]["count"] += 1
            if disc.is_resolved:
                summary["discrepancy_types"][dtype]["resolved"] += 1
    
    return summary


def get_reconciliation_records(
    db: Session, 
    batch_id: str, 
    status: Optional[ReconciliationStatus] = None,
    review_status: Optional[ReviewStatus] = None,
    skip: int = 0, 
    limit: int = 100
) -> List[ReconciliationRecord]:
    """获取对账记录列表"""
    query = db.query(ReconciliationRecord).filter(
        ReconciliationRecord.batch_id == batch_id
    )
    
    if status:
        query = query.filter(ReconciliationRecord.status == status)
    if review_status:
        query = query.filter(ReconciliationRecord.review_status == review_status)
    
    return query.offset(skip).limit(limit).all()


def get_reconciliation_record(db: Session, record_id: int) -> Optional[ReconciliationRecord]:
    """获取单条对账记录详情"""
    return db.query(ReconciliationRecord).filter(
        ReconciliationRecord.id == record_id
    ).first()


def review_record(db: Session, review_request: schemas.ReviewRequest) -> Optional[ReconciliationRecord]:
    """人工复核对账记录"""
    record = db.query(ReconciliationRecord).filter(
        ReconciliationRecord.id == review_request.record_id
    ).first()
    
    if not record:
        return None
    
    review_history = ReviewHistory(
        record_id=record.id,
        reviewer=review_request.reviewer,
        status=review_request.status,
        comment=review_request.comment,
        explanation=review_request.explanation
    )
    db.add(review_history)
    
    record.review_status = review_request.status
    record.status = ReconciliationStatus.REVIEWED
    
    for disc_id in review_request.resolve_discrepancies:
        discrepancy = db.query(Discrepancy).filter(
            Discrepancy.id == disc_id,
            Discrepancy.record_id == record.id
        ).first()
        if discrepancy:
            discrepancy.is_resolved = True
            discrepancy.resolved_reason = review_request.explanation
    
    _update_batch_counts(db, record.batch_id)
    
    db.commit()
    db.refresh(record)
    
    return record


def _update_batch_counts(db: Session, batch_id: str):
    """更新批次统计"""
    batch = db.query(ReconciliationBatch).filter(
        ReconciliationBatch.batch_id == batch_id
    ).first()
    
    if not batch:
        return
    
    records = db.query(ReconciliationRecord).filter(
        ReconciliationRecord.batch_id == batch_id
    ).all()
    
    reviewed = sum(1 for r in records if r.review_status != ReviewStatus.PENDING)
    batch.reviewed_count = reviewed
    
    db.commit()


def recalculate_reconciliation(db: Session, batch_id: str) -> schemas.ReconciliationResult:
    """重新计算对账结果"""
    return run_reconciliation(db, batch_id)


def trace_by_work_order(db: Session, order_id: str) -> Optional[schemas.TraceDetail]:
    """从维修单号追踪全链路信息"""
    work_order = db.query(WorkOrder).filter(
        WorkOrder.order_id == order_id
    ).first()
    
    if not work_order:
        return None
    
    record = db.query(ReconciliationRecord).filter(
        ReconciliationRecord.work_order_id == work_order.id
    ).first()
    
    if not record:
        return None
    
    return schemas.TraceDetail(
        record_id=record.id,
        reconciliation_id=record.reconciliation_id,
        batch_id=record.batch_id,
        pole_id=record.pole_id,
        light_id=record.light_id,
        status=record.status,
        review_status=record.review_status,
        alarm=record.alarm,
        inspection=record.inspection,
        work_order=record.work_order,
        discrepancies=record.discrepancies,
        review_histories=record.review_histories
    )


def trace_by_alarm(db: Session, alarm_id: str) -> Optional[schemas.TraceDetail]:
    """从告警ID追踪全链路信息"""
    alarm = db.query(Alarm).filter(
        Alarm.alarm_id == alarm_id
    ).first()
    
    if not alarm:
        return None
    
    record = db.query(ReconciliationRecord).filter(
        ReconciliationRecord.alarm_id == alarm.id
    ).first()
    
    if not record:
        return None
    
    return schemas.TraceDetail(
        record_id=record.id,
        reconciliation_id=record.reconciliation_id,
        batch_id=record.batch_id,
        pole_id=record.pole_id,
        light_id=record.light_id,
        status=record.status,
        review_status=record.review_status,
        alarm=record.alarm,
        inspection=record.inspection,
        work_order=record.work_order,
        discrepancies=record.discrepancies,
        review_histories=record.review_histories
    )
