import csv
import os
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from datetime import datetime


@dataclass
class SourceLocation:
    file_path: str
    line_number: int
    raw_content: str


@dataclass
class ParsedRecord:
    data: Dict[str, Any]
    source: SourceLocation
    is_valid: bool
    errors: List[str] = field(default_factory=list)


@dataclass
class ParseResult:
    valid_records: List[ParsedRecord]
    invalid_records: List[ParsedRecord]
    total_lines: int
    file_path: str


class BackupCSVParser:
    REQUIRED_FIELDS = [
        'customer_name',
        'repair_order_id',
        'backup_device_id',
        'deposit_amount',
        'borrow_date',
        'expected_return_date'
    ]
    
    OPTIONAL_FIELDS = [
        'actual_return_date',
        'damage_check_result',
        'damage_description',
        'damage_charge_amount',
        'notes'
    ]

    def __init__(self, date_format: str = '%Y-%m-%d'):
        self.date_format = date_format

    def parse_file(self, file_path: str) -> ParseResult:
        abs_path = os.path.abspath(file_path)
        valid_records: List[ParsedRecord] = []
        invalid_records: List[ParsedRecord] = []
        total_lines = 0

        with open(abs_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.reader(f)
            headers = []
            
            for line_num, row in enumerate(reader, 1):
                total_lines = line_num
                
                if line_num == 1:
                    headers = [h.strip() for h in row]
                    continue
                
                raw_content = ','.join(row)
                source = SourceLocation(
                    file_path=abs_path,
                    line_number=line_num,
                    raw_content=raw_content
                )
                
                record = self._parse_row(row, headers, source)
                
                if record.is_valid:
                    valid_records.append(record)
                else:
                    invalid_records.append(record)

        valid_records.sort(key=lambda r: (
            r.data.get('repair_order_id', ''),
            r.data.get('backup_device_id', '')
        ))

        return ParseResult(
            valid_records=valid_records,
            invalid_records=invalid_records,
            total_lines=total_lines,
            file_path=abs_path
        )

    def _parse_row(self, row: List[str], headers: List[str], source: SourceLocation) -> ParsedRecord:
        data: Dict[str, Any] = {}
        errors: List[str] = []

        row_dict = {headers[i]: row[i].strip() if i < len(row) else '' 
                   for i in range(len(headers))}

        for field in self.REQUIRED_FIELDS:
            value = row_dict.get(field, '').strip()
            if not value:
                errors.append(f"缺少必填字段: {field}")
            else:
                data[field] = value

        if not errors:
            try:
                data['borrow_date'] = datetime.strptime(
                    data['borrow_date'], self.date_format
                ).date()
            except ValueError:
                errors.append(f"借用日期格式错误: {data.get('borrow_date')}")

            try:
                data['expected_return_date'] = datetime.strptime(
                    data['expected_return_date'], self.date_format
                ).date()
            except ValueError:
                errors.append(f"预计归还日期格式错误: {data.get('expected_return_date')}")

            try:
                data['deposit_amount'] = float(data['deposit_amount'])
                if data['deposit_amount'] < 0:
                    errors.append(f"押金金额不能为负: {data['deposit_amount']}")
            except (ValueError, TypeError):
                errors.append(f"押金金额格式错误: {data.get('deposit_amount')}")

        for field in self.OPTIONAL_FIELDS:
            value = row_dict.get(field, '').strip()
            if value:
                if field == 'actual_return_date':
                    try:
                        data[field] = datetime.strptime(value, self.date_format).date()
                    except ValueError:
                        errors.append(f"实际归还日期格式错误: {value}")
                elif field == 'damage_charge_amount':
                    try:
                        data[field] = float(value)
                    except ValueError:
                        pass
                else:
                    data[field] = value

        return ParsedRecord(
            data=data,
            source=source,
            is_valid=len(errors) == 0,
            errors=errors
        )
