import json
import hashlib
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.models.models import (
    Requisition,
    PurchaseArrival,
    TeacherSign,
    SupplierStatement,
    AbnormalReceipt,
    FailedRecord,
    DataSource,
    ReceiptStatus
)
from app.schemas.schemas import (
    RequisitionCreate,
    PurchaseArrivalCreate,
    TeacherSignCreate,
    SupplierStatementCreate,
    ImportResult
)


class IdempotentImportService:
    @staticmethod
    def generate_idempotent_key(source_type: DataSource, unique_field: str) -> str:
        key = f"{source_type.value}:{unique_field}"
        return hashlib.sha256(key.encode()).hexdigest()

    @staticmethod
    def _save_failed_record(
        db: Session,
        source_type: DataSource,
        raw_data: Dict[str, Any],
        error_message: str,
        error_type: str,
        batch_id: Optional[int] = None,
        idempotent_key: Optional[str] = None
    ) -> FailedRecord:
        failed = FailedRecord(
            source_type=source_type,
            batch_id=batch_id,
            raw_data=json.dumps(raw_data, ensure_ascii=False),
            error_message=error_message,
            error_type=error_type,
            idempotent_key=idempotent_key
        )
        db.add(failed)
        db.flush()
        return failed

    @classmethod
    def import_requisition(
        cls,
        db: Session,
        data: RequisitionCreate,
        batch_id: Optional[int] = None
    ) -> Tuple[Optional[Requisition], bool]:
        idempotent_key = data.idempotent_key or cls.generate_idempotent_key(
            DataSource.REQUISITION, data.requisition_no
        )

        existing = db.query(Requisition).filter(
            Requisition.idempotent_key == idempotent_key
        ).first()

        if existing:
            for field, value in data.model_dump(exclude_unset=True).items():
                if hasattr(existing, field) and field not in ["idempotent_key", "requisition_no"]:
                    setattr(existing, field, value)
            db.add(existing)
            db.flush()
            return existing, True

        try:
            requisition = Requisition(
                **data.model_dump(exclude={"idempotent_key"}),
                idempotent_key=idempotent_key,
                batch_id=batch_id or data.batch_id
            )
            db.add(requisition)
            db.flush()

            if data.is_abnormal and data.abnormal_type:
                cls._create_abnormal_receipt_from_source(
                    db=db,
                    source_type=DataSource.REQUISITION,
                    source_id=requisition.id,
                    source_no=requisition.requisition_no,
                    college=requisition.college,
                    abnormal_type=data.abnormal_type,
                    material_name=requisition.material_name,
                    material_code=requisition.material_code,
                    specification=requisition.specification,
                    quantity=requisition.quantity,
                    unit=requisition.unit,
                    unit_price=requisition.unit_price,
                    total_amount=requisition.total_amount,
                    lab_name=requisition.lab_name,
                    teacher_name=requisition.teacher_name,
                    abnormal_reason=requisition.abnormal_reason,
                    batch_id=batch_id or data.batch_id
                )

            return requisition, False

        except IntegrityError as e:
            db.rollback()
            cls._save_failed_record(
                db=db,
                source_type=DataSource.REQUISITION,
                raw_data=data.model_dump(),
                error_message=f"数据库完整性错误: {str(e)}",
                error_type="IntegrityError",
                batch_id=batch_id,
                idempotent_key=idempotent_key
            )
            return None, False

    @classmethod
    def import_purchase_arrival(
        cls,
        db: Session,
        data: PurchaseArrivalCreate,
        batch_id: Optional[int] = None
    ) -> Tuple[Optional[PurchaseArrival], bool]:
        idempotent_key = data.idempotent_key or cls.generate_idempotent_key(
            DataSource.PURCHASE_ARRIVAL, data.arrival_no
        )

        existing = db.query(PurchaseArrival).filter(
            PurchaseArrival.idempotent_key == idempotent_key
        ).first()

        if existing:
            for field, value in data.model_dump(exclude_unset=True).items():
                if hasattr(existing, field) and field not in ["idempotent_key", "arrival_no"]:
                    setattr(existing, field, value)
            db.add(existing)
            db.flush()
            return existing, True

        try:
            arrival = PurchaseArrival(
                **data.model_dump(exclude={"idempotent_key"}),
                idempotent_key=idempotent_key,
                batch_id=batch_id or data.batch_id
            )
            db.add(arrival)
            db.flush()

            if data.is_abnormal and data.abnormal_type:
                cls._create_abnormal_receipt_from_source(
                    db=db,
                    source_type=DataSource.PURCHASE_ARRIVAL,
                    source_id=arrival.id,
                    source_no=arrival.arrival_no,
                    college=arrival.college,
                    abnormal_type=data.abnormal_type,
                    material_name=arrival.material_name,
                    material_code=arrival.material_code,
                    specification=arrival.specification,
                    quantity=arrival.arrived_quantity,
                    unit=arrival.unit,
                    unit_price=arrival.unit_price,
                    total_amount=arrival.total_amount,
                    supplier_name=arrival.supplier_name,
                    abnormal_reason=arrival.abnormal_reason,
                    batch_id=batch_id or data.batch_id
                )

            return arrival, False

        except IntegrityError as e:
            db.rollback()
            cls._save_failed_record(
                db=db,
                source_type=DataSource.PURCHASE_ARRIVAL,
                raw_data=data.model_dump(),
                error_message=f"数据库完整性错误: {str(e)}",
                error_type="IntegrityError",
                batch_id=batch_id,
                idempotent_key=idempotent_key
            )
            return None, False

    @classmethod
    def import_teacher_sign(
        cls,
        db: Session,
        data: TeacherSignCreate,
        batch_id: Optional[int] = None
    ) -> Tuple[Optional[TeacherSign], bool]:
        idempotent_key = data.idempotent_key or cls.generate_idempotent_key(
            DataSource.TEACHER_SIGN, data.sign_no
        )

        existing = db.query(TeacherSign).filter(
            TeacherSign.idempotent_key == idempotent_key
        ).first()

        if existing:
            for field, value in data.model_dump(exclude_unset=True).items():
                if hasattr(existing, field) and field not in ["idempotent_key", "sign_no"]:
                    setattr(existing, field, value)
            db.add(existing)
            db.flush()
            return existing, True

        try:
            sign = TeacherSign(
                **data.model_dump(exclude={"idempotent_key"}),
                idempotent_key=idempotent_key,
                batch_id=batch_id or data.batch_id
            )
            db.add(sign)
            db.flush()

            if data.is_abnormal and data.abnormal_type:
                cls._create_abnormal_receipt_from_source(
                    db=db,
                    source_type=DataSource.TEACHER_SIGN,
                    source_id=sign.id,
                    source_no=sign.sign_no,
                    college=sign.college,
                    abnormal_type=data.abnormal_type,
                    material_name=sign.material_name,
                    material_code=sign.material_code,
                    specification=sign.specification,
                    quantity=sign.quantity,
                    unit=sign.unit,
                    teacher_name=sign.teacher_name,
                    lab_name=sign.lab_name,
                    abnormal_reason=sign.abnormal_reason,
                    batch_id=batch_id or data.batch_id
                )

            return sign, False

        except IntegrityError as e:
            db.rollback()
            cls._save_failed_record(
                db=db,
                source_type=DataSource.TEACHER_SIGN,
                raw_data=data.model_dump(),
                error_message=f"数据库完整性错误: {str(e)}",
                error_type="IntegrityError",
                batch_id=batch_id,
                idempotent_key=idempotent_key
            )
            return None, False

    @classmethod
    def _create_abnormal_receipt_from_source(
        cls,
        db: Session,
        source_type: DataSource,
        source_id: int,
        source_no: str,
        college: str,
        abnormal_type: Any,
        material_name: str,
        material_code: Optional[str],
        specification: Optional[str],
        quantity: float,
        unit: Optional[str],
        unit_price: Optional[float] = None,
        total_amount: Optional[float] = None,
        lab_name: Optional[str] = None,
        teacher_name: Optional[str] = None,
        supplier_name: Optional[str] = None,
        abnormal_reason: Optional[str] = None,
        batch_id: Optional[int] = None
    ) -> AbnormalReceipt:
        receipt_no = f"ABN-{source_type.value.upper()}-{datetime.now().strftime('%Y%m%d')}-{source_id:06d}"
        idempotent_key = cls.generate_idempotent_key(
            DataSource.MANUAL, f"{source_type.value}:{source_id}"
        )

        existing = db.query(AbnormalReceipt).filter(
            AbnormalReceipt.idempotent_key == idempotent_key
        ).first()

        if existing:
            return existing

        receipt = AbnormalReceipt(
            receipt_no=receipt_no,
            batch_id=batch_id,
            college=college,
            abnormal_type=abnormal_type,
            source_type=source_type,
            source_id=source_id,
            source_no=source_no,
            material_name=material_name,
            material_code=material_code,
            specification=specification,
            quantity=quantity,
            unit=unit,
            unit_price=unit_price,
            total_amount=total_amount,
            lab_name=lab_name,
            teacher_name=teacher_name,
            supplier_name=supplier_name,
            abnormal_reason=abnormal_reason,
            status=ReceiptStatus.DRAFT,
            idempotent_key=idempotent_key
        )
        db.add(receipt)
        db.flush()
        return receipt

    @classmethod
    def get_failed_records(
        cls,
        db: Session,
        source_type: Optional[DataSource] = None,
        batch_id: Optional[int] = None,
        resolved: Optional[bool] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[FailedRecord]:
        query = db.query(FailedRecord)

        if source_type:
            query = query.filter(FailedRecord.source_type == source_type)
        if batch_id:
            query = query.filter(FailedRecord.batch_id == batch_id)
        if resolved is not None:
            query = query.filter(FailedRecord.resolved == resolved)

        return query.order_by(FailedRecord.created_at.desc()).offset(skip).limit(limit).all()
