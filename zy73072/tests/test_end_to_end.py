import json
import os
import sys
import unittest
from datetime import datetime

sys.path.insert(
    0, os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
)

from pdg_wsp_scheduler.normalizer import (
    normalize_device_id,
    DEVICE_ID_VARIANTS,
)
from pdg_wsp_scheduler.scheduler import TemperatureRiseScheduler
from pdg_wsp_scheduler.models import SchedulerResult, BadDataTrace


SIMULATED_TODAY = datetime(2026, 6, 10, 8, 0, 0)
SIMULATED_TONIGHT = datetime(2026, 6, 10, 23, 59, 59)


def _fixture(name: str):
    here = os.path.dirname(os.path.abspath(__file__))
    path = os.path.join(here, "..", "testdata", name)
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)["records"]


class TestDeviceIdNormalization(unittest.TestCase):
    def test_predefined_variants_all_map_to_same_canonical(self):
        for canonical, variants in DEVICE_ID_VARIANTS.items():
            for v in variants:
                result = normalize_device_id(v)
                self.assertIsNotNone(
                    result,
                    f"variant {v!r} should be normalizable",
                )
                self.assertEqual(
                    result.canonical,
                    canonical,
                    f"variant {v!r} should map to {canonical}",
                )

    def test_canonical_self_maps(self):
        for canonical in DEVICE_ID_VARIANTS.keys():
            result = normalize_device_id(canonical)
            self.assertIsNotNone(result)
            self.assertEqual(result.canonical, canonical)

    def test_unparseable_returns_none(self):
        bad = [
            "",
            None,
            "老配电室东北角那个",
            "随便写点什么",
            "1A-",
        ]
        for b in bad:
            self.assertIsNone(normalize_device_id(b))

    def test_mixed_case_and_spaces(self):
        self.assertEqual(
            normalize_device_id("  pdg 01a  001  ").canonical,
            "PDG-01A-001",
        )


class TestImportAndDedup(unittest.TestCase):
    def setUp(self):
        self.scheduler = TemperatureRiseScheduler()

    def test_phase1_import_produces_no_duplicate(self):
        records = _fixture("phase1_old_records.json")
        report = self.scheduler.import_handover_records(
            records, run_label="t", today=SIMULATED_TODAY
        )
        self.assertEqual(report.records_read, 7)
        self.assertEqual(report.records_bad_data, 1)
        total_good = 6
        duplicates_expected = 1
        new_expected = total_good - duplicates_expected
        self.assertEqual(
            report.records_new,
            new_expected,
            "phase1中1A-001出现两次（白班+夜班），应合并为1条，另5条为新",
        )
        self.assertEqual(report.records_duplicate_skipped, duplicates_expected)

    def test_phase2_import_does_not_double_records(self):
        phase1 = _fixture("phase1_old_records.json")
        phase2 = _fixture("phase2_boundary_and_followup.json")
        r1 = self.scheduler.import_handover_records(
            phase1, run_label="p1", today=SIMULATED_TODAY
        )
        results_after_p1 = len(self.scheduler.all_results())

        r2 = self.scheduler.import_handover_records(
            phase2, run_label="p2", today=SIMULATED_TODAY
        )
        results_after_p2 = len(self.scheduler.all_results())

        self.assertGreaterEqual(
            r2.records_duplicate_skipped,
            1,
            "phase2含一条重复导入的HO-20260609-001，去重计数器应≥1",
        )
        self.assertEqual(
            results_after_p2,
            results_after_p1 + 1,
            "phase2应新增1条边界样本，后补说明断路器与phase1同日期同备件被合并，重复旧记录也被去重",
        )

    def test_duplicate_records_merge_handover_ids(self):
        phase1 = _fixture("phase1_old_records.json")
        self.scheduler.import_handover_records(
            phase1, run_label="p1", today=SIMULATED_TODAY
        )
        results = self.scheduler.all_results()
        pdg_01a = [
            r for r in results if r.device_id.canonical == "PDG-01A-001"
            and r.spare_part_code == "SP-BUS-001"
        ]
        self.assertEqual(len(pdg_01a), 1)
        self.assertEqual(pdg_01a[0].source_dedup_count, 2)
        self.assertIn("HO-20260609-001", pdg_01a[0].handover_record_ids)
        self.assertIn("HO-20260609-005", pdg_01a[0].handover_record_ids)


class TestManualRemarkProtection(unittest.TestCase):
    def setUp(self):
        self.scheduler = TemperatureRiseScheduler()
        phase1 = _fixture("phase1_old_records.json")
        self.scheduler.import_handover_records(
            phase1, run_label="p1", today=SIMULATED_TODAY
        )

    def test_write_then_reimport_preserves_remark(self):
        results = self.scheduler.all_results()
        target = results[0]
        ok, _ = self.scheduler.update_manual_remark(
            target.dedup_key, "小林备注测试", operator="小林"
        )
        self.assertTrue(ok)
        self.assertTrue(target.is_manual_remark_protected)
        self.assertIn("小林备注测试", target.manual_remark)

        phase2 = _fixture("phase2_boundary_and_followup.json")
        self.scheduler.import_handover_records(
            phase2, run_label="p2", today=SIMULATED_TODAY
        )

        same_target = self.scheduler.find_result(target.dedup_key)
        self.assertIsNotNone(same_target)
        self.assertIn("小林备注测试", same_target.manual_remark)
        self.assertTrue(same_target.is_manual_remark_protected)

    def test_second_write_rejected_if_protected(self):
        target = self.scheduler.all_results()[0]
        self.scheduler.update_manual_remark(
            target.dedup_key, "第一条备注", operator="A"
        )
        ok, msg = self.scheduler.update_manual_remark(
            target.dedup_key, "第二条备注（应被拒）", operator="B"
        )
        self.assertFalse(ok)
        self.assertIn("保护", msg)
        self.assertIn("第一条备注", target.manual_remark)
        self.assertNotIn("第二条备注", target.manual_remark)


class TestBadDataTraceNavigable(unittest.TestCase):
    def test_bad_device_id_record_has_trace(self):
        scheduler = TemperatureRiseScheduler()
        phase1 = _fixture("phase1_old_records.json")
        scheduler.import_handover_records(
            phase1, run_label="t", today=SIMULATED_TODAY
        )
        bads = scheduler.all_bad_data()
        self.assertEqual(len(bads), 1)
        b = bads[0]
        self.assertEqual(b.error_type, "DEVICE_ID_UNPARSEABLE")
        self.assertEqual(b.handover_record_id, "HO-20260609-BAD-01")
        self.assertIn("东北角", b.source_device_id_raw)
        self.assertIn("现场巡检", b.on_site_trace_hint)
        self.assertIn("record_id=HO-20260609-BAD-01", b.to_dict()["navigate_hint"])


class TestPhotoMismatchWarning(unittest.TestCase):
    def test_phase1_contains_mismatch_sample(self):
        scheduler = TemperatureRiseScheduler()
        phase1 = _fixture("phase1_old_records.json")
        report = scheduler.import_handover_records(
            phase1, run_label="t", today=SIMULATED_TODAY
        )
        self.assertIsNotNone(report.photo_mismatch_impact)
        self.assertIn(
            "PDG-05C-099",
            report.photo_mismatch_impact.affected_device_ids,
        )
        self.assertIn(
            "收尾步骤",
            report.photo_mismatch_impact.wrap_up_action,
        )


class TestPageSummaryDescribesChanges(unittest.TestCase):
    def test_summary_after_phase1_and_phase2(self):
        scheduler = TemperatureRiseScheduler()
        phase1 = _fixture("phase1_old_records.json")
        phase2 = _fixture("phase2_boundary_and_followup.json")

        scheduler.import_handover_records(
            phase1, run_label="p1", today=SIMULATED_TODAY
        )
        s1 = scheduler.build_page_summary(tonight=SIMULATED_TONIGHT)
        self.assertGreater(s1.total_results, 0)

        scheduler.import_handover_records(
            phase2, run_label="p2", today=SIMULATED_TODAY
        )
        s2 = scheduler.build_page_summary(tonight=SIMULATED_TONIGHT)
        self.assertGreater(
            len(s2.boundary_samples_added),
            0,
            "边界样本（高温、大量、合并次数多）应被摘要识别",
        )
        self.assertTrue(
            len(s2.change_description) > 20,
            "变化描述应非空且有意义",
        )
        self.assertIsNotNone(s2.last_import_report)


class TestGrayReleaseFlow(unittest.TestCase):
    def test_full_gray_release_acceptance_flow(self):
        scheduler = TemperatureRiseScheduler()
        phase1 = _fixture("phase1_old_records.json")
        phase2 = _fixture("phase2_boundary_and_followup.json")

        r1 = scheduler.import_handover_records(
            phase1, run_label="phase1-old", today=SIMULATED_TODAY
        )
        self.assertEqual(r1.failure_code, "OK")
        self.assertGreater(r1.records_new, 0)

        target = scheduler.all_results()[0]
        ok, _ = scheduler.update_manual_remark(
            target.dedup_key, "小林灰度测试备注", operator="小林"
        )
        self.assertTrue(ok)

        r2 = scheduler.import_handover_records(
            phase2, run_label="phase2-boundary", today=SIMULATED_TODAY
        )
        self.assertEqual(r2.failure_code, "OK")
        self.assertGreaterEqual(r2.records_duplicate_skipped, 1)

        still = scheduler.find_result(target.dedup_key)
        self.assertIn("小林灰度测试备注", still.manual_remark)

        summary = scheduler.build_page_summary(tonight=SIMULATED_TONIGHT)
        self.assertTrue(summary.change_description)
        self.assertGreater(len(summary.boundary_samples_added), 0)

        bads = scheduler.all_bad_data()
        self.assertTrue(
            all(b.handover_record_id for b in bads),
            "坏数据必须能指回班组交接记录原始条目",
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
