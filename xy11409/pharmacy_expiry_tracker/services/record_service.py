from typing import Optional, List, Tuple
from sqlalchemy.orm import Session
from datetime import datetime
import json

from pharmacy_expiry_tracker.models.orm import ExpiryRecord, ChangeLog
from pharmacy_expiry_tracker.models.enums import (
    RecordStatus,
    ChangeType,
    UserRole,
    LiabilityResult
)
from pharmacy_expiry_tracker.schemas.record import ExpiryRecordCreate, ExpiryRecordUpdate
from pharmacy_expiry_tracker.utils.helpers import (
    generate_record_no,
    get_days_near_expiry,
    get_expiry_category,
    serialize_for_audit
)
from pharmacy_expiry_tracker.utils.exceptions import (
    NotFoundException,
    InvalidStateException,
    PermissionDeniedException
)


class RecordService:
    def __init__(self, db: Session):
        self.db = db

    def create_record(
        self,
        data: ExpiryRecordCreate,
        user_role: str
    ) -> ExpiryRecord:
        role = UserRole(user_role)
        if role not in [UserRole.PHARMACY_MANAGER, UserRole.TOWN_SUPERVISOR, UserRole.ADMIN]:
            raise PermissionDeniedException(f"角色 {user_role} 无创建权限")

        days_near = get_days_near_expiry(data.expiry_date)

        record = ExpiryRecord(
            record_no=generate_record_no(),
            pharmacy_code=data.pharmacy_code,
            pharmacy_name=data.pharmacy_name,
            region=data.region,
            town=data.town,
            drug_code=data.drug_code,
            drug_name=data.drug_name,
            drug_spec=data.drug_spec,
            batch_no=data.batch_no,
            expiry_date=datetime.combine(data.expiry_date, datetime.min.time()),
            quantity=data.quantity,
            unit=data.unit,
            days_near_expiry=days_near,
            expiry_category=get_expiry_category(days_near),
            liability_result=data.liability_result.value,
            liability_amount=data.liability_amount,
            status=RecordStatus.DRAFT.value,
            created_by=data.created_by,
            remarks=data.remarks
        )

        self.db.add(record)
        self.db.flush()

        change_log = ChangeLog(
            expiry_record_id=record.id,
            change_type=ChangeType.CREATE.value,
            old_status=None,
            new_status=RecordStatus.DRAFT.value,
            new_values=json.dumps({
                "pharmacy_code": record.pharmacy_code,
                "drug_code": record.drug_code,
                "batch_no": record.batch_no
            }, ensure_ascii=False),
            change_reason="手动创建记录",
            changed_by=data.created_by,
            user_role=user_role
        )
        self.db.add(change_log)

        self.db.commit()
        self.db.refresh(record)
        return record

    def update_record(
        self,
        record_id: int,
        data: ExpiryRecordUpdate,
        user_role: str
    ) -> ExpiryRecord:
        record = self.db.query(ExpiryRecord).filter(ExpiryRecord.id == record_id).first()
        if not record:
            raise NotFoundException(f"记录 {record_id} 不存在")

        role = UserRole(user_role)
        if role not in [UserRole.PHARMACY_MANAGER, UserRole.TOWN_SUPERVISOR, UserRole.ADMIN]:
            raise PermissionDeniedException(f"角色 {user_role} 无编辑权限")

        if record.is_frozen:
            raise InvalidStateException("冻结状态的记录无法编辑")

        if RecordStatus(record.status) not in [RecordStatus.DRAFT, RecordStatus.REJECTED]:
            raise InvalidStateException(
                f"状态 {record.status} 的记录无法编辑，仅草稿或驳回状态可编辑"
            )

        old_values = {}
        new_values = {}

        if data.pharmacy_name is not None and data.pharmacy_name != record.pharmacy_name:
            old_values["pharmacy_name"] = record.pharmacy_name
            new_values["pharmacy_name"] = data.pharmacy_name
            record.pharmacy_name = data.pharmacy_name

        if data.region is not None and data.region != record.region:
            old_values["region"] = record.region
            new_values["region"] = data.region
            record.region = data.region

        if data.town is not None and data.town != record.town:
            old_values["town"] = record.town
            new_values["town"] = data.town
            record.town = data.town

        if data.drug_name is not None and data.drug_name != record.drug_name:
            old_values["drug_name"] = record.drug_name
            new_values["drug_name"] = data.drug_name
            record.drug_name = data.drug_name

        if data.drug_spec is not None and data.drug_spec != record.drug_spec:
            old_values["drug_spec"] = record.drug_spec
            new_values["drug_spec"] = data.drug_spec
            record.drug_spec = data.drug_spec

        if data.expiry_date is not None:
            old_expiry = record.expiry_date.date() if record.expiry_date else None
            if data.expiry_date != old_expiry:
                old_values["expiry_date"] = str(old_expiry) if old_expiry else None
                new_values["expiry_date"] = str(data.expiry_date)
                record.expiry_date = datetime.combine(data.expiry_date, datetime.min.time())
                days_near = get_days_near_expiry(data.expiry_date)
                record.days_near_expiry = days_near
                record.expiry_category = get_expiry_category(days_near)

        if data.quantity is not None and data.quantity != record.quantity:
            old_values["quantity"] = record.quantity
            new_values["quantity"] = data.quantity
            record.quantity = data.quantity

        if data.unit is not None and data.unit != record.unit:
            old_values["unit"] = record.unit
            new_values["unit"] = data.unit
            record.unit = data.unit

        if data.liability_result is not None and data.liability_result.value != record.liability_result:
            old_values["liability_result"] = record.liability_result
            new_values["liability_result"] = data.liability_result.value
            record.liability_result = data.liability_result.value

        if data.liability_amount is not None and data.liability_amount != record.liability_amount:
            old_values["liability_amount"] = record.liability_amount
            new_values["liability_amount"] = data.liability_amount
            record.liability_amount = data.liability_amount

        if data.remarks is not None and data.remarks != record.remarks:
            old_values["remarks"] = record.remarks
            new_values["remarks"] = data.remarks
            record.remarks = data.remarks

        if old_values:
            record.updated_by = data.updated_by
            record.change_reason = data.change_reason
            record.current_version += 1

            change_log = ChangeLog(
                expiry_record_id=record.id,
                change_type=ChangeType.MODIFY.value,
                old_status=record.status,
                new_status=record.status,
                old_values=json.dumps(old_values, ensure_ascii=False),
                new_values=json.dumps(new_values, ensure_ascii=False),
                change_reason=data.change_reason,
                changed_by=data.updated_by,
                user_role=user_role
            )
            self.db.add(change_log)

            self.db.commit()
            self.db.refresh(record)

        return record

    def get_record(self, record_id: int) -> Optional[ExpiryRecord]:
        return self.db.query(ExpiryRecord).filter(ExpiryRecord.id == record_id).first()

    def get_record_by_no(self, record_no: str) -> Optional[ExpiryRecord]:
        return self.db.query(ExpiryRecord).filter(ExpiryRecord.record_no == record_no).first()

    def list_records(
        self,
        skip: int = 0,
        limit: int = 100,
        pharmacy_code: Optional[str] = None,
        region: Optional[str] = None,
        town: Optional[str] = None,
        status: Optional[str] = None,
        liability_result: Optional[str] = None,
        is_frozen: Optional[bool] = None
    ) -> Tuple[List[ExpiryRecord], int]:
        query = self.db.query(ExpiryRecord)

        if pharmacy_code:
            query = query.filter(ExpiryRecord.pharmacy_code == pharmacy_code)
        if region:
            query = query.filter(ExpiryRecord.region == region)
        if town:
            query = query.filter(ExpiryRecord.town == town)
        if status:
            query = query.filter(ExpiryRecord.status == status)
        if liability_result:
            query = query.filter(ExpiryRecord.liability_result == liability_result)
        if is_frozen is not None:
            query = query.filter(ExpiryRecord.is_frozen == is_frozen)

        total = query.count()
        records = query.order_by(ExpiryRecord.created_at.desc()).offset(skip).limit(limit).all()

        return records, total

    def delete_record(self, record_id: int, operator: str, user_role: str) -> bool:
        record = self.db.query(ExpiryRecord).filter(ExpiryRecord.id == record_id).first()
        if not record:
            raise NotFoundException(f"记录 {record_id} 不存在")

        if UserRole(user_role) != UserRole.ADMIN:
            raise PermissionDeniedException("仅管理员可删除记录")

        if record.is_frozen:
            raise InvalidStateException("冻结状态的记录无法删除")

        self.db.delete(record)
        self.db.commit()
        return True
