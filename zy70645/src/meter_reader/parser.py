import csv
import os
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any
from pathlib import Path


@dataclass
class Record:
    household_id: str
    meter_number: str
    last_reading: float
    current_reading: float
    multiplier: float
    source_file: str
    row_number: int
    is_valid: bool = True
    errors: List[str] = field(default_factory=list)
    raw_data: Dict[str, str] = field(default_factory=dict)

    @property
    def usage(self) -> float:
        if self.is_valid:
            return (self.current_reading - self.last_reading) * self.multiplier
        return 0.0


@dataclass
class ParseResult:
    records: List[Record] = field(default_factory=list)
    bad_records: List[Record] = field(default_factory=list)
    source_files: List[str] = field(default_factory=list)

    def all_records(self) -> List[Record]:
        return sorted(self.records + self.bad_records, key=lambda r: (r.source_file, r.row_number))


class CSVParser:
    REQUIRED_FIELDS = ['住户', '表号', '上月读数', '本月读数', '倍率']

    def __init__(self, encoding: str = 'utf-8'):
        self.encoding = encoding

    def parse_file(self, file_path: str) -> ParseResult:
        file_path = os.path.abspath(file_path)
        result = ParseResult()
        result.source_files.append(file_path)

        with open(file_path, 'r', encoding=self.encoding, errors='replace') as f:
            content = f.readlines()

        if not content:
            return result

        dialect = csv.Sniffer().sniff(content[0]) if len(content) > 0 else csv.excel
        reader = csv.DictReader(content, dialect=dialect)
        
        actual_fields = [f.strip() for f in reader.fieldnames] if reader.fieldnames else []
        field_mapping = self._map_fields(actual_fields)

        for row_num, row in enumerate(reader, start=2):
            raw_data = {k.strip(): v.strip() if v else '' for k, v in row.items()}
            record = self._parse_row(raw_data, file_path, row_num, field_mapping)
            if record.is_valid:
                result.records.append(record)
            else:
                result.bad_records.append(record)

        return result

    def parse_files(self, file_paths: List[str]) -> ParseResult:
        combined = ParseResult()
        for path in file_paths:
            file_result = self.parse_file(path)
            combined.records.extend(file_result.records)
            combined.bad_records.extend(file_result.bad_records)
            combined.source_files.extend(file_result.source_files)
        return combined

    def _map_fields(self, actual_fields: List[str]) -> Dict[str, str]:
        mapping = {}
        for required in self.REQUIRED_FIELDS:
            for actual in actual_fields:
                if required in actual or actual in required:
                    mapping[required] = actual
                    break
        return mapping

    def _parse_row(self, raw_data: Dict[str, str], source_file: str, row_number: int, field_mapping: Dict[str, str]) -> Record:
        errors = []
        
        household_id = raw_data.get(field_mapping.get('住户', '住户'), '').strip()
        meter_number = raw_data.get(field_mapping.get('表号', '表号'), '').strip()
        
        last_reading_str = raw_data.get(field_mapping.get('上月读数', '上月读数'), '').strip()
        current_reading_str = raw_data.get(field_mapping.get('本月读数', '本月读数'), '').strip()
        multiplier_str = raw_data.get(field_mapping.get('倍率', '倍率'), '').strip()

        if not household_id:
            errors.append('住户标识为空')
        if not meter_number:
            errors.append('表号为空')

        try:
            last_reading = float(last_reading_str) if last_reading_str else 0.0
        except ValueError:
            errors.append(f'上月读数格式错误: {last_reading_str}')
            last_reading = 0.0

        try:
            current_reading = float(current_reading_str) if current_reading_str else 0.0
        except ValueError:
            errors.append(f'本月读数格式错误: {current_reading_str}')
            current_reading = 0.0

        try:
            multiplier = float(multiplier_str) if multiplier_str else 1.0
        except ValueError:
            errors.append(f'倍率格式错误: {multiplier_str}')
            multiplier = 1.0

        if current_reading < last_reading and current_reading > 0 and last_reading > 0:
            errors.append(f'本月读数({current_reading})小于上月读数({last_reading})')

        is_valid = len(errors) == 0

        return Record(
            household_id=household_id,
            meter_number=meter_number,
            last_reading=last_reading,
            current_reading=current_reading,
            multiplier=multiplier,
            source_file=source_file,
            row_number=row_number,
            is_valid=is_valid,
            errors=errors,
            raw_data=raw_data
        )
