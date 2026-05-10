from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.schemas import (
    ContractCreate, ContractUpdate, ContractResponse,
    DepositAccountResponse, BalanceSnapshotResponse,
    ContractReportResponse
)
from app.services import ContractService, BusinessException

router = APIRouter(prefix="/contracts", tags=["合同管理"])


@router.post("", response_model=ContractResponse)
def create_contract(data: ContractCreate, db: Session = Depends(get_db)):
    try:
        return ContractService.create_contract(db, data)
    except BusinessException as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("", response_model=List[ContractResponse])
def list_contracts(db: Session = Depends(get_db)):
    return ContractService.list_contracts(db)


@router.get("/{contract_id}", response_model=ContractResponse)
def get_contract(contract_id: int, db: Session = Depends(get_db)):
    contract = ContractService.get_contract(db, contract_id)
    if not contract:
        raise HTTPException(status_code=404, detail="合同不存在")
    return contract


@router.put("/{contract_id}", response_model=ContractResponse)
def update_contract(
    contract_id: int, 
    data: ContractUpdate, 
    db: Session = Depends(get_db)
):
    try:
        return ContractService.update_contract(db, contract_id, data)
    except BusinessException as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{contract_id}/account", response_model=DepositAccountResponse)
def get_deposit_account(contract_id: int, db: Session = Depends(get_db)):
    contract = ContractService.get_contract(db, contract_id)
    if not contract:
        raise HTTPException(status_code=404, detail="合同不存在")
    if not contract.deposit_account:
        raise HTTPException(status_code=404, detail="保证金账户不存在")
    return contract.deposit_account


@router.get("/{contract_id}/snapshots", response_model=List[BalanceSnapshotResponse])
def get_snapshots(contract_id: int, db: Session = Depends(get_db)):
    contract = ContractService.get_contract(db, contract_id)
    if not contract:
        raise HTTPException(status_code=404, detail="合同不存在")
    return contract.snapshots


@router.get("/{contract_id}/report", response_model=ContractReportResponse)
def get_contract_report(contract_id: int, db: Session = Depends(get_db)):
    from app.services import ReportService
    try:
        return ReportService.get_contract_report(db, contract_id)
    except BusinessException as e:
        raise HTTPException(status_code=400, detail=str(e))
