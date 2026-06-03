import pytest
from mine_support_marker.history import HistoryService
from mine_support_marker.models import MarkerRecord, ProcessingStatus
from mine_support_marker.repository import MarkerRepository


class TestHistoryService:
    def setup_method(self):
        self.repo = MarkerRepository()
        self.history = HistoryService(self.repo)
        self.record = MarkerRecord(
            photo_number="IMG_001",
            remark="初始备注",
            conclusion="支护正常",
        )
        self.repo.add(self.record)

    def test_edit_field_creates_history_entry(self):
        entry = self.history.edit_field(
            self.record.marker_id, "remark", "修改后备注", "小魏", "航测内业补看"
        )
        assert entry is not None
        assert entry.old_value == "初始备注"
        assert entry.new_value == "修改后备注"
        assert entry.changed_by == "小魏"

    def test_edit_field_updates_record(self):
        self.history.edit_field(
            self.record.marker_id, "remark", "修改后备注", "小魏"
        )
        assert self.record.remark == "修改后备注"

    def test_get_field_history(self):
        self.history.edit_field(
            self.record.marker_id, "remark", "v2", "小魏"
        )
        self.history.edit_field(
            self.record.marker_id, "remark", "v3", "小魏", "二次修改"
        )
        fh = self.history.get_field_history(self.record.marker_id, "remark")
        assert fh is not None
        assert fh.photo_number == "IMG_001"
        assert fh.has_changes
        assert len(fh.entries) == 2
        assert fh.latest().new_value == "v3"

    def test_get_full_history(self):
        self.history.edit_field(
            self.record.marker_id, "remark", "v2", "小魏"
        )
        self.history.edit_field(
            self.record.marker_id, "conclusion", "需复检", "小魏"
        )
        full = self.history.get_full_history(self.record.marker_id)
        assert full is not None
        assert len(full) == 2

    def test_rollback_field_to_original(self):
        self.history.edit_field(
            self.record.marker_id, "remark", "v2", "小魏"
        )
        entry = self.history.rollback_field(
            self.record.marker_id, "remark", "admin", "回滚备注"
        )
        assert entry is not None
        assert self.record.remark == "初始备注"
        assert len(self.record.change_history) == 2

    def test_rollback_to_specific_entry(self):
        self.history.edit_field(
            self.record.marker_id, "remark", "v2", "小魏"
        )
        self.history.edit_field(
            self.record.marker_id, "remark", "v3", "小魏"
        )
        entry = self.history.rollback_to_entry(
            self.record.marker_id, "remark", 0, "admin", "回滚到v2之前"
        )
        assert entry is not None
        assert self.record.remark == "初始备注"

    def test_edit_confirmed_field_is_blocked(self):
        self.record.confirm_field("conclusion")
        entry = self.history.edit_field(
            self.record.marker_id, "conclusion", "修改", "小魏"
        )
        assert entry is None
        assert self.record.conclusion == "支护正常"

    def test_edit_nonexistent_record(self):
        entry = self.history.edit_field("nonexistent", "remark", "v2", "小魏")
        assert entry is None

    def test_rollback_nonexistent_record(self):
        entry = self.history.rollback_field("nonexistent", "remark", "admin")
        assert entry is None

    def test_rollback_field_with_no_history(self):
        record2 = MarkerRecord(photo_number="IMG_002", remark="无改动")
        self.repo.add(record2)
        entry = self.history.rollback_field(record2.marker_id, "remark", "admin")
        assert entry is None
