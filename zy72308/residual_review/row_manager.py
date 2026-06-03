"""行管理：删除、断档检测、补录"""

from datetime import datetime
from typing import List, Tuple, Optional

from .models import OriginalRow, RowStatus, ImportRecord
from .storage import StorageManager


class RowManager:
    def __init__(self, storage: StorageManager):
        self.storage = storage

    def delete_row(self, import_id: str, original_line_no: int, notes: str = "") -> ImportRecord:
        record = self.storage.load_record(import_id)
        if not record:
            raise ValueError(f"Record {import_id} not found")

        row = self._find_row_by_original_no(record.rows, original_line_no)
        if not row:
            raise ValueError(f"Row {original_line_no} not found")

        row.status = RowStatus.DELETED
        row.current_line_no = None
        row.deleted_at = datetime.now()
        row.notes = notes or "人工删除"

        self._update_current_line_numbers(record.rows)
        self._detect_gaps(record)

        self.storage.save_record(record)
        return record

    def supplement_row(
        self,
        import_id: str,
        original_line_no: int,
        x_value: float,
        y_value: float,
        notes: str = "",
    ) -> ImportRecord:
        record = self.storage.load_record(import_id)
        if not record:
            raise ValueError(f"Record {import_id} not found")

        row = self._find_row_by_original_no(record.rows, original_line_no)
        if not row:
            raise ValueError(f"Row {original_line_no} not found")

        if row.status not in [RowStatus.DELETED, RowStatus.GAP]:
            raise ValueError(f"Row {original_line_no} is not in deleted/gap status")

        row.status = RowStatus.SUPPLEMENTED
        row.x_value = x_value
        row.y_value = y_value
        row.supplemented_at = datetime.now()
        row.notes = notes or "补录数据"

        self._update_current_line_numbers(record.rows)
        self._detect_gaps(record)

        self.storage.save_record(record)
        return record

    def _find_row_by_original_no(
        self, rows: List[OriginalRow], original_line_no: int
    ) -> Optional[OriginalRow]:
        for row in rows:
            if row.original_line_no == original_line_no:
                return row
        return None

    def _update_current_line_numbers(self, rows: List[OriginalRow]):
        sorted_rows = sorted(rows, key=lambda r: r.original_line_no)
        current_line = 1
        for row in sorted_rows:
            if row.status in [RowStatus.NORMAL, RowStatus.SUPPLEMENTED]:
                row.current_line_no = current_line
                current_line += 1
            else:
                row.current_line_no = None

    def _detect_gaps(self, record: ImportRecord):
        sorted_rows = sorted(record.rows, key=lambda r: r.original_line_no)
        expected_line = 1

        for row in sorted_rows:
            if row.status == RowStatus.DELETED:
                if expected_line < row.original_line_no:
                    pass
                expected_line = row.original_line_no + 1
            elif row.status in [RowStatus.NORMAL, RowStatus.SUPPLEMENTED]:
                expected_line = row.original_line_no + 1

        for row in sorted_rows:
            if row.status == RowStatus.DELETED:
                row.status = RowStatus.GAP
                row.notes = f"编号断档（原始行号{row.original_line_no}）- 待教研组复核"

    def get_gap_summary(self, import_id: str) -> List[dict]:
        record = self.storage.load_record(import_id)
        if not record:
            return []

        gaps = []
        for row in record.rows:
            if row.status in [RowStatus.GAP, RowStatus.DELETED]:
                gaps.append(
                    {
                        "original_line_no": row.original_line_no,
                        "status": row.status.value,
                        "deleted_at": row.deleted_at.isoformat() if row.deleted_at else None,
                        "notes": row.notes,
                    }
                )
        return gaps

    def add_annotation(
        self, import_id: str, original_line_no: int, annotation: str, author: str = "阿岚"
    ) -> ImportRecord:
        record = self.storage.load_record(import_id)
        if not record:
            raise ValueError(f"Record {import_id} not found")

        record.annotations.append(
            {
                "original_line_no": original_line_no,
                "annotation": annotation,
                "author": author,
                "timestamp": datetime.now().isoformat(),
            }
        )

        from .models import ImportStatus

        record.status = ImportStatus.ANNOTATED
        self.storage.save_record(record)
        return record
