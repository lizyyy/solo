from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from datetime import datetime, timedelta
from typing import List, Optional
import json

from models import (
    Drug, InventoryBatch, Contraindication, Prescription,
    PrescriptionItem, ValidationResult, AuditLog, DispenseRecord,
    IdempotencyKey, PrescriptionStatusEnum, RoleEnum
)
from schemas import (
    DrugCreate, InventoryBatchCreate, ContraindicationCreate,
    PrescriptionCreate, PrescriptionReviewRequest, DispenseRequest,
    PrescriptionQueryParams, AuditLogQueryParams
)
from rules import ValidationEngine


def check_idempotency(db: Session, key: str, request_type: str) -> Optional[dict]:
    idempotent = db.query(IdempotencyKey).filter(
        and_(IdempotencyKey.key == key, IdempotencyKey.request_type == request_type)
    ).first()
    if idempotent:
        if idempotent.expires_at > datetime.now():
            return json.loads(idempotent.response_data)
    return None


def save_idempotency_response(db: Session, key: str, request_type: str, response_data: dict, hours: int = 24):
    idempotent = IdempotencyKey(
        key=key,
        request_type=request_type,
        response_data=json.dumps(response_data),
        expires_at=datetime.now() + timedelta(hours=hours)
    )
    db.add(idempotent)
    db.commit()


def create_drug(db: Session, drug: DrugCreate) -> Drug:
    db_drug = Drug(**drug.model_dump())
    db.add(db_drug)
    db.commit()
    db.refresh(db_drug)
    return db_drug


def get_drug(db: Session, drug_id: int) -> Optional[Drug]:
    return db.query(Drug).filter(Drug.id == drug_id).first()


def get_drugs(db: Session, skip: int = 0, limit: int = 100) -> List[Drug]:
    return db.query(Drug).filter(Drug.is_active == True).offset(skip).limit(limit).all()


def create_inventory_batch(db: Session, batch: InventoryBatchCreate) -> InventoryBatch:
    db_batch = InventoryBatch(**batch.model_dump())
    db.add(db_batch)
    db.commit()
    db.refresh(db_batch)
    return db_batch


def get_inventory_batches(db: Session, drug_id: Optional[int] = None) -> List[InventoryBatch]:
    query = db.query(InventoryBatch)
    if drug_id:
        query = query.filter(InventoryBatch.drug_id == drug_id)
    return query.all()


def create_contraindication(db: Session, contraindication: ContraindicationCreate) -> Contraindication:
    db_contra = Contraindication(**contraindication.model_dump())
    db.add(db_contra)
    db.commit()
    db.refresh(db_contra)
    return db_contra


def create_prescription(db: Session, prescription: PrescriptionCreate) -> dict:
    existing = db.query(Prescription).filter(Prescription.prescription_no == prescription.prescription_no).first()
    if existing:
        return get_prescription_with_validations(db, existing.id)

    db_prescription = Prescription(
        prescription_no=prescription.prescription_no,
        patient_name=prescription.patient_name,
        species=prescription.species,
        weight=prescription.weight,
        weight_unit=prescription.weight_unit,
        age=prescription.age,
        doctor=prescription.doctor,
        created_by=prescription.created_by,
        notes=prescription.notes
    )
    db.add(db_prescription)
    db.commit()
    db.refresh(db_prescription)

    for item in prescription.items:
        db_item = PrescriptionItem(
            prescription_id=db_prescription.id,
            **item.model_dump()
        )
        db.add(db_item)
    db.commit()
    db.refresh(db_prescription)

    engine = ValidationEngine(db)
    validation_summary = engine.validate_prescription(db_prescription, db_prescription.items)

    for result in engine.get_validation_results():
        db_validation = ValidationResult(**result.model_dump())
        db.add(db_validation)
    db.commit()

    if validation_summary.blocked_count > 0:
        db_prescription.status = PrescriptionStatusEnum.BLOCKED
    else:
        db_prescription.status = PrescriptionStatusEnum.PENDING_REVIEW
    db.commit()
    db.refresh(db_prescription)

    create_audit_log(db, AuditLog(
        prescription_id=db_prescription.id,
        action="submit",
        previous_status=None,
        new_status=db_prescription.status,
        operator=prescription.created_by,
        operator_role=RoleEnum.DOCTOR,
        reason="处方提交，自动校验完成"
    ))

    validations = db.query(ValidationResult).filter(
        ValidationResult.prescription_item_id.in_([item.id for item in db_prescription.items])
    ).all()

    return {
        "prescription": db_prescription,
        "validation_summary": validation_summary,
        "validation_results": validations
    }


def get_prescription_with_validations(db: Session, prescription_id: int) -> dict:
    prescription = db.query(Prescription).filter(Prescription.id == prescription_id).first()
    if not prescription:
        return None

    validations = db.query(ValidationResult).filter(
        ValidationResult.prescription_item_id.in_([item.id for item in prescription.items])
    ).all()

    blocked_count = sum(1 for v in validations if v.is_blocking)
    warning_count = sum(1 for v in validations if not v.is_blocking)

    validation_summary = {
        "total_items": len(prescription.items),
        "passed_count": len(prescription.items) - (1 if blocked_count > 0 else 0),
        "warning_count": warning_count,
        "blocked_count": blocked_count,
        "blocking_exceptions": [v.message for v in validations if v.is_blocking],
        "warning_exceptions": [v.message for v in validations if not v.is_blocking]
    }

    return {
        "prescription": prescription,
        "validation_summary": validation_summary,
        "validation_results": validations
    }


def review_prescription(db: Session, request: PrescriptionReviewRequest) -> dict:
    prescription = db.query(Prescription).filter(Prescription.id == request.prescription_id).first()
    if not prescription:
        return None

    previous_status = prescription.status

    if request.approved:
        prescription.status = PrescriptionStatusEnum.APPROVED
    else:
        prescription.status = PrescriptionStatusEnum.REJECTED

    prescription.updated_by = request.reviewer
    db.commit()
    db.refresh(prescription)

    create_audit_log(db, AuditLog(
        prescription_id=prescription.id,
        action="review",
        previous_status=previous_status,
        new_status=prescription.status,
        operator=request.reviewer,
        operator_role=request.reviewer_role,
        reason=request.reason
    ))

    return get_prescription_with_validations(db, prescription.id)


def dispense_prescription(db: Session, request: DispenseRequest) -> dict:
    prescription = db.query(Prescription).filter(Prescription.id == request.prescription_id).first()
    if not prescription:
        return None

    if prescription.status != PrescriptionStatusEnum.APPROVED:
        raise ValueError("只有已审核通过的处方才能发药")

    for item in request.items:
        batch = db.query(InventoryBatch).filter(InventoryBatch.id == item.batch_id).first()
        if not batch:
            raise ValueError(f"批号不存在: {item.batch_id}")
        if batch.quantity < item.quantity_dispensed:
            raise ValueError(f"库存不足: {batch.quantity} < {item.quantity_dispensed}")

        batch.quantity -= item.quantity_dispensed

        dispense_record = DispenseRecord(
            prescription_id=request.prescription_id,
            prescription_item_id=item.prescription_item_id,
            batch_id=item.batch_id,
            quantity_dispensed=item.quantity_dispensed,
            unit=item.unit,
            dispensed_by=request.dispensed_by,
            notes=request.notes
        )
        db.add(dispense_record)

    previous_status = prescription.status
    prescription.status = PrescriptionStatusEnum.DISPENSED
    prescription.updated_by = request.dispensed_by
    db.commit()
    db.refresh(prescription)

    create_audit_log(db, AuditLog(
        prescription_id=prescription.id,
        action="dispense",
        previous_status=previous_status,
        new_status=prescription.status,
        operator=request.dispensed_by,
        operator_role=RoleEnum.PHARMACIST,
        reason=request.notes
    ))

    return get_prescription_with_validations(db, prescription.id)


def create_audit_log(db: Session, audit_log: AuditLog):
    db.add(audit_log)
    db.commit()


def query_prescriptions(db: Session, params: PrescriptionQueryParams) -> List[Prescription]:
    query = db.query(Prescription)

    if params.doctor:
        query = query.filter(Prescription.doctor == params.doctor)
    if params.status:
        query = query.filter(Prescription.status == params.status)
    if params.start_date:
        query = query.filter(Prescription.created_at >= params.start_date)
    if params.end_date:
        query = query.filter(Prescription.created_at <= params.end_date)
    if params.operator:
        query = query.join(AuditLog).filter(AuditLog.operator == params.operator)
    if params.exception_type:
        query = query.join(PrescriptionItem).join(ValidationResult).filter(
            ValidationResult.exception_type == params.exception_type
        )

    return query.order_by(Prescription.created_at.desc()).all()


def get_audit_logs(db: Session, params: AuditLogQueryParams) -> List[AuditLog]:
    query = db.query(AuditLog)

    if params.prescription_id:
        query = query.filter(AuditLog.prescription_id == params.prescription_id)
    if params.operator:
        query = query.filter(AuditLog.operator == params.operator)
    if params.action:
        query = query.filter(AuditLog.action == params.action)
    if params.start_date:
        query = query.filter(AuditLog.created_at >= params.start_date)
    if params.end_date:
        query = query.filter(AuditLog.created_at <= params.end_date)

    return query.order_by(AuditLog.created_at.desc()).all()


def get_prescription_trace(db: Session, prescription_id: int) -> dict:
    prescription = db.query(Prescription).filter(Prescription.id == prescription_id).first()
    if not prescription:
        return None

    audit_logs = db.query(AuditLog).filter(AuditLog.prescription_id == prescription_id).order_by(AuditLog.created_at).all()
    dispense_records = db.query(DispenseRecord).filter(DispenseRecord.prescription_id == prescription_id).all()
    validations = db.query(ValidationResult).filter(
        ValidationResult.prescription_item_id.in_([item.id for item in prescription.items])
    ).all()

    return {
        "prescription": prescription,
        "audit_logs": audit_logs,
        "dispense_records": dispense_records,
        "validations": validations
    }
