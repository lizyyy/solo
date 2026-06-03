from __future__ import annotations

import json
import pytest

from wanglian_clearing_diff.models import ProcessingStatus, SelfCheckRule
from wanglian_clearing_diff.store import ResultStore
from wanglian_clearing_diff.workflow import WorkflowEngine
from wanglian_clearing_diff.self_check import SelfCheckEngine


@pytest.fixture(autouse=True)
def fresh_store():
    ResultStore.reset()
    store = ResultStore.get_instance()
    yield store
    ResultStore.reset()


SAMPLE_ROWS = [
    {
        "id": "t001",
        "clearing_batch_no": "WL20260601001",
        "original_line_no": 1,
        "channel": "网联A通道",
        "amount": 50000,
        "remark": "正常清分",
    },
    {
        "id": "t002",
        "clearing_batch_no": "WL20260601001",
        "original_line_no": 2,
        "channel": "网联A通道",
        "amount": 0,
        "remark": "已冲正",
    },
    {
        "id": "t003",
        "clearing_batch_no": "WL20260601001",
        "original_line_no": 3,
        "channel": "网联B通道",
        "amount": 120000,
        "remark": "正常清分",
    },
    {
        "id": "t004",
        "clearing_batch_no": "WL20260602001",
        "original_line_no": 1,
        "channel": "网联A通道",
        "amount": 30000,
        "remark": "正常清分",
    },
    {
        "id": "t005",
        "clearing_batch_no": "WL20260602001",
        "original_line_no": 2,
        "channel": "网联C通道",
        "amount": 0,
        "remark": "已冲正-交易失败退款",
    },
    {
        "id": "t006",
        "clearing_batch_no": "WL20260602001",
        "original_line_no": 1,
        "channel": "网联A通道",
        "amount": 30000,
        "remark": "正常清分",
    },
]


class TestImportAndSelfCheck:
    def test_import_creates_records(self, fresh_store):
        engine = WorkflowEngine(fresh_store)
        records = engine.import_records(SAMPLE_ROWS)
        assert len(records) == 6

    def test_self_check_detects_zero_reversed(self, fresh_store):
        engine = WorkflowEngine(fresh_store)
        engine.import_records(SAMPLE_ROWS)
        results = engine.run_self_check()

        zero_rev = [r for r in results if r["rule"] == SelfCheckRule.ZERO_AMOUNT_REVERSED.value]
        failed_zero = [r for r in zero_rev if not r["passed"]]
        assert len(failed_zero) == 2

    def test_self_check_detects_duplicate(self, fresh_store):
        engine = WorkflowEngine(fresh_store)
        engine.import_records(SAMPLE_ROWS)
        results = engine.run_self_check()

        dup = [r for r in results if r["rule"] == SelfCheckRule.DUPLICATE_IMPORT.value]
        failed_dup = [r for r in dup if not r["passed"]]
        assert len(failed_dup) >= 1

    def test_zero_reversed_records_marked_pending_review(self, fresh_store):
        engine = WorkflowEngine(fresh_store)
        engine.import_records(SAMPLE_ROWS)
        engine.run_self_check()

        for record in fresh_store.get_records():
            if record.is_zero_reversed:
                assert record.status == ProcessingStatus.PENDING_REVIEW

    def test_normal_records_pass_self_check(self, fresh_store):
        engine = WorkflowEngine(fresh_store)
        engine.import_records(SAMPLE_ROWS)
        engine.run_self_check()

        normal = [r for r in fresh_store.get_records() if not r.is_zero_reversed and not r.is_duplicate]
        for record in normal:
            assert record.status == ProcessingStatus.SELF_CHECK_PASSED


class TestWorkflow:
    def test_three_step_workflow(self, fresh_store):
        engine = WorkflowEngine(fresh_store)

        engine.import_records(SAMPLE_ROWS)
        engine.run_self_check()

        info = engine.apply_holiday_note(
            "WL20260601001",
            "端午节顺延一天，6月2日到账",
            effective_date="2026-06-02",
            source="人行公告",
        )
        assert info is not None
        assert info.note == "端午节顺延一天，6月2日到账"

        for record in fresh_store.find_by_batch_no("WL20260601001"):
            if not record.is_zero_reversed:
                assert record.status == ProcessingStatus.HOLIDAY_NOTED

        update = engine.update_summary("WL20260601001", note="6月1日批次摘要")
        assert update is not None
        assert update.pending_review_count == 1

        for record in fresh_store.find_by_batch_no("WL20260601001"):
            if record.is_zero_reversed:
                assert record.status == ProcessingStatus.PENDING_REVIEW
            else:
                assert record.status == ProcessingStatus.SUMMARY_UPDATED

    def test_zero_reversed_not_auto_normalized(self, fresh_store):
        engine = WorkflowEngine(fresh_store)

        engine.import_records([{
            "id": "zr001",
            "clearing_batch_no": "WL999",
            "original_line_no": 1,
            "amount": 0,
            "remark": "已冲正",
        }])
        engine.run_self_check()

        record = fresh_store.get_record("zr001")
        assert record.is_zero_reversed is True
        assert record.status == ProcessingStatus.PENDING_REVIEW

        engine.apply_holiday_note("WL999", "顺延", actor="anan")
        engine.update_summary("WL999", note="摘要")

        record = fresh_store.get_record("zr001")
        assert record.status == ProcessingStatus.PENDING_REVIEW

    def test_confirm_rejected_record(self, fresh_store):
        engine = WorkflowEngine(fresh_store)

        engine.import_records([{
            "id": "cf001",
            "clearing_batch_no": "WL888",
            "original_line_no": 1,
            "amount": 0,
            "remark": "已冲正",
        }])
        engine.run_self_check()

        record = engine.confirm_record("cf001", actor="风控小李")
        assert record.status == ProcessingStatus.CONFIRMED
        assert any(e.action == "confirmed" for e in record.manual_edits)

        engine.import_records([{
            "id": "rj001",
            "clearing_batch_no": "WL887",
            "original_line_no": 1,
            "amount": 0,
            "remark": "已冲正",
        }])
        engine.run_self_check()

        record = engine.reject_record("rj001", reason="数据有误", actor="风控小王")
        assert record.status == ProcessingStatus.REJECTED

    def test_supplement_and_recalc(self, fresh_store):
        engine = WorkflowEngine(fresh_store)

        engine.import_records([{
            "id": "sp001",
            "clearing_batch_no": "WL777",
            "original_line_no": 1,
            "amount": 10000,
            "remark": "待补录",
        }])
        engine.run_self_check()

        engine.supplement_record("sp001", new_amount=15000, note="补录差异数", actor="anan")

        record = fresh_store.get_record("sp001")
        assert record.amount == 15000
        assert record.supplement_applied is True
        assert any(e.action == "supplement_applied" for e in record.manual_edits)


class TestResultStoreConsistency:
    def test_export_matches_records(self, fresh_store):
        engine = WorkflowEngine(fresh_store)
        engine.import_records(SAMPLE_ROWS)
        engine.run_self_check()

        export = fresh_store.export_records()
        records = fresh_store.get_records()
        assert len(export) == len(records)

        for record in records:
            exported = next(e for e in export if e["id"] == record.id)
            assert exported["amount"] == record.amount
            assert exported["status"] == record.status.value
            assert exported["is_zero_reversed"] == record.is_zero_reversed

    def test_evidence_summary_complete(self, fresh_store):
        engine = WorkflowEngine(fresh_store)
        engine.import_records(SAMPLE_ROWS)
        engine.run_self_check()

        for record in fresh_store.get_records():
            ev = fresh_store.build_evidence_summary(record.id)
            assert ev is not None
            assert ev.clearing_batch_no == record.clearing_batch_no
            assert ev.original_line_no == record.original_line_no
            assert ev.is_zero_reversed == record.is_zero_reversed
            assert len(ev.audit_trail_summary) > 0

    def test_single_source_for_all_outputs(self, fresh_store):
        engine = WorkflowEngine(fresh_store)
        engine.import_records(SAMPLE_ROWS)
        engine.run_self_check()
        engine.apply_holiday_note("WL20260601001", "顺延")
        engine.update_summary("WL20260601001")

        records = fresh_store.get_records()
        export = fresh_store.export_records()
        evidence = fresh_store.export_evidence_summaries()

        batch_records = [r for r in records if r.clearing_batch_no == "WL20260601001"]
        batch_export = [e for e in export if e["clearing_batch_no"] == "WL20260601001"]
        batch_evidence = [e for e in evidence if e["clearing_batch_no"] == "WL20260601001"]

        assert len(batch_records) == len(batch_export)
        assert len(batch_records) == len(batch_evidence)

        for record in batch_records:
            exp = next(e for e in batch_export if e["id"] == record.id)
            ev = next(e for e in batch_evidence if e["original_line_no"] == record.original_line_no)
            assert record.status.value == exp["status"]
            assert record.status.value == ev["status"]
            assert record.is_zero_reversed == exp["is_zero_reversed"]
            assert record.is_zero_reversed == ev["is_zero_reversed"]


class TestAuditTrail:
    def test_original_line_no_preserved(self, fresh_store):
        engine = WorkflowEngine(fresh_store)
        engine.import_records(SAMPLE_ROWS)

        for record in fresh_store.get_records():
            assert record.original_line_no > 0

    def test_manual_edits_recorded(self, fresh_store):
        engine = WorkflowEngine(fresh_store)
        engine.import_records([{
            "id": "me001",
            "clearing_batch_no": "WL666",
            "original_line_no": 1,
            "amount": 0,
            "remark": "已冲正",
        }])
        engine.run_self_check()

        engine.confirm_record("me001", actor="风控小张")
        record = fresh_store.get_record("me001")

        assert len(record.manual_edits) == 1
        assert record.manual_edits[0].actor == "风控小张"
        assert record.manual_edits[0].original_value == ProcessingStatus.PENDING_REVIEW.value
        assert record.manual_edits[0].new_value == ProcessingStatus.CONFIRMED.value

    def test_full_audit_trail(self, fresh_store):
        engine = WorkflowEngine(fresh_store)
        engine.import_records([{
            "id": "at001",
            "clearing_batch_no": "WL555",
            "original_line_no": 1,
            "amount": 0,
            "remark": "已冲正",
        }])
        engine.run_self_check()
        engine.apply_holiday_note("WL555", "顺延说明")
        engine.update_summary("WL555")
        engine.confirm_record("at001", actor="风控小李")

        record = fresh_store.get_record("at001")
        actions = [e.action for e in record.audit_trail]
        assert "imported" in actions
        assert "self_check" in actions
        assert "holiday_extension_applied" in actions
        assert "summary_update_skipped_zero_reversed" in actions
        assert "confirmed" in actions


class TestSampleDataEndToEnd:
    def test_sample_file_runs_to_report(self, fresh_store, tmp_path):
        sample_path = tmp_path / "sample.json"
        sample_path.write_text(json.dumps(SAMPLE_ROWS, ensure_ascii=False), encoding="utf-8")

        with open(sample_path, encoding="utf-8") as f:
            rows = json.load(f)

        engine = WorkflowEngine(fresh_store)
        records = engine.import_records(rows)
        assert len(records) == 6

        check_results = engine.run_self_check()
        failures = [r for r in check_results if not r["passed"]]
        assert len(failures) > 0

        engine.apply_holiday_note(
            "WL20260601001",
            "端午节顺延",
            effective_date="2026-06-02",
            source="人行公告",
            actor="anan",
        )
        update = engine.update_summary("WL20260601001", note="6月1日批次")
        assert update is not None
        assert update.pending_review_count == 1

        report = {
            "records": fresh_store.export_records(),
            "check_results": fresh_store.export_check_results(),
            "evidence_summaries": fresh_store.export_evidence_summaries(),
        }

        assert len(report["records"]) == 6
        assert len(report["evidence_summaries"]) == 6

        zero_rev_in_report = [r for r in report["records"] if r["is_zero_reversed"]]
        assert len(zero_rev_in_report) == 2
        for r in zero_rev_in_report:
            assert r["status"] == "pending_review"
