import json
from pathlib import Path
from typing import List, Dict, Any

from freq_coordinator.models import (
    RepeaterStation,
    ValidationError,
    ValidationResult,
)


def parse_repeaters(file_path: str) -> ValidationResult:
    path = Path(file_path)
    repeaters: List[RepeaterStation] = []
    errors: List[ValidationError] = []
    warnings: List[ValidationError] = []

    if not path.exists():
        return ValidationResult(
            is_valid=False,
            file_type="repeaters",
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
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)

        if isinstance(data, dict):
            if "repeaters" in data:
                items = data["repeaters"]
            elif "stations" in data:
                items = data["stations"]
            else:
                items = [data]
        elif isinstance(data, list):
            items = data
        else:
            errors.append(
                ValidationError(
                    field="json_format",
                    value=str(type(data)),
                    message="JSON 格式无效，需要是数组或包含 'repeaters' 字段的对象",
                )
            )
            items = []

        for idx, item in enumerate(items):
            row_errors, repeater = _parse_repeater_item(item, idx + 1)
            errors.extend(row_errors)
            if repeater:
                repeaters.append(repeater)

    except json.JSONDecodeError as e:
        errors.append(
            ValidationError(
                field="json_format",
                value=str(e),
                message=f"JSON 解析错误: {e}",
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
        is_valid=len(errors) == 0 and len(repeaters) > 0,
        file_type="repeaters",
        file_path=file_path,
        parsed_count=len(repeaters),
        errors=errors,
        warnings=warnings,
    )


def _parse_repeater_item(item: Dict[str, Any], idx: int) -> tuple:
    errors: List[ValidationError] = []
    repeater = None

    required_fields = ["id", "name", "latitude", "longitude", "tx_frequency", "rx_frequency"]
    for field in required_fields:
        if field not in item:
            errors.append(
                ValidationError(
                    field=field,
                    value=item.get(field),
                    message=f"必需字段 '{field}' 缺失",
                    row_number=idx,
                )
            )

    if errors:
        return errors, None

    try:
        latitude = float(item["latitude"])
        if not (-90 <= latitude <= 90):
            errors.append(
                ValidationError(
                    field="latitude",
                    value=latitude,
                    message="纬度必须在 -90 到 90 之间",
                    row_number=idx,
                )
            )
    except (TypeError, ValueError):
        errors.append(
            ValidationError(
                field="latitude",
                value=item.get("latitude"),
                message="纬度必须是数字",
                row_number=idx,
            )
        )

    try:
        longitude = float(item["longitude"])
        if not (-180 <= longitude <= 180):
            errors.append(
                ValidationError(
                    field="longitude",
                    value=longitude,
                    message="经度必须在 -180 到 180 之间",
                    row_number=idx,
                )
            )
    except (TypeError, ValueError):
        errors.append(
            ValidationError(
                field="longitude",
                value=item.get("longitude"),
                message="经度必须是数字",
                row_number=idx,
            )
        )

    try:
        tx_freq = float(item["tx_frequency"])
        if not (136 <= tx_freq <= 174):
            errors.append(
                ValidationError(
                    field="tx_frequency",
                    value=tx_freq,
                    message="发射频率必须在 VHF 频段 (136-174 MHz)",
                    row_number=idx,
                )
            )
    except (TypeError, ValueError):
        errors.append(
            ValidationError(
                field="tx_frequency",
                value=item.get("tx_frequency"),
                message="发射频率必须是数字",
                row_number=idx,
            )
        )

    try:
        rx_freq = float(item["rx_frequency"])
        if not (136 <= rx_freq <= 174):
            errors.append(
                ValidationError(
                    field="rx_frequency",
                    value=rx_freq,
                    message="接收频率必须在 VHF 频段 (136-174 MHz)",
                    row_number=idx,
                )
            )
    except (TypeError, ValueError):
        errors.append(
            ValidationError(
                field="rx_frequency",
                value=item.get("rx_frequency"),
                message="接收频率必须是数字",
                row_number=idx,
            )
        )

    try:
        elevation = float(item["elevation"]) if item.get("elevation") is not None else 0.0
    except (TypeError, ValueError):
        elevation = 0.0

    try:
        power = float(item.get("power", 25.0))
        if not (1 <= power <= 100):
            errors.append(
                ValidationError(
                    field="power",
                    value=power,
                    message="功率必须在 1-100 W 之间",
                    row_number=idx,
                    severity="warning",
                )
            )
            power = max(1, min(power, 100))
    except (TypeError, ValueError):
        power = 25.0

    try:
        antenna_gain = float(item.get("antenna_gain", 3.0))
        if antenna_gain < 0:
            antenna_gain = 3.0
    except (TypeError, ValueError):
        antenna_gain = 3.0

    try:
        coverage_radius = float(item.get("coverage_radius_km", 5.0))
        if coverage_radius < 0.1:
            coverage_radius = 5.0
    except (TypeError, ValueError):
        coverage_radius = 5.0

    try:
        height_agl = float(item.get("height_agl", 10.0))
        if height_agl < 0:
            height_agl = 10.0
    except (TypeError, ValueError):
        height_agl = 10.0

    coverage_polygon = None
    if "coverage_polygon" in item and isinstance(item["coverage_polygon"], list):
        coverage_polygon = item["coverage_polygon"]

    if not errors:
        repeater = RepeaterStation(
            id=str(item["id"]).strip(),
            name=str(item["name"]).strip(),
            latitude=latitude,
            longitude=longitude,
            elevation=elevation,
            tx_frequency=tx_freq,
            rx_frequency=rx_freq,
            power=power,
            antenna_gain=antenna_gain,
            coverage_radius_km=coverage_radius,
            height_agl=height_agl,
            coverage_polygon=coverage_polygon,
        )

    return errors, repeater
