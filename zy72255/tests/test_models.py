import pytest
from mine_support_marker.models import (
    ChangeEntry,
    MarkerRecord,
    ProcessingStatus,
    ZAxisConvention,
)


class TestMarkerRecord:
    def test_create_with_defaults(self):
        record = MarkerRecord()
        assert record.marker_id
        assert record.status == ProcessingStatus.IMPORTED
        assert record.z_axis_convention == ZAxisConvention.STANDARD
        assert record.z_axis_flagged_for_review is False
        assert record.change_history == []
        assert record.confirmed_fields == set()

    def test_create_with_photo_number(self):
        record = MarkerRecord(photo_number="IMG_001", original_line_number=3)
        assert record.photo_number == "IMG_001"
        assert record.original_line_number == 3

    def test_identity_key(self):
        record = MarkerRecord(photo_number="IMG_001", import_batch_id="batch_a")
        assert record.identity_key == "IMG_001::batch_a"

    def test_apply_change_records_history(self):
        record = MarkerRecord(photo_number="IMG_001", remark="初始备注")
        entry = record.apply_change("remark", "修改后备注", "小魏", "航测内业补看")
        assert entry.old_value == "初始备注"
        assert entry.new_value == "修改后备注"
        assert entry.changed_by == "小魏"
        assert len(record.change_history) == 1
        assert record.remark == "修改后备注"

    def test_multiple_changes_accumulate(self):
        record = MarkerRecord(photo_number="IMG_001", remark="v1")
        record.apply_change("remark", "v2", "小魏")
        record.apply_change("remark", "v3", "小魏", "二次修改")
        assert len(record.change_history) == 2
        assert record.remark == "v3"
        history = record.get_history_for_field("remark")
        assert len(history) == 2
        assert history[0].old_value == "v1"
        assert history[0].new_value == "v2"
        assert history[1].old_value == "v2"
        assert history[1].new_value == "v3"

    def test_confirmed_fields(self):
        record = MarkerRecord(photo_number="IMG_001")
        assert not record.is_field_confirmed("conclusion")
        record.confirm_field("conclusion")
        assert record.is_field_confirmed("conclusion")

    def test_to_dict(self):
        record = MarkerRecord(
            photo_number="IMG_001",
            original_line_number=5,
            conclusion="支护正常",
        )
        d = record.to_dict()
        assert d["photo_number"] == "IMG_001"
        assert d["original_line_number"] == 5
        assert d["conclusion"] == "支护正常"
        assert d["status"] == "imported"


class TestProcessingStatus:
    def test_status_values(self):
        assert ProcessingStatus.IMPORTED.value == "imported"
        assert ProcessingStatus.CAD_LAYER_REVIEWED.value == "cad_layer_reviewed"
        assert ProcessingStatus.PATH_REPLAY_UPDATED.value == "path_replay_updated"
        assert ProcessingStatus.Z_AXIS_FLAGGED.value == "z_axis_flagged"
        assert ProcessingStatus.FIELD_TEAM_CONFIRMED.value == "field_team_confirmed"
        assert ProcessingStatus.FIELD_TEAM_REJECTED.value == "field_team_rejected"


class TestZAxisConvention:
    def test_convention_values(self):
        assert ZAxisConvention.STANDARD.value == "standard"
        assert ZAxisConvention.OLD_REVERSED.value == "old_reversed"
