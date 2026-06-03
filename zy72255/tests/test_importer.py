import pytest
from mine_support_marker.importer import ImportRow, MarkerImporter
from mine_support_marker.repository import MarkerRepository
from mine_support_marker.models import ProcessingStatus


class TestImporter:
    def setup_method(self):
        self.repo = MarkerRepository()
        self.importer = MarkerImporter(self.repo)

    def test_import_creates_records(self):
        rows = [
            ImportRow(photo_number="IMG_001", line_number=1, conclusion="支护正常"),
            ImportRow(photo_number="IMG_002", line_number=2, conclusion="需复检"),
        ]
        result = self.importer.import_rows(rows, batch_id="batch_1")
        assert result.total_created == 2
        assert result.total_skipped == 0
        assert result.batch_id == "batch_1"
        assert self.repo.count() == 2

    def test_import_preserves_original_line_number(self):
        rows = [
            ImportRow(photo_number="IMG_003", line_number=7, conclusion="支护标记"),
        ]
        result = self.importer.import_rows(rows, batch_id="batch_2")
        record = result.created[0]
        assert record.original_line_number == 7
        assert record.photo_number == "IMG_003"

    def test_import_default_status_is_imported(self):
        rows = [ImportRow(photo_number="IMG_004", line_number=1)]
        result = self.importer.import_rows(rows, batch_id="batch_3")
        assert result.created[0].status == ProcessingStatus.IMPORTED

    def test_reimport_same_batch_does_not_double_count(self):
        rows = [
            ImportRow(photo_number="IMG_001", line_number=1, conclusion="支护正常"),
            ImportRow(photo_number="IMG_002", line_number=2, conclusion="需复检"),
        ]
        result1 = self.importer.import_rows(rows, batch_id="batch_1")
        assert result1.total_created == 2

        result2 = self.importer.reimport_rows(rows, "batch_1")
        assert result2.total_created == 0
        assert result2.total_skipped == 2
        assert self.repo.count() == 2

    def test_import_same_photos_different_batch_creates_separate(self):
        rows = [
            ImportRow(photo_number="IMG_001", line_number=1, conclusion="支护正常"),
        ]
        result1 = self.importer.import_rows(rows, batch_id="batch_a")
        result2 = self.importer.import_rows(rows, batch_id="batch_b")
        assert result1.total_created == 1
        assert result2.total_created == 1
        assert self.repo.count() == 2

    def test_auto_generate_batch_id(self):
        rows = [ImportRow(photo_number="IMG_005", line_number=1)]
        result = self.importer.import_rows(rows)
        assert len(result.batch_id) == 8

    def test_partial_duplicate_in_batch(self):
        rows1 = [ImportRow(photo_number="IMG_001", line_number=1)]
        self.importer.import_rows(rows1, batch_id="batch_x")

        rows2 = [
            ImportRow(photo_number="IMG_001", line_number=1),
            ImportRow(photo_number="IMG_002", line_number=2),
        ]
        result = self.importer.reimport_rows(rows2, "batch_x")
        assert result.total_created == 1
        assert result.total_skipped == 1
