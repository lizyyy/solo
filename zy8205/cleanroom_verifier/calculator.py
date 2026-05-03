from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from collections import defaultdict
from .parser import Room, PressureReading, AirflowSetpoint, DoorEvent


INH2O_TO_PA = 248.84


@dataclass
class PressureGradient:
    room_id: str
    adjacent_room_id: str
    measured_diff: float
    required_diff: float
    unit: str = "Pa"
    is_valid: bool = True
    timestamp: Optional[datetime] = None


@dataclass
class ACHResult:
    room_id: str
    ach: float
    required_ach: float
    supply_air: float
    volume: float
    is_valid: bool = True


@dataclass
class DoorImpact:
    room_id: str
    adjacent_room_id: str
    event_timestamp: datetime
    duration: float
    pressure_before: float
    pressure_after: float
    pressure_impact: float
    is_transient: bool = False


class Calculator:
    def __init__(self):
        self.pressure_gradients: List[PressureGradient] = []
        self.ach_results: List[ACHResult] = []
        self.door_impacts: List[DoorImpact] = []

    def convert_to_pa(self, value: float, unit: str) -> float:
        if unit.lower() in ['inh2o', 'in h2o', 'in.wc']:
            return value * INH2O_TO_PA
        return value

    def convert_to_inh2o(self, value: float, unit: str) -> float:
        if unit.lower() in ['pa', 'pascal']:
            return value / INH2O_TO_PA
        return value

    def normalize_pressure(self, readings: List[PressureReading], target_unit: str = "Pa") -> List[PressureReading]:
        normalized = []
        for reading in readings:
            if target_unit.lower() == "pa":
                new_pressure = self.convert_to_pa(reading.pressure, reading.unit)
            else:
                new_pressure = self.convert_to_inh2o(reading.pressure, reading.unit)
            normalized.append(PressureReading(
                timestamp=reading.timestamp,
                room_id=reading.room_id,
                pressure=new_pressure,
                unit=target_unit,
                is_valid=reading.is_valid
            ))
        return normalized

    def get_latest_pressure_by_room(self, readings: List[PressureReading]) -> Dict[str, Tuple[float, datetime]]:
        latest_readings: Dict[str, Tuple[float, datetime]] = {}
        for reading in readings:
            if not reading.is_valid:
                continue
            if reading.room_id not in latest_readings:
                latest_readings[reading.room_id] = (reading.pressure, reading.timestamp)
            else:
                existing_p, existing_ts = latest_readings[reading.room_id]
                if reading.timestamp > existing_ts:
                    latest_readings[reading.room_id] = (reading.pressure, reading.timestamp)
        return latest_readings

    def calculate_pressure_gradients(
        self,
        rooms: Dict[str, Room],
        pressure_readings: List[PressureReading],
        target_unit: str = "Pa"
    ) -> List[PressureGradient]:
        normalized_readings = self.normalize_pressure(pressure_readings, target_unit)
        latest_pressures = self.get_latest_pressure_by_room(normalized_readings)
        
        gradients = []
        
        for room_id, room in rooms.items():
            for adjacent_id in room.adjacent_rooms:
                if adjacent_id not in rooms:
                    continue
                
                room_pressure = latest_pressures.get(room_id)
                adjacent_pressure = latest_pressures.get(adjacent_id)
                
                if room_pressure is None or adjacent_pressure is None:
                    gradients.append(PressureGradient(
                        room_id=room_id,
                        adjacent_room_id=adjacent_id,
                        measured_diff=0.0,
                        required_diff=room.required_pressure_diff,
                        unit=target_unit,
                        is_valid=False,
                        timestamp=None
                    ))
                    continue
                
                measured_diff = room_pressure[0] - adjacent_pressure[0]
                
                gradients.append(PressureGradient(
                    room_id=room_id,
                    adjacent_room_id=adjacent_id,
                    measured_diff=measured_diff,
                    required_diff=room.required_pressure_diff,
                    unit=target_unit,
                    is_valid=True,
                    timestamp=room_pressure[1]
                ))
        
        self.pressure_gradients = gradients
        return gradients

    def calculate_ach(
        self,
        rooms: Dict[str, Room],
        airflow_setpoints: Dict[str, AirflowSetpoint]
    ) -> List[ACHResult]:
        results = []
        
        for room_id, room in rooms.items():
            setpoint = airflow_setpoints.get(room_id)
            
            if setpoint is None:
                results.append(ACHResult(
                    room_id=room_id,
                    ach=0.0,
                    required_ach=room.required_ach,
                    supply_air=0.0,
                    volume=room.volume,
                    is_valid=False
                ))
                continue
            
            if room.volume <= 0:
                results.append(ACHResult(
                    room_id=room_id,
                    ach=0.0,
                    required_ach=room.required_ach,
                    supply_air=setpoint.supply_air,
                    volume=room.volume,
                    is_valid=False
                ))
                continue
            
            ach = (setpoint.supply_air / room.volume)
            
            results.append(ACHResult(
                room_id=room_id,
                ach=ach,
                required_ach=room.required_ach,
                supply_air=setpoint.supply_air,
                volume=room.volume,
                is_valid=True
            ))
        
        self.ach_results = results
        return results

    def analyze_door_impacts(
        self,
        rooms: Dict[str, Room],
        pressure_readings: List[PressureReading],
        door_events: List[DoorEvent],
        window_before: int = 30,
        window_after: int = 60,
        transient_threshold: float = 5.0
    ) -> List[DoorImpact]:
        normalized_readings = self.normalize_pressure(pressure_readings, "Pa")
        
        readings_by_room: Dict[str, List[PressureReading]] = defaultdict(list)
        for reading in normalized_readings:
            readings_by_room[reading.room_id].append(reading)
        
        for room_id in readings_by_room:
            readings_by_room[room_id].sort(key=lambda x: x.timestamp)
        
        impacts = []
        
        for event in door_events:
            if event.event_type.lower() not in ['open', 'opened', 'door_open']:
                continue
            
            room_id = event.room_id
            if room_id not in rooms:
                continue
            
            room = rooms[room_id]
            
            for adjacent_id in room.adjacent_rooms:
                if adjacent_id not in readings_by_room:
                    continue
                
                room_readings = readings_by_room.get(room_id, [])
                adjacent_readings = readings_by_room.get(adjacent_id, [])
                
                pressure_before = self._get_average_pressure_in_window(
                    room_readings,
                    event.timestamp - timedelta(seconds=window_before),
                    event.timestamp
                )
                
                pressure_after = self._get_average_pressure_in_window(
                    room_readings,
                    event.timestamp + timedelta(seconds=event.duration if event.duration else 5),
                    event.timestamp + timedelta(seconds=(event.duration if event.duration else 5) + window_after)
                )
                
                if pressure_before is not None and pressure_after is not None:
                    impact = abs(pressure_after - pressure_before)
                    is_transient = impact < transient_threshold
                    
                    impacts.append(DoorImpact(
                        room_id=room_id,
                        adjacent_room_id=adjacent_id,
                        event_timestamp=event.timestamp,
                        duration=event.duration if event.duration else 0,
                        pressure_before=pressure_before,
                        pressure_after=pressure_after,
                        pressure_impact=impact,
                        is_transient=is_transient
                    ))
        
        self.door_impacts = impacts
        return impacts

    def _get_average_pressure_in_window(
        self,
        readings: List[PressureReading],
        start_time: datetime,
        end_time: datetime
    ) -> Optional[float]:
        in_window = [
            r.pressure for r in readings
            if r.is_valid and start_time <= r.timestamp <= end_time
        ]
        
        if not in_window:
            return None
        
        return sum(in_window) / len(in_window)

    def calculate_all(
        self,
        rooms: Dict[str, Room],
        pressure_readings: List[PressureReading],
        airflow_setpoints: Dict[str, AirflowSetpoint],
        door_events: List[DoorEvent]
    ) -> Dict[str, List]:
        return {
            'pressure_gradients': self.calculate_pressure_gradients(rooms, pressure_readings),
            'ach_results': self.calculate_ach(rooms, airflow_setpoints),
            'door_impacts': self.analyze_door_impacts(rooms, pressure_readings, door_events)
        }
