import unittest
from datetime import datetime, timedelta

from transcode_service.models import (
    TaskStatus,
    ShardStatus,
    RetryType,
    RetryPolicy,
    ResolutionShard,
    TranscodeTask,
)
from transcode_service.rules import (
    RuleEngine,
    TaskStatusRule,
    ShardStatusRule,
    RetryRule,
    RetryTimingRule,
    ProductValidationRule,
    TaskCompletionRule,
    RollbackRule,
    RuleResult,
)


class TestRuleResult(unittest.TestCase):
    def test_passed_result(self):
        result = RuleResult(
            passed=True,
            reason="Test passed",
            evidence={"key": "value"},
            rule_name="test_rule",
        )
        self.assertTrue(result)
        self.assertEqual(result.reason, "Test passed")

    def test_failed_result(self):
        result = RuleResult(
            passed=False,
            reason="Test failed",
            evidence={"error": "reason"},
            rule_name="test_rule",
        )
        self.assertFalse(result)


class TestTaskStatusRule(unittest.TestCase):
    def test_valid_transition(self):
        rule = TaskStatusRule(TaskStatus.PENDING, TaskStatus.INITIALIZING)
        result = rule.evaluate()
        self.assertTrue(result)
        self.assertIn("Valid transition", result.reason)

    def test_invalid_transition(self):
        rule = TaskStatusRule(TaskStatus.PENDING, TaskStatus.COMPLETED)
        result = rule.evaluate()
        self.assertFalse(result)
        self.assertIn("Invalid", result.reason)

    def test_evidence_contains_transitions(self):
        rule = TaskStatusRule(TaskStatus.PENDING, TaskStatus.PROCESSING)
        result = rule.evaluate()
        self.assertIn("valid_transitions", result.evidence)
        self.assertIn("INITIALIZING", result.evidence["valid_transitions"])

    def test_description(self):
        rule = TaskStatusRule(TaskStatus.PENDING, TaskStatus.INITIALIZING)
        desc = rule.get_description()
        self.assertIn("PENDING", desc)
        self.assertIn("INITIALIZING", desc)


class TestShardStatusRule(unittest.TestCase):
    def test_valid_transition(self):
        rule = ShardStatusRule(ShardStatus.PENDING, ShardStatus.QUEUED)
        result = rule.evaluate()
        self.assertTrue(result)

    def test_invalid_transition(self):
        rule = ShardStatusRule(ShardStatus.PENDING, ShardStatus.SUCCESS)
        result = rule.evaluate()
        self.assertFalse(result)


class TestRetryRule(unittest.TestCase):
    def setUp(self):
        self.shard = ResolutionShard.create(
            task_id="task-1",
            resolution="1080p",
            bitrate=8000000,
            input_path="/test.mp4",
            max_retries=3,
        )
        self.policy = RetryPolicy()

    def test_can_retry_first_attempt(self):
        self.shard.error_type = RetryType.TRANSIENT
        self.shard.retry_count = 0
        rule = RetryRule(self.shard, self.policy)
        result = rule.evaluate()
        self.assertTrue(result)

    def test_can_retry_within_limit(self):
        self.shard.error_type = RetryType.NETWORK
        self.shard.retry_count = 2
        rule = RetryRule(self.shard, self.policy)
        result = rule.evaluate()
        self.assertTrue(result)

    def test_cannot_retry_exceeded_limit(self):
        self.shard.error_type = RetryType.TRANSIENT
        self.shard.retry_count = 3
        rule = RetryRule(self.shard, self.policy)
        result = rule.evaluate()
        self.assertFalse(result)
        self.assertIn("exceeded", result.reason.lower())

    def test_cannot_retry_non_retryable_type(self):
        self.shard.error_type = RetryType.VALIDATION
        self.shard.retry_count = 0
        rule = RetryRule(self.shard, self.policy)
        result = rule.evaluate()
        self.assertFalse(result)
        self.assertIn("not in", result.reason.lower())

    def test_evidence_contains_key_info(self):
        self.shard.error_type = RetryType.TRANSIENT
        self.shard.retry_count = 1
        rule = RetryRule(self.shard, self.policy)
        result = rule.evaluate()
        self.assertIn("current_retry_count", result.evidence)
        self.assertIn("max_retries", result.evidence)
        self.assertIn("error_type", result.evidence)


class TestRetryTimingRule(unittest.TestCase):
    def setUp(self):
        self.shard = ResolutionShard.create(
            task_id="task-1",
            resolution="1080p",
            bitrate=8000000,
            input_path="/test.mp4",
            max_retries=3,
        )
        self.policy = RetryPolicy()

    def test_no_next_retry_at_allows_immediate(self):
        self.shard.next_retry_at = None
        rule = RetryTimingRule(self.shard, self.policy)
        result = rule.evaluate()
        self.assertTrue(result)

    def test_next_retry_in_past_allows_retry(self):
        self.shard.next_retry_at = datetime.now() - timedelta(seconds=10)
        rule = RetryTimingRule(self.shard, self.policy)
        result = rule.evaluate()
        self.assertTrue(result)

    def test_next_retry_in_future_denies_retry(self):
        self.shard.next_retry_at = datetime.now() + timedelta(seconds=10)
        rule = RetryTimingRule(self.shard, self.policy)
        result = rule.evaluate()
        self.assertFalse(result)
        self.assertIn("wait_seconds", result.evidence)
        self.assertGreater(result.evidence["wait_seconds"], 0)

    def test_current_time_parameter_respected(self):
        self.shard.next_retry_at = datetime(2024, 1, 1, 12, 0, 0)
        current_time = datetime(2024, 1, 1, 12, 0, 1)
        rule = RetryTimingRule(self.shard, self.policy, current_time=current_time)
        result = rule.evaluate()
        self.assertTrue(result)


class TestProductValidationRule(unittest.TestCase):
    def setUp(self):
        self.shard = ResolutionShard.create(
            task_id="task-1",
            resolution="1080p",
            bitrate=8000000,
            input_path="/test.mp4",
        )

    def test_all_required_checks_pass(self):
        file_info = {
            "exists": True,
            "size": 1024,
            "can_open": True,
        }
        rule = ProductValidationRule(self.shard, file_info)
        result = rule.evaluate()
        self.assertTrue(result.passed)
        self.assertEqual(len(result.errors), 0)
        self.assertEqual(len(result.failed_checks), 0)

    def test_file_missing_fails_validation(self):
        file_info = {
            "exists": False,
            "size": 0,
            "can_open": False,
        }
        rule = ProductValidationRule(self.shard, file_info)
        result = rule.evaluate()
        self.assertFalse(result.passed)
        self.assertIn("file_exists", result.failed_checks)

    def test_zero_size_fails_validation(self):
        file_info = {
            "exists": True,
            "size": 0,
            "can_open": True,
        }
        rule = ProductValidationRule(self.shard, file_info)
        result = rule.evaluate()
        self.assertFalse(result.passed)
        self.assertIn("min_file_size", result.failed_checks)

    def test_cannot_open_fails_validation(self):
        file_info = {
            "exists": True,
            "size": 1024,
            "can_open": False,
        }
        rule = ProductValidationRule(self.shard, file_info)
        result = rule.evaluate()
        self.assertFalse(result.passed)
        self.assertIn("can_open", result.failed_checks)

    def test_optional_checks_generate_warnings_not_errors(self):
        file_info = {
            "exists": True,
            "size": 1024,
            "can_open": True,
            "metadata_valid": False,
        }
        rule = ProductValidationRule(self.shard, file_info)
        result = rule.evaluate()
        self.assertTrue(result.passed)
        self.assertEqual(len(result.errors), 0)
        self.assertGreater(len(result.warnings), 0)

    def test_duration_match_within_tolerance(self):
        file_info = {
            "exists": True,
            "size": 1024,
            "can_open": True,
            "expected_duration": 60.0,
            "actual_duration": 60.3,
            "duration_tolerance": 0.5,
        }
        rule = ProductValidationRule(self.shard, file_info)
        result = rule.evaluate()
        self.assertTrue(result.passed)

    def test_duration_match_outside_tolerance(self):
        file_info = {
            "exists": True,
            "size": 1024,
            "can_open": True,
            "expected_duration": 60.0,
            "actual_duration": 62.0,
            "duration_tolerance": 0.5,
        }
        rule = ProductValidationRule(self.shard, file_info)
        result = rule.evaluate()
        self.assertIn("duration_match", result.failed_checks)

    def test_required_checks_parameter(self):
        file_info = {
            "exists": True,
            "size": 0,
            "can_open": True,
        }
        rule = ProductValidationRule(
            self.shard,
            file_info,
            required_checks={"file_exists", "can_open"},
        )
        result = rule.evaluate()
        self.assertTrue(result.passed)


class TestTaskCompletionRule(unittest.TestCase):
    def setUp(self):
        self.task = TranscodeTask.create(
            input_path="/video.mp4",
            resolutions=["1080p", "720p"],
            bitrates={"1080p": 8000000, "720p": 4000000},
        )

    def test_empty_task_cannot_complete(self):
        rule = TaskCompletionRule(self.task)
        result = rule.evaluate()
        self.assertFalse(result)
        self.assertIn("no shards", result.reason.lower())

    def test_all_shards_success_can_complete(self):
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

        rule = TaskCompletionRule(self.task)
        result = rule.evaluate()
        self.assertTrue(result)
        self.assertIn("All shards completed", result.reason)

    def test_any_shard_failed_cannot_complete(self):
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

        rule = TaskCompletionRule(self.task)
        result = rule.evaluate()
        self.assertFalse(result)
        self.assertIn("failed", result.reason.lower())

    def test_shards_still_processing_cannot_complete(self):
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

        rule = TaskCompletionRule(self.task)
        result = rule.evaluate()
        self.assertFalse(result)
        self.assertIn("processing", result.reason.lower())


class TestRollbackRule(unittest.TestCase):
    def setUp(self):
        self.task = TranscodeTask.create(
            input_path="/video.mp4",
            resolutions=["1080p", "720p"],
            bitrates={"1080p": 8000000, "720p": 4000000},
        )

    def test_cannot_rollback_from_pending(self):
        self.task.status = TaskStatus.PENDING
        rule = RollbackRule(self.task)
        result = rule.evaluate()
        self.assertFalse(result)

    def test_can_rollback_from_processing_with_failed_shard(self):
        self.task.status = TaskStatus.PROCESSING
        shard = ResolutionShard.create(
            task_id=self.task.task_id,
            resolution="1080p",
            bitrate=8000000,
            input_path="/video.mp4",
        )
        shard.status = ShardStatus.FAILED
        self.task.shards[shard.shard_id] = shard

        rule = RollbackRule(self.task)
        result = rule.evaluate()
        self.assertTrue(result)
        self.assertIn("shard", result.reason.lower())

    def test_can_rollback_from_validating_with_failed_shard(self):
        self.task.status = TaskStatus.VALIDATING
        shard = ResolutionShard.create(
            task_id=self.task.task_id,
            resolution="1080p",
            bitrate=8000000,
            input_path="/video.mp4",
        )
        shard.status = ShardStatus.FAILED
        self.task.shards[shard.shard_id] = shard

        rule = RollbackRule(self.task)
        result = rule.evaluate()
        self.assertTrue(result)

    def test_can_rollback_with_error_context(self):
        self.task.status = TaskStatus.PROCESSING
        rule = RollbackRule(self.task, error_context="Validation failed")
        result = rule.evaluate()
        self.assertTrue(result)
        self.assertIn("Validation failed", result.reason)

    def test_cannot_rollback_without_valid_reason(self):
        self.task.status = TaskStatus.PROCESSING
        rule = RollbackRule(self.task)
        result = rule.evaluate()
        self.assertFalse(result)


class TestRuleEngine(unittest.TestCase):
    def setUp(self):
        self.engine = RuleEngine()

    def test_evaluate_records_history(self):
        rule = TaskStatusRule(TaskStatus.PENDING, TaskStatus.INITIALIZING)
        self.engine.evaluate(rule)
        history = self.engine.get_history()
        self.assertEqual(len(history), 1)
        self.assertEqual(history[0]["rule_name"], "task_status_transition_rule")

    def test_evaluate_without_recording_history(self):
        rule = TaskStatusRule(TaskStatus.PENDING, TaskStatus.INITIALIZING)
        self.engine.evaluate(rule, record_history=False)
        history = self.engine.get_history()
        self.assertEqual(len(history), 0)

    def test_get_history_by_rule_name(self):
        rule1 = TaskStatusRule(TaskStatus.PENDING, TaskStatus.INITIALIZING)
        rule2 = ShardStatusRule(ShardStatus.PENDING, ShardStatus.QUEUED)
        self.engine.evaluate(rule1)
        self.engine.evaluate(rule2)

        task_history = self.engine.get_history("task_status_transition_rule")
        self.assertEqual(len(task_history), 1)

        shard_history = self.engine.get_history("shard_status_transition_rule")
        self.assertEqual(len(shard_history), 1)

    def test_clear_history(self):
        rule = TaskStatusRule(TaskStatus.PENDING, TaskStatus.INITIALIZING)
        self.engine.evaluate(rule)
        self.assertEqual(len(self.engine.get_history()), 1)

        self.engine.clear_history()
        self.assertEqual(len(self.engine.get_history()), 0)

    def test_register_rule(self):
        rule = TaskStatusRule(TaskStatus.PENDING, TaskStatus.INITIALIZING)
        self.engine.register_rule(rule)
        definitions = self.engine.get_rule_definitions()
        self.assertIn("task_status_transition_rule", definitions)

    def test_history_contains_timestamp(self):
        rule = TaskStatusRule(TaskStatus.PENDING, TaskStatus.INITIALIZING)
        self.engine.evaluate(rule)
        history = self.engine.get_history()[0]
        self.assertIn("timestamp", history)
        self.assertIsNotNone(history["timestamp"])


if __name__ == "__main__":
    unittest.main()
