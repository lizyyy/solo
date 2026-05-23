from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
import json

from database import engine, get_db, Base
import models, schemas, crud
from models import OrderStatus, ReturnStatus, CompensationStatus

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="婚礼物料归还 API",
    description="婚庆公司物料归还管理系统，支持活动订单、物料清单、出库记录、归还检查、丢损赔付、结案报告等功能",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def safe_exception_handler(operation: str, db: Session, order_id: int = None, **kwargs):
    def decorator(func):
        def wrapper(*args, **kw):
            try:
                return func(*args, **kw)
            except Exception as e:
                exception_data = schemas.ProcessingExceptionCreate(
                    exception_type=type(e).__name__,
                    operation=operation,
                    original_input=json.dumps(kwargs, ensure_ascii=False, default=str),
                    error_message=str(e),
                    processing_result="failed",
                    order_id=order_id
                )
                crud.create_exception(db, exception_data)
                raise
        return wrapper
    return decorator


@app.post("/api/orders", response_model=schemas.ApiResponse, summary="创建活动订单")
def create_order(order: schemas.OrderCreate, db: Session = Depends(get_db)):
    try:
        existing = crud.get_order_by_no(db, order.order_no)
        if existing:
            return schemas.ApiResponse(
                success=False,
                code="ORDER_EXISTS",
                message=f"订单号已存在: {order.order_no}",
                data={"order_id": existing.id}
            )
        
        db_order = crud.create_order(db, order)
        return schemas.ApiResponse(
            success=True,
            code="CREATED",
            message="订单创建成功",
            data={"order_id": db_order.id, "order_no": db_order.order_no}
        )
    except Exception as e:
        exception_data = schemas.ProcessingExceptionCreate(
            exception_type=type(e).__name__,
            operation="create_order",
            original_input=order.model_dump_json(),
            error_message=str(e),
            processing_result="failed"
        )
        crud.create_exception(db, exception_data)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/orders", response_model=schemas.OrderListResponse, summary="查询订单列表")
def get_orders(
    skip: int = 0, 
    limit: int = 100, 
    status: Optional[OrderStatus] = None,
    db: Session = Depends(get_db)
):
    orders = crud.get_orders(db, skip=skip, limit=limit, status=status)
    return schemas.OrderListResponse(
        success=True,
        code="SUCCESS",
        message="查询成功",
        data=orders,
        total=len(orders),
        page=skip // limit + 1,
        page_size=limit
    )


@app.get("/api/orders/{order_id}", response_model=schemas.ApiResponse, summary="查询单个订单")
def get_order(order_id: int, db: Session = Depends(get_db)):
    db_order = crud.get_order(db, order_id)
    if not db_order:
        return schemas.ApiResponse(
            success=False,
            code="NOT_FOUND",
            message=f"订单不存在: {order_id}"
        )
    return schemas.ApiResponse(
        success=True,
        code="SUCCESS",
        message="查询成功",
        data={"order": schemas.Order.model_validate(db_order).model_dump()}
    )


@app.put("/api/orders/{order_id}/status", response_model=schemas.ApiResponse, summary="更新订单状态")
def update_order_status(
    order_id: int, 
    status: OrderStatus, 
    notes: Optional[str] = None,
    db: Session = Depends(get_db)
):
    db_order = crud.update_order_status(db, order_id, status, notes)
    if not db_order:
        return schemas.ApiResponse(
            success=False,
            code="NOT_FOUND",
            message=f"订单不存在: {order_id}"
        )
    return schemas.ApiResponse(
        success=True,
        code="SUCCESS",
        message="状态更新成功",
        data={"order_id": order_id, "status": db_order.status}
    )


@app.post("/api/outbounds", response_model=schemas.ApiResponse, summary="创建出库记录")
def create_outbound(outbound: schemas.OutboundCreate, db: Session = Depends(get_db)):
    try:
        db_outbound, error = crud.create_outbound(db, outbound)
        if error:
            exception_data = schemas.ProcessingExceptionCreate(
                exception_type="BusinessError",
                operation="create_outbound",
                original_input=outbound.model_dump_json(),
                error_message=error,
                processing_result="rejected",
                order_id=outbound.order_id
            )
            crud.create_exception(db, exception_data)
            return schemas.ApiResponse(
                success=False,
                code="REJECTED",
                message=error
            )
        return schemas.ApiResponse(
            success=True,
            code="CREATED",
            message="出库成功",
            data={"outbound_id": db_outbound.id, "outbound_no": db_outbound.outbound_no}
        )
    except Exception as e:
        exception_data = schemas.ProcessingExceptionCreate(
            exception_type=type(e).__name__,
            operation="create_outbound",
            original_input=outbound.model_dump_json(),
            error_message=str(e),
            processing_result="failed",
            order_id=outbound.order_id
        )
        crud.create_exception(db, exception_data)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/outbounds/{outbound_id}", response_model=schemas.ApiResponse, summary="查询出库记录")
def get_outbound(outbound_id: int, db: Session = Depends(get_db)):
    db_outbound = crud.get_outbound(db, outbound_id)
    if not db_outbound:
        return schemas.ApiResponse(
            success=False,
            code="NOT_FOUND",
            message=f"出库记录不存在: {outbound_id}"
        )
    return schemas.ApiResponse(
        success=True,
        code="SUCCESS",
        message="查询成功",
        data={"outbound": schemas.Outbound.model_validate(db_outbound).model_dump()}
    )


@app.post("/api/returns", response_model=schemas.ApiResponse, summary="创建归还记录")
def create_return(return_data: schemas.ReturnCreate, db: Session = Depends(get_db)):
    try:
        db_return, error = crud.create_return(db, return_data)
        if error:
            exception_data = schemas.ProcessingExceptionCreate(
                exception_type="BusinessError",
                operation="create_return",
                original_input=return_data.model_dump_json(),
                error_message=error,
                processing_result="rejected",
                order_id=return_data.order_id
            )
            crud.create_exception(db, exception_data)
            return schemas.ApiResponse(
                success=False,
                code="REJECTED",
                message=error
            )
        return schemas.ApiResponse(
            success=True,
            code="CREATED",
            message="归还记录创建成功，请等待审核",
            data={
                "return_id": db_return.id, 
                "return_no": db_return.return_no,
                "status": ReturnStatus.PENDING_REVIEW
            }
        )
    except Exception as e:
        exception_data = schemas.ProcessingExceptionCreate(
            exception_type=type(e).__name__,
            operation="create_return",
            original_input=return_data.model_dump_json(),
            error_message=str(e),
            processing_result="failed",
            order_id=return_data.order_id
        )
        crud.create_exception(db, exception_data)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/returns/{return_id}", response_model=schemas.ApiResponse, summary="查询归还记录")
def get_return(return_id: int, db: Session = Depends(get_db)):
    db_return = crud.get_return(db, return_id)
    if not db_return:
        return schemas.ApiResponse(
            success=False,
            code="NOT_FOUND",
            message=f"归还记录不存在: {return_id}"
        )
    return schemas.ApiResponse(
        success=True,
        code="SUCCESS",
        message="查询成功",
        data={"return": schemas.Return.model_validate(db_return).model_dump()}
    )


@app.put("/api/returns/{return_id}/review", response_model=schemas.ApiResponse, summary="审核归还记录")
def review_return(
    return_id: int, 
    review_data: schemas.ReturnReview,
    db: Session = Depends(get_db)
):
    try:
        db_return, error = crud.review_return(db, return_id, review_data)
        if error:
            return schemas.ApiResponse(
                success=False,
                code="REJECTED",
                message=error
            )
        
        status_msg = "审核通过" if db_return.status == ReturnStatus.REVIEWED else "已驳回"
        if db_return.status == ReturnStatus.PENDING_REVIEW:
            status_msg = "待复核"
        
        return schemas.ApiResponse(
            success=True,
            code="REVIEWED",
            message=status_msg,
            data={
                "return_id": return_id,
                "status": db_return.status,
                "reviewed_by": db_return.reviewed_by
            }
        )
    except Exception as e:
        exception_data = schemas.ProcessingExceptionCreate(
            exception_type=type(e).__name__,
            operation="review_return",
            original_input=review_data.model_dump_json(),
            error_message=str(e),
            processing_result="failed"
        )
        crud.create_exception(db, exception_data)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/compensations", response_model=schemas.ApiResponse, summary="创建赔付记录")
def create_compensation(compensation: schemas.CompensationCreate, db: Session = Depends(get_db)):
    try:
        db_compensation, error = crud.create_compensation(db, compensation)
        if error:
            return schemas.ApiResponse(
                success=False,
                code="REJECTED",
                message=error
            )
        return schemas.ApiResponse(
            success=True,
            code="CREATED",
            message="赔付记录创建成功",
            data={
                "compensation_id": db_compensation.id,
                "compensation_no": db_compensation.compensation_no,
                "total_amount": db_compensation.total_amount,
                "status": CompensationStatus.PENDING
            }
        )
    except Exception as e:
        exception_data = schemas.ProcessingExceptionCreate(
            exception_type=type(e).__name__,
            operation="create_compensation",
            original_input=compensation.model_dump_json(),
            error_message=str(e),
            processing_result="failed",
            order_id=compensation.order_id
        )
        crud.create_exception(db, exception_data)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/compensations/{compensation_id}", response_model=schemas.ApiResponse, summary="查询赔付记录")
def get_compensation(compensation_id: int, db: Session = Depends(get_db)):
    db_compensation = crud.get_compensation(db, compensation_id)
    if not db_compensation:
        return schemas.ApiResponse(
            success=False,
            code="NOT_FOUND",
            message=f"赔付记录不存在: {compensation_id}"
        )
    return schemas.ApiResponse(
        success=True,
        code="SUCCESS",
        message="查询成功",
        data={"compensation": schemas.Compensation.model_validate(db_compensation).model_dump()}
    )


@app.put("/api/compensations/{compensation_id}/status", response_model=schemas.ApiResponse, summary="更新赔付状态")
def update_compensation_status(
    compensation_id: int,
    update_data: schemas.CompensationUpdate,
    db: Session = Depends(get_db)
):
    try:
        db_compensation, error = crud.update_compensation_status(db, compensation_id, update_data)
        if error:
            return schemas.ApiResponse(
                success=False,
                code="REJECTED",
                message=error
            )
        
        status_msg = "状态已更新"
        if db_compensation.status == CompensationStatus.PAID:
            status_msg = "已赔付"
        elif db_compensation.status == CompensationStatus.WAIVED:
            status_msg = "已豁免"
        elif db_compensation.status == CompensationStatus.IN_PROGRESS:
            status_msg = "赔付进行中"
        
        return schemas.ApiResponse(
            success=True,
            code="UPDATED",
            message=status_msg,
            data={
                "compensation_id": compensation_id,
                "status": db_compensation.status
            }
        )
    except Exception as e:
        exception_data = schemas.ProcessingExceptionCreate(
            exception_type=type(e).__name__,
            operation="update_compensation_status",
            original_input=update_data.model_dump_json(),
            error_message=str(e),
            processing_result="failed"
        )
        crud.create_exception(db, exception_data)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/exceptions", response_model=schemas.ApiResponse, summary="查询异常记录")
def get_exceptions(
    skip: int = 0,
    limit: int = 100,
    handled: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    exceptions = crud.get_exceptions(db, skip=skip, limit=limit, handled=handled)
    return schemas.ApiResponse(
        success=True,
        code="SUCCESS",
        message="查询成功",
        data={
            "exceptions": [schemas.ProcessingException.model_validate(e).model_dump() for e in exceptions],
            "total": len(exceptions)
        }
    )


@app.put("/api/exceptions/{exception_id}/handle", response_model=schemas.ApiResponse, summary="人工处理异常")
def handle_exception(
    exception_id: int,
    handle_data: schemas.ProcessingExceptionHandle,
    db: Session = Depends(get_db)
):
    db_exception, error = crud.handle_exception(db, exception_id, handle_data)
    if error:
        return schemas.ApiResponse(
            success=False,
            code="REJECTED",
            message=error
        )
    return schemas.ApiResponse(
        success=True,
        code="HANDLED",
        message="异常已处理",
        data={
            "exception_id": exception_id,
            "handled_by": db_exception.handled_by
        }
    )


@app.post("/api/reports", response_model=schemas.ApiResponse, summary="生成报告")
def create_report(report: schemas.ReportCreate, db: Session = Depends(get_db)):
    db_report = crud.create_report(db, report)
    return schemas.ApiResponse(
        success=True,
        code="CREATED",
        message="报告生成成功",
        data={
            "report_id": db_report.id,
            "report_no": db_report.report_no
        }
    )


@app.get("/api/reports/{report_id}", response_model=schemas.ApiResponse, summary="查询报告")
def get_report(report_id: int, db: Session = Depends(get_db)):
    db_report = crud.get_report(db, report_id)
    if not db_report:
        return schemas.ApiResponse(
            success=False,
            code="NOT_FOUND",
            message=f"报告不存在: {report_id}"
        )
    return schemas.ApiResponse(
        success=True,
        code="SUCCESS",
        message="查询成功",
        data={"report": schemas.Report.model_validate(db_report).model_dump()}
    )


@app.get("/api/orders/{order_id}/report", response_model=schemas.ApiResponse, summary="导出订单结案报告")
def export_order_report(order_id: int, generated_by: str, db: Session = Depends(get_db)):
    db_order = crud.get_order(db, order_id)
    if not db_order:
        return schemas.ApiResponse(
            success=False,
            code="NOT_FOUND",
            message=f"订单不存在: {order_id}"
        )
    
    materials = crud.get_materials_by_order(db, order_id)
    outbounds = crud.get_outbounds_by_order(db, order_id)
    returns = crud.get_returns_by_order(db, order_id)
    compensations = crud.get_compensations_by_order(db, order_id)

    report_content = f"""
=== 婚礼物料归还结案报告 ===
订单号: {db_order.order_no}
客户: {db_order.customer_name}
活动日期: {db_order.event_date.strftime('%Y-%m-%d')}
活动地点: {db_order.event_location}
订单状态: {db_order.status}

--- 物料清单 ---
"""
    for m in materials:
        report_content += f"- {m.name} ({m.category}): {m.quantity}件, 单价: {m.unit_price}元\n"

    report_content += "\n--- 出库记录 ---\n"
    for o in outbounds:
        report_content += f"出库单号: {o.outbound_no}, 操作员: {o.operator}, 时间: {o.outbound_time}\n"

    report_content += "\n--- 归还记录 ---\n"
    for r in returns:
        report_content += f"归还单号: {r.return_no}, 状态: {r.status}, 操作员: {r.operator}\n"

    report_content += "\n--- 丢损赔付 ---\n"
    total_comp = 0
    for c in compensations:
        report_content += f"赔付单号: {c.compensation_no}, 类型: {c.damage_type}, 金额: {c.total_amount}元, 状态: {c.status}\n"
        total_comp += c.total_amount

    report_content += f"\n--- 汇总 ---\n"
    report_content += f"赔付总金额: {total_comp}元\n"
    report_content += f"报告生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"

    report_data = schemas.ReportCreate(
        order_id=order_id,
        report_type="结案报告",
        generated_by=generated_by,
        content=report_content
    )
    db_report = crud.create_report(db, report_data)

    return schemas.ApiResponse(
        success=True,
        code="EXPORTED",
        message="报告导出成功",
        data={
            "report_id": db_report.id,
            "report_no": db_report.report_no,
            "content": report_content
        }
    )


@app.get("/api/health", summary="健康检查")
def health_check():
    return {"status": "healthy", "service": "婚礼物料归还 API"}


from datetime import datetime