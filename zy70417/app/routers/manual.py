from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel
from app.database import get_db
from app.models.models import ManualChange, CheckResult, EdgeNode, IoTReceipt

router = APIRouter(prefix="/api/manual", tags=["manual"])


class ManualChangeRequest(BaseModel):
    result_id: int
    changed_by: str
    change_type: str
    old_value: Optional[dict] = None
    new_value: Optional[dict] = None
    reason: str


class IoTReceiptResponse(BaseModel):
    id: int
    receipt_id: str
    device_status: str
    receipt_time: datetime
    raw_data: dict

    class Config:
        from_attributes = True


@router.post("/changes")
def create_manual_change(request: ManualChangeRequest, db: Session = Depends(get_db)):
    result = db.query(CheckResult).filter(CheckResult.id == request.result_id).first()
    if not result:
        raise HTTPException(status_code=404, detail="检查结果不存在")

    change = ManualChange(
        result_id=request.result_id,
        changed_by=request.changed_by,
        change_type=request.change_type,
        old_value=request.old_value,
        new_value=request.new_value,
        reason=request.reason
    )
    db.add(change)
    db.commit()
    db.refresh(change)
    return {"success": True, "change_id": change.id}


@router.get("/changes/{result_id}")
def get_changes_for_result(result_id: int, db: Session = Depends(get_db)):
    changes = db.query(ManualChange).filter(ManualChange.result_id == result_id).all()
    return changes


@router.get("/iot/{node_id}", response_model=List[IoTReceiptResponse])
def get_iot_receipts(
    node_id: int,
    responsible_team: Optional[str] = Query(None, description="按责任团队追溯"),
    db: Session = Depends(get_db)
):
    node = db.query(EdgeNode).filter(EdgeNode.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="节点不存在")

    if responsible_team and node.responsible_team != responsible_team:
        raise HTTPException(status_code=403, detail="无权访问该责任团队的设备数据")

    receipts = db.query(IoTReceipt).filter(IoTReceipt.node_id == node_id).all()
    return receipts
