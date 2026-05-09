from datetime import date
from decimal import Decimal
from typing import Optional, List

from sqlalchemy.orm import Session

from app.models.enums import ContractStatus, DeliveryStatus
from app.models.models import Contract, DeliveryPlan, PaymentNode, PenaltyRecord
from app.schemas.schemas import ContractCreate, ContractUpdate, ContractFulfillmentDetail


class ContractService:
    def __init__(self, db: Session):
        self.db = db

    def create_contract(self, data: ContractCreate) -> Contract:
        contract = Contract(
            contract_no=data.contract_no,
            contract_name=data.contract_name,
            supplier_name=data.supplier_name,
            total_amount=data.total_amount,
            sign_date=data.sign_date,
            effective_date=data.effective_date,
            expiry_date=data.expiry_date,
            late_delivery_rate=data.late_delivery_rate,
            quality_penalty_rate=data.quality_penalty_rate,
            status=ContractStatus.DRAFT,
            remarks=data.remarks,
        )
        self.db.add(contract)
        self.db.commit()
        self.db.refresh(contract)
        return contract

    def get_contract(self, contract_id: int) -> Optional[Contract]:
        return self.db.query(Contract).filter(Contract.id == contract_id).first()

    def get_contract_by_no(self, contract_no: str) -> Optional[Contract]:
        return self.db.query(Contract).filter(Contract.contract_no == contract_no).first()

    def list_contracts(self, status: Optional[ContractStatus] = None) -> List[Contract]:
        query = self.db.query(Contract)
        if status:
            query = query.filter(Contract.status == status)
        return query.order_by(Contract.created_at.desc()).all()

    def update_contract(self, contract_id: int, data: ContractUpdate) -> Optional[Contract]:
        contract = self.get_contract(contract_id)
        if not contract:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(contract, key, value)

        self.db.commit()
        self.db.refresh(contract)
        return contract

    def activate_contract(self, contract_id: int) -> Optional[Contract]:
        contract = self.get_contract(contract_id)
        if not contract or contract.status != ContractStatus.DRAFT:
            return None
        contract.status = ContractStatus.ACTIVE
        self.db.commit()
        self.db.refresh(contract)
        return contract

    def recalculate_contract_status(self, contract_id: int) -> Contract:
        contract = self.get_contract(contract_id)
        if not contract:
            raise ValueError(f"Contract {contract_id} not found")

        if contract.status in [ContractStatus.CLOSED, ContractStatus.CANCELLED]:
            return contract

        delivery_plans = contract.delivery_plans
        if not delivery_plans:
            return contract

        completed_count = sum(
            1 for dp in delivery_plans
            if dp.status in [DeliveryStatus.ACCEPTED, DeliveryStatus.PARTIAL_ACCEPTED]
        )

        if completed_count == 0:
            contract.status = ContractStatus.ACTIVE
        elif completed_count < len(delivery_plans):
            contract.status = ContractStatus.PARTIAL_FULFILLED
        else:
            contract.status = ContractStatus.FULLY_FULFILLED

        self.db.commit()
        self.db.refresh(contract)
        return contract

    def get_fulfillment_detail(self, contract_id: int) -> Optional[ContractFulfillmentDetail]:
        contract = self.get_contract(contract_id)
        if not contract:
            return None

        total_penalty = sum(p.penalty_amount for p in contract.penalties)
        unsettled_penalty = sum(p.penalty_amount for p in contract.penalties if not p.is_settled)

        plan_amount = sum(dp.plan_amount for dp in contract.delivery_plans)
        actual_amount = sum(dp.actual_amount or Decimal("0") for dp in contract.delivery_plans)
        delivery_progress = (actual_amount / plan_amount * 100) if plan_amount > Decimal("0") else Decimal("0")

        plan_payment = sum(pn.plan_amount for pn in contract.payment_nodes)
        actual_payment = sum(pn.actual_amount or Decimal("0") for pn in contract.payment_nodes)
        payment_progress = (actual_payment / plan_payment * 100) if plan_payment > Decimal("0") else Decimal("0")

        return ContractFulfillmentDetail(
            contract=contract,
            delivery_plans=contract.delivery_plans,
            payment_nodes=contract.payment_nodes,
            penalties=contract.penalties,
            warnings=contract.warnings,
            total_penalty_amount=total_penalty,
            unsettled_penalty_amount=unsettled_penalty,
            delivery_progress=delivery_progress.quantize(Decimal("0.01")),
            payment_progress=payment_progress.quantize(Decimal("0.01")),
        )

    def close_contract(self, contract_id: int) -> Optional[Contract]:
        contract = self.get_contract(contract_id)
        if not contract:
            return None
        contract.status = ContractStatus.CLOSED
        self.db.commit()
        self.db.refresh(contract)
        return contract

    def cancel_contract(self, contract_id: int) -> Optional[Contract]:
        contract = self.get_contract(contract_id)
        if not contract:
            return None
        contract.status = ContractStatus.CANCELLED
        self.db.commit()
        self.db.refresh(contract)
        return contract
