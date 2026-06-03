import pytest
from mine_support_marker.late_material import LateMaterialService, PROTECTED_FIELDS
from mine_support_marker.models import MarkerRecord, ProcessingStatus
from mine_support_marker.repository import MarkerRepository


class TestLateMaterialService:
    def setup_method(self):
        self.repo = MarkerRepository()
        self.late_material = LateMaterialService(self.repo)
        self.record = MarkerRecord(
            photo_number="IMG_001",
            conclusion="支护正常",
            remark="初始备注",
            import_batch_id="batch_1",
        )
        self.repo.add(self.record)

    def test_apply_cad_layer_late_arrival(self):
        results = self.late_material.apply_cad_layer_late_arrival(
            "IMG_001", "支护图层-A01", "小魏"
        )
        assert len(results) == 1
        assert results[0].success
        assert "cad_layer_name" in results[0].fields_updated
        assert self.record.cad_layer_name == "支护图层-A01"

    def test_late_arrival_updates_status_from_imported(self):
        assert self.record.status == ProcessingStatus.IMPORTED
        self.late_material.apply_cad_layer_late_arrival(
            "IMG_001", "支护图层-A01", "小魏"
        )
        assert self.record.status == ProcessingStatus.CAD_LAYER_REVIEWED

    def test_late_arrival_does_not_overwrite_confirmed_conclusion(self):
        self.record.confirm_field("conclusion")
        self.record.confirm_field("remark")
        results = self.late_material.apply_cad_layer_late_arrival(
            "IMG_001", "支护图层-A01", "小魏"
        )
        assert results[0].success
        assert "cad_layer_name" in results[0].fields_updated
        assert "conclusion" in results[0].fields_protected
        assert "remark" in results[0].fields_protected
        assert self.record.conclusion == "支护正常"

    def test_late_arrival_for_nonexistent_photo(self):
        results = self.late_material.apply_cad_layer_late_arrival(
            "IMG_999", "支护图层-X99", "小魏"
        )
        assert len(results) == 1
        assert not results[0].success

    def test_late_arrival_records_history(self):
        self.late_material.apply_cad_layer_late_arrival(
            "IMG_001", "支护图层-A01", "小魏"
        )
        cad_history = self.record.get_history_for_field("cad_layer_name")
        assert len(cad_history) == 1
        assert cad_history[0].old_value == ""
        assert cad_history[0].new_value == "支护图层-A01"
        assert "晚到材料" in cad_history[0].reason

    def test_late_arrival_does_not_change_confirmed_cad_layer(self):
        self.record.cad_layer_name = "旧图层"
        self.record.confirm_field("cad_layer_name")
        results = self.late_material.apply_cad_layer_late_arrival(
            "IMG_001", "支护图层-A01", "小魏"
        )
        assert "cad_layer_name" in results[0].fields_protected
        assert self.record.cad_layer_name == "旧图层"

    def test_batch_apply_cad_layers(self):
        r2 = MarkerRecord(
            photo_number="IMG_002", import_batch_id="batch_1"
        )
        self.repo.add(r2)
        updates = {
            "IMG_001": "支护图层-A01",
            "IMG_002": "支护图层-B02",
        }
        results = self.late_material.batch_apply_cad_layers(updates, "小魏")
        assert len(results) == 2
        assert self.record.cad_layer_name == "支护图层-A01"
        assert r2.cad_layer_name == "支护图层-B02"

    def test_confirm_field(self):
        ok = self.late_material.confirm_field(
            self.record.marker_id, "conclusion", "班组"
        )
        assert ok
        assert self.record.is_field_confirmed("conclusion")

    def test_confirm_field_nonexistent(self):
        ok = self.late_material.confirm_field("nonexistent", "conclusion", "班组")
        assert not ok
