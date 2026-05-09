from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.escalations import (
    Escalation,
    EscalationCreate,
    EscalationUpdate,
    EscalationQuery,
)
from app.schemas.base import ResponseModel, PaginatedResponse
from app.services.escalation_service import EscalationService

router = APIRouter(prefix="/escalations", tags=["escalations"])


@router.get("", response_model=PaginatedResponse[Escalation])
def list_escalations(
    dispatch_id: int = Query(None),
    level: int = Query(None),
    resolved: int = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
):
    service = EscalationService(db)
    query_params = EscalationQuery(
        dispatch_id=dispatch_id,
        level=level,
        resolved=resolved,
        page=page,
        page_size=page_size,
    )
    escalations, total = service.list(query_params)
    return PaginatedResponse(
        data=[Escalation.model_validate(e) for e in escalations],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{escalation_id}", response_model=ResponseModel[Escalation])
def get_escalation(escalation_id: int, db: Session = Depends(get_db)):
    service = EscalationService(db)
    escalation = service.get_by_id(escalation_id)
    if not escalation:
        raise HTTPException(status_code=404, detail="升级记录不存在")
    return ResponseModel(data=Escalation.model_validate(escalation))


@router.post("", response_model=ResponseModel[Escalation])
def create_escalation(data: EscalationCreate, db: Session = Depends(get_db)):
    service = EscalationService(db)
    escalation = service.create(data)
    return ResponseModel(data=Escalation.model_validate(escalation), message="升级记录创建成功")


@router.put("/{escalation_id}", response_model=ResponseModel[Escalation])
def update_escalation(escalation_id: int, data: EscalationUpdate, db: Session = Depends(get_db)):
    service = EscalationService(db)
    escalation = service.update(escalation_id, data)
    if not escalation:
        raise HTTPException(status_code=404, detail="升级记录不存在")
    return ResponseModel(data=Escalation.model_validate(escalation), message="升级记录更新成功")


@router.delete("/{escalation_id}", response_model=ResponseModel)
def delete_escalation(escalation_id: int, db: Session = Depends(get_db)):
    service = EscalationService(db)
    if not service.delete(escalation_id):
        raise HTTPException(status_code=404, detail="升级记录不存在")
    return ResponseModel(message="升级记录删除成功")


@router.post("/process-overdue", response_model=ResponseModel[int])
def process_overdue(db: Session = Depends(get_db)):
    service = EscalationService(db)
    escalations = service.process_overdue_dispatches()
    return ResponseModel(data=len(escalations), message=f"处理完成，新增{len(escalations)}条升级记录")
