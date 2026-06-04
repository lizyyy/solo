import csv
import json
from datetime import datetime
from typing import List, Dict, Optional, Tuple
from models import TemperatureCalibration, CylinderConversionRecord, RecordStatus


def parse_datetime(dt_str: str) -> datetime:
    formats = [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y/%m/%d %H:%M:%S",
        "%Y/%m/%d %H:%M",
    ]
    for fmt in formats:
        try:
            return datetime.strptime(dt_str, fmt)
        except ValueError:
            continue
    raise ValueError(f"无法解析时间格式: {dt_str}")


def import_temperature_calibrations(file_path: str) -> List[TemperatureCalibration]:
    calibrations: List[TemperatureCalibration] = []
    
    if file_path.endswith(".csv"):
        with open(file_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                calib = TemperatureCalibration(
                    record_id=row.get("record_id", "").strip(),
                    calibrate_time=parse_datetime(row.get("calibrate_time", "").strip()),
                    raw_temperature=float(row.get("raw_temperature", 0)),
                    calibrated_temperature=float(row.get("calibrated_temperature", 0)),
                    calibration_method=row.get("calibration_method", "").strip(),
                    operator=row.get("operator", "").strip(),
                    sensor_id_reported=row.get("sensor_id_reported", "").strip(),
                    caliber=row.get("caliber", "PT100").strip()
                )
                calibrations.append(calib)
    elif file_path.endswith(".json"):
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            for item in data:
                calib = TemperatureCalibration(
                    record_id=item.get("record_id", "").strip(),
                    calibrate_time=parse_datetime(item.get("calibrate_time", "").strip()),
                    raw_temperature=float(item.get("raw_temperature", 0)),
                    calibrated_temperature=float(item.get("calibrated_temperature", 0)),
                    calibration_method=item.get("calibration_method", "").strip(),
                    operator=item.get("operator", "").strip(),
                    sensor_id_reported=item.get("sensor_id_reported", "").strip(),
                    caliber=item.get("caliber", "PT100").strip()
                )
                calibrations.append(calib)
    else:
        raise ValueError(f"不支持的文件格式: {file_path}")
    
    return calibrations


def create_conversion_records(
    calibrations: List[TemperatureCalibration],
    pressure_data: Optional[List[Dict]] = None
) -> List[CylinderConversionRecord]:
    records: List[CylinderConversionRecord] = []
    
    for i, calib in enumerate(calibrations):
        raw_pressure = 0.0
        cylinder_id = f"QP-{i+1:03d}"
        
        if pressure_data and i < len(pressure_data):
            raw_pressure = pressure_data[i].get("raw_pressure", 0.0)
            cylinder_id = pressure_data[i].get("cylinder_id", cylinder_id)
        
        record = CylinderConversionRecord(
            conversion_id=f"CV-{calib.record_id}",
            cylinder_id=cylinder_id,
            calibrate_time=calib.calibrate_time,
            raw_temperature=calib.raw_temperature,
            raw_pressure=raw_pressure,
            calibrated_temperature=calib.calibrated_temperature,
            temperature_calibration_id=calib.record_id,
            sensor_id_original=calib.sensor_id_reported,
            caliber_actual=calib.caliber,
            status=RecordStatus.PENDING
        )
        record.add_log("导入温度校准记录", calib.operator, f"校准记录ID: {calib.record_id}")
        records.append(record)
    
    return records


def import_pressure_data(file_path: str) -> List[Dict]:
    pressure_list: List[Dict] = []
    
    if file_path.endswith(".csv"):
        with open(file_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                pressure_list.append({
                    "cylinder_id": row.get("cylinder_id", "").strip(),
                    "raw_pressure": float(row.get("raw_pressure", 0)),
                    "calibrate_time": row.get("calibrate_time", "").strip()
                })
    elif file_path.endswith(".json"):
        with open(file_path, "r", encoding="utf-8") as f:
            pressure_list = json.load(f)
    
    return pressure_list


def check_caliber_mismatch(records: List[CylinderConversionRecord]) -> List[CylinderConversionRecord]:
    for record in records:
        if record.caliber_actual and record.caliber_actual != record.caliber_expected:
            record.caliber_mismatch = True
            record.add_log(
                "检测到口径不匹配",
                "系统",
                f"期望: {record.caliber_expected}, 实际: {record.caliber_actual}"
            )
    return records
