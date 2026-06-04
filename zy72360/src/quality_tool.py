from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional, Dict
from enum import Enum
import uuid
import hashlib
import json


class RecordStatus(Enum):
    NORMAL = "正常"
    CONFLICT = "冲突待确认"
    REJECTED = "已驳回"
    CONFIRMED = "已确认"
    PENDING_REVIEW = "待安全员复核"


@dataclass
class SamplingRecord:
    record_id: str
    ship_id: str
    sensor_id: str
    sampling_interval: float
    sampling_start_time: datetime
    sampling_end_time: datetime
    roll_periods: List[float]
    import_time: datetime
    import_user: str
    status: RecordStatus = RecordStatus.NORMAL
    previous_sensor_id: Optional[str] = None
    is_supplementary: bool = False
    remarks: str = ""

    def to_dict(self) -> Dict:
        return {
            "record_id": self.record_id,
            "ship_id": self.ship_id,
            "sensor_id": self.sensor_id,
            "sampling_interval": self.sampling_interval,
            "status": self.status.value,
            "remarks": self.remarks
        }


@dataclass
class TemperatureCalibration:
    calibration_id: str
    ship_id: str
    sensor_id: str
    calibration_time: datetime
    effective_sampling_interval: float
    calibration_temperature: float
    operator: str


@dataclass
class ConflictEvidence:
    conflict_id: str
    sampling_record_id: str
    calibration_id: str
    description: str
    sampling_value: float
    calibration_value: float
    resolved: bool = False
    resolution: Optional[str] = None


@dataclass
class SafetyReminder:
    reminder_id: str
    related_record_id: str
    level: str
    title: str
    content: str
    reviewed: bool = False


class QualityWorkflow:
    def __init__(self):
        self.sampling_records: List[SamplingRecord] = []
        self.calibration_records: List[TemperatureCalibration] = []
        self.safety_reminders: List[SafetyReminder] = []
        self.conflicts: List[ConflictEvidence] = []
        self.imported_ids: set = set()
        self.sensor_history: Dict[str, list] = {}
        self.history_log: List[dict] = []

    def _log(self, action, details):
        self.history_log.append({
            "timestamp": datetime.now().isoformat(),
            "action": action,
            "details": details
        })

    def _check_conflict(self, record):
        relevant = [c for c in self.calibration_records 
                    if c.ship_id == record.ship_id 
                    and c.sensor_id == record.sensor_id
                    and c.calibration_time <= record.sampling_end_time]
        if not relevant:
            return None
        latest = max(relevant, key=lambda c: c.calibration_time)
        diff = abs(record.sampling_interval - latest.effective_sampling_interval)
        if diff > 0.001:
            conflict = ConflictEvidence(
                conflict_id=str(uuid.uuid4()),
                sampling_record_id=record.record_id,
                calibration_id=latest.calibration_id,
                description=f"采样间隔({record.sampling_interval}s)与校准有效间隔({latest.effective_sampling_interval}s)不一致",
                sampling_value=record.sampling_interval,
                calibration_value=latest.effective_sampling_interval
            )
            self.conflicts.append(conflict)
            record.status = RecordStatus.CONFLICT
            record.remarks += f"与校准[{latest.calibration_id}]冲突；"
            return conflict
        return None

    def step1_import_sampling(self, data):
        record = SamplingRecord(
            record_id=data["record_id"],
            ship_id=data["ship_id"],
            sensor_id=data["sensor_id"],
            sampling_interval=data["sampling_interval"],
            sampling_start_time=datetime.fromisoformat(data["sampling_start_time"]),
            sampling_end_time=datetime.fromisoformat(data["sampling_end_time"]),
            roll_periods=data["roll_periods"],
            import_time=datetime.now(),
            import_user=data.get("import_user", "system"),
            is_supplementary=data.get("is_supplementary", False)
        )
        
        issues = []
        
        if record.record_id in self.imported_ids:
            issues.append(f"重复导入: 记录ID [{record.record_id}] 已存在")
        else:
            self.imported_ids.add(record.record_id)
        
        key = record.ship_id
        if key not in self.sensor_history:
            self.sensor_history[key] = []
        history = self.sensor_history[key]
        if history:
            last_id, last_time = history[-1]
            if last_id != record.sensor_id and record.sampling_start_time > last_time:
                record.previous_sensor_id = last_id
                record.status = RecordStatus.PENDING_REVIEW
                issues.append(f"传感器编号从[{last_id}]变为[{record.sensor_id}]，疑似重启")
        history.append((record.sensor_id, record.sampling_start_time))
        
        conflict = self._check_conflict(record)
        self.sampling_records.append(record)
        self._log("导入采样记录", {"record_id": record.record_id, "issues": issues})
        
        return {
            "step": 1,
            "record_id": record.record_id,
            "status": record.status.value,
            "check_issues": issues,
            "conflict_found": conflict is not None,
            "conflict_details": conflict.description if conflict else None,
            "needs_attention": record.status in [RecordStatus.CONFLICT, RecordStatus.PENDING_REVIEW]
        }

    def step2_import_calibration(self, data):
        cal = TemperatureCalibration(
            calibration_id=data["calibration_id"],
            ship_id=data["ship_id"],
            sensor_id=data["sensor_id"],
            calibration_time=datetime.fromisoformat(data["calibration_time"]),
            effective_sampling_interval=data["effective_sampling_interval"],
            calibration_temperature=data["calibration_temperature"],
            operator=data.get("operator", "system")
        )
        self.calibration_records.append(cal)
        
        conflicts = []
        for rec in self.sampling_records:
            if (rec.ship_id == cal.ship_id 
                and rec.sensor_id == cal.sensor_id 
                and rec.status == RecordStatus.NORMAL):
                c = self._check_conflict(rec)
                if c:
                    conflicts.append({
                        "record_id": rec.record_id,
                        "conflict_id": c.conflict_id,
                        "description": c.description
                    })
        
        self._log("导入校准记录", {"calibration_id": cal.calibration_id, "new_conflicts": len(conflicts)})
        
        return {
            "step": 2,
            "calibration_id": cal.calibration_id,
            "new_conflicts_found": len(conflicts),
            "conflicts": conflicts,
            "message": f"发现{len(conflicts)}条冲突，请质检员确认"
        }

    def resolve_conflict(self, conflict_id, resolution, resolved_by):
        conflict = next((c for c in self.conflicts if c.conflict_id == conflict_id), None)
        if not conflict:
            return {"success": False, "message": "冲突不存在"}
        
        conflict.resolved = True
        conflict.resolution = resolution
        
        record = next((r for r in self.sampling_records if r.record_id == conflict.sampling_record_id), None)
        if record:
            if "确认" in resolution:
                record.status = RecordStatus.CONFIRMED
            elif "驳回" in resolution:
                record.status = RecordStatus.REJECTED
        
        self._log("冲突处理", {"conflict_id": conflict_id, "resolution": resolution})
        return {"success": True, "record_new_status": record.status.value if record else None}

    def step3_update_safety_reminders(self, operator):
        count = 0
        for rec in self.sampling_records:
            if rec.status == RecordStatus.PENDING_REVIEW:
                if not any(r.related_record_id == rec.record_id for r in self.safety_reminders):
                    self.safety_reminders.append(SafetyReminder(
                        reminder_id=str(uuid.uuid4()),
                        related_record_id=rec.record_id,
                        level="高",
                        title="传感器编号变更待复核",
                        content=f"船舶[{rec.ship_id}]传感器从[{rec.previous_sensor_id}]变[{rec.sensor_id}]，请安全员复核"
                    ))
                    count += 1
        
        for c in self.conflicts:
            if not c.resolved:
                if not any(r.related_record_id == c.sampling_record_id for r in self.safety_reminders):
                    self.safety_reminders.append(SafetyReminder(
                        reminder_id=str(uuid.uuid4()),
                        related_record_id=c.sampling_record_id,
                        level="中",
                        title="采样间隔冲突待确认",
                        content=c.description
                    ))
                    count += 1
        
        self._log("更新安全提醒", {"operator": operator, "new_count": count})
        pending = sum(1 for r in self.safety_reminders if not r.reviewed)
        
        return {
            "step": 3,
            "new_reminders_added": count,
            "total_pending_reminders": pending,
            "reminders": [{"id": r.reminder_id, "level": r.level, "title": r.title, "reviewed": r.reviewed} for r in self.safety_reminders]
        }

    def review_reminder(self, reminder_id, reviewed_by, is_approved):
        rem = next((r for r in self.safety_reminders if r.reminder_id == reminder_id), None)
        if not rem:
            return {"success": False}
        rem.reviewed = True
        record = next((r for r in self.sampling_records if r.record_id == rem.related_record_id), None)
        if record and is_approved and record.status == RecordStatus.PENDING_REVIEW:
            record.status = RecordStatus.NORMAL
        self._log("安全员复核", {"reminder_id": reminder_id, "approved": is_approved})
        return {"success": True, "record_new_status": record.status.value if record else None}

    def calculate_estimate(self, ship_id):
        valid = [r for r in self.sampling_records if r.ship_id == ship_id and r.status in [RecordStatus.NORMAL, RecordStatus.CONFIRMED]]
        periods = []
        for r in valid:
            periods.extend(r.roll_periods)
        if periods:
            avg = sum(periods) / len(periods)
            var = sum((p - avg) ** 2 for p in periods) / len(periods)
        else:
            avg = 0
            var = 0
        self._log("计算周期", {"ship_id": ship_id, "records_used": len(valid)})
        return {
            "ship_id": ship_id,
            "average_period": round(avg, 4),
            "period_variance": round(var, 6),
            "records_used": len(valid)
        }

    def get_dashboard(self):
        return {
            "总记录数": len(self.sampling_records),
            "正常记录": sum(1 for r in self.sampling_records if r.status == RecordStatus.NORMAL),
            "冲突待确认": sum(1 for r in self.sampling_records if r.status == RecordStatus.CONFLICT),
            "待安全员复核": sum(1 for r in self.sampling_records if r.status == RecordStatus.PENDING_REVIEW),
            "已驳回": sum(1 for r in self.sampling_records if r.status == RecordStatus.REJECTED),
            "校准记录数": len(self.calibration_records),
            "待处理提醒": sum(1 for r in self.safety_reminders if not r.reviewed)
        }

    def get_conflicts(self):
        return [{"conflict_id": c.conflict_id, "record_id": c.sampling_record_id, "description": c.description, "resolved": c.resolved} for c in self.conflicts]
