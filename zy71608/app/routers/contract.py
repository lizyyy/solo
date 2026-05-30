from typing import List, Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_

from app.database import get_db
from app.models import Contract, RentPlan
from app.schemas.contract import (
    ContractCreate,
    ContractUpdate,
    ContractInfo,
    RentPlanCreate,
    RentPlanUpdate,
    RentPlanInfo,
)
from app.schemas.common import ResponseModel, PaginatedResponse
from app.services.audit_service import AuditService
from app.models import OperationType

router = APIRouter(prefix="/contracts", tags=["合同管理"])


@router.get("", response_model=PaginatedResponse[ContractInfo])
def get_contracts(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    keyword: Optional[str] = None,
    status: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
):
    query = db.query(Contract).filter(Contract.is_active == True)

    if keyword:
        query = query.filter(
            or_(
                Contract.contract_no.like(f"%{keyword}%"),
                Contract.tenant_name.like(f"%{keyword}%"),
                Contract.store_code.like(f"%{keyword}%"),
            )
        )
    if status:
        query = query.filter(Contract.status == status)
    if start_date:
        query = query.filter(Contract.start_date >= start_date)
    if end_date:
        query = query.filter(Contract.end_date <= end_date)

    total = query.count()
    contracts = query.order_by(Contract.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    total_pages = (total + page_size - 1) // page_size

    return PaginatedResponse(
        data=[ContractInfo.model_validate(c) for c in contracts],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/{contract_id}", response_model=ResponseModel[ContractInfo])
def get_contract(contract_id: int, db: Session = Depends(get_db)):
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail=f"合同 {contract_id} 不存在")
    return ResponseModel(data=ContractInfo.model_validate(contract))


@router.post("", response_model=ResponseModel[ContractInfo])
def create_contract(
    contract_data: ContractCreate,
    db: Session = Depends(get_db),
    operator: str = Query("system", description="操作人"),
):
    existing = db.query(Contract).filter(
        Contract.contract_no == contract_data.contract_no,
        Contract.is_active == True,
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail=f"合同编号 {contract_data.contract_no} 已存在")

    contract = Contract(**contract_data.model_dump(), created_by=operator, updated_by=operator)
    db.add(contract)
    db.flush()

    audit_service = AuditService(db)
    audit_service.log_operation(
        operation_type=OperationType.CREATE.value,
        operator=operator,
        table_name="contracts",
        record_id=contract.id,
        new_values=contract_data.model_dump(mode="json"),
        change_reason="创建合同",
    )

    db.commit()
    db.refresh(contract)

    return ResponseModel(data=ContractInfo.model_validate(contract), message="合同创建成功")


@router.put("/{contract_id}", response_model=ResponseModel[ContractInfo])
def update_contract(
    contract_id: int,
    update_data: ContractUpdate,
    db: Session = Depends(get_db),
    operator: str = Query("system", description="操作人"),
):
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail=f"合同 {contract_id} 不存在")

    old_values = {c.name: getattr(contract, c.name) for c in Contract.__table__.columns}

    update_dict = update_data.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(contract, field, value)

    contract.updated_by = operator

    audit_service = AuditService(db)
    audit_service.log_manual_override(
        application_id=0,
        old_values=old_values,
        new_values=update_dict,
        operator=operator,
        reason=f"更新合同 {contract.contract_no}",
    )

    db.commit()
    db.refresh(contract)

    return ResponseModel(data=ContractInfo.model_validate(contract), message="合同更新成功")


@router.delete("/{contract_id}", response_model=ResponseModel)
def delete_contract(
    contract_id: int,
    db: Session = Depends(get_db),
    operator: str = Query("system", description="操作人"),
):
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail=f"合同 {contract_id} 不存在")

    contract.is_active = False
    contract.updated_by = operator

    audit_service = AuditService(db)
    audit_service.log_operation(
        operation_type=OperationType.DELETE.value,
        operator=operator,
        table_name="contracts",
        record_id=contract_id,
        change_reason=f"删除合同 {contract.contract_no}",
    )

    db.commit()

    return ResponseModel(message="合同删除成功")


@router.get("/{contract_id}/rent-plans", response_model=ResponseModel[List[RentPlanInfo]])
def get_contract_rent_plans(contract_id: int, db: Session = Depends(get_db)):
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail=f"合同 {contract_id} 不存在")

    rent_plans = db.query(RentPlan).filter(RentPlan.contract_id == contract_id).order_by(RentPlan.period_start).all()

    return ResponseModel(data=[RentPlanInfo.model_validate(rp) for rp in rent_plans])


@router.post("/{contract_id}/rent-plans", response_model=ResponseModel[RentPlanInfo])
def create_rent_plan(
    contract_id: int,
    rent_plan_data: RentPlanCreate,
    db: Session = Depends(get_db),
    operator: str = Query("system", description="操作人"),
):
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail=f"合同 {contract_id} 不存在")

    rent_plan = RentPlan(**rent_plan_data.model_dump(), created_by=operator, updated_by=operator)
    db.add(rent_plan)
    db.flush()

    audit_service = AuditService(db)
    audit_service.log_operation(
        operation_type=OperationType.CREATE.value,
        operator=operator,
        table_name="rent_plans",
        record_id=rent_plan.id,
        new_values=rent_plan_data.model_dump(mode="json"),
        change_reason=f"创建合同 {contract.contract_no} 的租金计划",
    )

    db.commit()
    db.refresh(rent_plan)

    return ResponseModel(data=RentPlanInfo.model_validate(rent_plan), message="租金计划创建成功")


@router.put("/rent-plans/{plan_id}", response_model=ResponseModel[RentPlanInfo])
def update_rent_plan(
    plan_id: int,
    update_data: RentPlanUpdate,
    db: Session = Depends(get_db),
    operator: str = Query("system", description="操作人"),
):
    rent_plan = db.query(RentPlan).filter(RentPlan.id == plan_id).first()
    if not rent_plan:
        raise HTTPException(status_code=404, detail=f"租金计划 {plan_id} 不存在")

    old_values = {c.name: getattr(rent_plan, c.name) for c in RentPlan.__table__.columns}

    update_dict = update_data.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(rent_plan, field, value)

    rent_plan.updated_by = operator

    audit_service = AuditService(db)
    audit_service.log_operation(
        operation_type=OperationType.UPDATE.value,
        operator=operator,
        table_name="rent_plans",
        record_id=plan_id,
        old_values=old_values,
        new_values=update_dict,
        change_reason="更新租金计划",
    )

    db.commit()
    db.refresh(rent_plan)

    return ResponseModel(data=RentPlanInfo.model_validate(rent_plan), message="租金计划更新成功")
