from fastapi import APIRouter, Depends, HTTPException, Header, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime

from database import get_db
from schemas import (
    ErrorEventCreate, ErrorEventResponse, AttributionRuleCreate,
    AttributionRuleResponse, RootCauseLabelCreate, DispatchRecordCreate,
    StatusTransitionRequest, PaginatedResponse
)
from models import TicketStatus
from services import (
    create_error_event, match_attribution_rules, find_similar_tickets,
    merge_similar_ticket, label_root_cause, create_dispatch_record,
    get_status_history, get_attribution_report, list_tickets,
    create_attribution_rule, transition_status
)
from exceptions import (
    IdempotencyConflict, TicketNotFound, InvalidStatusTransition,
    ValidationError
)

router = APIRouter()


@router.post("/tickets", status_code=201)
async def create_ticket(
    event: ErrorEventCreate,
    db: Session = Depends(get_db)
):
    ticket, created = create_error_event(db, event)
    if not created:
        raise IdempotencyConflict(
            message="工单已存在，重复提交",
            details={"ticket_id": ticket.ticket_id, "idempotency_key": event.idempotency_key}
        )
    return {
        "id": ticket.id,
        "idempotency_key": ticket.idempotency_key,
        "ticket_id": ticket.ticket_id,
        "title": ticket.title,
        "description": ticket.description,
        "error_code": ticket.error_code,
        "error_message": ticket.error_message,
        "api_path": ticket.api_path,
        "severity": ticket.severity,
        "status": ticket.status.value,
        "created_at": ticket.created_at,
        "updated_at": ticket.updated_at
    }


@router.get("/tickets")
async def get_tickets(
    status: Optional[TicketStatus] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    items, total = list_tickets(db, status=status, page=page, page_size=page_size)
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [
            {
                "id": item.id,
                "ticket_id": item.ticket_id,
                "title": item.title,
                "error_code": item.error_code,
                "api_path": item.api_path,
                "status": item.status.value,
                "severity": item.severity,
                "created_at": item.created_at
            }
            for item in items
        ]
    }


@router.get("/tickets/{ticket_id}")
async def get_ticket(ticket_id: int, db: Session = Depends(get_db)):
    from models import ErrorEvent
    ticket = db.query(ErrorEvent).filter(ErrorEvent.id == ticket_id).first()
    if not ticket:
        raise TicketNotFound(str(ticket_id))
    return {
        "id": ticket.id,
        "ticket_id": ticket.ticket_id,
        "title": ticket.title,
        "description": ticket.description,
        "error_code": ticket.error_code,
        "error_message": ticket.error_message,
        "api_path": ticket.api_path,
        "stack_trace": ticket.stack_trace,
        "severity": ticket.severity,
        "status": ticket.status.value,
        "created_at": ticket.created_at,
        "updated_at": ticket.updated_at
    }


@router.post("/tickets/{ticket_id}/match-rules")
async def match_rules(ticket_id: int, db: Session = Depends(get_db)):
    try:
        matches = match_attribution_rules(db, ticket_id)
        return {
            "ticket_id": ticket_id,
            "matched_rules_count": len(matches),
            "matches": [{"rule_id": m.rule_id, "score": m.match_score} for m in matches]
        }
    except ValueError as e:
        raise TicketNotFound(str(ticket_id))


@router.post("/tickets/{ticket_id}/find-similar")
async def find_similar(
    ticket_id: int,
    threshold: int = Query(30, ge=0, le=100),
    db: Session = Depends(get_db)
):
    try:
        similar = find_similar_tickets(db, ticket_id, threshold)
        return {
            "ticket_id": ticket_id,
            "similar_tickets_count": len(similar),
            "similar_tickets": [
                {"similar_ticket_id": s.similar_ticket_id, "score": s.similarity_score}
                for s in similar
            ]
        }
    except ValueError as e:
        raise TicketNotFound(str(ticket_id))


@router.post("/tickets/{ticket_id}/merge/{similar_ticket_id}")
async def merge_ticket(
    ticket_id: int,
    similar_ticket_id: int,
    db: Session = Depends(get_db)
):
    try:
        result = merge_similar_ticket(db, ticket_id, similar_ticket_id)
        return {
            "ticket_id": ticket_id,
            "similar_ticket_id": similar_ticket_id,
            "merged": result.merged,
            "merged_at": result.merged_at
        }
    except ValueError as e:
        raise ValidationError(str(e))


@router.post("/root-cause-labels")
async def add_root_cause_label(
    label_data: RootCauseLabelCreate,
    db: Session = Depends(get_db)
):
    try:
        label = label_root_cause(db, label_data)
        return {
            "ticket_id": label.ticket_id,
            "root_cause_category": label.root_cause_category,
            "confidence_score": label.confidence_score,
            "tagged_at": label.tagged_at
        }
    except ValueError as e:
        raise TicketNotFound(str(label_data.ticket_id))


@router.post("/dispatch-records")
async def dispatch_ticket(
    dispatch_data: DispatchRecordCreate,
    db: Session = Depends(get_db)
):
    try:
        dispatch = create_dispatch_record(db, dispatch_data)
        return {
            "ticket_id": dispatch.ticket_id,
            "assignee": dispatch.assignee,
            "dispatched_at": dispatch.dispatched_at
        }
    except ValueError as e:
        raise TicketNotFound(str(dispatch_data.ticket_id))


@router.post("/status-transitions")
async def change_status(
    request: StatusTransitionRequest,
    db: Session = Depends(get_db)
):
    try:
        ticket = transition_status(db, request)
        return {
            "ticket_id": ticket.id,
            "status": ticket.status,
            "transitioned_at": datetime.now()
        }
    except ValueError as e:
        raise TicketNotFound(str(request.ticket_id))


@router.get("/tickets/{ticket_id}/status-history")
async def get_ticket_status_history(ticket_id: int, db: Session = Depends(get_db)):
    from models import ErrorEvent
    ticket = db.query(ErrorEvent).filter(ErrorEvent.id == ticket_id).first()
    if not ticket:
        raise TicketNotFound(str(ticket_id))

    history = get_status_history(db, ticket_id)
    return {
        "ticket_id": ticket_id,
        "history_count": len(history),
        "history": [
            {
                "from_status": h.from_status,
                "to_status": h.to_status,
                "reason": h.reason,
                "changed_by": h.changed_by,
                "changed_at": h.changed_at
            }
            for h in history
        ]
    }


@router.get("/tickets/{ticket_id}/report")
async def get_ticket_report(ticket_id: int, db: Session = Depends(get_db)):
    try:
        report = get_attribution_report(db, ticket_id)
        return report
    except ValueError as e:
        raise TicketNotFound(str(ticket_id))


@router.post("/attribution-rules", status_code=201)
async def create_rule(
    rule_data: AttributionRuleCreate,
    db: Session = Depends(get_db)
):
    rule = create_attribution_rule(db, rule_data)
    return {
        "id": rule.id,
        "name": rule.name,
        "description": rule.description,
        "error_code_pattern": rule.error_code_pattern,
        "api_path_pattern": rule.api_path_pattern,
        "keyword_pattern": rule.keyword_pattern,
        "root_cause_tag": rule.root_cause_tag,
        "assignee": rule.assignee,
        "is_active": rule.is_active,
        "priority": rule.priority,
        "created_at": rule.created_at
    }


@router.get("/attribution-rules")
async def list_rules(
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    from models import AttributionRule
    query = db.query(AttributionRule)
    if is_active is not None:
        query = query.filter(AttributionRule.is_active == is_active)
    rules = query.order_by(AttributionRule.priority.desc()).all()
    return [
        {
            "id": rule.id,
            "name": rule.name,
            "description": rule.description,
            "is_active": rule.is_active,
            "priority": rule.priority,
            "created_at": rule.created_at
        }
        for rule in rules
    ]