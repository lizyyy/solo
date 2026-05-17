from typing import List, Optional
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel
from models import TransferStatus, ErrorType, TransferOrder, TransferHistory
from service import transfer_service
from database import repository

app = FastAPI(title="门店库存中台跨仓调拨锁定 API", version="1.0.0")


class ImportRow(BaseModel):
    source_warehouse: str
    target_warehouse: str
    sku: str
    sku_name: Optional[str] = None
    quantity: int
    remark: Optional[str] = None


class BatchImportRequest(BaseModel):
    data: List[ImportRow]
    operator: Optional[str] = None


class CreateTransferRequest(BaseModel):
    source_warehouse: str
    target_warehouse: str
    sku: str
    sku_name: Optional[str] = None
    quantity: int
    remark: Optional[str] = None
    operator: Optional[str] = None


class AddRemarkRequest(BaseModel):
    remark: str
    operator: Optional[str] = None
    resolve_manual: bool = False


class OperationRequest(BaseModel):
    operator: Optional[str] = None


class ErrorResponse(BaseModel):
    error_code: str
    error_message: str
    error_type: str
    action: str
    transfer_id: Optional[str] = None


@app.post("/api/v1/transfers/batch-import", summary="批量导入调拨单")
async def batch_import(request: BatchImportRequest):
    import_data = [row.dict() for row in request.data]
    result = transfer_service.batch_import(import_data, request.operator)
    return {
        "code": 0,
        "message": "导入完成",
        "data": {
            "success_count": result.success_count,
            "failed_count": result.failed_count,
            "total_count": result.total_count,
            "failed_rows": result.failed_rows,
            "success_ids": result.success_ids
        }
    }


@app.post("/api/v1/transfers", summary="创建单笔调拨单")
async def create_transfer(request: CreateTransferRequest):
    try:
        transfer = transfer_service.create_single_transfer(request.dict(), request.operator)
        return {"code": 0, "message": "创建成功", "data": transfer}
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=ErrorResponse(
                error_code="CREATE_FAILED",
                error_message=str(e),
                error_type=ErrorType.DATA_ERROR.value,
                action="补数据"
            ).dict()
        )


@app.get("/api/v1/transfers", summary="查询调拨单列表")
async def list_transfers(
    status: Optional[TransferStatus] = Query(None, description="状态筛选"),
    source_warehouse: Optional[str] = Query(None, description="源仓库"),
    target_warehouse: Optional[str] = Query(None, description="目标仓库"),
    sku: Optional[str] = Query(None, description="SKU编码"),
    need_manual: Optional[bool] = Query(None, description="是否待人工处理")
):
    transfers = repository.list_transfers(status, source_warehouse, target_warehouse, sku, need_manual)
    return {"code": 0, "message": "查询成功", "data": transfers}


@app.get("/api/v1/transfers/{transfer_id}", summary="查询调拨单详情")
async def get_transfer(transfer_id: str):
    transfer = repository.get_transfer(transfer_id)
    if not transfer:
        raise HTTPException(
            status_code=404,
            detail=ErrorResponse(
                error_code="NOT_FOUND",
                error_message="调拨单不存在",
                error_type=ErrorType.DATA_ERROR.value,
                action="补数据"
            ).dict()
        )
    return {"code": 0, "message": "查询成功", "data": transfer}


@app.get("/api/v1/transfers/{transfer_id}/history", summary="查询调拨单操作历史")
async def get_transfer_history(transfer_id: str):
    transfer = repository.get_transfer(transfer_id)
    if not transfer:
        raise HTTPException(status_code=404, detail="调拨单不存在")
    histories = repository.get_transfer_history(transfer_id)
    return {"code": 0, "message": "查询成功", "data": histories}


@app.post("/api/v1/transfers/{transfer_id}/audit-lock", summary="审核并锁定库存")
async def audit_and_lock(transfer_id: str, request: OperationRequest):
    try:
        transfer = transfer_service.audit_and_lock(transfer_id, request.operator)
        return {"code": 0, "message": "锁定成功", "data": transfer}
    except ValueError as e:
        raise HTTPException(
            status_code=409,
            detail=ErrorResponse(
                error_code="LOCK_FAILED",
                error_message=str(e),
                error_type=ErrorType.STOCK_CONFLICT.value,
                action="转人工",
                transfer_id=transfer_id
            ).dict()
        )


@app.post("/api/v1/transfers/{transfer_id}/mark-in-transit", summary="标记在途")
async def mark_in_transit(transfer_id: str, request: OperationRequest):
    try:
        transfer = transfer_service.mark_in_transit(transfer_id, request.operator)
        return {"code": 0, "message": "标记成功", "data": transfer}
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=ErrorResponse(
                error_code="IN_TRANSIT_FAILED",
                error_message=str(e),
                error_type=ErrorType.DATA_ERROR.value,
                action="补数据"
            ).dict()
        )


@app.post("/api/v1/transfers/{transfer_id}/complete", summary="完成调拨")
async def complete_transfer(transfer_id: str, request: OperationRequest):
    try:
        transfer = transfer_service.complete_transfer(transfer_id, request.operator)
        return {"code": 0, "message": "完成成功", "data": transfer}
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=ErrorResponse(
                error_code="COMPLETE_FAILED",
                error_message=str(e),
                error_type=ErrorType.DATA_ERROR.value,
                action="补数据"
            ).dict()
        )


@app.post("/api/v1/transfers/{transfer_id}/remark", summary="添加人工备注")
async def add_remark(transfer_id: str, request: AddRemarkRequest):
    try:
        transfer = transfer_service.add_manual_remark(
            transfer_id, request.remark, request.operator, request.resolve_manual
        )
        return {"code": 0, "message": "备注添加成功", "data": transfer}
    except ValueError as e:
        raise HTTPException(
            status_code=404,
            detail=ErrorResponse(
                error_code="REMARK_FAILED",
                error_message=str(e),
                error_type=ErrorType.DATA_ERROR.value,
                action="补数据"
            ).dict()
        )


@app.post("/api/v1/transfers/{transfer_id}/retry", summary="重试待人工调拨单")
async def retry_transfer(transfer_id: str, request: OperationRequest):
    try:
        transfer = transfer_service.retry_failed_transfer(transfer_id, request.operator)
        return {"code": 0, "message": "重试成功", "data": transfer}
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=ErrorResponse(
                error_code="RETRY_FAILED",
                error_message=str(e),
                error_type=ErrorType.STOCK_CONFLICT.value,
                action="转人工"
            ).dict()
        )


@app.get("/api/v1/transfers/export", summary="导出调拨单")
async def export_transfers(
    status: Optional[TransferStatus] = Query(None, description="状态筛选"),
    source_warehouse: Optional[str] = Query(None, description="源仓库"),
    target_warehouse: Optional[str] = Query(None, description="目标仓库")
):
    data = transfer_service.export_transfers(status, source_warehouse, target_warehouse)
    return {
        "code": 0,
        "message": "导出成功",
        "data": data,
        "columns": list(data[0].keys()) if data else []
    }


@app.get("/api/v1/stocks", summary="查询库存")
async def get_stocks(sku: Optional[str] = None, warehouse: Optional[str] = None):
    stocks = []
    for key, stock in repository._stocks.items():
        if sku and stock.sku != sku:
            continue
        if warehouse and stock.warehouse != warehouse:
            continue
        stocks.append(stock)
    return {"code": 0, "message": "查询成功", "data": stocks}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
