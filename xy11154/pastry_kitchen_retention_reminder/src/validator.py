from datetime import datetime
from typing import List, Dict, Set
from collections import defaultdict
from .parser import RetentionRecord

class ValidationResult:
    def __init__(self):
        self.duplicate_box_numbers: Dict[str, List[RetentionRecord]] = defaultdict(list)
        self.invalid_date_records: List[RetentionRecord] = []
        self.future_date_records: List[RetentionRecord] = []
        self.parse_error_records: List[RetentionRecord] = []
        self.valid_records: List[RetentionRecord] = []
    
    def has_errors(self) -> bool:
        return any([
            self.duplicate_box_numbers,
            self.invalid_date_records,
            self.future_date_records,
            self.parse_error_records
        ])
    
    def to_dict(self) -> Dict:
        return {
            'duplicate_box_numbers': {
                box_num: [r.to_dict() for r in records]
                for box_num, records in self.duplicate_box_numbers.items()
            },
            'invalid_date_records': [r.to_dict() for r in self.invalid_date_records],
            'future_date_records': [r.to_dict() for r in self.future_date_records],
            'parse_error_records': [r.to_dict() for r in self.parse_error_records],
            'valid_count': len(self.valid_records)
        }

class RetentionValidator:
    def __init__(self, config: Dict):
        self.config = config
        self.strict_mode = config.get('strict_mode', False)
    
    def validate(self, records: List[RetentionRecord]) -> ValidationResult:
        result = ValidationResult()
        box_number_map: Dict[str, List[RetentionRecord]] = defaultdict(list)
        today = datetime.now()
        
        for record in records:
            if record.parse_errors:
                result.parse_error_records.append(record)
                continue
            
            box_number_map[record.box_number].append(record)
            
            if record.parsed_date:
                if record.parsed_date > today:
                    result.future_date_records.append(record)
                else:
                    result.valid_records.append(record)
            else:
                result.invalid_date_records.append(record)
        
        for box_num, box_records in box_number_map.items():
            if len(box_records) > 1:
                result.duplicate_box_numbers[box_num] = box_records
                for r in box_records:
                    if r not in result.parse_error_records and r not in result.invalid_date_records:
                        if r in result.valid_records:
                            result.valid_records.remove(r)
        
        return result
    
    def get_unique_valid_records(self, records: List[RetentionRecord]) -> List[RetentionRecord]:
        seen_boxes: Set[str] = set()
        unique_records: List[RetentionRecord] = []
        
        for record in sorted(records, key=lambda r: (r.box_number, r.parsed_date or datetime.min)):
            if record.parse_errors:
                continue
            if record.box_number not in seen_boxes:
                seen_boxes.add(record.box_number)
                unique_records.append(record)
        
        return unique_records
