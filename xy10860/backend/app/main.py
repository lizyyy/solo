from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import io
import pandas as pd

from .database import engine, Base, get_db
from .models import ReleaseStatus, EnvironmentType
from .schemas import (
    ReleaseOrder, ReleaseOrderCreate, ReleaseOrderUpdate,
    StatusTransition, CheckItemUpdate, ReleaseTokenCreate,
    RollbackRecordCreate, ReleaseOrderFilter,
    BatchImportItem, BatchImportResponse
)
from .services import (
    get_release_orders, get_release_order, create_release_order,
    update_release_order_status, update_check_item, submit_approval,
    create_release_token, validate_release_token, use_release_token,
    create_rollback_record, check_timeout_release_orders, batch_import_release_orders
)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="发布审批 API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/release-orders", response_model=List[ReleaseOrder])
def list_release_orders(
    skip: int = 0,
    limit: int = 100,
    status: Optional[ReleaseStatus] = None,
    environment: Optional[EnvironmentType] = None,
    created_by: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    filter_params = ReleaseOrderFilter(
        status=status,
        environment=environment,
        created_by=created_by,
        search=search
    )
    return get_release_orders(db, skip=skip, limit=limit, filter_params=filter_params)


@app.get("/api/release-orders/{release_order_id}", response_model=ReleaseOrder)
def get_single_release_order(release_order_id: int, db: Session = Depends(get_db)):
    db_release = get_release_order(db, release_order_id)
    if db_release is None:
        raise HTTPException(status_code=404, detail="发布单不存在")
    return db_release


@app.post("/api/release-orders", response_model=ReleaseOrder)
def create_new_release_order(release_order: ReleaseOrderCreate, db: Session = Depends(get_db)):
    return create_release_order(db, release_order)


@app.post("/api/release-orders/{release_order_id}/status", response_model=ReleaseOrder)
def update_status(release_order_id: int, transition: StatusTransition, db: Session = Depends(get_db)):
    db_release, error = update_release_order_status(db, release_order_id, transition)
    if error:
        raise HTTPException(status_code=400, detail=error)
    return db_release


@app.put("/api/check-items/{check_item_id}")
def update_check_item_status(check_item_id: int, update: CheckItemUpdate, db: Session = Depends(get_db)):
    db_check, error = update_check_item(db, check_item_id, update)
    if error:
        raise HTTPException(status_code=400, detail=error)
    return db_check


@app.post("/api/approvals/{approval_id}/approve")
def approve_approval(approval_id: int, comment: Optional[str] = None, operator: Optional[str] = None, db: Session = Depends(get_db)):
    db_approval, error = submit_approval(db, approval_id, approved=True, comment=comment, operator=operator)
    if error:
        raise HTTPException(status_code=400, detail=error)
    return db_approval


@app.post("/api/approvals/{approval_id}/reject")
def reject_approval(approval_id: int, comment: Optional[str] = None, operator: Optional[str] = None, db: Session = Depends(get_db)):
    db_approval, error = submit_approval(db, approval_id, approved=False, comment=comment, operator=operator)
    if error:
        raise HTTPException(status_code=400, detail=error)
    return db_approval


@app.post("/api/release-orders/{release_order_id}/tokens")
def issue_token(release_order_id: int, token_create: ReleaseTokenCreate, db: Session = Depends(get_db)):
    db_token, error = create_release_token(db, release_order_id, token_create)
    if error:
        raise HTTPException(status_code=400, detail=error)
    return db_token


@app.post("/api/release-orders/{release_order_id}/tokens/validate")
def validate_token(release_order_id: int, token: str, db: Session = Depends(get_db)):
    is_valid, error = validate_release_token(db, release_order_id, token)
    return {"valid": is_valid, "error": error}


@app.post("/api/release-orders/{release_order_id}/tokens/use")
def use_token(release_order_id: int, token: str, operator: str, db: Session = Depends(get_db)):
    success, error = use_release_token(db, release_order_id, token, operator)
    if not success:
        raise HTTPException(status_code=400, detail=error)
    return {"success": True}


@app.post("/api/release-orders/{release_order_id}/rollback")
def rollback_release(release_order_id: int, rollback: RollbackRecordCreate, db: Session = Depends(get_db)):
    db_rollback, error = create_rollback_record(db, release_order_id, rollback)
    if error:
        raise HTTPException(status_code=400, detail=error)
    return db_rollback


@app.post("/api/release-orders/batch-import")
def batch_import(items: List[BatchImportItem], db: Session = Depends(get_db)):
    return batch_import_release_orders(db, items)


@app.get("/api/release-orders/export/excel")
def export_excel(
    status: Optional[ReleaseStatus] = None,
    environment: Optional[EnvironmentType] = None,
    db: Session = Depends(get_db)
):
    filter_params = ReleaseOrderFilter(status=status, environment=environment)
    orders = get_release_orders(db, filter_params=filter_params)
    
    data = []
    for order in orders:
        data.append({
            "ID": order.id,
            "标题": order.title,
            "版本": order.version,
            "环境": order.environment,
            "状态": order.status,
            "创建人": order.created_by,
            "创建时间": order.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            "审批通过数": sum(1 for a in order.approvals if a.approved),
            "检查项通过数": sum(1 for c in order.check_items if c.status == "passed"),
            "部署时间": order.deployed_at.strftime("%Y-%m-%d %H:%M:%S") if order.deployed_at else ""
        })
    
    df = pd.DataFrame(data)
    
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='发布单列表')
    
    output.seek(0)
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=release_orders_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"}
    )


@app.post("/api/system/check-timeout")
def check_timeouts(db: Session = Depends(get_db)):
    count = check_timeout_release_orders(db)
    return {"timeout_count": count}


@app.get("/api/health")
def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow()}
