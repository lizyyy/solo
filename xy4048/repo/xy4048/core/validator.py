from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
from enum import Enum

from config import CONFIG, TaskStatus
from .csv_parser import ParsedReading, ParseResult
from database import (
    DatabaseManager, CoolerBox, DeliveryTask, TemperatureReading,
    QuarantineRecord, ExceptionRecord, ExceptionType
)


class ErrorCategory(Enum):
    TIME_OUT_OF_ORDER = "时间倒序"
    SAMPLING_GAP = "采样间隔缺口"
    UNKNOWN_DEVICE = "设备号不在配置"
    BOX_MISMATCH = "箱号与任务不匹配"
    TEMPERATURE_UNIT_CONFUSION = "温度单位混乱"
    LOW_BATTERY = "低电量"
    DUPLICATE_RECORD = "重复记录"
    OVER_TEMPERATURE = "超温"


ERROR_CATEGORY_MESSAGES = {
    ErrorCategory.TIME_OUT_OF_ORDER: "记录时间晚于下一条记录，存在时间倒序",
    ErrorCategory.SAMPLING_GAP: "采样间隔超过正常范围，存在数据缺口",
    ErrorCategory.UNKNOWN_DEVICE: "设备号未在系统中配置",
    ErrorCategory.BOX_MISMATCH: "箱号与任务配置不匹配",
    ErrorCategory.TEMPERATURE_UNIT_CONFUSION: "温度值异常，可能存在单位混乱（℃/℉）",
    ErrorCategory.LOW_BATTERY: "电量低于警戒值",
    ErrorCategory.DUPLICATE_RECORD: "重复的记录",
    ErrorCategory.OVER_TEMPERATURE: "温度超出正常范围",
}


@dataclass
class ValidationError:
    category: ErrorCategory
    row_number: int
    reading: Optional[ParsedReading]
    message: str
    details: Dict[str, Any]


@dataclass
class ValidationResult:
    valid_readings: List[ParsedReading]
    errors: List[ValidationError]
    warnings: List[ValidationError]
    device_to_task_map: Dict[str, int]


class Validator:
    def __init__(self, db: DatabaseManager):
        self.db = db
        self.config = CONFIG
        self.expected_sampling_interval = timedelta(minutes=15)
        self.max_sampling_gap = timedelta(hours=2)
    
    def get_configured_devices(self) -> Dict[str, CoolerBox]:
        boxes = self.db.get_all(CoolerBox, "is_active = 1")
        return {box.device_id: box for box in boxes if box.device_id}
    
    def get_active_tasks_by_box(self) -> Dict[str, DeliveryTask]:
        active_statuses = [
            TaskStatus.TO_PACK.value,
            TaskStatus.IN_TRANSIT.value,
            TaskStatus.TO_SIGN.value,
            TaskStatus.NEED_REVIEW.value
        ]
        
        placeholders = ', '.join(['?' for _ in active_statuses])
        query = f'''
            SELECT dt.*, cb.box_number, cb.device_id
            FROM delivery_tasks dt
            LEFT JOIN cooler_boxes cb ON dt.cooler_box_id = cb.id
            WHERE dt.status IN ({placeholders})
            AND dt.cooler_box_id IS NOT NULL
        '''
        
        results = self.db.execute_query(query, tuple(active_statuses))
        
        task_map = {}
        for row in results:
            if row.get('box_number'):
                task_map[row['box_number']] = DeliveryTask.from_dict(row)
            if row.get('device_id'):
                task_map[row['device_id']] = DeliveryTask.from_dict(row)
        
        return task_map
    
    def get_task_for_reading(self, reading: ParsedReading, active_tasks: Dict[str, Any]) -> Optional[DeliveryTask]:
        if reading.box_number and reading.box_number in active_tasks:
            return active_tasks[reading.box_number]
        
        if reading.device_id in active_tasks:
            return active_tasks[reading.device_id]
        
        return None
    
    def validate_time_order(self, readings: List[ParsedReading]) -> List[ValidationError]:
        errors = []
        
        if len(readings) < 2:
            return errors
        
        sorted_readings = sorted(readings, key=lambda r: r.reading_time)
        
        for i in range(len(readings) - 1):
            current = readings[i]
            next_reading = readings[i + 1]
            
            if current.reading_time > next_reading.reading_time:
                errors.append(ValidationError(
                    category=ErrorCategory.TIME_OUT_OF_ORDER,
                    row_number=current.row_number,
                    reading=current,
                    message=ERROR_CATEGORY_MESSAGES[ErrorCategory.TIME_OUT_OF_ORDER],
                    details={
                        'current_time': current.reading_time.isoformat(),
                        'next_time': next_reading.reading_time.isoformat(),
                        'next_row': next_reading.row_number
                    }
                ))
        
        return errors
    
    def validate_sampling_gaps(self, readings: List[ParsedReading]) -> List[ValidationError]:
        errors = []
        
        if len(readings) < 2:
            return errors
        
        sorted_readings = sorted(readings, key=lambda r: r.reading_time)
        
        for i in range(len(sorted_readings) - 1):
            current = sorted_readings[i]
            next_reading = sorted_readings[i + 1]
            
            gap = next_reading.reading_time - current.reading_time
            
            if gap > self.max_sampling_gap:
                errors.append(ValidationError(
                    category=ErrorCategory.SAMPLING_GAP,
                    row_number=current.row_number,
                    reading=current,
                    message=f"采样间隔缺口: {gap}",
                    details={
                        'start_time': current.reading_time.isoformat(),
                        'end_time': next_reading.reading_time.isoformat(),
                        'gap_minutes': gap.total_seconds() / 60,
                        'next_row': next_reading.row_number
                    }
                ))
        
        return errors
    
    def validate_devices(self, readings: List[ParsedReading], configured_devices: Dict[str, CoolerBox]) -> List[ValidationError]:
        errors = []
        
        for reading in readings:
            if reading.device_id not in configured_devices:
                errors.append(ValidationError(
                    category=ErrorCategory.UNKNOWN_DEVICE,
                    row_number=reading.row_number,
                    reading=reading,
                    message=ERROR_CATEGORY_MESSAGES[ErrorCategory.UNKNOWN_DEVICE],
                    details={
                        'device_id': reading.device_id
                    }
                ))
        
        return errors
    
    def validate_box_matching(self, readings: List[ParsedReading], active_tasks: Dict[str, Any], configured_devices: Dict[str, CoolerBox]) -> Tuple[List[ValidationError], Dict[str, int]]:
        errors = []
        device_to_task_map = {}
        
        for reading in readings:
            task = self.get_task_for_reading(reading, active_tasks)
            
            if task is None:
                errors.append(ValidationError(
                    category=ErrorCategory.BOX_MISMATCH,
                    row_number=reading.row_number,
                    reading=reading,
                    message=ERROR_CATEGORY_MESSAGES[ErrorCategory.BOX_MISMATCH],
                    details={
                        'device_id': reading.device_id,
                        'box_number': reading.box_number
                    }
                ))
            else:
                if reading.device_id:
                    device_to_task_map[reading.device_id] = task.id
                if reading.box_number:
                    device_to_task_map[reading.box_number] = task.id
        
        return errors, device_to_task_map
    
    def validate_temperature_unit(self, readings: List[ParsedReading]) -> List[ValidationError]:
        errors = []
        
        celsius_readings = [r for r in readings if -20 <= r.temperature <= 50]
        fahrenheit_readings = [r for r in readings if 0 <= r.temperature <= 120]
        
        has_celsius = len(celsius_readings) > len(readings) * 0.5
        has_fahrenheit = len(fahrenheit_readings) > len(readings) * 0.5
        
        if has_celsius and has_fahrenheit:
            for reading in readings:
                if reading.temperature > 40 or reading.temperature < -10:
                    errors.append(ValidationError(
                        category=ErrorCategory.TEMPERATURE_UNIT_CONFUSION,
                        row_number=reading.row_number,
                        reading=reading,
                        message=ERROR_CATEGORY_MESSAGES[ErrorCategory.TEMPERATURE_UNIT_CONFUSION],
                        details={
                            'temperature': reading.temperature,
                            'possible_celsius': (reading.temperature - 32) * 5 / 9
                        }
                    ))
        
        return errors
    
    def validate_battery(self, readings: List[ParsedReading]) -> List[ValidationError]:
        errors = []
        
        for reading in readings:
            if reading.battery is not None and self.config.is_low_battery(reading.battery):
                errors.append(ValidationError(
                    category=ErrorCategory.LOW_BATTERY,
                    row_number=reading.row_number,
                    reading=reading,
                    message=f"{ERROR_CATEGORY_MESSAGES[ErrorCategory.LOW_BATTERY]}: {reading.battery}%",
                    details={
                        'battery': reading.battery,
                        'threshold': self.config.low_battery_threshold
                    }
                ))
        
        return errors
    
    def validate_duplicates(self, readings: List[ParsedReading]) -> List[ValidationError]:
        errors = []
        seen = set()
        
        for reading in readings:
            key = (reading.device_id, reading.reading_time, reading.temperature)
            
            if key in seen:
                errors.append(ValidationError(
                    category=ErrorCategory.DUPLICATE_RECORD,
                    row_number=reading.row_number,
                    reading=reading,
                    message=ERROR_CATEGORY_MESSAGES[ErrorCategory.DUPLICATE_RECORD],
                    details={
                        'device_id': reading.device_id,
                        'reading_time': reading.reading_time.isoformat(),
                        'temperature': reading.temperature
                    }
                ))
            else:
                seen.add(key)
        
        return errors
    
    def validate_overtemperature(self, readings: List[ParsedReading]) -> List[ValidationError]:
        warnings = []
        
        for reading in readings:
            if self.config.is_temperature_over(reading.temperature):
                warnings.append(ValidationError(
                    category=ErrorCategory.OVER_TEMPERATURE,
                    row_number=reading.row_number,
                    reading=reading,
                    message=f"温度超出范围: {reading.temperature}°C (正常范围: {self.config.temperature_min}-{self.config.temperature_max}°C)",
                    details={
                        'temperature': reading.temperature,
                        'min_temp': self.config.temperature_min,
                        'max_temp': self.config.temperature_max
                    }
                ))
        
        return warnings
    
    def validate(self, parse_result: ParseResult, source_file: str) -> ValidationResult:
        all_errors: List[ValidationError] = []
        all_warnings: List[ValidationError] = []
        valid_readings: List[ParsedReading] = []
        
        readings = parse_result.readings
        
        configured_devices = self.get_configured_devices()
        active_tasks = self.get_active_tasks_by_box()
        
        time_errors = self.validate_time_order(readings)
        all_errors.extend(time_errors)
        
        gap_errors = self.validate_sampling_gaps(readings)
        all_errors.extend(gap_errors)
        
        device_errors = self.validate_devices(readings, configured_devices)
        all_errors.extend(device_errors)
        
        box_errors, device_to_task_map = self.validate_box_matching(readings, active_tasks, configured_devices)
        all_errors.extend(box_errors)
        
        unit_errors = self.validate_temperature_unit(readings)
        all_errors.extend(unit_errors)
        
        battery_warnings = self.validate_battery(readings)
        all_warnings.extend(battery_warnings)
        
        duplicate_errors = self.validate_duplicates(readings)
        all_errors.extend(duplicate_errors)
        
        overtemp_warnings = self.validate_overtemperature(readings)
        all_warnings.extend(overtemp_warnings)
        
        error_rows = {e.row_number for e in all_errors if e.reading}
        valid_readings = [r for r in readings if r.row_number not in error_rows]
        
        return ValidationResult(
            valid_readings=valid_readings,
            errors=all_errors,
            warnings=all_warnings,
            device_to_task_map=device_to_task_map
        )
    
    def create_quarantine_records(self, errors: List[ValidationError], source_file: str):
        for error in errors:
            record = QuarantineRecord(
                source_file=source_file,
                row_number=error.row_number,
                raw_data=error.reading.raw_data if error.reading else "",
                error_reason=error.message,
                error_category=error.category.value,
                is_resolved=False
            )
            self.db.create(record)
    
    def check_consecutive_overtemp(self, task_id: int) -> Tuple[bool, List[TemperatureReading]]:
        readings = self.db.get_all(
            TemperatureReading,
            "task_id = ?",
            (task_id,)
        )
        
        if not readings:
            return False, []
        
        sorted_readings = sorted(readings, key=lambda r: r.reading_time)
        
        consecutive_count = 0
        consecutive_readings = []
        
        for reading in sorted_readings:
            if reading.is_overtemp:
                consecutive_count += 1
                consecutive_readings.append(reading)
                
                if consecutive_count >= self.config.consecutive_overtemp_count:
                    return True, consecutive_readings
            else:
                consecutive_count = 0
                consecutive_readings = []
        
        return False, []
