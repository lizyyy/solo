from typing import List, Dict
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models import LossLedger, LossItem, User
from app.schemas import RoleViewReport, DesensitizedExportItem
from app.models.enums import LedgerStatus, UserRole, RecordStatus


def get_role_view_report(db: Session, user: User) -> RoleViewReport:
    query = db.query(LossLedger).filter(LossLedger.is_latest == True)
    
    if user.role == UserRole.SORTER:
        query = query.filter(LossLedger.created_by == user.id)
    elif user.role == UserRole.SUPERVISOR:
        query = query.filter(LossLedger.status.in_([LedgerStatus.SUBMITTED, LedgerStatus.REJECTED]))
    elif user.role == UserRole.PROCUREMENT_MANAGER:
        query = query.filter(LossLedger.status.in_([
            LedgerStatus.SUBMITTED, 
            LedgerStatus.SECONDARY_CONFIRMED,
            LedgerStatus.AUDIT_ONLY
        ]))
    
    ledgers = query.all()
    
    pending_query = query.filter(LossLedger.status == LedgerStatus.SUBMITTED)
    pending_count = pending_query.count()
    
    total_loss_weight = sum(
        l.loss_weight for l in ledgers 
        if l.status in [LedgerStatus.SECONDARY_CONFIRMED, LedgerStatus.AUDIT_ONLY]
    )
    
    by_loss_type: Dict[str, float] = {}
    by_supplier: Dict[str, float] = {}
    
    for ledger in ledgers:
        if ledger.status in [LedgerStatus.SECONDARY_CONFIRMED, LedgerStatus.AUDIT_ONLY]:
            loss_type_key = ledger.loss_type.value
            by_loss_type[loss_type_key] = by_loss_type.get(loss_type_key, 0) + ledger.loss_weight
            
            by_supplier[ledger.supplier_name] = by_supplier.get(ledger.supplier_name, 0) + ledger.loss_weight
    
    return RoleViewReport(
        role=user.role,
        total_ledgers=len(ledgers),
        pending_review=pending_count,
        total_loss_weight=round(total_loss_weight, 2),
        by_loss_type={k: round(v, 2) for k, v in by_loss_type.items()},
        by_supplier={k: round(v, 2) for k, v in by_supplier.items()}
    )


def get_desensitized_export_data(db: Session, user: User) -> List[DesensitizedExportItem]:
    query = db.query(LossLedger).filter(
        LossLedger.is_latest == True,
        LossLedger.status.in_([LedgerStatus.SECONDARY_CONFIRMED, LedgerStatus.AUDIT_ONLY])
    )
    
    ledgers = query.all()
    export_items = []
    
    for ledger in ledgers:
        supplier_name = ledger.supplier_name
        if len(supplier_name) > 2:
            supplier_name = supplier_name[0] + "*" * (len(supplier_name) - 2) + supplier_name[-1]
        
        item = DesensitizedExportItem(
            ledger_no=ledger.ledger_no,
            supplier_name=supplier_name,
            batch_no=ledger.batch_no,
            product_name=ledger.product_name,
            total_weight=round(ledger.total_weight, 2),
            loss_weight=round(ledger.loss_weight, 2),
            loss_rate=round(ledger.loss_rate, 2),
            loss_type=ledger.loss_type.value,
            status=ledger.status.value,
            created_at=ledger.created_at
        )
        export_items.append(item)
    
    return export_items


def get_ledger_traceability(db: Session, ledger_id: int):
    ledger = db.query(LossLedger).filter(LossLedger.id == ledger_id).first()
    if not ledger:
        return None
    
    valid_items = db.query(LossItem).filter(
        LossItem.ledger_id == ledger_id,
        LossItem.record_status == RecordStatus.VALID
    ).all()
    
    invalid_items = db.query(LossItem).filter(
        LossItem.ledger_id == ledger_id,
        LossItem.record_status != RecordStatus.VALID
    ).all()
    
    return {
        "ledger": ledger,
        "valid_items_count": len(valid_items),
        "invalid_items_count": len(invalid_items),
        "valid_items": valid_items,
        "invalid_items": invalid_items
    }


def get_summary_statistics(db: Session):
    total_ledgers = db.query(LossLedger).filter(LossLedger.is_latest == True).count()
    
    by_status = db.query(
        LossLedger.status,
        func.count(LossLedger.id)
    ).filter(LossLedger.is_latest == True).group_by(LossLedger.status).all()
    
    confirmed_loss = db.query(
        func.sum(LossLedger.loss_weight)
    ).filter(
        LossLedger.is_latest == True,
        LossLedger.status.in_([LedgerStatus.SECONDARY_CONFIRMED, LedgerStatus.AUDIT_ONLY])
    ).scalar() or 0
    
    return {
        "total_ledgers": total_ledgers,
        "by_status": {s.value: c for s, c in by_status},
        "confirmed_total_loss": round(confirmed_loss, 2),
        "data_sources_breakdown": {
            "supplier_delivery": db.query(LossLedger).filter(LossLedger.is_latest == True).join(LossLedger.data_sources).filter_by(source_type="supplier_delivery").count(),
            "weighing_record": db.query(LossLedger).filter(LossLedger.is_latest == True).join(LossLedger.data_sources).filter_by(source_type="weighing_record").count(),
            "basket_return_photo": db.query(LossLedger).filter(LossLedger.is_latest == True).join(LossLedger.data_sources).filter_by(source_type="basket_return_photo").count(),
            "secondary_confirmation": db.query(LossLedger).filter(LossLedger.is_latest == True).join(LossLedger.data_sources).filter_by(source_type="secondary_confirmation").count(),
        }
    }
