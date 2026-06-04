from typing import List, Tuple, Dict
from collections import defaultdict
from models import SensorRecord, SensorStatus
import uuid


class SensorRestartDetector:
    def __init__(self):
        pass

    def detect_restarts(
        self, records: List[SensorRecord]
    ) -> Tuple[List[SensorRecord], List[Dict]]:
        if not records:
            return records, []

        sorted_records = sorted(records, key=lambda r: r.timestamp)
        sensor_groups = defaultdict(list)

        for record in sorted_records:
            sensor_groups[record.sensor_id].append(record)

        restart_events = []

        for sensor_id, sensor_records in sensor_groups.items():
            sorted_sensor = sorted(sensor_records, key=lambda r: r.timestamp)

            for i in range(1, len(sorted_sensor)):
                prev = sorted_sensor[i - 1]
                curr = sorted_sensor[i]

                if curr.sensor_number != prev.sensor_number:
                    time_diff = (curr.timestamp - prev.timestamp).total_seconds()

                    if time_diff < 3600:
                        event_id = str(uuid.uuid4())
                        restart_event = {
                            "event_id": event_id,
                            "sensor_id": sensor_id,
                            "prev_number": prev.sensor_number,
                            "new_number": curr.sensor_number,
                            "prev_record_id": prev.id,
                            "new_record_id": curr.id,
                            "timestamp": curr.timestamp,
                            "time_gap_seconds": time_diff,
                        }
                        restart_events.append(restart_event)

                        for record in records:
                            if record.id == curr.id:
                                record.status = SensorStatus.RESTART_DETECTED
                                record.is_restart_marker = True
                                record.original_sensor_number = prev.sensor_number
                                record.restart_reason = (
                                    f"传感器编号从 {prev.sensor_number} 变为 {curr.sensor_number}"
                                )
                                break

        return records, restart_events

    def analyze_patterns(self, restart_events: List[Dict]) -> Dict:
        if not restart_events:
            return {"total_restarts": 0, "sensor_affected": 0, "pattern": "normal"}

        sensor_affected = len(set(e["sensor_id"] for e in restart_events))
        avg_time_gap = sum(e["time_gap_seconds"] for e in restart_events) / len(
            restart_events
        )

        pattern = "normal"
        if len(restart_events) >= 3:
            pattern = "frequent_restarts"
        elif avg_time_gap < 300:
            pattern = "short_interval_restarts"

        return {
            "total_restarts": len(restart_events),
            "sensor_affected": sensor_affected,
            "avg_time_gap_seconds": round(avg_time_gap, 2),
            "pattern": pattern,
        }


detector = SensorRestartDetector()
