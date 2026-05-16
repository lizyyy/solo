from datetime import datetime
from typing import List, Optional
from sqlalchemy.orm import Session

from app import models, schemas
from app.models import TaskStatus, RiskType, FailureType


def create_task(db: Session, task: schemas.QuotaRecycleTaskCreate) -> models.QuotaRecycleTask:
    db_task = models.QuotaRecycleTask(**task.dict())
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task


def get_task(db: Session, task_id: int) -> Optional[models.QuotaRecycleTask]:
    return db.query(models.QuotaRecycleTask).filter(models.QuotaRecycleTask.id == task_id).first()


def get_task_by_batch_no(db: Session, batch_no: str) -> Optional[models.QuotaRecycleTask]:
    return db.query(models.QuotaRecycleTask).filter(models.QuotaRecycleTask.batch_no == batch_no).first()


def get_tasks(
    db: Session,
    batch_no: Optional[str] = None,
    operator: Optional[str] = None,
    risk_type: Optional[RiskType] = None,
    status: Optional[TaskStatus] = None,
    has_failures: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100
) -> List[models.QuotaRecycleTask]:
    query = db.query(models.QuotaRecycleTask)
    
    if batch_no:
        query = query.filter(models.QuotaRecycleTask.batch_no.contains(batch_no))
    if operator:
        query = query.filter(models.QuotaRecycleTask.operator == operator)
    if risk_type:
        query = query.filter(models.QuotaRecycleTask.risk_type == risk_type)
    if status:
        query = query.filter(models.QuotaRecycleTask.status == status)
    if has_failures is not None:
        if has_failures:
            query = query.filter(models.QuotaRecycleTask.failed_count > 0)
        else:
            query = query.filter(models.QuotaRecycleTask.failed_count == 0)
    
    return query.order_by(models.QuotaRecycleTask.created_at.desc()).offset(skip).limit(limit).all()


def update_task_status(db: Session, task_id: int, status: TaskStatus) -> Optional[models.QuotaRecycleTask]:
    db_task = get_task(db, task_id)
    if db_task:
        db_task.status = status
        db_task.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(db_task)
    return db_task


def update_task_stats(db: Session, task_id: int, success_count: int, failed_count: int, actual_recycled: float):
    db_task = get_task(db, task_id)
    if db_task:
        db_task.success_count = success_count
        db_task.failed_count = failed_count
        db_task.actual_recycled_quota = actual_recycled
        
        if failed_count == 0 and success_count > 0:
            db_task.status = TaskStatus.COMPLETED
        elif failed_count > 0 and success_count > 0:
            db_task.status = TaskStatus.PARTIAL_FAILED
        elif failed_count > 0 and success_count == 0:
            db_task.status = TaskStatus.FAILED
        
        db_task.updated_at = datetime.utcnow()
        db.commit()


def create_failed_item(db: Session, item: schemas.FailedItemCreate) -> models.FailedItem:
    db_item = models.FailedItem(**item.dict())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item


def get_failed_items(
    db: Session,
    task_id: Optional[int] = None,
    failure_type: Optional[FailureType] = None,
    tenant_id: Optional[str] = None,
    resolved: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100
) -> List[models.FailedItem]:
    query = db.query(models.FailedItem)
    
    if task_id:
        query = query.filter(models.FailedItem.task_id == task_id)
    if failure_type:
        query = query.filter(models.FailedItem.failure_type == failure_type)
    if tenant_id:
        query = query.filter(models.FailedItem.tenant_id == tenant_id)
    if resolved is not None:
        query = query.filter(models.FailedItem.resolved == resolved)
    
    return query.order_by(models.FailedItem.created_at.desc()).offset(skip).limit(limit).all()


def resolve_failed_item(db: Session, item_id: int, resolved_by: str, resolution_note: Optional[str] = None) -> Optional[models.FailedItem]:
    db_item = db.query(models.FailedItem).filter(models.FailedItem.id == item_id).first()
    if db_item:
        db_item.resolved = True
        db_item.resolved_by = resolved_by
        db_item.resolved_at = datetime.utcnow()
        db_item.resolution_note = resolution_note
        db.commit()
        db.refresh(db_item)
    return db_item


def create_recycle_detail(db: Session, detail: schemas.RecycleDetailCreate) -> models.RecycleDetail:
    db_detail = models.RecycleDetail(**detail.dict())
    db.add(db_detail)
    db.commit()
    db.refresh(db_detail)
    return db_detail


def get_recycle_details_by_task(db: Session, task_id: int) -> List[models.RecycleDetail]:
    return db.query(models.RecycleDetail).filter(models.RecycleDetail.task_id == task_id).all()


def get_recycle_details_by_tenant(db: Session, tenant_id: str) -> List[models.RecycleDetail]:
    return db.query(models.RecycleDetail).filter(models.RecycleDetail.tenant_id == tenant_id).order_by(
        models.RecycleDetail.created_at.desc()
    ).all()


def create_lakehouse_partition(db: Session, partition: schemas.LakehousePartitionCreate) -> models.LakehousePartition:
    db_partition = models.LakehousePartition(**partition.dict())
    db.add(db_partition)
    db.commit()
    db.refresh(db_partition)
    return db_partition


def get_lakehouse_partitions(
    db: Session,
    manually_confirmed: Optional[bool] = None,
    task_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100
) -> List[models.LakehousePartition]:
    query = db.query(models.LakehousePartition)
    
    if manually_confirmed is not None:
        query = query.filter(models.LakehousePartition.manually_confirmed == manually_confirmed)
    if task_id:
        query = query.filter(models.LakehousePartition.task_id == task_id)
    
    return query.order_by(models.LakehousePartition.created_at.desc()).offset(skip).limit(limit).all()


def confirm_lakehouse_partition(
    db: Session,
    partition_id: int,
    confirmed_by: str,
    confirmation_note: Optional[str] = None
) -> Optional[models.LakehousePartition]:
    db_partition = db.query(models.LakehousePartition).filter(models.LakehousePartition.id == partition_id).first()
    if db_partition:
        db_partition.manually_confirmed = True
        db_partition.confirmed_by = confirmed_by
        db_partition.confirmed_at = datetime.utcnow()
        db_partition.confirmation_note = confirmation_note
        db.commit()
        db.refresh(db_partition)
    return db_partition


def get_recycle_summary(db: Session) -> schemas.RecycleSummary:
    total_recycled = db.query(models.RecycleDetail.recycled_quota).all()
    total_recycled_quota = sum(item[0] for item in total_recycled) if total_recycled else 0.0
    
    total_tenants = db.query(models.RecycleDetail.tenant_id).distinct().count()
    total_tasks = db.query(models.QuotaRecycleTask).count()
    
    failed_tasks = db.query(models.QuotaRecycleTask).filter(
        models.QuotaRecycleTask.status.in_([TaskStatus.FAILED, TaskStatus.PARTIAL_FAILED])
    ).count()
    
    return schemas.RecycleSummary(
        total_recycled_quota=total_recycled_quota,
        total_tenants=total_tenants,
        total_tasks=total_tasks,
        failed_tasks_count=failed_tasks
    )


def get_failure_statistics(db: Session):
    failures = db.query(
        models.FailedItem.failure_type,
        models.FailedItem.resolved,
        models.FailedItem.id
    ).all()
    
    stats = {}
    for f_type in FailureType:
        stats[f_type.value] = {
            "total": 0,
            "resolved": 0,
            "unresolved": 0
        }
    
    for failure in failures:
        f_type = failure.failure_type.value
        stats[f_type]["total"] += 1
        if failure.resolved:
            stats[f_type]["resolved"] += 1
        else:
            stats[f_type]["unresolved"] += 1
    
    return stats
