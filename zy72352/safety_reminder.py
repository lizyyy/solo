from datetime import datetime
from typing import List, Optional
import uuid

from models import (
    SensorRecord,
    SafetyReminder,
    SafetyLevel,
    NextAction,
    MaintenanceScreenshot,
    ExperimentSession,
    SensorStatus,
)


class SafetyReminderManager:
    def create_reminder_for_restart(
        self, record: SensorRecord, pattern_info: dict
    ) -> SafetyReminder:
        level = SafetyLevel.WARNING
        if pattern_info.get("pattern") == "frequent_restarts":
            level = SafetyLevel.CRITICAL

        missing_materials = ["维修群截图", "设备铭牌参数核对记录"]

        return SafetyReminder(
            id=str(uuid.uuid4()),
            record_id=record.id,
            level=level,
            title=f"传感器重启编号变更 - {record.sensor_id}",
            reason_kept=(
                f"检测到传感器 {record.sensor_id} 编号从 {record.original_sensor_number} "
                f"变为 {record.sensor_number}，可能影响风洞小车阻力曲线数据准确性。"
                f"保留此记录用于安全复核，确保实验数据可追溯。"
            ),
            missing_materials=missing_materials,
            next_action=NextAction.CONTACT_TEACHER_LIN,
            teacher_note=None,
            reviewed_by_safety=False,
        )

    def update_after_screenshot(
        self,
        reminder: SafetyReminder,
        screenshot: MaintenanceScreenshot,
        teacher_note: str,
    ) -> SafetyReminder:
        if "维修群截图" in reminder.missing_materials:
            reminder.missing_materials.remove("维修群截图")

        reminder.teacher_note = (
            f"林老师补录维修群截图：{screenshot.description or '已上传'}\n"
            f"说明：{teacher_note}"
        )

        if not reminder.missing_materials:
            reminder.next_action = NextAction.CONTACT_SAFETY_OFFICER
        else:
            reminder.next_action = NextAction.AWAITING_MATERIALS

        reminder.updated_at = datetime.now()
        return reminder

    def update_after_device_plate_check(
        self, reminder: SafetyReminder, check_note: str
    ) -> SafetyReminder:
        if "设备铭牌参数核对记录" in reminder.missing_materials:
            reminder.missing_materials.remove("设备铭牌参数核对记录")

        if reminder.teacher_note:
            reminder.teacher_note += f"\n设备铭牌核对：{check_note}"
        else:
            reminder.teacher_note = f"设备铭牌核对：{check_note}"

        if not reminder.missing_materials:
            reminder.next_action = NextAction.CONTACT_SAFETY_OFFICER
        else:
            reminder.next_action = NextAction.AWAITING_MATERIALS

        reminder.updated_at = datetime.now()
        return reminder

    def mark_reviewed(
        self, reminder: SafetyReminder, reviewer_note: str, approve: bool
    ) -> SafetyReminder:
        reminder.reviewed_by_safety = True
        reminder.reviewer_note = reviewer_note

        if approve:
            reminder.next_action = NextAction.COMPLETED
        else:
            reminder.next_action = NextAction.CONTACT_TEACHER_LIN

        reminder.updated_at = datetime.now()
        return reminder

    def process_session_reminders(
        self, session: ExperimentSession, restart_events: List[dict], pattern_info: dict
    ) -> ExperimentSession:
        for event in restart_events:
            record = next(
                (r for r in session.sensor_records if r.id == event["new_record_id"]),
                None,
            )
            if record:
                existing = next(
                    (
                        r
                        for r in session.safety_reminders
                        if r.record_id == record.id
                    ),
                    None,
                )
                if not existing:
                    reminder = self.create_reminder_for_restart(record, pattern_info)
                    session.safety_reminders.append(reminder)

        return session

    def get_reminder_by_record(
        self, session: ExperimentSession, record_id: str
    ) -> Optional[SafetyReminder]:
        return next(
            (r for r in session.safety_reminders if r.record_id == record_id), None
        )

    def get_summary(self, session: ExperimentSession) -> dict:
        total = len(session.safety_reminders)
        critical = len(
            [r for r in session.safety_reminders if r.level == SafetyLevel.CRITICAL]
        )
        warning = len(
            [r for r in session.safety_reminders if r.level == SafetyLevel.WARNING]
        )
        reviewed = len([r for r in session.safety_reminders if r.reviewed_by_safety])
        pending_safety = len(
            [
                r
                for r in session.safety_reminders
                if r.next_action == NextAction.CONTACT_SAFETY_OFFICER
            ]
        )

        return {
            "total": total,
            "critical": critical,
            "warning": warning,
            "reviewed": reviewed,
            "pending_safety": pending_safety,
            "pending_materials": total - reviewed,
        }


safety_manager = SafetyReminderManager()
