import os
import sys
import shutil
import tempfile
import pytest
from datetime import datetime

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from translation_review.storage import Storage
from translation_review.processor import RecordProcessor
from translation_review.validator import Validator
from translation_review.workflow import WorkflowManager
from translation_review.models import (
    RecordStatus,
    WorkflowStep,
    AbnormalType,
)


@pytest.fixture
def temp_data_dir():
    tmp = tempfile.mkdtemp()
    yield tmp
    shutil.rmtree(tmp, ignore_errors=True)


@pytest.fixture
def storage(temp_data_dir):
    return Storage(temp_data_dir)


@pytest.fixture
def processor(storage):
    return RecordProcessor(storage)


@pytest.fixture
def validator(storage):
    return Validator(storage)


@pytest.fixture
def workflow(storage):
    return WorkflowManager(storage)


def sample_ticket(ticket_id="FB001", line_no=1):
    return {
        "ticket_id": ticket_id,
        "original_line_no": line_no,
        "raw_content": "test feedback",
        "source_language": "zh",
        "target_language": "en",
        "feedback_type": "translation_error",
        "reported_at": datetime.now(),
        "reporter": "tester",
        "original_translation": "Hello",
        "customer_text": "你好",
    }


class TestRecordProcessor:
    def test_import_single_record(self, processor, storage):
        record = processor.import_ticket(
            ticket_data=sample_ticket(),
            sample_no="S001",
            model_version="v1.0",
            model_translation="Hello",
        )
        assert record.record_id is not None
        assert record.sample_no == "S001"
        assert record.status == RecordStatus.PENDING_REVIEW
        assert record.current_step == WorkflowStep.STEP1_IMPORT
        assert record.abnormal_types == []

        saved = storage.get_record(record.record_id)
        assert saved is not None
        assert saved.sample_no == "S001"

    def test_duplicate_import_detection(self, processor):
        ticket = sample_ticket("FB_DUP", 10)
        r1 = processor.import_ticket(ticket, "S001", "v1.0", "Hello")
        r2 = processor.import_ticket(ticket, "S002", "v1.0", "Hi")

        assert AbnormalType.DUPLICATE_IMPORT in r2.abnormal_types
        assert r2.status == RecordStatus.NEEDS_RECHECK

    def test_model_version_change_detection(self, processor):
        r1 = processor.import_ticket(sample_ticket("FB01", 1), "S001", "v1.0", "Hello")
        r2 = processor.import_ticket(sample_ticket("FB02", 2), "S001", "v2.0", "Hi")

        assert AbnormalType.MODEL_VERSION_CHANGED in r2.abnormal_types
        assert r2.status == RecordStatus.NEEDS_RECHECK

    def test_add_desensitization_note(self, processor):
        record = processor.import_ticket(sample_ticket(), "S001", "v1.0", "Hello")
        record2 = processor.add_desensitization_note(
            record.record_id,
            rule_name="隐私规则",
            rule_description="用户信息脱敏",
            reviewer="xiaoqiao",
            is_desensitized=True,
            remark="ok",
        )
        assert record2.desensitization_note is not None
        assert record2.desensitization_note.reviewer == "xiaoqiao"
        assert record2.current_step == WorkflowStep.STEP2_DESENSITIZATION
        assert len(record2.manual_changes) == 0

    def test_update_translation(self, processor):
        record = processor.import_ticket(sample_ticket(), "S001", "v1.0", "Hello")
        record2 = processor.update_translation(
            record.record_id,
            new_translation="Hello World",
            operator="editor",
            reason="improve quality",
        )
        assert record2.final_translation == "Hello World"
        assert len(record2.manual_changes) == 1
        change = record2.manual_changes[0]
        assert change.field_name == "final_translation"
        assert change.old_value == "Hello"
        assert change.new_value == "Hello World"

    def test_recalculate(self, processor):
        record = processor.import_ticket(sample_ticket(), "S001", "v1.0", "Hello")
        record2 = processor.recalculate(
            record.record_id,
            new_model_translation="Hello there",
            operator="system",
        )
        assert record2.model_translation == "Hello there"
        assert record2.recheck_count == 1

    def test_mark_supplementary(self, processor):
        record = processor.import_ticket(sample_ticket(), "S001", "v1.0", "Hello")
        record2 = processor.mark_supplementary(record.record_id, "operator")
        assert AbnormalType.SUPPLEMENTARY_RECORD in record2.abnormal_types
        assert record2.status == RecordStatus.NEEDS_RECHECK
        assert record2.recheck_count == 1


class TestValidator:
    def test_check_duplicate_imports(self, processor, validator):
        ticket = sample_ticket("FB_DUP", 10)
        processor.import_ticket(ticket, "S001", "v1.0", "Hello")
        processor.import_ticket(ticket, "S002", "v1.0", "Hi")

        issues = validator.check_duplicate_imports()
        assert len(issues) >= 2
        assert all(i.abnormal_type == AbnormalType.DUPLICATE_IMPORT for i in issues)

    def test_check_model_version_changes(self, processor, validator):
        processor.import_ticket(sample_ticket("FB01", 1), "S001", "v1.0", "Hello")
        processor.import_ticket(sample_ticket("FB02", 2), "S001", "v2.0", "Hi")

        issues = validator.check_model_version_changes()
        assert len(issues) >= 2
        assert all(i.abnormal_type == AbnormalType.MODEL_VERSION_CHANGED for i in issues)

    def test_check_export_consistency(self, processor, validator):
        processor.import_ticket(sample_ticket(), "S001", "v1.0", "Hello")
        ok, issues = validator.check_export_consistency()
        assert ok is True
        assert len(issues) == 0

    def test_run_all_checks(self, processor, validator):
        processor.import_ticket(sample_ticket("FB01", 1), "S001", "v1.0", "Hello")
        processor.import_ticket(sample_ticket("FB02", 2), "S001", "v2.0", "Hi")
        results = validator.run_all_checks()
        assert "duplicate_imports" in results
        assert "model_version_changes" in results
        assert "supplementary_records" in results
        assert "export_consistency" in results

    def test_get_check_summary(self, processor, validator):
        processor.import_ticket(sample_ticket("FB01", 1), "S001", "v1.0", "Hello")
        processor.import_ticket(sample_ticket("FB02", 2), "S001", "v2.0", "Hi")
        validator.run_all_checks()
        summary = validator.get_check_summary()
        assert summary["total_records"] == 2
        assert summary["unresolved_issues"] > 0


class TestWorkflow:
    def test_three_step_workflow(self, processor, workflow):
        record = processor.import_ticket(sample_ticket(), "S001", "v1.0", "Hello")
        assert record.current_step == WorkflowStep.STEP1_IMPORT

        record = workflow.advance_to_desensitization(record.record_id, "operator1")
        assert record.current_step == WorkflowStep.STEP2_DESENSITIZATION
        assert record.status == RecordStatus.DESENSITIZATION_REVIEWED

        processor.add_desensitization_note(
            record.record_id, "规则1", "描述1", "xiaoqiao", True
        )
        record = workflow.advance_to_product_review(record.record_id, "operator2")
        assert record.current_step == WorkflowStep.STEP3_PRODUCT
        assert record.status == RecordStatus.PRODUCT_REVIEWED

        record = workflow.complete_workflow(record.record_id, "operator3")
        assert record.current_step == WorkflowStep.COMPLETED
        assert record.status == RecordStatus.NORMAL

    def test_model_version_change_blocks_auto_approval(self, processor, workflow):
        processor.import_ticket(sample_ticket("FB01", 1), "S001", "v1.0", "Hello")
        record2 = processor.import_ticket(sample_ticket("FB02", 2), "S001", "v2.0", "Hi")

        assert AbnormalType.MODEL_VERSION_CHANGED in record2.abnormal_types
        assert record2.status == RecordStatus.NEEDS_RECHECK

        record2 = workflow.advance_to_desensitization(record2.record_id, "op")
        assert record2.status == RecordStatus.NEEDS_RECHECK

        needs_review = workflow.list_records_needing_review()
        assert any(r.record_id == record2.record_id for r in needs_review)

    def test_operator_review_approve(self, processor, workflow):
        processor.import_ticket(sample_ticket("FB01", 1), "S001", "v1.0", "Hello")
        record2 = processor.import_ticket(sample_ticket("FB02", 2), "S001", "v2.0", "Hi")

        record2 = processor.add_desensitization_note(
            record2.record_id, "规则1", "描述1", "xiaoqiao", True
        )
        assert record2.current_step == WorkflowStep.STEP2_DESENSITIZATION
        record2 = workflow.advance_to_product_review(record2.record_id, "op")

        record2 = workflow.operator_review(
            record2.record_id, "reviewer", approve=True, remark="ok"
        )
        assert record2.status == RecordStatus.NORMAL
        assert record2.current_step == WorkflowStep.COMPLETED

    def test_operator_review_reject(self, processor, workflow):
        processor.import_ticket(sample_ticket("FB01", 1), "S001", "v1.0", "Hello")
        record2 = processor.import_ticket(sample_ticket("FB02", 2), "S001", "v2.0", "Hi")

        record2 = workflow.operator_review(
            record2.record_id, "reviewer", approve=False, remark="bad"
        )
        assert record2.status == RecordStatus.ABNORMAL

    def test_get_evidence_summary(self, processor, workflow):
        record = processor.import_ticket(sample_ticket("FB_EV", 99), "S001", "v1.0", "Hello")
        processor.add_desensitization_note(
            record.record_id, "规则A", "描述A", "xiaoqiao", True, "测试备注"
        )
        processor.update_translation(
            record.record_id, "Hello Updated", "editor", "修正"
        )

        ev = workflow.get_evidence_summary(record.record_id)
        assert ev.record_id == record.record_id
        assert ev.sample_no == "S001"
        assert ev.original_line_no == 99
        assert ev.ticket_id == "FB_EV"
        assert ev.has_manual_changes is True
        assert ev.manual_change_count == 1
        assert ev.has_desensitization_note is True
        assert ev.desensitization_reviewer == "xiaoqiao"
        assert "FB_EV" in ev.feedback_summary
        assert "规则A" in ev.desensitization_summary

    def test_get_workflow_progress(self, processor, workflow):
        record = processor.import_ticket(sample_ticket(), "S001", "v1.0", "Hello")
        progress = workflow.get_workflow_progress(record.record_id)
        assert progress["current_step"] == WorkflowStep.STEP1_IMPORT
        assert progress["steps"][0]["completed"] is True
        assert progress["steps"][1]["completed"] is False


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
