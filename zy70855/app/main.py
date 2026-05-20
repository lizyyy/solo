from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List

from app.database import engine, get_db, Base
from app.models import IdempotentRequest, LostItem, AuditLog
from app.schemas import (
    LostItemSubmit,
    LostItemResponse,
    UpdateConclusionRequest,
    AuditLogResponse,
    TraceabilityResponse,
    BatchSubmitRequest,
    BatchSubmitResponse
)

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="公交失物招领匹配API服务",
    description="处理公交失物招领的匹配、幂等性控制、审计日志和数据追溯",
    version="1.0.0"
)


def perform_matching(item_data: dict) -> dict:
    matching_score = 0
    matched_items = []

    if item_data.get("bus_route"):
        matching_score += 30
    if item_data.get("bus_number"):
        matching_score += 20
    if len(item_data.get("description", "")) > 20:
        matching_score += 25

    if matching_score >= 50:
        status = "matched"
        matched_items = [{"type": "类似物品", "confidence": 0.85}]
    elif matching_score >= 30:
        status = "processing"
        matched_items = [{"type": "待进一步核实", "confidence": 0.5}]
    else:
        status = "pending"

    return {
        "status": status,
        "matching_score": matching_score,
        "matched_items": matched_items,
        "processed_at": datetime.now().isoformat()
    }


def json_serializable(data):
    if hasattr(data, 'isoformat'):
        return data.isoformat()
    elif isinstance(data, dict):
        return {k: json_serializable(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [json_serializable(i) for i in data]
    return data


@app.post("/api/lost-items/submit", response_model=LostItemResponse)
def submit_lost_item(item: LostItemSubmit, db: Session = Depends(get_db)):
    item_dict = item.model_dump()
    request_hash = IdempotentRequest.generate_hash(json_serializable(item_dict))

    existing_request = db.query(IdempotentRequest).filter(
        IdempotentRequest.request_hash == request_hash
    ).first()

    if existing_request:
        response_data = existing_request.response_data
        response_data["is_duplicate"] = True
        return LostItemResponse(**response_data)

    match_result = perform_matching(item_dict)

    db_item = LostItem(
        item_type=item.item_type,
        description=item.description,
        lost_location=item.lost_location,
        lost_time=item.lost_time,
        bus_route=item.bus_route,
        bus_number=item.bus_number,
        contact_name=item.contact_name,
        contact_phone=item.contact_phone,
        status=match_result["status"],
        match_result=match_result,
        created_by=item.submitted_by
    )
    db.add(db_item)
    db.flush()

    response_data = {
        "id": db_item.id,
        "item_type": db_item.item_type,
        "description": db_item.description,
        "lost_location": db_item.lost_location,
        "lost_time": db_item.lost_time,
        "bus_route": db_item.bus_route,
        "bus_number": db_item.bus_number,
        "contact_name": db_item.contact_name,
        "contact_phone": db_item.contact_phone,
        "status": db_item.status,
        "match_result": db_item.match_result,
        "final_report": db_item.final_report,
        "created_at": db_item.created_at,
        "updated_at": db_item.updated_at,
        "created_by": db_item.created_by,
        "is_duplicate": False
    }

    idempotent_request = IdempotentRequest(
        request_hash=request_hash,
        request_data=json_serializable(item_dict),
        response_data=json_serializable(response_data),
        submitted_by=item.submitted_by
    )
    db.add(idempotent_request)
    db_item.request_id = idempotent_request.id

    db.commit()
    db.refresh(db_item)

    return LostItemResponse(**response_data)


@app.post("/api/lost-items/batch-submit", response_model=BatchSubmitResponse)
def batch_submit_lost_items(request: BatchSubmitRequest, db: Session = Depends(get_db)):
    results = []
    success_count = 0
    duplicate_count = 0

    for item in request.items:
        item_dict = item.model_dump()
        item_dict["submitted_by"] = request.submitted_by
        request_hash = IdempotentRequest.generate_hash(json_serializable(item_dict))

        existing_request = db.query(IdempotentRequest).filter(
            IdempotentRequest.request_hash == request_hash
        ).first()

        if existing_request:
            response_data = existing_request.response_data
            response_data["is_duplicate"] = True
            results.append(LostItemResponse(**response_data))
            duplicate_count += 1
            continue

        match_result = perform_matching(item_dict)

        db_item = LostItem(
            item_type=item.item_type,
            description=item.description,
            lost_location=item.lost_location,
            lost_time=item.lost_time,
            bus_route=item.bus_route,
            bus_number=item.bus_number,
            contact_name=item.contact_name,
            contact_phone=item.contact_phone,
            status=match_result["status"],
            match_result=match_result,
            created_by=request.submitted_by
        )
        db.add(db_item)
        db.flush()

        response_data = {
            "id": db_item.id,
            "item_type": db_item.item_type,
            "description": db_item.description,
            "lost_location": db_item.lost_location,
            "lost_time": db_item.lost_time,
            "bus_route": db_item.bus_route,
            "bus_number": db_item.bus_number,
            "contact_name": db_item.contact_name,
            "contact_phone": db_item.contact_phone,
            "status": db_item.status,
            "match_result": db_item.match_result,
            "final_report": db_item.final_report,
            "created_at": db_item.created_at,
            "updated_at": db_item.updated_at,
            "created_by": db_item.created_by,
            "is_duplicate": False
        }

        idempotent_request = IdempotentRequest(
            request_hash=request_hash,
            request_data=json_serializable(item_dict),
            response_data=json_serializable(response_data),
            submitted_by=request.submitted_by
        )
        db.add(idempotent_request)
        db_item.request_id = idempotent_request.id

        results.append(LostItemResponse(**response_data))
        success_count += 1

    db.commit()

    return BatchSubmitResponse(
        success_count=success_count,
        duplicate_count=duplicate_count,
        results=results
    )


@app.get("/api/lost-items/{item_id}", response_model=LostItemResponse)
def get_lost_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(LostItem).filter(LostItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="失物记录不存在")
    return item


@app.get("/api/lost-items/", response_model=List[LostItemResponse])
def list_lost_items(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    items = db.query(LostItem).offset(skip).limit(limit).all()
    return items


@app.put("/api/lost-items/{item_id}/conclusion", response_model=LostItemResponse)
def update_conclusion(
    item_id: int,
    update_data: UpdateConclusionRequest,
    db: Session = Depends(get_db)
):
    item = db.query(LostItem).filter(LostItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="失物记录不存在")

    old_values = {}
    new_values = {}

    if update_data.status != item.status:
        old_values["status"] = item.status
        new_values["status"] = update_data.status
        item.status = update_data.status

    if update_data.match_result is not None and update_data.match_result != item.match_result:
        old_values["match_result"] = item.match_result
        new_values["match_result"] = update_data.match_result
        item.match_result = update_data.match_result

    if update_data.final_report is not None and update_data.final_report != item.final_report:
        old_values["final_report"] = item.final_report
        new_values["final_report"] = update_data.final_report
        item.final_report = update_data.final_report

    if old_values:
        for field, old_value in old_values.items():
            audit_log = AuditLog(
                lost_item_id=item_id,
                field_changed=field,
                old_value=old_value,
                new_value=new_values[field],
                change_reason=update_data.change_reason,
                changed_by=update_data.changed_by
            )
            db.add(audit_log)

    db.commit()
    db.refresh(item)
    return item


@app.get("/api/lost-items/{item_id}/audit-logs", response_model=List[AuditLogResponse])
def get_audit_logs(item_id: int, db: Session = Depends(get_db)):
    item = db.query(LostItem).filter(LostItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="失物记录不存在")
    
    logs = db.query(AuditLog).filter(AuditLog.lost_item_id == item_id).order_by(AuditLog.changed_at.desc()).all()
    return logs


@app.get("/api/lost-items/{item_id}/trace", response_model=TraceabilityResponse)
def get_traceability(item_id: int, db: Session = Depends(get_db)):
    item = db.query(LostItem).filter(LostItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="失物记录不存在")

    original_input = {}
    if item.request_id:
        idempotent_req = db.query(IdempotentRequest).filter(IdempotentRequest.id == item.request_id).first()
        if idempotent_req:
            original_input = idempotent_req.request_data

    processing_history = []
    if item.match_result:
        processing_history.append({
            "step": "初始匹配",
            "result": item.match_result,
            "timestamp": item.created_at.isoformat() if item.created_at else None
        })

    audit_logs = db.query(AuditLog).filter(AuditLog.lost_item_id == item_id).order_by(AuditLog.changed_at).all()
    for log in audit_logs:
        processing_history.append({
            "step": f"修改字段: {log.field_changed}",
            "old_value": log.old_value,
            "new_value": log.new_value,
            "reason": log.change_reason,
            "changed_by": log.changed_by,
            "timestamp": log.changed_at.isoformat() if log.changed_at else None
        })

    return TraceabilityResponse(
        lost_item_id=item_id,
        original_input=original_input,
        processing_history=processing_history,
        final_report=item.final_report,
        audit_trail=audit_logs
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
