from typing import Dict, List, Any, Optional
from sqlalchemy.orm import Session

from app.models import UserRole, SensitiveFieldConfig, User
from app.schemas import RoleViewConfig

DEFAULT_FIELD_CONFIG = {
    "id": {
        "data_entry_visible": True, "data_entry_editable": False,
        "reviewer_visible": True, "reviewer_editable": False,
        "supervisor_visible": True, "supervisor_editable": False,
        "read_only_visible": True, "is_export_masked": False
    },
    "record_no": {
        "data_entry_visible": True, "data_entry_editable": False,
        "reviewer_visible": True, "reviewer_editable": False,
        "supervisor_visible": True, "supervisor_editable": False,
        "read_only_visible": True, "is_export_masked": False
    },
    "franchise_id": {
        "data_entry_visible": True, "data_entry_editable": True,
        "reviewer_visible": True, "reviewer_editable": False,
        "supervisor_visible": True, "supervisor_editable": True,
        "read_only_visible": True, "is_export_masked": False
    },
    "franchise_name": {
        "data_entry_visible": True, "data_entry_editable": True,
        "reviewer_visible": True, "reviewer_editable": True,
        "supervisor_visible": True, "supervisor_editable": True,
        "read_only_visible": True, "is_export_masked": False
    },
    "record_date": {
        "data_entry_visible": True, "data_entry_editable": True,
        "reviewer_visible": True, "reviewer_editable": False,
        "supervisor_visible": True, "supervisor_editable": True,
        "read_only_visible": True, "is_export_masked": False
    },
    "status": {
        "data_entry_visible": True, "data_entry_editable": False,
        "reviewer_visible": True, "reviewer_editable": False,
        "supervisor_visible": True, "supervisor_editable": False,
        "read_only_visible": True, "is_export_masked": False
    },
    "material_name": {
        "data_entry_visible": True, "data_entry_editable": True,
        "reviewer_visible": True, "reviewer_editable": False,
        "supervisor_visible": True, "supervisor_editable": True,
        "read_only_visible": True, "is_export_masked": False
    },
    "material_code": {
        "data_entry_visible": True, "data_entry_editable": True,
        "reviewer_visible": True, "reviewer_editable": False,
        "supervisor_visible": True, "supervisor_editable": True,
        "read_only_visible": True, "is_export_masked": False
    },
    "quantity": {
        "data_entry_visible": True, "data_entry_editable": True,
        "reviewer_visible": True, "reviewer_editable": False,
        "supervisor_visible": True, "supervisor_editable": True,
        "read_only_visible": True, "is_export_masked": False
    },
    "unit": {
        "data_entry_visible": True, "data_entry_editable": True,
        "reviewer_visible": True, "reviewer_editable": False,
        "supervisor_visible": True, "supervisor_editable": True,
        "read_only_visible": True, "is_export_masked": False
    },
    "unit_price": {
        "data_entry_visible": True, "data_entry_editable": True,
        "reviewer_visible": True, "reviewer_editable": False,
        "supervisor_visible": True, "supervisor_editable": True,
        "read_only_visible": True, "is_export_masked": False
    },
    "total_amount": {
        "data_entry_visible": True, "data_entry_editable": True,
        "reviewer_visible": True, "reviewer_editable": False,
        "supervisor_visible": True, "supervisor_editable": True,
        "read_only_visible": True, "is_export_masked": False
    },
    "order_quantity": {
        "data_entry_visible": True, "data_entry_editable": True,
        "reviewer_visible": True, "reviewer_editable": False,
        "supervisor_visible": True, "supervisor_editable": True,
        "read_only_visible": True, "is_export_masked": False
    },
    "order_amount": {
        "data_entry_visible": True, "data_entry_editable": True,
        "reviewer_visible": True, "reviewer_editable": False,
        "supervisor_visible": True, "supervisor_editable": True,
        "read_only_visible": True, "is_export_masked": False
    },
    "loss_quantity": {
        "data_entry_visible": True, "data_entry_editable": True,
        "reviewer_visible": True, "reviewer_editable": False,
        "supervisor_visible": True, "supervisor_editable": True,
        "read_only_visible": True, "is_export_masked": False
    },
    "loss_amount": {
        "data_entry_visible": True, "data_entry_editable": True,
        "reviewer_visible": True, "reviewer_editable": False,
        "supervisor_visible": True, "supervisor_editable": True,
        "read_only_visible": True, "is_export_masked": False
    },
    "headquarter_price": {
        "data_entry_visible": True, "data_entry_editable": False,
        "reviewer_visible": True, "reviewer_editable": False,
        "supervisor_visible": True, "supervisor_editable": True,
        "read_only_visible": False, "is_export_masked": True
    },
    "source_order_no": {
        "data_entry_visible": True, "data_entry_editable": True,
        "reviewer_visible": True, "reviewer_editable": False,
        "supervisor_visible": True, "supervisor_editable": True,
        "read_only_visible": True, "is_export_masked": False
    },
    "source_loss_no": {
        "data_entry_visible": True, "data_entry_editable": True,
        "reviewer_visible": True, "reviewer_editable": False,
        "supervisor_visible": True, "supervisor_editable": True,
        "read_only_visible": True, "is_export_masked": False
    },
    "change_reason": {
        "data_entry_visible": True, "data_entry_editable": True,
        "reviewer_visible": True, "reviewer_editable": True,
        "supervisor_visible": True, "supervisor_editable": True,
        "read_only_visible": True, "is_export_masked": False
    },
    "rejection_reason": {
        "data_entry_visible": True, "data_entry_editable": False,
        "reviewer_visible": True, "reviewer_editable": True,
        "supervisor_visible": True, "supervisor_editable": True,
        "read_only_visible": True, "is_export_masked": False
    },
    "remarks": {
        "data_entry_visible": True, "data_entry_editable": True,
        "reviewer_visible": True, "reviewer_editable": True,
        "supervisor_visible": True, "supervisor_editable": True,
        "read_only_visible": True, "is_export_masked": False
    },
    "is_dirty": {
        "data_entry_visible": True, "data_entry_editable": False,
        "reviewer_visible": True, "reviewer_editable": False,
        "supervisor_visible": True, "supervisor_editable": False,
        "read_only_visible": True, "is_export_masked": False
    },
    "dirty_types": {
        "data_entry_visible": True, "data_entry_editable": False,
        "reviewer_visible": True, "reviewer_editable": False,
        "supervisor_visible": True, "supervisor_editable": False,
        "read_only_visible": True, "is_export_masked": False
    },
    "raw_data": {
        "data_entry_visible": False, "data_entry_editable": False,
        "reviewer_visible": True, "reviewer_editable": False,
        "supervisor_visible": True, "supervisor_editable": False,
        "read_only_visible": False, "is_export_masked": True
    },
    "processing_notes": {
        "data_entry_visible": False, "data_entry_editable": False,
        "reviewer_visible": True, "reviewer_editable": True,
        "supervisor_visible": True, "supervisor_editable": True,
        "read_only_visible": False, "is_export_masked": True
    },
    "created_by": {
        "data_entry_visible": True, "data_entry_editable": False,
        "reviewer_visible": True, "reviewer_editable": False,
        "supervisor_visible": True, "supervisor_editable": False,
        "read_only_visible": True, "is_export_masked": False
    },
    "created_at": {
        "data_entry_visible": True, "data_entry_editable": False,
        "reviewer_visible": True, "reviewer_editable": False,
        "supervisor_visible": True, "supervisor_editable": False,
        "read_only_visible": True, "is_export_masked": False
    },
    "reviewed_by": {
        "data_entry_visible": True, "data_entry_editable": False,
        "reviewer_visible": True, "reviewer_editable": False,
        "supervisor_visible": True, "supervisor_editable": False,
        "read_only_visible": True, "is_export_masked": False
    },
    "reviewed_at": {
        "data_entry_visible": True, "data_entry_editable": False,
        "reviewer_visible": True, "reviewer_editable": False,
        "supervisor_visible": True, "supervisor_editable": False,
        "read_only_visible": True, "is_export_masked": False
    },
    "confirmed_by": {
        "data_entry_visible": True, "data_entry_editable": False,
        "reviewer_visible": True, "reviewer_editable": False,
        "supervisor_visible": True, "supervisor_editable": False,
        "read_only_visible": True, "is_export_masked": False
    },
    "confirmed_at": {
        "data_entry_visible": True, "data_entry_editable": False,
        "reviewer_visible": True, "reviewer_editable": False,
        "supervisor_visible": True, "supervisor_editable": False,
        "read_only_visible": True, "is_export_masked": False
    },
}


def get_field_config(db: Session, field_name: str) -> Dict[str, Any]:
    db_config = db.query(SensitiveFieldConfig).filter(SensitiveFieldConfig.field_name == field_name).first()
    if db_config:
        return {
            "data_entry_visible": db_config.data_entry_visible,
            "data_entry_editable": db_config.data_entry_editable,
            "reviewer_visible": db_config.reviewer_visible,
            "reviewer_editable": db_config.reviewer_editable,
            "supervisor_visible": db_config.supervisor_visible,
            "supervisor_editable": db_config.supervisor_editable,
            "read_only_visible": db_config.read_only_visible,
            "is_export_masked": db_config.is_export_masked,
            "mask_pattern": db_config.mask_pattern,
        }
    return DEFAULT_FIELD_CONFIG.get(field_name, {
        "data_entry_visible": True, "data_entry_editable": True,
        "reviewer_visible": True, "reviewer_editable": False,
        "supervisor_visible": True, "supervisor_editable": True,
        "read_only_visible": False, "is_export_masked": True
    })


def is_field_visible(db: Session, field_name: str, role: UserRole) -> bool:
    config = get_field_config(db, field_name)
    role_key = f"{role.value}_visible"
    return config.get(role_key, False)


def is_field_editable(db: Session, field_name: str, role: UserRole) -> bool:
    config = get_field_config(db, field_name)
    role_key = f"{role.value}_editable"
    return config.get(role_key, False)


def is_field_export_masked(db: Session, field_name: str) -> bool:
    config = get_field_config(db, field_name)
    return config.get("is_export_masked", False)


def get_mask_pattern(db: Session, field_name: str) -> Optional[str]:
    config = get_field_config(db, field_name)
    return config.get("mask_pattern")


def mask_value(value: Any, pattern: Optional[str] = None) -> str:
    if value is None:
        return ""
    str_val = str(value)
    if not pattern or len(str_val) <= 4:
        return "****"
    return str_val[:2] + "****" + str_val[-2:]


def apply_field_visibility(data: Dict[str, Any], db: Session, role: UserRole, is_export: bool = False) -> Dict[str, Any]:
    result = {}
    for field, value in data.items():
        if not is_field_visible(db, field, role):
            continue
        if is_export and is_field_export_masked(db, field):
            pattern = get_mask_pattern(db, field)
            result[field] = mask_value(value, pattern)
        else:
            result[field] = value
    return result


def filter_editable_fields(fields: List[str], db: Session, role: UserRole) -> List[str]:
    return [f for f in fields if is_field_editable(db, f, role)]


def get_role_view_config(db: Session, role: UserRole) -> RoleViewConfig:
    all_fields = list(DEFAULT_FIELD_CONFIG.keys())
    visible_fields = [f for f in all_fields if is_field_visible(db, f, role)]
    editable_fields = [f for f in all_fields if is_field_editable(db, f, role)]
    return RoleViewConfig(
        role=role,
        visible_fields=visible_fields,
        editable_fields=editable_fields
    )


def can_edit_record(user: User, record_status: str) -> bool:
    from app.models import RecordStatus
    status = RecordStatus(record_status) if isinstance(record_status, str) else record_status
    
    if user.role == UserRole.SUPERVISOR:
        return True
    if user.role == UserRole.REVIEWER:
        return status in [RecordStatus.DRAFT, RecordStatus.SUBMITTED, RecordStatus.REJECTED]
    if user.role == UserRole.DATA_ENTRY:
        return status in [RecordStatus.DRAFT, RecordStatus.REJECTED]
    return False


def can_change_status(user: User, from_status: str, to_status: str) -> bool:
    from app.models import RecordStatus
    from_s = RecordStatus(from_status) if isinstance(from_status, str) else from_status
    to_s = RecordStatus(to_status) if isinstance(to_status, str) else to_status
    
    if user.role == UserRole.SUPERVISOR:
        if from_s == RecordStatus.SUBMITTED and to_s in [RecordStatus.CONFIRMED, RecordStatus.REJECTED]:
            return True
        if from_s == RecordStatus.REJECTED and to_s == RecordStatus.SUBMITTED:
            return True
        if from_s == RecordStatus.CONFIRMED and to_s == RecordStatus.AUDIT_ONLY:
            return True
        return False
    
    if user.role == UserRole.REVIEWER:
        if from_s == RecordStatus.SUBMITTED and to_s == RecordStatus.REJECTED:
            return True
        if from_s == RecordStatus.REJECTED and to_s == RecordStatus.SUBMITTED:
            return True
        return False
    
    if user.role == UserRole.DATA_ENTRY:
        if from_s == RecordStatus.DRAFT and to_s == RecordStatus.SUBMITTED:
            return True
        if from_s == RecordStatus.REJECTED and to_s == RecordStatus.DRAFT:
            return True
        return False
    
    return False
