from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Optional

from mine_support_marker.models import MarkerRecord, ProcessingStatus
from mine_support_marker.repository import MarkerRepository


@dataclass
class ImportRow:
    photo_number: str
    line_number: int
    conclusion: str = ""
    remark: str = ""
    z_axis_value: float = 0.0
    cad_layer_name: str = ""


class ImportResult:
    def __init__(self) -> None:
        self.created: list[MarkerRecord] = []
        self.skipped_duplicates: list[str] = []
        self.batch_id: str = ""

    @property
    def total_created(self) -> int:
        return len(self.created)

    @property
    def total_skipped(self) -> int:
        return len(self.skipped_duplicates)


class MarkerImporter:
    def __init__(self, repo: MarkerRepository) -> None:
        self._repo = repo

    def import_rows(
        self,
        rows: list[ImportRow],
        batch_id: Optional[str] = None,
        operator: str = "system",
    ) -> ImportResult:
        result = ImportResult()
        result.batch_id = batch_id or uuid.uuid4().hex[:8]

        for row in rows:
            existing = self._repo.find_by_identity(row.photo_number, result.batch_id)
            if existing is not None:
                result.skipped_duplicates.append(row.photo_number)
                continue

            record = MarkerRecord(
                photo_number=row.photo_number,
                original_line_number=row.line_number,
                conclusion=row.conclusion,
                remark=row.remark,
                z_axis_value=row.z_axis_value,
                cad_layer_name=row.cad_layer_name,
                status=ProcessingStatus.IMPORTED,
                import_batch_id=result.batch_id,
            )
            self._repo.add(record)
            result.created.append(record)

        return result

    def reimport_rows(
        self,
        rows: list[ImportRow],
        original_batch_id: str,
        operator: str = "system",
    ) -> ImportResult:
        result = ImportResult()
        result.batch_id = original_batch_id

        for row in rows:
            existing = self._repo.find_by_identity(row.photo_number, original_batch_id)
            if existing is not None:
                result.skipped_duplicates.append(row.photo_number)
                continue

            record = MarkerRecord(
                photo_number=row.photo_number,
                original_line_number=row.line_number,
                conclusion=row.conclusion,
                remark=row.remark,
                z_axis_value=row.z_axis_value,
                cad_layer_name=row.cad_layer_name,
                status=ProcessingStatus.IMPORTED,
                import_batch_id=original_batch_id,
            )
            self._repo.add(record)
            result.created.append(record)

        return result
