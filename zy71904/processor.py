import hashlib
import json
import os
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from collections import defaultdict

from models import (
    DrumRecord,
    ProcessedRecord,
    ProcessingResult,
    RecordStatus,
    DuplicateReason,
    Student
)


class RecordProcessor:
    def __init__(self, storage_path: str = "./data"):
        self.storage_path = storage_path
        self.processed_records_file = os.path.join(storage_path, "processed_records.json")
        self._ensure_storage()
        self.processed_records: Dict[str, ProcessedRecord] = self._load_processed_records()

    def _ensure_storage(self) -> None:
        if not os.path.exists(self.storage_path):
            os.makedirs(self.storage_path)

    def _load_processed_records(self) -> Dict[str, ProcessedRecord]:
        if not os.path.exists(self.processed_records_file):
            return {}
        
        with open(self.processed_records_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        records = {}
        for record_id, record_data in data.items():
            student = Student(
                student_id=record_data['student_id'],
                name=record_data['student_name'],
                section=record_data['section'],
                voice_part=record_data['voice_part']
            )
            drum_record = DrumRecord(
                record_id=record_data['record_id'],
                student=student,
                practice_date=record_data['practice_date'],
                practice_content=record_data['practice_content'],
                rhythm_accuracy=record_data['rhythm_accuracy'],
                tempo_stability=record_data['tempo_stability'],
                overall_score=record_data['overall_score'],
                teacher_notes=record_data.get('teacher_notes', ''),
                accompanist_notes=record_data.get('accompanist_notes', ''),
                batch_id=record_data.get('batch_id', ''),
                source_file=record_data.get('source_file', ''),
                content_hash=record_data.get('content_hash', ''),
                imported_at=datetime.fromisoformat(record_data['imported_at'])
            )
            
            status = RecordStatus(record_data['status'])
            dup_reason = None
            if record_data.get('duplicate_reason'):
                dup_reason = DuplicateReason(record_data['duplicate_reason'])
            
            processed = ProcessedRecord(
                record=drum_record,
                status=status,
                duplicate_of=record_data.get('duplicate_of'),
                duplicate_reason=dup_reason,
                review_notes=record_data.get('review_notes', []),
                processed_at=datetime.fromisoformat(record_data['processed_at']),
                processed_by=record_data.get('processed_by', 'system')
            )
            records[record_id] = processed
        
        return records

    def _save_processed_records(self) -> None:
        data = {
            record_id: record.to_dict()
            for record_id, record in self.processed_records.items()
        }
        with open(self.processed_records_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def calculate_content_hash(self, record: DrumRecord) -> str:
        content = f"{record.student.unique_key()}|{record.practice_date}|{record.practice_content}|{record.rhythm_accuracy}|{record.tempo_stability}|{record.overall_score}"
        return hashlib.md5(content.encode('utf-8')).hexdigest()

    def check_duplicate(self, record: DrumRecord, batch_id: str) -> Tuple[bool, Optional[str], Optional[DuplicateReason]]:
        record.content_hash = self.calculate_content_hash(record)

        for existing_id, existing in self.processed_records.items():
            if existing.status == RecordStatus.DUPLICATE:
                continue
            
            if existing.record.content_hash == record.content_hash:
                return True, existing_id, DuplicateReason.CONTENT_HASH_MATCH
            
            if (existing.record.student.unique_key() == record.student.unique_key() and
                existing.record.practice_date == record.practice_date and
                existing.record.batch_id == batch_id):
                return True, existing_id, DuplicateReason.SAME_BATCH

        return False, None, None

    def check_same_day_practice(self, record: DrumRecord) -> List[ProcessedRecord]:
        same_day = []
        for existing in self.processed_records.values():
            if (existing.status != RecordStatus.DUPLICATE and
                existing.record.student.unique_key() == record.student.unique_key() and
                existing.record.practice_date == record.practice_date):
                same_day.append(existing)
        return same_day

    def process_batch(self, records: List[DrumRecord], batch_id: str, source_file: str = "") -> ProcessingResult:
        new_records = 0
        duplicate_records = 0
        conflict_records = 0
        processed_list: List[ProcessedRecord] = []

        for record in records:
            record.batch_id = batch_id
            record.source_file = source_file
            
            is_dup, dup_of, dup_reason = self.check_duplicate(record, batch_id)
            
            if is_dup:
                processed = ProcessedRecord(
                    record=record,
                    status=RecordStatus.DUPLICATE,
                    duplicate_of=dup_of,
                    duplicate_reason=dup_reason
                )
                duplicate_records += 1
            else:
                same_day = self.check_same_day_practice(record)
                if same_day:
                    notes = [
                        f"注意：该学生{record.practice_date}已有{len(same_day)}条练习记录",
                        f"请人工确认是否为重复统计"
                    ]
                    processed = ProcessedRecord(
                        record=record,
                        status=RecordStatus.CONFLICT,
                        review_notes=notes
                    )
                    conflict_records += 1
                else:
                    processed = ProcessedRecord(
                        record=record,
                        status=RecordStatus.PROCESSED
                    )
                    new_records += 1
            
            self.processed_records[record.record_id] = processed
            processed_list.append(processed)

        self._save_processed_records()

        return ProcessingResult(
            batch_id=batch_id,
            total_records=len(records),
            new_records=new_records,
            duplicate_records=duplicate_records,
            conflict_records=conflict_records,
            processed_records=processed_list
        )

    def get_record_by_id(self, record_id: str) -> Optional[ProcessedRecord]:
        return self.processed_records.get(record_id)

    def get_records_by_student(self, student_key: str) -> List[ProcessedRecord]:
        return [
            r for r in self.processed_records.values()
            if r.record.student.unique_key() == student_key
        ]

    def get_records_by_date(self, practice_date: str) -> List[ProcessedRecord]:
        return [
            r for r in self.processed_records.values()
            if r.record.practice_date == practice_date
        ]

    def get_records_by_status(self, status: RecordStatus) -> List[ProcessedRecord]:
        return [
            r for r in self.processed_records.values()
            if r.status == status
        ]

    def get_records_by_batch(self, batch_id: str) -> List[ProcessedRecord]:
        return [
            r for r in self.processed_records.values()
            if r.record.batch_id == batch_id
        ]

    def resolve_conflict(self, record_id: str, is_duplicate: bool, reviewer: str, notes: str = "") -> bool:
        if record_id not in self.processed_records:
            return False
        
        record = self.processed_records[record_id]
        if record.status != RecordStatus.CONFLICT:
            return False
        
        if is_duplicate:
            record.status = RecordStatus.DUPLICATE
            record.duplicate_reason = DuplicateReason.MANUAL_MARK
        else:
            record.status = RecordStatus.PROCESSED
        
        record.review_notes.append(f"[{datetime.now().isoformat()}] {reviewer}: {notes}")
        record.processed_by = reviewer
        
        self._save_processed_records()
        return True

    def mark_as_duplicate(self, record_id: str, duplicate_of: str, reviewer: str, reason: str = "") -> bool:
        if record_id not in self.processed_records or duplicate_of not in self.processed_records:
            return False
        
        record = self.processed_records[record_id]
        record.status = RecordStatus.DUPLICATE
        record.duplicate_of = duplicate_of
        record.duplicate_reason = DuplicateReason.MANUAL_MARK
        record.review_notes.append(f"[{datetime.now().isoformat()}] {reviewer}标记为重复: {reason}")
        record.processed_by = reviewer
        
        self._save_processed_records()
        return True
