import csv
import re
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Tuple

from ..models.models import SensorRecord


class SensorLogParser:
    FIELD_MAP = {
        "timestamp": ["timestamp", "time", "datetime", "时间"],
        "angle_of_attack": ["angle_of_attack", "aoa", "alpha", "攻角", "迎角"],
        "lift_force": ["lift_force", "lift", "升力"],
        "drag_force": ["drag_force", "drag", "阻力"],
        "pressure": ["pressure", "press", "压力"],
        "temperature": ["temperature", "temp", "温度"],
        "wind_speed": ["wind_speed", "ws", "风速"],
    }

    UNIT_PATTERNS = {
        "lift_force": re.compile(r'(N|kN|lbf|kgf|daN)', re.IGNORECASE),
        "drag_force": re.compile(r'(N|kN|lbf|kgf|daN)', re.IGNORECASE),
        "pressure": re.compile(r'(Pa|kPa|MPa|psi|bar)', re.IGNORECASE),
        "temperature": re.compile(r'(°C|°F|K|C|F)', re.IGNORECASE),
        "wind_speed": re.compile(r'(m/s|km/h|mph|knots|ft/s)', re.IGNORECASE),
    }

    STANDARD_UNITS = {
        "lift_force": "N",
        "drag_force": "N",
        "pressure": "kPa",
        "temperature": "°C",
        "wind_speed": "m/s",
    }

    def __init__(self):
        self.records: List[SensorRecord] = []

    def parse_file(self, filepath: str) -> List[SensorRecord]:
        path = Path(filepath)
        if not path.exists():
            raise FileNotFoundError(f"传感器日志文件不存在: {filepath}")

        suffix = path.suffix.lower()
        if suffix == ".csv":
            return self._parse_csv(filepath)
        elif suffix in (".txt", ".log", ".dat"):
            return self._parse_delimited(filepath)
        else:
            return self._parse_csv(filepath)

    def _parse_csv(self, filepath: str) -> List[SensorRecord]:
        records = []
        with open(filepath, "r", encoding="utf-8-sig") as f:
            reader = csv.reader(f)
            raw_lines = open(filepath, "r", encoding="utf-8-sig").readlines()

            header = None
            for i, row in enumerate(reader):
                line_text = raw_lines[i].rstrip("\n") if i < len(raw_lines) else ""

                if header is None:
                    header = [h.strip().lower() for h in row]
                    continue

                record = self._build_record(row, header, line_text, filepath, i + 1)
                if record is not None:
                    records.append(record)

        self.records = records
        return records

    def _parse_delimited(self, filepath: str) -> List[SensorRecord]:
        records = []
        with open(filepath, "r", encoding="utf-8-sig") as f:
            raw_lines = f.readlines()

        header = None
        for i, line in enumerate(raw_lines):
            stripped = line.strip()
            if not stripped or stripped.startswith("#"):
                continue

            parts = re.split(r'[,\t;|]+', stripped)

            if header is None:
                header = [h.strip().lower() for h in parts]
                continue

            record = self._build_record(parts, header, line.rstrip("\n"), filepath, i + 1)
            if record is not None:
                records.append(record)

        self.records = records
        return records

    def _build_record(self, values, header, raw_line, source_file, line_number) -> Optional[SensorRecord]:
        if len(values) < len(header):
            values.extend([""] * (len(header) - len(values)))

        col_map = self._map_columns(header)

        record = SensorRecord(
            raw_line=raw_line,
            source_file=source_file,
            line_number=line_number,
            timestamp=datetime.now(),
        )

        annotation_parts = []

        for field_name, col_idx in col_map.items():
            if col_idx is None or col_idx >= len(values):
                continue

            raw_val = values[col_idx].strip()

            if field_name == "timestamp":
                record.timestamp = self._parse_timestamp(raw_val)
            elif field_name in ("angle_of_attack", "lift_force", "drag_force", "pressure", "temperature", "wind_speed"):
                num_val, unit, annotation = self._extract_value_and_unit(raw_val, field_name)
                setattr(record, field_name, num_val)

                if field_name in ("lift_force", "drag_force", "pressure", "temperature", "wind_speed"):
                    unit_field = f"{field_name}_unit"
                    setattr(record, unit_field, unit)

                    if unit and unit != self.STANDARD_UNITS.get(field_name, ""):
                        record.has_unit_issue = True
                        record.unit_issue_detail += f"{field_name}: {unit}(期望{self.STANDARD_UNITS[field_name]}); "

                if annotation:
                    annotation_parts.append(annotation)

        record.raw_annotation = " | ".join(annotation_parts) if annotation_parts else ""
        return record

    def _map_columns(self, header: list) -> dict:
        col_map = {}
        for field, aliases in self.FIELD_MAP.items():
            col_map[field] = None
            for alias in aliases:
                for i, h in enumerate(header):
                    if alias in h.lower():
                        col_map[field] = i
                        break
                if col_map[field] is not None:
                    break
        return col_map

    TIMESTAMP_FORMATS = [
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d %H:%M:%S",
        "%Y/%m/%d %H:%M:%S",
        "%Y%m%d_%H%M%S",
        "%Y-%m-%dT%H:%M:%S.%f",
        "%Y-%m-%d %H:%M:%S.%f",
    ]

    def _parse_timestamp(self, raw: str) -> datetime:
        raw = raw.strip()
        for fmt in self.TIMESTAMP_FORMATS:
            try:
                return datetime.strptime(raw, fmt)
            except ValueError:
                continue
        try:
            return datetime.fromisoformat(raw)
        except (ValueError, TypeError):
            pass
        return datetime.now()

    def _extract_value_and_unit(self, raw: str, field_name: str) -> Tuple[Optional[float], str, str]:
        annotation = ""
        if not raw:
            return None, "", ""

        paren_match = re.search(r'\(([^)]*)\)', raw)
        if paren_match:
            annotation = paren_match.group(1)
            raw = raw[:paren_match.start()] + raw[paren_match.end():]

        bracket_match = re.search(r'\[([^\]]*)\]', raw)
        if bracket_match:
            annotation = (annotation + " " + bracket_match.group(1)).strip()
            raw = raw[:bracket_match.start()] + raw[bracket_match.end():]

        unit = ""
        if field_name in self.UNIT_PATTERNS:
            m = self.UNIT_PATTERNS[field_name].search(raw)
            if m:
                unit = m.group(1)
                raw = raw[:m.start()] + raw[m.end():]

        try:
            val = float(raw.strip().replace(",", ""))
        except ValueError:
            val = None

        return val, unit, annotation
