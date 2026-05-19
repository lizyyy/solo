from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from .database import engine, get_db, Base
from .models import OfflineDevice, FormDraft, SyncBatch, FieldConflict, RollbackVersion, MergeDecision
from .schemas import (
    OfflineDeviceCreate, OfflineDeviceResponse,
    FormDraftCreate, FormDraftResponse, FormDraftUpdate,
    SyncBatchResponse, FieldConflictResponse,
    MergeDecisionResponse, RollbackVersionResponse,
    SyncRequest, ConflictResolution, ExportRequest
)
from .service import SyncService

Base.metadata.create_all(bind=engine)

app = FastAPI(title="离线表单同步 API", version="1.0.0")


@app.get("/", response_class=HTMLResponse)
async def root():
    with open("frontend/index.html", "r", encoding="utf-8") as f:
        return f.read()


@app.post("/api/devices", response_model=OfflineDeviceResponse)
def create_device(device: OfflineDeviceCreate, db: Session = Depends(get_db)):
    db_device = OfflineDevice(**device.model_dump())
    db.add(db_device)
    db.commit()
    db.refresh(db_device)
    return db_device


@app.get("/api/devices", response_model=List[OfflineDeviceResponse])
def list_devices(db: Session = Depends(get_db)):
    return db.query(OfflineDevice).all()


@app.post("/api/drafts", response_model=FormDraftResponse)
def create_draft(draft: FormDraftCreate, db: Session = Depends(get_db)):
    device = db.query(OfflineDevice).filter(OfflineDevice.id == draft.device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="设备不存在")
    
    db_draft = FormDraft(**draft.model_dump())
    db.add(db_draft)
    db.commit()
    db.refresh(db_draft)
    return db_draft


@app.get("/api/drafts", response_model=List[FormDraftResponse])
def list_drafts(status: Optional[str] = None, device_id: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(FormDraft)
    if status:
        query = query.filter(FormDraft.status == status)
    if device_id:
        query = query.filter(FormDraft.device_id == device_id)
    return query.all()


@app.get("/api/drafts/{draft_id}", response_model=FormDraftResponse)
def get_draft(draft_id: str, db: Session = Depends(get_db)):
    draft = db.query(FormDraft).filter(FormDraft.id == draft_id).first()
    if not draft:
        raise HTTPException(status_code=404, detail="草稿不存在")
    return draft


@app.put("/api/drafts/{draft_id}", response_model=FormDraftResponse)
def update_draft(draft_id: str, draft_update: FormDraftUpdate, db: Session = Depends(get_db)):
    draft = db.query(FormDraft).filter(FormDraft.id == draft_id).first()
    if not draft:
        raise HTTPException(status_code=404, detail="草稿不存在")
    
    update_data = draft_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(draft, key, value)
    
    db.commit()
    db.refresh(draft)
    return draft


@app.post("/api/sync")
def sync_drafts(sync_request: SyncRequest, db: Session = Depends(get_db)):
    service = SyncService(db)
    try:
        result = service.process_sync(sync_request)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/batches", response_model=List[SyncBatchResponse])
def list_batches(status: Optional[str] = None, device_id: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(SyncBatch)
    if status:
        query = query.filter(SyncBatch.status == status)
    if device_id:
        query = query.filter(SyncBatch.device_id == device_id)
    return query.all()


@app.get("/api/batches/{batch_id}", response_model=SyncBatchResponse)
def get_batch(batch_id: str, db: Session = Depends(get_db)):
    batch = db.query(SyncBatch).filter(SyncBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    return batch


@app.get("/api/conflicts", response_model=List[FieldConflictResponse])
def list_conflicts(resolved: Optional[bool] = None, batch_id: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(FieldConflict)
    if resolved is not None:
        query = query.filter(FieldConflict.resolved == resolved)
    if batch_id:
        query = query.filter(FieldConflict.batch_id == batch_id)
    return query.all()


@app.post("/api/conflicts/resolve")
def resolve_conflict(resolution: ConflictResolution, db: Session = Depends(get_db)):
    service = SyncService(db)
    try:
        result = service.resolve_conflict(resolution)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/api/conflicts/{conflict_id}", response_model=FieldConflictResponse)
def get_conflict(conflict_id: str, db: Session = Depends(get_db)):
    conflict = db.query(FieldConflict).filter(FieldConflict.id == conflict_id).first()
    if not conflict:
        raise HTTPException(status_code=404, detail="冲突不存在")
    return conflict


@app.get("/api/drafts/{draft_id}/rollbacks", response_model=List[RollbackVersionResponse])
def list_rollbacks(draft_id: str, db: Session = Depends(get_db)):
    return db.query(RollbackVersion).filter(RollbackVersion.draft_id == draft_id).all()


@app.post("/api/drafts/{draft_id}/rollback/{rollback_id}")
def rollback_draft(draft_id: str, rollback_id: str, user: str = "admin", db: Session = Depends(get_db)):
    service = SyncService(db)
    try:
        result = service.rollback_draft(draft_id, rollback_id, user)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/api/decisions", response_model=List[MergeDecisionResponse])
def list_decisions(db: Session = Depends(get_db)):
    return db.query(MergeDecision).all()


@app.post("/api/export")
def export_data(export_request: ExportRequest, db: Session = Depends(get_db)):
    service = SyncService(db)
    result = service.export_batch_data(
        batch_id=export_request.batch_id,
        status=export_request.status
    )
    return JSONResponse(content=result)


@app.post("/api/sample-data")
def create_sample_data(db: Session = Depends(get_db)):
    db.query(FieldConflict).delete()
    db.query(MergeDecision).delete()
    db.query(RollbackVersion).delete()
    db.query(FormDraft).delete()
    db.query(SyncBatch).delete()
    db.query(OfflineDevice).delete()
    db.commit()

    device1 = OfflineDevice(device_name="现场平板-001", device_type="tablet")
    device2 = OfflineDevice(device_name="现场手机-002", device_type="mobile")
    db.add_all([device1, device2])
    db.flush()

    draft_server = FormDraft(
        form_type="安全检查",
        form_data={"检查地点": "B车间", "检查人": "王五", "安全评分": 85, "备注": "已整改"},
        version=2,
        device_id=device1.id,
        status="synced",
        created_by="王五"
    )
    db.add(draft_server)
    db.flush()

    rollback1 = RollbackVersion(
        draft_id=draft_server.id,
        version_number=1,
        form_data_snapshot={"检查地点": "B车间", "检查人": "王五", "安全评分": 80, "备注": "有消防隐患"},
        rollback_reason="初始版本记录",
        rolled_back_by="system"
    )
    db.add(rollback1)

    batch1 = SyncBatch(
        device_id=device1.id,
        batch_number="BATCH-20240115100000-abc123",
        status="completed",
        total_items=1,
        success_count=1,
        conflict_count=0,
        started_at=datetime.now(),
        completed_at=datetime.now()
    )
    db.add(batch1)
    db.flush()

    draft2 = FormDraft(
        form_type="设备巡检",
        form_data={"设备编号": "DEV-001", "巡检人": "李四", "运行状态": "异常", "温度": 85},
        version=1,
        device_id=device2.id,
        status="synced",
        created_by="李四",
        sync_batch_id=batch1.id
    )
    db.add(draft2)
    db.flush()

    batch2 = SyncBatch(
        device_id=device1.id,
        batch_number="BATCH-20240115143000-def456",
        status="has_conflicts",
        total_items=2,
        success_count=1,
        conflict_count=1,
        started_at=datetime.now(),
        completed_at=datetime.now()
    )
    db.add(batch2)
    db.flush()

    draft3 = FormDraft(
        form_type="安全检查",
        form_data={"检查地点": "B车间", "检查人": "王五", "安全评分": 80, "备注": "有消防隐患"},
        version=1,
        device_id=device1.id,
        status="conflict",
        created_by="王五",
        sync_batch_id=batch2.id
    )
    db.add(draft3)
    db.flush()

    conflict1 = FieldConflict(
        draft_id=draft3.id,
        batch_id=batch2.id,
        field_name="安全评分",
        server_value=85,
        client_value=80,
        base_version=1,
        server_version=2,
        client_version=1,
        resolved=False,
        conflict_description="安全评分值冲突: 服务端='85', 客户端='80'"
    )
    conflict2 = FieldConflict(
        draft_id=draft3.id,
        batch_id=batch2.id,
        field_name="备注",
        server_value="已整改",
        client_value="有消防隐患",
        base_version=1,
        server_version=2,
        client_version=1,
        resolved=False,
        conflict_description="备注值冲突: 服务端='已整改', 客户端='有消防隐患'"
    )
    db.add_all([conflict1, conflict2])

    draft4 = FormDraft(
        form_type="设备巡检",
        form_data={"设备编号": "DEV-002", "巡检人": "赵六", "运行状态": "正常", "温度": 65},
        version=1,
        device_id=device1.id,
        status="synced",
        created_by="赵六",
        sync_batch_id=batch2.id
    )
    db.add(draft4)

    db.commit()

    return {
        "message": "样例数据创建成功",
        "devices": 2,
        "drafts": 4,
        "batches": 2,
        "conflicts": 2
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
