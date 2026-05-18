from datetime import datetime
from typing import List, Optional
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import Response
import pandas as pd
from io import BytesIO

from app.models import (
    QueuePriority, QueuePriorityCreate, QueuePriorityReview,
    QueuePriorityRestore, PriorityStatus, PriorityReportItem
)
from app.database import db
from app.sample_data import load_sample_data

app = FastAPI(title="模型服务网关推理队列优先级调整 API", version="1.0.0")


@app.on_event("startup")
async def startup_event():
    load_sample_data()


@app.post("/api/v1/priority", response_model=QueuePriority, summary="申请队列优先级调整")
async def create_priority_request(request: QueuePriorityCreate):
    record = db.create_priority_request(request)
    risk_check = db.check_priority_risk(record)
    if risk_check["needs_review"]:
        record.review_comment = " | ".join(risk_check["messages"])
    return record


@app.get("/api/v1/priority", response_model=List[QueuePriority], summary="查询优先级调整列表")
async def list_priority_requests(
    status: Optional[PriorityStatus] = Query(None, description="状态过滤"),
    tenant_id: Optional[str] = Query(None, description="租户ID过滤"),
    model_name: Optional[str] = Query(None, description="模型名称过滤")
):
    return db.list_records(status, tenant_id, model_name)


@app.get("/api/v1/priority/{record_id}", response_model=QueuePriority, summary="查询单个优先级调整详情")
async def get_priority_request(record_id: str):
    record = db.get_record(record_id)
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")
    return record


@app.post("/api/v1/priority/{record_id}/review", response_model=QueuePriority, summary="审批优先级调整申请")
async def review_priority_request(record_id: str, review: QueuePriorityReview):
    record = db.get_record(record_id)
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")
    if record.status != PriorityStatus.PENDING:
        raise HTTPException(status_code=400, detail="只有待审批的记录才能审批")
    
    risk_check = db.check_priority_risk(record)
    if risk_check["needs_review"] and review.approved:
        review.comment = (review.comment or "") + f" [风险提示: {', '.join(risk_check['messages'])}]"
    
    return db.review_priority(record_id, review)


@app.post("/api/v1/priority/{record_id}/apply", response_model=QueuePriority, summary="生效优先级调整")
async def apply_priority(record_id: str):
    record = db.get_record(record_id)
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")
    if record.status != PriorityStatus.APPROVED:
        raise HTTPException(status_code=400, detail="只有已审批的申请才能生效")
    
    risk_check = db.check_priority_risk(record)
    if risk_check["risk_level"] == "high":
        raise HTTPException(
            status_code=403,
            detail=f"存在高风险，无法生效: {', '.join(risk_check['messages'])}。请进入复核流程。"
        )
    
    return db.apply_priority(record_id)


@app.post("/api/v1/priority/{record_id}/restore", response_model=QueuePriority, summary="恢复队列优先级")
async def restore_priority(record_id: str, restore: QueuePriorityRestore):
    record = db.get_record(record_id)
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")
    if record.status != PriorityStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="只有生效中的记录才能恢复")
    return db.restore_priority(record_id, restore)


@app.get("/api/v1/priority/{record_id}/history", summary="查看优先级调整历史")
async def get_priority_history(record_id: str):
    record = db.get_record(record_id)
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")
    history = db.get_history(record_id)
    return {
        "record_id": record_id,
        "history": [
            {
                "action": h["action"],
                "detail": h["detail"],
                "timestamp": h["timestamp"].strftime("%Y-%m-%d %H:%M:%S")
            }
            for h in history
        ]
    }


@app.get("/api/v1/priority/{record_id}/risk", summary="检查优先级调整风险")
async def check_priority_risk(record_id: str):
    record = db.get_record(record_id)
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")
    return db.check_priority_risk(record)


@app.get("/api/v1/report/priority", response_model=List[PriorityReportItem], summary="导出队列优先级报表")
async def get_priority_report():
    return db.generate_report()


@app.get("/api/v1/report/priority/export", summary="导出 Excel 报表")
async def export_priority_report():
    report_data = db.generate_report()
    df = pd.DataFrame([item.dict() for item in report_data])
    
    output = BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='队列优先级报表')
    
    output.seek(0)
    filename = f"priority_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    
    return Response(
        content=output.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@app.get("/health")
async def health_check():
    return {"status": "ok", "timestamp": datetime.now().isoformat()}
