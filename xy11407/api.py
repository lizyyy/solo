import csv
import io
from typing import Optional
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
from core import QueueService
from models import (
    MedicineRecordCreate, QueueStatus, RetryCategory,
    QueueItemResponse, StatusHistoryResponse, RetryLogResponse,
    SupervisorStats
)

app = FastAPI(title="乡镇药房近效期重试补偿队列 API")
service = QueueService()


class ReceiptSubmitRequest(BaseModel):
    receipt_no: str
    receipt_data: dict
    operator: Optional[str] = None


class RetryRequest(BaseModel):
    retry_category: RetryCategory
    error_message: Optional[str] = None
    response_data: Optional[dict] = None
    success: bool = False


class ManualTakeoverRequest(BaseModel):
    handler: str
    notes: Optional[str] = None


class CompensationRequest(BaseModel):
    compensated_quantity: float
    compensated_amount: float
    compensation_rules: dict
    operator: str
    notes: Optional[str] = None


class CloseRequest(BaseModel):
    operator: str
    reason: str


class DirtyResolveRequest(BaseModel):
    resolver: str
    processing_opinion: str
    corrected_content: dict


@app.post("/api/records", response_model=dict, status_code=201)
def create_record(data: MedicineRecordCreate, operator: Optional[str] = Query(None)):
    try:
        record = service.create_medicine_record(data, operator)
        return {"id": record.id, "record_no": record.record_no}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/records/{record_id}/enqueue", response_model=QueueItemResponse)
def enqueue_record(record_id: int, region_id: Optional[str] = None, max_retries: int = 5):
    try:
        item = service.enqueue_record(record_id, region_id, max_retries)
        return QueueItemResponse(
            id=item.id,
            queue_no=item.queue_no,
            record_id=item.record_id,
            store_id=item.store_id,
            status=item.status,
            retry_count=item.retry_count,
            max_retries=item.max_retries,
            retry_category=item.retry_category,
            created_at=item.created_at,
            updated_at=item.updated_at
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/queue/{queue_item_id}/receipt", response_model=QueueItemResponse)
def submit_receipt(queue_item_id: int, req: ReceiptSubmitRequest):
    try:
        item = service.submit_external_receipt(
            queue_item_id, req.receipt_no, req.receipt_data, req.operator
        )
        return QueueItemResponse(
            id=item.id,
            queue_no=item.queue_no,
            record_id=item.record_id,
            store_id=item.store_id,
            status=item.status,
            retry_count=item.retry_count,
            max_retries=item.max_retries,
            retry_category=item.retry_category,
            created_at=item.created_at,
            updated_at=item.updated_at
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/queue/{queue_item_id}/retry")
def process_retry(queue_item_id: int, req: RetryRequest):
    try:
        item, log = service.process_retry(
            queue_item_id, req.retry_category,
            req.error_message, req.response_data, req.success
        )
        return {
            "queue_item": {
                "id": item.id,
                "status": item.status,
                "retry_count": item.retry_count
            },
            "retry_log": {
                "id": log.id,
                "attempt_no": log.attempt_no,
                "success": log.success
            }
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/queue/{queue_item_id}/manual", response_model=QueueItemResponse)
def manual_takeover(queue_item_id: int, req: ManualTakeoverRequest):
    try:
        item = service.manual_takeover(queue_item_id, req.handler, req.notes)
        return QueueItemResponse(
            id=item.id,
            queue_no=item.queue_no,
            record_id=item.record_id,
            store_id=item.store_id,
            status=item.status,
            retry_count=item.retry_count,
            max_retries=item.max_retries,
            retry_category=item.retry_category,
            created_at=item.created_at,
            updated_at=item.updated_at
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/queue/{queue_item_id}/compensate")
def compensate(queue_item_id: int, req: CompensationRequest):
    try:
        item, comp = service.compensate_record(
            queue_item_id, req.compensated_quantity, req.compensated_amount,
            req.compensation_rules, req.operator, req.notes
        )
        return {
            "queue_item": {
                "id": item.id,
                "status": item.status,
                "current_quantity": item.current_quantity,
                "current_amount": item.current_amount
            },
            "compensation": {
                "id": comp.id,
                "compensation_no": comp.compensation_no,
                "compensated_quantity": comp.compensated_quantity,
                "compensated_amount": comp.compensated_amount
            }
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/queue/{queue_item_id}/close", response_model=QueueItemResponse)
def close_item(queue_item_id: int, req: CloseRequest):
    try:
        item = service.close_queue_item(queue_item_id, req.operator, req.reason)
        return QueueItemResponse(
            id=item.id,
            queue_no=item.queue_no,
            record_id=item.record_id,
            store_id=item.store_id,
            status=item.status,
            retry_count=item.retry_count,
            max_retries=item.max_retries,
            retry_category=item.retry_category,
            created_at=item.created_at,
            updated_at=item.updated_at
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/queue/{queue_item_id}/dead-letter", response_model=QueueItemResponse)
def move_to_dead_letter(queue_item_id: int, req: CloseRequest):
    try:
        item = service.move_to_dead_letter(queue_item_id, req.operator, req.reason)
        return QueueItemResponse(
            id=item.id,
            queue_no=item.queue_no,
            record_id=item.record_id,
            store_id=item.store_id,
            status=item.status,
            retry_count=item.retry_count,
            max_retries=item.max_retries,
            retry_category=item.retry_category,
            created_at=item.created_at,
            updated_at=item.updated_at
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/queue/{queue_item_id}")
def get_queue_detail(queue_item_id: int):
    try:
        return service.get_queue_item_detail(queue_item_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/api/queue/{queue_item_id}/history", response_model=list[StatusHistoryResponse])
def get_history(queue_item_id: int):
    try:
        history = service.get_queue_item_history(queue_item_id)
        return [StatusHistoryResponse(**h) for h in history]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/queue/{queue_item_id}/retries", response_model=list[RetryLogResponse])
def get_retries(queue_item_id: int):
    try:
        logs = service.get_retry_logs(queue_item_id)
        return [RetryLogResponse(**l) for l in logs]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/queue")
def list_queue(
    status: Optional[str] = None,
    store_id: Optional[str] = None,
    region_id: Optional[str] = None,
    limit: int = 100,
    offset: int = 0
):
    items = service.list_queue_items(status, store_id, region_id, limit, offset)
    return [
        QueueItemResponse(
            id=item.id,
            queue_no=item.queue_no,
            record_id=item.record_id,
            store_id=item.store_id,
            status=item.status,
            retry_count=item.retry_count,
            max_retries=item.max_retries,
            retry_category=item.retry_category,
            created_at=item.created_at,
            updated_at=item.updated_at
        )
        for item in items
    ]


@app.get("/api/supervisor/stats", response_model=SupervisorStats)
def get_supervisor_stats(region_id: Optional[str] = None):
    return service.get_supervisor_stats(region_id)


@app.get("/api/export/json")
def export_json(status: Optional[str] = None, region_id: Optional[str] = None):
    data = service.export_queue_data(status, region_id)
    return JSONResponse(content=data)


@app.get("/api/export/csv")
def export_csv(status: Optional[str] = None, region_id: Optional[str] = None):
    data = service.export_queue_data(status, region_id)
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "队列编号", "状态", "重试次数", "门店ID",
        "药品名称", "批号", "有效期", "原始数量", "原始金额",
        "当前数量", "当前金额", "外部回执号", "创建时间"
    ])
    
    for item in data:
        writer.writerow([
            item["queue_no"],
            item["status"],
            item["retry_count"],
            item["store_id"],
            item["medicine"]["medicine_name"],
            item["medicine"]["batch_no"],
            item["medicine"]["expiry_date"],
            item["medicine"]["quantity"],
            item["medicine"]["amount"],
            item["current"]["quantity"],
            item["current"]["amount"],
            item["external"]["receipt_no"] or "",
            item["created_at"]
        ])
    
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=queue_export.csv"}
    )


@app.post("/api/dirty/{dirty_id}/resolve")
def resolve_dirty(dirty_id: int, req: DirtyResolveRequest):
    try:
        dirty = service.resolve_dirty_record(
            dirty_id, req.resolver, req.processing_opinion, req.corrected_content
        )
        return {
            "id": dirty.id,
            "status": dirty.status,
            "resolver": dirty.resolver,
            "resolved_at": dirty.resolved_at.isoformat() if dirty.resolved_at else None
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
