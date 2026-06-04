from __future__ import annotations

from datetime import datetime

from .models import (
    AuditEntry,
    ChatScreenshot,
    RecordSource,
    ReviewRecord,
    ReviewStatus,
    SamplingIntervalNote,
    TempUnit,
)


def _is_celsius_kelvin_mixed(
    value: float, unit: TempUnit, context_records: list[ReviewRecord]
) -> bool:
    for rec in context_records:
        if rec.temperature_unit != unit:
            return True
    return False


def import_chat_screenshot(
    screenshot: ChatScreenshot,
    existing_records: list[ReviewRecord],
) -> tuple[ReviewRecord, list[AuditEntry]]:
    audit_entries: list[AuditEntry] = []
    mixed = _is_celsius_kelvin_mixed(
        screenshot.temperature_value, screenshot.temperature_unit, existing_records
    )

    if mixed:
        status = ReviewStatus.PENDING_REVIEW
        note = "摄氏度与开尔文混用，留待训练教练复核"
    else:
        status = ReviewStatus.NORMAL
        note = ""

    record = ReviewRecord(
        id=f"rec-{screenshot.id}",
        equipment_id=screenshot.equipment_id,
        temperature_value=screenshot.temperature_value,
        temperature_unit=screenshot.temperature_unit,
        efficiency=screenshot.efficiency,
        source=RecordSource.CHAT_SCREENSHOT,
        status=status,
        note=note,
    )

    if mixed:
        audit_entries.append(
            AuditEntry(
                id=f"aud-{screenshot.id}-mixed",
                record_id=record.id,
                changed_by="system",
                change_type="status_set",
                old_value="normal",
                new_value="pending_review",
                reason="检测到摄氏度与开尔文混用，不自动归正常",
                affected_results=["效率复核结果", "交接报告"],
            )
        )

    screenshot.imported = True
    return record, audit_entries


def supplement_from_sampling_note(
    note: SamplingIntervalNote,
    target_record: ReviewRecord,
    operator: str = "老岑",
) -> tuple[ReviewRecord, list[AuditEntry]]:
    audit_entries: list[AuditEntry] = []

    old_status = target_record.status
    old_unit = target_record.temperature_unit
    old_value = target_record.temperature_value
    old_eff = target_record.efficiency

    if note.is_old_caliber:
        target_record.status = ReviewStatus.SUPPLEMENTED
        target_record.supplemental_source = RecordSource.SAMPLING_INTERVAL_NOTE
        target_record.original_unit = old_unit
        target_record.temperature_unit = note.temperature_unit
        target_record.temperature_value = note.temperature_value
        target_record.efficiency = note.efficiency
        target_record.note = f"旧口径补录，来源：采样间隔说明({note.id})"

        audit_entries.append(
            AuditEntry(
                id=f"aud-{target_record.id}-supplement",
                record_id=target_record.id,
                changed_by=operator,
                change_type="supplement_old_caliber",
                old_value=f"{old_value}{old_unit.value}/eff={old_eff}",
                new_value=f"{note.temperature_value}{note.temperature_unit.value}/eff={note.efficiency}",
                reason=f"从采样间隔说明({note.id})补录旧口径数据",
                affected_results=["效率值", "温度值", "交接报告"],
            )
        )
        audit_entries.append(
            AuditEntry(
                id=f"aud-{target_record.id}-status",
                record_id=target_record.id,
                changed_by=operator,
                change_type="status_change",
                old_value=old_status.value,
                new_value=ReviewStatus.SUPPLEMENTED.value,
                reason="旧口径数据补录",
                affected_results=["复核状态"],
            )
        )
    else:
        target_record.supplemental_source = RecordSource.SAMPLING_INTERVAL_NOTE
        audit_entries.append(
            AuditEntry(
                id=f"aud-{target_record.id}-ref",
                record_id=target_record.id,
                changed_by=operator,
                change_type="reference_added",
                old_value="",
                new_value=f"sampling_interval_note:{note.id}",
                reason=f"补充采样间隔说明({note.id})作为参考",
                affected_results=["参考资料"],
            )
        )

    return target_record, audit_entries
