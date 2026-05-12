from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from .database import engine, get_db
from . import models
from .schemas import (
    CreateOrderRequest, AdvanceOrderRequest, OrderStatusResponse,
    ManualCorrection
)
from .state_machine import OrderStateMachine
from .reports import ReportService
from .seed import seed_sample_data
from .models import WorkOrder, Recommendation, Knowledge

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="售后知识推荐 API",
    description="面向售后工程师的故障处理知识推荐系统",
    version="1.0.0"
)


@app.on_event("startup")
def on_startup():
    db = next(get_db())
    seed_sample_data(db)


@app.post("/api/orders", summary="创建工单")
def create_order(request: CreateOrderRequest, db: Session = Depends(get_db)):
    machine = OrderStateMachine(db)
    try:
        order = machine.create_order(
            order_no=request.order_no,
            model_code=request.model_code,
            error_code=request.error_code,
            description=request.description,
            engineer_id=request.engineer_id
        )
        return {
            "success": True,
            "order_no": order.order_no,
            "status": order.status,
            "message": "工单创建成功"
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/orders/{order_no}/advance", summary="推进工单状态")
def advance_order(
    order_no: str,
    request: AdvanceOrderRequest,
    db: Session = Depends(get_db)
):
    machine = OrderStateMachine(db)

    try:
        action = request.action.lower()

        if action == "generate":
            result = machine.generate_recommendation(
                order_no=order_no,
                operator=request.operator
            )
            return {"success": True, **result}

        elif action == "execute":
            result = machine.execute_recommendation(
                order_no=order_no,
                operator=request.operator,
                reason=request.reason
            )
            return {"success": True, **result}

        elif action == "feedback":
            if not request.feedback_data:
                raise ValueError("反馈操作必须提供 feedback_data")
            result = machine.submit_feedback(
                order_no=order_no,
                feedback_data=request.feedback_data,
                operator=request.operator,
                is_manual_correction=False
            )
            return {"success": True, **result}

        elif action == "complete":
            result = machine.complete_order(
                order_no=order_no,
                operator=request.operator,
                reason=request.reason
            )
            return {"success": True, **result}

        else:
            raise HTTPException(
                status_code=400,
                detail=f"不支持的操作: {action}"
            )

    except ValueError as e:
        machine.record_exception(
            order_no=order_no,
            error_message=str(e),
            operator=request.operator
        )
        raise HTTPException(status_code=400, detail=str(e))


@app.post(
    "/api/orders/{order_no}/manual-correction",
    summary="人工修正推荐"
)
def manual_correction(
    order_no: str,
    correction: ManualCorrection,
    db: Session = Depends(get_db)
):
    machine = OrderStateMachine(db)
    order = db.query(WorkOrder).filter(WorkOrder.order_no == order_no).first()

    if not order:
        raise HTTPException(status_code=404, detail="工单不存在")

    rec = db.query(Recommendation).filter(
        Recommendation.id == order.current_recommendation_id
    ).first()

    if not rec:
        raise HTTPException(status_code=400, detail="没有可修正的推荐")

    current_knowledge = rec.recommended_knowledge[0] if rec.recommended_knowledge else {}

    result = machine.submit_feedback(
        order_no=order_no,
        feedback_data={
            "knowledge_code": correction.priority_knowledge_code,
            "effectiveness": 80,
            "comment": correction.comment,
            "diff_before": {
                "original_top_knowledge": current_knowledge.get("knowledge_code"),
                "original_rank": "第1位"
            },
            "diff_after": {
                "corrected_knowledge": correction.priority_knowledge_code,
                "reason": correction.reason
            }
        },
        operator=correction.operator,
        is_manual_correction=True
    )

    return {
        "success": True,
        **result,
        "diff": {
            "before": {
                "top_knowledge": current_knowledge.get("knowledge_code"),
                "title": current_knowledge.get("title")
            },
            "after": {
                "corrected_knowledge": correction.priority_knowledge_code,
                "reason": correction.reason
            }
        }
    }


@app.post("/api/orders/{order_no}/exception", summary="记录异常")
def record_exception(
    order_no: str,
    error_message: str,
    operator: Optional[str] = None,
    db: Session = Depends(get_db)
):
    machine = OrderStateMachine(db)
    try:
        result = machine.record_exception(
            order_no=order_no,
            error_message=error_message,
            operator=operator
        )
        return {"success": True, **result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/orders/{order_no}", summary="查询工单详情")
def get_order(order_no: str, db: Session = Depends(get_db)):
    report = ReportService(db)
    detail = report.get_order_detail_report(order_no)

    if not detail:
        raise HTTPException(status_code=404, detail="工单不存在")

    return {"success": True, **detail}


@app.get("/api/orders", summary="查询工单列表")
def list_orders(
    status: Optional[str] = None,
    model_code: Optional[str] = None,
    error_code: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(WorkOrder)
    if status:
        query = query.filter(WorkOrder.status == status)
    if model_code:
        query = query.filter(WorkOrder.model_code == model_code)
    if error_code:
        query = query.filter(WorkOrder.error_code == error_code)

    orders = query.order_by(WorkOrder.created_at.desc()).all()

    return {
        "success": True,
        "total": len(orders),
        "orders": [
            {
                "order_no": o.order_no,
                "model_code": o.model_code,
                "error_code": o.error_code,
                "status": o.status,
                "created_at": o.created_at.isoformat()
            }
            for o in orders
        ]
    }


@app.get("/api/reports/knowledge-improvement", summary="知识改进报告")
def knowledge_improvement_report(db: Session = Depends(get_db)):
    report = ReportService(db)
    result = report.get_knowledge_improvement_report()
    return {"success": True, **result}


@app.get("/api/reports/order/{order_no}", summary="工单完整报告")
def order_report(order_no: str, db: Session = Depends(get_db)):
    report = ReportService(db)
    detail = report.get_order_detail_report(order_no)

    if not detail:
        raise HTTPException(status_code=404, detail="工单不存在")

    return {"success": True, **detail}


@app.get("/api/health", summary="健康检查")
def health_check():
    return {
        "status": "healthy",
        "service": "售后知识推荐 API",
        "time": datetime.utcnow().isoformat()
    }
