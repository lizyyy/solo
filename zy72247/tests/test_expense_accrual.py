import pytest
import tempfile
from pathlib import Path

from amc_expense_accrual.services.expense_accrual_service import ExpenseAccrualService
from amc_expense_accrual.models.evidence import ProcessingStatus
from amc_expense_accrual.services.split_line_detector import SplitLineDetector


class TestSplitLineDetector:
    def test_single_line_not_split(self):
        detector = SplitLineDetector()
        records = {
            "BIZ001": [
                {"record_id": "r1", "line_type": "利息", "amount": 1000, "is_split_line": False, "split_line_role": "", "status": "pending_review"},
            ]
        }
        result = detector.detect(records)
        assert result["BIZ001"][0]["is_split_line"] is False

    def test_split_line_detected(self):
        detector = SplitLineDetector()
        records = {
            "BIZ002": [
                {"record_id": "r1", "line_type": "手续费", "amount": 30, "is_split_line": False, "split_line_role": "", "status": "pending_review"},
                {"record_id": "r2", "line_type": "本金", "amount": 970, "is_split_line": False, "split_line_role": "", "status": "pending_review"},
            ]
        }
        result = detector.detect(records)
        assert result["BIZ002"][0]["is_split_line"] is True
        assert result["BIZ002"][0]["split_line_role"] == "手续费"
        assert result["BIZ002"][1]["is_split_line"] is True
        assert result["BIZ002"][1]["split_line_role"] == "本金"
        assert result["BIZ002"][0]["status"] == "split_line_pending_supervisor"
        assert result["BIZ002"][1]["status"] == "split_line_pending_supervisor"

    def test_two_lines_not_split_if_no_keywords(self):
        detector = SplitLineDetector()
        records = {
            "BIZ003": [
                {"record_id": "r1", "line_type": "利息", "amount": 500, "is_split_line": False, "split_line_role": "", "status": "pending_review"},
                {"record_id": "r2", "line_type": "利息", "amount": 500, "is_split_line": False, "split_line_role": "", "status": "pending_review"},
            ]
        }
        result = detector.detect(records)
        assert result["BIZ003"][0]["is_split_line"] is False
        assert result["BIZ003"][1]["is_split_line"] is False

    def test_split_line_not_auto_normalized(self):
        detector = SplitLineDetector()
        records = {
            "BIZ004": [
                {"record_id": "r1", "line_type": "手续费", "amount": 30, "is_split_line": False, "split_line_role": "", "status": "pending_review"},
                {"record_id": "r2", "line_type": "本金", "amount": 970, "is_split_line": False, "split_line_role": "", "status": "pending_review"},
            ]
        }
        result = detector.detect(records)
        for r in result["BIZ004"]:
            assert r["status"] == "split_line_pending_supervisor"
            assert r["is_split_line"] is True

    def test_explain_judgment(self):
        detector = SplitLineDetector()
        records = [
            {"line_type": "手续费", "amount": 30},
            {"line_type": "本金", "amount": 970},
        ]
        explanation = detector.explain_judgment("BIZ004", records)
        assert "BIZ004" in explanation
        assert "拆行" in explanation


class TestThreeStepWorkflow:
    def test_full_three_step_flow(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            svc = ExpenseAccrualService(storage_dir=tmpdir)

            screenshot_rows = [
                {
                    "original_line_number": 1,
                    "ex_rights_date": "2025-06-01",
                    "business_no": "BIZ001",
                    "amount": 10000,
                    "line_type": "利息",
                    "raw_text": "BIZ001 利息 10000",
                },
                {
                    "original_line_number": 2,
                    "ex_rights_date": "2025-06-01",
                    "business_no": "BIZ002",
                    "amount": 30,
                    "line_type": "手续费",
                    "raw_text": "BIZ002 手续费 30",
                },
                {
                    "original_line_number": 3,
                    "ex_rights_date": "2025-06-01",
                    "business_no": "BIZ002",
                    "amount": 970,
                    "line_type": "本金",
                    "raw_text": "BIZ002 本金 970",
                },
            ]
            records = svc.import_screenshot_evidence(screenshot_rows, operator="风控值班老秦")

            biz002_records = svc.get_records_by_business_no("BIZ002")
            assert len(biz002_records) == 2
            for r in biz002_records:
                assert r.is_split_line is True
                assert r.status == ProcessingStatus.SPLIT_LINE_PENDING_SUPERVISOR

            biz001_records = svc.get_records_by_business_no("BIZ001")
            assert len(biz001_records) == 1
            assert biz001_records[0].is_split_line is False
            assert biz001_records[0].status == ProcessingStatus.PENDING_REVIEW

            diff_v1 = svc.get_diff_list()
            assert diff_v1.current_version == 1

            tax_notes = [
                {
                    "business_no": "BIZ001",
                    "tax_rate": 0.06,
                    "note_text": "利息收入税率6%",
                    "stated_by": "现场财务张工",
                    "stated_date": "2025-06-02",
                },
                {
                    "business_no": "BIZ002",
                    "tax_rate": 0.03,
                    "note_text": "混合税率3%",
                    "stated_by": "现场财务张工",
                    "stated_date": "2025-06-02",
                },
            ]
            svc.review_tax_note_evidence(tax_notes, operator="风控值班老秦")

            biz001_after = svc.get_records_by_business_no("BIZ001")
            assert biz001_after[0].tax_note_evidence is not None
            assert biz001_after[0].status == ProcessingStatus.CONFIRMED

            biz002_after = svc.get_records_by_business_no("BIZ002")
            for r in biz002_after:
                assert r.tax_note_evidence is not None
                assert r.status == ProcessingStatus.SPLIT_LINE_PENDING_SUPERVISOR

            version = svc.update_diff_list(operator="风控值班老秦")
            assert version.version == 3

            diff_list = svc.get_diff_list()
            biz002_item = None
            for item in diff_list.versions[-1].items:
                if item.business_no == "BIZ002":
                    biz002_item = item
                    break
            assert biz002_item is not None
            assert biz002_item.needs_supervisor_review is True


class TestRollbackAndWithdraw:
    def test_rollback_restores_previous_version(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            svc = ExpenseAccrualService(storage_dir=tmpdir)

            screenshot_rows = [
                {
                    "original_line_number": 1,
                    "ex_rights_date": "2025-06-01",
                    "business_no": "BIZ001",
                    "amount": 5000,
                    "line_type": "利息",
                    "raw_text": "BIZ001 利息 5000",
                },
            ]
            svc.import_screenshot_evidence(screenshot_rows, operator="风控值班老秦")
            v1 = svc.get_diff_list().current_version

            tax_notes = [
                {
                    "business_no": "BIZ001",
                    "tax_rate": 0.06,
                    "note_text": "税率6%",
                    "stated_by": "现场说法",
                    "stated_date": "2025-06-02",
                },
            ]
            svc.review_tax_note_evidence(tax_notes, operator="风控值班老秦")
            v2 = svc.get_diff_list().current_version
            assert v2 > v1

            result = svc.rollback_diff_list(v1, operator="风控值班老秦")
            assert result is not None
            assert result.trigger == f"rollback_to_v{v1}"

            current = svc.get_diff_list()
            assert current.current_version == v2 + 1

    def test_withdraw_tax_note_restores_diff(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            svc = ExpenseAccrualService(storage_dir=tmpdir)

            screenshot_rows = [
                {
                    "original_line_number": 1,
                    "ex_rights_date": "2025-06-01",
                    "business_no": "BIZ001",
                    "amount": 5000,
                    "line_type": "利息",
                    "raw_text": "BIZ001 利息 5000",
                },
            ]
            svc.import_screenshot_evidence(screenshot_rows)

            tax_notes = [
                {
                    "business_no": "BIZ001",
                    "tax_rate": 0.06,
                    "note_text": "误当做新材料",
                    "stated_by": "现场说法",
                    "stated_date": "2025-06-02",
                },
            ]
            svc.review_tax_note_evidence(tax_notes, operator="风控值班老秦")

            biz001 = svc.get_records_by_business_no("BIZ001")
            assert biz001[0].tax_note_evidence is not None

            svc.withdraw_tax_note(
                "BIZ001", reason="误把税费率备注当成新材料", operator="风控值班老秦"
            )

            biz001_after = svc.get_records_by_business_no("BIZ001")
            assert biz001_after[0].tax_note_evidence is None
            assert biz001_after[0].status == ProcessingStatus.ROLLED_BACK
            assert len(biz001_after[0].manual_changes) > 0


class TestUnifiedResultSource:
    def test_accrual_result_and_diff_list_read_same_source(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            svc = ExpenseAccrualService(storage_dir=tmpdir)

            screenshot_rows = [
                {
                    "original_line_number": 1,
                    "ex_rights_date": "2025-06-01",
                    "business_no": "BIZ001",
                    "amount": 10000,
                    "line_type": "利息",
                    "raw_text": "BIZ001 利息 10000",
                },
            ]
            svc.import_screenshot_evidence(screenshot_rows)

            accrual = svc.get_accrual_result()
            diff = svc.get_diff_list()
            diff_item = diff.versions[-1].items[0]

            assert len(accrual.lines) == 1
            assert accrual.lines[0].business_no == diff_item.business_no
            assert accrual.lines[0].amount == diff_item.expected_amount

    def test_split_line_consistent_across_views(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            svc = ExpenseAccrualService(storage_dir=tmpdir)

            screenshot_rows = [
                {
                    "original_line_number": 2,
                    "ex_rights_date": "2025-06-01",
                    "business_no": "BIZ002",
                    "amount": 30,
                    "line_type": "手续费",
                    "raw_text": "BIZ002 手续费 30",
                },
                {
                    "original_line_number": 3,
                    "ex_rights_date": "2025-06-01",
                    "business_no": "BIZ002",
                    "amount": 970,
                    "line_type": "本金",
                    "raw_text": "BIZ002 本金 970",
                },
            ]
            svc.import_screenshot_evidence(screenshot_rows)

            accrual = svc.get_accrual_result()
            diff = svc.get_diff_list()

            for line in accrual.lines:
                if line.business_no == "BIZ002":
                    assert line.is_split_line is True
                    assert line.evidence.status == ProcessingStatus.SPLIT_LINE_PENDING_SUPERVISOR

            diff_item = [i for i in diff.versions[-1].items if i.business_no == "BIZ002"][0]
            assert diff_item.needs_supervisor_review is True

    def test_no_inconsistent_display(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            svc = ExpenseAccrualService(storage_dir=tmpdir)

            screenshot_rows = [
                {
                    "original_line_number": 2,
                    "ex_rights_date": "2025-06-01",
                    "business_no": "BIZ002",
                    "amount": 30,
                    "line_type": "手续费",
                    "raw_text": "BIZ002 手续费 30",
                },
                {
                    "original_line_number": 3,
                    "ex_rights_date": "2025-06-01",
                    "business_no": "BIZ002",
                    "amount": 970,
                    "line_type": "本金",
                    "raw_text": "BIZ002 本金 970",
                },
            ]
            svc.import_screenshot_evidence(screenshot_rows)

            accrual = svc.get_accrual_result()
            diff = svc.get_diff_list()

            accrual_biz002 = [l for l in accrual.lines if l.business_no == "BIZ002"]
            diff_biz002 = [i for i in diff.versions[-1].items if i.business_no == "BIZ002"]

            assert len(accrual_biz002) == 2
            assert len(diff_biz002) == 1

            for line in accrual_biz002:
                assert line.is_split_line is True

            assert diff_biz002[0].needs_supervisor_review is True

            csv_content = svc.export_details_csv()
            assert "split_line_pending_supervisor" in csv_content
            assert "True" in csv_content

            accrual_csv = svc.export_accrual_csv()
            assert "True" in accrual_csv
            assert "split_line_pending_supervisor" in accrual_csv


class TestEvidenceAuditTrail:
    def test_screenshot_original_line_number_preserved(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            svc = ExpenseAccrualService(storage_dir=tmpdir)
            screenshot_rows = [
                {
                    "original_line_number": 42,
                    "ex_rights_date": "2025-06-01",
                    "business_no": "BIZ099",
                    "amount": 999,
                    "line_type": "利息",
                    "raw_text": "原始行42",
                },
            ]
            records = svc.import_screenshot_evidence(screenshot_rows)
            assert records[0].screenshot_evidence.original_line_number == 42
            assert records[0].screenshot_evidence.raw_text == "原始行42"

    def test_manual_change_recorded(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            svc = ExpenseAccrualService(storage_dir=tmpdir)
            screenshot_rows = [
                {
                    "original_line_number": 1,
                    "ex_rights_date": "2025-06-01",
                    "business_no": "BIZ001",
                    "amount": 1000,
                    "line_type": "利息",
                    "raw_text": "BIZ001",
                },
            ]
            records = svc.import_screenshot_evidence(screenshot_rows)
            record_id = records[0].record_id

            updated = svc.apply_manual_change(
                record_id=record_id,
                field_name="status",
                new_value="confirmed",
                reason="结算主管确认",
                operator="结算主管",
            )
            assert updated is not None
            assert len(updated.manual_changes) == 1
            assert updated.manual_changes[0].changed_by == "结算主管"
            assert updated.manual_changes[0].reason == "结算主管确认"
            assert updated.manual_changes[0].old_value is not None
            assert updated.manual_changes[0].new_value == "confirmed"


class TestPersistence:
    def test_state_persist_and_load(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            svc1 = ExpenseAccrualService(storage_dir=tmpdir)
            screenshot_rows = [
                {
                    "original_line_number": 1,
                    "ex_rights_date": "2025-06-01",
                    "business_no": "BIZ001",
                    "amount": 5000,
                    "line_type": "利息",
                    "raw_text": "BIZ001",
                },
            ]
            svc1.import_screenshot_evidence(screenshot_rows, operator="test")

            svc2 = ExpenseAccrualService(storage_dir=tmpdir)
            loaded = svc2.load_state()
            assert loaded is True

            records = svc2.get_all_records()
            assert len(records) == 1
            assert records[0].business_no == "BIZ001"
