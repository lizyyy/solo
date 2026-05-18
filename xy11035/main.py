from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Optional
import models
import schemas
import crud
from database import engine, get_db
from exceptions import PrintQueueException

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="文印店打印急件插队 API",
    description="管理文印店打印急件插队的 REST API 服务，包含本地持久化、产能日志一致性检查、可读错误返回",
    version="1.0.0"
)


@app.exception_handler(PrintQueueException)
async def print_queue_exception_handler(request, exc: PrintQueueException):
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={
            "error_code": exc.error_code,
            "error_message": exc.error_message,
            "error_details": exc.error_details,
            "timestamp": datetime.utcnow().isoformat()
        }
    )


@app.exception_handler(Exception)
async def general_exception_handler(request, exc: Exception):
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error_code": "INTERNAL_SERVER_ERROR",
            "error_message": "服务器内部错误",
            "error_details": {"type": type(exc).__name__, "message": str(exc)},
            "timestamp": datetime.utcnow().isoformat()
        }
    )


@app.post("/api/urgent-orders/", response_model=schemas.PrintUrgentOrderResponse, status_code=status.HTTP_201_CREATED)
def create_urgent_order(order: schemas.PrintUrgentOrderCreate, db: Session = Depends(get_db)):
    try:
        return crud.create_urgent_order(db=db, order=order)
    except PrintQueueException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise


@app.post("/api/urgent-orders/force-insert/", response_model=schemas.PrintUrgentOrderResponse, status_code=status.HTTP_201_CREATED)
def force_insert_urgent_order(order: schemas.PrintUrgentOrderCreate, db: Session = Depends(get_db)):
    return crud.force_insert_urgent_order(db=db, order=order)


@app.get("/api/urgent-orders/", response_model=List[schemas.PrintUrgentOrderResponse])
def read_urgent_orders(skip: int = 0, limit: int = 100, status: Optional[str] = None, db: Session = Depends(get_db)):
    orders = crud.get_urgent_orders(db, skip=skip, limit=limit, status=status)
    return orders


@app.get("/api/urgent-orders/{order_id}", response_model=schemas.UrgentOrderWithLogs)
def read_urgent_order(order_id: int, db: Session = Depends(get_db)):
    db_order = crud.get_urgent_order(db, order_id=order_id)
    logs = crud.get_capacity_logs(db, urgent_order_id=order_id)
    result = db_order.__dict__
    result["capacity_logs"] = logs
    return result


@app.patch("/api/urgent-orders/{order_id}/status", response_model=schemas.PrintUrgentOrderResponse)
def update_order_status(order_id: int, update_data: schemas.PrintUrgentOrderUpdate, db: Session = Depends(get_db)):
    return crud.update_urgent_order_status(db, order_id=order_id, update_data=update_data)


@app.get("/api/capacity-logs/", response_model=List[schemas.CapacityLogResponse])
def read_capacity_logs(urgent_order_id: Optional[int] = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    logs = crud.get_capacity_logs(db, urgent_order_id=urgent_order_id, skip=skip, limit=limit)
    return logs


@app.get("/api/export/orders")
def export_orders(status: Optional[str] = None, db: Session = Depends(get_db)):
    data = crud.export_orders_to_dict(db, status=status)
    return {
        "export_time": datetime.utcnow().isoformat(),
        "total_count": len(data),
        "status_filter": status,
        "data": data
    }


@app.get("/api/queue/status")
def get_queue_status(db: Session = Depends(get_db)):
    queue_length = crud.get_current_queue_length(db)
    pending_orders = crud.get_urgent_orders(db, status=models.UrgentStatus.NORMAL)
    return {
        "current_queue_length": queue_length,
        "max_allowed_position": queue_length + 1,
        "pending_orders_count": len(pending_orders),
        "pending_orders": [{"order_no": o.order_no, "position": o.queue_position_after, "customer": o.customer_name} for o in pending_orders]
    }


@app.post("/api/import/validate")
def validate_import_data(rows: List[dict], db: Session = Depends(get_db)):
    failed_rows = []
    success_count = 0

    for idx, row in enumerate(rows):
        try:
            if "order_no" not in row or not row["order_no"]:
                raise ValueError("缺少订单编号")
            if "page_count" not in row or row["page_count"] <= 0:
                raise ValueError("页数必须大于0")
            if "customer_name" not in row or not row["customer_name"]:
                raise ValueError("缺少客户姓名")

            existing = crud.get_urgent_order_by_no(db, row["order_no"])
            if existing:
                raise ValueError(f"订单已存在: {row['order_no']}")

            success_count += 1
        except Exception as e:
            failed_rows.append({
                "row_index": idx + 1,
                "row_data": row,
                "error_message": str(e)
            })

    return {
        "success_count": success_count,
        "failed_count": len(failed_rows),
        "failed_rows": failed_rows,
        "can_import": len(failed_rows) == 0
    }


@app.get("/")
def root():
    return {
        "service": "文印店打印急件插队 API",
        "version": "1.0.0",
        "docs": "/docs",
        "status": "running"
    }
