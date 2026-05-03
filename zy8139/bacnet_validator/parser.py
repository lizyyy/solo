import csv
import json
import yaml
import re
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field


@dataclass
class PointMapping:
    old_name: str
    new_name: str
    unit: str
    unit_multiplier: float
    floor: Optional[str]
    device_id: Optional[str]
    point_type: str
    description: str = ""
    full_identifier: str = ""

    def __post_init__(self):
        if not self.full_identifier:
            self.full_identifier = self._generate_full_identifier()

    def _generate_full_identifier(self) -> str:
        parts = []
        if self.floor:
            parts.append(f"F{self.floor}")
        if self.device_id:
            parts.append(self.device_id)
        parts.append(self.old_name)
        return ".".join(parts)


@dataclass
class BACnetReading:
    point_name: str
    floor: Optional[str]
    device_id: Optional[str]
    value: Any
    unit: Optional[str]
    timestamp: datetime
    raw_timestamp: str
    status: str = "ok"
    full_identifier: str = ""

    def __post_init__(self):
        if not self.full_identifier:
            self.full_identifier = self._generate_full_identifier()

    def _generate_full_identifier(self) -> str:
        parts = []
        if self.floor:
            parts.append(f"F{self.floor}")
        if self.device_id:
            parts.append(self.device_id)
        parts.append(self.point_name)
        return ".".join(parts)


@dataclass
class ValidationRule:
    rule_type: str
    point_pattern: str
    unit: Optional[str] = None
    unit_multiplier: float = 1.0
    staleness_threshold_seconds: int = 300
    high_alarm_threshold: Optional[float] = None
    low_alarm_threshold: Optional[float] = None
    tolerance_pct: float = 2.0
    enabled: bool = True


@dataclass
class ParsedData:
    point_mappings: Dict[str, PointMapping]
    bacnet_readings: List[BACnetReading]
    rules: List[ValidationRule]


class PointMapParser:
    REQUIRED_FIELDS = ["old_name", "new_name", "unit"]
    OPTIONAL_FIELDS = ["floor", "device_id", "point_type", "description", "unit_multiplier"]

    def parse(self, filepath: str) -> Dict[str, PointMapping]:
        mappings = {}
        duplicates = {}

        with open(filepath, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)

            for row in reader:
                mapping = self._row_to_mapping(row)

                if mapping.full_identifier in mappings:
                    if mapping.full_identifier not in duplicates:
                        duplicates[mapping.full_identifier] = [
                            mappings[mapping.full_identifier]
                        ]
                    duplicates[mapping.full_identifier].append(mapping)
                else:
                    mappings[mapping.full_identifier] = mapping

        if duplicates:
            self._handle_duplicates(duplicates)

        return mappings

    def _row_to_mapping(self, row: Dict[str, str]) -> PointMapping:
        multiplier_str = row.get("unit_multiplier", "1.0").strip()
        try:
            multiplier = float(multiplier_str) if multiplier_str else 1.0
        except (ValueError, TypeError):
            multiplier = 1.0

        return PointMapping(
            old_name=row.get("old_name", "").strip(),
            new_name=row.get("new_name", "").strip(),
            unit=row.get("unit", "").strip(),
            unit_multiplier=multiplier,
            floor=row.get("floor", "").strip() or None,
            device_id=row.get("device_id", "").strip() or None,
            point_type=row.get("point_type", "analog").strip().lower(),
            description=row.get("description", "").strip(),
        )

    def _handle_duplicates(self, duplicates: Dict[str, List[PointMapping]]):
        pass


class BACnetReadsParser:
    def parse(self, filepath: str) -> List[BACnetReading]:
        readings = []

        with open(filepath, "r", encoding="utf-8") as f:
            for line_num, line in enumerate(f, 1):
                line = line.strip()
                if not line:
                    continue

                try:
                    record = json.loads(line)
                    reading = self._record_to_reading(record, line_num)
                    readings.append(reading)
                except json.JSONDecodeError as e:
                    continue
                except KeyError as e:
                    continue

        readings.sort(key=lambda r: r.timestamp)
        return readings

    def _record_to_reading(self, record: Dict[str, Any], line_num: int) -> BACnetReading:
        raw_timestamp = record.get("timestamp", "") or record.get("time", "")
        timestamp = self._parse_timestamp(raw_timestamp)

        point_name = record.get("point_name", "") or record.get("object_name", "")
        value = record.get("value")
        unit = record.get("unit") or record.get("units")
        floor = record.get("floor")
        device_id = record.get("device_id") or record.get("device")
        status = record.get("status", "ok")

        return BACnetReading(
            point_name=point_name,
            floor=floor,
            device_id=device_id,
            value=value,
            unit=unit,
            timestamp=timestamp,
            raw_timestamp=raw_timestamp,
            status=status,
        )

    def _parse_timestamp(self, ts_str: str) -> datetime:
        if not ts_str:
            return datetime.now(timezone.utc)

        ts_str = ts_str.strip()

        formats = [
            "%Y-%m-%dT%H:%M:%S.%fZ",
            "%Y-%m-%dT%H:%M:%SZ",
            "%Y-%m-%dT%H:%M:%S.%f%z",
            "%Y-%m-%dT%H:%M:%S%z",
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M:%S.%f",
        ]

        for fmt in formats:
            try:
                dt = datetime.strptime(ts_str, fmt)
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                return dt.astimezone(timezone.utc)
            except ValueError:
                continue

        try:
            from dateutil import parser as date_parser

            dt = date_parser.parse(ts_str)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.astimezone(timezone.utc)
        except ImportError:
            pass
        except ValueError:
            pass

        return datetime.now(timezone.utc)


class RulesParser:
    def parse(self, filepath: str) -> List[ValidationRule]:
        with open(filepath, "r", encoding="utf-8") as f:
            try:
                data = yaml.safe_load(f) or {}
            except yaml.YAMLError:
                return []

        rules_data = data.get("rules", [])
        rules = []

        for rule_data in rules_data:
            if not isinstance(rule_data, dict):
                continue

            rule = self._dict_to_rule(rule_data)
            if rule.enabled:
                rules.append(rule)

        return rules

    def _dict_to_rule(self, data: Dict[str, Any]) -> ValidationRule:
        return ValidationRule(
            rule_type=data.get("type", "all"),
            point_pattern=data.get("point_pattern", ".*"),
            unit=data.get("unit"),
            unit_multiplier=data.get("unit_multiplier", 1.0),
            staleness_threshold_seconds=data.get("staleness_threshold_seconds", 300),
            high_alarm_threshold=data.get("high_alarm_threshold"),
            low_alarm_threshold=data.get("low_alarm_threshold"),
            tolerance_pct=data.get("tolerance_pct", 2.0),
            enabled=data.get("enabled", True),
        )


def parse_all(
    point_map_path: str,
    bacnet_reads_path: str,
    rules_path: str,
) -> ParsedData:
    point_parser = PointMapParser()
    bacnet_parser = BACnetReadsParser()
    rules_parser = RulesParser()

    return ParsedData(
        point_mappings=point_parser.parse(point_map_path),
        bacnet_readings=bacnet_parser.parse(bacnet_reads_path),
        rules=rules_parser.parse(rules_path),
    )
