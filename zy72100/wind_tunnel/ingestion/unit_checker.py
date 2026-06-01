from typing import List, Tuple, Optional

from ..models.models import SensorRecord, UnitIssue


class UnitChecker:
    CONVERSION_TABLES = {
        "force": {
            ("N", "N"): 1.0,
            ("kN", "N"): 1000.0,
            ("daN", "N"): 10.0,
            ("kgf", "N"): 9.80665,
            ("lbf", "N"): 4.44822,
        },
        "pressure": {
            ("Pa", "kPa"): 0.001,
            ("kPa", "kPa"): 1.0,
            ("MPa", "kPa"): 1000.0,
            ("bar", "kPa"): 100.0,
            ("psi", "kPa"): 6.89476,
        },
        "temperature": {
            ("°C", "°C"): 1.0,
            ("C", "°C"): 1.0,
            ("°F", "°C"): None,
            ("F", "°C"): None,
            ("K", "°C"): None,
        },
        "wind_speed": {
            ("m/s", "m/s"): 1.0,
            ("km/h", "m/s"): 1.0 / 3.6,
            ("mph", "m/s"): 0.44704,
            ("knots", "m/s"): 0.51444,
            ("ft/s", "m/s"): 0.3048,
        },
    }

    FIELD_TO_CATEGORY = {
        "lift_force": "force",
        "drag_force": "force",
        "pressure": "pressure",
        "temperature": "temperature",
        "wind_speed": "wind_speed",
    }

    STANDARD_UNITS = {
        "lift_force": "N",
        "drag_force": "N",
        "pressure": "kPa",
        "temperature": "°C",
        "wind_speed": "m/s",
    }

    def __init__(self):
        self.issues: List[UnitIssue] = []

    def normalize_record(self, record: SensorRecord) -> SensorRecord:
        for field_name in ("lift_force", "drag_force", "pressure", "temperature", "wind_speed"):
            unit_field = f"{field_name}_unit"
            original_unit = getattr(record, unit_field, "")
            value = getattr(record, field_name, None)

            if value is None or not original_unit:
                continue

            target_unit = self.STANDARD_UNITS[field_name]
            if original_unit == target_unit:
                continue

            converted = self._convert(field_name, value, original_unit, target_unit)
            if converted is not None:
                issue = UnitIssue(
                    record_id=record.record_id,
                    field_name=field_name,
                    original_unit=original_unit,
                    target_unit=target_unit,
                    original_value=value,
                    converted_value=converted,
                    conversion_factor=converted / value if value != 0 else 0,
                )
                self.issues.append(issue)

                setattr(record, field_name, converted)
                setattr(record, unit_field, target_unit)
                record.unit_issue_ids = getattr(record, "unit_issue_ids", [])
                record.unit_issue_ids.append(issue.issue_id)

        return record

    def _convert(self, field_name: str, value: float, from_unit: str, to_unit: str) -> Optional[float]:
        category = self.FIELD_TO_CATEGORY.get(field_name)
        if not category:
            return None

        table = self.CONVERSION_TABLES.get(category, {})
        factor = table.get((from_unit, to_unit))

        if factor is None:
            return self._special_convert(field_name, value, from_unit, to_unit)

        return value * factor

    def _special_convert(self, field_name: str, value: float, from_unit: str, to_unit: str) -> Optional[float]:
        if field_name == "temperature" and to_unit == "°C":
            if from_unit in ("°F", "F"):
                return (value - 32) * 5.0 / 9.0
            elif from_unit == "K":
                return value - 273.15
        return None

    def normalize_all(self, records: List[SensorRecord]) -> List[SensorRecord]:
        self.issues = []
        return [self.normalize_record(r) for r in records]

    def issues_summary(self) -> List[dict]:
        return [
            {
                "issue_id": i.issue_id,
                "record_id": i.record_id,
                "field": i.field_name,
                "original": f"{i.original_value} {i.original_unit}",
                "converted": f"{i.converted_value:.4f} {i.target_unit}",
                "factor": i.conversion_factor,
            }
            for i in self.issues
        ]
