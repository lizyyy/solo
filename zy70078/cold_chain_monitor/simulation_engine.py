from typing import List, Dict, Tuple, Optional
from datetime import datetime, timedelta
import random
from .models import (
    Route, Segment, Stop, Order,
    SensorReading, SimulationConfig
)


class SimulationEngine:
    def __init__(self, config: Optional[SimulationConfig] = None):
        self.config = config or SimulationConfig()
        random.seed(self.config.random_seed)

    def run_simulation(
        self,
        route: Route,
        sensor_readings: List[SensorReading]
    ) -> Tuple[Dict[str, List[Dict]], Dict[str, Dict]]:
        compartment_readings = self._group_by_compartment(sensor_readings)
        segment_results = {}
        compartment_profiles = {}

        for compartment in route.compartments:
            readings = compartment_readings.get(compartment, [])
            profile = self._build_compartment_profile(compartment, readings)
            compartment_profiles[compartment] = profile

        for segment in route.segments:
            seg_result = self._simulate_segment(
                segment,
                route,
                compartment_profiles.get(segment.compartment, {})
            )
            segment_results[segment.segment_id] = seg_result

        return segment_results, compartment_profiles

    def _group_by_compartment(
        self,
        readings: List[SensorReading]
    ) -> Dict[str, List[SensorReading]]:
        result = {}
        for r in readings:
            if r.compartment not in result:
                result[r.compartment] = []
            result[r.compartment].append(r)
        
        for compartment in result:
            result[compartment].sort(key=lambda x: x.timestamp)
        
        return result

    def _build_compartment_profile(
        self,
        compartment: str,
        readings: List[SensorReading]
    ) -> Dict:
        if not readings:
            return {
                'base_temp': 2.0,
                'readings': [],
                'missing_periods': [],
                'has_valid_data': False
            }

        valid_temps = [r.temperature for r in readings if not r.is_missing and r.temperature is not None]
        base_temp = sum(valid_temps) / len(valid_temps) if valid_temps else 2.0

        missing_periods = self._detect_missing_periods(readings)

        return {
            'base_temp': base_temp,
            'readings': readings,
            'missing_periods': missing_periods,
            'has_valid_data': len(valid_temps) > 0
        }

    def _detect_missing_periods(
        self,
        readings: List[SensorReading]
    ) -> List[Dict]:
        periods = []
        if not readings:
            return periods

        sorted_readings = sorted(readings, key=lambda x: x.timestamp)
        current_start = None

        for i, reading in enumerate(sorted_readings):
            if reading.is_missing or reading.temperature is None:
                if current_start is None:
                    current_start = reading.timestamp
            else:
                if current_start is not None:
                    duration = (reading.timestamp - current_start).total_seconds() / 60
                    periods.append({
                        'start': current_start,
                        'end': reading.timestamp,
                        'duration_min': duration
                    })
                    current_start = None

        if current_start is not None:
            last_reading = sorted_readings[-1]
            duration = (last_reading.timestamp - current_start).total_seconds() / 60
            periods.append({
                'start': current_start,
                'end': last_reading.timestamp,
                'duration_min': duration
            })

        prev_time = None
        for reading in sorted_readings:
            if prev_time is not None:
                gap = (reading.timestamp - prev_time).total_seconds() / 60
                if gap > 15:
                    periods.append({
                        'start': prev_time,
                        'end': reading.timestamp,
                        'duration_min': gap,
                        'type': 'time_gap'
                    })
            prev_time = reading.timestamp

        return periods

    def _simulate_segment(
        self,
        segment: Segment,
        route: Route,
        compartment_profile: Dict
    ) -> Dict:
        from_stop = next((s for s in route.stops if s.stop_id == segment.from_stop), None)
        to_stop = next((s for s in route.stops if s.stop_id == segment.to_stop), None)

        base_temp = compartment_profile.get('base_temp', 2.0)
        segment_duration = (segment.end_time - segment.start_time).total_seconds() / 60

        simulated_temps = []
        events = []
        current_temp = base_temp

        step_minutes = 1
        current_time = segment.start_time

        while current_time < segment.end_time:
            drift = self._calculate_drift(current_time, segment, from_stop, to_stop, route)
            
            current_temp += drift * (step_minutes / 60.0)
            current_temp = self._apply_bounds(current_temp)

            simulated_temps.append({
                'timestamp': current_time,
                'temperature': round(current_temp, 2)
            })

            if drift != 0:
                if drift > 0 and len(events) == 0 or events[-1].get('type') != 'warming':
                    if from_stop and from_stop.is_door_open:
                        events.append({
                            'time': current_time,
                            'type': 'door_open_warming',
                            'description': f'车门开启导致升温'
                        })
                    else:
                        events.append({
                            'time': current_time,
                            'type': 'drift_warming',
                            'description': '温度漂移导致升温'
                        })

            current_time += timedelta(minutes=step_minutes)

        missing_in_segment = self._check_missing_in_segment(
            segment,
            compartment_profile.get('missing_periods', [])
        )

        return {
            'segment_id': segment.segment_id,
            'compartment': segment.compartment,
            'from_stop': segment.from_stop,
            'to_stop': segment.to_stop,
            'start_time': segment.start_time,
            'end_time': segment.end_time,
            'duration_min': segment_duration,
            'base_temp': base_temp,
            'final_temp': current_temp,
            'max_temp': max([t['temperature'] for t in simulated_temps]) if simulated_temps else base_temp,
            'min_temp': min([t['temperature'] for t in simulated_temps]) if simulated_temps else base_temp,
            'simulated_temps': simulated_temps,
            'events': events,
            'missing_periods': missing_in_segment
        }

    def _calculate_drift(
        self,
        current_time: datetime,
        segment: Segment,
        from_stop: Optional[Stop],
        to_stop: Optional[Stop],
        route: Route
    ) -> float:
        drift = 0.0

        if from_stop and from_stop.is_door_open:
            door_end_time = from_stop.arrival_time + timedelta(minutes=from_stop.door_open_duration_min)
            if current_time <= door_end_time:
                drift += self.config.door_open_rate

        segment_duration = (segment.end_time - segment.start_time).total_seconds()
        elapsed = (current_time - segment.start_time).total_seconds()
        progress = elapsed / segment_duration if segment_duration > 0 else 0

        if progress < 0.3:
            drift += self.config.temp_drift_rate
        elif progress > 0.7:
            drift += self.config.cooling_rate

        drift += random.uniform(-0.05, 0.05)

        return drift

    def _apply_bounds(self, temp: float) -> float:
        return max(-30.0, min(50.0, temp))

    def _check_missing_in_segment(
        self,
        segment: Segment,
        missing_periods: List[Dict]
    ) -> List[Dict]:
        result = []
        for period in missing_periods:
            if (period['start'] <= segment.end_time and 
                period['end'] >= segment.start_time):
                overlap_start = max(period['start'], segment.start_time)
                overlap_end = min(period['end'], segment.end_time)
                duration = (overlap_end - overlap_start).total_seconds() / 60
                if duration >= self.config.max_missing_duration_min:
                    result.append({
                        'start': overlap_start,
                        'end': overlap_end,
                        'duration_min': duration,
                        'type': period.get('type', 'sensor_missing')
                    })
        return result
