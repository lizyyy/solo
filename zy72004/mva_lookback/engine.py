import os
from datetime import datetime
from typing import Dict, List, Optional

from .conflicts import ConflictDetector
from .loader import DataLoader
from .models import (
    AttachmentIndex,
    BaseRecord,
    ConflictEntry,
    ConflictStatus,
    JudgmentChange,
    LookbackResult,
    RecordType,
)
from .report import ReportGenerator
from .store import PersistenceStore


class LookbackEngine:
    def __init__(self, store_dir: Optional[str] = None, output_dir: Optional[str] = None):
        base = os.getcwd()
        self.store_dir = store_dir or os.path.join(base, ".mva_store")
        self.output_dir = output_dir or os.path.join(base, "output")

        self.loader = DataLoader()
        self.detector = ConflictDetector()
        self.store = PersistenceStore(self.store_dir)
        self.reporter = ReportGenerator(self.output_dir)

        self.records: List[BaseRecord] = []
        self.attachments: List[AttachmentIndex] = []
        self.conflicts: List[ConflictEntry] = []
        self.judgment_changes: List[JudgmentChange] = []

    def load_data(self, path: str) -> Dict:
        if os.path.isdir(path):
            rec_count, att_count = self.loader.load_directory(path)
        elif path.endswith(".csv"):
            rec_count = self.loader.load_csv(path)
            att_count = 0
        else:
            return {
                "success": False,
                "message": f"不支持的文件格式：{path}，请提供 CSV 文件或目录。",
            }

        self.records = self.loader.records
        self.attachments = self.loader.attachments

        return {
            "success": True,
            "record_count": rec_count,
            "attachment_count": att_count,
            "load_errors": self.loader.load_errors,
        }

    def run(self, source_priority: Optional[List[str]] = None) -> LookbackResult:
        run_id = datetime.now().strftime("%Y%m%d%H%M%S")

        self.detector = ConflictDetector()

        self.detector.detect_duplicate_claims(self.records)
        self.detector.detect_data_mismatch(self.records, source_priority)
        self.detector.detect_null_fields(self.records)
        self.detector.detect_boundary_records(self.records)

        _, late_changes = self.detector.process_late_attachments(
            self.records, self.attachments
        )

        self.conflicts = self.detector.get_all_conflicts()
        self.judgment_changes = late_changes

        summary_amount = 0.0
        exception_amount = 0.0
        conflict_record_ids = set()
        for c in self.conflicts:
            conflict_record_ids.update(c.record_ids)

        for r in self.records:
            if r.record_type == RecordType.PAYMENT and r.amount is not None:
                summary_amount += r.amount
                if r.record_id in conflict_record_ids:
                    exception_amount += r.amount

        duplicate_count = len(self.detector.get_conflicts_by_type(ConflictStatus.DUPLICATE_CLAIM))
        late_count = len(self.detector.get_conflicts_by_type(ConflictStatus.LATE_ATTACHMENT))
        null_count = len(self.detector.get_conflicts_by_type(ConflictStatus.NULL_FIELD))
        boundary_count = len(self.detector.get_conflicts_by_type(ConflictStatus.BOUNDARY))

        result = LookbackResult(
            run_id=run_id,
            run_at=datetime.now().isoformat(),
            total_records=len(self.records),
            conflict_count=len(self.conflicts),
            duplicate_claim_count=duplicate_count,
            late_attachment_count=late_count,
            null_field_count=null_count,
            boundary_count=boundary_count,
            judgment_changes=self.judgment_changes,
            conflicts=self.conflicts,
            summary_amount=round(summary_amount, 2),
            exception_amount=round(exception_amount, 2),
        )

        self.store.save_result(result)
        if self.judgment_changes:
            self.store.save_judgment_changes(self.judgment_changes, run_id)

        return result

    def print_summary(self, result: LookbackResult) -> str:
        return self.reporter.print_terminal_summary(result)

    def save_detail_report(self, result: LookbackResult) -> str:
        return self.reporter.generate_detail_report(result)

    def verify_integrity(self) -> Dict:
        integrity = self.store.verify_integrity()
        previous_notes = self.store.load_all_notes()
        report_path = self.reporter.generate_integrity_report(integrity, previous_notes)
        return {
            "integrity": integrity,
            "report_path": report_path,
        }

    def add_note(self, record_id: str, content: str, author: str = "阿宁") -> str:
        return self.store.save_note(record_id, content, author)

    def query_record(self, record_id: str) -> Dict:
        record = None
        for r in self.records:
            if r.record_id == record_id:
                record = r
                break

        notes = self.store.load_notes_for_record(record_id)
        related_conflicts = [c for c in self.conflicts if record_id in c.record_ids]
        related_changes = [c for c in self.judgment_changes if c.record_id == record_id]

        return {
            "record": record,
            "notes": notes,
            "conflicts": related_conflicts,
            "judgment_changes": related_changes,
        }
