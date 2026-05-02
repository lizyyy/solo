import os
import tempfile
import pytest
import numpy as np
import json
from pathlib import Path
from datetime import datetime
from unittest.mock import patch, MagicMock

from lens_inspector.storage import (
    StateStorage,
    StateStorageError,
    JSONStateEncoder,
)
from lens_inspector.models import (
    SessionState,
    LensInspection,
    ImageFeatures,
    DefectDetection,
    DefectType,
    InspectionStatus,
)


class TestJSONStateEncoder:
    def test_encode_session_state(self):
        state = SessionState(
            session_id="test",
            inspection_dir="/test",
        )

        encoded = json.dumps(state, cls=JSONStateEncoder)
        assert "test" in encoded

    def test_encode_lens_inspection(self):
        inspection = LensInspection(
            lens_id="L1",
            status=InspectionStatus.COMPLETED,
        )

        encoded = json.dumps(inspection, cls=JSONStateEncoder)
        assert "L1" in encoded

    def test_encode_defect_type(self):
        defect = DefectType.MOLD
        encoded = json.dumps(defect, cls=JSONStateEncoder)
        assert "霉斑" in encoded

    def test_encode_inspection_status(self):
        status = InspectionStatus.FLAGGED
        encoded = json.dumps(status, cls=JSONStateEncoder)
        assert "需复检" in encoded

    def test_encode_datetime(self):
        dt = datetime(2026, 5, 2, 12, 0, 0)
        encoded = json.dumps(dt, cls=JSONStateEncoder)
        assert "2026-05-02" in encoded

    def test_encode_path(self):
        path = Path("/test/path")
        encoded = json.dumps(path, cls=JSONStateEncoder)
        assert "/test/path" in encoded


class TestStateStorage:
    def test_init_default_storage_dir(self):
        storage = StateStorage()
        assert ".lens_inspector" in str(storage.storage_dir)

    def test_init_custom_storage_dir(self, tmp_path):
        custom_dir = tmp_path / "custom_storage"
        storage = StateStorage(str(custom_dir))

        assert storage.storage_dir == custom_dir
        assert custom_dir.exists()

    def test_save_and_load_session(self, tmp_path):
        storage = StateStorage(str(tmp_path))

        state = SessionState(
            session_id="test_session",
            inspection_dir="/test/images",
        )

        saved_path = storage.save_session(state)
        assert saved_path.exists()

        loaded = storage.load_session("test_session")
        assert loaded.session_id == "test_session"
        assert loaded.inspection_dir == "/test/images"

    def test_load_session_not_found(self, tmp_path):
        storage = StateStorage(str(tmp_path))

        with pytest.raises(StateStorageError):
            storage.load_session("non_existent")

    def test_delete_session_existing(self, tmp_path):
        storage = StateStorage(str(tmp_path))

        state = SessionState(session_id="to_delete", inspection_dir="/test")
        storage.save_session(state)

        result = storage.delete_session("to_delete")
        assert result == True

        with pytest.raises(StateStorageError):
            storage.load_session("to_delete")

    def test_delete_session_non_existing(self, tmp_path):
        storage = StateStorage(str(tmp_path))
        result = storage.delete_session("non_existent")
        assert result == False

    def test_list_sessions(self, tmp_path):
        storage = StateStorage(str(tmp_path))

        state1 = SessionState(session_id="s1", inspection_dir="/test1")
        state2 = SessionState(session_id="s2", inspection_dir="/test2")
        storage.save_session(state1)
        storage.save_session(state2)

        sessions = storage.list_sessions()
        assert len(sessions) == 2

    def test_create_new_session(self, tmp_path):
        storage = StateStorage(str(tmp_path))

        session = storage.create_new_session(
            "/test/images",
            "/test/notes.csv",
            session_id="custom_id",
        )

        assert session.session_id == "custom_id"
        assert session.inspection_dir == "/test/images"
        assert session.notes_csv == "/test/notes.csv"

    def test_create_new_session_auto_id(self, tmp_path):
        storage = StateStorage(str(tmp_path))

        session = storage.create_new_session("/test/images")
        assert session.session_id is not None
        assert len(session.session_id) > 0

    def test_update_inspection(self, tmp_path):
        storage = StateStorage(str(tmp_path))

        inspection = LensInspection(lens_id="L1", images=["/test.jpg"])
        state = SessionState(
            session_id="test",
            inspection_dir="/test",
            inspections={"L1": inspection},
        )

        updated_inspection = LensInspection(lens_id="L1", images=["/test.jpg", "/test2.jpg"])

        updated_state = storage.update_inspection(state, "L1", updated_inspection)
        assert len(updated_state.inspections["L1"].images) == 2

    def test_update_inspection_not_found(self, tmp_path):
        storage = StateStorage(str(tmp_path))
        state = SessionState(session_id="test", inspection_dir="/test")

        inspection = LensInspection(lens_id="L1")

        with pytest.raises(StateStorageError):
            storage.update_inspection(state, "L1", inspection)

    def test_confirm_inspection(self, tmp_path):
        storage = StateStorage(str(tmp_path))

        inspection = LensInspection(lens_id="L1")
        state = SessionState(
            session_id="test",
            inspection_dir="/test",
            inspections={"L1": inspection},
        )

        updated = storage.confirm_inspection(state, "L1", "人工备注")

        assert updated.inspections["L1"].human_verified == True
        assert updated.inspections["L1"].human_notes == "人工备注"
        assert updated.inspections["L1"].status == InspectionStatus.HUMAN_CONFIRMED

    def test_confirm_inspection_not_found(self, tmp_path):
        storage = StateStorage(str(tmp_path))
        state = SessionState(session_id="test", inspection_dir="/test")

        with pytest.raises(StateStorageError):
            storage.confirm_inspection(state, "L1", "")

    def test_flag_for_review(self, tmp_path):
        storage = StateStorage(str(tmp_path))

        inspection = LensInspection(lens_id="L1")
        state = SessionState(
            session_id="test",
            inspection_dir="/test",
            inspections={"L1": inspection},
        )

        updated = storage.flag_for_review(state, "L1", "需要复检")

        assert updated.inspections["L1"].status == InspectionStatus.FLAGGED
        assert "需要复检" in updated.inspections["L1"].human_notes

    def test_get_inspection_summary(self, tmp_path):
        storage = StateStorage(str(tmp_path))

        inspection1 = LensInspection(
            lens_id="L1",
            anomaly_score=0.8,
            status=InspectionStatus.FLAGGED,
            cluster_label="暗角问题",
        )

        inspection2 = LensInspection(
            lens_id="L2",
            anomaly_score=0.2,
            status=InspectionStatus.COMPLETED,
            cluster_label="正常/无问题",
        )

        state = SessionState(
            session_id="test",
            inspection_dir="/test",
            inspections={"L1": inspection1, "L2": inspection2},
        )

        summary = storage.get_inspection_summary(state)

        assert summary["session_id"] == "test"
        assert summary["summary"]["total_inspections"] == 2
        assert "需复检" in summary["summary"]["status_counts"]
        assert "暗角问题" in summary["summary"]["cluster_counts"]

    def test_export_audit_package(self, tmp_path):
        storage = StateStorage(str(tmp_path))

        state = SessionState(
            session_id="test",
            inspection_dir="/test",
        )

        output_path = tmp_path / "audit.json"
        result = storage.export_audit_package(state, str(output_path))

        assert result.exists()

        with open(result, "r", encoding="utf-8") as f:
            data = json.load(f)

        assert "audit_version" in data
        assert "generated_at" in data
        assert "session" in data
