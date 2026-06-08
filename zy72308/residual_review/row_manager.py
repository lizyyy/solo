"""行管理：删除、断档检测、补录、复核、修正 - 全链路变更日志与数据一致性"""

from datetime import datetime
from typing import List, Tuple, Optional

from .models import (
    OriginalRow,
    RowStatus,
    ImportRecord,
    ChangeType,
    ChangeLogEntry,
)
from .storage import StorageManager


class RowManager:
    def __init__(self, storage: StorageManager):
        self.storage = storage

    def delete_row(
        self, import_id: str, original_line_no: int, notes: str = "", author: str = "阿岚"
    ) -> ImportRecord:
        record = self.storage.load_record(import_id)
        if not record:
            raise ValueError(f"Record {import_id} not found")

        row = self._find_row_by_original_no(record.rows, original_line_no)
        if not row:
            raise ValueError(f"Row {original_line_no} not found")

        old_status = row.status.value
        old_current = row.current_line_no
        row.status = RowStatus.DELETED
        row.current_line_no = None
        row.deleted_at = datetime.now()
        row.notes = notes or f"{author}人工删除"
        row.next_owner = "教研组"

        self._update_current_line_numbers(record.rows)
        self._detect_gaps(record, author)

        record.add_change_log(
            ChangeLogEntry(
                timestamp=datetime.now(),
                change_type=ChangeType.DELETE,
                original_line_no=original_line_no,
                author=author,
                original_value_x=row.original_x_value,
                original_value_y=row.original_y_value,
                original_status=old_status,
                new_status=RowStatus.GAP.value,
                reason=row.notes,
                next_action="教研组复核删除原因，判断是否需要补录",
            )
        )

        self.storage.save_record(record)
        return record

    def supplement_row(
        self,
        import_id: str,
        original_line_no: int,
        x_value: float,
        y_value: float,
        notes: str = "",
        author: str = "阿岚",
    ) -> Tuple[ImportRecord, bool]:
        record = self.storage.load_record(import_id)
        if not record:
            raise ValueError(f"Record {import_id} not found")

        row = self._find_row_by_original_no(record.rows, original_line_no)
        if not row:
            raise ValueError(f"Row {original_line_no} not found")

        if row.status not in [RowStatus.DELETED, RowStatus.GAP]:
            raise ValueError(
                f"Row {original_line_no} 当前状态为 {row.status.value}, 不能补录"
                "（仅deleted/gap状态可补录）"
            )

        orig_x = row.original_x_value
        orig_y = row.original_y_value
        old_status = row.status.value

        row.status = RowStatus.PENDING_REVIEW
        row.x_value = x_value
        row.y_value = y_value
        row.supplemented_at = datetime.now()
        row.notes = (
            notes
            or f"原始值({orig_x},{orig_y}) → 补录值({x_value},{y_value})，待教研组复核"
        )
        row.next_owner = "教研组"

        self._update_current_line_numbers(record.rows)
        self._detect_gaps(record, author)

        record.add_change_log(
            ChangeLogEntry(
                timestamp=datetime.now(),
                change_type=ChangeType.SUPPLEMENT,
                original_line_no=original_line_no,
                author=author,
                original_value_x=orig_x,
                original_value_y=orig_y,
                new_value_x=x_value,
                new_value_y=y_value,
                original_status=old_status,
                new_status=RowStatus.PENDING_REVIEW.value,
                reason=row.notes,
                next_action="教研组核对原始截图，确认补录值是否正确",
            )
        )

        needs_recalc = True
        self.storage.save_record(record)
        return record, needs_recalc

    def review_row(
        self,
        import_id: str,
        original_line_no: int,
        approve: bool,
        comment: str = "",
        reviewer: str = "教研组",
    ) -> Tuple[ImportRecord, bool]:
        record = self.storage.load_record(import_id)
        if not record:
            raise ValueError(f"Record {import_id} not found")

        row = self._find_row_by_original_no(record.rows, original_line_no)
        if not row:
            raise ValueError(f"Row {original_line_no} not found")

        old_status = row.status.value
        needs_recalc = False

        if approve:
            if old_status in [RowStatus.PENDING_REVIEW.value, "pending_review"]:
                row.status = RowStatus.SUPPLEMENTED
                row.reviewed_at = datetime.now()
                row.reviewed_by = reviewer
                row.review_comment = comment or "教研组复核通过"
                row.next_owner = ""
                row.notes = f"[已复核]{row.notes} | {comment}"
                needs_recalc = True
            elif old_status in [RowStatus.GAP.value, "gap"]:
                row.status = RowStatus.DELETED
                row.reviewed_at = datetime.now()
                row.reviewed_by = reviewer
                row.review_comment = comment or "教研组确认删除"
                row.next_owner = ""
                row.notes = f"[已复核]{row.notes} | {comment}"
                needs_recalc = True
            else:
                row.status = RowStatus.REVIEWED
                row.reviewed_at = datetime.now()
                row.reviewed_by = reviewer
                row.review_comment = comment or "复核"
                needs_recalc = True
        else:
            row.status = RowStatus.GAP
            row.reviewed_at = datetime.now()
            row.reviewed_by = reviewer
            row.review_comment = comment or "教研组复核不通过，返回重补"
            row.next_owner = "运营规划阿岚"
            row.notes = f"[复核不通过]{row.notes} | {comment}"

        self._update_current_line_numbers(record.rows)

        record.add_change_log(
            ChangeLogEntry(
                timestamp=datetime.now(),
                change_type=ChangeType.REVIEW,
                original_line_no=original_line_no,
                author=reviewer,
                original_value_x=row.original_x_value,
                original_value_y=row.original_y_value,
                new_value_x=row.x_value,
                new_value_y=row.y_value,
                original_status=old_status,
                new_status=row.status.value,
                reason=row.review_comment,
                next_action=row.next_owner,
            )
        )

        self.storage.save_record(record)
        return record, needs_recalc

    def modify_row(
        self,
        import_id: str,
        original_line_no: int,
        new_x: Optional[float] = None,
        new_y: Optional[float] = None,
        reason: str = "",
        author: str = "阿岚",
    ) -> Tuple[ImportRecord, bool]:
        record = self.storage.load_record(import_id)
        if not record:
            raise ValueError(f"Record {import_id} not found")

        row = self._find_row_by_original_no(record.rows, original_line_no)
        if not row:
            raise ValueError(f"Row {original_line_no} not found")

        old_status = row.status.value
        old_x = row.x_value
        old_y = row.y_value

        if new_x is not None:
            row.x_value = new_x
        if new_y is not None:
            row.y_value = new_y

        row.status = RowStatus.PENDING_REVIEW
        row.notes = (
            reason
            or f"原值({old_x:.2f},{old_y:.2f}) → 修正值({row.x_value:.2f},{row.y_value:.2f}), 待复核"
        )
        row.next_owner = "教研组"

        record.add_change_log(
            ChangeLogEntry(
                timestamp=datetime.now(),
                change_type=ChangeType.MODIFY,
                original_line_no=original_line_no,
                author=author,
                original_value_x=old_x,
                original_value_y=old_y,
                new_value_x=row.x_value,
                new_value_y=row.y_value,
                original_status=old_status,
                new_status=RowStatus.PENDING_REVIEW.value,
                reason=row.notes,
                next_action="教研组核对修正依据",
            )
        )

        needs_recalc = True
        self.storage.save_record(record)
        return record, needs_recalc

    def _find_row_by_original_no(
        self, rows: List[OriginalRow], original_line_no: int
    ) -> Optional[OriginalRow]:
        for row in rows:
            if row.original_line_no == original_line_no:
                return row
        return None

    def _update_current_line_numbers(self, rows: List[OriginalRow]):
        from .importer import SUPPORTED_VALID_STATUS

        sorted_rows = sorted(rows, key=lambda r: r.original_line_no)
        current_line = 1
        for row in sorted_rows:
            if row.status in SUPPORTED_VALID_STATUS:
                row.current_line_no = current_line
                current_line += 1
            else:
                row.current_line_no = None
                row.predicted = None
                row.residual = None

    def _detect_gaps(self, record: ImportRecord, author: str = "system"):
        sorted_rows = sorted(record.rows, key=lambda r: r.original_line_no)
        expected_line = 1

        for row in sorted_rows:
            if row.status == RowStatus.DELETED:
                expected_line = row.original_line_no + 1
            elif row.status in [RowStatus.NORMAL, RowStatus.SUPPLEMENTED, RowStatus.MODIFIED, RowStatus.REVIEWED]:
                expected_line = row.original_line_no + 1

        for row in sorted_rows:
            if row.status == RowStatus.DELETED:
                row.status = RowStatus.GAP
                row.notes = (
                    f"编号断档（原始行号{row.original_line_no}）- 待教研组复核. "
                    f"原始X={row.original_x_value}, Y={row.original_y_value}. {row.notes}"
                )
                row.next_owner = "教研组"

    def get_gap_summary(self, import_id: str) -> List[dict]:
        record = self.storage.load_record(import_id)
        if not record:
            return []

        gaps = []
        for row in record.rows:
            if row.status in [RowStatus.GAP, RowStatus.DELETED, RowStatus.PENDING_REVIEW]:
                gaps.append(
                    {
                        "original_line_no": row.original_line_no,
                        "current_line_no": row.current_line_no,
                        "status": row.status.value,
                        "original_x": row.original_x_value,
                        "original_y": row.original_y_value,
                        "current_x": row.x_value,
                        "current_y": row.y_value,
                        "deleted_at": row.deleted_at.isoformat() if row.deleted_at else None,
                        "supplemented_at": row.supplemented_at.isoformat() if row.supplemented_at else None,
                        "notes": row.notes,
                        "next_owner": row.next_owner,
                        "reviewed_by": row.reviewed_by,
                    }
                )
        return gaps

    def add_annotation(
        self, import_id: str, original_line_no: int, annotation: str, author: str = "阿岚"
    ) -> ImportRecord:
        record = self.storage.load_record(import_id)
        if not record:
            raise ValueError(f"Record {import_id} not found")

        timestamp = datetime.now().isoformat()
        record.annotations.append(
            {
                "original_line_no": original_line_no,
                "annotation": annotation,
                "author": author,
                "timestamp": timestamp,
            }
        )

        from .models import ImportStatus

        record.add_change_log(
            ChangeLogEntry(
                timestamp=datetime.now(),
                change_type=ChangeType.ANNOTATE,
                original_line_no=original_line_no,
                author=author,
                reason=annotation,
                next_action="后续流程参考批注处理",
            )
        )

        record.status = ImportStatus.ANNOTATED
        self.storage.save_record(record)
        return record

    def update_params_and_recalc(
        self, import_id: str, author: str = "system", trigger: str = ""
    ) -> ImportRecord:
        from .importer import DataImporter

        importer = DataImporter(self.storage)
        record = importer.recalculate_residuals(
            import_id, trigger=trigger or f"参数版本页手动更新:{author}", author=author
        )

        from .models import ImportStatus

        record.status = ImportStatus.PARAMS_UPDATED
        record.add_change_log(
            ChangeLogEntry(
                timestamp=datetime.now(),
                change_type=ChangeType.PARAM_UPDATE,
                original_line_no=0,
                author=author,
                params_version_before=record.params_version - 1,
                params_version_after=record.params_version,
                reason=trigger or "参数版本页更新回归参数",
                next_action="同步更新页面展示、明细导出、接口返回",
            )
        )
        self.storage.save_record(record)
        return record
