from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List
from database import get_db, init_db
from models import (
    RecallTaskCreate, ErrorResponse, ErrorCode,
    RecallResult
)
from services import BatchRecallService
import uvicorn

app = FastAPI(title="批号召回拆包链路客户去向API", version="1.0.0")


@app.on_event("startup")
async def startup_event():
    init_db()


@app.post("/api/v1/import/inbound-orders", response_model=dict)
async def import_inbound_orders(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    content = await file.read()
    jsonl_content = content.decode('utf-8')
    
    service = BatchRecallService(db)
    count, errors = service.import_inbound_orders_jsonl(jsonl_content)
    
    return {
        "success": len(errors) == 0,
        "imported_count": count,
        "error_count": len(errors),
        "errors": [e.dict() for e in errors]
    }


@app.post("/api/v1/import/unpack-records", response_model=dict)
async def import_unpack_records(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    content = await file.read()
    jsonl_content = content.decode('utf-8')
    
    service = BatchRecallService(db)
    count, errors = service.import_unpack_records_jsonl(jsonl_content)
    
    return {
        "success": len(errors) == 0,
        "imported_count": count,
        "error_count": len(errors),
        "errors": [e.dict() for e in errors]
    }


@app.post("/api/v1/import/outbound-orders", response_model=dict)
async def import_outbound_orders(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    content = await file.read()
    jsonl_content = content.decode('utf-8')
    
    service = BatchRecallService(db)
    count, errors = service.import_outbound_orders_jsonl(jsonl_content)
    
    return {
        "success": len(errors) == 0,
        "imported_count": count,
        "error_count": len(errors),
        "errors": [e.dict() for e in errors]
    }


@app.post("/api/v1/recall", response_model=RecallResult)
async def create_recall_task(
    task_create: RecallTaskCreate,
    db: Session = Depends(get_db)
):
    if not task_create.batch_number:
        raise HTTPException(
            status_code=400,
            detail=ErrorResponse(
                error_code=ErrorCode.MISSING_FIELD,
                message="批号不能为空",
                details={"field": "batch_number"}
            ).dict()
        )
    
    service = BatchRecallService(db)
    result, error = service.create_recall_task(
        task_create.batch_number,
        task_create.reason,
        task_create.operator
    )
    
    if error:
        status_code = 400
        if error.error_code == ErrorCode.NEEDS_MANUAL_REVIEW:
            status_code = 409
        elif error.error_code == ErrorCode.ALREADY_PROCESSED:
            status_code = 409
        elif error.error_code == ErrorCode.RESOURCE_NOT_FOUND:
            status_code = 404
        
        raise HTTPException(status_code=status_code, detail=error.dict())
    
    return result


@app.get("/api/v1/recall/{task_id}")
async def get_recall_task(
    task_id: str,
    db: Session = Depends(get_db)
):
    service = BatchRecallService(db)
    task = service.get_recall_task(task_id)
    
    if not task:
        raise HTTPException(
            status_code=404,
            detail=ErrorResponse(
                error_code=ErrorCode.RESOURCE_NOT_FOUND,
                message="召回任务不存在",
                details={"task_id": task_id}
            ).dict()
        )
    
    return {
        "id": task.id,
        "batch_number": task.batch_number,
        "reason": task.reason,
        "status": task.status,
        "created_at": task.created_at,
        "completed_at": task.completed_at,
        "operator": task.operator,
        "requires_manual_review": task.requires_manual_review,
        "review_notes": task.review_notes,
        "total_affected_quantity": task.total_affected_quantity,
        "total_customers_affected": task.total_customers_affected
    }


@app.get("/api/v1/recall/{task_id}/report")
async def export_recall_report(
    task_id: str,
    db: Session = Depends(get_db)
):
    service = BatchRecallService(db)
    report = service.export_recall_report_json(task_id)
    
    if not report:
        raise HTTPException(
            status_code=404,
            detail=ErrorResponse(
                error_code=ErrorCode.RESOURCE_NOT_FOUND,
                message="召回报告不存在",
                details={"task_id": task_id}
            ).dict()
        )
    
    return JSONResponse(content=report)


@app.get("/api/v1/batch/{batch_number}/trace")
async def trace_batch_chain(
    batch_number: str,
    db: Session = Depends(get_db)
):
    service = BatchRecallService(db)
    chain, requires_review = service.trace_batch_chain(batch_number)
    destinations = service.get_customer_destinations(chain)
    
    return {
        "batch_number": batch_number,
        "requires_manual_review": requires_review,
        "batch_chain": [node.dict() for node in chain],
        "customer_destinations": [dest.dict() for dest in destinations]
    }


@app.get("/api/v1/health")
async def health_check():
    return {"status": "healthy", "service": "batch-recall-api"}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
