import hashlib
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

from ..parsers.parser import ParsedRecord, ParseError


@dataclass
class SourceLocation:
    file_path: str
    line_number: int
    file_hash: str = ""

    def __post_init__(self):
        if not self.file_hash and Path(self.file_path).exists():
            self.file_hash = self._calculate_file_hash(self.file_path)

    def _calculate_file_hash(self, file_path: str) -> str:
        hasher = hashlib.sha256()
        with open(file_path, 'rb') as f:
            for chunk in iter(lambda: f.read(8192), b''):
                hasher.update(chunk)
        return hasher.hexdigest()[:16]

    def to_string(self) -> str:
        return f"{self.file_path}:{self.line_number}"


@dataclass
class TrackedRecord:
    record: Optional[ParsedRecord]
    error: Optional[ParseError]
    source_location: SourceLocation
    record_id: str = ""
    deduplication_key: str = ""

    def __post_init__(self):
        if not self.record_id:
            self.record_id = self._generate_record_id()
        if not self.deduplication_key:
            self.deduplication_key = self._generate_deduplication_key()

    def _generate_record_id(self) -> str:
        if self.record:
            content = f"{self.record.api_path}:{self.record.subscriber}:{self.record.batch_id}:{self.source_location.to_string()}"
        elif self.error:
            content = f"{self.error.file_path}:{self.error.line_number}:{self.error.raw_content}"
        else:
            content = self.source_location.to_string()
        
        return hashlib.sha256(content.encode('utf-8')).hexdigest()[:12]

    def _generate_deduplication_key(self) -> str:
        if self.record:
            return f"{self.record.api_path}:{self.record.subscriber}:{self.record.change_type.value}:{self.record.batch_id}"
        elif self.error:
            return f"error:{self.error.file_path}:{self.error.line_number}"
        else:
            return f"empty:{self.source_location.to_string()}"

    def is_valid(self) -> bool:
        return self.record is not None and self.record.is_valid

    def to_dict(self) -> Dict[str, Any]:
        return {
            "record_id": self.record_id,
            "deduplication_key": self.deduplication_key,
            "source_location": self.source_location.to_string(),
            "file_hash": self.source_location.file_hash,
            "is_valid": self.is_valid(),
            "record": self.record.to_dict() if self.record else None,
            "error": {
                "file_path": self.error.file_path,
                "line_number": self.error.line_number,
                "raw_content": self.error.raw_content,
                "error_message": self.error.error_message
            } if self.error else None
        }


class SourceTracker:
    def __init__(self):
        self.tracked_records: List[TrackedRecord] = []
        self._record_index: Dict[str, TrackedRecord] = {}
        self._source_index: Dict[str, List[TrackedRecord]] = {}

    def track(self, records: List[ParsedRecord], errors: List[ParseError]) -> List[TrackedRecord]:
        tracked = []

        for record in records:
            location = SourceLocation(
                file_path=record.source_file,
                line_number=record.source_line
            )
            tracked_record = TrackedRecord(
                record=record,
                error=None,
                source_location=location
            )
            tracked.append(tracked_record)
            self._add_to_index(tracked_record)

        for error in errors:
            location = SourceLocation(
                file_path=error.file_path,
                line_number=error.line_number
            )
            tracked_record = TrackedRecord(
                record=None,
                error=error,
                source_location=location
            )
            tracked.append(tracked_record)
            self._add_to_index(tracked_record)

        self.tracked_records.extend(tracked)
        return self._get_stable_sorted(tracked)

    def _add_to_index(self, tracked_record: TrackedRecord):
        self._record_index[tracked_record.record_id] = tracked_record
        
        source_key = tracked_record.source_location.to_string()
        if source_key not in self._source_index:
            self._source_index[source_key] = []
        self._source_index[source_key].append(tracked_record)

    def _get_stable_sorted(self, records: List[TrackedRecord]) -> List[TrackedRecord]:
        return sorted(records, key=lambda r: (
            r.source_location.file_path,
            r.source_location.line_number,
            r.record_id
        ))

    def get_all_tracked(self) -> List[TrackedRecord]:
        return self._get_stable_sorted(self.tracked_records)

    def get_by_record_id(self, record_id: str) -> Optional[TrackedRecord]:
        return self._record_index.get(record_id)

    def get_by_source(self, file_path: str, line_number: Optional[int] = None) -> List[TrackedRecord]:
        if line_number:
            key = f"{file_path}:{line_number}"
            return self._source_index.get(key, [])
        
        results = []
        for key, records in self._source_index.items():
            if key.startswith(f"{file_path}:"):
                results.extend(records)
        return self._get_stable_sorted(results)

    def get_valid_records(self) -> List[TrackedRecord]:
        valid = [r for r in self.tracked_records if r.is_valid()]
        return self._get_stable_sorted(valid)

    def get_errors(self) -> List[TrackedRecord]:
        errors = [r for r in self.tracked_records if r.error is not None]
        return self._get_stable_sorted(errors)

    def get_deduplication_groups(self) -> Dict[str, List[TrackedRecord]]:
        groups: Dict[str, List[TrackedRecord]] = {}
        for record in self.tracked_records:
            key = record.deduplication_key
            if key not in groups:
                groups[key] = []
            groups[key].append(record)
        
        for key in groups:
            groups[key] = self._get_stable_sorted(groups[key])
        
        return dict(sorted(groups.items()))

    def find_duplicates(self) -> Dict[str, List[TrackedRecord]]:
        groups = self.get_deduplication_groups()
        return {k: v for k, v in groups.items() if len(v) > 1}
