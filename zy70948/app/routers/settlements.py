from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional

from app.core.database import get_db
from app import schemas
from app.services import (
    create_settlement, list_settlements, get_settlement,
    confirm_settlement, trace_settlement,
)

router = APIRouter(prefix="/settlements", tags=["结算清单"])


@router.post("", response_model=schemas.SettlementResp, summary="创建结算清单")
def api_create(data: schemas.SettlementCreate, db: Session = Depends(get_db)):
    s = create_settlement(db, data)
    return s


@router.get("", response_model=schemas.SettlementListResp, summary="查询结算清单")
def api_list(
    batch_id: Optional[int] = None,
    contract_id: Optional[str] = None,
    unit_name: Optional[str] = None,
    skip: int = 0, limit: int = 100,
    db: Session = Depends(get_db),
):
    total, items = list_settlements(
        db, batch_id=batch_id, contract_id=contract_id,
        unit_name=unit_name, skip=skip, limit=limit,
    )
    return {"total": total, "items": items}


@router.get("/{settlement_id}", response_model=schemas.SettlementResp, summary="结算清单详情")
def api_get(settlement_id: int, db: Session = Depends(get_db)):
    s = get_settlement(db, settlement_id)
    if not s:
        raise HTTPException(404, "结算清单不存在")
    return s


@router.post("/{settlement_id}/confirm", response_model=schemas.SettlementResp, summary="确认结算")
def api_confirm(settlement_id: int, data: schemas.SettlementConfirm,
                db: Session = Depends(get_db)):
    s = confirm_settlement(db, settlement_id, data)
    if not s:
        raise HTTPException(404, "结算清单不存在")
    return s


@router.get("/{settlement_id}/trace", response_model=schemas.SettlementTraceResp, summary="来源追溯")
def api_trace(settlement_id: int, db: Session = Depends(get_db)):
    result = trace_settlement(db, settlement_id)
    if not result:
        raise HTTPException(404, "结算清单不存在")
    return result
