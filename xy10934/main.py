from fastapi import FastAPI, Depends, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
from sqlalchemy.orm import Session
import pandas as pd
from io import BytesIO
from fastapi.responses import Response

from database import get_db, engine, Base
import models
import schemas
import services

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="仓储波次拣货 API",
    description="多订单合并拣货系统，支持缺货拆单、复核差异追踪和波次完成状态管理",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", summary="API 健康检查")
def root():
    return {"message": "仓储波次拣货 API 运行正常", "version": "1.0.0"}


@app.post("/api/orders/", response_model=schemas.OrderResponse, summary="创建订单")
def create_order(order: schemas.OrderCreate, db: Session = Depends(get_db)):
    try:
        return services.create_order(db, order)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/orders/", response_model=List[schemas.OrderResponse], summary="查询订单列表")
def list_orders(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
):
    return services.list_orders(db, skip, limit, status)


@app.get("/api/orders/{order_id}", response_model=schemas.OrderResponse, summary="查询订单详情")
def get_order(order_id: int, db: Session = Depends(get_db)):
    order = services.get_order(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")
    return order


@app.post("/api/locations/", response_model=schemas.LocationResponse, summary="创建库位")
def create_location(location: schemas.LocationCreate, db: Session = Depends(get_db)):
    try:
        return services.create_location(db, location)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/locations/", response_model=List[schemas.LocationResponse], summary="查询库位列表")
def list_locations(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    return services.list_locations(db, skip, limit)


@app.post("/api/waves/", response_model=schemas.WaveResponse, summary="创建波次（多订单合并拣货）")
def create_wave(wave: schemas.WaveCreate, db: Session = Depends(get_db)):
    try:
        return services.create_wave(db, wave)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/waves/", response_model=List[schemas.WaveResponse], summary="查询波次列表")
def list_waves(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
):
    return services.list_waves(db, skip, limit, status)


@app.get("/api/waves/{wave_id}", response_model=schemas.WaveDetailResponse, summary="查询波次详情")
def get_wave(wave_id: int, db: Session = Depends(get_db)):
    wave = services.get_wave(db, wave_id)
    if not wave:
        raise HTTPException(status_code=404, detail="波次不存在")
    return wave


@app.get("/api/waves/code/{wave_code}", response_model=schemas.WaveDetailResponse, summary="根据编码查询波次")
def get_wave_by_code(wave_code: str, db: Session = Depends(get_db)):
    wave = services.get_wave_by_code(db, wave_code)
    if not wave:
        raise HTTPException(status_code=404, detail="波次不存在")
    return wave


@app.put("/api/waves/{wave_id}/status", response_model=schemas.WaveResponse, summary="更新波次状态")
def update_wave_status(wave_id: int, status: str, db: Session = Depends(get_db)):
    try:
        return services.update_wave_status(db, wave_id, status)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/waves/{wave_id}/pick-tasks", response_model=List[schemas.PickTaskResponse], summary="查询波次拣货任务")
def list_wave_pick_tasks(wave_id: int, status: Optional[str] = None, db: Session = Depends(get_db)):
    return services.list_pick_tasks(db, wave_id, status)


@app.put("/api/pick-tasks/{task_id}", response_model=schemas.PickTaskResponse, summary="更新拣货任务")
def update_pick_task(task_id: int, update: schemas.PickTaskUpdate, db: Session = Depends(get_db)):
    try:
        return services.update_pick_task(db, task_id, update)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/stock-split/", response_model=schemas.PickTaskResponse, summary="缺货拆单")
def stock_split(split_request: schemas.StockSplitRequest, db: Session = Depends(get_db)):
    try:
        return services.process_stock_split(db, split_request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/review-diffs/", response_model=schemas.ReviewDiffResponse, summary="创建复核差异")
def create_review_diff(diff: schemas.ReviewDiffCreate, db: Session = Depends(get_db)):
    try:
        return services.create_review_diff(db, diff)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/review-diffs/", response_model=List[schemas.ReviewDiffResponse], summary="查询复核差异列表")
def list_review_diffs(
    wave_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
):
    return services.list_review_diffs(db, wave_id, status)


@app.put("/api/review-diffs/{diff_id}/resolve", response_model=schemas.ReviewDiffResponse, summary="解决复核差异")
def resolve_review_diff(diff_id: int, resolve: schemas.ReviewDiffResolve, db: Session = Depends(get_db)):
    try:
        return services.resolve_review_diff(db, diff_id, resolve)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/waves/{wave_id}/completion-report", response_model=schemas.CompletionReportResponse, summary="获取波次完成报告")
def get_completion_report(wave_id: int, db: Session = Depends(get_db)):
    report = services.get_completion_report(db, wave_id)
    if not report:
        raise HTTPException(status_code=404, detail="完成报告不存在")
    return report


@app.post("/api/manual-correction/", response_model=schemas.PickTaskResponse, summary="人工修正")
def manual_correction(correction: schemas.ManualCorrectionRequest, db: Session = Depends(get_db)):
    try:
        return services.manual_correction(db, correction)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/exceptions/", response_model=List[schemas.ExceptionLogResponse], summary="查询异常记录")
def list_exceptions(
    wave_id: Optional[int] = None,
    is_handled: Optional[bool] = None,
    db: Session = Depends(get_db),
):
    return services.list_exception_logs(db, wave_id, is_handled)


@app.put("/api/exceptions/{exception_id}/handle", response_model=schemas.ExceptionLogResponse, summary="处理异常记录")
def handle_exception(exception_id: int, handle: schemas.ExceptionLogHandle, db: Session = Depends(get_db)):
    try:
        return services.handle_exception_log(db, exception_id, handle)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/waves/{wave_id}/export", summary="导出波次数据")
def export_wave(wave_id: int, format: str = "json", db: Session = Depends(get_db)):
    try:
        data = services.export_wave_data(db, wave_id)

        if format == "json":
            return JSONResponse(content=data)

        elif format == "excel":
            output = BytesIO()
            with pd.ExcelWriter(output, engine="openpyxl") as writer:
                wave_df = pd.DataFrame([{
                    "波次编码": data["wave_code"],
                    "状态": data["status"],
                    "订单总数": data["total_orders"],
                    "SKU总数": data["total_skus"],
                    "商品总数": data["total_qty"],
                    "已拣数量": data["picked_qty"],
                    "已复核数量": data["reviewed_qty"],
                    "创建时间": data["created_at"],
                    "完成时间": data["completed_at"],
                }])
                wave_df.to_excel(writer, sheet_name="波次概览", index=False)

                orders_data = []
                for order in data["orders"]:
                    for item in order["items"]:
                        orders_data.append({
                            "订单号": order["order_no"],
                            "客户": order["customer"],
                            "订单状态": order["status"],
                            "SKU": item["sku"],
                            "商品名称": item["sku_name"],
                            "数量": item["qty"],
                            "已拣数量": item["picked_qty"],
                            "库位": item["location_code"],
                        })
                pd.DataFrame(orders_data).to_excel(writer, sheet_name="订单明细", index=False)

                tasks_df = pd.DataFrame(data["pick_tasks"])
                tasks_df.columns = ["任务编码", "SKU", "商品名称", "库位", "需求数量", "已拣数量", "状态", "拣货员"]
                tasks_df.to_excel(writer, sheet_name="拣货任务", index=False)

                diffs_df = pd.DataFrame(data["review_diffs"])
                if not diffs_df.empty:
                    diffs_df.columns = ["差异编码", "SKU", "期望数量", "实际数量", "差异数量", "差异类型", "状态", "解决方案"]
                    diffs_df.to_excel(writer, sheet_name="复核差异", index=False)

            output.seek(0)
            return Response(
                content=output.getvalue(),
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={"Content-Disposition": f"attachment; filename=wave_{wave_id}.xlsx"}
            )

        else:
            raise HTTPException(status_code=400, detail="不支持的导出格式")

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
