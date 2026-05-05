import csv
import json
import re
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

import yaml


class Status(Enum):
    NORMAL = "normal"
    WARNING = "warning"
    CRITICAL = "critical"
    ERROR = "error"


@dataclass
class DataSample:
    id: str
    parameter: str
    value: float
    unit: str
    source: str = "unknown"
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ValidationResult:
    sample: DataSample
    status: Status
    normalized_value: float
    target_unit: str
    message: str = ""
    details: Dict[str, Any] = field(default_factory=dict)


class UnitConverter:
    def __init__(self):
        self.alias_map: Dict[str, Tuple[str, str]] = {}
        self.conversion_factors: Dict[str, Dict[str, float]] = {}
        self.quantity_types: Dict[str, str] = {}
        self._init_base_units()

    def _init_base_units(self):
        self.base_units = {
            "concentration": "mg/L",
            "pressure": "kPa",
            "temperature": "K",
            "flow": "m3/h",
            "mass": "kg",
            "volume": "L",
        }

        self.conversion_factors = {
            "mg/L": {
                "μg/mL": 1.0,
                "mg/dm3": 1.0,
                "g/L": 0.001,
                "g/m3": 1.0,
                "μg/L": 1000.0,
                "ppb": 1.0,
                "ppm": 0.001,
            },
            "μg/mL": {
                "mg/L": 1.0,
                "mg/dm3": 1.0,
                "g/L": 0.001,
                "g/m3": 1.0,
                "μg/L": 1000.0,
                "ppb": 1.0,
                "ppm": 0.001,
            },
            "kPa": {
                "bar": 0.01,
                "MPa": 0.001,
                "Pa": 1000.0,
                "atm": 0.009869,
                "psi": 0.145038,
                "mmHg": 7.50062,
            },
            "bar": {
                "kPa": 100.0,
                "MPa": 0.1,
                "Pa": 100000.0,
                "atm": 0.9869,
                "psi": 14.5038,
                "mmHg": 750.062,
            },
            "K": {
                "°C": -273.15,
                "°F": -459.67,
            },
            "°C": {
                "K": 273.15,
                "°F": 1.8,
            },
            "m3/h": {
                "L/min": 16.6667,
                "L/s": 0.277778,
                "m3/min": 0.0166667,
                "m3/s": 0.000277778,
                "ft3/min": 0.588578,
                "ft3/s": 0.00980963,
            },
            "kg": {
                "g": 1000.0,
                "mg": 1000000.0,
                "μg": 1000000000.0,
                "lb": 2.20462,
                "oz": 35.274,
            },
            "L": {
                "m3": 0.001,
                "mL": 1000.0,
                "cm3": 1000.0,
                "dm3": 1.0,
                "ft3": 0.0353147,
                "gal": 0.264172,
            },
        }

        self.temperature_offsets = {
            "K": {"°C": -273.15, "°F": -459.67},
            "°C": {"K": 273.15, "°F": 32.0},
            "°F": {"K": 459.67, "°C": -17.7778},
        }

        self.quantity_types = {
            "mg/L": "concentration",
            "μg/mL": "concentration",
            "mg/dm3": "concentration",
            "g/L": "concentration",
            "g/m3": "concentration",
            "μg/L": "concentration",
            "ppb": "concentration",
            "ppm": "concentration",
            "kPa": "pressure",
            "bar": "pressure",
            "MPa": "pressure",
            "Pa": "pressure",
            "atm": "pressure",
            "psi": "pressure",
            "mmHg": "pressure",
            "K": "temperature",
            "°C": "temperature",
            "°F": "temperature",
            "m3/h": "flow",
            "L/min": "flow",
            "L/s": "flow",
            "m3/min": "flow",
            "m3/s": "flow",
            "ft3/min": "flow",
            "ft3/s": "flow",
            "kg": "mass",
            "g": "mass",
            "mg": "mass",
            "μg": "mass",
            "lb": "mass",
            "oz": "mass",
            "L": "volume",
            "m3": "volume",
            "mL": "volume",
            "cm3": "volume",
            "dm3": "volume",
            "ft3": "volume",
            "gal": "volume",
        }

    def load_aliases(self, alias_file: Union[str, Path]):
        with open(alias_file, "r", encoding="utf-8") as f:
            alias_data = yaml.safe_load(f)

        if not alias_data:
            return

        for category, mappings in alias_data.items():
            if not isinstance(mappings, dict):
                continue

            for target_unit, aliases in mappings.items():
                for alias in aliases:
                    alias_lower = alias.lower().strip()
                    self.alias_map[alias_lower] = (target_unit, category)
                    self.quantity_types[target_unit] = category
                    self.quantity_types[alias_lower] = category

    def normalize_unit(self, unit: str) -> Tuple[str, str]:
        unit_lower = unit.lower().strip()

        if unit_lower in self.alias_map:
            return self.alias_map[unit_lower]

        for known_unit in self.quantity_types.keys():
            if unit_lower == known_unit.lower():
                return known_unit, self.quantity_types[known_unit]

        raise ValueError(f"Unknown unit: '{unit}'. No conversion available.")

    def get_quantity_type(self, unit: str) -> str:
        normalized, qtype = self.normalize_unit(unit)
        return qtype

    def convert(
        self, value: float, from_unit: str, to_unit: str
    ) -> Tuple[float, str]:
        from_normalized, from_qtype = self.normalize_unit(from_unit)
        to_normalized, to_qtype = self.normalize_unit(to_unit)

        if from_qtype != to_qtype:
            raise ValueError(
                f"Dimension mismatch: Cannot convert {from_unit} ({from_qtype}) to {to_unit} ({to_qtype})"
            )

        if from_normalized == to_normalized:
            return value, to_normalized

        if from_qtype == "temperature":
            return self._convert_temperature(value, from_normalized, to_normalized)

        factor = self._get_conversion_factor(from_normalized, to_normalized)
        return value * factor, to_normalized

    def _convert_temperature(
        self, value: float, from_unit: str, to_unit: str
    ) -> Tuple[float, str]:
        if from_unit == to_unit:
            return value, to_unit

        celsius = self._to_celsius(value, from_unit)

        if to_unit == "°C":
            return celsius, "°C"
        elif to_unit == "K":
            return celsius + 273.15, "K"
        elif to_unit == "°F":
            return celsius * 9 / 5 + 32, "°F"

        raise ValueError(f"Cannot convert to unknown temperature unit: {to_unit}")

    def _to_celsius(self, value: float, unit: str) -> float:
        if unit == "°C":
            return value
        elif unit == "K":
            return value - 273.15
        elif unit == "°F":
            return (value - 32) * 5 / 9
        raise ValueError(f"Unknown temperature unit: {unit}")

    def _get_conversion_factor(self, from_unit: str, to_unit: str) -> float:
        if from_unit in self.conversion_factors:
            if to_unit in self.conversion_factors[from_unit]:
                return self.conversion_factors[from_unit][to_unit]

        if to_unit in self.conversion_factors:
            if from_unit in self.conversion_factors[to_unit]:
                return 1.0 / self.conversion_factors[to_unit][from_unit]

        raise ValueError(
            f"No conversion factor available for {from_unit} to {to_unit}"
        )


class ThresholdValidator:
    def __init__(self):
        self.thresholds: Dict[str, Dict[str, Any]] = {}

    def load_thresholds(self, threshold_file: Union[str, Path]):
        with open(threshold_file, "r", encoding="utf-8") as f:
            threshold_data = json.load(f)

        for param_name, config in threshold_data.items():
            if "target_unit" not in config:
                raise ValueError(
                    f"Missing 'target_unit' for parameter '{param_name}'"
                )

            if "ranges" not in config:
                raise ValueError(
                    f"Missing 'ranges' for parameter '{param_name}'"
                )

            ranges = config["ranges"]
            for range_config in ranges:
                if "min" in range_config and "max" in range_config:
                    if range_config["min"] > range_config["max"]:
                        raise ValueError(
                            f"Invalid threshold range for '{param_name}': min ({range_config['min']}) > max ({range_config['max']})"
                        )

            self.thresholds[param_name] = config

    def validate(
        self, value: float, parameter: str, unit: str, unit_converter: UnitConverter
    ) -> Tuple[Status, str, Dict[str, Any]]:
        if parameter not in self.thresholds:
            return Status.ERROR, f"No thresholds defined for parameter '{parameter}'", {}

        config = self.thresholds[parameter]
        target_unit = config["target_unit"]
        ranges = config["ranges"]

        try:
            normalized_value, _ = unit_converter.convert(value, unit, target_unit)
        except ValueError as e:
            return Status.ERROR, str(e), {"unit": unit, "target_unit": target_unit}

        for range_config in ranges:
            range_status = range_config.get("status", "normal")
            min_val = range_config.get("min")
            max_val = range_config.get("max")

            in_range = True

            if min_val is not None:
                if normalized_value < min_val:
                    in_range = False
            if max_val is not None:
                if normalized_value > max_val:
                    in_range = False

            if in_range:
                status_map = {
                    "normal": Status.NORMAL,
                    "warning": Status.WARNING,
                    "critical": Status.CRITICAL,
                }

                return (
                    status_map.get(range_status, Status.NORMAL),
                    f"Value {normalized_value:.4f} {target_unit} in {range_status} range",
                    {
                        "range": range_config,
                        "normalized_value": normalized_value,
                        "target_unit": target_unit,
                    },
                )

        return (
            Status.ERROR,
            f"Value {normalized_value:.4f} {target_unit} does not fall into any defined range",
            {
                "normalized_value": normalized_value,
                "target_unit": target_unit,
                "ranges": ranges,
            },
        )


class Guardian:
    def __init__(
        self,
        samples_file: Optional[Union[str, Path]] = None,
        alias_file: Optional[Union[str, Path]] = None,
        threshold_file: Optional[Union[str, Path]] = None,
    ):
        self.samples: List[DataSample] = []
        self.unit_converter = UnitConverter()
        self.threshold_validator = ThresholdValidator()
        self.results: List[ValidationResult] = []

        if alias_file:
            self.unit_converter.load_aliases(alias_file)
        if threshold_file:
            self.threshold_validator.load_thresholds(threshold_file)
        if samples_file:
            self.load_samples(samples_file)

    def load_samples(self, samples_file: Union[str, Path]):
        self.samples = []
        with open(samples_file, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)

            for row in reader:
                try:
                    value = float(row.get("value", "0"))
                except (ValueError, TypeError):
                    raise ValueError(f"Invalid value: {row.get('value')}")

                sample = DataSample(
                    id=row.get("id", ""),
                    parameter=row.get("parameter", ""),
                    value=value,
                    unit=row.get("unit", ""),
                    source=row.get("source", "unknown"),
                    metadata={
                        k: v for k, v in row.items() if k not in ["id", "parameter", "value", "unit", "source"]
                    },
                )
                self.samples.append(sample)

    def analyze(self) -> List[ValidationResult]:
        self.results = []

        for sample in self.samples:
            try:
                parameter_config = self.threshold_validator.thresholds.get(
                    sample.parameter, {}
                )
                target_unit = parameter_config.get("target_unit", sample.unit)

                status, message, details = self.threshold_validator.validate(
                    sample.value, sample.parameter, sample.unit, self.unit_converter
                )

                normalized_value = details.get("normalized_value", sample.value)
                actual_target_unit = details.get("target_unit", target_unit)

                result = ValidationResult(
                    sample=sample,
                    status=status,
                    normalized_value=normalized_value,
                    target_unit=actual_target_unit,
                    message=message,
                    details=details,
                )

            except Exception as e:
                result = ValidationResult(
                    sample=sample,
                    status=Status.ERROR,
                    normalized_value=sample.value,
                    target_unit=sample.unit,
                    message=f"Validation error: {str(e)}",
                    details={"error": str(e)},
                )

            self.results.append(result)

        return self.results

    def get_statistics(self) -> Dict[str, Any]:
        if not self.results:
            return {
                "total": 0,
                "by_status": {},
                "by_parameter": {},
                "by_source": {},
            }

        total = len(self.results)
        by_status = {}
        by_parameter = {}
        by_source = {}

        for result in self.results:
            status_name = result.status.value
            param_name = result.sample.parameter
            source_name = result.sample.source

            by_status[status_name] = by_status.get(status_name, 0) + 1

            if param_name not in by_parameter:
                by_parameter[param_name] = {"count": 0, "by_status": {}}
            by_parameter[param_name]["count"] += 1
            by_parameter[param_name]["by_status"][status_name] = (
                by_parameter[param_name]["by_status"].get(status_name, 0) + 1
            )

            if source_name not in by_source:
                by_source[source_name] = {"count": 0, "by_status": {}}
            by_source[source_name]["count"] += 1
            by_source[source_name]["by_status"][status_name] = (
                by_source[source_name]["by_status"].get(status_name, 0) + 1
            )

        return {
            "total": total,
            "by_status": by_status,
            "by_parameter": by_parameter,
            "by_source": by_source,
        }

    def export_markdown(self, output_file: Union[str, Path]):
        stats = self.get_statistics()

        md_lines = [
            "# 实验室传感器数据复核报告",
            "",
            f"**生成时间**: 2026-05-05",
            f"**总样本数**: {stats['total']}",
            "",
            "## 统计概览",
            "",
            "| 状态 | 数量 | 比例 |",
            "|------|------|------|",
        ]

        for status, count in stats["by_status"].items():
            percentage = (count / stats["total"] * 100) if stats["total"] > 0 else 0
            md_lines.append(f"| {status} | {count} | {percentage:.1f}% |")

        md_lines.extend(["", "## 按参数分布", ""])

        for param, data in stats["by_parameter"].items():
            md_lines.append(f"### {param} (总计: {data['count']})")
            md_lines.append("")
            md_lines.append("| 状态 | 数量 |")
            md_lines.append("|------|------|")
            for status, count in data["by_status"].items():
                md_lines.append(f"| {status} | {count} |")
            md_lines.append("")

        md_lines.extend(["", "## 详细结果", ""])
        md_lines.append(
            "| ID | 参数 | 原始值 | 单位 | 归一化值 | 目标单位 | 状态 | 消息 |"
        )
        md_lines.append(
            "|----|------|--------|------|----------|----------|------|------|"
        )

        for result in self.results:
            md_lines.append(
                f"| {result.sample.id} | {result.sample.parameter} | "
                f"{result.sample.value} | {result.sample.unit} | "
                f"{result.normalized_value:.4f} | {result.target_unit} | "
                f"{result.status.value} | {result.message} |"
            )

        with open(output_file, "w", encoding="utf-8") as f:
            f.write("\n".join(md_lines))

    def export_csv(self, output_file: Union[str, Path]):
        fieldnames = [
            "id",
            "parameter",
            "original_value",
            "original_unit",
            "normalized_value",
            "target_unit",
            "status",
            "message",
            "source",
        ]

        with open(output_file, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()

            for result in self.results:
                writer.writerow(
                    {
                        "id": result.sample.id,
                        "parameter": result.sample.parameter,
                        "original_value": result.sample.value,
                        "original_unit": result.sample.unit,
                        "normalized_value": f"{result.normalized_value:.4f}",
                        "target_unit": result.target_unit,
                        "status": result.status.value,
                        "message": result.message,
                        "source": result.sample.source,
                    }
                )
