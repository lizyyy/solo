from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from app.database import get_db
from app.models.models import Batch, EdgeNode, Rule, CheckResult, IoTReceipt
from app.schemas.schemas import (
    BatchSubmitRequest, BatchListResponse, BatchDetailResponse, SubmitResponse
)
from app.services.rule_engine import rule_engine

router = APIRouter(prefix="/api/batches", tags=["batches"])


@router.post("/submit", response_model=SubmitResponse)
def submit_batch(request: BatchSubmitRequest, db: Session = Depends(get_db)):
    existing_batch = db.query(Batch).filter(Batch.batch_no == request.batch_no).first()
    if existing_batch:
        return SubmitResponse(
            success=True,
            batch_no=request.batch_no,
            is_duplicate=True,
            message=f"批次 {request.batch_no} 已存在，复用历史结论",
            detail_url=f"/api/batches/{existing_batch.id}"
        )

    nodes_data = [node.model_dump() for node in request.nodes]
    temp_batch = Batch()
    data_hash = temp_batch.generate_data_hash(nodes_data)

    duplicate_hash_batch = db.query(Batch).filter(Batch.data_hash == data_hash).first()
    if duplicate_hash_batch:
        return SubmitResponse(
            success=True,
            batch_no=request.batch_no,
            is_duplicate=True,
            message=f"批次内容与 {duplicate_hash_batch.batch_no} 重复，复用历史结论",
            detail_url=f"/api/batches/{duplicate_hash_batch.id}"
        )

    batch = Batch(
        batch_no=request.batch_no,
        operator=request.operator,
        status="processing",
        total_count=len(request.nodes),
        data_hash=data_hash
    )
    db.add(batch)
    db.flush()

    for node_data in request.nodes:
        node = EdgeNode(
            batch_id=batch.id,
            **node_data.model_dump(exclude={'extra_data'}),
            extra_data=node_data.extra_data
        )
        db.add(node)
        db.flush()

        iot_receipt = IoTReceipt(
            node_id=node.id,
            receipt_id=f"IOT-{node.node_id}-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            device_status="online",
            receipt_time=datetime.now(),
            raw_data={
                'node_id': node.node_id,
                'heartbeat': datetime.now().isoformat(),
                'metrics': {'cpu_usage': 45, 'memory_usage': 62, 'network_latency': 12}
            }
        )
        db.add(iot_receipt)

    db.flush()

    active_rules = db.query(Rule).filter(Rule.is_active == True).all()
    rule_snapshot = rule_engine.get_rule_snapshot(active_rules)
    batch.rule_version_snapshot = rule_snapshot

    all_nodes = db.query(EdgeNode).filter(EdgeNode.batch_id == batch.id).all()
    risk_count = 0

    for node in all_nodes:
        results = rule_engine.check_node(node, active_rules)
        for result in results:
            result.batch_id = batch.id
            result.node_id = node.id
            db.add(result)
            if result.is_blocked:
                risk_count += 1

    batch.risk_count = risk_count
    batch.status = "completed"
    batch.completed_at = datetime.now()

    db.commit()
    db.refresh(batch)

    return SubmitResponse(
        success=True,
        batch_no=request.batch_no,
        is_duplicate=False,
        message=f"批次处理完成，共 {risk_count} 个风险项",
        detail_url=f"/api/batches/{batch.id}"
    )


@router.get("/", response_model=List[BatchListResponse])
def list_batches(
    operator: Optional[str] = Query(None, description="按操作者过滤"),
    risk_type: Optional[str] = Query(None, description="按风险类型过滤"),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(Batch)

    if operator:
        query = query.filter(Batch.operator == operator)

    if risk_type:
        query = query.join(CheckResult).filter(CheckResult.risk_type == risk_type)

    batches = query.order_by(Batch.created_at.desc()).offset(skip).limit(limit).all()
    return batches


@router.get("/{batch_id}", response_model=BatchDetailResponse)
def get_batch_detail(batch_id: int, db: Session = Depends(get_db)):
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    return batch
