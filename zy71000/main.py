from fastapi import FastAPI, Depends, HTTPException
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

import models
import crud
import schemas
from database import engine, get_db

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="手术器械批号隔离 API",
    description="手术室护士长月底复盘工具 - 器械包批号和消毒记录追踪系统",
    version="1.0.0"
)


@app.post("/api/raw-materials/", response_model=dict, summary="接收原始材料并生成隔离单")
def submit_raw_material(material: schemas.RawMaterialCreate, db: Session = Depends(get_db)):
    validation_result = crud.validate_raw_material(db, material)
    
    if validation_result["existing_order"]:
        existing = validation_result["existing_order"]
        decisions = crud.get_order_decisions(db, existing.id)
        return {
            "status": "duplicate",
            "message": f"同一份材料已存在隔离单，同一批号+炉次只保留一条有效记录",
            "validation": {
                "is_valid": False,
                "issues": validation_result["issues"],
                "risk_level": validation_result["risk_level"]
            },
            "existing_order": {
                "order_no": existing.order_no,
                "status": existing.status,
                "final_conclusion": existing.final_conclusion,
                "created_at": existing.created_at,
                "latest_decision": decisions[0].conclusion if decisions else None,
                "decision_reason": decisions[0].reason if decisions else None
            }
        }
    
    order = crud.create_isolation_order(db, material, validation_result)
    
    return {
        "status": "created",
        "validation": {
            "is_valid": validation_result["is_valid"],
            "issues": validation_result["issues"],
            "risk_level": validation_result["risk_level"]
        },
        "order_no": order.order_no,
        "order_id": order.id,
        "flags": {
            "is_late_submission": order.is_late_submission,
            "cross_room_usage": order.cross_room_usage,
            "temp_package_change": order.temp_package_change
        }
    }


@app.get("/api/isolation-orders/", response_model=List[schemas.IsolationOrderResponse], summary="获取隔离单列表")
def list_isolation_orders(skip: int = 0, limit: int = 100, status: Optional[str] = None, db: Session = Depends(get_db)):
    orders = crud.get_isolation_orders(db, skip=skip, limit=limit, status=status)
    return orders


@app.get("/api/isolation-orders/{order_id}", response_model=schemas.IsolationOrderDetailResponse, summary="获取隔离单详情")
def get_isolation_order(order_id: int, db: Session = Depends(get_db)):
    order = crud.get_isolation_order(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="隔离单不存在")
    return order


@app.post("/api/decisions/", response_model=dict, summary="记录判定（放行/驳回/补证）")
def create_decision(decision: schemas.DecisionCreate, db: Session = Depends(get_db)):
    order = crud.get_isolation_order(db, decision.isolation_order_id)
    if not order:
        raise HTTPException(status_code=404, detail="隔离单不存在")
    
    if order.status == "released" and decision.decision_type == "approve":
        raise HTTPException(status_code=400, detail="重复放行拦截：该隔离单已放行，无需重复操作")
    
    result = crud.create_decision_record(db, decision)
    if not result:
        raise HTTPException(status_code=400, detail="判定失败")
    
    return {
        "status": "success",
        "decision_id": result.id,
        "order_status": order.status,
        "final_conclusion": order.final_conclusion
    }


@app.get("/api/sterilization-trace/{cycle}", summary="消毒炉次追踪")
def trace_sterilization_cycle(cycle: str, db: Session = Depends(get_db)):
    records = crud.get_sterilization_records_by_cycle(db, cycle)
    orders = db.query(models.IsolationOrder).filter(
        models.IsolationOrder.sterilization_cycle == cycle
    ).all()
    
    return {
        "cycle": cycle,
        "sterilization_records": records,
        "related_isolation_orders": [
            {"order_no": o.order_no, "batch_number": o.batch_number, "status": o.status}
            for o in orders
        ]
    }


@app.get("/api/export/report", response_class=PlainTextResponse, summary="导出隔离报告CSV")
def export_report(start_date: Optional[str] = None, end_date: Optional[str] = None, db: Session = Depends(get_db)):
    start_dt = datetime.fromisoformat(start_date) if start_date else None
    end_dt = datetime.fromisoformat(end_date) if end_date else None
    
    rows = crud.export_isolation_report(db, start_dt, end_dt)
    
    csv_lines = []
    for row in rows:
        csv_lines.append(",".join([f'"{str(cell)}"' for cell in row]))
    
    csv_content = "\n".join(csv_lines)
    
    return PlainTextResponse(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=isolation_report_{datetime.now().strftime('%Y%m%d')}.csv"}
    )


@app.get("/api/batch-trace/{batch_number}", summary="批号隔离追踪")
def trace_batch(batch_number: str, db: Session = Depends(get_db)):
    orders = db.query(models.IsolationOrder).filter(
        models.IsolationOrder.batch_number == batch_number
    ).order_by(models.IsolationOrder.created_at.desc()).all()
    
    usage_records = db.query(models.UsageRecord).filter(
        models.UsageRecord.batch_number == batch_number
    ).all()
    
    return {
        "batch_number": batch_number,
        "isolation_count": len(orders),
        "isolation_history": [
            {
                "order_no": o.order_no,
                "sterilization_cycle": o.sterilization_cycle,
                "operating_room": o.operating_room,
                "status": o.status,
                "conclusion": o.final_conclusion,
                "created_at": o.created_at
            }
            for o in orders
        ],
        "usage_rooms": list(set([u.operating_room for u in usage_records])),
        "has_cross_room_usage": len(set([u.operating_room for u in usage_records])) > 1
    }


@app.get("/api/health", summary="健康检查")
def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}
