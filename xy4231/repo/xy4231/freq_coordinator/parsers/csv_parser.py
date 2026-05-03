import csv
from pathlib import Path
from typing import List, Dict, Any
from datetime import datetime

from freq_coordinator.models import (
    SupplyStation,
    Device,
    ValidationError,
    ValidationResult,
)


def parse_supply_stations(file_path: str) -> ValidationResult:
    path = Path(file_path)
    stations: List[SupplyStation] = []
    errors: List[ValidationError] = []
    warnings: List[ValidationError] = []

    if not path.exists():
        return ValidationResult(
            is_valid=False,
            file_type="supply_stations",
            file_path=file_path,
            parsed_count=0,
            errors=[
                ValidationError(
                    field="file",
                    value=file_path,
                    message="文件不存在",
                )
            ],
        )

    try:
        with open(path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row_num, row in enumerate(reader, start=2):
                row_errors, station = _parse_supply_station_row(row, row_num)
                errors.extend(row_errors)
                if station:
                    stations.append(station)
    except csv.Error as e:
        errors.append(
            ValidationError(
                field="csv_format",
                value=str(e),
                message=f"CSV解析错误: {e}",
            )
        )
    except Exception as e:
        errors.append(
            ValidationError(
                field="file",
                value=str(e),
                message=f"文件读取错误: {e}",
            )
        )

    return ValidationResult(
        is_valid=len(errors) == 0 and len(stations) > 0,
        file_type="supply_stations",
        file_path=file_path,
        parsed_count=len(stations),
        errors=errors,
        warnings=warnings,
    )


def _parse_supply_station_row(
    row: Dict[str, str], row_num: int
) -> tuple:
    errors: List[ValidationError] = []
    station = None

    required_fields = ["id", "name", "latitude", "longitude", "distance_from_start"]
    for field in required_fields:
        if field not in row or not row[field].strip():
            errors.append(
                ValidationError(
                    field=field,
                    value=row.get(field),
                    message=f"必需字段 '{field}' 缺失或为空",
                    row_number=row_num,
                )
            )

    if errors:
        return errors, None

    try:
        latitude = float(row["latitude"].strip())
        if not (-90 <= latitude <= 90):
            errors.append(
                ValidationError(
                    field="latitude",
                    value=latitude,
                    message="纬度必须在 -90 到 90 之间",
                    row_number=row_num,
                )
            )
    except ValueError:
        errors.append(
            ValidationError(
                field="latitude",
                value=row.get("latitude"),
                message="纬度必须是数字",
                row_number=row_num,
            )
        )

    try:
        longitude = float(row["longitude"].strip())
        if not (-180 <= longitude <= 180):
            errors.append(
                ValidationError(
                    field="longitude",
                    value=longitude,
                    message="经度必须在 -180 到 180 之间",
                    row_number=row_num,
                )
            )
    except ValueError:
        errors.append(
            ValidationError(
                field="longitude",
                value=row.get("longitude"),
                message="经度必须是数字",
                row_number=row_num,
            )
        )

    try:
        distance = float(row["distance_from_start"].strip())
        if distance < 0:
            errors.append(
                ValidationError(
                    field="distance_from_start",
                    value=distance,
                    message="距离不能为负数",
                    row_number=row_num,
                )
            )
    except ValueError:
        errors.append(
            ValidationError(
                field="distance_from_start",
                value=row.get("distance_from_start"),
                message="距离必须是数字",
                row_number=row_num,
            )
        )

    try:
        elevation = float(row.get("elevation", "0").strip()) if row.get("elevation") else 0.0
    except ValueError:
        elevation = 0.0
        errors.append(
            ValidationError(
                field="elevation",
                value=row.get("elevation"),
                message="海拔格式无效，使用默认值 0",
                row_number=row_num,
                severity="warning",
            )
        )

    criticality = row.get("criticality", "normal").lower()
    valid_criticalities = ["critical", "high", "normal", "low"]
    if criticality not in valid_criticalities:
        criticality = "normal"

    required_coverage = row.get("required_coverage", "true").lower() in ["true", "1", "yes"]

    if not errors:
        station = SupplyStation(
            id=row["id"].strip(),
            name=row["name"].strip(),
            latitude=latitude if not errors else 0.0,
            longitude=longitude if not errors else 0.0,
            distance_from_start=distance if not errors else 0.0,
            elevation=elevation,
            criticality=criticality,
            required_coverage=required_coverage,
            contact_person=row.get("contact_person"),
        )

    return errors, station


def parse_devices(file_path: str) -> ValidationResult:
    path = Path(file_path)
    devices: List[Device] = []
    errors: List[ValidationError] = []
    warnings: List[ValidationError] = []

    if not path.exists():
        return ValidationResult(
            is_valid=False,
            file_type="devices",
            file_path=file_path,
            parsed_count=0,
            errors=[
                ValidationError(
                    field="file",
                    value=file_path,
                    message="文件不存在",
                )
            ],
        )

    try:
        with open(path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row_num, row in enumerate(reader, start=2):
                row_errors, device = _parse_device_row(row, row_num)
                errors.extend(row_errors)
                if device:
                    devices.append(device)
    except csv.Error as e:
        errors.append(
            ValidationError(
                field="csv_format",
                value=str(e),
                message=f"CSV解析错误: {e}",
            )
        )
    except Exception as e:
        errors.append(
            ValidationError(
                field="file",
                value=str(e),
                message=f"文件读取错误: {e}",
            )
        )

    return ValidationResult(
        is_valid=len(errors) == 0 and len(devices) > 0,
        file_type="devices",
        file_path=file_path,
        parsed_count=len(devices),
        errors=errors,
        warnings=warnings,
    )


def _parse_device_row(row: Dict[str, str], row_num: int) -> tuple:
    errors: List[ValidationError] = []
    device = None

    required_fields = ["id", "battery_capacity_mah"]
    for field in required_fields:
        if field not in row or not row[field].strip():
            errors.append(
                ValidationError(
                    field=field,
                    value=row.get(field),
                    message=f"必需字段 '{field}' 缺失或为空",
                    row_number=row_num,
                )
            )

    if errors:
        return errors, None

    try:
        battery_capacity = int(row["battery_capacity_mah"].strip())
        if battery_capacity < 100:
            errors.append(
                ValidationError(
                    field="battery_capacity_mah",
                    value=battery_capacity,
                    message="电池容量必须至少 100 mAh",
                    row_number=row_num,
                )
            )
    except ValueError:
        errors.append(
            ValidationError(
                field="battery_capacity_mah",
                value=row.get("battery_capacity_mah"),
                message="电池容量必须是整数",
                row_number=row_num,
            )
        )

    try:
        charge_percent = int(row.get("current_charge_percent", "100").strip())
        if not (0 <= charge_percent <= 100):
            errors.append(
                ValidationError(
                    field="current_charge_percent",
                    value=charge_percent,
                    message="电量百分比必须在 0-100 之间",
                    row_number=row_num,
                )
            )
    except ValueError:
        charge_percent = 100
        errors.append(
            ValidationError(
                field="current_charge_percent",
                value=row.get("current_charge_percent"),
                message="电量百分比格式无效，使用默认值 100%",
                row_number=row_num,
                severity="warning",
            )
        )

    try:
        power_consumption = float(row.get("power_consumption_ma", "200.0").strip())
        if power_consumption < 10:
            errors.append(
                ValidationError(
                    field="power_consumption_ma",
                    value=power_consumption,
                    message="功耗必须至少 10 mA",
                    row_number=row_num,
                )
            )
    except ValueError:
        power_consumption = 200.0

    try:
        standby_current = float(row.get("standby_current_ma", "50.0").strip())
        if standby_current < 1:
            errors.append(
                ValidationError(
                    field="standby_current_ma",
                    value=standby_current,
                    message="待机电流必须至少 1 mA",
                    row_number=row_num,
                )
            )
    except ValueError:
        standby_current = 50.0

    device_type = row.get("type", "handheld").lower()
    valid_types = ["handheld", "mobile", "base"]
    if device_type not in valid_types:
        device_type = "handheld"

    status = row.get("status", "available").lower()
    valid_statuses = ["available", "in_use", "maintenance"]
    if status not in valid_statuses:
        status = "available"

    frequencies_str = row.get("frequencies", "")
    frequencies = []
    if frequencies_str:
        for freq_str in frequencies_str.split(";"):
            try:
                freq = float(freq_str.strip())
                if 136 <= freq <= 174:
                    frequencies.append(freq)
            except ValueError:
                pass

    last_charged = None
    if row.get("last_charged"):
        try:
            last_charged = datetime.fromisoformat(row["last_charged"].strip())
        except ValueError:
            pass

    if not errors:
        device = Device(
            id=row["id"].strip(),
            type=device_type,
            model=row.get("model"),
            status=status,
            battery_capacity_mah=battery_capacity,
            current_charge_percent=charge_percent,
            power_consumption_ma=power_consumption,
            standby_current_ma=standby_current,
            frequencies=frequencies,
            assigned_to=row.get("assigned_to"),
            last_charged=last_charged,
        )

    return errors, device
