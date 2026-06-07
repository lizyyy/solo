import unittest
from feature_drift_alert import (
    AlertStorage,
    WorkflowEngine,
    VisualizationLink,
    FeatureScore,
    AlertStatus,
    ScoreBucket,
    BoundaryRules,
)


class TestScoreBucket(unittest.TestCase):
    def test_from_score(self):
        self.assertEqual(ScoreBucket.from_score(0.1), ScoreBucket.VERY_LOW)
        self.assertEqual(ScoreBucket.from_score(0.3), ScoreBucket.LOW)
        self.assertEqual(ScoreBucket.from_score(0.5), ScoreBucket.MEDIUM)
        self.assertEqual(ScoreBucket.from_score(0.7), ScoreBucket.HIGH)
        self.assertEqual(ScoreBucket.from_score(0.9), ScoreBucket.VERY_HIGH)

    def test_bucket_distance(self):
        self.assertEqual(ScoreBucket.bucket_distance(ScoreBucket.HIGH, ScoreBucket.MEDIUM), 1)
        self.assertEqual(ScoreBucket.bucket_distance(ScoreBucket.VERY_HIGH, ScoreBucket.LOW), 3)
        self.assertEqual(ScoreBucket.bucket_distance(ScoreBucket.MEDIUM, ScoreBucket.MEDIUM), 0)


class TestFeatureScore(unittest.TestCase):
    def test_one_bucket_diff(self):
        fs = FeatureScore("age", 0.75, 0.55)
        self.assertEqual(fs.offline_bucket, ScoreBucket.HIGH)
        self.assertEqual(fs.online_bucket, ScoreBucket.MEDIUM)
        self.assertEqual(fs.bucket_diff, 1)

    def test_two_plus_bucket_diff(self):
        fs = FeatureScore("gender", 0.85, 0.35)
        self.assertEqual(fs.offline_bucket, ScoreBucket.VERY_HIGH)
        self.assertEqual(fs.online_bucket, ScoreBucket.LOW)
        self.assertEqual(fs.bucket_diff, 3)

    def test_same_bucket(self):
        fs = FeatureScore("click", 0.65, 0.68)
        self.assertEqual(fs.bucket_diff, 0)


class TestBoundaryRules(unittest.TestCase):
    def test_same_bucket_no_alert(self):
        fs = FeatureScore("click", 0.65, 0.68)
        should_alert, alert = BoundaryRules.evaluate_feature(fs, "log_1")
        self.assertFalse(should_alert)

    def test_one_bucket_diff_pending(self):
        fs = FeatureScore("age", 0.75, 0.55)
        should_alert, alert = BoundaryRules.evaluate_feature(fs, "log_1")
        self.assertTrue(should_alert)
        self.assertEqual(alert.status, AlertStatus.PENDING_REVIEW)
        self.assertIn("差1个桶", alert.remark)
        self.assertIn("待评测运营复核", alert.remark)

    def test_two_plus_bucket_diff_confirmed(self):
        fs = FeatureScore("gender", 0.85, 0.35)
        should_alert, alert = BoundaryRules.evaluate_feature(fs, "log_1")
        self.assertTrue(should_alert)
        self.assertEqual(alert.status, AlertStatus.CONFIRMED_DRIFT)

    def test_resolve_one_bucket_diff(self):
        fs = FeatureScore("age", 0.75, 0.55)
        _, alert = BoundaryRules.evaluate_feature(fs, "log_1")
        BoundaryRules.resolve_one_bucket_diff(alert, False, "评测运营", "边界波动正常")
        self.assertEqual(alert.status, AlertStatus.FALSE_ALARM)


class TestDedupImport(unittest.TestCase):
    def test_duplicate_import_no_alert_duplication(self):
        storage = AlertStorage()
        workflow = WorkflowEngine(storage)

        feature_scores = [
            FeatureScore("age", 0.75, 0.55),
            FeatureScore("gender", 0.85, 0.35),
        ]

        result1 = workflow.step1_import_training_log(
            "exp1", "v1", feature_scores, "林姐"
        )
        self.assertFalse(result1["is_duplicate"])
        self.assertEqual(result1["total_alerts"], 2)

        result2 = workflow.step1_import_training_log(
            "exp1", "v1", feature_scores, "林姐"
        )
        self.assertTrue(result2["is_duplicate"])
        self.assertEqual(result2["existing_alerts_count"], 2)
        self.assertEqual(len(storage.get_all_alerts()), 2)


class TestChangeHistory(unittest.TestCase):
    def test_remark_change_history(self):
        storage = AlertStorage()
        viz = VisualizationLink(storage)

        fs = FeatureScore("age", 0.75, 0.55)
        _, alert = BoundaryRules.evaluate_feature(fs, "log_1")
        storage.add_alert(alert)
        original_remark = alert.remark

        alert.update_remark("林姐备注：初步看正常", "林姐")
        alert.update_remark("林姐备注：确认是边界波动", "林姐")

        history = viz.get_change_history_diff(alert.alert_id)
        self.assertEqual(len(history), 2)
        self.assertEqual(history[0]["field_name"], "remark")
        self.assertEqual(history[0]["before"], original_remark)
        self.assertEqual(history[0]["after"], "林姐备注：初步看正常")
        self.assertEqual(history[1]["before"], "林姐备注：初步看正常")
        self.assertEqual(history[1]["after"], "林姐备注：确认是边界波动")


class TestVisualizationTraceability(unittest.TestCase):
    def test_alert_has_source_links(self):
        storage = AlertStorage()
        workflow = WorkflowEngine(storage)
        viz = VisualizationLink(storage)

        feature_scores = [FeatureScore("age", 0.75, 0.55)]
        result = workflow.step1_import_training_log(
            "exp1", "v1", feature_scores, "林姐"
        )
        log_id = result["log_id"]
        alert_id = storage.get_alerts_for_log(log_id)[0].alert_id

        workflow.step2_review_threshold_notes(
            log_id, alert_id,
            new_note_title="age边界说明",
            new_note_content="0.6是高中桶边界",
            reviewer="林姐",
        )

        detail = viz.get_alert_detail_with_sources(alert_id)
        self.assertIn("sources", detail)
        self.assertIsNotNone(detail["sources"]["training_log"])
        self.assertEqual(len(detail["sources"]["threshold_notes"]), 1)
        self.assertIn("training_log_url", detail["sources"])
        self.assertIn("threshold_notes_urls", detail["sources"])
        self.assertTrue(detail["traceable"])

    def test_chart_has_trace_links(self):
        storage = AlertStorage()
        workflow = WorkflowEngine(storage)
        viz = VisualizationLink(storage)

        feature_scores = [FeatureScore("age", 0.75, 0.55)]
        result = workflow.step1_import_training_log(
            "exp1", "v1", feature_scores, "林姐"
        )
        log_id = result["log_id"]
        alert_id = storage.get_alerts_for_log(log_id)[0].alert_id

        chart_data = viz.get_chart_data_with_trace(alert_id, chart_type="3d")
        self.assertEqual(chart_data["chart_type"], "3d")
        self.assertIn("trace_links", chart_data)
        self.assertIn("warning", chart_data)


class TestThreeStepWorkflow(unittest.TestCase):
    def test_full_workflow(self):
        storage = AlertStorage()
        workflow = WorkflowEngine(storage)
        viz = VisualizationLink(storage)

        feature_scores = [
            FeatureScore("age", 0.75, 0.55),
            FeatureScore("click", 0.5, 0.52),
        ]

        # Step 1
        result1 = workflow.step1_import_training_log(
            "ctr_exp", "v2.1", feature_scores, "林姐"
        )
        log_id = result1["log_id"]
        self.assertEqual(result1["step"], "import_logs")
        self.assertEqual(result1["pending_review_count"], 1)

        # Check one bucket diff stays pending review
        alerts = storage.get_alerts_for_log(log_id)
        self.assertEqual(len(alerts), 1)
        alert = alerts[0]
        self.assertEqual(alert.bucket_diff, 1)
        self.assertEqual(alert.status, AlertStatus.PENDING_REVIEW)

        # Step 2 - Lin Jie reviews notes
        result2 = workflow.step2_review_threshold_notes(
            log_id, alert.alert_id,
            new_note_title="age特征阈值",
            new_note_content="历史上age在0.5-0.6之间波动属正常",
            reviewer="林姐",
        )
        self.assertEqual(result2["step"], "review_threshold_notes")
        self.assertIn("judgment_guideline", result2)

        # After step 2, status should still be PENDING (not auto-resolved)
        alert_after_step2 = storage.get_alert(alert.alert_id)
        self.assertEqual(alert_after_step2.status, AlertStatus.PENDING_REVIEW)

        # Step 3 - Operations reviews and updates
        result3 = workflow.step3_compare_and_update(
            log_id, alert.alert_id,
            is_confirmed_drift=False,
            reviewer="评测运营",
            reason="看过笔记和曲线，确认是边界波动",
        )
        self.assertEqual(result3["step"], "compare_experiments")
        self.assertEqual(result3["new_status"], "false_alarm")

        # Verify history is tracked
        history = viz.get_change_history_diff(alert.alert_id)
        self.assertTrue(len(history) >= 1)

    def test_rollback(self):
        storage = AlertStorage()
        workflow = WorkflowEngine(storage)

        feature_scores = [FeatureScore("age", 0.75, 0.55)]
        result = workflow.step1_import_training_log(
            "exp1", "v1", feature_scores, "林姐"
        )
        log_id = result["log_id"]
        alert = storage.get_alerts_for_log(log_id)[0]

        workflow.step3_compare_and_update(
            log_id, alert.alert_id,
            is_confirmed_drift=True,
            reviewer="评测运营",
            reason="测试确认",
        )

        self.assertEqual(storage.get_alert(alert.alert_id).status, AlertStatus.CONFIRMED_DRIFT)

        success = storage.rollback_alert_status(alert.alert_id, "评测运营")
        self.assertTrue(success)
        self.assertEqual(storage.get_alert(alert.alert_id).status, AlertStatus.PENDING_REVIEW)


if __name__ == "__main__":
    unittest.main()
