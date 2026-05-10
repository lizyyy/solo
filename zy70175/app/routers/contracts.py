from typing import List
from datetime import datetime
from decimal import Decimal
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Contract, Invoice
from app.schemas import ContractCreate, ContractOut, InvoiceCreate, InvoiceOut

router = APIRouter(prefix="/contracts", tags=["合同/发票"])


@router.post("", response_model=ContractOut, status_code=201)
def create_contract(data: ContractCreate, db: Session = Depends(get_db)):
    contract = Contract(
        contract_no=data.contract_no,
        contract_name=data.contract_name,
        customer_name=data.customer_name,
        total_amount=data.total_amount,
        signed_at=data.signed_at,
    )
    db.add(contract)
    db.commit()
    db.refresh(contract)
    return contract


@router.get("", response_model=List[ContractOut])
def list_contracts(db: Session = Depends(get_db)):
    return db.query(Contract).order_by(Contract.created_at.desc()).all()


@router.get("/{contract_id}", response_model=ContractOut)
def get_contract(contract_id: int, db: Session = Depends(get_db)):
    from app.exceptions import NotFoundError
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise NotFoundError("合同", entity_id=contract_id)
    return contract


@router.post("/{contract_id}/invoices", response_model=InvoiceOut, status_code=201)
def create_invoice(contract_id: int, data: InvoiceCreate, db: Session = Depends(get_db)):
    from app.exceptions import NotFoundError, DuplicateSubmissionError
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise NotFoundError("合同", entity_id=contract_id)

    existing = db.query(Invoice).filter(Invoice.invoice_no == data.invoice_no).first()
    if existing:
        raise DuplicateSubmissionError("发票", data.invoice_no)

    invoice = Invoice(
        invoice_no=data.invoice_no,
        contract_id=contract_id,
        amount=data.amount,
        issued_at=data.issued_at,
    )
    db.add(invoice)
    db.commit()
    db.refresh(invoice)
    return invoice


@router.get("/{contract_id}/invoices", response_model=List[InvoiceOut])
def list_invoices(contract_id: int, db: Session = Depends(get_db)):
    return db.query(Invoice).filter(Invoice.contract_id == contract_id).order_by(Invoice.created_at.desc()).all()


@router.get("/invoices/{invoice_id}", response_model=InvoiceOut)
def get_invoice(invoice_id: int, db: Session = Depends(get_db)):
    from app.exceptions import NotFoundError
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise NotFoundError("发票", entity_id=invoice_id)
    return invoice
