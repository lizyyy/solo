import pytest
from datetime import datetime

from content_safety_reflow.models import (
    ModelOutput,
    ManualJudgment,
    ManualChangeType,
    ReflowStatus,
)
from content_safety_reflow.reflow_engine import ReflowEngine
from content_safety_reflow.workflow import WorkflowManager
from content_safety_reflow.version_control import VersionController
from content_safety_reflow.unified_output import UnifiedOutput


@pytest.fixture
def sample_model_output_1():
    return ModelOutput(
        sample_id="SAMPLE-001",
        original_line_number=1,
        batch_id="BATCH-001",
        model_version="v1.0",
        content="测试内容1",
        predicted_label="violent",
        confidence=0.87,
        risk_tags=["暴力"],
        evidence_snippets=["证据1", "证据2"],
    )


@pytest.fixture
def sample_model_output_1_new_batch():
    return ModelOutput(
        sample_id="SAMPLE-001",
        original_line_number=5,
        batch_id="BATCH-002",
        model_version="v2.0",
        content="测试内容1",
        predicted_label="normal",
        confidence=0.95,
        risk_tags=[],
        evidence_snippets=["新模型未检测到敏感词"],
    )


@pytest.fixture
def sample_manual_judgment_1():
    return ManualJudgment(
        sample_id="SAMPLE-001",
        judgment_id="JUDGE-001",
        judge_person="周姐",
        judgment_time=datetime.now(),
        final_label="violent",
        on_site_statement="人工确认确实包含暴力内容",
        change_type=ManualChangeType.LABEL_CHANGE,
        changed_fields=["predicted_label"],
        original_values={"predicted_label": "normal"},
        new_values={"predicted_label": "violent"},
        remarks="周姐现场确认",
    )


class TestReflowEngine:
    def test_import_model_output_creates_result(self, sample_model_output_1):
        engine = ReflowEngine()
        result = engine.import_model_output(sample_model_output_1, "工程师A")

        assert result.sample_id == "SAMPLE-001"
        assert result.status == ReflowStatus.MODEL_IMPORTED
        assert result.model_output.original_line_number == 1
        assert result.current_label == "violent"
        assert len(result.final_evidence) == 2
        assert len(result.change_history) == 1
        assert result.change_history[0].action == "model_import"

    def test_add_manual_judgment_merges_evidence(self, sample_model_output_1, sample_manual_judgment_1):
        engine = ReflowEngine()
        engine.import_model_output(sample_model_output_1, "工程师A")
        result = engine.add_manual_judgment(sample_manual_judgment_1, "周姐")

        assert result.status == ReflowStatus.MANUAL_SUPPLEMENTED
        assert result.active_manual_judgment is not None
        assert result.active_manual_judgment.judgment_id == "JUDGE-001"
        assert result.current_label == "violent"
        assert len(result.final_evidence) == 3
        assert "人工确认确实包含暴力内容" in result.final_evidence
        assert len(result.manual_judgments) == 1

    def test_batch_override_triggers_pending_review(self, sample_model_output_1, sample_manual_judgment_1, sample_model_output_1_new_batch):
        engine = ReflowEngine()
        engine.import_model_output(sample_model_output_1, "工程师A")
        engine.add_manual_judgment(sample_manual_judgment_1, "周姐")

        result = engine.import_model_output(sample_model_output_1_new_batch, "工程师B")

        assert result.status == ReflowStatus.COVERED_PENDING_REVIEW
        assert result.is_covered is True
        assert result.covered_by_batch_id == "BATCH-002"
        assert result.active_manual_judgment is None
        assert len(result.manual_judgments) == 1
        assert result.manual_judgments[0].is_overridden is True
        assert result.manual_judgments[0].override_batch_id == "BATCH-002"

        has_override_action = any(
            c.action == "manual_judgment_overridden" for c in result.change_history
        )
        assert has_override_action is True

    def test_review_covered_sample_approve(self, sample_model_output_1, sample_manual_judgment_1, sample_model_output_1_new_batch):
        engine = ReflowEngine()
        engine.import_model_output(sample_model_output_1, "工程师A")
        engine.add_manual_judgment(sample_manual_judgment_1, "周姐")
        engine.import_model_output(sample_model_output_1_new_batch, "工程师B")

        result = engine.review_covered_sample(
            sample_id="SAMPLE-001",
            reviewer="安全审核同事",
            approve=True,
            reason="确认人工改判有效",
        )

        assert result.status == ReflowStatus.REVIEW_APPROVED
        assert result.is_covered is False
        assert result.review_person == "安全审核同事"
        assert result.review_time is not None

    def test_review_covered_sample_reject(self, sample_model_output_1, sample_manual_judgment_1, sample_model_output_1_new_batch):
        engine = ReflowEngine()
        engine.import_model_output(sample_model_output_1, "工程师A")
        engine.add_manual_judgment(sample_manual_judgment_1, "周姐")
        engine.import_model_output(sample_model_output_1_new_batch, "工程师B")

        result = engine.review_covered_sample(
            sample_id="SAMPLE-001",
            reviewer="安全审核同事",
            approve=False,
            reason="新批跑更准确",
        )

        assert result.status == ReflowStatus.REVIEW_APPROVED
        assert result.is_covered is False
        assert result.current_label == "normal"

    def test_generate_evaluation_report(self, sample_model_output_1, sample_manual_judgment_1):
        engine = ReflowEngine()
        engine.import_model_output(sample_model_output_1, "工程师A")
        engine.add_manual_judgment(sample_manual_judgment_1, "周姐")

        report = engine.generate_evaluation_report(
            report_id="EVAL-001",
            operator="评测人员",
            version=1,
        )

        assert report.report_id == "EVAL-001"
        assert report.version == 1
        assert report.total_samples == 1
        assert "violent" in report.label_distribution
        assert len(report.items) == 1
        assert report.items[0].has_manual_judgment is True
        assert report.items[0].source == "manual"

        result = engine.get_result("SAMPLE-001")
        assert result.status == ReflowStatus.REPORT_UPDATED


class TestWorkflow:
    def test_full_three_step_workflow(self, sample_model_output_1, sample_manual_judgment_1):
        engine = ReflowEngine()
        wf = WorkflowManager(engine, data_dir="./test_data")

        result = wf.run_full_workflow(
            outputs=[sample_model_output_1],
            judgments=[sample_manual_judgment_1],
            report_id="EVAL-TEST",
            operator="周姐",
            version=1,
        )

        assert result["workflow_complete"] is True
        assert result["step1"]["processed_count"] == 1
        assert result["step2"]["processed_count"] == 1
        assert result["step3"]["total_samples"] == 1


class TestVersionControl:
    def test_create_and_rollback_snapshot(self, sample_model_output_1, sample_manual_judgment_1):
        engine = ReflowEngine()
        vc = VersionController(engine, data_dir="./test_data")

        engine.import_model_output(sample_model_output_1, "工程师A")
        snap = vc.create_snapshot("周姐", "导入后快照")

        engine.add_manual_judgment(sample_manual_judgment_1, "周姐")
        result_before = engine.get_result("SAMPLE-001")
        assert result_before.status == ReflowStatus.MANUAL_SUPPLEMENTED

        rollback_result = vc.rollback_to_snapshot(snap.version_id, "周姐")

        assert rollback_result["rollback_complete"] is True
        result_after = engine.get_result("SAMPLE-001")
        assert result_after.status == ReflowStatus.ROLLBACKED

        has_rollback_action = any(
            c.action == "rollback" for c in result_after.change_history
        )
        assert has_rollback_action is True


class TestUnifiedOutput:
    def test_api_and_page_use_same_data(self, sample_model_output_1, sample_manual_judgment_1):
        engine = ReflowEngine()
        engine.import_model_output(sample_model_output_1, "工程师A")
        engine.add_manual_judgment(sample_manual_judgment_1, "周姐")

        output = UnifiedOutput(engine)

        api_data = output.get_api_response("SAMPLE-001")
        page_data = output.get_page_display_data("SAMPLE-001")

        assert api_data["sample_id"] == page_data["sample_id"]
        assert api_data["status"] == page_data["status"]
        assert api_data["current_label"] == page_data["current_label"]
        assert api_data["is_covered"] == page_data["is_covered"]
        assert api_data["final_evidence"] == page_data["final_evidence"]
        assert "status_display" in page_data

    def test_export_details_consistent(self, sample_model_output_1):
        engine = ReflowEngine()
        engine.import_model_output(sample_model_output_1, "工程师A")

        output = UnifiedOutput(engine)
        details = output.get_detail_export()

        assert len(details) == 1
        assert details[0]["sample_id"] == "SAMPLE-001"
        assert details[0]["model_output"]["original_line_number"] == 1
        assert details[0]["model_output"]["batch_id"] == "BATCH-001"


class TestEvidenceRetention:
    def test_original_line_number_preserved(self, sample_model_output_1):
        engine = ReflowEngine()
        engine.import_model_output(sample_model_output_1, "工程师A")

        result = engine.get_result("SAMPLE-001")
        assert result.model_output.original_line_number == 1

        details = engine.export_details()
        assert details[0]["model_output"]["original_line_number"] == 1

    def test_change_history_complete(self, sample_model_output_1, sample_manual_judgment_1, sample_model_output_1_new_batch):
        engine = ReflowEngine()
        engine.import_model_output(sample_model_output_1, "工程师A")
        engine.add_manual_judgment(sample_manual_judgment_1, "周姐")
        engine.import_model_output(sample_model_output_1_new_batch, "工程师B")

        result = engine.get_result("SAMPLE-001")
        actions = [c.action for c in result.change_history]

        assert "model_import" in actions
        assert "manual_judgment_update" in actions
        assert "batch_override_detected" in actions
        assert "manual_judgment_overridden" in actions

        for entry in result.change_history:
            assert entry.operator is not None
            assert entry.timestamp is not None
