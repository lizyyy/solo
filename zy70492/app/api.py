from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app import models, schemas, crud
from app.database import get_db
from app.services import QuotaRecycleService

router = APIRouter()


@router.post("/tasks/", response_model=schemas.QuotaRecycleTask)
def create_task(
    task: schemas.QuotaRecycleTaskCreate,
    db: Session = Depends(get_db)
):
    existing_task = crud.get_task_by_batch_no(db, task.batch_no)
    if existing_task:
        raise HTTPException(status_code=400, detail="批次号已存在")
    return crud.create_task(db=db, task=task)


@router.get("/tasks/", response_model=List[schemas.QuotaRecycleTask])
def read_tasks(
    batch_no: Optional[str] = None,
    operator: Optional[str] = None,
    risk_type: Optional[models.RiskType] = None,
    status: Optional[models.TaskStatus] = None,
    has_failures: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    tasks = crud.get_tasks(
        db,
        batch_no=batch_no,
        operator=operator,
        risk_type=risk_type,
        status=status,
        has_failures=has_failures,
        skip=skip,
        limit=limit
    )
    return tasks


@router.get("/tasks/{task_id}", response_model=schemas.QuotaRecycleTaskWithDetails)
def read_task(task_id: int, db: Session = Depends(get_db)):
    task = crud.get_task(db, task_id=task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="任务不存在")
    return task


@router.post("/tasks/{task_id}/execute", response_model=schemas.QuotaRecycleTask)
async def execute_task(task_id: int, db: Session = Depends(get_db)):
    task = crud.get_task(db, task_id=task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    service = QuotaRecycleService(db)
    try:
        result = await service.execute_recycle_task(task_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/failed-items/", response_model=List[schemas.FailedItem])
def read_failed_items(
    task_id: Optional[int] = None,
    failure_type: Optional[models.FailureType] = None,
    tenant_id: Optional[str] = None,
    resolved: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    items = crud.get_failed_items(
        db,
        task_id=task_id,
        failure_type=failure_type,
        tenant_id=tenant_id,
        resolved=resolved,
        skip=skip,
        limit=limit
    )
    return items


@router.put("/failed-items/{item_id}/resolve", response_model=schemas.FailedItem)
def resolve_failed_item(
    item_id: int,
    resolved_by: str,
    resolution_note: Optional[str] = None,
    db: Session = Depends(get_db)
):
    item = crud.resolve_failed_item(db, item_id=item_id, resolved_by=resolved_by, resolution_note=resolution_note)
    if item is None:
        raise HTTPException(status_code=404, detail="失败项不存在")
    return item


@router.get("/recycle-details/", response_model=List[schemas.RecycleDetail])
def read_recycle_details(
    task_id: Optional[int] = Query(None, description="按任务ID过滤"),
    tenant_id: Optional[str] = Query(None, description="按租户ID过滤"),
    db: Session = Depends(get_db)
):
    if task_id:
        return crud.get_recycle_details_by_task(db, task_id=task_id)
    elif tenant_id:
        return crud.get_recycle_details_by_tenant(db, tenant_id=tenant_id)
    else:
        raise HTTPException(status_code=400, detail="必须提供task_id或tenant_id参数")


@router.post("/lakehouse-partitions/", response_model=schemas.LakehousePartition)
def create_partition(
    partition: schemas.LakehousePartitionCreate,
    db: Session = Depends(get_db)
):
    return crud.create_lakehouse_partition(db=db, partition=partition)


@router.get("/lakehouse-partitions/", response_model=List[schemas.LakehousePartition])
def read_partitions(
    manually_confirmed: Optional[bool] = None,
    task_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    return crud.get_lakehouse_partitions(
        db,
        manually_confirmed=manually_confirmed,
        task_id=task_id,
        skip=skip,
        limit=limit
    )


@router.put("/lakehouse-partitions/{partition_id}/confirm", response_model=schemas.LakehousePartition)
def confirm_partition(
    partition_id: int,
    confirmed_by: str,
    confirmation_note: Optional[str] = None,
    db: Session = Depends(get_db)
):
    partition = crud.confirm_lakehouse_partition(
        db,
        partition_id=partition_id,
        confirmed_by=confirmed_by,
        confirmation_note=confirmation_note
    )
    if partition is None:
        raise HTTPException(status_code=404, detail="分区不存在")
    return partition


@router.get("/summary/", response_model=schemas.RecycleSummary)
def get_summary(db: Session = Depends(get_db)):
    return crud.get_recycle_summary(db)


@router.get("/statistics/failures/")
def get_failure_statistics(db: Session = Depends(get_db)):
    return crud.get_failure_statistics(db)
