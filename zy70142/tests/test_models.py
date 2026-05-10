import unittest
from datetime import datetime, timedelta

from transcode_service.models import (
    TaskStatus,
    ShardStatus,
    RetryType,
    RetryPolicy,
    ResolutionShard,
    TranscodeTask,
    ProductValidationResult,
    TranscodeStatistics,
)


class TestTaskStatus(unittest.TestCase):
    def test_valid_transitions(self):
        self.assertTrue(TaskStatus.PENDING.can_transition_to(TaskStatus.INITIALIZING))
        self.assertTrue(TaskStatus.INITIALIZING.can_transition_to(TaskStatus.SHARDING))
        self.assertTrue(TaskStatus.SHARDING.can_transition_to(TaskStatus.PROCESSING))
        self.assertTrue(TaskStatus.PROCESSING.can_transition_to(TaskStatus.VALIDATING))
        self.assertTrue(TaskStatus.PROCESSING.can_transition_to(TaskStatus.ROLLING_BACK))
        self.assertTrue(TaskStatus.VALIDATING.can_transition_to(TaskStatus.COMPLETED))

    def test_invalid_transitions(self):
        self.assertFalse(TaskStatus.PENDING.can_transition_to(TaskStatus.PROCESSING))
        self.assertFalse(TaskStatus.COMPLETED.can_transition_to(TaskStatus.PROCESSING))
        self.assertFalse(TaskStatus.FAILED.can_transition_to(TaskStatus.PENDING))
        self.assertFalse(TaskStatus.PENDING.can_transition_to(TaskStatus.COMPLETED))

    def test_valid_transitions_returns_correct_map(self):
        transitions = TaskStatus.valid_transitions()
        self.assertIn(TaskStatus.PENDING, transitions)
        self.assertIn(TaskStatus.COMPLETED, transitions)


class TestShardStatus(unittest.TestCase):
    def test_valid_transitions(self):
        self.assertTrue(ShardStatus.PENDING.can_transition_to(ShardStatus.QUEUED))
        self.assertTrue(ShardStatus.QUEUED.can_transition_to(ShardStatus.PROCESSING))
        self.assertTrue(ShardStatus.PROCESSING.can_transition_to(ShardStatus.SUCCESS))
        self.assertTrue(ShardStatus.PROCESSING.can_transition_to(ShardStatus.FAILED))
        self.assertTrue(ShardStatus.FAILED.can_transition_to(ShardStatus.QUEUED))
        self.assertTrue(ShardStatus.FAILED.can_transition_to(ShardStatus.ROLLBACK))

    def test_invalid_transitions(self):
        self.assertFalse(ShardStatus.PENDING.can_transition_to(ShardStatus.SUCCESS))
        self.assertFalse(ShardStatus.SUCCESS.can_transition_to(ShardStatus.QUEUED))
        self.assertFalse(ShardStatus.FAILED.can_transition_to(ShardStatus.SUCCESS))


class TestRetryPolicy(unittest.TestCase):
    def test_default_policy(self):
        policy = RetryPolicy()
        self.assertEqual(policy.max_retries, 3)
        self.assertEqual(policy.initial_delay_seconds, 5)
        self.assertEqual(policy.max_delay_seconds, 300)
        self.assertEqual(policy.backoff_multiplier, 2.0)

    def test_calculate_backoff(self):
        policy = RetryPolicy(
            initial_delay_seconds=5,
            max_delay_seconds=60,
            backoff_multiplier=2.0,
        )
        self.assertEqual(policy.calculate_backoff(1), 5)
        self.assertEqual(policy.calculate_backoff(2), 10)
        self.assertEqual(policy.calculate_backoff(3), 20)
        self.assertEqual(policy.calculate_backoff(4), 40)
        self.assertEqual(policy.calculate_backoff(5), 60)

    def test_custom_policy(self):
        policy = RetryPolicy(
            max_retries=5,
            initial_delay_seconds=10,
            max_delay_seconds=120,
            backoff_multiplier=1.5,
            retryable_error_types=[RetryType.TRANSIENT],
        )
        self.assertEqual(policy.max_retries, 5)
        self.assertEqual(policy.initial_delay_seconds, 10)
        self.assertEqual(len(policy.retryable_error_types), 1)


class TestResolutionShard(unittest.TestCase):
    def setUp(self):
        self.shard = ResolutionShard.create(
            task_id="test-task",
            resolution="1080p",
            bitrate=8000000,
            input_path="/test.mp4",
            max_retries=3,
        )

    def test_create_shard(self):
        self.assertIsNotNone(self.shard.shard_id)
        self.assertEqual(self.shard.task_id, "test-task")
        self.assertEqual(self.shard.resolution, "1080p")
        self.assertEqual(self.shard.bitrate, 8000000)
        self.assertEqual(self.shard.status, ShardStatus.PENDING)
        self.assertEqual(self.shard.retry_count, 0)
        self.assertEqual(self.shard.max_retries, 3)

    def test_can_retry_within_limit(self):
        policy = RetryPolicy()
        self.shard.error_type = RetryType.TRANSIENT
        self.shard.retry_count = 0
        self.assertTrue(self.shard.can_retry(policy))
        self.shard.retry_count = 2
        self.assertTrue(self.shard.can_retry(policy))

    def test_cannot_retry_exceeded_limit(self):
        policy = RetryPolicy()
        self.shard.error_type = RetryType.TRANSIENT
        self.shard.retry_count = 3
        self.assertFalse(self.shard.can_retry(policy))

    def test_cannot_retry_non_retryable_type(self):
        policy = RetryPolicy()
        self.shard.error_type = RetryType.VALIDATION
        self.shard.retry_count = 0
        self.assertFalse(self.shard.can_retry(policy))

    def test_to_dict(self):
        d = self.shard.to_dict()
        self.assertIn("shard_id", d)
        self.assertEqual(d["status"], "PENDING")
        self.assertIn("resolution", d)


class TestTranscodeTask(unittest.TestCase):
    def setUp(self):
        self.task = TranscodeTask.create(
            input_path="/video.mp4",
            resolutions=["1080p", "720p"],
            bitrates={"1080p": 8000000, "720p": 4000000},
        )

    def test_create_task(self):
        self.assertIsNotNone(self.task.task_id)
        self.assertEqual(self.task.input_path, "/video.mp4")
        self.assertEqual(len(self.task.resolutions), 2)
        self.assertEqual(self.task.status, TaskStatus.PENDING)

    def test_add_shards(self):
        shard1 = ResolutionShard.create(
            task_id=self.task.task_id,
            resolution="1080p",
            bitrate=8000000,
            input_path="/video.mp4",
        )
        shard2 = ResolutionShard.create(
            task_id=self.task.task_id,
            resolution="720p",
            bitrate=4000000,
            input_path="/video.mp4",
        )
        self.task.shards[shard1.shard_id] = shard1
        self.task.shards[shard2.shard_id] = shard2

        self.assertEqual(self.task.total_shards, 2)
        self.assertEqual(self.task.completed_shards, 0)

    def test_progress_calculation(self):
        shard1 = ResolutionShard.create(
            task_id=self.task.task_id,
            resolution="1080p",
            bitrate=8000000,
            input_path="/video.mp4",
        )
        shard1.status = ShardStatus.SUCCESS
        shard2 = ResolutionShard.create(
            task_id=self.task.task_id,
            resolution="720p",
            bitrate=4000000,
            input_path="/video.mp4",
        )
        shard2.status = ShardStatus.PROCESSING
        self.task.shards[shard1.shard_id] = shard1
        self.task.shards[shard2.shard_id] = shard2

        self.assertEqual(self.task.progress_percentage, 50.0)

    def test_all_shards_completed(self):
        shard1 = ResolutionShard.create(
            task_id=self.task.task_id,
            resolution="1080p",
            bitrate=8000000,
            input_path="/video.mp4",
        )
        shard1.status = ShardStatus.SUCCESS
        shard2 = ResolutionShard.create(
            task_id=self.task.task_id,
            resolution="720p",
            bitrate=4000000,
            input_path="/video.mp4",
        )
        shard2.status = ShardStatus.SUCCESS
        self.task.shards[shard1.shard_id] = shard1
        self.task.shards[shard2.shard_id] = shard2

        self.assertTrue(self.task.all_shards_completed)
        self.assertFalse(self.task.any_shard_failed)

    def test_any_shard_failed(self):
        shard1 = ResolutionShard.create(
            task_id=self.task.task_id,
            resolution="1080p",
            bitrate=8000000,
            input_path="/video.mp4",
        )
        shard1.status = ShardStatus.SUCCESS
        shard2 = ResolutionShard.create(
            task_id=self.task.task_id,
            resolution="720p",
            bitrate=4000000,
            input_path="/video.mp4",
        )
        shard2.status = ShardStatus.FAILED
        self.task.shards[shard1.shard_id] = shard1
        self.task.shards[shard2.shard_id] = shard2

        self.assertFalse(self.task.all_shards_completed)
        self.assertTrue(self.task.any_shard_failed)


class TestProductValidationResult(unittest.TestCase):
    def setUp(self):
        self.result = ProductValidationResult(
            shard_id="test-shard",
            passed=True,
            checks={
                "file_exists": True,
                "min_file_size": True,
                "can_open": True,
                "metadata_valid": False,
            },
            errors=[],
            warnings=["metadata check failed"],
        )

    def test_passed_checks(self):
        self.assertEqual(len(self.result.passed_checks), 3)
        self.assertIn("file_exists", self.result.passed_checks)
        self.assertIn("min_file_size", self.result.passed_checks)

    def test_failed_checks(self):
        self.assertEqual(len(self.result.failed_checks), 1)
        self.assertIn("metadata_valid", self.result.failed_checks)

    def test_all_checks(self):
        self.assertEqual(len(self.result.all_checks), 4)


class TestTranscodeStatistics(unittest.TestCase):
    def setUp(self):
        self.stats = TranscodeStatistics()

    def test_initial_state(self):
        self.assertEqual(self.stats.total_tasks, 0)
        self.assertEqual(self.stats.total_shards, 0)
        self.assertEqual(self.stats.task_success_rate, 0.0)

    def test_success_rates(self):
        self.stats.total_tasks = 10
        self.stats.completed_tasks = 8
        self.stats.total_shards = 50
        self.stats.successful_shards = 45
        self.stats.total_validation_checks = 200
        self.stats.passed_validations = 190

        self.assertAlmostEqual(self.stats.task_success_rate, 80.0)
        self.assertAlmostEqual(self.stats.shard_success_rate, 90.0)
        self.assertAlmostEqual(self.stats.validation_success_rate, 95.0)

    def test_to_dict(self):
        d = self.stats.to_dict()
        self.assertIn("task_success_rate", d)
        self.assertIn("shard_success_rate", d)
        self.assertIn("validation_success_rate", d)


if __name__ == "__main__":
    unittest.main()
