from fastapi import FastAPI, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import List, Optional
import json
import io
import pandas as pd

from .database import engine, get_db, Base
from . import models, schemas
from .models import SyncStatusEnum, ConflictStatusEnum

Base.metadata.create_all(bind=engine)

app = FastAPI(title="边缘节点配置同步 API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def check_idempotent(request_key: str, request_type: str, db: Session):
    existing = db.query(models.IdempotentRequest).filter(
        models.IdempotentRequest.request_key == request_key
    ).first()
    if existing:
        return json.loads(existing.response_data)
    return None


def save_idempotent(request_key: str, request_type: str, response_data: dict, db: Session):
    idempotent = models.IdempotentRequest(
        request_key=request_key,
        request_type=request_type,
        response_data=json.dumps(response_data)
    )
    db.add(idempotent)
    db.commit()


def create_audit_log(sync_status_id: int, action: str, operator: str, detail: str, db: Session):
    audit = models.SyncAudit(
        sync_status_id=sync_status_id,
        action=action,
        operator=operator,
        detail=detail
    )
    db.add(audit)
    db.commit()


@app.get("/api/node-groups", response_model=List[schemas.NodeGroupResponse])
def get_node_groups(db: Session = Depends(get_db)):
    return db.query(models.NodeGroup).all()


@app.post("/api/node-groups", response_model=schemas.NodeGroupResponse)
def create_node_group(group: schemas.NodeGroupCreate, db: Session = Depends(get_db)):
    db_group = models.NodeGroup(**group.model_dump())
    db.add(db_group)
    db.commit()
    db.refresh(db_group)
    return db_group


@app.get("/api/node-groups/{group_id}/config-versions", response_model=List[schemas.ConfigVersionResponse])
def get_config_versions(group_id: int, db: Session = Depends(get_db)):
    return db.query(models.ConfigVersion).filter(
        models.ConfigVersion.node_group_id == group_id
    ).order_by(models.ConfigVersion.created_at.desc()).all()


@app.post("/api/config-versions", response_model=schemas.ConfigVersionResponse)
def create_config_version(version: schemas.ConfigVersionCreate, db: Session = Depends(get_db)):
    db_version = models.ConfigVersion(**version.model_dump())
    db.add(db_version)
    db.commit()
    db.refresh(db_version)
    return db_version


@app.get("/api/sync-statuses", response_model=List[schemas.SyncStatusDetailResponse])
def get_sync_statuses(group_id: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(models.SyncStatus)
    if group_id:
        query = query.filter(models.SyncStatus.node_group_id == group_id)
    return query.order_by(models.SyncStatus.started_at.desc()).all()


@app.get("/api/sync-statuses/{sync_id}", response_model=schemas.SyncStatusDetailResponse)
def get_sync_status(sync_id: int, db: Session = Depends(get_db)):
    sync_status = db.query(models.SyncStatus).filter(models.SyncStatus.id == sync_id).first()
    if not sync_status:
        raise HTTPException(status_code=404, detail="同步记录不存在")
    return sync_status


@app.post("/api/sync/create")
def create_sync(request: schemas.SyncCreateRequest, db: Session = Depends(get_db)):
    request_key = f"create_sync_{request.request_id}"
    cached = check_idempotent(request_key, "create_sync", db)
    if cached:
        return {"message": "请求已处理", "data": cached, "idempotent": True}

    node_group = db.query(models.NodeGroup).filter(
        models.NodeGroup.id == request.node_group_id
    ).first()
    if not node_group:
        raise HTTPException(status_code=404, detail="节点分组不存在")

    config_version = db.query(models.ConfigVersion).filter(
        models.ConfigVersion.id == request.config_version_id
    ).first()
    if not config_version:
        raise HTTPException(status_code=404, detail="配置版本不存在")

    sync_status = models.SyncStatus(
        request_id=request.request_id,
        node_group_id=request.node_group_id,
        config_version_id=request.config_version_id,
        status=SyncStatusEnum.PENDING,
        total_nodes=node_group.node_count,
        created_by=request.created_by
    )
    db.add(sync_status)
    db.flush()

    create_audit_log(sync_status.id, "创建同步任务", request.created_by,
                     f"分组: {node_group.name}, 版本: {config_version.version}", db)

    offline_count = min(3, node_group.node_count)
    for i in range(offline_count):
        offline_node = models.OfflineNode(
            sync_status_id=sync_status.id,
            node_name=f"edge-node-{i + 1:03d}",
            node_ip=f"192.168.1.{100 + i}",
            last_seen=datetime.utcnow() - timedelta(hours=i + 1)
        )
        db.add(offline_node)

    if node_group.node_count > 1:
        conflict = models.ConflictResolution(
            sync_status_id=sync_status.id,
            node_name="edge-node-001",
            current_version="v1.0.0",
            target_version=config_version.version,
            conflict_detail="本地配置与目标配置存在差异: CDN缓存策略冲突"
        )
        db.add(conflict)

    sync_status.status = SyncStatusEnum.SYNCING
    sync_status.offline_nodes = offline_count
    sync_status.success_nodes = max(0, node_group.node_count - offline_count - 1)
    sync_status.failed_nodes = 0 if node_group.node_count <= 1 else 1

    if sync_status.offline_nodes > 0:
        sync_status.status = SyncStatusEnum.OFFLINE
    elif sync_status.failed_nodes > 0:
        sync_status.status = SyncStatusEnum.CONFLICT

    db.commit()
    db.refresh(sync_status)

    response_data = schemas.SyncStatusDetailResponse.model_validate(sync_status).model_dump()
    save_idempotent(request_key, "create_sync", response_data, db)

    return {"message": "同步任务创建成功", "data": response_data, "idempotent": False}


@app.post("/api/sync/{sync_id}/intercept")
def intercept_sync(sync_id: int, request: schemas.SyncInterceptRequest, db: Session = Depends(get_db)):
    sync_status = db.query(models.SyncStatus).filter(models.SyncStatus.id == sync_id).first()
    if not sync_status:
        raise HTTPException(status_code=404, detail="同步记录不存在")

    if sync_status.status not in [SyncStatusEnum.PENDING, SyncStatusEnum.SYNCING]:
        raise HTTPException(status_code=400, detail="当前状态不支持拦截")

    sync_status.status = SyncStatusEnum.FAILED
    sync_status.completed_at = datetime.utcnow()

    create_audit_log(sync_id, "拦截同步任务", request.operator, request.reason, db)

    db.commit()
    db.refresh(sync_status)

    return {"message": "同步任务已拦截", "data": schemas.SyncStatusDetailResponse.model_validate(sync_status)}


@app.post("/api/sync/{sync_id}/correct")
def correct_sync(sync_id: int, request: schemas.SyncCorrectRequest, db: Session = Depends(get_db)):
    sync_status = db.query(models.SyncStatus).filter(models.SyncStatus.id == sync_id).first()
    if not sync_status:
        raise HTTPException(status_code=404, detail="同步记录不存在")

    for offline_node in sync_status.offline_node_list:
        if not offline_node.is_resolved:
            offline_node.is_resolved = True
            offline_node.resolved_at = datetime.utcnow()
            sync_status.offline_nodes -= 1
            sync_status.success_nodes += 1

    if sync_status.offline_nodes == 0 and sync_status.failed_nodes == 0:
        sync_status.status = SyncStatusEnum.SUCCESS
        sync_status.completed_at = datetime.utcnow()

    create_audit_log(sync_id, "修正同步状态", request.operator,
                     request.correct_detail or "标记离线节点为已解决", db)

    db.commit()
    db.refresh(sync_status)

    return {"message": "同步状态已修正", "data": schemas.SyncStatusDetailResponse.model_validate(sync_status)}


@app.post("/api/sync/{sync_id}/rollback")
def rollback_sync(sync_id: int, request: schemas.RollbackRequest, db: Session = Depends(get_db)):
    request_key = f"rollback_sync_{request.request_id}"
    cached = check_idempotent(request_key, "rollback_sync", db)
    if cached:
        return {"message": "回滚请求已处理", "data": cached, "idempotent": True}

    current_sync = db.query(models.SyncStatus).filter(models.SyncStatus.id == sync_id).first()
    if not current_sync:
        raise HTTPException(status_code=404, detail="同步记录不存在")

    target_version = db.query(models.ConfigVersion).filter(
        models.ConfigVersion.id == request.target_version_id
    ).first()
    if not target_version:
        raise HTTPException(status_code=404, detail="目标配置版本不存在")

    rollback_sync_status = models.SyncStatus(
        request_id=request.request_id,
        node_group_id=current_sync.node_group_id,
        config_version_id=request.target_version_id,
        status=SyncStatusEnum.PENDING,
        total_nodes=current_sync.total_nodes,
        created_by=request.operator
    )
    db.add(rollback_sync_status)
    db.flush()

    create_audit_log(rollback_sync_status.id, "回滚配置", request.operator,
                     f"从版本 {current_sync.config_version.version} 回滚到 {target_version.version}", db)

    rollback_sync_status.status = SyncStatusEnum.SUCCESS
    rollback_sync_status.success_nodes = current_sync.total_nodes
    rollback_sync_status.completed_at = datetime.utcnow()

    db.commit()
    db.refresh(rollback_sync_status)

    response_data = schemas.SyncStatusDetailResponse.model_validate(rollback_sync_status).model_dump()
    save_idempotent(request_key, "rollback_sync", response_data, db)

    return {"message": "配置回滚成功", "data": response_data, "idempotent": False}


@app.post("/api/conflicts/{conflict_id}/resolve")
def resolve_conflict(conflict_id: int, request: schemas.ConflictResolveRequest, db: Session = Depends(get_db)):
    conflict = db.query(models.ConflictResolution).filter(models.ConflictResolution.id == conflict_id).first()
    if not conflict:
        raise HTTPException(status_code=404, detail="冲突记录不存在")

    conflict.status = ConflictStatusEnum.RESOLVED
    conflict.resolution = request.resolution
    conflict.resolved_by = request.resolved_by
    conflict.resolved_at = datetime.utcnow()

    sync_status = db.query(models.SyncStatus).filter(models.SyncStatus.id == conflict.sync_status_id).first()
    if sync_status:
        sync_status.failed_nodes -= 1
        sync_status.success_nodes += 1
        if sync_status.offline_nodes == 0 and sync_status.failed_nodes == 0:
            sync_status.status = SyncStatusEnum.SUCCESS
            sync_status.completed_at = datetime.utcnow()

    create_audit_log(conflict.sync_status_id, "解决配置冲突", request.resolved_by,
                     f"节点: {conflict.node_name}, 解决方式: {request.resolution}", db)

    db.commit()
    db.refresh(conflict)

    return {"message": "冲突已解决", "data": schemas.ConflictResolutionResponse.model_validate(conflict)}


@app.get("/api/export/sync/{sync_id}")
def export_sync_report(sync_id: int, db: Session = Depends(get_db)):
    sync_status = db.query(models.SyncStatus).filter(models.SyncStatus.id == sync_id).first()
    if not sync_status:
        raise HTTPException(status_code=404, detail="同步记录不存在")

    data = {
        "同步任务ID": [sync_status.request_id],
        "节点分组": [sync_status.node_group.name if sync_status.node_group else ""],
        "配置版本": [sync_status.config_version.version if sync_status.config_version else ""],
        "同步状态": [sync_status.status.value],
        "总节点数": [sync_status.total_nodes],
        "成功节点": [sync_status.success_nodes],
        "失败节点": [sync_status.failed_nodes],
        "离线节点": [sync_status.offline_nodes],
        "创建人": [sync_status.created_by],
        "开始时间": [sync_status.started_at.strftime("%Y-%m-%d %H:%M:%S")],
        "完成时间": [sync_status.completed_at.strftime("%Y-%m-%d %H:%M:%S") if sync_status.completed_at else ""],
    }

    df = pd.DataFrame(data)

    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, sheet_name="同步概览", index=False)

        if sync_status.offline_node_list:
            offline_data = []
            for node in sync_status.offline_node_list:
                offline_data.append({
                    "节点名称": node.node_name,
                    "节点IP": node.node_ip,
                    "最后在线时间": node.last_seen.strftime("%Y-%m-%d %H:%M:%S") if node.last_seen else "",
                    "重试次数": node.retry_count,
                    "是否解决": "是" if node.is_resolved else "否"
                })
            pd.DataFrame(offline_data).to_excel(writer, sheet_name="离线节点", index=False)

        if sync_status.conflicts:
            conflict_data = []
            for conflict in sync_status.conflicts:
                conflict_data.append({
                    "节点名称": conflict.node_name,
                    "当前版本": conflict.current_version,
                    "目标版本": conflict.target_version,
                    "冲突详情": conflict.conflict_detail,
                    "状态": conflict.status.value,
                    "解决方式": conflict.resolution or "",
                    "解决人": conflict.resolved_by or "",
                    "解决时间": conflict.resolved_at.strftime("%Y-%m-%d %H:%M:%S") if conflict.resolved_at else ""
                })
            pd.DataFrame(conflict_data).to_excel(writer, sheet_name="冲突记录", index=False)

        if sync_status.audits:
            audit_data = []
            for audit in sync_status.audits:
                audit_data.append({
                    "操作": audit.action,
                    "操作人": audit.operator,
                    "详情": audit.detail or "",
                    "时间": audit.created_at.strftime("%Y-%m-%d %H:%M:%S")
                })
            pd.DataFrame(audit_data).to_excel(writer, sheet_name="操作审计", index=False)

    output.seek(0)

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=sync_report_{sync_status.request_id}.xlsx"}
    )


@app.get("/api/health")
def health_check():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}


@app.post("/api/init-test-data")
def init_test_data(db: Session = Depends(get_db)):
    if db.query(models.NodeGroup).count() == 0:
        group1 = models.NodeGroup(name="华北边缘节点组", description="北京、天津、河北区域节点", node_count=10)
        group2 = models.NodeGroup(name="华东边缘节点组", description="上海、江苏、浙江区域节点", node_count=15)
        db.add_all([group1, group2])
        db.flush()

        versions = [
            models.ConfigVersion(version="v1.0.0", node_group_id=group1.id,
                                 config_content='{"cache_ttl": 3600, "bandwidth_limit": 1000}',
                                 description="初始版本", created_by="admin"),
            models.ConfigVersion(version="v1.1.0", node_group_id=group1.id,
                                 config_content='{"cache_ttl": 7200, "bandwidth_limit": 2000}',
                                 description="增加缓存时间和带宽限制", created_by="operator1"),
            models.ConfigVersion(version="v1.0.0", node_group_id=group2.id,
                                 config_content='{"cache_ttl": 3600, "bandwidth_limit": 1500}',
                                 description="初始版本", created_by="admin"),
        ]
        db.add_all(versions)

    db.commit()
    return {"message": "测试数据初始化完成"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
