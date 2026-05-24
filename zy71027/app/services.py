from sqlalchemy.orm import Session
from sqlalchemy import and_
from datetime import datetime
from typing import List, Optional, Tuple
from . import models, schemas
from .models import HandoverStatus, PrescriptionStatus, DiscrepancyType
import uuid

def generate_no(prefix: str) -> str:
    return f"{prefix}{datetime.now().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:4].upper()}"

def log_operation(db: Session, handover_id: Optional[int], operation: str, 
                  operator: Optional[str] = None, remark: Optional[str] = None,
                  previous_status: Optional[str] = None, new_status: Optional[str] = None):
    log = models.OperationLog(
        handover_id=handover_id,
        operation=operation,
        operator=operator,
        remark=remark,
        previous_status=previous_status,
        new_status=new_status
    )
    db.add(log)
    db.commit()

def check_consistency(db: Session, item: schemas.HandoverItemCreate) -> Tuple[bool, List[str], dict]:
    issues = []
    prescription_qty = 0
    inventory_qty = 0
    
    if item.prescription_no:
        prescription = db.query(models.Prescription).filter(
            models.Prescription.prescription_no == item.prescription_no
        ).first()
        if prescription:
            prescription_qty = prescription.quantity
            if prescription.status != PrescriptionStatus.VERIFIED:
                issues.append(f"处方[{item.prescription_no}]未核验")
        else:
            issues.append(f"处方[{item.prescription_no}]不存在")
    
    batch = db.query(models.DrugBatch).filter(
        models.DrugBatch.batch_no == item.batch_no
    ).first()
    if batch:
        inventory_qty = batch.current_quantity
        if inventory_qty < item.handover_quantity:
            issues.append(f"库存不足: 库存{inventory_qty}{item.unit}, 交接{item.handover_quantity}{item.unit}")
    else:
        issues.append(f"批号[{item.batch_no}]不存在")
    
    if item.prescription_quantity != item.inventory_quantity:
        issues.append(f"处方数量({item.prescription_quantity})与库存数量({item.inventory_quantity})不一致")
    
    if abs(item.prescription_quantity - item.handover_quantity) > 0.001:
        issues.append(f"交接数量({item.handover_quantity})与处方数量({item.prescription_quantity})不一致")
    
    is_consistent = len(issues) == 0
    
    return is_consistent, issues, {
        "prescription_qty": prescription_qty,
        "inventory_qty": inventory_qty,
        "handover_qty": item.handover_quantity
    }

def create_discrepancy_report(db: Session, handover_id: int, item: schemas.HandoverItemCreate,
                              discrepancy_type: DiscrepancyType, description: str, qty_info: dict):
    report = models.DiscrepancyReport(
        report_no=generate_no("DIS"),
        handover_id=handover_id,
        discrepancy_type=discrepancy_type.value,
        description=description,
        prescription_quantity=qty_info.get("prescription_qty"),
        inventory_quantity=qty_info.get("inventory_qty"),
        handover_quantity=qty_info.get("handover_qty"),
        difference=abs((qty_info.get("prescription_qty") or 0) - (qty_info.get("handover_qty") or 0))
    )
    db.add(report)
    db.commit()
    return report

def validate_status_transition(current_status: str, target_status: str) -> bool:
    valid_transitions = {
        HandoverStatus.DRAFT: [HandoverStatus.SUBMITTED, HandoverStatus.CONFLICT, HandoverStatus.WITHDRAWN, HandoverStatus.MANUAL_FIXED],
        HandoverStatus.SUBMITTED: [HandoverStatus.FIRST_SIGNED, HandoverStatus.REJECTED, HandoverStatus.WITHDRAWN],
        HandoverStatus.FIRST_SIGNED: [HandoverStatus.SECOND_SIGNED, HandoverStatus.REJECTED, HandoverStatus.WITHDRAWN],
        HandoverStatus.SECOND_SIGNED: [HandoverStatus.VERIFIED, HandoverStatus.CONFLICT, HandoverStatus.REJECTED, HandoverStatus.WITHDRAWN],
        HandoverStatus.VERIFIED: [HandoverStatus.COMPLETED, HandoverStatus.MANUAL_FIXED],
        HandoverStatus.CONFLICT: [HandoverStatus.FIRST_SIGNED, HandoverStatus.MANUAL_FIXED, HandoverStatus.REJECTED, HandoverStatus.WITHDRAWN],
        HandoverStatus.REJECTED: [HandoverStatus.SUBMITTED],
        HandoverStatus.WITHDRAWN: [HandoverStatus.SUBMITTED],
        HandoverStatus.MANUAL_FIXED: [HandoverStatus.VERIFIED, HandoverStatus.COMPLETED],
        HandoverStatus.COMPLETED: []
    }
    return target_status in valid_transitions.get(current_status, [])

def transition_status(db: Session, handover: models.HandoverRecord, target_status: str, 
                      operator: Optional[str] = None, remark: Optional[str] = None) -> bool:
    if not validate_status_transition(handover.status, target_status):
        return False
    
    previous_status = handover.status
    handover.status = target_status
    db.commit()
    db.refresh(handover)
    
    log_operation(db, handover.id, f"状态变更:{previous_status}→{target_status}", 
                  operator, remark, previous_status, target_status)
    return True

def deduct_inventory(db: Session, batch_id: int, quantity: float, operator: str, handover_no: str):
    batch = db.query(models.DrugBatch).filter(models.DrugBatch.id == batch_id).first()
    if not batch:
        return False
    
    if batch.current_quantity < quantity:
        return False
    
    batch.current_quantity -= quantity
    
    record = models.InventoryRecord(
        record_no=generate_no("INV"),
        batch_id=batch_id,
        change_type="交接出库",
        change_quantity=-quantity,
        balance_quantity=batch.current_quantity,
        operator=operator,
        remark=f"交接单:{handover_no}"
    )
    db.add(record)
    db.commit()
    return True

def verify_prescription(db: Session, prescription_id: int, verified_by: str) -> bool:
    prescription = db.query(models.Prescription).filter(models.Prescription.id == prescription_id).first()
    if not prescription:
        return False
    
    prescription.status = PrescriptionStatus.VERIFIED
    prescription.verified_by = verified_by
    prescription.verified_at = datetime.now()
    db.commit()
    return True

def check_sign_time_abnormal(handover_time: Optional[datetime], sign_time: datetime) -> bool:
    if not handover_time:
        return False
    
    time_diff = abs((sign_time - handover_time).total_seconds())
    if time_diff > 3600:
        return True
    
    sign_hour = sign_time.hour
    if sign_hour < 6 or sign_hour > 22:
        return False
    
    return False
