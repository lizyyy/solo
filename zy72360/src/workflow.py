from datetime import datetime
from typing import List, Optional, Dict, Callable
from .models import (
    SamplingRecord, TemperatureCalibration, RollPeriodEstimate,
    ConflictEvidence, SafetyReminder, RecordStatus, SensorStatus
)
from .conflict_detector import ConflictDetector
from .self_check import SelfChecker
import uuid
import json


class QualityWorkflow:
    def __init__(self):
        self.sampling_records: List[SamplingRecord] = []
        self.calibration_records: List[TemperatureCalibration] = []
        self.estimates: List[RollPeriodEstimate] = []
        self.safety_reminders: List[SafetyReminder] = []
        self.conflict_detector = ConflictDetector()
        self.self_checker = SelfChecker()
        self.history_log: List[dict] = []
        
    def step1_import_sampling_record(self, record_data: dict) -> dict:
        record = SamplingRecord(
            record_id=record_data["record_id"],
            ship_id=record_data["ship_id"],
            sensor_id=record_data["sensor_id"],
            sampling_interval=record_data["sampling_interval"],
            sampling_start_time=datetime.fromisoformat(record_data["sampling_start_time"]),
            sampling_end_time=datetime.fromisoformat(record_data["sampling_end_time"]),
            roll_periods=record_data["roll_periods"],
            import_time=datetime.now(),
            import_user=record_data.get("import_user", "system"),
            is_supplementary=record_data.get("is_supplementary", False),
            original_record_id=record_data.get("original_record_id")
        )
        
        check_issues = self.self_checker.run_all_checks(record)
        
        conflict = self.conflict_detector.check_sampling_interval_conflict(
            record, self.calibration_records
        )
        
        self.sampling_records.append(record)
        
        self._log_action("导入采样记录", {
            "record_id": record.record_id,
            "check_issues": check_issues,
            "has_conflict": conflict is not None
        })
        
        return {
            "step": 1,
            "action": "采样记录导入完成",
            "record_id": record.record_id,
            "status": record.status.value,
            "check_issues": check_issues,
            "conflict_found": conflict is not None,
            "conflict_details": conflict.description if conflict else None,
            "needs_attention": record.status in [RecordStatus.CONFLICT, RecordStatus.PENDING_REVIEW]
        }

    def step2_import_calibration_and_check(self, calibration_data: dict) -> dict:
        calibration = TemperatureCalibration(
            calibration_id=calibration_data["calibration_id"],
            ship_id=calibration_data["ship_id"],
            sensor_id=calibration_data["sensor_id"],
            calibration_time=datetime.fromisoformat(calibration_data["calibration_time"]),
            effective_sampling_interval=calibration_data["effective_sampling_interval"],
            calibration_temperature=calibration_data["calibration_temperature"],
            operator=calibration_data.get("operator", "system"),
            remarks=calibration_data.get("remarks", "")
        )
        
        self.calibration_records.append(calibration)
        
        conflicts = []
        for record in self.sampling_records:
            if (record.ship_id == calibration.ship_id 
                and record.sensor_id == calibration.sensor_id
                and record.status == RecordStatus.NORMAL):
                conflict = self.conflict_detector.check_sampling_interval_conflict(
                    record, self.calibration_records
                )
                if conflict:
                    conflicts.append({
                        "record_id": record.record_id,
                        "conflict_id": conflict.conflict_id,
                        "description": conflict.description
                    })
        
        self._log_action("导入温度校准记录", {
            "calibration_id": calibration.calibration_id,
            "new_conflicts_count": len(conflicts)
        })
        
        return {
            "step": 2,
            "action": "温度校准记录导入完成",
            "calibration_id": calibration.calibration_id,
            "new_conflicts_found": len(conflicts),
            "conflicts": conflicts,
            "message": f"发现 {len(conflicts)} 条记录与校准数据冲突，请质检员确认"
        }

    def resolve_conflict(
        self,
        conflict_id: str,
        resolution: str,
        resolved_by: str
    ) -> dict:
        conflict = next(
            (c for c in self.conflict_detector.conflicts if c.conflict_id == conflict_id),
            None
        )
        
        if not conflict:
            return {"success": False, "message": "冲突记录不存在"}
        
        self.conflict_detector.resolve_conflict(conflict_id, resolution, resolved_by)
        
        record = next(
            (r for r in self.sampling_records if r.record_id == conflict.sampling_record_id),
            None
        )
        
        if record:
            if resolution == "确认有效，以采样记录为准":
                record.status = RecordStatus.CONFIRMED
            elif resolution == "驳回，以校准数据为准":
                record.status = RecordStatus.REJECTED
        
        self._log_action("冲突处理", {
            "conflict_id": conflict_id,
            "resolution": resolution,
            "resolved_by": resolved_by
        })
        
        return {
            "success": True,
            "conflict_id": conflict_id,
            "resolution": resolution,
            "resolved_by": resolved_by,
            "record_new_status": record.status.value if record else None
        }

    def step3_update_safety_reminders(self, operator: str) -> dict:
        old_reminders_count = len(self.safety_reminders)
        
        for record in self.sampling_records:
            if record.status == RecordStatus.PENDING_REVIEW:
                existing = any(r.related_record_id == record.record_id for r in self.safety_reminders)
                if not existing:
                    reminder = SafetyReminder(
                        reminder_id=str(uuid.uuid4()),
                        related_record_id=record.record_id,
                        level="高",
                        title="传感器编号变更待复核",
                        content=f"船舶[{record.ship_id}]传感器编号从[{record.previous_sensor_id}]变为[{record.sensor_id}]，疑似重启，请安全员复核是否正常。",
                        created_time=datetime.now()
                    )
                    self.safety_reminders.append(reminder)
        
        for conflict in self.conflict_detector.conflicts:
            if not conflict.resolved:
                existing = any(r.related_record_id == conflict.sampling_record_id for r in self.safety_reminders)
                if not existing:
                    reminder = SafetyReminder(
                        reminder_id=str(uuid.uuid4()),
                        related_record_id=conflict.sampling_record_id,
                        level="中",
                        title="采样间隔冲突待确认",
                        content=conflict.description,
                        created_time=datetime.now()
                    )
                    self.safety_reminders.append(reminder)
        
        new_reminders_count = len(self.safety_reminders) - old_reminders_count
        
        self._log_action("更新安全提醒", {
            "operator": operator,
            "new_reminders": new_reminders_count
        })
        
        return {
            "step": 3,
            "action": "安全提醒更新完成",
            "operator": operator,
            "new_reminders_added": new_reminders_count,
            "total_pending_reminders": sum(1 for r in self.safety_reminders if not r.reviewed),
            "reminders": [
                {
                    "id": r.reminder_id,
                    "level": r.level,
                    "title": r.title,
                    "related_record": r.related_record_id,
                    "reviewed": r.reviewed
                }
                for r in self.safety_reminders
            ]
        }

    def review_safety_reminder(self, reminder_id: str, reviewed_by: str, is_approved: bool) -> dict:
        reminder = next(
            (r for r in self.safety_reminders if r.reminder_id == reminder_id),
            None
        )
        
        if not reminder:
            return {"success": False, "message": "提醒不存在"}
        
        reminder.reviewed = True
        reminder.reviewed_by = reviewed_by
        reminder.reviewed_time = datetime.now()
        
        record = next(
            (r for r in self.sampling_records if r.record_id == reminder.related_record_id),
            None
        )
        
        if record and is_approved:
            if record.status == RecordStatus.PENDING_REVIEW:
                record.status = RecordStatus.NORMAL
                record.remarks += "安全员复核通过；"
        
        self._log_action("安全员复核", {
            "reminder_id": reminder_id,
            "reviewed_by": reviewed_by,
            "is_approved": is_approved
        })
        
        return {
            "success": True,
            "reminder_id": reminder_id,
            "reviewed_by": reviewed_by,
            "is_approved": is_approved,
            "record_new_status": record.status.value if record else None
        }

    def calculate_roll_period_estimate(self, ship_id: str, calculated_by: str) -> dict:
        ship_records = [
            r for r in self.sampling_records
            if r.ship_id == ship_id and r.status in [RecordStatus.NORMAL, RecordStatus.CONFIRMED]
        ]
        
        estimate = RollPeriodEstimate(
            estimate_id=str(uuid.uuid4()),
            ship_id=ship_id,
            sampling_records=[r.record_id for r in ship_records]
        )
        estimate.calculate(ship_records)
        estimate.calculated_by = calculated_by
        
        self.estimates.append(estimate)
        
        self._log_action("计算横摇周期", {
            "ship_id": ship_id,
            "records_used": len(ship_records)
        })
        
        return {
            "estimate_id": estimate.estimate_id,
            "ship_id": ship_id,
            "average_period": round(estimate.average_period, 4),
            "period_variance": round(estimate.period_variance, 6),
            "records_used": len(ship_records),
            "calculated_time": estimate.calculated_time.isoformat() if estimate.calculated_time else None
        }

    def export_record(self, record_id: str) -> dict:
        record = next((r for r in self.sampling_records if r.record_id == record_id), None)
        if not record:
            return {"success": False, "message": "记录不存在"}
        
        export_data = record.to_dict()
        export_id = f"export_{record_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}"
        
        is_issue, msg = self.self_checker.check_export_consistency(record, export_data, export_id)
        
        self._log_action("导出记录", {
            "record_id": record_id,
            "export_id": export_id,
            "consistent": not is_issue
        })
        
        return {
            "success": True,
            "export_id": export_id,
            "record_id": record_id,
            "data": export_data,
            "consistency_check": msg
        }

    def get_history(self, record_id: Optional[str] = None) -> List[dict]:
        if record_id:
            return [log for log in self.history_log if log.get("record_id") == record_id]
        return self.history_log.copy()

    def _log_action(self, action: str, details: dict):
        self.history_log.append({
            "timestamp": datetime.now().isoformat(),
            "action": action,
            "details": details
        })

    def get_dashboard(self) -> dict:
        return {
            "总采样记录数": len(self.sampling_records),
            "正常记录数": sum(1 for r in self.sampling_records if r.status == RecordStatus.NORMAL),
            "冲突待确认数": sum(1 for r in self.sampling_records if r.status == RecordStatus.CONFLICT),
            "待安全员复核数": sum(1 for r in self.sampling_records if r.status == RecordStatus.PENDING_REVIEW),
            "已驳回数": sum(1 for r in self.sampling_records if r.status == RecordStatus.REJECTED),
            "温度校准记录数": len(self.calibration_records),
            "待处理安全提醒数": sum(1 for r in self.safety_reminders if not r.reviewed),
            "自检报告": self.self_checker.get_check_summary()
        }
