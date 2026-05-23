from datetime import datetime
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import json

from config import settings
from database import engine, get_db, Base
from models import (
    Show, Seat, GroupOrder, ReserveWindow, SeatChangeRequest,
    LockReport, ExceptionLog, OrderStatus, ChangeStatus, ReserveWindowStatus
)
from schemas import (
    ShowCreate, ShowResponse, GroupOrderCreate, GroupOrderResponse,
    SeatChangeRequestCreate, SeatChangeResponse, SeatChangeReview,
    ReserveWindowResponse, LockReportResponse, ExceptionLogResponse,
    ExceptionResolve, ManualCorrection, ApiResponse, SeatResponse
)
from services import (
    OrderService, ChangeRequestService, ExceptionLogService,
    ReportService, ShowService, ReserveWindowService
)

Base.metadata.create_all(bind=engine)

app = FastAPI(title=settings.PROJECT_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def check_expired_windows_task(db: Session):
    expired = ReserveWindowService.check_expired_windows(db)
    for window in expired:
        ReserveWindowService.expire_window(db, window)
    db.commit()

@app.get("/")
async def root():
    return {"message": "剧场座位保留 API 服务运行中", "version": "1.0.0", "docs": "/docs"}

@app.post("/api/v1/shows", response_model=ApiResponse)
async def create_show(show_data: ShowCreate, db: Session = Depends(get_db)):
    show = ShowService.create_show(db, show_data)
    return ApiResponse(
        success=True,
        status="created",
        message="演出场次创建成功",
        data={"show_id": show.id}
    )

@app.get("/api/v1/shows", response_model=List[ShowResponse])
async def list_shows(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    shows = db.query(Show).offset(skip).limit(limit).all()
    return shows

@app.get("/api/v1/shows/{show_id}", response_model=ShowResponse)
async def get_show(show_id: int, db: Session = Depends(get_db)):
    show = db.query(Show).filter(Show.id == show_id).first()
    if not show:
        raise HTTPException(status_code=404, detail="演出场次不存在")
    return show

@app.get("/api/v1/shows/{show_id}/seats", response_model=List[SeatResponse])
async def get_show_seats(show_id: int, status: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Seat).filter(Seat.show_id == show_id)
    if status:
        query = query.filter(Seat.status == status)
    return query.all()

@app.post("/api/v1/orders", response_model=ApiResponse)
async def create_order(order_data: GroupOrderCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    background_tasks.add_task(check_expired_windows_task, db)
    order, window, exc_log = OrderService.create_order(db, order_data)
    if exc_log:
        if exc_log.exception_type == "duplicate_lock":
            return ApiResponse(
                success=False,
                status="duplicate_lock",
                message="该手机号已有活跃锁座，请先释放或使用其他联系方式",
                data={"exception_id": exc_log.id, "error": exc_log.error_message}
            )
        return ApiResponse(
            success=False,
            status="seat_not_available",
            message="部分座位不可用",
            data={"exception_id": exc_log.id, "error": exc_log.error_message}
        )
    return ApiResponse(
        success=True,
        status="locked",
        message="座位锁座成功",
        data={
            "order_id": order.id,
            "window_id": window.id,
            "expire_at": window.expire_at.isoformat(),
            "total_amount": order.total_amount
        }
    )

@app.get("/api/v1/orders", response_model=List[GroupOrderResponse])
async def list_orders(show_id: Optional[int] = None, status: Optional[str] = None,
                      skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    query = db.query(GroupOrder)
    if show_id:
        query = query.filter(GroupOrder.show_id == show_id)
    if status:
        query = query.filter(GroupOrder.status == status)
    return query.offset(skip).limit(limit).all()

@app.get("/api/v1/orders/{order_id}", response_model=GroupOrderResponse)
async def get_order(order_id: int, db: Session = Depends(get_db)):
    order = db.query(GroupOrder).filter(GroupOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")
    return order

@app.post("/api/v1/orders/{order_id}/cancel", response_model=ApiResponse)
async def cancel_order(order_id: int, reason: str, db: Session = Depends(get_db)):
    order = OrderService.cancel_order(db, order_id, reason)
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")
    return ApiResponse(
        success=True,
        status="cancelled",
        message="订单已取消，座位已释放",
        data={"order_id": order.id}
    )

@app.post("/api/v1/change-requests", response_model=ApiResponse)
async def create_change_request(data: SeatChangeRequestCreate, db: Session = Depends(get_db)):
    change_request, exc_log = ChangeRequestService.create_change_request(db, data)
    if exc_log:
        return ApiResponse(
            success=False,
            status="invalid_change",
            message="换座申请创建失败",
            data={"exception_id": exc_log.id, "error": exc_log.error_message}
        )
    return ApiResponse(
        success=True,
        status="pending_review",
        message="换座申请已提交，等待审核",
        data={"request_id": change_request.id}
    )

@app.get("/api/v1/change-requests", response_model=List[SeatChangeResponse])
async def list_change_requests(order_id: Optional[int] = None, status: Optional[str] = None,
                               skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    query = db.query(SeatChangeRequest)
    if order_id:
        query = query.filter(SeatChangeRequest.order_id == order_id)
    if status:
        query = query.filter(SeatChangeRequest.status == status)
    return query.offset(skip).limit(limit).all()

@app.post("/api/v1/change-requests/{request_id}/review", response_model=ApiResponse)
async def review_change_request(request_id: int, review: SeatChangeReview, db: Session = Depends(get_db)):
    change_request = ChangeRequestService.review_change_request(db, request_id, review)
    if not change_request:
        raise HTTPException(status_code=404, detail="换座申请不存在或已处理")

    status_msg = {
        ChangeStatus.APPROVED: "换座申请已批准，座位已更新",
        ChangeStatus.REJECTED: "换座申请已驳回",
        ChangeStatus.COMPENSATED: "换座申请已处理并补偿"
    }
    return ApiResponse(
        success=True,
        status=change_request.status,
        message=status_msg.get(change_request.status, "处理完成"),
        data={
            "request_id": change_request.id,
            "compensation_amount": change_request.compensation_amount
        }
    )

@app.get("/api/v1/reserve-windows", response_model=List[ReserveWindowResponse])
async def list_reserve_windows(order_id: Optional[int] = None, status: Optional[str] = None,
                               db: Session = Depends(get_db)):
    query = db.query(ReserveWindow)
    if order_id:
        query = query.filter(ReserveWindow.order_id == order_id)
    if status:
        query = query.filter(ReserveWindow.status == status)
    return query.all()

@app.post("/api/v1/reserve-windows/check-expired", response_model=ApiResponse)
async def check_expired_windows(db: Session = Depends(get_db)):
    expired = ReserveWindowService.check_expired_windows(db)
    for window in expired:
        ReserveWindowService.expire_window(db, window)
    db.commit()
    return ApiResponse(
        success=True,
        status="completed",
        message=f"已检查并释放 {len(expired)} 个超时保留窗口",
        data={"expired_count": len(expired)}
    )

@app.get("/api/v1/exception-logs", response_model=List[ExceptionLogResponse])
async def list_exception_logs(resolved: Optional[bool] = None,
                              skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    query = db.query(ExceptionLog)
    if resolved is not None:
        query = query.filter(ExceptionLog.resolved == resolved)
    return query.offset(skip).limit(limit).all()

@app.post("/api/v1/exception-logs/{log_id}/resolve", response_model=ApiResponse)
async def resolve_exception(log_id: int, resolve_data: ExceptionResolve, db: Session = Depends(get_db)):
    log = ExceptionLogService.resolve_exception(db, log_id, resolve_data.resolution, resolve_data.resolved_by)
    if not log:
        raise HTTPException(status_code=404, detail="异常日志不存在")
    return ApiResponse(
        success=True,
        status="resolved",
        message="异常已标记为已解决",
        data={"log_id": log.id}
    )

@app.post("/api/v1/manual-correction", response_model=ApiResponse)
async def manual_correction(correction: ManualCorrection, db: Session = Depends(get_db)):
    try:
        if correction.correction_type == "order_status":
            order = db.query(GroupOrder).filter(GroupOrder.id == correction.target_id).first()
            if not order:
                raise HTTPException(status_code=404, detail="订单不存在")
            old_status = order.status
            order.status = correction.new_value
            msg = f"订单状态已从 {old_status} 修改为 {correction.new_value}"
        elif correction.correction_type == "seat_status":
            seat = db.query(Seat).filter(Seat.id == correction.target_id).first()
            if not seat:
                raise HTTPException(status_code=404, detail="座位不存在")
            old_status = seat.status
            seat.status = correction.new_value
            msg = f"座位状态已从 {old_status} 修改为 {correction.new_value}"
        else:
            raise HTTPException(status_code=400, detail="不支持的修正类型")

        exc_log = ExceptionLogService.create_log(
            db,
            exception_type="manual_correction",
            endpoint="/api/v1/manual-correction",
            original_input=correction.model_dump(),
            error_message=f"人工修正: {msg}"
        )
        exc_log.resolved = True
        exc_log.resolved_by = correction.corrected_by
        exc_log.resolved_at = datetime.now()
        exc_log.resolution = msg
        db.commit()

        return ApiResponse(
            success=True,
            status="corrected",
            message=msg,
            data={"exception_id": exc_log.id}
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/reports/lock-report/{show_id}", response_model=ApiResponse)
async def get_lock_report(show_id: int, db: Session = Depends(get_db)):
    report_data = ReportService.generate_show_report(db, show_id)
    if not report_data:
        raise HTTPException(status_code=404, detail="演出场次不存在")
    return ApiResponse(
        success=True,
        status="generated",
        message="锁座报告生成成功",
        data=report_data
    )

@app.get("/api/v1/reports/export/{show_id}")
async def export_report(show_id: int, db: Session = Depends(get_db)):
    report_data = ReportService.generate_show_report(db, show_id)
    if not report_data:
        raise HTTPException(status_code=404, detail="演出场次不存在")

    change_requests = db.query(SeatChangeRequest).filter(
        SeatChangeRequest.show_id == show_id
    ).all()

    orders = db.query(GroupOrder).filter(GroupOrder.show_id == show_id).all()
    order_list = []
    for order in orders:
        windows = db.query(ReserveWindow).filter(ReserveWindow.order_id == order.id).all()
        order_list.append({
            "id": order.id,
            "contact_name": order.contact_name,
            "group_name": order.group_name,
            "requested_seats_count": order.requested_seats_count,
            "status": order.status,
            "total_amount": order.total_amount,
            "reserve_windows": [{"id": w.id, "status": w.status, "expire_at": w.expire_at.isoformat()} for w in windows]
        })

    export_data = {
        "report": report_data,
        "orders": order_list,
        "change_requests": [
            {
                "id": cr.id,
                "order_id": cr.order_id,
                "status": cr.status,
                "new_seat_count": cr.new_seat_count,
                "reason": cr.reason,
                "compensation_amount": cr.compensation_amount
            } for cr in change_requests
        ],
        "exported_at": datetime.now().isoformat()
    }

    filename = f"theater_report_show_{show_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    return {
        "filename": filename,
        "content_type": "application/json",
        "data": export_data
    }

@app.get("/api/v1/reports/history", response_model=List[LockReportResponse])
async def list_lock_reports(show_id: Optional[int] = None,
                            skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    query = db.query(LockReport)
    if show_id:
        query = query.filter(LockReport.show_id == show_id)
    return query.order_by(LockReport.generated_at.desc()).offset(skip).limit(limit).all()