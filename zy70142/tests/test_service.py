import unittest
from datetime import datetime, timedelta
from unittest.mock import MagicMock

from transcode_service import (
    TranscodeService,
    MockTranscodeExecutor,
    RetryPolicy,
    TaskStatus,
    ShardStatus,
    RetryType,
)
from transcode_service.exceptions import (
    InvalidStateTransitionException,
    MaxRetriesExceededException,
    RollbackFailedException,
    TaskNotFoundException,
)


class TestTranscodeService(unittest.TestCase):
    def setUp(self):
        self.service = TranscodeService()

    def test_submit_task_creates_correct_shards(self):
        task = self.service.submit_transcode_task(
            input_path="/video.mp4",
            resolutions=["1080p", "720p"],
            bitrates={"1080p": 8000000, "720p": 4000000},
        )

        self.assertEqual(task.total_shards, 2)
        self.assertEqual(task.status, TaskStatus.PROCESSING)

        resolutions = [s.resolution for s in task.shards.values()]
        self.assertIn("1080p", resolutions)
        self.assertIn("720p", resolutions)

        for shard in task.shards.values():
            self.assertEqual(shard.status, ShardStatus.QUEUED)

    def test_process_shard_success(self):
        task = self.service.submit_transcode_task(
            input_path="/video.mp4",
            resolutions=["1080p"],
            bitrates={"1080p": 8000000},
        )
        shard = list(task.shards.values())[0]

        success = self.service.process_shard(shard, task)

        self.assertTrue(success)
        self.assertEqual(shard.status, ShardStatus.SUCCESS)
        self.assertIsNotNone(shard.completed_at)
        self.assertIn(shard.shard_id, task.validation_results)

    def test_process_all_shards_completes_task(self):
        task = self.service.submit_transcode_task(
            input_path="/video.mp4",
            resolutions=["1080p", "720p"],
            bitrates={"1080p": 8000000, "720p": 4000000},
        )

        for shard in list(task.shards.values()):
            self.service.process_shard(shard, task)

        self.service.check_task_completion(task)

        self.assertEqual(task.status, TaskStatus.COMPLETED)
        self.assertEqual(task.completed_shards, 2)
        self.assertEqual(task.progress_percentage, 100.0)

    def test_statistics_updated_correctly(self):
        task = self.service.submit_transcode_task(
            input_path="/video.mp4",
            resolutions=["1080p", "720p"],
            bitrates={"1080p": 8000000, "720p": 4000000},
        )

        for shard in list(task.shards.values()):
            self.service.process_shard(shard, task)

        self.service.check_task_completion(task)

        stats = self.service.get_statistics()
        self.assertEqual(stats.total_tasks, 1)
        self.assertEqual(stats.completed_tasks, 1)
        self.assertEqual(stats.total_shards, 2)
        self.assertEqual(stats.successful_shards, 2)

    def test_rule_history_is_recorded(self):
        task = self.service.submit_transcode_task(
            input_path="/video.mp4",
            resolutions=["1080p"],
            bitrates={"1080p": 8000000},
        )

        history = self.service.get_rule_history()
        self.assertGreater(len(history), 0)

        rule_names = [h["rule_name"] for h in history]
        self.assertIn("task_status_transition_rule", rule_names)
        self.assertIn("shard_status_transition_rule", rule_names)

    def test_get_task_by_id(self):
        task1 = self.service.submit_transcode_task(
            input_path="/video.mp4",
            resolutions=["1080p"],
            bitrates={"1080p": 8000000},
        )
        task2 = self.service.get_task(task1.task_id)

        self.assertEqual(task1.task_id, task2.task_id)

    def test_get_task_not_found(self):
        with self.assertRaises(TaskNotFoundException):
            self.service.get_task("non-existent-task-id")

    def test_list_tasks(self):
        self.service.submit_transcode_task(
            input_path="/video1.mp4",
            resolutions=["1080p"],
            bitrates={"1080p": 8000000},
        )
        self.service.submit_transcode_task(
            input_path="/video2.mp4",
            resolutions=["720p"],
            bitrates={"720p": 4000000},
        )

        tasks = self.service.list_tasks()
        self.assertEqual(len(tasks), 2)


class TestTranscodeServiceWithFailures(unittest.TestCase):
    def setUp(self):
        self.service = TranscodeService(
            executor=MockTranscodeExecutor(simulate_failures=True)
        )

    def test_failed_shard_scheduled_for_retry(self):
        task = self.service.submit_transcode_task(
            input_path="/video.mp4",
            resolutions=["1080p"],
            bitrates={"1080p": 8000000},
            retry_policy=RetryPolicy(
                max_retries=3,
                initial_delay_seconds=1,
            ),
        )
        shard = list(task.shards.values())[0]

        success = self.service.process_shard(shard, task)

        self.assertFalse(success)
        self.assertEqual(shard.retry_count, 1)
        self.assertIsNotNone(shard.next_retry_at)
        self.assertEqual(self.service.get_pending_retry_count(), 1)

    def test_retry_succeeds(self):
        task = self.service.submit_transcode_task(
            input_path="/video.mp4",
            resolutions=["1080p"],
            bitrates={"1080p": 8000000},
            retry_policy=RetryPolicy(
                max_retries=3,
                initial_delay_seconds=0,
            ),
        )
        shard = list(task.shards.values())[0]

        self.service.process_shard(shard, task)
        self.assertEqual(shard.status, ShardStatus.QUEUED)
        self.assertEqual(shard.retry_count, 1)

        for entry in self.service._retry_scheduler._queue.values():
            entry.scheduled_at = datetime.now() - timedelta(seconds=1)
        shard.next_retry_at = datetime.now() - timedelta(seconds=1)

        processed = self.service.process_ready_retries()
        self.assertEqual(processed, 1)
        self.assertEqual(shard.status, ShardStatus.SUCCESS)

    def test_exceeds_max_retries_triggers_rollback(self):
        class AlwaysFailExecutor(MockTranscodeExecutor):
            def transcode(self, shard, input_path, output_path):
                return False

        service = TranscodeService(executor=AlwaysFailExecutor())

        task = service.submit_transcode_task(
            input_path="/video.mp4",
            resolutions=["1080p", "720p"],
            bitrates={"1080p": 8000000, "720p": 4000000},
            retry_policy=RetryPolicy(
                max_retries=1,
                initial_delay_seconds=0,
            ),
        )

        for shard in list(task.shards.values()):
            service.process_shard(shard, task)

        for shard in task.shards.values():
            shard.next_retry_at = datetime.now() - timedelta(seconds=1)

        service.process_ready_retries()

        self.assertEqual(task.status, TaskStatus.FAILED)

        stats = service.get_statistics()
        self.assertEqual(stats.rollback_attempts, 1)
        self.assertEqual(stats.successful_rollbacks, 1)

    def test_validation_failure_triggers_rollback_by_default(self):
        class BadProductExecutor(MockTranscodeExecutor):
            def get_file_info(self, file_path):
                return {
                    "exists": True,
                    "size": 0,
                    "can_open": True,
                }

        service = TranscodeService(executor=BadProductExecutor())

        task = service.submit_transcode_task(
            input_path="/video.mp4",
            resolutions=["1080p"],
            bitrates={"1080p": 8000000},
            retry_policy=RetryPolicy(
                max_retries=1,
                initial_delay_seconds=0,
            ),
        )
        shard = list(task.shards.values())[0]

        service.process_shard(shard, task)

        self.assertEqual(shard.retry_count, 0)
        self.assertEqual(shard.status, ShardStatus.FAILED)
        self.assertEqual(task.status, TaskStatus.FAILED)

        result = task.validation_results.get(shard.shard_id)
        self.assertIsNotNone(result)
        self.assertFalse(result.passed)
        self.assertIn("min_file_size", result.failed_checks)

        stats = service.get_statistics()
        self.assertEqual(stats.rollback_attempts, 1)
        self.assertEqual(stats.successful_rollbacks, 1)


class TestInvalidStateTransitions(unittest.TestCase):
    def setUp(self):
        self.service = TranscodeService()

    def test_cannot_complete_task_without_all_shards(self):
        task = self.service.submit_transcode_task(
            input_path="/video.mp4",
            resolutions=["1080p"],
            bitrates={"1080p": 8000000},
        )

        with self.assertRaises(InvalidStateTransitionException):
            self.service._task_manager.transition_status(
                task, TaskStatus.COMPLETED
            )

    def test_completed_task_cannot_transition(self):
        task = self.service.submit_transcode_task(
            input_path="/video.mp4",
            resolutions=["1080p"],
            bitrates={"1080p": 8000000},
        )
        shard = list(task.shards.values())[0]
        self.service.process_shard(shard, task)
        self.service.check_task_completion(task)

        self.assertEqual(task.status, TaskStatus.COMPLETED)

        with self.assertRaises(InvalidStateTransitionException):
            self.service._task_manager.transition_status(
                task, TaskStatus.PROCESSING
            )

    def test_pending_cannot_rollback(self):
        from transcode_service.models import TranscodeTask
        task = TranscodeTask.create(
            input_path="/video.mp4",
            resolutions=["1080p"],
            bitrates={"1080p": 8000000},
        )
        self.service._task_manager._tasks[task.task_id] = task

        with self.assertRaises(RollbackFailedException):
            self.service.rollback_task(task, "Test rollback")


class TestRuleDefinitions(unittest.TestCase):
    def setUp(self):
        self.service = TranscodeService()

    def test_rule_definitions_are_available(self):
        definitions = self.service.get_rule_definitions()
        self.assertGreater(len(definitions), 0)

        self.assertIn("task_status_transition_rule", definitions)
        self.assertIn("shard_status_transition_rule", definitions)
        self.assertIn("shard_retry_rule", definitions)
        self.assertIn("task_completion_rule", definitions)
        self.assertIn("rollback_rule", definitions)

    def test_each_rule_has_description(self):
        definitions = self.service.get_rule_definitions()

        for rule_name, definition in definitions.items():
            self.assertIn("description", definition)
            self.assertGreater(len(definition["description"]), 0)


class TestProductValidation(unittest.TestCase):
    def setUp(self):
        self.service = TranscodeService()

    def test_validation_records_all_checks(self):
        from transcode_service.rules import ProductValidationRule
        from transcode_service.models import ResolutionShard

        shard = ResolutionShard.create(
            task_id="task-1",
            resolution="1080p",
            bitrate=8000000,
            input_path="/test.mp4",
        )

        file_info = {
            "exists": True,
            "size": 1024,
            "can_open": True,
            "metadata_valid": True,
            "expected_duration": 60.0,
            "actual_duration": 60.0,
            "duration_tolerance": 0.5,
        }

        rule = ProductValidationRule(shard, file_info)
        result = self.service._rule_engine.evaluate_product_validation(rule)

        self.assertTrue(result.passed)
        self.assertEqual(len(result.all_checks), 6)
        self.assertEqual(len(result.passed_checks), 6)
        self.assertEqual(len(result.failed_checks), 0)

    def test_validation_history_is_recorded(self):
        from transcode_service.rules import ProductValidationRule
        from transcode_service.models import ResolutionShard

        shard = ResolutionShard.create(
            task_id="task-1",
            resolution="1080p",
            bitrate=8000000,
            input_path="/test.mp4",
        )

        file_info = {
            "exists": True,
            "size": 1024,
            "can_open": True,
        }

        rule = ProductValidationRule(shard, file_info)
        self.service._rule_engine.evaluate_product_validation(rule)

        history = self.service._rule_engine.get_history("product_validation_rule")
        self.assertGreater(len(history), 0)


if __name__ == "__main__":
    unittest.main()
