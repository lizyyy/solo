from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.enums import ContractStatus
from app.schemas.schemas import (
    ContractCreate,
    ContractResponse,
    ContractUpdate,
    ContractFulfillmentDetail,
)
from app.services.contract_service import ContractService

router = APIRouter(prefix="/contracts", tags=["contracts"])


@router.post("", response_model=ContractResponse, status_code=status.HTTP_201_CREATED)
def create_contract(data: ContractCreate, db: Session = Depends(get_db)):
    service = ContractService(db)
    existing = service.get_contract_by_no(data.contract_no)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"合同编号 {data.contract_no} 已存在",
        )
    return service.create_contract(data)


@router.get("", response_model=List[ContractResponse])
def list_contracts(
    status_filter: Optional[ContractStatus] = None,
    db: Session = Depends(get_db),
):
    service = ContractService(db)
    return service.list_contracts(status_filter)


@router.get("/{contract_id}", response_model=ContractResponse)
def get_contract(contract_id: int, db: Session = Depends(get_db)):
    service = ContractService(db)
    contract = service.get_contract(contract_id)
    if not contract:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"合同 {contract_id} 不存在",
        )
    return contract


@router.put("/{contract_id}", response_model=ContractResponse)
def update_contract(
    contract_id: int,
    data: ContractUpdate,
    db: Session = Depends(get_db),
):
    service = ContractService(db)
    contract = service.update_contract(contract_id, data)
    if not contract:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"合同 {contract_id} 不存在",
        )
    return contract


@router.post("/{contract_id}/activate", response_model=ContractResponse)
def activate_contract(contract_id: int, db: Session = Depends(get_db)):
    service = ContractService(db)
    contract = service.activate_contract(contract_id)
    if not contract:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"合同 {contract_id} 无法激活",
        )
    return contract


@router.post("/{contract_id}/recalculate-status", response_model=ContractResponse)
def recalculate_contract_status(contract_id: int, db: Session = Depends(get_db)):
    service = ContractService(db)
    try:
        return service.recalculate_contract_status(contract_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.get("/{contract_id}/fulfillment", response_model=ContractFulfillmentDetail)
def get_fulfillment_detail(contract_id: int, db: Session = Depends(get_db)):
    service = ContractService(db)
    detail = service.get_fulfillment_detail(contract_id)
    if not detail:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"合同 {contract_id} 不存在",
        )
    return detail


@router.post("/{contract_id}/close", response_model=ContractResponse)
def close_contract(contract_id: int, db: Session = Depends(get_db)):
    service = ContractService(db)
    contract = service.close_contract(contract_id)
    if not contract:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"合同 {contract_id} 不存在",
        )
    return contract


@router.post("/{contract_id}/cancel", response_model=ContractResponse)
def cancel_contract(contract_id: int, db: Session = Depends(get_db)):
    service = ContractService(db)
    contract = service.cancel_contract(contract_id)
    if not contract:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"合同 {contract_id} 不存在",
        )
    return contract
