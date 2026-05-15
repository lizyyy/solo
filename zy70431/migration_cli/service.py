import uuid
from datetime import datetime
from typing import List, Optional
from .models import (
    MigrationRecord,
    IoTDeviceReceipt,
    Attachment,
    SystemJudgment,
    ManualCorrection,
    ChangeHistory,
    MaterialSummary,
    Status
)
from .storage import (
    load_records,
    add_record,
    get_record_by_id,
    update_record
)

def check_attachment_expiry(attachment: Attachment) -> bool:
    if attachment.expire_date is None:
        return False
    return datetime.now() > attachment.expire_date

def generate_system_judgment(receipt: IoTDeviceReceipt) -> SystemJudgment:
    issues = []
    status = Status.NORMAL

    for att in receipt.attachments:
        if check_attachment_expiry(att):
            issues.append(f"附件[{att.name}]已过期，过期日期: {att.expire_date.strftime('%Y-%m-%d')}")
            status = Status.ABNORMAL

    if not receipt.attachments:
        issues.append("无附件材料")

    return SystemJudgment(
        judgment_id=str(uuid.uuid4()),
        receipt_id=receipt.receipt_id,
        status=status,
        issues=issues
    )

def create_migration_record(
    device_id: str,
    device_name: str,
    receipt_type: str,
    operator: str,
    original_input: dict,
    attachments: Optional[List[Attachment]] = None,
    remark: Optional[str] = None
) -> MigrationRecord:
    receipt = IoTDeviceReceipt(
        receipt_id=str(uuid.uuid4()),
        device_id=device_id,
        device_name=device_name,
        receipt_type=receipt_type,
        received_date=datetime.now(),
        operator=operator,
        original_input=original_input,
        attachments=attachments or [],
        remark=remark
    )

    for att in receipt.attachments:
        att.is_expired = check_attachment_expiry(att)

    system_judgment = generate_system_judgment(receipt)

    record = MigrationRecord(
        receipt=receipt,
        system_judgment=system_judgment
    )

    add_record(record)
    return record

def add_manual_correction(
    receipt_id: str,
    operator: str,
    correction_note: str,
    corrected_status: Optional[Status] = None
) -> Optional[MigrationRecord]:
    record = get_record_by_id(receipt_id)
    if record is None:
        return None

    correction = ManualCorrection(
        correction_id=str(uuid.uuid4()),
        receipt_id=receipt_id,
        operator=operator,
        correction_note=correction_note,
        corrected_status=corrected_status
    )
    record.manual_correction = correction

    change = ChangeHistory(
        change_id=str(uuid.uuid4()),
        receipt_id=receipt_id,
        resource_scope="manual_correction",
        change_type="add_correction",
        change_reason="人工修正备注",
        operator=operator
    )
    record.change_histories.append(change)

    update_record(record)
    return record

def add_material_summary(
    receipt_id: str,
    summary_text: str
) -> Optional[MigrationRecord]:
    record = get_record_by_id(receipt_id)
    if record is None:
        return None

    summary = MaterialSummary(
        summary_id=str(uuid.uuid4()),
        receipt_id=receipt_id,
        summary_text=summary_text
    )
    record.material_summary = summary
    update_record(record)
    return record

def add_contract_supplement(
    receipt_id: str,
    operator: str,
    change_reason: str,
    resource_scope: str,
    previous_value: Optional[str] = None,
    new_value: Optional[str] = None
) -> Optional[MigrationRecord]:
    record = get_record_by_id(receipt_id)
    if record is None:
        return None

    change = ChangeHistory(
        change_id=str(uuid.uuid4()),
        receipt_id=receipt_id,
        resource_scope=resource_scope,
        change_type="contract_supplement",
        change_reason=change_reason,
        operator=operator,
        previous_value=previous_value,
        new_value=new_value
    )
    record.change_histories.append(change)
    update_record(record)
    return record

def get_change_history_by_scope(receipt_id: str, resource_scope: Optional[str] = None) -> List[ChangeHistory]:
    record = get_record_by_id(receipt_id)
    if record is None:
        return []
    if resource_scope:
        return [ch for ch in record.change_histories if ch.resource_scope == resource_scope]
    return record.change_histories

def get_effective_status(record: MigrationRecord) -> Status:
    if record.manual_correction and record.manual_correction.corrected_status:
        return record.manual_correction.corrected_status
    if record.system_judgment:
        return record.system_judgment.status
    return Status.PENDING

def get_all_records() -> List[MigrationRecord]:
    return load_records()
