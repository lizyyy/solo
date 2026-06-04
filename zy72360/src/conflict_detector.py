from datetime import datetime
from typing import List, Optional, Tuple
from .models import SamplingRecord, TemperatureCalibration, ConflictEvidence, RecordStatus
import uuid


class ConflictDetector:
    def __init__(self):
        self.conflicts: List[ConflictEvidence] = []
        self.tolerance: float = 0.001

    def check_sampling_interval_conflict(
        self,
        sampling_record: SamplingRecord,
        calibrations: List[TemperatureCalibration]
    ) -> Optional[ConflictEvidence]:
        relevant_calibrations = [
            cal for cal in calibrations
            if cal.ship_id == sampling_record.ship_id
            and cal.sensor_id == sampling_record.sensor_id
            and cal.calibration_time <= sampling_record.sampling_end_time
        ]
        
        if not relevant_calibrations:
            return None
        
        latest_cal = max(relevant_calibrations, key=lambda c: c.calibration_time)
        
        interval_diff = abs(sampling_record.sampling_interval - latest_cal.effective_sampling_interval)
        
        if interval_diff > self.tolerance:
            conflict = ConflictEvidence(
                conflict_id=str(uuid.uuid4()),
                sampling_record_id=sampling_record.record_id,
                calibration_id=latest_cal.calibration_id,
                conflict_type="采样间隔与温度校准冲突",
                description=f"采样记录声明的间隔({sampling_record.sampling_interval}s)与温度校准后的有效间隔({latest_cal.effective_sampling_interval}s)不一致",
                sampling_value=sampling_record.sampling_interval,
                calibration_value=latest_cal.effective_sampling_interval,
                discovered_time=datetime.now()
            )
            self.conflicts.append(conflict)
            sampling_record.status = RecordStatus.CONFLICT
            sampling_record.remarks += f"发现与校准记录[{latest_cal.calibration_id}]冲突；"
            return conflict
        
        return None

    def list_conflicts(self, record_id: Optional[str] = None) -> List[ConflictEvidence]:
        if record_id:
            return [c for c in self.conflicts if c.sampling_record_id == record_id]
        return self.conflicts

    def resolve_conflict(
        self,
        conflict_id: str,
        resolution: str,
        resolved_by: str
    ) -> bool:
        for conflict in self.conflicts:
            if conflict.conflict_id == conflict_id:
                conflict.resolved = True
                conflict.resolution = resolution
                conflict.resolved_by = resolved_by
                conflict.resolved_time = datetime.now()
                return True
        return False

    def get_conflict_summary(self) -> List[dict]:
        return [
            {
                "conflict_id": c.conflict_id,
                "record_id": c.sampling_record_id,
                "type": c.conflict_type,
                "description": c.description,
                "status": "已解决" if c.resolved else "待处理",
                "resolution": c.resolution
            }
            for c in self.conflicts
        ]
