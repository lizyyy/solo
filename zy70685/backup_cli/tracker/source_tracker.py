from dataclasses import dataclass, field
from typing import List, Dict, Any, Set, Tuple
from collections import defaultdict
import hashlib
import json

from backup_cli.parser.csv_parser import ParsedRecord, ParseResult
from backup_cli.rules.engine import ProcessedRecord


@dataclass
class SourceTrace:
    file_path: str
    line_number: int
    raw_content: str
    record_id: str
    validation_errors: List[str] = field(default_factory=list)


@dataclass
class ValidationSummary:
    total_records: int
    valid_records: int
    invalid_records: int
    duplicate_ids: List[Tuple[str, List[int]]]
    unique_devices: int
    unique_repair_orders: int
    total_deposit: float


class SourceTracker:
    def __init__(self):
        self.traces: List[SourceTrace] = []
        self.record_hashes: Set[str] = set()
        self.repair_order_map: Dict[str, List[SourceTrace]] = defaultdict(list)
        self.device_map: Dict[str, List[SourceTrace]] = defaultdict(list)
        self.valid_records_map: Dict[str, ParsedRecord] = {}

    def track_parse_result(self, parse_result: ParseResult) -> None:
        all_records = parse_result.valid_records + parse_result.invalid_records
        
        for record in all_records:
            trace = SourceTrace(
                file_path=record.source.file_path,
                line_number=record.source.line_number,
                raw_content=record.source.raw_content,
                record_id=self._generate_record_id(record),
                validation_errors=record.errors if not record.is_valid else []
            )
            
            self.traces.append(trace)
            
            if record.is_valid:
                repair_id = record.data.get('repair_order_id', '')
                device_id = record.data.get('backup_device_id', '')
                
                if repair_id:
                    self.repair_order_map[repair_id].append(trace)
                if device_id:
                    self.device_map[device_id].append(trace)
                    self.valid_records_map[f"{device_id}:{trace.line_number}"] = record

    def _generate_record_id(self, record: ParsedRecord) -> str:
        content = json.dumps(record.data, sort_keys=True, default=str)
        return hashlib.md5(f"{record.source.file_path}:{record.source.line_number}:{content}".encode()).hexdigest()[:12]

    def get_duplicate_check(self) -> List[Tuple[str, List[int]]]:
        duplicates = []
        
        for repair_id, traces in self.repair_order_map.items():
            if len(traces) > 1:
                lines = [t.line_number for t in traces]
                duplicates.append((f"维修单 {repair_id}", lines))
        
        for device_id, traces in self.device_map.items():
            active_traces = [t for t in traces if self._is_active_record(t, device_id)]
            if len(active_traces) > 1:
                lines = [t.line_number for t in active_traces]
                duplicates.append((f"备机 {device_id} 同时被借用", lines))
        
        return duplicates

    def _is_active_record(self, trace: SourceTrace, device_id: str) -> bool:
        record_key = f"{device_id}:{trace.line_number}"
        if record_key in self.valid_records_map:
            record = self.valid_records_map[record_key]
            return 'actual_return_date' not in record.data or \
                   record.data.get('actual_return_date') is None
        return True

    def get_validation_summary(self, processed_records: List[ProcessedRecord]) -> ValidationSummary:
        total_records = len(self.traces)
        valid_records = len([t for t in self.traces if not t.validation_errors])
        invalid_records = total_records - valid_records
        duplicates = self.get_duplicate_check()
        unique_devices = len(self.device_map)
        unique_repair_orders = len(self.repair_order_map)
        
        total_deposit = sum(
            r.original_record.data.get('deposit_amount', 0.0)
            for r in processed_records
        )
        
        return ValidationSummary(
            total_records=total_records,
            valid_records=valid_records,
            invalid_records=invalid_records,
            duplicate_ids=duplicates,
            unique_devices=unique_devices,
            unique_repair_orders=unique_repair_orders,
            total_deposit=total_deposit
        )

    def get_trace_by_repair_order(self, repair_order_id: str) -> List[SourceTrace]:
        return self.repair_order_map.get(repair_order_id, [])

    def get_trace_by_device(self, device_id: str) -> List[SourceTrace]:
        return self.device_map.get(device_id, [])

    def get_all_invalid_traces(self) -> List[SourceTrace]:
        return [t for t in self.traces if t.validation_errors]
