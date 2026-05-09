from fastapi import FastAPI, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Optional

from database import engine, Base, get_db
from schemas import (
    ChargingPileCreate, FaultEventCreate, ReservationCreate,
    ChargingSessionCreate, DispatchOrderCreate, RecoveryReportCreate,
    BusinessResponse
)
from services import (
    FaultEventService, ReservationService, ChargingSessionService,
    DispatchService, SLAService, RecoveryReportService,
    get_pile_by_code
)
from models import ChargingPile

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="快充站故障派单 API",
    description="专注处理快充桩故障对预约、计费和运维 SLA 影响的后端系统",
    version="1.0.0"
)


@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    return JSONResponse(
        status_code=500,
        content=BusinessResponse(
            success=False,
            message=f"系统内部错误：{str(exc)}",
            error_code="INTERNAL_ERROR"
        ).dict()
    )


@app.post("/api/piles", response_model=BusinessResponse, summary="注册充电桩")
def register_pile(data: ChargingPileCreate, db: Session = Depends(get_db)):
    existing = get_pile_by_code(db, data.pile_code)
    if existing:
        return BusinessResponse(
            success=False,
            message=f"充电桩 [{data.pile_code}] 已存在",
            error_code="PILE_EXISTS"
        )
    
    pile = ChargingPile(
        pile_code=data.pile_code,
        station_name=data.station_name,
        location=data.location,
        power=data.power,
        status="AVAILABLE"
    )
    db.add(pile)
    db.commit()
    db.refresh(pile)
    
    return BusinessResponse(
        success=True,
        message=f"充电桩 [{pile.pile_code}] 注册成功，当前状态：可用",
        data={
            "pile_code": pile.pile_code,
            "station_name": pile.station_name,
            "status": pile.status
        }
    )


@app.get("/api/piles/{pile_code}", response_model=BusinessResponse, summary="查询充电桩状态")
def get_pile_status(pile_code: str, db: Session = Depends(get_db)):
    pile = get_pile_by_code(db, pile_code)
    if not pile:
        return BusinessResponse(
            success=False,
            message=f"充电桩 [{pile_code}] 不存在",
            error_code="PILE_NOT_FOUND"
        )
    
    return BusinessResponse(
        success=True,
        message=f"充电桩 [{pile_code}] 状态查询成功",
        data={
            "pile_code": pile.pile_code,
            "station_name": pile.station_name,
            "status": pile.status,
            "power": pile.power
        }
    )


@app.post("/api/faults", response_model=BusinessResponse, summary="上报故障事件")
def report_fault(data: FaultEventCreate, db: Session = Depends(get_db)):
    result, success = FaultEventService.create_fault_event(db, data)
    status_code = 200 if success else 400
    return JSONResponse(status_code=status_code, content=result)


@app.post("/api/faults/{fault_code}/acknowledge", response_model=BusinessResponse, summary="确认故障")
def acknowledge_fault(fault_code: str, db: Session = Depends(get_db)):
    result, success = FaultEventService.acknowledge_fault(db, fault_code)
    status_code = 200 if success else 400
    return JSONResponse(status_code=status_code, content=result)


@app.post("/api/faults/{fault_code}/resolve", response_model=BusinessResponse, summary="解决故障")
def resolve_fault(fault_code: str, db: Session = Depends(get_db)):
    result, success = FaultEventService.resolve_fault(db, fault_code)
    status_code = 200 if success else 400
    return JSONResponse(status_code=status_code, content=result)


@app.post("/api/faults/{fault_code}/cancel", response_model=BusinessResponse, summary="撤销故障")
def cancel_fault(fault_code: str, reason: str, db: Session = Depends(get_db)):
    result, success = FaultEventService.cancel_fault(db, fault_code, reason)
    status_code = 200 if success else 400
    return JSONResponse(status_code=status_code, content=result)


@app.get("/api/faults/{fault_code}", response_model=BusinessResponse, summary="查询故障详情")
def get_fault_detail(fault_code: str, db: Session = Depends(get_db)):
    result, success = FaultEventService.get_fault_detail(db, fault_code)
    status_code = 200 if success else 404
    return JSONResponse(status_code=status_code, content=result)


@app.post("/api/reservations", response_model=BusinessResponse, summary="创建预约")
def create_reservation(data: ReservationCreate, db: Session = Depends(get_db)):
    result, success = ReservationService.create_reservation(db, data)
    status_code = 200 if success else 400
    return JSONResponse(status_code=status_code, content=result)


@app.post("/api/reservations/{reservation_code}/cancel", response_model=BusinessResponse, summary="取消预约")
def cancel_reservation(reservation_code: str, db: Session = Depends(get_db)):
    result, success = ReservationService.cancel_reservation(db, reservation_code)
    status_code = 200 if success else 400
    return JSONResponse(status_code=status_code, content=result)


@app.post("/api/sessions/start", response_model=BusinessResponse, summary="开始充电")
def start_charging(data: ChargingSessionCreate, db: Session = Depends(get_db)):
    result, success = ChargingSessionService.start_session(db, data)
    status_code = 200 if success else 400
    return JSONResponse(status_code=status_code, content=result)


@app.post("/api/sessions/{session_code}/stop", response_model=BusinessResponse, summary="结束充电")
def stop_charging(session_code: str, end_kwh: float, db: Session = Depends(get_db)):
    result, success = ChargingSessionService.stop_session(db, session_code, end_kwh)
    status_code = 200 if success else 400
    return JSONResponse(status_code=status_code, content=result)


@app.post("/api/sessions/{session_code}/settle", response_model=BusinessResponse, summary="结算充电费用")
def settle_session(session_code: str, db: Session = Depends(get_db)):
    result, success = ChargingSessionService.settle_session(db, session_code)
    status_code = 200 if success else 400
    return JSONResponse(status_code=status_code, content=result)


@app.post("/api/dispatches", response_model=BusinessResponse, summary="创建派单")
def create_dispatch(data: DispatchOrderCreate, db: Session = Depends(get_db)):
    result, success = DispatchService.create_dispatch(db, data)
    status_code = 200 if success else 400
    return JSONResponse(status_code=status_code, content=result)


@app.post("/api/dispatches/{order_code}/accept", response_model=BusinessResponse, summary="工程师接单")
def accept_dispatch(order_code: str, db: Session = Depends(get_db)):
    result, success = DispatchService.accept_dispatch(db, order_code)
    status_code = 200 if success else 400
    return JSONResponse(status_code=status_code, content=result)


@app.post("/api/dispatches/{order_code}/arrive", response_model=BusinessResponse, summary="到达现场")
def arrive_on_site(order_code: str, db: Session = Depends(get_db)):
    result, success = DispatchService.arrive_on_site(db, order_code)
    status_code = 200 if success else 400
    return JSONResponse(status_code=status_code, content=result)


@app.post("/api/dispatches/{order_code}/complete", response_model=BusinessResponse, summary="完成派单")
def complete_dispatch(order_code: str, db: Session = Depends(get_db)):
    result, success = DispatchService.complete_dispatch(db, order_code)
    status_code = 200 if success else 400
    return JSONResponse(status_code=status_code, content=result)


@app.post("/api/dispatches/{order_code}/cancel", response_model=BusinessResponse, summary="撤销派单")
def cancel_dispatch(order_code: str, reason: str, db: Session = Depends(get_db)):
    result, success = DispatchService.cancel_dispatch(db, order_code, reason)
    status_code = 200 if success else 400
    return JSONResponse(status_code=status_code, content=result)


@app.post("/api/dispatches/{order_code}/reassign", response_model=BusinessResponse, summary="转单")
def reassign_dispatch(
    order_code: str,
    new_engineer_id: str,
    new_engineer_name: str,
    reason: str,
    db: Session = Depends(get_db)
):
    result, success = DispatchService.reassign_dispatch(
        db, order_code, new_engineer_id, new_engineer_name, reason
    )
    status_code = 200 if success else 400
    return JSONResponse(status_code=status_code, content=result)


@app.post("/api/dispatches/{order_code}/handle-timeout", response_model=BusinessResponse, summary="处理派单超时")
def handle_dispatch_timeout(order_code: str, db: Session = Depends(get_db)):
    result, success = DispatchService.handle_timeout(db, order_code)
    status_code = 200 if success else 400
    return JSONResponse(status_code=status_code, content=result)


@app.post("/api/recovery-reports", response_model=BusinessResponse, summary="创建恢复报告")
def create_recovery_report(data: RecoveryReportCreate, db: Session = Depends(get_db)):
    result, success = RecoveryReportService.create_report(db, data)
    status_code = 200 if success else 400
    return JSONResponse(status_code=status_code, content=result)


@app.post("/api/recovery-reports/{report_code}/verify", response_model=BusinessResponse, summary="验证恢复报告")
def verify_recovery_report(report_code: str, verified_by: str, db: Session = Depends(get_db)):
    result, success = RecoveryReportService.verify_report(db, report_code, verified_by)
    status_code = 200 if success else 400
    return JSONResponse(status_code=status_code, content=result)


@app.get("/api/sla/warnings", response_model=BusinessResponse, summary="检查SLA告警")
def check_sla_warnings(db: Session = Depends(get_db)):
    warnings = SLAService.check_sla_warnings(db)
    
    if warnings:
        return BusinessResponse(
            success=True,
            message=f"检测到 {len(warnings)} 个 SLA 告警",
            data={"warnings": warnings}
        )
    else:
        return BusinessResponse(
            success=True,
            message="当前没有 SLA 告警",
            data={"warnings": []}
        )


@app.get("/", summary="系统状态")
def root():
    return {
        "name": "快充站故障派单 API",
        "version": "1.0.0",
        "status": "running",
        "description": "专注处理快充桩故障对预约、计费和运维 SLA 影响的后端系统"
    }
