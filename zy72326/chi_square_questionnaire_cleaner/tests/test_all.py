import unittest
import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.evidence import EvidenceChain, ProcessingStatus
from src.result_store import ResultStore
from src.chi_square_cleaner import ChiSquareCleaner, ANOMALY_DENOMINATOR_ZERO_EMPTY, ANOMALY_DUPLICATE_IMPORT
from src.self_check import SelfChecker, compute_chi_square
from src.workflow import Workflow


class TestEvidenceChain(unittest.TestCase):
    def setUp(self):
        self.ev = EvidenceChain()

    def test_add_record(self):
        rec = self.ev.add(3, "denominator", "", ANOMALY_DENOMINATOR_ZERO_EMPTY, "test detail")
        self.assertEqual(rec.evidence_id, "EVD-0001")
        self.assertEqual(rec.original_row, 3)
        self.assertEqual(rec.current_status, ProcessingStatus.AUTO_FLAGGED)

    def test_update_status(self):
        rec = self.ev.add(3, "denominator", "", ANOMALY_DENOMINATOR_ZERO_EMPTY)
        updated = self.ev.update_status(rec.evidence_id, ProcessingStatus.PENDING_REVIEW, manual_change="flagged")
        self.assertEqual(updated.current_status, ProcessingStatus.PENDING_REVIEW)
        self.assertEqual(updated.manual_change, "flagged")

    def test_get_by_row(self):
        self.ev.add(3, "denominator", "", ANOMALY_DENOMINATOR_ZERO_EMPTY)
        self.ev.add(5, "denominator", "", ANOMALY_DENOMINATOR_ZERO_EMPTY)
        rows = self.ev.get_by_row(3)
        self.assertEqual(len(rows), 1)

    def test_json_roundtrip(self):
        self.ev.add(3, "denominator", "", ANOMALY_DENOMINATOR_ZERO_EMPTY)
        self.ev.add(5, "denominator", "", ANOMALY_DENOMINATOR_ZERO_EMPTY)
        j = self.ev.to_json()
        ev2 = EvidenceChain()
        ev2.from_json(j)
        self.assertEqual(len(ev2.all_records()), 2)
        self.assertEqual(ev2.all_records()[0].evidence_id, "EVD-0001")


class TestResultStore(unittest.TestCase):
    def setUp(self):
        ResultStore.reset()
        self.store = ResultStore()

    def tearDown(self):
        ResultStore.reset()

    def test_singleton(self):
        s2 = ResultStore()
        self.assertIs(self.store, s2)

    def test_set_get_cleaned_rows(self):
        rows = [{"a": 1}, {"a": 2}]
        self.store.set_cleaned_rows(rows)
        got = self.store.get_cleaned_rows()
        self.assertEqual(got, rows)
        got[0]["a"] = 999
        self.assertNotEqual(self.store.get_cleaned_rows()[0]["a"], 999)

    def test_display_api_export_consistency(self):
        self.store.set_cleaned_rows([{"x": 1}])
        self.store.set_anomaly_rows([{"x": 2, "_anomaly": ANOMALY_DENOMINATOR_ZERO_EMPTY}])
        self.store.set_chi_square_result({"chi_square": 1.5})
        self.store.set_summary({"total": 2})

        display = self.store.get_display_data()
        api = self.store.get_api_response()
        export = self.store.get_export_data()
        self.assertEqual(display, api)
        self.assertEqual(display, export)

    def test_export_csv(self):
        self.store.set_cleaned_rows([{"group": "A", "count": 5}])
        with tempfile.NamedTemporaryFile(suffix=".csv", delete=False, mode="w") as f:
            path = f.name
        self.store.export_csv(path)
        with open(path, encoding="utf-8") as f:
            content = f.read()
        os.unlink(path)
        self.assertIn("group", content)
        self.assertIn("A", content)


class TestChiSquareCleaner(unittest.TestCase):
    def setUp(self):
        ResultStore.reset()
        self.ev = EvidenceChain()
        self.store = ResultStore()
        self.cleaner = ChiSquareCleaner(self.ev, self.store)

    def tearDown(self):
        ResultStore.reset()

    def test_denominator_zero_empty_string_flagged(self):
        rows = [
            {"group": "A", "count_a": "0", "count_b": "0", "denominator": "", "_original_row": 2},
            {"group": "B", "count_a": "6", "count_b": "9", "denominator": "15", "_original_row": 3},
        ]
        self.cleaner.configure(["denominator"], ["count_a", "count_b"])
        result = self.cleaner.import_rows(rows)
        self.assertEqual(result["denominator_zero_empty_count"], 1)
        anomaly = self.store.get_anomaly_rows()
        self.assertTrue(any(r.get("_anomaly") == ANOMALY_DENOMINATOR_ZERO_EMPTY for r in anomaly))

    def test_denominator_empty_with_nonzero_counts_auto_filled(self):
        rows = [
            {"group": "A", "count_a": "10", "count_b": "5", "denominator": "", "_original_row": 2},
        ]
        self.cleaner.configure(["denominator"], ["count_a", "count_b"])
        result = self.cleaner.import_rows(rows)
        self.assertEqual(result["denominator_zero_empty_count"], 0)
        cleaned = self.store.get_cleaned_rows()
        self.assertEqual(cleaned[0]["denominator"], "15")

    def test_denominator_zero_empty_string_row_a3(self):
        rows = [
            {"group": "A", "count_a": "0", "count_b": "0", "denominator": "", "_original_row": 2},
        ]
        self.cleaner.configure(["denominator"], ["count_a", "count_b"])
        result = self.cleaner.import_rows(rows)
        self.assertEqual(result["denominator_zero_empty_count"], 1)
        dz_records = self.ev.get_by_anomaly_type(ANOMALY_DENOMINATOR_ZERO_EMPTY)
        self.assertEqual(len(dz_records), 1)
        self.assertEqual(dz_records[0].current_status, ProcessingStatus.PENDING_REVIEW)

    def test_duplicate_import_detected(self):
        rows = [
            {"group": "A", "count_a": "10", "count_b": "5", "denominator": "15", "_original_row": 2},
            {"group": "A", "count_a": "10", "count_b": "5", "denominator": "15", "_original_row": 3},
        ]
        self.cleaner.configure(["denominator"], ["count_a", "count_b"])
        result = self.cleaner.import_rows(rows)
        self.assertEqual(result["duplicate_count"], 1)
        self.assertEqual(result["cleaned_count"], 1)

    def test_normal_row_denominator_empty_auto_filled_with_sum(self):
        rows = [
            {"group": "A", "count_a": "10", "count_b": "5", "denominator": "", "_original_row": 2},
        ]
        self.cleaner.configure(["denominator"], ["count_a", "count_b"])
        result = self.cleaner.import_rows(rows)
        self.assertEqual(result["denominator_zero_empty_count"], 0)
        cleaned = self.store.get_cleaned_rows()
        self.assertEqual(cleaned[0]["denominator"], "15")

    def test_supplement_row(self):
        rows = [
            {"group": "A", "count_a": "0", "count_b": "0", "denominator": "", "_original_row": 2},
            {"group": "B", "count_a": "6", "count_b": "9", "denominator": "15", "_original_row": 3},
        ]
        self.cleaner.configure(["denominator"], ["count_a", "count_b"])
        self.cleaner.import_rows(rows)

        dz_records = self.ev.get_by_anomaly_type(ANOMALY_DENOMINATOR_ZERO_EMPTY)
        self.assertEqual(len(dz_records), 1)
        eid = dz_records[0].evidence_id

        result = self.cleaner.supplement_row(eid, {"count_a": "3", "count_b": "4", "denominator": "7"}, self.ev)
        self.assertEqual(result["status"], "supplemented_pending_review")

        anomaly = self.store.get_anomaly_rows()
        self.assertEqual(len(anomaly), 1, "补录后仍留在异常列表，等复核人确认")
        cleaned = self.store.get_cleaned_rows()
        self.assertEqual(len(cleaned), 1, "补录后不提前归入正常结果")

        confirm_result = self.cleaner.reviewer_confirm_move(
            eid, confirmed_normal=True, evidence=self.ev, reviewer="测试复核人",
            review_reason="确认数据正确",
        )
        self.assertEqual(confirm_result["new_status"], "confirmed_normal")
        anomaly2 = self.store.get_anomaly_rows()
        cleaned2 = self.store.get_cleaned_rows()
        self.assertEqual(len(anomaly2), 0, "复核通过后，异常列表被清空")
        self.assertEqual(len(cleaned2), 2, "复核通过后，记录移入正常结果")

    def test_view_original_row(self):
        rows = [
            {"group": "A", "count_a": "0", "count_b": "0", "denominator": "", "_original_row": 2},
        ]
        self.cleaner.configure(["denominator"], ["count_a", "count_b"])
        self.cleaner.import_rows(rows)
        original = self.cleaner.view_original_row(2)
        self.assertIsNotNone(original)
        self.assertEqual(original["denominator"], "")

    def test_import_csv(self):
        sample_path = os.path.join(os.path.dirname(__file__), "..", "sample_data.csv")
        if not os.path.exists(sample_path):
            self.skipTest("sample_data.csv not found")
        self.cleaner.configure(["denominator"], ["count_a", "count_b"])
        result = self.cleaner.import_csv(sample_path)
        self.assertGreater(result["total_raw"], 0)


class TestComputeChiSquare(unittest.TestCase):
    def test_basic_calculation(self):
        rows = [
            {"a": "10", "b": "5"},
            {"a": "6", "b": "9"},
        ]
        result = compute_chi_square(rows, ["a", "b"])
        self.assertIsNotNone(result["chi_square"])
        self.assertEqual(result["df"], 1)
        self.assertIsNone(result["error"])

    def test_empty_data(self):
        result = compute_chi_square([], ["a"])
        self.assertIsNotNone(result["error"])


class TestSelfChecker(unittest.TestCase):
    def setUp(self):
        ResultStore.reset()
        self.ev = EvidenceChain()
        self.store = ResultStore()
        self.checker = SelfChecker(self.store, self.ev)

    def tearDown(self):
        ResultStore.reset()

    def test_all_pass_on_empty(self):
        results = self.checker.run_all()
        self.assertTrue(all(r["status"] == "PASS" for r in results))

    def test_denominator_zero_empty_flagged(self):
        self.ev.add(2, "denominator", "", ANOMALY_DENOMINATOR_ZERO_EMPTY, status=ProcessingStatus.PENDING_REVIEW)
        self.store.set_anomaly_rows([{"_original_row": 2, "_anomaly": ANOMALY_DENOMINATOR_ZERO_EMPTY}])
        results = self.checker.run_all()
        dz_check = next(r for r in results if r["check"] == "denominator_zero_empty_string")
        self.assertEqual(dz_check["status"], "WARN")

    def test_supplement_rerun_fail(self):
        self.ev.add(2, "denominator", "", ANOMALY_DENOMINATOR_ZERO_EMPTY, status=ProcessingStatus.SUPPLEMENTED)
        results = self.checker.run_all()
        sr_check = next(r for r in results if r["check"] == "supplement_rerun")
        self.assertEqual(sr_check["status"], "FAIL")


class TestWorkflow(unittest.TestCase):
    def setUp(self):
        ResultStore.reset()
        self.wf = Workflow()

    def tearDown(self):
        ResultStore.reset()

    def test_full_three_step_workflow(self):
        rows = [
            {"group": "A", "count_a": "10", "count_b": "5", "denominator": "", "_original_row": 2},
            {"group": "A", "count_a": "0", "count_b": "0", "denominator": "", "_original_row": 3},
            {"group": "B", "count_a": "6", "count_b": "9", "denominator": "15", "_original_row": 4},
            {"group": "A", "count_a": "10", "count_b": "5", "denominator": "", "_original_row": 5},
        ]
        import_result = self.wf.step1_import(rows, ["denominator"], ["count_a", "count_b"])
        self.assertGreater(import_result["total_raw"], 0)
        self.assertGreater(import_result["denominator_zero_empty_count"], 0)

        review = self.wf.step2_review_original_rows()
        self.assertGreater(review["pending_count"], 0)

        dz_records = self.wf.evidence.get_by_anomaly_type(ANOMALY_DENOMINATOR_ZERO_EMPTY)
        self.assertTrue(len(dz_records) > 0)
        target_eid = next(r.evidence_id for r in dz_records if r.original_row == 3)

        supp_result = self.wf.step2_supplement(target_eid, {"count_a": "3", "count_b": "4", "denominator": "7"})
        self.assertEqual(supp_result["status"], "supplemented_pending_review")

        rec_after_supp = self.wf.evidence.get_by_id(target_eid)
        self.assertEqual(rec_after_supp.current_status, ProcessingStatus.SUPPLEMENTED)
        self.assertIsNotNone(rec_after_supp.original_statement)
        self.assertIsNotNone(rec_after_supp.next_step)

        confirm_result = self.wf.reviewer_confirm(
            target_eid, confirmed=True, note="对照确认数据", reviewer="复核人A",
        )
        self.assertEqual(confirm_result["new_status"], "confirmed_normal")
        rec_after_rev = self.wf.evidence.get_by_id(target_eid)
        self.assertEqual(rec_after_rev.reviewer, "复核人A")
        self.assertIsNotNone(rec_after_rev.review_reason)
        self.assertIsNotNone(rec_after_rev.corrected_value)

        demo = self.wf.step3_update_demo()
        self.assertIsNotNone(demo["chi_square_result"])
        self.assertIsNotNone(demo["chi_square_result"]["chi_square"])

        checks = demo["self_check"]
        export_check = next(c for c in checks if c["check"] == "export_consistency")
        self.assertEqual(export_check["status"], "PASS")

    def test_denominator_zero_not_auto_resolved(self):
        rows = [
            {"group": "A", "count_a": "0", "count_b": "0", "denominator": "", "_original_row": 2},
        ]
        self.wf.step1_import(rows, ["denominator"], ["count_a", "count_b"])

        dz_records = self.wf.evidence.get_by_anomaly_type(ANOMALY_DENOMINATOR_ZERO_EMPTY)
        self.assertEqual(len(dz_records), 1)
        self.assertIn(dz_records[0].current_status, (ProcessingStatus.PENDING_REVIEW, ProcessingStatus.AUTO_FLAGGED))

        anomaly = self.wf.store.get_anomaly_rows()
        self.assertTrue(any(r.get("_anomaly") == ANOMALY_DENOMINATOR_ZERO_EMPTY for r in anomaly))

        review = self.wf.step2_review_original_rows()
        self.assertEqual(review["pending_count"], 1)

    def test_reviewer_confirm(self):
        rows = [
            {"group": "A", "count_a": "0", "count_b": "0", "denominator": "", "_original_row": 2},
        ]
        self.wf.step1_import(rows, ["denominator"], ["count_a", "count_b"])

        dz_records = self.wf.evidence.get_by_anomaly_type(ANOMALY_DENOMINATOR_ZERO_EMPTY)
        eid = dz_records[0].evidence_id

        result = self.wf.reviewer_confirm(eid, confirmed=False, note="确认异常")
        self.assertEqual(result["new_status"], ProcessingStatus.CONFIRMED_ANOMALY.value)

    def test_evidence_preserves_original_row(self):
        rows = [
            {"group": "A", "count_a": "0", "count_b": "0", "denominator": "", "_original_row": 42},
        ]
        self.wf.step1_import(rows, ["denominator"], ["count_a", "count_b"])

        dz_records = self.wf.evidence.get_by_anomaly_type(ANOMALY_DENOMINATOR_ZERO_EMPTY)
        self.assertEqual(dz_records[0].original_row, 42)

        original = self.wf.cleaner.view_original_row(42)
        self.assertIsNotNone(original)
        self.assertEqual(original["denominator"], "")


if __name__ == "__main__":
    unittest.main()
