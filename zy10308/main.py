from fastapi import FastAPI, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
import json

from models import init_db, get_db, MessageStatus
from schemas import (
    MessageCreate, MessageResponse, MessageDetailResponse,
    StatusUpdate, ReceiptCreate, ReceiptResponse,
    StatusHistoryResponse, MessageQuery
)
from service import IdempotentInboxService

class MessageCreateResponse(BaseModel):
    id: int
    message_id: str
    source: str
    business_key: str
    status: str
    deduplication_window: int
    retry_count: int
    max_retries: int
    failure_reason: Optional[str]
    created_at: str
    updated_at: str
    processed_at: Optional[str]
    is_new: bool = True
    message: Optional[str] = None

app = FastAPI(title="消息幂等收件箱 API", version="1.0.0")

@app.on_event("startup")
def startup():
    init_db()

@app.post("/messages", response_model=MessageCreateResponse, summary="创建消息（幂等）")
def create_message(message_data: MessageCreate, db: Session = Depends(get_db)):
    service = IdempotentInboxService(db)
    message, is_new = service.create_message(message_data)
    
    result = MessageCreateResponse(
        id=message.id,
        message_id=message.message_id,
        source=message.source,
        business_key=message.business_key,
        status=message.status.value,
        deduplication_window=message.deduplication_window,
        retry_count=message.retry_count,
        max_retries=message.max_retries,
        failure_reason=message.failure_reason,
        created_at=message.created_at.isoformat(),
        updated_at=message.updated_at.isoformat(),
        processed_at=message.processed_at.isoformat() if message.processed_at else None,
        is_new=is_new,
        message=None if is_new else "消息已存在（幂等返回）"
    )
    
    if not is_new:
        return JSONResponse(
            status_code=200,
            content=result.dict()
        )
    return result

@app.get("/messages/{message_id}", response_model=MessageDetailResponse, summary="查询消息详情")
def get_message(message_id: str, db: Session = Depends(get_db)):
    service = IdempotentInboxService(db)
    message = service.get_message(message_id=message_id)
    if not message:
        raise HTTPException(status_code=404, detail="消息不存在")
    return message

@app.post("/messages/query", summary="查询消息列表")
def query_messages(query_params: MessageQuery, db: Session = Depends(get_db)):
    service = IdempotentInboxService(db)
    messages, total = service.query_messages(query_params)
    return {
        "total": total,
        "page": query_params.page,
        "page_size": query_params.page_size,
        "data": [MessageResponse.from_orm(m).dict() for m in messages]
    }

@app.patch("/messages/{db_id}/status", response_model=MessageResponse, summary="更新消息状态")
def update_status(db_id: int, status_update: StatusUpdate, db: Session = Depends(get_db)):
    service = IdempotentInboxService(db)
    message, msg = service.update_status(db_id, status_update)
    if not message:
        raise HTTPException(status_code=400, detail=msg)
    return message

@app.post("/messages/{db_id}/processing", response_model=MessageResponse, summary="标记为处理中")
def mark_processing(db_id: int, operator: str = None, db: Session = Depends(get_db)):
    service = IdempotentInboxService(db)
    message, msg = service.mark_processing(db_id, operator)
    if not message:
        raise HTTPException(status_code=400, detail=msg)
    return message

@app.post("/messages/{db_id}/success", response_model=MessageResponse, summary="标记处理成功")
def mark_success(db_id: int, operator: str = None, db: Session = Depends(get_db)):
    service = IdempotentInboxService(db)
    message, msg = service.mark_success(db_id, operator)
    if not message:
        raise HTTPException(status_code=400, detail=msg)
    return message

@app.post("/messages/{db_id}/failed", response_model=MessageResponse, summary="标记处理失败")
def mark_failed(db_id: int, failure_reason: str, operator: str = None, db: Session = Depends(get_db)):
    service = IdempotentInboxService(db)
    message, msg = service.mark_failed(db_id, failure_reason, operator)
    if not message:
        raise HTTPException(status_code=400, detail=msg)
    return message

@app.post("/messages/{db_id}/retry", response_model=MessageResponse, summary="重试失败消息")
def retry_message(db_id: int, operator: str = None, db: Session = Depends(get_db)):
    service = IdempotentInboxService(db)
    message, msg = service.retry(db_id, operator)
    if not message:
        raise HTTPException(status_code=400, detail=msg)
    return message

@app.post("/messages/{db_id}/cancel", response_model=MessageResponse, summary="撤销消息")
def cancel_message(db_id: int, reason: str = "手动撤销", operator: str = None, db: Session = Depends(get_db)):
    service = IdempotentInboxService(db)
    message, msg = service.cancel(db_id, reason, operator)
    if not message:
        raise HTTPException(status_code=400, detail=msg)
    return message

@app.post("/messages/{db_id}/receipts", response_model=ReceiptResponse, summary="添加回执记录")
def add_receipt(db_id: int, receipt_data: ReceiptCreate, db: Session = Depends(get_db)):
    service = IdempotentInboxService(db)
    receipt, msg = service.add_receipt(db_id, receipt_data)
    if not receipt:
        raise HTTPException(status_code=400, detail=msg)
    return receipt

@app.get("/messages/{db_id}/history", response_model=List[StatusHistoryResponse], summary="查询状态历史")
def get_status_history(db_id: int, db: Session = Depends(get_db)):
    service = IdempotentInboxService(db)
    message = service.get_message(db_id=db_id)
    if not message:
        raise HTTPException(status_code=404, detail="消息不存在")
    return message.status_history

@app.get("/export", summary="导出全部消息数据")
def export_all(db: Session = Depends(get_db)):
    service = IdempotentInboxService(db)
    data = service.export_messages()
    return JSONResponse(
        content=data,
        headers={
            "Content-Disposition": "attachment; filename=messages_export.json"
        }
    )

@app.get("/health", summary="健康检查")
def health_check():
    return {"status": "ok", "service": "消息幂等收件箱 API"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
