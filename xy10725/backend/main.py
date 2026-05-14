from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import json
import uuid

from models import Base, Order, Callback, Refund, Bill, Replenishment, ReconciliationReport
from database import engine, get_db

Base.metadata.create_all(bind=engine)

app = FastAPI(title="支付沙箱对账台 API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/orders/", response_model=dict)
def create_order(order_data: dict, db: Session = Depends(get_db)):
    order_no = order_data.get("order_no") or f"ORD{datetime.now().strftime('%Y%m%d%H%M%S')}"
    existing = db.query(Order).filter(Order.order_no == order_no).first()
    if existing:
        raise HTTPException(status_code=400, detail="订单号已存在")
    
    db_order = Order(
        order_no=order_no,
        version=order_data.get("version", "v1.0"),
        amount=float(order_data.get("amount", 0)),
        status="pending",
        raw_input=json.dumps(order_data, ensure_ascii=False)
    )
    db.add(db_order)
    db.commit()
    db.refresh(db_order)
    return {"id": db_order.id, "order_no": db_order.order_no, "status": db_order.status}

@app.get("/api/orders/", response_model=List[dict])
def list_orders(
    version: Optional[str] = None,
    status: Optional[str] = None,
    order_no: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(Order)
    if version:
        query = query.filter(Order.version == version)
    if status:
        query = query.filter(Order.status == status)
    if order_no:
        query = query.filter(Order.order_no.contains(order_no))
    
    orders = query.order_by(Order.created_at.desc()).offset(skip).limit(limit).all()
    result = []
    for o in orders:
        result.append({
            "id": o.id,
            "order_no": o.order_no,
            "version": o.version,
            "amount": o.amount,
            "status": o.status,
            "created_at": o.created_at.isoformat() if o.created_at else None,
            "updated_at": o.updated_at.isoformat() if o.updated_at else None
        })
    return result

@app.get("/api/orders/{order_id}", response_model=dict)
def get_order(order_id: int, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")
    
    callbacks = [{"id": c.id, "type": c.callback_type, "status": c.status, "created_at": c.created_at.isoformat()} 
                 for c in order.callbacks]
    refunds = [{"id": r.id, "refund_no": r.refund_no, "amount": r.amount, "status": r.status} 
               for r in order.refunds]
    bills = [{"id": b.id, "bill_no": b.bill_no, "difference": b.difference, "status": b.status} 
             for b in order.bills]
    replenishments = [{"id": r.id, "action_type": r.action_type, "reason": r.reason, "operator": r.operator,
                       "before_status": r.before_status, "after_status": r.after_status, "created_at": r.created_at.isoformat()} 
                      for r in order.replenishments]
    reports = [{"id": r.id, "report_no": r.report_no, "status": r.status} for r in order.reports]
    
    return {
        "id": order.id,
        "order_no": order.order_no,
        "version": order.version,
        "amount": order.amount,
        "status": order.status,
        "raw_input": order.raw_input,
        "processed_result": order.processed_result,
        "created_at": order.created_at.isoformat() if order.created_at else None,
        "updated_at": order.updated_at.isoformat() if order.updated_at else None,
        "callbacks": callbacks,
        "refunds": refunds,
        "bills": bills,
        "replenishments": replenishments,
        "reports": reports
    }

@app.get("/api/versions/", response_model=List[str])
def get_versions(db: Session = Depends(get_db)):
    versions = db.query(Order.version).distinct().all()
    return [v[0] for v in versions]

@app.post("/api/orders/{order_id}/callback/", response_model=dict)
def add_callback(order_id: int, callback_data: dict, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")
    
    callback = Callback(
        order_id=order_id,
        callback_type=callback_data.get("type", "payment"),
        status="received",
        raw_data=json.dumps(callback_data, ensure_ascii=False)
    )
    db.add(callback)
    
    order.status = "callback_received"
    order.processed_result = json.dumps({"callback_received": True}, ensure_ascii=False)
    
    db.commit()
    return {"message": "回调已添加", "order_status": order.status}

@app.post("/api/orders/{order_id}/refund/", response_model=dict)
def add_refund(order_id: int, refund_data: dict, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")
    
    refund = Refund(
        order_id=order_id,
        refund_no=refund_data.get("refund_no") or f"REF{datetime.now().strftime('%Y%m%d%H%M%S')}",
        amount=float(refund_data.get("amount", 0)),
        status="processing",
        reason=refund_data.get("reason", "")
    )
    db.add(refund)
    
    order.status = "refund_processing"
    db.commit()
    return {"message": "退款已创建", "refund_no": refund.refund_no}

@app.post("/api/orders/{order_id}/bill/", response_model=dict)
def add_bill(order_id: int, bill_data: dict, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")
    
    bill_amount = float(bill_data.get("bill_amount", 0))
    difference = bill_amount - order.amount
    
    bill = Bill(
        order_id=order_id,
        bill_no=bill_data.get("bill_no") or f"BILL{datetime.now().strftime('%Y%m%d%H%M%S')}",
        bill_amount=bill_amount,
        order_amount=order.amount,
        difference=difference,
        status="difference_found" if difference != 0 else "matched",
        remark=bill_data.get("remark", "")
    )
    db.add(bill)
    
    if difference != 0:
        order.status = "bill_difference"
    else:
        order.status = "bill_matched"
    
    db.commit()
    return {"message": "账单已录入", "difference": difference, "order_status": order.status}

@app.post("/api/orders/{order_id}/replenish/", response_model=dict)
def replenish_order(order_id: int, replenish_data: dict, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")
    
    if order.status == "completed":
        raise HTTPException(status_code=400, detail="规则限制：已完成的订单不允许补单")
    
    before_status = order.status
    after_status = replenish_data.get("target_status", "reconciled")
    
    replenishment = Replenishment(
        order_id=order_id,
        action_type=replenish_data.get("action_type", "manual_reconcile"),
        reason=replenish_data.get("reason", ""),
        operator=replenish_data.get("operator", "system"),
        before_status=before_status,
        after_status=after_status
    )
    db.add(replenishment)
    
    order.status = after_status
    order.processed_result = json.dumps({
        "replenished": True,
        "reason": replenish_data.get("reason", ""),
        "operator": replenish_data.get("operator", "system")
    }, ensure_ascii=False)
    
    db.commit()
    return {"message": "补单完成", "before_status": before_status, "after_status": after_status}

@app.post("/api/orders/{order_id}/report/", response_model=dict)
def create_report(order_id: int, report_data: dict, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")
    
    report = ReconciliationReport(
        order_id=order_id,
        report_no=report_data.get("report_no") or f"RPT{datetime.now().strftime('%Y%m%d%H%M%S')}",
        content=json.dumps(report_data.get("content", {}), ensure_ascii=False),
        status="finalized"
    )
    db.add(report)
    
    order.status = "completed"
    db.commit()
    return {"message": "对账报告已生成", "report_no": report.report_no}

@app.get("/api/reports/", response_model=List[dict])
def list_reports(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    reports = db.query(ReconciliationReport).order_by(ReconciliationReport.created_at.desc()).offset(skip).limit(limit).all()
    result = []
    for r in reports:
        result.append({
            "id": r.id,
            "report_no": r.report_no,
            "order_no": r.order.order_no if r.order else "",
            "status": r.status,
            "created_at": r.created_at.isoformat() if r.created_at else None
        })
    return result

@app.post("/api/init-data/")
def init_test_data(db: Session = Depends(get_db)):
    test_orders = [
        {"order_no": "TEST2024001", "version": "v1.0", "amount": 100.0, "status": "pending"},
        {"order_no": "TEST2024002", "version": "v1.0", "amount": 200.0, "status": "callback_received"},
        {"order_no": "TEST2024003", "version": "v2.0", "amount": 150.0, "status": "bill_difference"},
        {"order_no": "TEST2024004", "version": "v2.0", "amount": 300.0, "status": "reconciled"},
        {"order_no": "TEST2024005", "version": "v1.0", "amount": 250.0, "status": "completed"},
    ]
    
    for o in test_orders:
        existing = db.query(Order).filter(Order.order_no == o["order_no"]).first()
        if not existing:
            db_order = Order(
                order_no=o["order_no"],
                version=o["version"],
                amount=o["amount"],
                status=o["status"],
                raw_input=json.dumps(o, ensure_ascii=False)
            )
            db.add(db_order)
    
    db.commit()
    return {"message": "测试数据初始化完成", "count": len(test_orders)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
