import hashlib
from datetime import datetime, timedelta
from typing import Optional, List
from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, desc, asc
import pandas as pd

from app.database import get_db
from app.models import (
    AnomalyRecord, ConfirmationHistory, IgnoreReason,
    TicketLink, RecoveryEvent, AnomalyStatus, IdempotentRequest
)
from app.schemas import (
    AnomalyRecordCreate, AnomalyRecordUpdate, AnomalyRecord as AnomalyRecordSchema,
    AnomalyListResponse, StatusTransition, ExportRequest, BatchActionRequest
)

router = APIRouter()


def generate_idempotency_key(data: dict) -> str:
    sorted_items = sorted(data.items())
    key_string = "|".join(f"{k}:{v}" for k, v in sorted_items)
    return hashlib.sha256(key_string.encode()).hexdigest()


def check_idempotency(db: Session, idempotency_key: str, endpoint: str):
    if not idempotency_key:
        return None
    existing = db.query(IdempotentRequest).filter(
        IdempotentRequest.idempotency_key == idempotency_key
    ).first()
    if existing:
        if existing.status == "completed":
            return existing.response_data
        elif existing.status == "processing":
            raise HTTPException(status_code=409, detail="请求正在处理中，请稍后重试")
    return None


def create_idempotent_record(db: Session, idempotency_key: str, endpoint: str):
    if not idempotency_key:
        return None
    record = IdempotentRequest(
        idempotency_key=idempotency_key,
        endpoint=endpoint,
        status="processing",
        expires_at=datetime.utcnow() + timedelta(hours=24)
    )
    db.add(record)
    db.commit()
    return record


def complete_idempotent_record(db: Session, idempotency_key: str, response_data: dict):
    if not idempotency_key:
        return
    record = db.query(IdempotentRequest).filter(
        IdempotentRequest.idempotency_key == idempotency_key
    ).first()
    if record:
        record.status = "completed"
        record.response_data = response_data
        db.commit()


@router.post("/", response_model=AnomalyRecordSchema)
async def create_anomaly(
    anomaly: AnomalyRecordCreate,
    x_idempotency_key: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    data_dict = anomaly.model_dump()
    idempotency_key = x_idempotency_key or anomaly.idempotency_key

    if not idempotency_key:
        idempotency_key = generate_idempotency_key({
            "device_id": anomaly.device_id,
            "title": anomaly.title,
            "timestamp": datetime.utcnow().isoformat()
        })

    existing_anomaly = db.query(AnomalyRecord).filter(
        AnomalyRecord.anomaly_idempotency_key == idempotency_key
    ).first()
    if existing_anomaly:
        return existing_anomaly

    idempotent_req = db.query(IdempotentRequest).filter(
        IdempotentRequest.idempotency_key == idempotency_key
    ).first()

    if idempotent_req:
        if idempotent_req.status == "processing":
            raise HTTPException(status_code=409, detail="请求正在处理中，请稍后重试")
        elif idempotent_req.status == "completed":
            existing = db.query(AnomalyRecord).filter(
                AnomalyRecord.anomaly_idempotency_key == idempotency_key
            ).first()
            if existing:
                return existing
    else:
        idempotent_req = IdempotentRequest(
            idempotency_key=idempotency_key,
            endpoint="create_anomaly",
            status="processing",
            expires_at=datetime.utcnow() + timedelta(hours=24)
        )
        db.add(idempotent_req)
        db.commit()

    try:
        db_anomaly = AnomalyRecord(
            anomaly_idempotency_key=idempotency_key,
            device_id=anomaly.device_id,
            metric_id=anomaly.metric_id,
            rule_id=anomaly.rule_id,
            title=anomaly.title,
            description=anomaly.description,
            severity=anomaly.severity,
            current_value=anomaly.current_value,
            previous_value=anomaly.previous_value,
            threshold_value=anomaly.threshold_value,
            status=AnomalyStatus.PENDING,
            extra=anomaly.extra
        )
        db.add(db_anomaly)
        db.commit()
        db.refresh(db_anomaly)

        idempotent_req.status = "completed"
        idempotent_req.response_data = {"anomaly_id": db_anomaly.id}
        db.commit()

        return db_anomaly
    except Exception as e:
        idempotent_req.status = "failed"
        db.commit()
        raise


@router.get("/", response_model=AnomalyListResponse)
async def get_anomalies(
    status: Optional[str] = None,
    severity: Optional[str] = None,
    device_id: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
    sort_by: str = "detected_at",
    sort_order: str = "desc",
    db: Session = Depends(get_db)
):
    query = db.query(AnomalyRecord)

    if status:
        status_list = status.split(",")
        query = query.filter(AnomalyRecord.status.in_(status_list))
    if severity:
        query = query.filter(AnomalyRecord.severity == severity)
    if device_id:
        query = query.filter(AnomalyRecord.device_id.contains(device_id))

    total = query.count()

    if sort_order == "desc":
        query = query.order_by(desc(getattr(AnomalyRecord, sort_by, AnomalyRecord.detected_at)))
    else:
        query = query.order_by(asc(getattr(AnomalyRecord, sort_by, AnomalyRecord.detected_at)))

    anomalies = query.offset((page - 1) * page_size).limit(page_size).all()

    return AnomalyListResponse(
        total=total,
        page=page,
        page_size=page_size,
        items=anomalies
    )


@router.get("/{anomaly_id}", response_model=AnomalyRecordSchema)
async def get_anomaly(anomaly_id: int, db: Session = Depends(get_db)):
    anomaly = db.query(AnomalyRecord).filter(AnomalyRecord.id == anomaly_id).first()
    if not anomaly:
        raise HTTPException(status_code=404, detail="异常记录不存在")
    return anomaly


@router.put("/{anomaly_id}/status", response_model=AnomalyRecordSchema)
async def update_status(
    anomaly_id: int,
    transition: StatusTransition,
    db: Session = Depends(get_db)
):
    anomaly = db.query(AnomalyRecord).filter(AnomalyRecord.id == anomaly_id).first()
    if not anomaly:
        raise HTTPException(status_code=404, detail="异常记录不存在")

    previous_status = anomaly.status
    new_status = transition.new_status

    valid_transitions = {
        AnomalyStatus.PENDING: [AnomalyStatus.CONFIRMED, AnomalyStatus.IGNORED, AnomalyStatus.TICKETED],
        AnomalyStatus.CONFIRMED: [AnomalyStatus.TICKETED, AnomalyStatus.RECOVERED, AnomalyStatus.IGNORED],
        AnomalyStatus.TICKETED: [AnomalyStatus.RECOVERED, AnomalyStatus.CLOSED],
        AnomalyStatus.RECOVERED: [AnomalyStatus.CLOSED],
        AnomalyStatus.IGNORED: [AnomalyStatus.PENDING, AnomalyStatus.CONFIRMED],
        AnomalyStatus.CLOSED: []
    }

    if new_status not in valid_transitions.get(previous_status, []):
        raise HTTPException(
            status_code=400,
            detail=f"无效的状态转换: {previous_status} -> {new_status}"
        )

    history = ConfirmationHistory(
        anomaly_id=anomaly_id,
        operator_id=transition.operator_id,
        operator_name=transition.operator_name,
        previous_status=previous_status,
        new_status=new_status,
        comment=transition.comment
    )
    db.add(history)

    if new_status == AnomalyStatus.IGNORED:
        if not transition.reason_category:
            raise HTTPException(status_code=400, detail="忽略异常需要提供原因分类")
        ignore_reason = IgnoreReason(
            anomaly_id=anomaly_id,
            operator_id=transition.operator_id,
            operator_name=transition.operator_name,
            reason_category=transition.reason_category,
            reason_detail=transition.reason_detail
        )
        db.add(ignore_reason)

    if new_status == AnomalyStatus.TICKETED:
        if not transition.ticket_id:
            raise HTTPException(status_code=400, detail="转工单需要提供工单ID")
        ticket = TicketLink(
            anomaly_id=anomaly_id,
            ticket_id=transition.ticket_id,
            ticket_url=transition.ticket_url,
            ticket_title=transition.ticket_title,
            operator_id=transition.operator_id,
            operator_name=transition.operator_name
        )
        db.add(ticket)

    if new_status == AnomalyStatus.RECOVERED:
        anomaly.recovered_at = datetime.utcnow()

    if new_status == AnomalyStatus.CONFIRMED:
        anomaly.confirmed_at = datetime.utcnow()

    if new_status == AnomalyStatus.CLOSED:
        anomaly.closed_at = datetime.utcnow()

    anomaly.status = new_status
    db.commit()
    db.refresh(anomaly)

    return anomaly


@router.post("/{anomaly_id}/recovery", response_model=AnomalyRecordSchema)
async def record_recovery(
    anomaly_id: int,
    recovery_data: dict,
    db: Session = Depends(get_db)
):
    anomaly = db.query(AnomalyRecord).filter(AnomalyRecord.id == anomaly_id).first()
    if not anomaly:
        raise HTTPException(status_code=404, detail="异常记录不存在")

    recovery = RecoveryEvent(
        anomaly_id=anomaly_id,
        recovered_value=recovery_data.get("recovered_value"),
        recovery_method=recovery_data.get("recovery_method"),
        recovery_details=recovery_data.get("recovery_details"),
        auto_closed=recovery_data.get("auto_closed", False)
    )
    db.add(recovery)

    anomaly.status = AnomalyStatus.RECOVERED
    anomaly.recovered_at = datetime.utcnow()

    db.commit()
    db.refresh(anomaly)

    return anomaly


@router.post("/batch")
async def batch_action(batch_request: BatchActionRequest, db: Session = Depends(get_db)):
    results = []
    errors = []

    for anomaly_id in batch_request.anomaly_ids:
        try:
            anomaly = db.query(AnomalyRecord).filter(AnomalyRecord.id == anomaly_id).first()
            if not anomaly:
                errors.append({"id": anomaly_id, "error": "记录不存在"})
                continue

            if batch_request.action == "confirm":
                if anomaly.status == AnomalyStatus.PENDING:
                    anomaly.status = AnomalyStatus.CONFIRMED
                    anomaly.confirmed_at = datetime.utcnow()
                    history = ConfirmationHistory(
                        anomaly_id=anomaly_id,
                        operator_id=batch_request.operator_id,
                        operator_name=batch_request.operator_name,
                        previous_status=AnomalyStatus.PENDING,
                        new_status=AnomalyStatus.CONFIRMED,
                        comment=batch_request.comment
                    )
                    db.add(history)
                    results.append({"id": anomaly_id, "status": "confirmed"})
            elif batch_request.action == "ignore":
                if anomaly.status in [AnomalyStatus.PENDING, AnomalyStatus.CONFIRMED]:
                    anomaly.status = AnomalyStatus.IGNORED
                    history = ConfirmationHistory(
                        anomaly_id=anomaly_id,
                        operator_id=batch_request.operator_id,
                        operator_name=batch_request.operator_name,
                        previous_status=anomaly.status,
                        new_status=AnomalyStatus.IGNORED,
                        comment=batch_request.comment
                    )
                    db.add(history)
                    results.append({"id": anomaly_id, "status": "ignored"})
            elif batch_request.action == "close":
                if anomaly.status in [AnomalyStatus.RECOVERED, AnomalyStatus.IGNORED]:
                    anomaly.status = AnomalyStatus.CLOSED
                    anomaly.closed_at = datetime.utcnow()
                    history = ConfirmationHistory(
                        anomaly_id=anomaly_id,
                        operator_id=batch_request.operator_id,
                        operator_name=batch_request.operator_name,
                        previous_status=anomaly.status,
                        new_status=AnomalyStatus.CLOSED,
                        comment=batch_request.comment
                    )
                    db.add(history)
                    results.append({"id": anomaly_id, "status": "closed"})
            else:
                errors.append({"id": anomaly_id, "error": "不支持的操作"})
        except Exception as e:
            errors.append({"id": anomaly_id, "error": str(e)})

    db.commit()
    return {"success": len(results), "failed": len(errors), "results": results, "errors": errors}


@router.post("/export")
async def export_anomalies(export_request: ExportRequest, db: Session = Depends(get_db)):
    query = db.query(AnomalyRecord)

    if export_request.anomaly_ids:
        query = query.filter(AnomalyRecord.id.in_(export_request.anomaly_ids))
    if export_request.status:
        query = query.filter(AnomalyRecord.status.in_(export_request.status))
    if export_request.start_date:
        query = query.filter(AnomalyRecord.detected_at >= export_request.start_date)
    if export_request.end_date:
        query = query.filter(AnomalyRecord.detected_at <= export_request.end_date)

    anomalies = query.all()

    data = []
    for a in anomalies:
        data.append({
            "ID": a.id,
            "设备ID": a.device_id,
            "标题": a.title,
            "描述": a.description,
            "严重程度": a.severity,
            "状态": a.status,
            "当前值": a.current_value,
            "之前值": a.previous_value,
            "阈值": a.threshold_value,
            "检测时间": a.detected_at,
            "确认时间": a.confirmed_at,
            "恢复时间": a.recovered_at,
            "关闭时间": a.closed_at
        })

    df = pd.DataFrame(data)

    if export_request.format == "csv":
        output = BytesIO()
        df.to_csv(output, index=False, encoding="utf-8-sig")
        output.seek(0)
        content = output.getvalue()
        media_type = "text/csv"
        filename = "anomalies.csv"
    else:
        output = BytesIO()
        df.to_excel(output, index=False, engine="openpyxl")
        output.seek(0)
        content = output.getvalue()
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        filename = "anomalies.xlsx"

    from fastapi.responses import Response
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/{anomaly_id}/history")
async def get_anomaly_history(anomaly_id: int, db: Session = Depends(get_db)):
    anomaly = db.query(AnomalyRecord).filter(AnomalyRecord.id == anomaly_id).first()
    if not anomaly:
        raise HTTPException(status_code=404, detail="异常记录不存在")

    history_items = []

    for conf in anomaly.confirmations:
        history_items.append({
            "type": "status_change",
            "timestamp": conf.timestamp,
            "operator": conf.operator_name,
            "data": {
                "previous_status": conf.previous_status,
                "new_status": conf.new_status,
                "comment": conf.comment
            }
        })

    for reason in anomaly.ignore_reasons:
        history_items.append({
            "type": "ignore_reason",
            "timestamp": reason.timestamp,
            "operator": reason.operator_name,
            "data": {
                "category": reason.reason_category,
                "detail": reason.reason_detail
            }
        })

    for ticket in anomaly.tickets:
        history_items.append({
            "type": "ticket_link",
            "timestamp": ticket.linked_at,
            "operator": ticket.operator_name,
            "data": {
                "ticket_id": ticket.ticket_id,
                "ticket_url": ticket.ticket_url,
                "ticket_title": ticket.ticket_title
            }
        })

    for recovery in anomaly.recovery_events:
        history_items.append({
            "type": "recovery",
            "timestamp": recovery.detected_at,
            "operator": "system" if recovery.auto_closed else "manual",
            "data": {
                "recovered_value": recovery.recovered_value,
                "recovery_method": recovery.recovery_method,
                "recovery_details": recovery.recovery_details
            }
        })

    history_items.sort(key=lambda x: x["timestamp"], reverse=True)
    return history_items
