from fastapi import FastAPI, HTTPException, Query
from datetime import datetime
from typing import Optional
from contextlib import asynccontextmanager

from sla_models import (
    Ticket, Holiday, CustomerReply, PauseRequest, ResumeRequest,
    TimeCalculationRequest, TicketPriority, SLARule
)
from sla_service import SLAService

sla_service: SLAService = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global sla_service
    sla_service = SLAService()
    yield


app = FastAPI(
    title="工单SLA时钟API",
    description="客服系统SLA管理，支持节假日扣除、暂停等待、客户补充材料时间扣除",
    version="1.0.0",
    lifespan=lifespan
)


@app.get("/", summary="健康检查")
async def root():
    return {
        "service": "工单SLA时钟API",
        "version": "1.0.0",
        "status": "running"
    }


@app.post("/tickets", summary="创建工单")
async def create_ticket(
    title: str,
    description: str,
    priority: TicketPriority,
    sla_rule_id: Optional[str] = None
):
    result = sla_service.create_ticket(title, description, priority, sla_rule_id)
    if not result.success:
        raise HTTPException(status_code=400, detail={"message": result.message, "errors": result.errors})
    return result


@app.get("/tickets", summary="获取所有工单")
async def get_tickets():
    return sla_service.get_all_tickets()


@app.get("/tickets/{ticket_id}", summary="获取工单详情")
async def get_ticket(ticket_id: str):
    result = sla_service.get_ticket(ticket_id)
    if not result.success:
        raise HTTPException(status_code=404, detail={"message": result.message, "errors": result.errors})
    return result


@app.post("/tickets/{ticket_id}/start", summary="开始处理工单")
async def start_ticket(ticket_id: str):
    result = sla_service.start_ticket(ticket_id)
    if not result.success:
        raise HTTPException(status_code=400, detail={"message": result.message, "errors": result.errors})
    return result


@app.post("/tickets/pause", summary="暂停工单SLA")
async def pause_ticket(request: PauseRequest, force: bool = False):
    result = sla_service.pause_ticket(request, force)
    if not result.success:
        raise HTTPException(status_code=400, detail={"message": result.message, "errors": result.errors})
    return result


@app.post("/tickets/resume", summary="恢复工单SLA")
async def resume_ticket(request: ResumeRequest):
    result = sla_service.resume_ticket(request)
    if not result.success:
        raise HTTPException(status_code=400, detail={"message": result.message, "errors": result.errors})
    return result


@app.post("/tickets/{ticket_id}/complete", summary="完成工单")
async def complete_ticket(ticket_id: str):
    result = sla_service.complete_ticket(ticket_id)
    if not result.success:
        raise HTTPException(status_code=400, detail={"message": result.message, "errors": result.errors})
    return result


@app.post("/tickets/{ticket_id}/customer-reply", summary="记录客户回复")
async def add_customer_reply(ticket_id: str, content: str, auto_resume: bool = True):
    reply = CustomerReply(
        ticket_id=ticket_id,
        reply_time=datetime.now(),
        content=content,
        auto_resume_sla=auto_resume
    )
    result = sla_service.add_customer_reply(reply)
    if not result.success:
        raise HTTPException(status_code=400, detail={"message": result.message, "errors": result.errors})
    return result


@app.get("/tickets/{ticket_id}/pause-history", summary="获取暂停历史")
async def get_pause_history(ticket_id: str):
    return sla_service.get_pause_history(ticket_id)


@app.get("/tickets/{ticket_id}/customer-replies", summary="获取客户回复历史")
async def get_customer_replies(ticket_id: str):
    return sla_service.get_customer_replies(ticket_id)


@app.post("/time/calculate", summary="计算有效工作时间")
async def calculate_time(request: TimeCalculationRequest):
    result = sla_service.calculate_time(request)
    if not result.success:
        raise HTTPException(status_code=400, detail={"message": result.message, "errors": result.errors})
    return result


@app.get("/tickets/{ticket_id}/report", summary="生成SLA巡检报告")
async def generate_report(
    ticket_id: str,
    include_segments: bool = True,
    format: str = Query("all", pattern="^(all|json|markdown|summary|structured)$")
):
    result = sla_service.generate_report(ticket_id, include_segments=include_segments)
    if not result.success:
        raise HTTPException(status_code=400, detail={"message": result.message, "errors": result.errors})

    if format == "json":
        return {"success": True, "data": result.data["structured"]}
    elif format == "markdown":
        return {"success": True, "data": {"markdown": result.data["markdown"]}}
    elif format == "summary":
        return {"success": True, "data": {"summary": result.data["summary"]}}
    elif format == "structured":
        return {"success": True, "data": result.data["structured"]}

    return result


@app.get("/sla-rules", summary="获取所有SLA规则")
async def get_sla_rules():
    return sla_service.get_sla_rules()


@app.post("/sla-rules", summary="添加SLA规则")
async def add_sla_rule(rule: SLARule):
    result = sla_service.add_sla_rule(rule)
    return result


@app.post("/holidays", summary="添加节假日")
async def add_holiday(holiday: Holiday):
    result = sla_service.add_holiday(holiday)
    if not result.success:
        raise HTTPException(status_code=400, detail={"message": result.message, "errors": result.errors})
    return result


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
