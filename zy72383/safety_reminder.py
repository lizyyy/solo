from datetime import datetime
from typing import List, Optional
from models import (
    SafetyReminder, ReminderLevel, NextAction,
    CylinderConversionRecord, RecordStatus
)
import uuid


def _reminder_id() -> str:
    return f"REM-{uuid.uuid4().hex[:8].upper()}"


def generate_sensor_change_reminder(
    record: CylinderConversionRecord,
    expected_sensor_id: Optional[str] = None
) -> SafetyReminder:
    reported = record.sensor_id_original or "未上报"
    expected = expected_sensor_id or "注册表中无对应记录"

    return SafetyReminder(
        reminder_id=_reminder_id(),
        level=ReminderLevel.WARNING,
        title="传感器重启后编号变化，需人工确认",
        reason=(
            f"【为什么留下这条】\n"
            f"气瓶 {record.cylinder_id} 在 {record.calibrate_time.strftime('%Y-%m-%d %H:%M')} 校准记录中，"
            f"传感器上报编号为 [{reported}]，但根据物理标签对应的注册表，"
            f"该位置的传感器编号应为 [{expected}]。\n"
            f"这是典型的「传感器重启后编号被重置」现象，以前总被当成小备注跳过，"
            f"但传感器编号直接影响温度校准数据的追溯链，错了会导致后续压力换算全部失真。"
        ),
        missing_materials=[
            "1. 训练教练老唐需去现场核对物理标签上的激光刻印编号",
            "2. 需要老唐签字确认的传感器编号补录单",
            "3. 如有传感器重启操作记录也需附上"
        ],
        next_action=NextAction.FIND_COACH_TANG,
        is_resolved=False
    )


def generate_sensor_updated_reminder(
    record: CylinderConversionRecord
) -> SafetyReminder:
    original = record.sensor_id_original or "未上报"
    confirmed = record.sensor_id_confirmed or "未补录"

    return SafetyReminder(
        reminder_id=_reminder_id(),
        level=ReminderLevel.WARNING,
        title="传感器编号已补录，需安全员复核",
        reason=(
            f"【为什么留下这条】\n"
            f"气瓶 {record.cylinder_id} 的传感器编号已由训练教练老唐补录确认："
            f"原上报 [{original}] → 确认 [{confirmed}]。\n"
            f"但这条记录不能直接归为正常。因为传感器编号曾经发生过变化，"
            f"说明该传感器可能经历过重启、固件更新或更换，"
            f"需要安全员确认：编号变化是否影响该时段内其他数据的有效性？"
            f"是否需要扩大核查范围？"
        ),
        missing_materials=[
            "1. 安全员需核查该传感器编号变化前后的数据一致性",
            "2. 安全员需确认是否需要对同批次其他气瓶进行追溯",
            "3. 安全员的复核意见和签字"
        ],
        next_action=NextAction.FIND_SAFETY_OFFICER,
        is_resolved=False
    )


def generate_caliber_mismatch_reminder(
    record: CylinderConversionRecord
) -> SafetyReminder:
    return SafetyReminder(
        reminder_id=_reminder_id(),
        level=ReminderLevel.WARNING,
        title="传感器口径不匹配，需现场技术确认",
        reason=(
            f"【为什么留下这条】\n"
            f"气瓶 {record.cylinder_id} 的温度校准记录中，"
            f"传感器口径为 [{record.caliber_actual}]，"
            f"但系统期望口径为 [{record.caliber_expected}]。\n"
            f"口径错误会导致温度-压力换算公式用错，结果偏差可达5%~15%，"
            f"属于现场最常见的「错口径」返工原因。"
        ),
        missing_materials=[
            "1. 现场技术人员确认传感器实际型号和口径",
            "2. 如口径确实不符，需更换传感器或调整校准方法",
            "3. 口径调整后的重新校准记录"
        ],
        next_action=NextAction.FIND_FIELD_TECH,
        is_resolved=False
    )


def generate_missing_pressure_reminder(
    record: CylinderConversionRecord
) -> SafetyReminder:
    return SafetyReminder(
        reminder_id=_reminder_id(),
        level=ReminderLevel.INFO,
        title="缺少对应压力读数，无法完成换算",
        reason=(
            f"【为什么留下这条】\n"
            f"气瓶 {record.cylinder_id} 的温度校准记录已导入，"
            f"但缺少同一时间点的压力读数，无法完成压力温度换算。\n"
            f"这是典型的「补录返工」场景——数据分两次导入，中间漏掉了关联匹配。"
        ),
        missing_materials=[
            f"1. 该气瓶在 {record.calibrate_time.strftime('%Y-%m-%d %H:%M')} 前后的压力读数",
            "2. 压力读数的操作人员和记录单号"
        ],
        next_action=NextAction.FIND_FIELD_TECH,
        is_resolved=False
    )


def generate_all_reminders(
    record: CylinderConversionRecord,
    expected_sensor_id: Optional[str] = None
) -> List[SafetyReminder]:
    reminders: List[SafetyReminder] = []

    if record.is_sensor_id_changed and record.status == RecordStatus.SENSOR_ABNORMAL:
        reminders.append(generate_sensor_change_reminder(record, expected_sensor_id))

    if record.is_sensor_id_changed and record.status == RecordStatus.SENSOR_UPDATED:
        reminders.append(generate_sensor_updated_reminder(record))

    if record.caliber_mismatch:
        reminders.append(generate_caliber_mismatch_reminder(record))

    if record.raw_pressure == 0 and record.status in [RecordStatus.PENDING, RecordStatus.SENSOR_ABNORMAL, RecordStatus.SENSOR_UPDATED]:
        reminders.append(generate_missing_pressure_reminder(record))

    return reminders


def auto_apply_reminders(
    record: CylinderConversionRecord,
    expected_sensor_id: Optional[str] = None
) -> CylinderConversionRecord:
    unresolved_ids = {
        r.reminder_id for r in record.safety_reminders if not r.is_resolved
    }

    new_reminders = generate_all_reminders(record, expected_sensor_id)

    for reminder in new_reminders:
        if reminder.reminder_id not in unresolved_ids:
            exists = any(
                r.title == reminder.title and not r.is_resolved
                for r in record.safety_reminders
            )
            if not exists:
                record.add_reminder(reminder)

    for reminder in record.safety_reminders:
        if not reminder.is_resolved:
            should_resolve = True
            if "传感器重启后编号变化" in reminder.title:
                should_resolve = record.status != RecordStatus.SENSOR_ABNORMAL
            elif "传感器编号已补录" in reminder.title:
                should_resolve = record.status not in [
                    RecordStatus.SENSOR_UPDATED,
                    RecordStatus.PENDING_REVIEW
                ]
            elif "传感器口径不匹配" in reminder.title:
                should_resolve = not record.caliber_mismatch
            elif "缺少对应压力读数" in reminder.title:
                should_resolve = record.raw_pressure > 0

            if should_resolve:
                reminder.is_resolved = True
                reminder.resolved_time = datetime.now()
                reminder.resolved_note = f"状态变更为 [{record.status.value}]，提醒自动关闭"
                record.add_log("关闭安全提醒", "系统", reminder.title)

    if record.is_sensor_id_changed and record.status == RecordStatus.SENSOR_UPDATED:
        record.status = RecordStatus.PENDING_REVIEW
        record.add_log("状态更新", "系统", "传感器编号已补录，转入安全员复核队列")

    return record


def resolve_reminder(
    record: CylinderConversionRecord,
    reminder_id: str,
    operator: str,
    resolution_note: str
) -> CylinderConversionRecord:
    for reminder in record.safety_reminders:
        if reminder.reminder_id == reminder_id and not reminder.is_resolved:
            reminder.is_resolved = True
            reminder.resolved_time = datetime.now()
            reminder.resolved_note = resolution_note
            record.add_log(
                "人工关闭安全提醒",
                operator,
                f"{reminder.title}: {resolution_note}"
            )
            break
    return record


def format_reminder_for_display(reminder: SafetyReminder) -> str:
    status_icon = "✅" if reminder.is_resolved else "⚠️"
    level_color = {
        ReminderLevel.INFO: "【提示】",
        ReminderLevel.WARNING: "【警告】",
        ReminderLevel.CRITICAL: "【严重】"
    }.get(reminder.level, "【提示】")

    lines = [
        f"{status_icon} {level_color} {reminder.title}",
        f"   提醒编号: {reminder.reminder_id}",
        f"   创建时间: {reminder.created_time.strftime('%Y-%m-%d %H:%M:%S')}",
        "",
        f"   {reminder.reason}",
        "",
        "   【还缺什么材料】",
    ]
    for material in reminder.missing_materials:
        lines.append(f"   - {material}")

    lines.extend([
        "",
        f"   【下一步】 → {reminder.next_action.value}",
    ])

    if reminder.is_resolved:
        lines.extend([
            "",
            f"   ✅ 已关闭: {reminder.resolved_time.strftime('%Y-%m-%d %H:%M:%S') if reminder.resolved_time else ''}",
            f"   关闭说明: {reminder.resolved_note or '无'}"
        ])

    return "\n".join(lines)
