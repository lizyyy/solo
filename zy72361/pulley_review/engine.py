from __future__ import annotations

from datetime import datetime

from .models import (
    AuditEntry,
    ChatScreenshot,
    PendingReviewInfo,
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


def _other_unit(unit: TempUnit) -> TempUnit:
    return TempUnit.CELSIUS if unit == TempUnit.KELVIN else TempUnit.KELVIN


def _convert_temp_preview(value: float, unit: TempUnit) -> tuple[float, TempUnit]:
    if unit == TempUnit.CELSIUS:
        return (value + 273.15, TempUnit.KELVIN)
    return (value - 273.15, TempUnit.CELSIUS)


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
        conv_val, conv_unit = _convert_temp_preview(
            screenshot.temperature_value, screenshot.temperature_unit
        )
        pending_info = PendingReviewInfo(
            original_statement="维修群截图原始记录：{}{}, 效率 {}".format(
                screenshot.temperature_value, screenshot.temperature_unit.value, screenshot.efficiency
            ),
            suggested_value="统一为 {} 后约为 {:.2f}{}".format(
                _other_unit(screenshot.temperature_unit).value, conv_val, conv_unit.value
            ),
            reason="同设备其他记录温度单位不一致，存在摄氏度/开尔文混用风险，系统不自动转换归正常",
            next_handler="训练教练（请复核温度单位、确认换算口径后再入正常结果）",
        )
    else:
        status = ReviewStatus.NORMAL
        note = ""
        pending_info = None

    record = ReviewRecord(
        id="rec-{}".format(screenshot.id),
        equipment_id=screenshot.equipment_id,
        temperature_value=screenshot.temperature_value,
        temperature_unit=screenshot.temperature_unit,
        efficiency=screenshot.efficiency,
        source=RecordSource.CHAT_SCREENSHOT,
        status=status,
        note=note,
        pending_review=pending_info,
    )

    if mixed:
        audit_entries.append(
            AuditEntry(
                id="aud-{}-mixed".format(screenshot.id),
                record_id=record.id,
                changed_by="system",
                change_type="status_set",
                old_value="normal",
                new_value="pending_review",
                reason="检测到摄氏度与开尔文混用，不自动归正常",
                affected_results=["效率复核结果", "交接报告", "列表展示", "详情页"],
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

    if target_record.original_value_before_supplement is None:
        target_record.original_value_before_supplement = old_value
    if target_record.original_efficiency_before_supplement is None:
        target_record.original_efficiency_before_supplement = old_eff

    if note.is_old_caliber:
        target_record.status = ReviewStatus.SUPPLEMENTED
        target_record.supplemental_source = RecordSource.SAMPLING_INTERVAL_NOTE
        target_record.original_unit = old_unit
        target_record.temperature_unit = note.temperature_unit
        target_record.temperature_value = note.temperature_value
        target_record.efficiency = note.efficiency
        target_record.note = (
            "旧口径补录，来源：采样间隔说明({})；".format(note.id)
            + "原始说法：{}{}/eff={} → ".format(old_value, old_unit.value, old_eff)
            + "补录后：{}{}/eff={}".format(note.temperature_value, note.temperature_unit.value, note.efficiency)
        )

        audit_entries.append(
            AuditEntry(
                id="aud-{}-supplement".format(target_record.id),
                record_id=target_record.id,
                changed_by=operator,
                change_type="supplement_old_caliber",
                old_value="{}{}/eff={}".format(old_value, old_unit.value, old_eff),
                new_value="{}{}/eff={}".format(note.temperature_value, note.temperature_unit.value, note.efficiency),
                reason="从采样间隔说明({})补录旧口径数据；下一步：归档交接报告".format(note.id),
                affected_results=["效率值", "温度值", "交接报告", "列表展示", "详情页", "历史记录"],
            )
        )
        audit_entries.append(
            AuditEntry(
                id="aud-{}-status".format(target_record.id),
                record_id=target_record.id,
                changed_by=operator,
                change_type="status_change",
                old_value=old_status.value,
                new_value=ReviewStatus.SUPPLEMENTED.value,
                reason="旧口径数据补录",
                affected_results=["复核状态", "摘要统计"],
            )
        )
    else:
        target_record.supplemental_source = RecordSource.SAMPLING_INTERVAL_NOTE
        audit_entries.append(
            AuditEntry(
                id="aud-{}-ref".format(target_record.id),
                record_id=target_record.id,
                changed_by=operator,
                change_type="reference_added",
                old_value="",
                new_value="sampling_interval_note:{}".format(note.id),
                reason="补充采样间隔说明({})作为参考".format(note.id),
                affected_results=["参考资料", "详情页"],
            )
        )

    return target_record, audit_entries
