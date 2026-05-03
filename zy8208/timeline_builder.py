from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from collections import defaultdict
import uuid

from models import (
    SensorReading, ManualRecord, TimelineEvent, 
    TankStatus, RiskIssue, RiskLevel, RiskType, VoyagePlan, ZoneRule
)
from config import TIMEZONES


class TimelineBuilder:
    SENSOR_GAP_THRESHOLD_HOURS = 6
    VOLUME_CHANGE_THRESHOLD = 100
    
    def __init__(self):
        self.tank_statuses: Dict[str, TankStatus] = {}
        self.all_events: List[TimelineEvent] = []
    
    def build_timeline(
        self,
        sensor_readings: List[SensorReading],
        manual_records: List[ManualRecord],
        voyage_plan: Optional[VoyagePlan] = None
    ) -> Dict[str, TankStatus]:
        readings_by_tank = self._group_by_tank(sensor_readings)
        records_by_tank = self._group_by_tank(manual_records)
        
        all_tanks = set(readings_by_tank.keys()).union(set(records_by_tank.keys()))
        
        for tank_id in all_tanks:
            tank_readings = readings_by_tank.get(tank_id, [])
            tank_records = records_by_tank.get(tank_id, [])
            
            tank_status = self._build_tank_timeline(tank_id, tank_readings, tank_records, voyage_plan)
            self.tank_statuses[tank_id] = tank_status
        
        return self.tank_statuses
    
    def _group_by_tank(self, items: List[Any]) -> Dict[str, List[Any]]:
        result = defaultdict(list)
        for item in items:
            if hasattr(item, 'tank_id'):
                result[item.tank_id].append(item)
        return dict(result)
    
    def _build_tank_timeline(
        self,
        tank_id: str,
        readings: List[SensorReading],
        records: List[ManualRecord],
        voyage_plan: Optional[VoyagePlan]
    ) -> TankStatus:
        events = []
        
        readings.sort(key=lambda x: x.timestamp)
        records.sort(key=lambda x: x.timestamp)
        
        reading_idx = 0
        record_idx = 0
        
        prev_volume = None
        prev_time = None
        last_status = "normal"
        
        while reading_idx < len(readings) or record_idx < len(records):
            next_reading = readings[reading_idx] if reading_idx < len(readings) else None
            next_record = records[record_idx] if record_idx < len(records) else None
            
            if next_reading and next_record:
                if next_reading.timestamp <= next_record.timestamp:
                    event = self._create_sensor_event(tank_id, next_reading, prev_volume, prev_time)
                    if event:
                        events.append(event)
                        prev_volume = next_reading.volume
                        prev_time = next_reading.timestamp
                        last_status = next_reading.status
                    reading_idx += 1
                else:
                    event = self._create_manual_event(tank_id, next_record, prev_volume)
                    if event:
                        events.append(event)
                    record_idx += 1
            elif next_reading:
                event = self._create_sensor_event(tank_id, next_reading, prev_volume, prev_time)
                if event:
                    events.append(event)
                    prev_volume = next_reading.volume
                    prev_time = next_reading.timestamp
                    last_status = next_reading.status
                reading_idx += 1
            elif next_record:
                event = self._create_manual_event(tank_id, next_record, prev_volume)
                if event:
                    events.append(event)
                record_idx += 1
        
        gap_events = self._detect_sensor_gaps(tank_id, readings)
        events.extend(gap_events)
        
        events.sort(key=lambda x: x.timestamp)
        
        current_volume = events[-1].volume_after if events else 0.0
        last_update = events[-1].timestamp if events else datetime.now()
        
        tank_status = TankStatus(
            tank_id=tank_id,
            current_volume=current_volume,
            max_volume=10000.0,
            last_update=last_update,
            status=last_status,
            history=events
        )
        
        self.all_events.extend(events)
        return tank_status
    
    def _create_sensor_event(
        self,
        tank_id: str,
        reading: SensorReading,
        prev_volume: Optional[float],
        prev_time: Optional[datetime]
    ) -> Optional[TimelineEvent]:
        volume_change = 0.0
        if prev_volume is not None:
            volume_change = reading.volume - prev_volume
        
        event_type = "STATUS_UPDATE"
        if abs(volume_change) > self.VOLUME_CHANGE_THRESHOLD:
            if volume_change < 0:
                event_type = "DISCHARGE"
            else:
                event_type = "FILL"
        
        details = {
            "level": reading.level,
            "temperature": reading.temperature,
            "density": reading.density,
            "sensor_status": reading.status,
            "source": "sensor"
        }
        
        return TimelineEvent(
            event_id=str(uuid.uuid4())[:8],
            timestamp=reading.timestamp,
            tank_id=tank_id,
            event_type=event_type,
            volume_change=volume_change,
            volume_before=prev_volume if prev_volume is not None else reading.volume,
            volume_after=reading.volume,
            source="SENSOR",
            details=details,
            timezone=reading.timezone
        )
    
    def _create_manual_event(
        self,
        tank_id: str,
        record: ManualRecord,
        prev_volume: Optional[float]
    ) -> Optional[TimelineEvent]:
        event_type = "MANUAL_RECORD"
        if record.operation_type == "DISCHARGE_START":
            event_type = "DISCHARGE_START"
        elif record.operation_type == "DISCHARGE_STOP":
            event_type = "DISCHARGE_STOP"
        elif record.operation_type == "FILL_START":
            event_type = "FILL_START"
        elif record.operation_type == "FILL_STOP":
            event_type = "FILL_STOP"
        
        volume_change = 0.0
        volume_after = record.volume
        
        details = {
            "operator": record.operator,
            "pump_status": record.pump_status,
            "valve_status": record.valve_status,
            "notes": record.notes,
            "record_id": record.record_id,
            "source": "manual"
        }
        
        return TimelineEvent(
            event_id=str(uuid.uuid4())[:8],
            timestamp=record.timestamp,
            tank_id=tank_id,
            event_type=event_type,
            volume_change=volume_change,
            volume_before=prev_volume if prev_volume is not None else volume_after,
            volume_after=volume_after,
            source="MANUAL",
            details=details,
            timezone=record.timezone
        )
    
    def _detect_sensor_gaps(
        self,
        tank_id: str,
        readings: List[SensorReading]
    ) -> List[TimelineEvent]:
        gap_events = []
        
        if len(readings) < 2:
            return gap_events
        
        for i in range(1, len(readings)):
            prev_reading = readings[i-1]
            curr_reading = readings[i]
            
            time_diff = curr_reading.timestamp - prev_reading.timestamp
            gap_hours = time_diff.total_seconds() / 3600
            
            if gap_hours > self.SENSOR_GAP_THRESHOLD_HOURS:
                details = {
                    "gap_duration_hours": gap_hours,
                    "last_reading_time": prev_reading.timestamp.isoformat(),
                    "next_reading_time": curr_reading.timestamp.isoformat(),
                    "last_volume": prev_reading.volume,
                    "next_volume": curr_reading.volume
                }
                
                event = TimelineEvent(
                    event_id=str(uuid.uuid4())[:8],
                    timestamp=prev_reading.timestamp,
                    tank_id=tank_id,
                    event_type="SENSOR_GAP",
                    volume_change=curr_reading.volume - prev_reading.volume,
                    volume_before=prev_reading.volume,
                    volume_after=curr_reading.volume,
                    source="SYSTEM",
                    details=details,
                    timezone=prev_reading.timezone
                )
                gap_events.append(event)
        
        return gap_events
    
    def get_timeline_by_tank(self, tank_id: str) -> List[TimelineEvent]:
        if tank_id in self.tank_statuses:
            return self.tank_statuses[tank_id].history
        return []
    
    def get_all_events(self) -> List[TimelineEvent]:
        return sorted(self.all_events, key=lambda x: x.timestamp)
    
    def detect_missing_sensors(self, expected_tanks: List[str]) -> List[str]:
        missing_tanks = []
        for tank in expected_tanks:
            if tank not in self.tank_statuses:
                missing_tanks.append(tank)
            elif len(self.tank_statuses[tank].history) == 0:
                missing_tanks.append(tank)
        return missing_tanks
