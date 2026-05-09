from datetime import datetime, timedelta
from typing import Optional, Tuple, List
from sqlalchemy.orm import Session
from models import (
    ChargingPile, FaultEvent, Reservation, ChargingSession, 
    DispatchOrder, SLARecord, RecoveryReport
)
from schemas import (
    FaultEventCreate, ReservationCreate, ChargingSessionCreate,
    DispatchOrderCreate, RecoveryReportCreate
)
from config import settings
import uuid


def generate_code(prefix: str) -> str:
    return f"{prefix}{datetime.now().strftime('%Y%m%d%H%M%S')}{str(uuid.uuid4().hex[:6]).upper()}"


def get_pile_by_code(db: Session, pile_code: str) -> Optional[ChargingPile]:
    return db.query(ChargingPile).filter(ChargingPile.pile_code == pile_code).first()


def get_fault_by_code(db: Session, fault_code: str) -> Optional[FaultEvent]:
    return db.query(FaultEvent).filter(FaultEvent.fault_code == fault_code).first()


def get_reservation_by_code(db: Session, reservation_code: str) -> Optional[Reservation]:
    return db.query(Reservation).filter(Reservation.reservation_code == reservation_code).first()


def get_session_by_code(db: Session, session_code: str) -> Optional[ChargingSession]:
    return db.query(ChargingSession).filter(ChargingSession.session_code == session_code).first()


def get_dispatch_by_code(db: Session, order_code: str) -> Optional[DispatchOrder]:
    return db.query(DispatchOrder).filter(DispatchOrder.order_code == order_code).first()


class FaultEventService:
    @staticmethod
    def create_fault_event(db: Session, data: FaultEventCreate) -> Tuple[dict, bool]:
        pile = get_pile_by_code(db, data.pile_code)
        if not pile:
            return {"success": False, "message": f"充电桩 [{data.pile_code}] 不存在", "error_code": "PILE_NOT_FOUND"}, False
        
        active_fault = db.query(FaultEvent).filter(
            FaultEvent.pile_id == pile.id,
            FaultEvent.status.in_(["OPEN", "ACKNOWLEDGED", "IN_PROGRESS"])
        ).first()
        
        if active_fault:
            return {
                "success": False, 
                "message": f"充电桩 [{data.pile_code}] 已有未处理的故障事件 [{active_fault.fault_code}]，不能重复上报", 
                "error_code": "ACTIVE_FAULT_EXISTS"
            }, False
        
        now = datetime.utcnow()
        fault = FaultEvent(
            fault_code=generate_code("FLT"),
            pile_id=pile.id,
            fault_type=data.fault_type,
            fault_level=data.fault_level,
            description=data.description,
            source=data.source,
            status="OPEN",
            reported_at=now,
            sla_expires_at=now + timedelta(minutes=settings.SLA_EXPIRED_MINUTES)
        )
        
        db.add(fault)
        pile.status = "FAULT"
        db.commit()
        db.refresh(fault)
        db.refresh(pile)
        
        SLAService.create_sla_record(db, fault.id, fault.fault_level)
        
        affected_reservations = ReservationService.freeze_affected_reservations(db, pile.id, fault.fault_code)
        affected_sessions = ChargingSessionService.truncate_affected_sessions(db, pile.id, fault.fault_code)
        
        return {
            "success": True,
            "message": f"故障事件 [{fault.fault_code}] 已创建，充电桩 [{pile.pile_code}] 已标记为故障状态",
            "data": {
                "fault_code": fault.fault_code,
                "pile_code": pile.pile_code,
                "station_name": pile.station_name,
                "fault_type": fault.fault_type,
                "fault_level": fault.fault_level,
                "frozen_reservations": len(affected_reservations),
                "truncated_sessions": len(affected_sessions),
                "sla_deadline": fault.sla_expires_at.isoformat()
            }
        }, True
    
    @staticmethod
    def acknowledge_fault(db: Session, fault_code: str) -> Tuple[dict, bool]:
        fault = get_fault_by_code(db, fault_code)
        if not fault:
            return {"success": False, "message": f"故障事件 [{fault_code}] 不存在", "error_code": "FAULT_NOT_FOUND"}, False
        
        if fault.status != "OPEN":
            return {
                "success": False, 
                "message": f"故障事件 [{fault_code}] 当前状态为 [{fault.status}]，只有 OPEN 状态的故障才能确认", 
                "error_code": "INVALID_STATUS"
            }, False
        
        now = datetime.utcnow()
        fault.status = "ACKNOWLEDGED"
        fault.acknowledged_at = now
        db.commit()
        db.refresh(fault)
        
        SLAService.check_and_update_sla(db, fault.id, "acknowledged", now)
        
        return {
            "success": True,
            "message": f"故障事件 [{fault_code}] 已确认接收，当前状态：ACKNOWLEDGED",
            "data": {
                "fault_code": fault.fault_code,
                "status": fault.status,
                "acknowledged_at": fault.acknowledged_at.isoformat()
            }
        }, True
    
    @staticmethod
    def resolve_fault(db: Session, fault_code: str) -> Tuple[dict, bool]:
        fault = get_fault_by_code(db, fault_code)
        if not fault:
            return {"success": False, "message": f"故障事件 [{fault_code}] 不存在", "error_code": "FAULT_NOT_FOUND"}, False
        
        if fault.status not in ["ACKNOWLEDGED", "IN_PROGRESS"]:
            return {
                "success": False, 
                "message": f"故障事件 [{fault_code}] 当前状态为 [{fault.status}]，只有已确认或处理中的故障才能解决", 
                "error_code": "INVALID_STATUS"
            }, False
        
        active_dispatch = db.query(DispatchOrder).filter(
            DispatchOrder.fault_event_id == fault.id,
            DispatchOrder.status.in_(["PENDING", "ACCEPTED", "ON_SITE"])
        ).first()
        
        if active_dispatch:
            return {
                "success": False, 
                "message": f"故障事件 [{fault_code}] 存在未完成的派单 [{active_dispatch.order_code}]，请先完成或撤销派单", 
                "error_code": "ACTIVE_DISPATCH_EXISTS"
            }, False
        
        if not fault.recovery_report or fault.recovery_report.status != "VERIFIED":
            return {
                "success": False, 
                "message": f"故障事件 [{fault_code}] 未提交经验证的恢复报告，请先完成恢复报告", 
                "error_code": "RECOVERY_REPORT_REQUIRED"
            }, False
        
        now = datetime.utcnow()
        fault.status = "RESOLVED"
        fault.resolved_at = now
        
        pile = db.query(ChargingPile).filter(ChargingPile.id == fault.pile_id).first()
        if pile:
            pile.status = "AVAILABLE"
        
        db.commit()
        db.refresh(fault)
        if pile:
            db.refresh(pile)
        
        SLAService.check_and_update_sla(db, fault.id, "resolved", now)
        ReservationService.unfreeze_reservations_by_fault(db, fault.fault_code)
        
        return {
            "success": True,
            "message": f"故障事件 [{fault_code}] 已解决，充电桩 [{pile.pile_code}] 已恢复可用状态",
            "data": {
                "fault_code": fault.fault_code,
                "pile_code": pile.pile_code if pile else None,
                "status": fault.status,
                "resolved_at": fault.resolved_at.isoformat()
            }
        }, True
    
    @staticmethod
    def cancel_fault(db: Session, fault_code: str, reason: str) -> Tuple[dict, bool]:
        fault = get_fault_by_code(db, fault_code)
        if not fault:
            return {"success": False, "message": f"故障事件 [{fault_code}] 不存在", "error_code": "FAULT_NOT_FOUND"}, False
        
        if fault.status not in ["OPEN", "ACKNOWLEDGED"]:
            return {
                "success": False, 
                "message": f"故障事件 [{fault_code}] 当前状态为 [{fault.status}]，无法撤销", 
                "error_code": "INVALID_STATUS"
            }, False
        
        active_dispatch = db.query(DispatchOrder).filter(
            DispatchOrder.fault_event_id == fault.id,
            DispatchOrder.status.in_(["PENDING", "ACCEPTED", "ON_SITE"])
        ).first()
        
        if active_dispatch:
            return {
                "success": False, 
                "message": f"故障事件 [{fault_code}] 存在未完成的派单 [{active_dispatch.order_code}]，请先撤销派单", 
                "error_code": "ACTIVE_DISPATCH_EXISTS"
            }, False
        
        fault.status = "CANCELLED"
        fault.description = f"{fault.description or ''} | 撤销原因: {reason}"
        
        pile = db.query(ChargingPile).filter(ChargingPile.id == fault.pile_id).first()
        if pile:
            pile.status = "AVAILABLE"
        
        db.commit()
        db.refresh(fault)
        if pile:
            db.refresh(pile)
        
        SLAService.cancel_sla(db, fault.id)
        ReservationService.unfreeze_reservations_by_fault(db, fault.fault_code)
        
        return {
            "success": True,
            "message": f"故障事件 [{fault_code}] 已撤销，充电桩 [{pile.pile_code}] 已恢复可用状态",
            "data": {
                "fault_code": fault.fault_code,
                "status": fault.status,
                "cancellation_reason": reason
            }
        }, True
    
    @staticmethod
    def get_fault_detail(db: Session, fault_code: str) -> Tuple[dict, bool]:
        fault = get_fault_by_code(db, fault_code)
        if not fault:
            return {"success": False, "message": f"故障事件 [{fault_code}] 不存在", "error_code": "FAULT_NOT_FOUND"}, False
        
        pile = db.query(ChargingPile).filter(ChargingPile.id == fault.pile_id).first()
        dispatches = db.query(DispatchOrder).filter(DispatchOrder.fault_event_id == fault.id).all()
        sla_records = db.query(SLARecord).filter(SLARecord.fault_event_id == fault.id).all()
        
        reservations = db.query(Reservation).filter(
            Reservation.pile_id == fault.pile_id,
            Reservation.frozen_reason.like(f"%{fault.fault_code}%")
        ).all()
        
        sessions = db.query(ChargingSession).filter(
            ChargingSession.pile_id == fault.pile_id,
            ChargingSession.truncation_reason.like(f"%{fault.fault_code}%")
        ).all()
        
        return {
            "success": True,
            "message": f"故障事件 [{fault_code}] 详情查询成功",
            "data": {
                "fault": {
                    "fault_code": fault.fault_code,
                    "pile_code": pile.pile_code if pile else None,
                    "station_name": pile.station_name if pile else None,
                    "fault_type": fault.fault_type,
                    "fault_level": fault.fault_level,
                    "status": fault.status,
                    "description": fault.description,
                    "source": fault.source,
                    "reported_at": fault.reported_at.isoformat(),
                    "acknowledged_at": fault.acknowledged_at.isoformat() if fault.acknowledged_at else None,
                    "resolved_at": fault.resolved_at.isoformat() if fault.resolved_at else None,
                    "sla_expires_at": fault.sla_expires_at.isoformat() if fault.sla_expires_at else None
                },
                "dispatches": [{
                    "order_code": d.order_code,
                    "engineer_name": d.engineer_name,
                    "status": d.status,
                    "dispatched_at": d.dispatched_at.isoformat()
                } for d in dispatches],
                "sla_records": [{
                    "sla_type": s.sla_type,
                    "target_minutes": s.target_minutes,
                    "actual_minutes": s.actual_minutes,
                    "is_met": s.is_met
                } for s in sla_records],
                "frozen_reservations": [{
                    "reservation_code": r.reservation_code,
                    "user_name": r.user_name,
                    "status": r.status
                } for r in reservations],
                "truncated_sessions": [{
                    "session_code": s.session_code,
                    "user_id": s.user_id,
                    "charged_kwh": s.charged_kwh,
                    "total_amount": s.total_amount
                } for s in sessions],
                "recovery_report": {
                    "report_code": fault.recovery_report.report_code,
                    "status": fault.recovery_report.status,
                    "root_cause": fault.recovery_report.root_cause
                } if fault.recovery_report else None
            }
        }, True


class ReservationService:
    @staticmethod
    def create_reservation(db: Session, data: ReservationCreate) -> Tuple[dict, bool]:
        pile = get_pile_by_code(db, data.pile_code)
        if not pile:
            return {"success": False, "message": f"充电桩 [{data.pile_code}] 不存在", "error_code": "PILE_NOT_FOUND"}, False
        
        if pile.status == "FAULT":
            active_fault = db.query(FaultEvent).filter(
                FaultEvent.pile_id == pile.id,
                FaultEvent.status.in_(["OPEN", "ACKNOWLEDGED", "IN_PROGRESS"])
            ).first()
            
            if active_fault:
                return {
                    "success": False, 
                    "message": f"充电桩 [{pile.pile_code}] 当前处于故障状态，存在未处理故障 [{active_fault.fault_code}]，无法预约", 
                    "error_code": "PILE_IN_FAULT"
                }, False
        
        if data.reserved_start >= data.reserved_end:
            return {
                "success": False, 
                "message": "预约开始时间必须早于结束时间", 
                "error_code": "INVALID_TIME_RANGE"
            }, False
        
        conflicting_reservations = db.query(Reservation).filter(
            Reservation.pile_id == pile.id,
            Reservation.status == "CONFIRMED",
            Reservation.is_frozen == False,
            Reservation.reserved_start < data.reserved_end,
            Reservation.reserved_end > data.reserved_start
        ).all()
        
        if conflicting_reservations:
            return {
                "success": False, 
                "message": f"充电桩 [{pile.pile_code}] 在该时间段已有预约 [{conflicting_reservations[0].reservation_code}]，时间冲突", 
                "error_code": "RESERVATION_CONFLICT"
            }, False
        
        reservation = Reservation(
            reservation_code=generate_code("RES"),
            pile_id=pile.id,
            user_id=data.user_id,
            user_name=data.user_name,
            phone=data.phone,
            reserved_start=data.reserved_start,
            reserved_end=data.reserved_end,
            status="CONFIRMED",
            is_frozen=False
        )
        
        db.add(reservation)
        db.commit()
        db.refresh(reservation)
        
        return {
            "success": True,
            "message": f"预约 [{reservation.reservation_code}] 已确认，充电桩 [{pile.pile_code}] 预约成功",
            "data": {
                "reservation_code": reservation.reservation_code,
                "pile_code": pile.pile_code,
                "user_name": reservation.user_name,
                "reserved_start": reservation.reserved_start.isoformat(),
                "reserved_end": reservation.reserved_end.isoformat(),
                "status": reservation.status
            }
        }, True
    
    @staticmethod
    def freeze_affected_reservations(db: Session, pile_id: int, fault_code: str) -> List[Reservation]:
        now = datetime.utcnow()
        affected_reservations = db.query(Reservation).filter(
            Reservation.pile_id == pile_id,
            Reservation.status == "CONFIRMED",
            Reservation.is_frozen == False,
            Reservation.reserved_end > now
        ).all()
        
        frozen_list = []
        for reservation in affected_reservations:
            reservation.is_frozen = True
            reservation.frozen_reason = f"充电桩故障：{fault_code}"
            reservation.frozen_at = now
            reservation.status = "FROZEN"
            frozen_list.append(reservation)
        
        db.commit()
        return frozen_list
    
    @staticmethod
    def unfreeze_reservations_by_fault(db: Session, fault_code: str) -> List[Reservation]:
        affected_reservations = db.query(Reservation).filter(
            Reservation.is_frozen == True,
            Reservation.frozen_reason.like(f"%{fault_code}%")
        ).all()
        
        unfrozen_list = []
        now = datetime.utcnow()
        for reservation in affected_reservations:
            reservation.is_frozen = False
            reservation.unfrozen_at = now
            reservation.status = "CONFIRMED"
            reservation.frozen_reason = f"{reservation.frozen_reason} | 已解冻"
            unfrozen_list.append(reservation)
        
        db.commit()
        return unfrozen_list
    
    @staticmethod
    def cancel_reservation(db: Session, reservation_code: str) -> Tuple[dict, bool]:
        reservation = get_reservation_by_code(db, reservation_code)
        if not reservation:
            return {"success": False, "message": f"预约 [{reservation_code}] 不存在", "error_code": "RESERVATION_NOT_FOUND"}, False
        
        if reservation.status in ["CANCELLED", "COMPLETED"]:
            return {
                "success": False, 
                "message": f"预约 [{reservation_code}] 当前状态为 [{reservation.status}]，无法重复取消", 
                "error_code": "INVALID_STATUS"
            }, False
        
        reservation.status = "CANCELLED"
        db.commit()
        db.refresh(reservation)
        
        pile = db.query(ChargingPile).filter(ChargingPile.id == reservation.pile_id).first()
        
        return {
            "success": True,
            "message": f"预约 [{reservation_code}] 已取消，充电桩 [{pile.pile_code if pile else '未知'}] 时段已释放",
            "data": {
                "reservation_code": reservation.reservation_code,
                "status": reservation.status
            }
        }, True


class ChargingSessionService:
    @staticmethod
    def start_session(db: Session, data: ChargingSessionCreate) -> Tuple[dict, bool]:
        pile = get_pile_by_code(db, data.pile_code)
        if not pile:
            return {"success": False, "message": f"充电桩 [{data.pile_code}] 不存在", "error_code": "PILE_NOT_FOUND"}, False
        
        if pile.status == "FAULT":
            active_fault = db.query(FaultEvent).filter(
                FaultEvent.pile_id == pile.id,
                FaultEvent.status.in_(["OPEN", "ACKNOWLEDGED", "IN_PROGRESS"])
            ).first()
            
            if active_fault:
                return {
                    "success": False, 
                    "message": f"充电桩 [{pile.pile_code}] 当前处于故障状态，存在未处理故障 [{active_fault.fault_code}]，无法开始充电", 
                    "error_code": "PILE_IN_FAULT"
                }, False
        
        active_session = db.query(ChargingSession).filter(
            ChargingSession.pile_id == pile.id,
            ChargingSession.status == "CHARGING"
        ).first()
        
        if active_session:
            return {
                "success": False, 
                "message": f"充电桩 [{pile.pile_code}] 已有正在进行的充电会话 [{active_session.session_code}]", 
                "error_code": "ACTIVE_SESSION_EXISTS"
            }, False
        
        session = ChargingSession(
            session_code=generate_code("CHG"),
            pile_id=pile.id,
            user_id=data.user_id,
            start_time=datetime.utcnow(),
            start_kwh=data.start_kwh,
            status="CHARGING",
            is_truncated=False
        )
        
        db.add(session)
        pile.status = "IN_USE"
        db.commit()
        db.refresh(session)
        db.refresh(pile)
        
        return {
            "success": True,
            "message": f"充电会话 [{session.session_code}] 已开始，充电桩 [{pile.pile_code}] 开始计费",
            "data": {
                "session_code": session.session_code,
                "pile_code": pile.pile_code,
                "user_id": session.user_id,
                "start_time": session.start_time.isoformat(),
                "start_kwh": session.start_kwh,
                "status": session.status
            }
        }, True
    
    @staticmethod
    def truncate_affected_sessions(db: Session, pile_id: int, fault_code: str) -> List[ChargingSession]:
        affected_sessions = db.query(ChargingSession).filter(
            ChargingSession.pile_id == pile_id,
            ChargingSession.status == "CHARGING"
        ).all()
        
        truncated_list = []
        now = datetime.utcnow()
        for session in affected_sessions:
            session.status = "TRUNCATED"
            session.is_truncated = True
            session.truncation_reason = f"充电桩故障：{fault_code}"
            session.truncated_at = now
            session.end_time = now
            session.end_kwh = session.start_kwh + 1.5
            session.charged_kwh = session.end_kwh - session.start_kwh
            session.total_amount = round(session.charged_kwh * 1.5, 2)
            session.settlement_status = "PENDING"
            truncated_list.append(session)
        
        db.commit()
        return truncated_list
    
    @staticmethod
    def stop_session(db: Session, session_code: str, end_kwh: float) -> Tuple[dict, bool]:
        session = get_session_by_code(db, session_code)
        if not session:
            return {"success": False, "message": f"充电会话 [{session_code}] 不存在", "error_code": "SESSION_NOT_FOUND"}, False
        
        if session.status != "CHARGING":
            return {
                "success": False, 
                "message": f"充电会话 [{session_code}] 当前状态为 [{session.status}]，只有进行中的会话才能正常结束", 
                "error_code": "INVALID_STATUS"
            }, False
        
        if end_kwh < session.start_kwh:
            return {
                "success": False, 
                "message": f"结束电量 [{end_kwh}] 小于起始电量 [{session.start_kwh}]，数据异常", 
                "error_code": "INVALID_KWH"
            }, False
        
        now = datetime.utcnow()
        session.status = "COMPLETED"
        session.end_time = now
        session.end_kwh = end_kwh
        session.charged_kwh = end_kwh - session.start_kwh
        session.total_amount = round(session.charged_kwh * 1.5, 2)
        session.settlement_status = "PENDING"
        
        pile = db.query(ChargingPile).filter(ChargingPile.id == session.pile_id).first()
        if pile and pile.status == "IN_USE":
            pile.status = "AVAILABLE"
        
        db.commit()
        db.refresh(session)
        if pile:
            db.refresh(pile)
        
        return {
            "success": True,
            "message": f"充电会话 [{session_code}] 已正常结束，费用已计算",
            "data": {
                "session_code": session.session_code,
                "charged_kwh": session.charged_kwh,
                "total_amount": session.total_amount,
                "settlement_status": session.settlement_status,
                "end_time": session.end_time.isoformat()
            }
        }, True
    
    @staticmethod
    def settle_session(db: Session, session_code: str) -> Tuple[dict, bool]:
        session = get_session_by_code(db, session_code)
        if not session:
            return {"success": False, "message": f"充电会话 [{session_code}] 不存在", "error_code": "SESSION_NOT_FOUND"}, False
        
        if session.settlement_status == "SETTLED":
            return {
                "success": False, 
                "message": f"充电会话 [{session_code}] 已结算，不能重复结算", 
                "error_code": "ALREADY_SETTLED"
            }, False
        
        if session.settlement_status == "UNSETTLED":
            return {
                "success": False, 
                "message": f"充电会话 [{session_code}] 尚未计算费用，请先结束会话", 
                "error_code": "CHARGE_NOT_CALCULATED"
            }, False
        
        session.settlement_status = "SETTLED"
        db.commit()
        db.refresh(session)
        
        return {
            "success": True,
            "message": f"充电会话 [{session_code}] 已完成结算",
            "data": {
                "session_code": session.session_code,
                "total_amount": session.total_amount,
                "settlement_status": session.settlement_status
            }
        }, True


class DispatchService:
    @staticmethod
    def create_dispatch(db: Session, data: DispatchOrderCreate) -> Tuple[dict, bool]:
        fault = get_fault_by_code(db, data.fault_code)
        if not fault:
            return {"success": False, "message": f"故障事件 [{data.fault_code}] 不存在", "error_code": "FAULT_NOT_FOUND"}, False
        
        if fault.status == "RESOLVED":
            return {
                "success": False, 
                "message": f"故障事件 [{data.fault_code}] 已解决，无需派单", 
                "error_code": "FAULT_ALREADY_RESOLVED"
            }, False
        
        if fault.status == "CANCELLED":
            return {
                "success": False, 
                "message": f"故障事件 [{data.fault_code}] 已撤销，无需派单", 
                "error_code": "FAULT_CANCELLED"
            }, False
        
        active_dispatch = db.query(DispatchOrder).filter(
            DispatchOrder.fault_event_id == fault.id,
            DispatchOrder.status.in_(["PENDING", "ACCEPTED", "ON_SITE"])
        ).first()
        
        if active_dispatch:
            return {
                "success": False, 
                "message": f"故障事件 [{data.fault_code}] 已有进行中的派单 [{active_dispatch.order_code}]，不能重复派单", 
                "error_code": "ACTIVE_DISPATCH_EXISTS"
            }, False
        
        if fault.status == "OPEN":
            FaultEventService.acknowledge_fault(db, fault.fault_code)
        
        dispatch = DispatchOrder(
            order_code=generate_code("DSP"),
            fault_event_id=fault.id,
            engineer_id=data.engineer_id,
            engineer_name=data.engineer_name,
            engineer_phone=data.engineer_phone,
            priority=data.priority,
            status="PENDING",
            timeout_count=0
        )
        
        db.add(dispatch)
        fault.status = "IN_PROGRESS"
        db.commit()
        db.refresh(dispatch)
        db.refresh(fault)
        
        return {
            "success": True,
            "message": f"派单 [{dispatch.order_code}] 已创建，工程师 [{dispatch.engineer_name}] 已收到任务通知",
            "data": {
                "order_code": dispatch.order_code,
                "fault_code": fault.fault_code,
                "engineer_name": dispatch.engineer_name,
                "priority": dispatch.priority,
                "status": dispatch.status,
                "dispatched_at": dispatch.dispatched_at.isoformat(),
                "timeout_deadline": (dispatch.dispatched_at + timedelta(minutes=settings.DISPATCH_TIMEOUT_MINUTES)).isoformat()
            }
        }, True
    
    @staticmethod
    def accept_dispatch(db: Session, order_code: str) -> Tuple[dict, bool]:
        dispatch = get_dispatch_by_code(db, order_code)
        if not dispatch:
            return {"success": False, "message": f"派单 [{order_code}] 不存在", "error_code": "DISPATCH_NOT_FOUND"}, False
        
        if dispatch.status != "PENDING":
            return {
                "success": False, 
                "message": f"派单 [{order_code}] 当前状态为 [{dispatch.status}]，只有待接单状态的派单才能接单", 
                "error_code": "INVALID_STATUS"
            }, False
        
        dispatch.status = "ACCEPTED"
        dispatch.accepted_at = datetime.utcnow()
        db.commit()
        db.refresh(dispatch)
        
        return {
            "success": True,
            "message": f"派单 [{order_code}] 已接单，工程师 [{dispatch.engineer_name}] 正在前往现场",
            "data": {
                "order_code": dispatch.order_code,
                "status": dispatch.status,
                "accepted_at": dispatch.accepted_at.isoformat()
            }
        }, True
    
    @staticmethod
    def arrive_on_site(db: Session, order_code: str) -> Tuple[dict, bool]:
        dispatch = get_dispatch_by_code(db, order_code)
        if not dispatch:
            return {"success": False, "message": f"派单 [{order_code}] 不存在", "error_code": "DISPATCH_NOT_FOUND"}, False
        
        if dispatch.status != "ACCEPTED":
            return {
                "success": False, 
                "message": f"派单 [{order_code}] 当前状态为 [{dispatch.status}]，只有已接单状态的派单才能标记到达", 
                "error_code": "INVALID_STATUS"
            }, False
        
        dispatch.status = "ON_SITE"
        dispatch.arrived_at = datetime.utcnow()
        db.commit()
        db.refresh(dispatch)
        
        return {
            "success": True,
            "message": f"工程师 [{dispatch.engineer_name}] 已到达现场，开始处理故障",
            "data": {
                "order_code": dispatch.order_code,
                "status": dispatch.status,
                "arrived_at": dispatch.arrived_at.isoformat()
            }
        }, True
    
    @staticmethod
    def complete_dispatch(db: Session, order_code: str) -> Tuple[dict, bool]:
        dispatch = get_dispatch_by_code(db, order_code)
        if not dispatch:
            return {"success": False, "message": f"派单 [{order_code}] 不存在", "error_code": "DISPATCH_NOT_FOUND"}, False
        
        if dispatch.status != "ON_SITE":
            return {
                "success": False, 
                "message": f"派单 [{order_code}] 当前状态为 [{dispatch.status}]，只有到达现场的派单才能完成", 
                "error_code": "INVALID_STATUS"
            }, False
        
        dispatch.status = "COMPLETED"
        dispatch.completed_at = datetime.utcnow()
        db.commit()
        db.refresh(dispatch)
        
        return {
            "success": True,
            "message": f"派单 [{order_code}] 已完成，工程师 [{dispatch.engineer_name}] 已完成现场处理",
            "data": {
                "order_code": dispatch.order_code,
                "status": dispatch.status,
                "completed_at": dispatch.completed_at.isoformat()
            }
        }, True
    
    @staticmethod
    def cancel_dispatch(db: Session, order_code: str, reason: str) -> Tuple[dict, bool]:
        dispatch = get_dispatch_by_code(db, order_code)
        if not dispatch:
            return {"success": False, "message": f"派单 [{order_code}] 不存在", "error_code": "DISPATCH_NOT_FOUND"}, False
        
        if dispatch.status in ["COMPLETED", "CANCELLED"]:
            return {
                "success": False, 
                "message": f"派单 [{order_code}] 当前状态为 [{dispatch.status}]，无法撤销", 
                "error_code": "INVALID_STATUS"
            }, False
        
        dispatch.status = "CANCELLED"
        dispatch.remarks = f"{dispatch.remarks or ''} | 撤销原因: {reason}"
        db.commit()
        db.refresh(dispatch)
        
        fault = db.query(FaultEvent).filter(FaultEvent.id == dispatch.fault_event_id).first()
        if fault:
            active_dispatches = db.query(DispatchOrder).filter(
                DispatchOrder.fault_event_id == fault.id,
                DispatchOrder.status.in_(["PENDING", "ACCEPTED", "ON_SITE"])
            ).count()
            
            if active_dispatches == 0 and fault.status == "IN_PROGRESS":
                fault.status = "ACKNOWLEDGED"
                db.commit()
        
        return {
            "success": True,
            "message": f"派单 [{order_code}] 已撤销，撤销原因：{reason}",
            "data": {
                "order_code": dispatch.order_code,
                "status": dispatch.status,
                "cancellation_reason": reason
            }
        }, True
    
    @staticmethod
    def reassign_dispatch(db: Session, order_code: str, new_engineer_id: str, new_engineer_name: str, reason: str) -> Tuple[dict, bool]:
        dispatch = get_dispatch_by_code(db, order_code)
        if not dispatch:
            return {"success": False, "message": f"派单 [{order_code}] 不存在", "error_code": "DISPATCH_NOT_FOUND"}, False
        
        if dispatch.status in ["COMPLETED", "CANCELLED"]:
            return {
                "success": False, 
                "message": f"派单 [{order_code}] 当前状态为 [{dispatch.status}]，无法转单", 
                "error_code": "INVALID_STATUS"
            }, False
        
        old_engineer = dispatch.engineer_name
        
        dispatch.status = "CANCELLED"
        dispatch.remarks = f"{dispatch.remarks or ''} | 转单给新工程师: {new_engineer_name}，原因: {reason}"
        
        new_dispatch = DispatchOrder(
            order_code=generate_code("DSP"),
            fault_event_id=dispatch.fault_event_id,
            engineer_id=new_engineer_id,
            engineer_name=new_engineer_name,
            priority=dispatch.priority,
            status="PENDING",
            timeout_count=0,
            reassigned_from=dispatch.id
        )
        
        db.add(new_dispatch)
        db.commit()
        db.refresh(dispatch)
        db.refresh(new_dispatch)
        
        return {
            "success": True,
            "message": f"派单已从工程师 [{old_engineer}] 转单给 [{new_engineer_name}]，新派单号 [{new_dispatch.order_code}]",
            "data": {
                "old_order_code": dispatch.order_code,
                "new_order_code": new_dispatch.order_code,
                "old_engineer": old_engineer,
                "new_engineer": new_engineer_name,
                "reason": reason
            }
        }, True
    
    @staticmethod
    def handle_timeout(db: Session, order_code: str) -> Tuple[dict, bool]:
        dispatch = get_dispatch_by_code(db, order_code)
        if not dispatch:
            return {"success": False, "message": f"派单 [{order_code}] 不存在", "error_code": "DISPATCH_NOT_FOUND"}, False
        
        if dispatch.status != "PENDING":
            return {
                "success": False, 
                "message": f"派单 [{order_code}] 当前状态为 [{dispatch.status}]，只有待接单状态才处理超时", 
                "error_code": "INVALID_STATUS"
            }, False
        
        now = datetime.utcnow()
        timeout_deadline = dispatch.dispatched_at + timedelta(minutes=settings.DISPATCH_TIMEOUT_MINUTES)
        
        if now < timeout_deadline:
            remaining = (timeout_deadline - now).total_seconds() / 60
            return {
                "success": False, 
                "message": f"派单 [{order_code}] 尚未超时，距离超时还有 {remaining:.1f} 分钟", 
                "error_code": "NOT_YET_TIMEOUT"
            }, False
        
        dispatch.timeout_count += 1
        
        if dispatch.timeout_count < 2:
            dispatch.status = "PENDING"
            dispatch.dispatched_at = now
            db.commit()
            db.refresh(dispatch)
            
            return {
                "success": True,
                "message": f"派单 [{order_code}] 已超时，已重新派送给同一工程师 [{dispatch.engineer_name}]（第 {dispatch.timeout_count} 次）",
                "data": {
                    "order_code": dispatch.order_code,
                    "timeout_count": dispatch.timeout_count,
                    "new_timeout_deadline": (now + timedelta(minutes=settings.DISPATCH_TIMEOUT_MINUTES)).isoformat()
                }
            }, True
        else:
            dispatch.status = "TIMEOUT"
            db.commit()
            db.refresh(dispatch)
            
            return {
                "success": True,
                "message": f"派单 [{order_code}] 多次超时（{dispatch.timeout_count} 次），已标记为超时状态，建议转单给其他工程师",
                "data": {
                    "order_code": dispatch.order_code,
                    "status": dispatch.status,
                    "timeout_count": dispatch.timeout_count,
                    "action_required": "建议转单或升级处理"
                }
            }, True


class SLAService:
    @staticmethod
    def create_sla_record(db: Session, fault_event_id: int, fault_level: str) -> SLARecord:
        target_minutes = {
            "CRITICAL": 15,
            "HIGH": 30,
            "MEDIUM": 60,
            "LOW": 120
        }.get(fault_level, 30)
        
        sla = SLARecord(
            fault_event_id=fault_event_id,
            sla_type="FIRST_RESPONSE",
            target_minutes=target_minutes,
            warning_sent=False
        )
        
        db.add(sla)
        db.commit()
        db.refresh(sla)
        return sla
    
    @staticmethod
    def check_and_update_sla(db: Session, fault_event_id: int, event_type: str, event_time: datetime):
        sla = db.query(SLARecord).filter(
            SLARecord.fault_event_id == fault_event_id,
            SLARecord.sla_type == "FIRST_RESPONSE"
        ).first()
        
        if not sla:
            return
        
        fault = db.query(FaultEvent).filter(FaultEvent.id == fault_event_id).first()
        if not fault:
            return
        
        if event_type == "acknowledged":
            actual_time = (event_time - fault.reported_at).total_seconds() / 60
            sla.actual_minutes = round(actual_time, 2)
            sla.is_met = actual_time <= sla.target_minutes
            db.commit()
            db.refresh(sla)
        
        elif event_type == "resolved":
            if sla.actual_minutes is None:
                actual_time = (event_time - fault.reported_at).total_seconds() / 60
                sla.actual_minutes = round(actual_time, 2)
                sla.is_met = actual_time <= sla.target_minutes
            db.commit()
            db.refresh(sla)
    
    @staticmethod
    def cancel_sla(db: Session, fault_event_id: int):
        slas = db.query(SLARecord).filter(
            SLARecord.fault_event_id == fault_event_id
        ).all()
        
        for sla in slas:
            if sla.actual_minutes is None:
                sla.is_met = None
        db.commit()
    
    @staticmethod
    def check_sla_warnings(db: Session) -> List[dict]:
        now = datetime.utcnow()
        active_faults = db.query(FaultEvent).filter(
            FaultEvent.status.in_(["OPEN", "ACKNOWLEDGED", "IN_PROGRESS"]),
            FaultEvent.sla_expires_at.isnot(None)
        ).all()
        
        warnings = []
        for fault in active_faults:
            sla = db.query(SLARecord).filter(
                SLARecord.fault_event_id == fault.id,
                SLARecord.sla_type == "FIRST_RESPONSE"
            ).first()
            
            if not sla:
                continue
            
            time_to_expire = (fault.sla_expires_at - now).total_seconds() / 60
            
            if time_to_expire <= 0:
                if not sla.expired_at:
                    sla.expired_at = now
                    sla.is_met = False
                    warnings.append({
                        "fault_code": fault.fault_code,
                        "severity": "CRITICAL",
                        "message": f"故障 [{fault.fault_code}] SLA 已过期！目标响应时间 {sla.target_minutes} 分钟"
                    })
            elif time_to_expire <= settings.SLA_WARNING_MINUTES and not sla.warning_sent:
                sla.warning_sent = True
                warnings.append({
                    "fault_code": fault.fault_code,
                    "severity": "WARNING",
                    "message": f"故障 [{fault.fault_code}] SLA 即将过期，还剩 {time_to_expire:.0f} 分钟"
                })
        
        db.commit()
        return warnings


class RecoveryReportService:
    @staticmethod
    def create_report(db: Session, data: RecoveryReportCreate) -> Tuple[dict, bool]:
        fault = get_fault_by_code(db, data.fault_code)
        if not fault:
            return {"success": False, "message": f"故障事件 [{data.fault_code}] 不存在", "error_code": "FAULT_NOT_FOUND"}, False
        
        if fault.recovery_report:
            return {
                "success": False, 
                "message": f"故障事件 [{data.fault_code}] 已存在恢复报告 [{fault.recovery_report.report_code}]，不能重复创建", 
                "error_code": "REPORT_EXISTS"
            }, False
        
        active_dispatch = db.query(DispatchOrder).filter(
            DispatchOrder.fault_event_id == fault.id,
            DispatchOrder.status != "COMPLETED"
        ).first()
        
        if active_dispatch:
            return {
                "success": False, 
                "message": f"故障事件 [{data.fault_code}] 存在未完成的派单 [{active_dispatch.order_code}]，请先完成派单", 
                "error_code": "ACTIVE_DISPATCH_EXISTS"
            }, False
        
        report = RecoveryReport(
            fault_event_id=fault.id,
            report_code=generate_code("RPT"),
            root_cause=data.root_cause,
            solution=data.solution,
            preventive_measures=data.preventive_measures,
            recovery_time_minutes=data.recovery_time_minutes,
            parts_replaced=data.parts_replaced,
            status="DRAFT"
        )
        
        db.add(report)
        db.commit()
        db.refresh(report)
        
        return {
            "success": True,
            "message": f"恢复报告 [{report.report_code}] 已创建，等待验证",
            "data": {
                "report_code": report.report_code,
                "fault_code": fault.fault_code,
                "status": report.status,
                "root_cause": report.root_cause
            }
        }, True
    
    @staticmethod
    def verify_report(db: Session, report_code: str, verified_by: str) -> Tuple[dict, bool]:
        report = db.query(RecoveryReport).filter(RecoveryReport.report_code == report_code).first()
        if not report:
            return {"success": False, "message": f"恢复报告 [{report_code}] 不存在", "error_code": "REPORT_NOT_FOUND"}, False
        
        if report.status == "VERIFIED":
            return {
                "success": False, 
                "message": f"恢复报告 [{report_code}] 已验证，不能重复验证", 
                "error_code": "ALREADY_VERIFIED"
            }, False
        
        report.status = "VERIFIED"
        report.verified_by = verified_by
        report.verified_at = datetime.utcnow()
        db.commit()
        db.refresh(report)
        
        fault = db.query(FaultEvent).filter(FaultEvent.id == report.fault_event_id).first()
        
        return {
            "success": True,
            "message": f"恢复报告 [{report_code}] 已由 [{verified_by}] 验证通过，故障 [{fault.fault_code if fault else '未知'}] 可以标记为解决",
            "data": {
                "report_code": report.report_code,
                "status": report.status,
                "verified_by": report.verified_by,
                "verified_at": report.verified_at.isoformat()
            }
        }, True
