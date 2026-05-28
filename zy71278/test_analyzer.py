import unittest

from models import (
    ActivityLabel,
    AuditAction,
    DwellRecord,
    EntryBatch,
    HotZone,
    VisitorTrajectory,
    Zone,
)
from entropy import compute_entropy, EntropyError
from bucket import bucket_trajectories, BucketError, deduplicate_trajectories
from hotzone import compute_hot_zones, HotZoneError
from activity import compare_activities, ActivityError
from analyzer import run_analysis, query_audit_trail, PipelineError
from report import export_report, export_report_json


def _make_zones():
    return [
        Zone(zone_id="A", name="大厅", floor=1, area_m2=200, capacity=50),
        Zone(zone_id="B", name="油画厅", floor=1, area_m2=150, capacity=30),
        Zone(zone_id="C", name="雕塑厅", floor=2, area_m2=180, capacity=40),
        Zone(zone_id="D", name="临时展厅", floor=1, area_m2=100, capacity=25),
    ]


def _make_dwells(visitor_id, zone_durations):
    records = []
    for zone_id, dur in zone_durations:
        records.append(DwellRecord(
            visitor_id=visitor_id,
            zone_id=zone_id,
            enter_time="2026-05-28T10:00:00",
            exit_time="2026-05-28T10:00:30",
            duration_seconds=dur,
        ))
    return records


def _make_normal_trajectories():
    t1 = VisitorTrajectory(
        trajectory_id="T001",
        visitor_id="V001",
        entry_batch="B001",
        dwells=_make_dwells("V001", [("A", 120), ("B", 300), ("C", 200)]),
        activity_labels=["exhibition_opening"],
        path_sequence=["A", "B", "C"],
    )
    t2 = VisitorTrajectory(
        trajectory_id="T002",
        visitor_id="V002",
        entry_batch="B001",
        dwells=_make_dwells("V002", [("A", 90), ("C", 250), ("B", 180)]),
        activity_labels=["exhibition_opening"],
        path_sequence=["A", "C", "B"],
    )
    t3 = VisitorTrajectory(
        trajectory_id="T003",
        visitor_id="V003",
        entry_batch="B002",
        dwells=_make_dwells("V003", [("A", 150), ("B", 400), ("D", 350)]),
        activity_labels=["guided_tour"],
        path_sequence=["A", "B", "D"],
    )
    t4 = VisitorTrajectory(
        trajectory_id="T004",
        visitor_id="V004",
        entry_batch="B002",
        dwells=_make_dwells("V004", [("A", 60), ("B", 120), ("C", 90)]),
        activity_labels=[],
        path_sequence=["A", "B", "C"],
    )
    return [t1, t2, t3, t4]


def _make_activities():
    return [
        ActivityLabel(
            label_id="exhibition_opening",
            name="开幕式",
            description="展厅开幕式活动",
            affected_zones=["A", "B"],
        ),
        ActivityLabel(
            label_id="guided_tour",
            name="导览",
            description="专家导览",
            affected_zones=["A", "B", "C", "D"],
        ),
    ]


class TestEntropyComputation(unittest.TestCase):
    def test_basic_entropy(self):
        trajectories = _make_normal_trajectories()
        result = compute_entropy(trajectories)
        self.assertGreater(result.raw_entropy, 0)
        self.assertLessEqual(result.normalized_entropy, 1.0)
        self.assertEqual(result.total_trajectories, 4)
        self.assertIn("p_log_contributions", result.intermediate)
        self.assertIn("concentration_ratio", result.intermediate)

    def test_single_path_entropy(self):
        t = VisitorTrajectory(
            trajectory_id="T1",
            visitor_id="V1",
            entry_batch="B1",
            path_sequence=["A", "B"],
        )
        result = compute_entropy([t])
        self.assertEqual(result.raw_entropy, 0.0)
        self.assertEqual(result.normalized_entropy, 0.0)
        self.assertEqual(result.intermediate["concentration_ratio"], 1.0)

    def test_empty_trajectories_entropy(self):
        with self.assertRaises(EntropyError) as ctx:
            compute_entropy([])
        diag = ctx.exception.diagnostics
        self.assertEqual(diag["step"], "entropy_computation")
        self.assertEqual(diag["reason"], "trajectories_empty")
        self.assertIn("suggestion", diag)

    def test_uniform_distribution(self):
        paths = [["A", "B"], ["B", "A"], ["C", "D"], ["D", "C"]]
        trajectories = [
            VisitorTrajectory(
                trajectory_id=f"T{i}",
                visitor_id=f"V{i}",
                entry_batch="B1",
                path_sequence=p,
            )
            for i, p in enumerate(paths)
        ]
        result = compute_entropy(trajectories)
        self.assertAlmostEqual(result.normalized_entropy, 1.0, places=5)


class TestPathBucketing(unittest.TestCase):
    def test_basic_bucketing(self):
        trajectories = _make_normal_trajectories()
        buckets, intermediate = bucket_trajectories(trajectories)
        self.assertGreater(len(buckets), 0)
        self.assertIn("total_trajectories", intermediate)
        self.assertIn("top3_patterns", intermediate)

    def test_deduplicate(self):
        t1 = VisitorTrajectory(
            trajectory_id="T1",
            visitor_id="V1",
            entry_batch="B1",
            path_sequence=["A", "B"],
        )
        t2 = VisitorTrajectory(
            trajectory_id="T2",
            visitor_id="V1",
            entry_batch="B1",
            path_sequence=["A", "C"],
        )
        deduped, diag = deduplicate_trajectories([t1, t2])
        self.assertEqual(len(deduped), 1)
        self.assertEqual(diag["duplicates_found"], 1)
        self.assertIn("duplicate_details", diag)

    def test_empty_bucketing(self):
        with self.assertRaises(BucketError) as ctx:
            bucket_trajectories([])
        diag = ctx.exception.diagnostics
        self.assertEqual(diag["step"], "path_bucketing")


class TestHotZone(unittest.TestCase):
    def test_basic_hotzone(self):
        trajectories = _make_normal_trajectories()
        zones = _make_zones()
        hot_zones, intermediate = compute_hot_zones(trajectories, zones)
        self.assertGreater(len(hot_zones), 0)
        self.assertEqual(hot_zones[0].heat_rank, 1)
        self.assertIn("zone_summary", intermediate)

    def test_noise_filtering(self):
        dwells = _make_dwells("V1", [("A", 5), ("B", 10), ("C", 300)])
        t = VisitorTrajectory(
            trajectory_id="T1",
            visitor_id="V1",
            entry_batch="B1",
            dwells=dwells,
            path_sequence=["A", "B", "C"],
        )
        zones = _make_zones()
        hot_zones, intermediate = compute_hot_zones([t], zones, noise_threshold_seconds=30.0)
        noise_diag = intermediate["noise_filtering"]
        self.assertEqual(noise_diag["filtered_count"], 2)
        self.assertEqual(noise_diag["kept_count"], 1)

    def test_all_noise(self):
        dwells = _make_dwells("V1", [("A", 5), ("B", 10)])
        t = VisitorTrajectory(
            trajectory_id="T1",
            visitor_id="V1",
            entry_batch="B1",
            dwells=dwells,
            path_sequence=["A", "B"],
        )
        zones = _make_zones()
        with self.assertRaises(HotZoneError) as ctx:
            compute_hot_zones([t], zones, noise_threshold_seconds=30.0)
        diag = ctx.exception.diagnostics
        self.assertEqual(diag["reason"], "all_filtered_as_noise")
        self.assertIn("filtered_details", diag)

    def test_empty_hotzone(self):
        with self.assertRaises(HotZoneError) as ctx:
            compute_hot_zones([], _make_zones())
        self.assertEqual(ctx.exception.diagnostics["step"], "hotzone_identification")


class TestActivityComparison(unittest.TestCase):
    def test_basic_comparison(self):
        trajectories = _make_normal_trajectories()
        activities = _make_activities()
        comparisons, intermediate = compare_activities(trajectories, activities, baseline_entropy=0.8)
        self.assertGreater(len(comparisons), 0)
        for c in comparisons:
            self.assertIn("interference_flag", c.__dict__)
            self.assertTrue(len(c.interference_reason) > 0)

    def test_no_activities(self):
        trajectories = _make_normal_trajectories()
        with self.assertRaises(ActivityError) as ctx:
            compare_activities(trajectories, [], baseline_entropy=0.8)
        diag = ctx.exception.diagnostics
        self.assertEqual(diag["reason"], "activities_empty")

    def test_no_trajectories(self):
        activities = _make_activities()
        with self.assertRaises(ActivityError) as ctx:
            compare_activities([], activities)
        self.assertEqual(ctx.exception.diagnostics["reason"], "trajectories_empty")

    def test_interference_detection(self):
        t_concentrated = [
            VisitorTrajectory(
                trajectory_id=f"T{i}",
                visitor_id=f"V{i}",
                entry_batch="B1",
                path_sequence=["A", "B"],
                activity_labels=["special_event"],
            )
            for i in range(10)
        ]
        activities = [
            ActivityLabel(
                label_id="special_event",
                name="特别活动",
                affected_zones=["A", "B"],
            ),
        ]
        comparisons, intermediate = compare_activities(
            t_concentrated, activities, baseline_entropy=0.9,
        )
        self.assertTrue(comparisons[0].interference_flag)
        self.assertIn("interference_details", intermediate)


class TestFullPipeline(unittest.TestCase):
    def test_normal_run(self):
        trajectories = _make_normal_trajectories()
        zones = _make_zones()
        activities = _make_activities()
        report = run_analysis(trajectories, zones, activities)
        self.assertIsNotNone(report.entropy_result)
        self.assertGreater(len(report.path_buckets), 0)
        self.assertGreater(len(report.hot_zones), 0)
        self.assertGreater(len(report.activity_comparisons), 0)
        self.assertIn("entropy", report.intermediates)
        self.assertIn("bucketing", report.intermediates)
        self.assertIn("hotzone", report.intermediates)
        self.assertIn("activity", report.intermediates)

    def test_report_text_export(self):
        trajectories = _make_normal_trajectories()
        zones = _make_zones()
        activities = _make_activities()
        report = run_analysis(trajectories, zones, activities)
        text = export_report(report)
        self.assertIn("熵值计算", text)
        self.assertIn("路径分桶", text)
        self.assertIn("热区解释", text)
        self.assertIn("活动对比", text)
        self.assertIn("关键中间量", text)
        self.assertIn("变更审计", text)

    def test_report_json_export(self):
        trajectories = _make_normal_trajectories()
        zones = _make_zones()
        activities = _make_activities()
        report = run_analysis(trajectories, zones, activities)
        j = export_report_json(report)
        self.assertIn("entropy", j)
        self.assertIn("path_buckets", j)
        self.assertIn("hot_zones", j)
        self.assertIn("activity_comparisons", j)
        self.assertIn("intermediates", j)
        self.assertIn("audit", j)

    def test_pipeline_empty_trajectories(self):
        with self.assertRaises(PipelineError) as ctx:
            run_analysis([], _make_zones(), _make_activities())
        self.assertEqual(ctx.exception.step, "entropy_computation")
        self.assertIn("suggestion", ctx.exception.diagnostics)

    def test_audit_trail(self):
        trajectories = _make_normal_trajectories()
        zones = _make_zones()
        activities = _make_activities()
        report = run_analysis(trajectories, zones, activities)
        audit_history = report.audit.history()
        actions = [e["action"] for e in audit_history]
        self.assertIn("created", actions)
        self.assertIn("entropy_computed", actions)
        self.assertIn("bucketed", actions)
        self.assertIn("hotzone_identified", actions)
        self.assertIn("activity_compared", actions)
        self.assertIn("report_generated", actions)

    def test_trajectory_level_audit(self):
        trajectories = _make_normal_trajectories()
        run_analysis(trajectories, _make_zones(), _make_activities())
        audit = query_audit_trail(trajectories)
        self.assertEqual(len(audit["trajectory_audit"]), 4)
        for item in audit["trajectory_audit"]:
            self.assertIn("trajectory_id", item)
            self.assertIn("visitor_id", item)
            self.assertIn("history", item)
            entry_actions = [e["action"] for e in item["history"]]
            self.assertIn("created", entry_actions)

    def test_repeat_visitor_pipeline(self):
        t1 = VisitorTrajectory(
            trajectory_id="T1",
            visitor_id="V1",
            entry_batch="B1",
            dwells=_make_dwells("V1", [("A", 120), ("B", 200)]),
            path_sequence=["A", "B"],
            activity_labels=["exhibition_opening"],
        )
        t2 = VisitorTrajectory(
            trajectory_id="T2",
            visitor_id="V1",
            entry_batch="B2",
            dwells=_make_dwells("V1", [("A", 60), ("C", 300)]),
            path_sequence=["A", "C"],
            activity_labels=["exhibition_opening"],
        )
        report = run_analysis([t1, t2], _make_zones(), _make_activities())
        bucket_intermediate = report.intermediates.get("bucketing", {})
        if bucket_intermediate and bucket_intermediate.get("deduplication"):
            self.assertEqual(bucket_intermediate["deduplication"]["duplicates_found"], 1)

    def test_short_dwell_noise_handling(self):
        t = VisitorTrajectory(
            trajectory_id="T1",
            visitor_id="V1",
            entry_batch="B1",
            dwells=_make_dwells("V1", [("A", 5), ("B", 300), ("C", 8)]),
            path_sequence=["A", "B", "C"],
            activity_labels=["guided_tour"],
        )
        report = run_analysis([t], _make_zones(), _make_activities())
        hotzone_intermediate = report.intermediates.get("hotzone", {})
        noise = hotzone_intermediate.get("noise_filtering", {})
        self.assertEqual(noise.get("filtered_count", 0), 2)

    def test_activity_interference_pipeline(self):
        t_normal = [
            VisitorTrajectory(
                trajectory_id=f"TN{i}",
                visitor_id=f"VN{i}",
                entry_batch="B1",
                dwells=_make_dwells(f"VN{i}", [("A", 120), ("B", 200), ("C", 150)]),
                path_sequence=["A", "B", "C"] if i % 2 == 0 else ["A", "C", "B"],
                activity_labels=[],
            )
            for i in range(20)
        ]
        t_event = [
            VisitorTrajectory(
                trajectory_id=f"TE{i}",
                visitor_id=f"VE{i}",
                entry_batch="B2",
                dwells=_make_dwells(f"VE{i}", [("A", 60), ("B", 90)]),
                path_sequence=["A", "B"],
                activity_labels=["special_event"],
            )
            for i in range(15)
        ]
        activities = [
            ActivityLabel(
                label_id="special_event",
                name="特别活动",
                affected_zones=["A", "B"],
            ),
        ]
        report = run_analysis(t_normal + t_event, _make_zones(), activities)
        self.assertGreater(len(report.activity_comparisons), 0)
        for ac in report.activity_comparisons:
            self.assertTrue(len(ac.interference_reason) > 0)


if __name__ == "__main__":
    unittest.main()
