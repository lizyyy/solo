from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import get_db
from models import Ticket, SLARule, PauseReason, Holiday, EscalationRecord, ApprovalRecord, SLATimeline, SLACompensation
from schemas import (
    TicketCreate, TicketUpdate, TicketResponse, TicketDetailResponse,
    SLARuleCreate, SLARuleResponse,
    PauseReasonCreate, PauseReasonResponse,
    HolidayCreate, HolidayResponse,
    EscalationRecordCreate, EscalationRecordResponse,
    ApprovalRecordCreate, ApprovalRecordResponse,
    SLACalculationRequest, SLACalculationResponse,
    PauseRequest, ResumeRequest, CompensationRequest,
    ApprovalRequest, ApprovalActionRequest, ReportRequest, ExportColumn
)
from services.sla_calculator import SLACalculator

router = APIRouter(prefix="/api/tickets", tags=["tickets"])


@router.get("/", response_model=List[TicketResponse])
def get_tickets(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Ticket)
    if status:
        query = query.filter(Ticket.status == status)
    if priority:
        query = query.filter(Ticket.priority == priority)
    return query.offset(skip).limit(limit).all()


@router.get("/{ticket_id}", response_model=TicketDetailResponse)
def get_ticket(ticket_id: int, db: Session = Depends(get_db)):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="工单不存在")

    compensations = db.query(SLACompensation).filter(
        SLACompensation.ticket_id == ticket_id
    ).all()

    return {
        "ticket": ticket,
        "sla_rule": ticket.sla_rule,
        "timeline": ticket.sla_timeline,
        "pause_records": ticket.pause_records,
        "escalation_records": ticket.escalation_records,
        "approval_records": ticket.approval_records,
        "compensation_records": compensations
    }


@router.post("/", response_model=TicketResponse)
def create_ticket(ticket_data: TicketCreate, db: Session = Depends(get_db)):
    existing = db.query(Ticket).filter(Ticket.ticket_no == ticket_data.ticket_no).first()
    if existing:
        raise HTTPException(status_code=400, detail="工单编号已存在")

    ticket = Ticket(**ticket_data.dict())
    db.add(ticket)
    db.flush()

    if ticket.sla_rule_id:
        sla_rule = db.query(SLARule).filter(SLARule.id == ticket.sla_rule_id).first()
        if sla_rule:
            calculator = SLACalculator(db)
            deadline = calculator.calculate_deadline(
                datetime.now(), sla_rule.resolution_hours, sla_rule
            )
            ticket.sla_deadline = deadline
            ticket.remaining_hours = sla_rule.resolution_hours

    timeline = SLATimeline(
        ticket_id=ticket.id,
        event_type="create",
        event_title="工单创建",
        event_detail=f"工单由 {ticket.creator} 创建",
        operator=ticket.creator,
        sla_impact_hours=0,
        remaining_before=ticket.remaining_hours,
        remaining_after=ticket.remaining_hours
    )
    db.add(timeline)
    db.commit()
    db.refresh(ticket)
    return ticket


@router.put("/{ticket_id}", response_model=TicketResponse)
def update_ticket(ticket_id: int, ticket_data: TicketUpdate, db: Session = Depends(get_db)):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="工单不存在")

    for field, value in ticket_data.dict(exclude_unset=True).items():
        setattr(ticket, field, value)

    if ticket_data.status in ["resolved", "closed"]:
        now = datetime.now()
        if ticket_data.status == "resolved":
            ticket.resolved_at = now
        if ticket_data.status == "closed":
            ticket.closed_at = now
        calculator = SLACalculator(db)
        calculator.recalculate_ticket_sla(ticket)

    ticket.updated_at = datetime.now()
    db.commit()
    db.refresh(ticket)
    return ticket


@router.post("/{ticket_id}/pause")
def pause_ticket(ticket_id: int, pause_data: PauseRequest, db: Session = Depends(get_db)):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="工单不存在")

    reason = db.query(PauseReason).filter(
        PauseReason.code == pause_data.pause_reason_code
    ).first()
    reason_name = reason.name if reason else pause_data.pause_reason_code

    calculator = SLACalculator(db)
    pause_record = calculator.pause_ticket(
        ticket, pause_data.pause_reason_code, reason_name,
        pause_data.paused_by, pause_data.remarks
    )

    return {"message": "SLA已暂停", "pause_id": pause_record.id}


@router.post("/{ticket_id}/resume")
def resume_ticket(ticket_id: int, resume_data: ResumeRequest, db: Session = Depends(get_db)):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="工单不存在")

    calculator = SLACalculator(db)
    try:
        pause_record = calculator.resume_ticket(ticket, resume_data.resumed_by)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {"message": "SLA已恢复", "pause_id": pause_record.id, "duration": pause_record.pause_duration_hours}


@router.post("/{ticket_id}/compensation")
def apply_compensation(ticket_id: int, comp_data: CompensationRequest, db: Session = Depends(get_db)):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="工单不存在")

    calculator = SLACalculator(db)
    compensation = calculator.apply_compensation(
        ticket, comp_data.compensation_type, comp_data.compensation_hours,
        comp_data.reason, comp_data.operator
    )

    return {"message": "补偿已应用", "compensation_id": compensation.id}


@router.post("/calculate-sla", response_model=SLACalculationResponse)
def calculate_sla(calc_data: SLACalculationRequest, db: Session = Depends(get_db)):
    ticket = db.query(Ticket).filter(Ticket.id == calc_data.ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="工单不存在")

    calculator = SLACalculator(db)

    if calc_data.recalculate:
        calculator.recalculate_ticket_sla(ticket)

    used_hours, remaining_hours, sla_deadline, sla_status = calculator.calculate_sla(ticket)

    return {
        "ticket_id": ticket.id,
        "remaining_hours": remaining_hours,
        "used_hours": used_hours,
        "sla_deadline": sla_deadline,
        "sla_status": sla_status,
        "calculation_time": datetime.now()
    }


@router.get("/{ticket_id}/sla-paths")
def get_sla_paths(ticket_id: int, db: Session = Depends(get_db)):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="工单不存在")

    calculator = SLACalculator(db)
    paths = calculator.check_sla_paths(ticket)

    return {
        "ticket_id": ticket.id,
        "ticket_no": ticket.ticket_no,
        "paths": paths,
        "path_descriptions": {
            "success": "正常路径 - 工单在SLA时间内完成",
            "blocked": "拦截路径 - SLA因等待第三方或客户信息暂停",
            "compensation": "补偿路径 - 因特殊情况申请SLA补偿",
            "manual_review": "人工复核路径 - SLA超时或紧急工单需人工审核"
        }
    }


@router.post("/escalation", response_model=EscalationRecordResponse)
def create_escalation(esc_data: EscalationRecordCreate, db: Session = Depends(get_db)):
    ticket = db.query(Ticket).filter(Ticket.id == esc_data.ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="工单不存在")

    escalation = EscalationRecord(**esc_data.dict())
    db.add(escalation)

    timeline = SLATimeline(
        ticket_id=esc_data.ticket_id,
        event_type="escalation",
        event_title=f"工单升级: {esc_data.escalation_type}",
        event_detail=f"升级级别: {esc_data.escalation_level}, 升级至: {esc_data.escalated_to or '未指定'}",
        operator=esc_data.escalated_by or "系统",
        sla_impact_hours=0,
        remaining_before=ticket.remaining_hours,
        remaining_after=ticket.remaining_hours
    )
    db.add(timeline)
    db.commit()
    db.refresh(escalation)
    return escalation


@router.post("/approval", response_model=ApprovalRecordResponse)
def create_approval(app_data: ApprovalRecordCreate, db: Session = Depends(get_db)):
    ticket = db.query(Ticket).filter(Ticket.id == app_data.ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="工单不存在")

    approval = ApprovalRecord(**app_data.dict())
    db.add(approval)

    timeline = SLATimeline(
        ticket_id=app_data.ticket_id,
        event_type="approval",
        event_title=f"审批申请: {app_data.approval_type}",
        event_detail=f"申请人: {app_data.applicant}, 原因: {app_data.reason or '未说明'}",
        operator=app_data.applicant,
        sla_impact_hours=0,
        remaining_before=ticket.remaining_hours,
        remaining_after=ticket.remaining_hours
    )
    db.add(timeline)
    db.commit()
    db.refresh(approval)
    return approval


@router.post("/approval/{approval_id}/action")
def approval_action(approval_id: int, action_data: ApprovalActionRequest, db: Session = Depends(get_db)):
    approval = db.query(ApprovalRecord).filter(ApprovalRecord.id == approval_id).first()
    if not approval:
        raise HTTPException(status_code=404, detail="审批记录不存在")

    if approval.status != "pending":
        raise HTTPException(status_code=400, detail="该审批已处理")

    now = datetime.now()
    approval.approver = action_data.approver
    approval.approval_remarks = action_data.remarks

    if action_data.action == "approve":
        approval.status = "approved"
        approval.approved_at = now
        message = "审批已通过"
    elif action_data.action == "reject":
        approval.status = "rejected"
        approval.rejected_at = now
        message = "审批已拒绝"
    else:
        raise HTTPException(status_code=400, detail="无效的操作类型")

    db.commit()
    return {"message": message, "status": approval.status}
