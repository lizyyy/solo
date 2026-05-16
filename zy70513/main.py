from fastapi import FastAPI, HTTPException, Query
from typing import Optional, List
from datetime import datetime

from models import (
    ConfigReceipt, ConfigReceiptCreate, ConfigReceiptQuery,
    ReceiptStatus, StatusUpdateRequest, ManualCorrectionRequest,
    ReceiptSummary
)
from service import ConfigReceiptService

app = FastAPI(title="配置快照签收API", description="用于追踪和确认配置变更的签收状态")
service = ConfigReceiptService()


@app.post("/api/receipts", response_model=ConfigReceipt, summary="创建签收记录")
async def create_receipt(data: ConfigReceiptCreate):
    return service.create_receipt(data)


@app.get("/api/receipts", response_model=List[ConfigReceipt], summary="查询签收记录列表")
async def query_receipts(
    service_name: Optional[str] = None,
    config_version: Optional[str] = None,
    snapshot_version: Optional[str] = None,
    instance_id: Optional[str] = None,
    status: Optional[ReceiptStatus] = None,
    has_diff: Optional[bool] = None
):
    query = ConfigReceiptQuery(
        service_name=service_name,
        config_version=config_version,
        snapshot_version=snapshot_version,
        instance_id=instance_id,
        status=status,
        has_diff=has_diff
    )
    return service.query_receipts(query)


@app.get("/api/receipts/timeout", response_model=List[ConfigReceipt], summary="获取超时记录")
async def get_timeout_receipts():
    return service.get_timeout_receipts()


@app.get("/api/receipts/{receipt_id}", response_model=ConfigReceipt, summary="查询单个签收记录")
async def get_receipt(receipt_id: str):
    receipt = service.get_receipt(receipt_id)
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
    return receipt


@app.put("/api/receipts/{receipt_id}/status", response_model=ConfigReceipt, summary="状态推进")
async def update_status(receipt_id: str, request: StatusUpdateRequest):
    receipt = service.update_status(receipt_id, request)
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
    return receipt


@app.post("/api/receipts/{receipt_id}/exception", response_model=ConfigReceipt, summary="异常处理")
async def handle_exception(
    receipt_id: str,
    reason: str,
    operator: Optional[str] = None,
    final_conclusion: Optional[str] = None
):
    receipt = service.handle_exception(
        receipt_id=receipt_id,
        reason=reason,
        operator=operator,
        processing_basis={"exception_time": datetime.now().isoformat()},
        final_conclusion=final_conclusion
    )
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
    return receipt


@app.post("/api/receipts/{receipt_id}/manual-correction", response_model=ConfigReceipt, summary="人工修正")
async def manual_correction(receipt_id: str, request: ManualCorrectionRequest):
    receipt = service.manual_correction(receipt_id, request)
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
    return receipt


@app.post("/api/receipts/{receipt_id}/revoke", response_model=ConfigReceipt, summary="撤销签收")
async def revoke_receipt(receipt_id: str, operator: str, reason: str):
    receipt = service.revoke_receipt(receipt_id, operator, reason)
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
    return receipt


@app.get("/api/summary", response_model=List[ReceiptSummary], summary="获取签收汇总")
async def get_summary(
    service_name: Optional[str] = None,
    config_version: Optional[str] = None,
    snapshot_version: Optional[str] = None
):
    return service.get_summary(service_name, config_version, snapshot_version)


@app.get("/api/export", summary="导出签收记录")
async def export_receipts(
    service_name: Optional[str] = None,
    config_version: Optional[str] = None,
    snapshot_version: Optional[str] = None,
    instance_id: Optional[str] = None,
    status: Optional[ReceiptStatus] = None,
    format: str = Query("json", enum=["json", "csv"])
):
    query = ConfigReceiptQuery(
        service_name=service_name,
        config_version=config_version,
        snapshot_version=snapshot_version,
        instance_id=instance_id,
        status=status
    )
    result = service.export_receipts(query, fmt=format)
    if format == "csv":
        from fastapi.responses import PlainTextResponse
        return PlainTextResponse(content=result, media_type="text/csv")
    return {"data": result}


@app.get("/api/statuses", summary="获取所有状态枚举")
async def get_statuses():
    return {
        "statuses": [s.value for s in ReceiptStatus],
        "description": {
            "pending": "待处理 - 实例已上报但未完成校验",
            "confirmed": "已确认 - 配置校验通过，快照已正确签收",
            "blocked": "被拦截 - 出现异常或校验失败，需要人工介入",
            "revoked": "已撤销 - 该签收记录已作废",
            "compensated": "已补偿 - 问题已通过人工方式修正"
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
