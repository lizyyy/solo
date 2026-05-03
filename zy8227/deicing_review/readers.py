import csv
import json
import yaml
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Any, Iterator

from .models import (
    FlightPlan, WeatherData, FluidBatch, SprayRecord,
    FluidType
)


class DataReader:
    def __init__(self):
        self.issue_counter = 0

    def _generate_issue_id(self) -> str:
        self.issue_counter += 1
        return f"ISS_{self.issue_counter:06d}"

    def parse_datetime(self, value: Any, formats: List[str] = None) -> Optional[datetime]:
        if value is None:
            return None
        
        if isinstance(value, datetime):
            return value
        
        if isinstance(value, str):
            if not value or value.strip() == "":
                return None
            value = value.strip()
        else:
            value = str(value)
        
        if formats is None:
            formats = [
                "%Y-%m-%d %H:%M:%S",
                "%Y-%m-%d %H:%M",
                "%Y/%m/%d %H:%M:%S",
                "%Y/%m/%d %H:%M",
                "%Y-%m-%dT%H:%M:%S",
                "%Y-%m-%dT%H:%M:%S.%f",
                "%d-%m-%Y %H:%M:%S",
                "%m/%d/%Y %H:%M",
                "%H:%M",
            ]
        
        for fmt in formats:
            try:
                if fmt == "%H:%M":
                    parsed = datetime.strptime(value, fmt)
                    today = datetime.now()
                    result = parsed.replace(year=today.year, month=today.month, day=today.day)
                    return result
                return datetime.strptime(value, fmt)
            except (ValueError, TypeError):
                continue
        
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except (ValueError, TypeError):
            pass
        
        return None

    def parse_float(self, value: Any, default: float = 0.0) -> float:
        if value is None:
            return default
        try:
            s = str(value).strip()
            if s == "" or s.lower() in ["na", "n/a", "null", "none"]:
                return default
            return float(s)
        except (ValueError, TypeError):
            return default

    def parse_int(self, value: Any, default: int = 0) -> int:
        if value is None:
            return default
        try:
            s = str(value).strip()
            if s == "" or s.lower() in ["na", "n/a", "null", "none"]:
                return default
            return int(float(s))
        except (ValueError, TypeError):
            return default


class FlightPlanReader(DataReader):
    def read(self, file_path: str) -> List[FlightPlan]:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"Flight plan file not found: {file_path}")
        
        flights = []
        
        with open(path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                flight = self._parse_flight_row(row)
                if flight:
                    flights.append(flight)
        
        return flights

    def _parse_flight_row(self, row: Dict[str, str]) -> Optional[FlightPlan]:
        flight_number = row.get('flight_number', row.get('flight_no', row.get('flight', ''))).strip()
        if not flight_number:
            return None
        
        registration = row.get('aircraft_registration', row.get('registration', row.get('reg', ''))).strip()
        
        scheduled_time_str = row.get('scheduled_departure_time', row.get('departure_time', row.get('std', '')))
        scheduled_time = self.parse_datetime(scheduled_time_str)
        
        actual_time_str = row.get('actual_departure_time', row.get('atd', ''))
        actual_time = self.parse_datetime(actual_time_str)
        
        runway = row.get('departure_runway', row.get('runway', '')).strip()
        gate = row.get('gate', row.get('stand', '')).strip()
        aircraft_type = row.get('aircraft_type', row.get('type', '')).strip()
        
        if scheduled_time is None:
            return None
        
        return FlightPlan(
            flight_number=flight_number,
            aircraft_registration=registration,
            departure_runway=runway,
            scheduled_departure_time=scheduled_time,
            actual_departure_time=actual_time,
            gate=gate,
            aircraft_type=aircraft_type
        )


class WeatherReader(DataReader):
    def read(self, file_path: str) -> List[WeatherData]:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"Weather data file not found: {file_path}")
        
        weather_data = []
        
        with open(path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                weather = self._parse_weather_row(row)
                if weather:
                    weather_data.append(weather)
        
        return sorted(weather_data, key=lambda x: x.timestamp)

    def _parse_weather_row(self, row: Dict[str, str]) -> Optional[WeatherData]:
        timestamp_str = row.get('timestamp', row.get('time', row.get('datetime', '')))
        timestamp = self.parse_datetime(timestamp_str)
        
        if timestamp is None:
            return None
        
        runway = row.get('runway', '').strip()
        if not runway:
            runway = "ALL"
        
        temperature = self.parse_float(row.get('temperature', row.get('temp', row.get('t', '0'))))
        dew_point = self.parse_float(row.get('dew_point', row.get('dewpoint', row.get('td', '0'))))
        wind_speed = self.parse_float(row.get('wind_speed', row.get('wind', '0')))
        wind_direction = self.parse_int(row.get('wind_direction', row.get('wd', '0')))
        precipitation = row.get('precipitation', row.get('precip', row.get('weather', ''))).strip()
        visibility = self.parse_float(row.get('visibility', row.get('vis', '10000')))
        
        return WeatherData(
            timestamp=timestamp,
            runway=runway,
            temperature=temperature,
            dew_point=dew_point,
            wind_speed=wind_speed,
            wind_direction=wind_direction,
            precipitation=precipitation,
            visibility=visibility
        )


class FluidBatchReader(DataReader):
    def read(self, file_path: str) -> Dict[str, FluidBatch]:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"Fluid batch file not found: {file_path}")
        
        with open(path, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
        
        batches = {}
        
        if isinstance(data, dict) and 'batches' in data:
            batch_list = data['batches']
        elif isinstance(data, list):
            batch_list = data
        else:
            batch_list = [data]
        
        for batch_data in batch_list:
            batch = self._parse_batch(batch_data)
            if batch:
                batches[batch.batch_id] = batch
        
        return batches

    def _parse_batch(self, data: Dict) -> Optional[FluidBatch]:
        if not data:
            return None
        
        batch_id = data.get('batch_id', data.get('id', '')).strip()
        if not batch_id:
            return None
        
        fluid_type_str = data.get('fluid_type', data.get('type', '')).strip().upper()
        try:
            fluid_type = FluidType(fluid_type_str)
        except ValueError:
            if fluid_type_str in ["I", "TYPE 1", "TYPE1"]:
                fluid_type = FluidType.TYPE_I
            elif fluid_type_str in ["II", "TYPE 2", "TYPE2"]:
                fluid_type = FluidType.TYPE_II
            elif fluid_type_str in ["IV", "TYPE 4", "TYPE4"]:
                fluid_type = FluidType.TYPE_IV
            else:
                fluid_type = FluidType.UNKNOWN
        
        manufacturer = data.get('manufacturer', data.get('maker', '')).strip()
        concentration = self.parse_float(data.get('concentration', '100'))
        
        production_date = self.parse_datetime(data.get('production_date', data.get('prod_date', '')))
        if production_date is None:
            production_date = datetime.now() - timedelta(days=30)
        
        expiry_date = self.parse_datetime(data.get('expiry_date', data.get('exp_date', '')))
        if expiry_date is None:
            expiry_date = datetime.now() + timedelta(days=365)
        
        min_hold_time = {}
        max_hold_time = {}
        
        hold_time_data = data.get('hold_time', data.get('hold_times', {}))
        if isinstance(hold_time_data, dict):
            for temp_key, time_data in hold_time_data.items():
                try:
                    if isinstance(temp_key, int):
                        temp = temp_key
                    else:
                        temp = int(str(temp_key).replace("C", "").strip())
                    if isinstance(time_data, dict):
                        min_ht = self.parse_int(time_data.get('min', time_data.get('minimum', 0)))
                        max_ht = self.parse_int(time_data.get('max', time_data.get('maximum', 0)))
                    else:
                        min_ht = max_ht = self.parse_int(time_data)
                    min_hold_time[temp] = min_ht
                    max_hold_time[temp] = max_ht
                except (ValueError, TypeError):
                    continue
        
        default_hold_times = self._get_default_hold_times(fluid_type)
        for temp, ht in default_hold_times.items():
            if temp not in min_hold_time:
                min_hold_time[temp] = ht
            if temp not in max_hold_time:
                max_hold_time[temp] = ht
        
        return FluidBatch(
            batch_id=batch_id,
            fluid_type=fluid_type,
            manufacturer=manufacturer,
            concentration=concentration,
            production_date=production_date,
            expiry_date=expiry_date,
            min_hold_time_minutes=min_hold_time,
            max_hold_time_minutes=max_hold_time
        )

    def _get_default_hold_times(self, fluid_type: FluidType) -> Dict[int, int]:
        defaults = {
            FluidType.TYPE_I: {
                -20: 10, -15: 12, -10: 15, -5: 20, 0: 25, 5: 30, 10: 35
            },
            FluidType.TYPE_II: {
                -20: 30, -15: 40, -10: 50, -5: 60, 0: 80, 5: 100, 10: 120
            },
            FluidType.TYPE_IV: {
                -20: 45, -15: 60, -10: 80, -5: 100, 0: 130, 5: 160, 10: 180
            },
            FluidType.UNKNOWN: {
                -20: 15, -15: 20, -10: 25, -5: 30, 0: 40, 5: 50, 10: 60
            }
        }
        return defaults.get(fluid_type, defaults[FluidType.UNKNOWN])


class SprayRecordReader(DataReader):
    def read(self, file_path: str) -> List[SprayRecord]:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"Spray record file not found: {file_path}")
        
        records = []
        
        with open(path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#'):
                    continue
                
                try:
                    data = json.loads(line)
                    record = self._parse_spray_record(data)
                    if record:
                        records.append(record)
                except json.JSONDecodeError:
                    continue
        
        return sorted(records, key=lambda x: x.spray_time)

    def _parse_spray_record(self, data: Dict) -> Optional[SprayRecord]:
        if not data:
            return None
        
        record_id = data.get('record_id', data.get('id', '')).strip()
        if not record_id:
            record_id = f"SPRAY_{datetime.now().strftime('%Y%m%d%H%M%S')}_{id(data)}"
        
        registration = data.get('aircraft_registration', data.get('registration', data.get('reg', ''))).strip()
        
        spray_time_str = data.get('spray_time', data.get('time', data.get('timestamp', '')))
        spray_time = self.parse_datetime(spray_time_str)
        
        if spray_time is None:
            return None
        
        runway = data.get('runway', data.get('departure_runway', '')).strip()
        gate = data.get('gate', data.get('stand', '')).strip()
        
        fluid_batch_id = data.get('fluid_batch_id', data.get('batch_id', '')).strip()
        
        fluid_type_str = data.get('fluid_type', data.get('type', '')).strip().upper()
        fluid_type = None
        if fluid_type_str:
            try:
                fluid_type = FluidType(fluid_type_str)
            except ValueError:
                if fluid_type_str in ["I", "TYPE 1", "TYPE1"]:
                    fluid_type = FluidType.TYPE_I
                elif fluid_type_str in ["II", "TYPE 2", "TYPE2"]:
                    fluid_type = FluidType.TYPE_II
                elif fluid_type_str in ["IV", "TYPE 4", "TYPE4"]:
                    fluid_type = FluidType.TYPE_IV
        
        fluid_volume = self.parse_float(data.get('fluid_volume', data.get('volume', '0')))
        spray_duration = self.parse_int(data.get('spray_duration_seconds', data.get('duration', '0')))
        operator = data.get('operator', data.get('tech', '')).strip()
        notes = data.get('notes', data.get('comment', '')).strip()
        
        return SprayRecord(
            record_id=record_id,
            aircraft_registration=registration,
            spray_time=spray_time,
            runway=runway,
            gate=gate,
            fluid_batch_id=fluid_batch_id,
            fluid_type=fluid_type,
            fluid_volume=fluid_volume,
            spray_duration_seconds=spray_duration,
            operator=operator,
            notes=notes
        )
