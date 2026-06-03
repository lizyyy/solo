import pytest
from mine_support_marker.z_axis import ZAxisService
from mine_support_marker.models import MarkerRecord, ProcessingStatus, ZAxisConvention
from mine_support_marker.repository import MarkerRepository


class TestZAxisService:
    def setup_method(self):
        self.repo = MarkerRepository()
        self.z_axis = ZAxisService(self.repo)

    def test_detect_standard_convention(self):
        assert ZAxisService.detect_convention(120.5) == ZAxisConvention.STANDARD
        assert ZAxisService.detect_convention(0.0) == ZAxisConvention.STANDARD

    def test_detect_old_reversed_convention(self):
        assert ZAxisService.detect_convention(-120.5) == ZAxisConvention.OLD_REVERSED

    def test_should_flag_for_review(self):
        assert ZAxisService.should_flag_for_review(-100.0) is True
        assert ZAxisService.should_flag_for_review(100.0) is False
        assert ZAxisService.should_flag_for_review(0.0) is False

    def test_flag_z_axis_reversal(self):
        record = MarkerRecord(
            photo_number="IMG_001",
            z_axis_value=-120.5,
            z_axis_convention=ZAxisConvention.STANDARD,
        )
        self.repo.add(record)
        result = self.z_axis.flag_z_axis_reversal(record.marker_id, "system")
        assert result is not None
        assert result.z_axis_flagged_for_review is True
        assert result.z_axis_convention == ZAxisConvention.OLD_REVERSED
        assert result.status == ProcessingStatus.Z_AXIS_FLAGGED

    def test_flag_already_flagged_is_idempotent(self):
        record = MarkerRecord(
            photo_number="IMG_001",
            z_axis_value=-120.5,
            z_axis_flagged_for_review=True,
        )
        self.repo.add(record)
        result = self.z_axis.flag_z_axis_reversal(record.marker_id, "system")
        assert result is not None
        assert result.z_axis_flagged_for_review is True

    def test_flag_field_team_confirmed_is_blocked(self):
        record = MarkerRecord(
            photo_number="IMG_001",
            z_axis_value=-120.5,
            status=ProcessingStatus.FIELD_TEAM_CONFIRMED,
        )
        self.repo.add(record)
        result = self.z_axis.flag_z_axis_reversal(record.marker_id, "system")
        assert result is None

    def test_correct_z_axis(self):
        record = MarkerRecord(
            photo_number="IMG_001",
            z_axis_value=-120.5,
            z_axis_flagged_for_review=True,
            z_axis_convention=ZAxisConvention.OLD_REVERSED,
        )
        self.repo.add(record)
        result = self.z_axis.correct_z_axis(record.marker_id, "班组确认")
        assert result is not None
        assert result.z_axis_value == 120.5
        assert result.z_axis_convention == ZAxisConvention.STANDARD
        assert result.z_axis_flagged_for_review is False

    def test_correct_z_axis_not_flagged_is_noop(self):
        record = MarkerRecord(
            photo_number="IMG_001",
            z_axis_value=120.5,
            z_axis_flagged_for_review=False,
        )
        self.repo.add(record)
        result = self.z_axis.correct_z_axis(record.marker_id, "班组确认")
        assert result is not None
        assert result.z_axis_value == 120.5

    def test_rollback_z_axis_correction(self):
        record = MarkerRecord(
            photo_number="IMG_001",
            z_axis_value=-120.5,
            z_axis_flagged_for_review=True,
            z_axis_convention=ZAxisConvention.OLD_REVERSED,
        )
        self.repo.add(record)
        self.z_axis.correct_z_axis(record.marker_id, "班组确认")
        assert record.z_axis_value == 120.5

        result = self.z_axis.rollback_z_axis_correction(record.marker_id, "admin")
        assert result is not None
        assert result.z_axis_value == -120.5
        assert result.z_axis_convention == ZAxisConvention.OLD_REVERSED
        assert result.z_axis_flagged_for_review is True
        assert result.status == ProcessingStatus.Z_AXIS_FLAGGED

    def test_rollback_records_history(self):
        record = MarkerRecord(
            photo_number="IMG_001",
            z_axis_value=-120.5,
            z_axis_flagged_for_review=True,
            z_axis_convention=ZAxisConvention.OLD_REVERSED,
        )
        self.repo.add(record)
        self.z_axis.correct_z_axis(record.marker_id, "班组确认")
        self.z_axis.rollback_z_axis_correction(record.marker_id, "admin")
        z_history = record.get_history_for_field("z_axis_value")
        assert len(z_history) == 2
        assert z_history[0].old_value == -120.5
        assert z_history[0].new_value == 120.5
        assert z_history[1].old_value == 120.5
        assert z_history[1].new_value == -120.5

    def test_scan_batch_for_reversals(self):
        r1 = MarkerRecord(
            photo_number="IMG_001", z_axis_value=100.0, import_batch_id="batch_1"
        )
        r2 = MarkerRecord(
            photo_number="IMG_002", z_axis_value=-200.0, import_batch_id="batch_1"
        )
        self.repo.add(r1)
        self.repo.add(r2)
        results = self.z_axis.scan_batch_for_reversals("batch_1", "system")
        assert len(results) == 2
        assert results[0].needs_review is False
        assert results[1].needs_review is True
        assert r2.z_axis_flagged_for_review is True
