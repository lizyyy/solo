import csv
from typing import List
from pathlib import Path

from .base_parser import BaseParser, ParseResult
from ..models import ConfigItem, ExemptionRecord, SourceLocation, SourceTracker, ReviewStatus


class CsvParser(BaseParser):
    REQUIRED_CONFIG_COLUMNS = ['service_name', 'config_key', 'expected_value', 'actual_value']
    REQUIRED_EXEMPTION_COLUMNS = ['service_name', 'config_key', 'reason', 'expire_date']

    def parse_config_items(self, file_path: str) -> ParseResult[ConfigItem]:
        path = self._validate_file(file_path)
        result = ParseResult[ConfigItem](file_path=file_path)
        source_tracker = SourceTracker()

        with open(path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            self._validate_columns(reader.fieldnames, self.REQUIRED_CONFIG_COLUMNS, file_path)

            for row_num, row in enumerate(reader, start=2):
                try:
                    item = ConfigItem(
                        service_name=self._clean_value(row.get('service_name', '')),
                        config_key=self._clean_value(row.get('config_key', '')),
                        expected_value=self._clean_value(row.get('expected_value', '')),
                        actual_value=self._clean_value(row.get('actual_value', '')),
                        source_id=str(row_num),
                    )
                    result.items.append(item)
                    location = SourceLocation(
                        file_path=file_path,
                        row_number=row_num,
                        raw_content=str(row),
                    )
                    source_tracker.add_location(item.row_hash, location)
                except Exception as e:
                    location = SourceLocation(
                        file_path=file_path,
                        row_number=row_num,
                        raw_content=str(row),
                    )
                    source_tracker.add_bad_row(location)

        result.source_tracker = source_tracker
        result.sort_items()
        return result

    def _parse_status(self, status_str: str) -> ReviewStatus:
        status_map = {
            'pending': ReviewStatus.PENDING,
            'approved': ReviewStatus.APPROVED,
            'rejected': ReviewStatus.REJECTED,
            'expired': ReviewStatus.EXPIRED,
            'no_exemption': ReviewStatus.NO_EXEMPTION,
        }
        return status_map.get(status_str.lower(), ReviewStatus.PENDING)

    def parse_exemptions(self, file_path: str) -> ParseResult[ExemptionRecord]:
        path = self._validate_file(file_path)
        result = ParseResult[ExemptionRecord](file_path=file_path)
        source_tracker = SourceTracker()

        with open(path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            self._validate_columns(reader.fieldnames, self.REQUIRED_EXEMPTION_COLUMNS, file_path)

            for row_num, row in enumerate(reader, start=2):
                try:
                    status_str = self._clean_value(row.get('status', ''))
                    status = self._parse_status(status_str) if status_str else ReviewStatus.PENDING
                    record = ExemptionRecord(
                        service_name=self._clean_value(row.get('service_name', '')),
                        config_key=self._clean_value(row.get('config_key', '')),
                        reason=self._clean_value(row.get('reason', '')),
                        expire_date=self._clean_value(row.get('expire_date', '')),
                        reviewer=self._clean_value(row.get('reviewer', '')),
                        status=status,
                    )
                    result.items.append(record)
                    location = SourceLocation(
                        file_path=file_path,
                        row_number=row_num,
                        raw_content=str(row),
                    )
                    source_tracker.add_location(record.exemption_id, location)
                except Exception as e:
                    location = SourceLocation(
                        file_path=file_path,
                        row_number=row_num,
                        raw_content=str(row),
                    )
                    source_tracker.add_bad_row(location)

        result.source_tracker = source_tracker
        result.sort_items()
        return result

    def _clean_value(self, value: str) -> str:
        return value.strip() if value else ''

    def _validate_columns(self, actual_columns: List[str], required_columns: List[str], file_path: str):
        missing = set(required_columns) - set(actual_columns or [])
        if missing:
            raise ValueError(
                f"Missing required columns in {file_path}: {', '.join(missing)}. "
                f"Required columns: {', '.join(required_columns)}"
            )
