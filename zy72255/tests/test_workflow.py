import pytest
from mine_support_marker.workflow import WorkflowService, WorkflowStep
from mine_support_marker.importer import ImportRow
from mine_support_marker.models import MarkerRecord, ProcessingStatus, ZAxisConvention
from mine_support_marker.repository import MarkerRepository


class TestWorkflowStep1:
    def setup_method(self):
        self.repo = MarkerRepository()
        self.workflow = WorkflowService(self.repo)

    def test_step1_import(self):
        rows = [
            ImportRow(photo_number="IMG_001", line_number=1, conclusion="支护正常"),
            ImportRow(photo_number="IMG_002", line_number=2, conclusion="需复检"),
        ]
        results = self.workflow.step_1_import(rows, batch_id="batch_1", operator="系统")
        assert len(results) == 2
        assert all(r.success for r in results)
        assert all(r.step == WorkflowStep.STEP_1_IMPORTED for r in results)

    def test_step1_import_detects_z_axis_reversal(self):
        rows = [
            ImportRow(photo_number="IMG_001", line_number=1, z_axis_value=-120.5),
        ]
        results = self.workflow.step_1_import(rows, batch_id="batch_1", operator="系统")
        assert len(results) == 1
        assert results[0].z_axis_flagged is True
        assert "Z轴" in results[0].message

    def test_step1_dedup_on_reimport(self):
        rows = [
            ImportRow(photo_number="IMG_001", line_number=1, conclusion="支护正常"),
        ]
        self.workflow.step_1_import(rows, batch_id="batch_1", operator="系统")
        results = self.workflow.step_1_import(rows, batch_id="batch_1", operator="系统")
        assert len(results) == 1
        assert results[0].success is False
        assert "重复" in results[0].message


class TestWorkflowStep2:
    def setup_method(self):
        self.repo = MarkerRepository()
        self.workflow = WorkflowService(self.repo)
        rows = [
            ImportRow(photo_number="IMG_001", line_number=1, conclusion="支护正常"),
        ]
        self.import_results = self.workflow.step_1_import(
            rows, batch_id="batch_1", operator="系统"
        )
        self.marker_id = self.import_results[0].marker_id

    def test_step2_review_cad_layer(self):
        result = self.workflow.step_2_review_cad_layer(
            self.marker_id, "支护图层-A01", "小魏"
        )
        assert result.success
        assert result.step == WorkflowStep.STEP_2_CAD_LAYER_REVIEWED
        record = self.repo.get(self.marker_id)
        assert record.cad_layer_name == "支护图层-A01"
        assert record.status == ProcessingStatus.CAD_LAYER_REVIEWED

    def test_step2_rejected_if_not_imported(self):
        record = self.repo.get(self.marker_id)
        record.status = ProcessingStatus.PATH_REPLAY_UPDATED
        result = self.workflow.step_2_review_cad_layer(
            self.marker_id, "支护图层-A01", "小魏"
        )
        assert not result.success

    def test_step2_allowed_after_z_axis_flagged(self):
        record = self.repo.get(self.marker_id)
        record.status = ProcessingStatus.Z_AXIS_FLAGGED
        record.z_axis_flagged_for_review = True
        result = self.workflow.step_2_review_cad_layer(
            self.marker_id, "支护图层-A01", "小魏"
        )
        assert result.success
        assert result.z_axis_flagged is True


class TestWorkflowStep3:
    def setup_method(self):
        self.repo = MarkerRepository()
        self.workflow = WorkflowService(self.repo)
        rows = [
            ImportRow(photo_number="IMG_001", line_number=1, conclusion="支护正常", z_axis_value=100.0),
        ]
        import_results = self.workflow.step_1_import(
            rows, batch_id="batch_1", operator="系统"
        )
        self.marker_id = import_results[0].marker_id
        self.workflow.step_2_review_cad_layer(
            self.marker_id, "支护图层-A01", "小魏"
        )

    def test_step3_path_replay_update(self):
        result = self.workflow.step_3_path_replay_update(
            self.marker_id, {"remark": "路径回放备注"}, "系统"
        )
        assert result.success
        assert result.step == WorkflowStep.STEP_3_PATH_REPLAY_UPDATED
        record = self.repo.get(self.marker_id)
        assert record.remark == "路径回放备注"
        assert record.status == ProcessingStatus.PATH_REPLAY_UPDATED

    def test_step3_blocked_if_z_axis_flagged(self):
        record = self.repo.get(self.marker_id)
        record.z_axis_flagged_for_review = True
        result = self.workflow.step_3_path_replay_update(
            self.marker_id, {"remark": "路径回放备注"}, "系统"
        )
        assert not result.success
        assert result.z_axis_flagged is True
        assert "Z轴" in result.message

    def test_step3_rejected_if_not_cad_reviewed(self):
        record = self.repo.get(self.marker_id)
        record.status = ProcessingStatus.IMPORTED
        result = self.workflow.step_3_path_replay_update(
            self.marker_id, {"remark": "备注"}, "系统"
        )
        assert not result.success

    def test_step3_respects_confirmed_fields(self):
        record = self.repo.get(self.marker_id)
        record.confirm_field("conclusion")
        result = self.workflow.step_3_path_replay_update(
            self.marker_id, {"conclusion": "新结论", "remark": "新备注"}, "系统"
        )
        assert result.success
        assert record.conclusion == "支护正常"
        assert record.remark == "新备注"


class TestWorkflowCurrentStep:
    def setup_method(self):
        self.repo = MarkerRepository()
        self.workflow = WorkflowService(self.repo)

    def test_current_step_imported(self):
        record = MarkerRecord(photo_number="IMG_001", status=ProcessingStatus.IMPORTED)
        self.repo.add(record)
        step = self.workflow.get_current_step(record.marker_id)
        assert step == WorkflowStep.STEP_1_IMPORTED

    def test_current_step_cad_reviewed(self):
        record = MarkerRecord(
            photo_number="IMG_001", status=ProcessingStatus.CAD_LAYER_REVIEWED
        )
        self.repo.add(record)
        step = self.workflow.get_current_step(record.marker_id)
        assert step == WorkflowStep.STEP_2_CAD_LAYER_REVIEWED

    def test_current_step_path_replay(self):
        record = MarkerRecord(
            photo_number="IMG_001", status=ProcessingStatus.PATH_REPLAY_UPDATED
        )
        self.repo.add(record)
        step = self.workflow.get_current_step(record.marker_id)
        assert step == WorkflowStep.STEP_3_PATH_REPLAY_UPDATED

    def test_current_step_nonexistent(self):
        step = self.workflow.get_current_step("nonexistent")
        assert step is None
