import unittest
from sample_manager import (
    ActiveLearningSampler,
    SampleStore,
    calculate_score_gap,
    score_to_bucket,
    BUCKET_THRESHOLDS,
)
from models import SampleStatus, ScoreGapLevel, ChangeType


class TestScoreBuckets(unittest.TestCase):
    def test_score_to_bucket(self):
        self.assertEqual(score_to_bucket(0.0), 0)
        self.assertEqual(score_to_bucket(0.1), 0)
        self.assertEqual(score_to_bucket(0.2), 1)
        self.assertEqual(score_to_bucket(0.39), 1)
        self.assertEqual(score_to_bucket(0.4), 2)
        self.assertEqual(score_to_bucket(0.59), 2)
        self.assertEqual(score_to_bucket(0.6), 3)
        self.assertEqual(score_to_bucket(0.79), 3)
        self.assertEqual(score_to_bucket(0.8), 4)
        self.assertEqual(score_to_bucket(1.0), 4)

    def test_calculate_score_gap_none(self):
        _, _, gap = calculate_score_gap(None, 0.5)
        self.assertEqual(gap, ScoreGapLevel.NONE)
        _, _, gap = calculate_score_gap(0.5, None)
        self.assertEqual(gap, ScoreGapLevel.NONE)

    def test_calculate_score_gap_no_diff(self):
        b_off, b_on, gap = calculate_score_gap(0.5, 0.55)
        self.assertEqual(b_off, 2)
        self.assertEqual(b_on, 2)
        self.assertEqual(gap, ScoreGapLevel.NONE)

    def test_calculate_score_gap_one_bucket(self):
        b_off, b_on, gap = calculate_score_gap(0.75, 0.58)
        self.assertEqual(b_off, 3)
        self.assertEqual(b_on, 2)
        self.assertEqual(gap, ScoreGapLevel.ONE_BUCKET)

    def test_calculate_score_gap_multi_bucket(self):
        b_off, b_on, gap = calculate_score_gap(0.82, 0.45)
        self.assertEqual(b_off, 4)
        self.assertEqual(b_on, 2)
        self.assertEqual(gap, ScoreGapLevel.MULTI_BUCKET)


class TestSampleStore(unittest.TestCase):
    def setUp(self):
        self.store = SampleStore()

    def test_import_idempotency(self):
        from models import EvalSample
        sample = EvalSample(
            sample_id="test_row_1",
            original_row_number=1,
            slice_id="test_slice",
        )
        self.store.add_sample(sample)

        existing = self.store.get_sample_by_import_key("test_slice", 1)
        self.assertIsNotNone(existing)
        self.assertEqual(existing.sample_id, "test_row_1")

    def test_list_samples_by_slice(self):
        from models import EvalSample
        for i in range(3):
            s = EvalSample(
                sample_id=f"s{i}",
                original_row_number=i + 1,
                slice_id="slice_a",
            )
            self.store.add_sample(s)

        s_b = EvalSample(
            sample_id="s_b",
            original_row_number=1,
            slice_id="slice_b",
        )
        self.store.add_sample(s_b)

        self.assertEqual(len(self.store.list_samples(slice_id="slice_a")), 3)
        self.assertEqual(len(self.store.list_samples(slice_id="slice_b")), 1)

    def test_update_field_creates_change_record(self):
        from models import EvalSample
        sample = EvalSample(
            sample_id="test_row_1",
            original_row_number=1,
            slice_id="test_slice",
            remark="original",
        )
        self.store.add_sample(sample)

        initial_changes = len(self.store.list_changes("test_row_1"))
        self.store.update_sample_field(
            sample_id="test_row_1",
            field_name="remark",
            new_value="updated",
            change_type=ChangeType.UPDATE_REMARK,
            operator="linjie",
        )

        changes = self.store.list_changes("test_row_1")
        self.assertEqual(len(changes), initial_changes + 1)

        last_change = changes[-1]
        self.assertEqual(last_change.old_value, "original")
        self.assertEqual(last_change.new_value, "updated")
        self.assertEqual(last_change.changed_by, "linjie")


class TestActiveLearningSampler(unittest.TestCase):
    def setUp(self):
        self.sampler = ActiveLearningSampler()
        self.slice_id = "test_slice_001"

    def test_import_slice_basic(self):
        rows = [
            {"original_row_number": 1, "offline_score": 0.75},
            {"original_row_number": 2, "offline_score": 0.55},
        ]
        result = self.sampler.import_slice(self.slice_id, rows)
        self.assertEqual(result["imported"], 2)
        self.assertEqual(result["skipped_duplicate"], 0)

    def test_import_slice_idempotent_no_duplication(self):
        rows = [
            {"original_row_number": 1, "offline_score": 0.75},
            {"original_row_number": 2, "offline_score": 0.55},
        ]
        self.sampler.import_slice(self.slice_id, rows)
        result = self.sampler.import_slice(self.slice_id, rows)

        self.assertEqual(result["imported"], 0)
        self.assertEqual(result["skipped_duplicate"], 2)

        total = len(self.sampler.store.list_samples(slice_id=self.slice_id))
        self.assertEqual(total, 2)

    def test_three_step_workflow(self):
        rows = [{"original_row_number": 1, "offline_score": 0.75}]
        self.sampler.import_slice(self.slice_id, rows)
        sample_id = f"{self.slice_id}_row_1"

        sample = self.sampler.store.get_sample(sample_id)
        self.assertEqual(sample.status, SampleStatus.IMPORTED)

        self.sampler.add_feature_snapshot(sample_id, "feat_001")
        sample = self.sampler.store.get_sample(sample_id)
        self.assertEqual(sample.status, SampleStatus.FEATURE_ADDED)
        self.assertEqual(sample.feature_snapshot_id, "feat_001")

        result = self.sampler.update_experiment_scores(
            sample_id, offline_score=0.75, online_score=0.72
        )
        sample = self.sampler.store.get_sample(sample_id)
        self.assertEqual(sample.status, SampleStatus.EXPERIMENT_UPDATED)
        self.assertFalse(result["needs_review"])

    def test_one_bucket_gap_needs_review(self):
        rows = [{"original_row_number": 1}]
        self.sampler.import_slice(self.slice_id, rows)
        sample_id = f"{self.slice_id}_row_1"

        self.sampler.add_feature_snapshot(sample_id, "feat_001")
        result = self.sampler.update_experiment_scores(
            sample_id, offline_score=0.75, online_score=0.58
        )

        sample = self.sampler.store.get_sample(sample_id)
        self.assertEqual(sample.score_gap_level, ScoreGapLevel.ONE_BUCKET)
        self.assertEqual(sample.status, SampleStatus.PENDING_REVIEW)
        self.assertTrue(result["needs_review"])

    def test_review_workflow(self):
        rows = [{"original_row_number": 1}]
        self.sampler.import_slice(self.slice_id, rows)
        sample_id = f"{self.slice_id}_row_1"
        self.sampler.add_feature_snapshot(sample_id, "feat_001")
        self.sampler.update_experiment_scores(
            sample_id, offline_score=0.75, online_score=0.58
        )

        pending = self.sampler.get_samples_pending_review(self.slice_id)
        self.assertEqual(len(pending), 1)

        self.sampler.review_decision(sample_id, approved=True, operator="operation")
        sample = self.sampler.store.get_sample(sample_id)
        self.assertEqual(sample.status, SampleStatus.REVIEW_APPROVED)

        pending_after = self.sampler.get_samples_pending_review(self.slice_id)
        self.assertEqual(len(pending_after), 0)

    def test_review_decision_only_on_pending(self):
        rows = [{"original_row_number": 1}]
        self.sampler.import_slice(self.slice_id, rows)
        sample_id = f"{self.slice_id}_row_1"

        result = self.sampler.review_decision(sample_id, approved=True)
        self.assertFalse(result)

    def test_update_remark_tracks_history(self):
        rows = [{"original_row_number": 1, "remark": "v1"}]
        self.sampler.import_slice(self.slice_id, rows)
        sample_id = f"{self.slice_id}_row_1"

        self.sampler.update_remark(sample_id, "v2", operator="linjie")

        history = self.sampler.get_sample_history(sample_id)
        remark_changes = [
            h for h in history
            if h["change_type"] == ChangeType.UPDATE_REMARK.value
        ]
        self.assertEqual(len(remark_changes), 1)
        self.assertEqual(remark_changes[0]["old_value"], "v1")
        self.assertEqual(remark_changes[0]["new_value"], "v2")
        self.assertEqual(remark_changes[0]["changed_by"], "linjie")

    def test_rollback_creates_record(self):
        rows = [{"original_row_number": 1}]
        self.sampler.import_slice(self.slice_id, rows)
        sample_id = f"{self.slice_id}_row_1"
        self.sampler.add_feature_snapshot(sample_id, "feat_001")

        self.sampler.rollback(
            sample_id,
            target_status=SampleStatus.IMPORTED,
            operator="operation",
            rollback_remark="测试回滚",
        )

        sample = self.sampler.store.get_sample(sample_id)
        self.assertEqual(sample.status, SampleStatus.IMPORTED)

        history = self.sampler.get_sample_history(sample_id)
        rollback_changes = [
            h for h in history
            if h["change_type"] == ChangeType.ROLLBACK.value
        ]
        self.assertEqual(len(rollback_changes), 1)


if __name__ == "__main__":
    unittest.main()
