from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Project, LoadTestBatch, MonitoringSnapshot
from app.schemas import (
    MonitoringSnapshot as MonitoringSnapshotSchema,
    MonitoringSnapshotCreate,
    MonitoringSnapshotUpdate,
    MonitoringSnapshotList,
    MonitoringSnapshotImportRequest,
)

router = APIRouter(prefix="/monitoring-snapshots", tags=["Monitoring Snapshots"])


@router.post("/", response_model=MonitoringSnapshotSchema, status_code=201)
def create_monitoring_snapshot(
    snapshot: MonitoringSnapshotCreate,
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(Project.id == snapshot.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    if snapshot.load_test_batch_id:
        batch = db.query(LoadTestBatch).filter(
            LoadTestBatch.id == snapshot.load_test_batch_id
        ).first()
        if not batch:
            raise HTTPException(status_code=404, detail="压测批次不存在")
    
    db_snapshot = MonitoringSnapshot(
        project_id=snapshot.project_id,
        load_test_batch_id=snapshot.load_test_batch_id,
        name=snapshot.name,
        snapshot_type=snapshot.snapshot_type,
        snapshot_time=snapshot.snapshot_time,
        cpu_utilization_percent=snapshot.cpu_utilization_percent,
        memory_utilization_percent=snapshot.memory_utilization_percent,
        disk_utilization_percent=snapshot.disk_utilization_percent,
        network_utilization_percent=snapshot.network_utilization_percent,
        gc_count=snapshot.gc_count,
        gc_time_ms=snapshot.gc_time_ms,
        database_connections=snapshot.database_connections,
        database_query_latency_ms=snapshot.database_query_latency_ms,
        cache_hit_rate=snapshot.cache_hit_rate,
        thread_count=snapshot.thread_count,
        deadlock_count=snapshot.deadlock_count,
        custom_metrics=snapshot.custom_metrics,
        notes=snapshot.notes,
    )
    db.add(db_snapshot)
    db.commit()
    db.refresh(db_snapshot)
    return db_snapshot


@router.get("/", response_model=MonitoringSnapshotList)
def list_monitoring_snapshots(
    project_id: Optional[int] = Query(None, ge=1),
    load_test_batch_id: Optional[int] = Query(None, ge=1),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    snapshot_type: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(MonitoringSnapshot)
    
    if project_id:
        query = query.filter(MonitoringSnapshot.project_id == project_id)
    
    if load_test_batch_id:
        query = query.filter(MonitoringSnapshot.load_test_batch_id == load_test_batch_id)
    
    if snapshot_type:
        query = query.filter(MonitoringSnapshot.snapshot_type == snapshot_type)
    
    total = query.count()
    snapshots = query.order_by(
        MonitoringSnapshot.snapshot_time.desc()
    ).offset(skip).limit(limit).all()
    
    return MonitoringSnapshotList(
        total=total,
        items=snapshots,
        page=skip // limit + 1,
        page_size=limit,
    )


@router.get("/{snapshot_id}", response_model=MonitoringSnapshotSchema)
def get_monitoring_snapshot(snapshot_id: int, db: Session = Depends(get_db)):
    snapshot = db.query(MonitoringSnapshot).filter(
        MonitoringSnapshot.id == snapshot_id
    ).first()
    if not snapshot:
        raise HTTPException(status_code=404, detail="监控快照不存在")
    return snapshot


@router.put("/{snapshot_id}", response_model=MonitoringSnapshotSchema)
def update_monitoring_snapshot(
    snapshot_id: int,
    snapshot_update: MonitoringSnapshotUpdate,
    db: Session = Depends(get_db),
):
    snapshot = db.query(MonitoringSnapshot).filter(
        MonitoringSnapshot.id == snapshot_id
    ).first()
    if not snapshot:
        raise HTTPException(status_code=404, detail="监控快照不存在")
    
    update_data = snapshot_update.model_dump(exclude_unset=True)
    
    for key, value in update_data.items():
        if hasattr(snapshot, key):
            setattr(snapshot, key, value)
    
    db.commit()
    db.refresh(snapshot)
    return snapshot


@router.delete("/{snapshot_id}", status_code=204)
def delete_monitoring_snapshot(snapshot_id: int, db: Session = Depends(get_db)):
    snapshot = db.query(MonitoringSnapshot).filter(
        MonitoringSnapshot.id == snapshot_id
    ).first()
    if not snapshot:
        raise HTTPException(status_code=404, detail="监控快照不存在")
    
    db.delete(snapshot)
    db.commit()


@router.post("/import")
def import_monitoring_snapshots(
    import_request: MonitoringSnapshotImportRequest,
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(Project.id == import_request.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    if import_request.load_test_batch_id:
        batch = db.query(LoadTestBatch).filter(
            LoadTestBatch.id == import_request.load_test_batch_id
        ).first()
        if not batch:
            raise HTTPException(status_code=404, detail="压测批次不存在")
    
    created = 0
    errors = []
    
    for i, snapshot_data in enumerate(import_request.snapshots):
        try:
            db_snapshot = MonitoringSnapshot(
                project_id=import_request.project_id,
                load_test_batch_id=import_request.load_test_batch_id,
                name=snapshot_data.name,
                snapshot_type=snapshot_data.snapshot_type,
                snapshot_time=snapshot_data.snapshot_time,
                cpu_utilization_percent=snapshot_data.cpu_utilization_percent,
                memory_utilization_percent=snapshot_data.memory_utilization_percent,
                disk_utilization_percent=snapshot_data.disk_utilization_percent,
                network_utilization_percent=snapshot_data.network_utilization_percent,
                gc_count=snapshot_data.gc_count,
                gc_time_ms=snapshot_data.gc_time_ms,
                database_connections=snapshot_data.database_connections,
                database_query_latency_ms=snapshot_data.database_query_latency_ms,
                cache_hit_rate=snapshot_data.cache_hit_rate,
                thread_count=snapshot_data.thread_count,
                deadlock_count=snapshot_data.deadlock_count,
                custom_metrics=snapshot_data.custom_metrics,
                notes=snapshot_data.notes,
            )
            db.add(db_snapshot)
            db.commit()
            created += 1
        except Exception as e:
            errors.append(f"第 {i+1} 个快照导入失败: {str(e)}")
            db.rollback()
    
    return {
        "success": len(errors) == 0,
        "total": len(import_request.snapshots),
        "created": created,
        "errors": errors,
    }
