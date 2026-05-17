from fastapi import FastAPI, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import json
import io
import pandas as pd
from fastapi.responses import StreamingResponse

from database import get_db, init_db
from models import Wave, Order, OrderItem, PickTask, Location, SKUStock, ReviewDiff, CompletionReport
from services import WaveService

app = FastAPI(title="波次拣货缺货拆单复核差异后端API", version="1.0.0")


@app.on_event("startup")
async def startup_event():
    init_db()


class ErrorResponse(BaseModel):
    error_code: str
    message: str
    details: Optional[dict] = None


class CustomHTTPException(HTTPException):
    def __init__(self, status_code: int, error_code: str, message: str, details: dict = None):
        super().__init__(status_code=status_code, detail=message)
        self.error_code = error_code
        self.details = details


@app.exception_handler(CustomHTTPException)
async def custom_http_exception_handler(request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error_code": exc.error_code,
            "message": exc.detail,
            "details": exc.details
        }
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    missing_fields = []
    invalid_fields = []
    for error in exc.errors():
        field = " -> ".join(str(loc) for loc in error["loc"])
        if error["type"] == "missing":
            missing_fields.append(field)
        else:
            invalid_fields.append(f"{field}: {error['msg']}")
    
    if missing_fields:
        error_code = "MISSING_FIELDS"
        message = f"缺少必填字段: {', '.join(missing_fields)}"
    else:
        error_code = "INVALID_FIELDS"
        message = f"字段验证失败: {', '.join(invalid_fields)}"
    
    return JSONResponse(
        status_code=400,
        content={
            "error_code": error_code,
            "message": message,
            "details": {
                "missing_fields": missing_fields,
                "invalid_fields": invalid_fields,
                "raw_errors": exc.errors()
            }
        }
    )


class OrderItemCreate(BaseModel):
    sku_code: str = Field(..., description="SKU编码")
    sku_name: str = Field(..., description="SKU名称")
    ordered_quantity: int = Field(..., gt=0, description="订购数量")


class OrderCreate(BaseModel):
    order_code: str = Field(..., description="订单编号")
    customer_name: Optional[str] = Field(None, description="客户姓名")
    customer_phone: Optional[str] = Field(None, description="客户电话")
    shipping_address: Optional[str] = Field(None, description="收货地址")
    items: List[OrderItemCreate] = Field(..., description="订单商品列表")


class WaveCreateRequest(BaseModel):
    order_codes: List[str] = Field(..., description="要合并的订单编号列表")
    priority: int = Field(1, ge=1, le=5, description="优先级(1-5)")


class PickTaskProcessRequest(BaseModel):
    actual_quantity: int = Field(..., ge=0, description="实际拣货数量")
    picker: str = Field(..., description="拣货员")


class ReviewDiffCreateRequest(BaseModel):
    wave_id: int = Field(..., description="波次ID")
    order_id: int = Field(..., description="订单ID")
    sku_code: str = Field(..., description="SKU编码")
    expected_quantity: int = Field(..., gt=0, description="期望数量")
    actual_quantity: int = Field(..., ge=0, description="实际数量")
    diff_type: str = Field(..., description="差异类型: shortage/more/damage")


class ReviewDiffResolveRequest(BaseModel):
    handler: str = Field(..., description="处理人")
    remarks: Optional[str] = Field(None, description="处理备注")


class LocationCreateRequest(BaseModel):
    location_code: str = Field(..., description="库位编码")
    aisle: str = Field(..., description="通道")
    rack: str = Field(..., description="货架")
    level: int = Field(..., gt=0, description="层数")
    position: int = Field(..., gt=0, description="位置")
    sort_order: int = Field(0, description="排序")


class SKUStockCreateRequest(BaseModel):
    sku_code: str = Field(..., description="SKU编码")
    sku_name: str = Field(..., description="SKU名称")
    location_code: str = Field(..., description="库位编码")
    quantity: int = Field(..., ge=0, description="库存数量")


@app.post("/api/orders/", summary="创建订单", response_description="创建的订单信息")
def create_order(order_data: OrderCreate, db: Session = Depends(get_db)):
    existing = db.query(Order).filter(Order.order_code == order_data.order_code).first()
    if existing:
        raise CustomHTTPException(
            status_code=400,
            error_code="ORDER_EXISTS",
            message=f"订单 {order_data.order_code} 已存在",
            details={"order_code": order_data.order_code}
        )

    order = Order(
        order_code=order_data.order_code,
        customer_name=order_data.customer_name,
        customer_phone=order_data.customer_phone,
        shipping_address=order_data.shipping_address
    )
    db.add(order)
    db.flush()

    for item in order_data.items:
        order_item = OrderItem(
            order_id=order.id,
            sku_code=item.sku_code,
            sku_name=item.sku_name,
            ordered_quantity=item.ordered_quantity
        )
        db.add(order_item)

    db.commit()
    db.refresh(order)
    return {"order_id": order.id, "order_code": order.order_code, "items_count": len(order_data.items)}


@app.post("/api/locations/", summary="创建库位")
def create_location(location_data: LocationCreateRequest, db: Session = Depends(get_db)):
    existing = db.query(Location).filter(Location.location_code == location_data.location_code).first()
    if existing:
        raise CustomHTTPException(
            status_code=400,
            error_code="LOCATION_EXISTS",
            message=f"库位 {location_data.location_code} 已存在",
            details={"location_code": location_data.location_code}
        )

    location = Location(
        location_code=location_data.location_code,
        aisle=location_data.aisle,
        rack=location_data.rack,
        level=location_data.level,
        position=location_data.position,
        sort_order=location_data.sort_order
    )
    db.add(location)
    db.commit()
    db.refresh(location)
    return {"location_id": location.id, "location_code": location.location_code}


@app.post("/api/sku-stocks/", summary="创建SKU库存")
def create_sku_stock(stock_data: SKUStockCreateRequest, db: Session = Depends(get_db)):
    location = db.query(Location).filter(Location.location_code == stock_data.location_code).first()
    if not location:
        raise CustomHTTPException(
            status_code=400,
            error_code="LOCATION_NOT_FOUND",
            message=f"库位 {stock_data.location_code} 不存在",
            details={"location_code": stock_data.location_code}
        )

    stock = SKUStock(
        sku_code=stock_data.sku_code,
        sku_name=stock_data.sku_name,
        location_id=location.id,
        quantity=stock_data.quantity
    )
    db.add(stock)
    db.commit()
    db.refresh(stock)
    return {"stock_id": stock.id, "sku_code": stock.sku_code, "quantity": stock.quantity}


@app.post("/api/waves/", summary="创建波次(多订单合并)")
def create_wave(wave_request: WaveCreateRequest, db: Session = Depends(get_db)):
    if not wave_request.order_codes:
        raise CustomHTTPException(
            status_code=400,
            error_code="MISSING_FIELDS",
            message="订单编号列表不能为空",
            details={"required_fields": ["order_codes"]}
        )

    for order_code in wave_request.order_codes:
        order = db.query(Order).filter(Order.order_code == order_code).first()
        if not order:
            raise CustomHTTPException(
                status_code=400,
                error_code="ORDER_NOT_FOUND",
                message=f"订单 {order_code} 不存在",
                details={"order_code": order_code}
            )
        if order.wave_id:
            raise CustomHTTPException(
                status_code=400,
                error_code="ORDER_IN_WAVE",
                message=f"订单 {order_code} 已在其他波次中",
                details={"order_code": order_code}
            )

    try:
        wave = WaveService.create_wave(db, wave_request.order_codes, wave_request.priority)
        return {
            "wave_id": wave.id,
            "wave_code": wave.wave_code,
            "total_orders": wave.total_orders,
            "total_skus": wave.total_skus,
            "status": wave.status
        }
    except ValueError as e:
        raise CustomHTTPException(
            status_code=400,
            error_code="WAVE_CREATE_ERROR",
            message=str(e),
            details={}
        )


@app.post("/api/waves/{wave_id}/generate-tasks/", summary="生成拣货任务")
def generate_pick_tasks(wave_id: int, db: Session = Depends(get_db)):
    try:
        tasks = WaveService.generate_pick_tasks(db, wave_id)
        return {
            "wave_id": wave_id,
            "tasks_count": len(tasks),
            "tasks": [
                {
                    "task_id": t.id,
                    "task_code": t.task_code,
                    "sku_code": t.sku_code,
                    "sku_name": t.sku_name,
                    "required_quantity": t.required_quantity
                }
                for t in tasks
            ]
        }
    except ValueError as e:
        raise CustomHTTPException(
            status_code=400,
            error_code="INVALID_STATE",
            message=str(e),
            details={"wave_id": wave_id}
        )


@app.get("/api/waves/{wave_id}/sorted-tasks/", summary="获取按库位路径排序的拣货任务")
def get_sorted_tasks(wave_id: int, db: Session = Depends(get_db)):
    wave = db.query(Wave).filter(Wave.id == wave_id).first()
    if not wave:
        raise CustomHTTPException(
            status_code=404,
            error_code="WAVE_NOT_FOUND",
            message=f"波次 {wave_id} 不存在",
            details={"wave_id": wave_id}
        )

    tasks = WaveService.sort_locations_by_path(db, wave_id)
    return {
        "wave_id": wave_id,
        "tasks_count": len(tasks),
        "tasks": [
            {
                "task_id": t.id,
                "task_code": t.task_code,
                "location_code": t.location.location_code if t.location else None,
                "sku_code": t.sku_code,
                "required_quantity": t.required_quantity,
                "status": t.status
            }
            for t in tasks
        ]
    }


@app.post("/api/pick-tasks/{task_id}/process/", summary="处理拣货任务(支持缺货拆单)")
def process_pick_task(task_id: int, process_data: PickTaskProcessRequest, db: Session = Depends(get_db)):
    try:
        task, split_orders = WaveService.process_shortage(
            db, task_id, process_data.actual_quantity, process_data.picker
        )

        return {
            "task_id": task.id,
            "task_code": task.task_code,
            "required_quantity": task.required_quantity,
            "actual_quantity": task.picked_quantity,
            "is_shortage": task.is_shortage,
            "split_orders_count": len(split_orders),
            "split_orders": [
                {"order_id": o.id, "order_code": o.order_code}
                for o in split_orders
            ]
        }
    except ValueError as e:
        raise CustomHTTPException(
            status_code=400,
            error_code="INVALID_STATE",
            message=str(e),
            details={"task_id": task_id}
        )


@app.post("/api/review-diffs/", summary="创建复核差异")
def create_review_diff(diff_data: ReviewDiffCreateRequest, db: Session = Depends(get_db)):
    try:
        diff = WaveService.create_review_diff(
            db,
            wave_id=diff_data.wave_id if hasattr(diff_data, 'wave_id') else None,
            order_id=diff_data.order_id,
            sku_code=diff_data.sku_code,
            expected_quantity=diff_data.expected_quantity,
            actual_quantity=diff_data.actual_quantity,
            diff_type=diff_data.diff_type
        )
        return {
            "diff_id": diff.id,
            "diff_code": diff.diff_code,
            "sku_code": diff.sku_code,
            "diff_quantity": diff.diff_quantity,
            "status": diff.status
        }
    except ValueError as e:
        if "已存在" in str(e):
            raise CustomHTTPException(
                status_code=409,
                error_code="ALREADY_HANDLED",
                message=str(e),
                details={}
            )
        raise CustomHTTPException(
            status_code=400,
            error_code="INVALID_STATE",
            message=str(e),
            details={}
        )


@app.get("/api/waves/{wave_id}/review-diffs/", summary="获取波次复核差异列表")
def get_wave_review_diffs(wave_id: int, status: Optional[str] = None, db: Session = Depends(get_db)):
    wave = db.query(Wave).filter(Wave.id == wave_id).first()
    if not wave:
        raise CustomHTTPException(
            status_code=404,
            error_code="WAVE_NOT_FOUND",
            message=f"波次 {wave_id} 不存在",
            details={"wave_id": wave_id}
        )

    query = db.query(ReviewDiff).filter(ReviewDiff.wave_id == wave_id)
    if status:
        query = query.filter(ReviewDiff.status == status)

    diffs = query.all()
    return {
        "wave_id": wave_id,
        "diffs_count": len(diffs),
        "diffs": [
            {
                "diff_id": d.id,
                "diff_code": d.diff_code,
                "order_id": d.order_id,
                "sku_code": d.sku_code,
                "expected_quantity": d.expected_quantity,
                "actual_quantity": d.actual_quantity,
                "diff_quantity": d.diff_quantity,
                "status": d.status,
                "handler": d.handler
            }
            for d in diffs
        ]
    }


@app.post("/api/review-diffs/{diff_id}/resolve/", summary="解决复核差异")
def resolve_review_diff(diff_id: int, resolve_data: ReviewDiffResolveRequest, db: Session = Depends(get_db)):
    try:
        diff = WaveService.resolve_review_diff(db, diff_id, resolve_data.handler, resolve_data.remarks)
        return {
            "diff_id": diff.id,
            "diff_code": diff.diff_code,
            "status": diff.status,
            "handler": diff.handler,
            "handled_at": diff.handled_at
        }
    except ValueError as e:
        if "已处理" in str(e):
            raise CustomHTTPException(
                status_code=409,
                error_code="ALREADY_HANDLED",
                message=str(e),
                details={"diff_id": diff_id}
            )
        raise CustomHTTPException(
            status_code=400,
            error_code="INVALID_STATE",
            message=str(e),
            details={"diff_id": diff_id}
        )


@app.post("/api/waves/{wave_id}/complete/", summary="完成波次并生成报告")
def complete_wave(wave_id: int, db: Session = Depends(get_db)):
    try:
        report = WaveService.complete_wave(db, wave_id)
        return {
            "report_id": report.id,
            "report_code": report.report_code,
            "wave_id": report.wave_id,
            "total_orders": report.total_orders,
            "completed_orders": report.completed_orders,
            "split_orders": report.split_orders,
            "total_items": report.total_items,
            "picked_items": report.picked_items,
            "shortage_items": report.shortage_items,
            "review_diffs": report.review_diffs,
            "resolved_diffs": report.resolved_diffs
        }
    except ValueError as e:
        if "人工复核" in str(e):
            raise CustomHTTPException(
                status_code=400,
                error_code="REVIEW_REQUIRED",
                message=str(e),
                details={"wave_id": wave_id}
            )
        raise CustomHTTPException(
            status_code=400,
            error_code="INVALID_STATE",
            message=str(e),
            details={"wave_id": wave_id}
        )


@app.get("/api/waves/{wave_id}/report/", summary="获取波次详细报告")
def get_wave_report(wave_id: int, db: Session = Depends(get_db)):
    try:
        report = WaveService.get_wave_report(db, wave_id)
        return report
    except ValueError as e:
        raise CustomHTTPException(
            status_code=404,
            error_code="WAVE_NOT_FOUND",
            message=str(e),
            details={"wave_id": wave_id}
        )


@app.get("/api/waves/{wave_id}/export/", summary="导出波次报告为Excel")
def export_wave_report(wave_id: int, db: Session = Depends(get_db)):
    try:
        report_data = WaveService.get_wave_report(db, wave_id)
    except ValueError as e:
        raise CustomHTTPException(
            status_code=404,
            error_code="WAVE_NOT_FOUND",
            message=str(e),
            details={"wave_id": wave_id}
        )

    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        wave_df = pd.DataFrame([{
            "波次编号": report_data["wave"]["wave_code"],
            "状态": report_data["wave"]["status"],
            "创建时间": report_data["wave"]["created_at"],
            "完成时间": report_data["wave"]["completed_at"]
        }])
        wave_df.to_excel(writer, sheet_name="波次概况", index=False)

        orders_df = pd.DataFrame(report_data["orders"])
        orders_df.columns = ["订单编号", "状态", "是否拆单", "商品数量"]
        orders_df.to_excel(writer, sheet_name="订单列表", index=False)

        tasks_df = pd.DataFrame(report_data["pick_tasks"])
        tasks_df.columns = ["任务编号", "SKU编码", "应拣数量", "实拣数量", "是否缺货"]
        tasks_df.to_excel(writer, sheet_name="拣货任务", index=False)

        diffs_df = pd.DataFrame(report_data["review_diffs"])
        if not diffs_df.empty:
            diffs_df.columns = ["差异编号", "SKU编码", "差异数量", "状态"]
            diffs_df.to_excel(writer, sheet_name="复核差异", index=False)

        if report_data["report"]:
            summary_df = pd.DataFrame([{
                "总订单数": report_data["report"]["total_orders"],
                "拆单数量": report_data["report"]["split_orders"],
                "缺货商品数": report_data["report"]["shortage_items"],
                "复核差异数": report_data["report"]["review_diffs"]
            }])
            summary_df.to_excel(writer, sheet_name="统计汇总", index=False)

    output.seek(0)
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=wave_{wave_id}_report.xlsx"}
    )


@app.get("/api/waves/", summary="查询波次列表")
def list_waves(
    status: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    query = db.query(Wave)
    if status:
        query = query.filter(Wave.status == status)

    waves = query.order_by(Wave.created_at.desc()).offset(skip).limit(limit).all()
    return {
        "total": query.count(),
        "waves": [
            {
                "wave_id": w.id,
                "wave_code": w.wave_code,
                "status": w.status,
                "total_orders": w.total_orders,
                "total_skus": w.total_skus,
                "created_at": w.created_at
            }
            for w in waves
        ]
    }


@app.get("/api/orders/", summary="查询订单列表")
def list_orders(
    status: Optional[str] = None,
    wave_id: Optional[int] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    query = db.query(Order)
    if status:
        query = query.filter(Order.status == status)
    if wave_id:
        query = query.filter(Order.wave_id == wave_id)

    orders = query.order_by(Order.created_at.desc()).offset(skip).limit(limit).all()
    return {
        "total": query.count(),
        "orders": [
            {
                "order_id": o.id,
                "order_code": o.order_code,
                "wave_id": o.wave_id,
                "status": o.status,
                "is_split": o.is_split,
                "items_count": len(o.items)
            }
            for o in orders
        ]
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)