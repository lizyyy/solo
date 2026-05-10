import logging
from typing import Dict, List, Optional, Any, Callable
from datetime import datetime, timedelta
from abc import ABC, abstractmethod

from .models import (
    TranscodeTask,
    TaskStatus,
    ResolutionShard,
    ShardStatus,
    RetryType,
    RetryPolicy,
    RetryQueueEntry,
    ProductValidationResult,
    TranscodeStatistics,
)
from .rules import (
    RuleEngine,
    TaskStatusRule,
    ShardStatusRule,
    RetryRule,
    RetryTimingRule,
    ProductValidationRule,
    TaskCompletionRule,
    RollbackRule,
)
from .exceptions import (
    TaskNotFoundException,
    ShardNotFoundException,
    ValidationFailedException,
    RollbackFailedException,
    MaxRetriesExceededException,
    InvalidStateTransitionException,
)


logger = logging.getLogger(__name__)


class TranscodeExecutor(ABC):
    @abstractmethod
    def transcode(
        self,
        shard: ResolutionShard,
        input_path: str,
        output_path: str,
    ) -> bool:
        pass

    @abstractmethod
    def get_file_info(self, file_path: str) -> Dict[str, Any]:
        pass


class MockTranscodeExecutor(TranscodeExecutor):
    def __init__(self, simulate_failures: bool = False):
        self.simulate_failures = simulate_failures
        self._processed = set()

    def transcode(
        self,
        shard: ResolutionShard,
        input_path: str,
        output_path: str,
    ) -> bool:
        self._processed.add(shard.shard_id)
        if self.simulate_failures and shard.retry_count == 0:
            return False
        return True

    def get_file_info(self, file_path: str) -> Dict[str, Any]:
        return {
            "exists": True,
            "size": 1024 * 1024,
            "can_open": True,
            "metadata_valid": True,
            "duration": 60.0,
            "resolution": "1920x1080",
        }


class ShardManager:
    def __init__(
        self,
        rule_engine: RuleEngine,
        statistics: TranscodeStatistics,
    ):
        self._rule_engine = rule_engine
        self._statistics = statistics

    def create_shard(
        self,
        task: TranscodeTask,
        resolution: str,
        bitrate: int,
        input_path: str,
    ) -> ResolutionShard:
        shard = ResolutionShard.create(
            task_id=task.task_id,
            resolution=resolution,
            bitrate=bitrate,
            input_path=input_path,
            max_retries=task.retry_policy.max_retries,
        )
        task.shards[shard.shard_id] = shard
        self._statistics.total_shards += 1
        logger.info(
            f"Created shard {shard.shard_id} for task {task.task_id}: "
            f"resolution={resolution}, bitrate={bitrate}"
        )
        return shard

    def transition_status(
        self,
        shard: ResolutionShard,
        new_status: ShardStatus,
    ) -> None:
        old_status = shard.status
        rule = ShardStatusRule(old_status, new_status, shard)
        result = self._rule_engine.evaluate(rule)

        if not result:
            raise InvalidStateTransitionException(
                shard.shard_id, old_status.name, new_status.name
            )

        shard.status = new_status
        logger.info(
            f"Shard {shard.shard_id} status transition: "
            f"{old_status.name} -> {new_status.name}"
        )

    def mark_processing(
        self,
        shard: ResolutionShard,
    ) -> None:
        self.transition_status(shard, ShardStatus.PROCESSING)
        shard.started_at = datetime.now()

    def mark_success(
        self,
        shard: ResolutionShard,
        output_path: str,
    ) -> None:
        self.transition_status(shard, ShardStatus.SUCCESS)
        shard.output_path = output_path
        shard.completed_at = datetime.now()
        shard.failed_at = None
        shard.last_error = None
        shard.error_type = None
        shard.next_retry_at = None
        self._statistics.successful_shards += 1
        logger.info(
            f"Shard {shard.shard_id} completed successfully: "
            f"output_path={output_path}"
        )

    def mark_failed(
        self,
        shard: ResolutionShard,
        error_type: RetryType,
        error_message: str,
    ) -> None:
        self.transition_status(shard, ShardStatus.FAILED)
        shard.failed_at = datetime.now()
        shard.last_error = error_message
        shard.error_type = error_type
        self._statistics.failed_shards += 1
        logger.warning(
            f"Shard {shard.shard_id} failed: "
            f"type={error_type.name}, message={error_message}"
        )

    def schedule_retry(
        self,
        shard: ResolutionShard,
        retry_policy: RetryPolicy,
        error_type: RetryType,
        error_message: str,
    ) -> None:
        self.mark_failed(shard, error_type, error_message)

        retry_rule = RetryRule(shard, retry_policy)
        retry_result = self._rule_engine.evaluate(retry_rule)

        if not retry_result:
            raise MaxRetriesExceededException(
                shard.shard_id, shard.max_retries
            )

        shard.retry_count += 1
        backoff = retry_policy.calculate_backoff(shard.retry_count)
        shard.next_retry_at = datetime.now() + timedelta(seconds=backoff)
        self._statistics.retried_shards += 1

        self.transition_status(shard, ShardStatus.QUEUED)
        logger.info(
            f"Shard {shard.shard_id} scheduled for retry "
            f"#{shard.retry_count}: backoff={backoff}s, "
            f"next_retry_at={shard.next_retry_at}"
        )

    def mark_skipped(
        self,
        shard: ResolutionShard,
        reason: str,
    ) -> None:
        self.transition_status(shard, ShardStatus.SKIPPED)
        logger.info(
            f"Shard {shard.shard_id} skipped: {reason}"
        )

    def mark_rollback(
        self,
        shard: ResolutionShard,
    ) -> None:
        self.transition_status(shard, ShardStatus.ROLLBACK)
        logger.info(
            f"Shard {shard.shard_id} marked for rollback"
        )


class RetryScheduler:
    def __init__(
        self,
        rule_engine: RuleEngine,
        statistics: TranscodeStatistics,
    ):
        self._rule_engine = rule_engine
        self._statistics = statistics
        self._queue: Dict[str, RetryQueueEntry] = {}

    def queue_for_retry(
        self,
        shard: ResolutionShard,
        error_type: RetryType,
        reason: str,
    ) -> RetryQueueEntry:
        entry = RetryQueueEntry.create(
            shard_id=shard.shard_id,
            task_id=shard.task_id,
            attempt=shard.retry_count + 1,
            scheduled_at=shard.next_retry_at or datetime.now(),
            error_type=error_type,
            reason=reason,
        )
        self._queue[entry.queue_id] = entry
        logger.info(
            f"Queued shard {shard.shard_id} for retry "
            f"(entry={entry.queue_id}, attempt={entry.attempt})"
        )
        return entry

    def get_ready_entries(
        self,
        current_time: Optional[datetime] = None,
    ) -> List[RetryQueueEntry]:
        current_time = current_time or datetime.now()
        ready = [
            entry for entry in self._queue.values()
            if entry.status == "PENDING" and entry.scheduled_at <= current_time
        ]
        return sorted(ready, key=lambda e: e.scheduled_at)

    def execute_retry(
        self,
        entry: RetryQueueEntry,
        shard: ResolutionShard,
        retry_policy: RetryPolicy,
        executor: TranscodeExecutor,
    ) -> bool:
        timing_rule = RetryTimingRule(shard, retry_policy)
        timing_result = self._rule_engine.evaluate(timing_rule)

        if not timing_result:
            logger.info(
                f"Retry entry {entry.queue_id} not yet ready: "
                f"{timing_result.reason}"
            )
            return False

        entry.executed_at = datetime.now()
        entry.status = "EXECUTED"

        output_path = f"{shard.input_path}.{shard.resolution}.transcoded"
        success = executor.transcode(shard, shard.input_path, output_path)

        if success:
            logger.info(
                f"Retry {entry.attempt} for shard {shard.shard_id} succeeded"
            )
        else:
            logger.warning(
                f"Retry {entry.attempt} for shard {shard.shard_id} failed"
            )

        return success

    def get_queue_size(self) -> int:
        return len(self._queue)

    def get_pending_count(self) -> int:
        return sum(1 for e in self._queue.values() if e.status == "PENDING")

    def clear_queue(self) -> None:
        self._queue.clear()


class TaskManager:
    def __init__(
        self,
        rule_engine: RuleEngine,
        shard_manager: ShardManager,
        statistics: TranscodeStatistics,
    ):
        self._rule_engine = rule_engine
        self._shard_manager = shard_manager
        self._statistics = statistics
        self._tasks: Dict[str, TranscodeTask] = {}

    def create_task(
        self,
        input_path: str,
        resolutions: List[str],
        bitrates: Dict[str, int],
        retry_policy: Optional[RetryPolicy] = None,
    ) -> TranscodeTask:
        task = TranscodeTask.create(
            input_path=input_path,
            resolutions=resolutions,
            bitrates=bitrates,
            retry_policy=retry_policy,
        )
        self._tasks[task.task_id] = task
        self._statistics.total_tasks += 1
        logger.info(
            f"Created task {task.task_id}: "
            f"input={input_path}, resolutions={resolutions}"
        )
        return task

    def get_task(self, task_id: str) -> TranscodeTask:
        if task_id not in self._tasks:
            raise TaskNotFoundException(task_id)
        return self._tasks[task_id]

    def transition_status(
        self,
        task: TranscodeTask,
        new_status: TaskStatus,
    ) -> None:
        old_status = task.status
        rule = TaskStatusRule(old_status, new_status, task)
        result = self._rule_engine.evaluate(rule)

        if not result:
            raise InvalidStateTransitionException(
                task.task_id, old_status.name, new_status.name
            )

        task.status = new_status
        task.last_updated_at = datetime.now()
        logger.info(
            f"Task {task.task_id} status transition: "
            f"{old_status.name} -> {new_status.name}"
        )

    def initialize_task(self, task: TranscodeTask) -> None:
        self.transition_status(task, TaskStatus.INITIALIZING)
        task.started_at = datetime.now()

    def shard_task(self, task: TranscodeTask) -> None:
        self.transition_status(task, TaskStatus.SHARDING)

        for resolution in task.resolutions:
            bitrate = task.bitrates.get(resolution, 1000000)
            shard = self._shard_manager.create_shard(
                task=task,
                resolution=resolution,
                bitrate=bitrate,
                input_path=task.input_path,
            )
            self._shard_manager.transition_status(shard, ShardStatus.QUEUED)

        logger.info(
            f"Task {task.task_id} sharding complete: "
            f"created {len(task.shards)} shards"
        )

    def start_processing(self, task: TranscodeTask) -> None:
        self.transition_status(task, TaskStatus.PROCESSING)

    def start_validation(self, task: TranscodeTask) -> None:
        self.transition_status(task, TaskStatus.VALIDATING)

    def complete_task(self, task: TranscodeTask) -> None:
        completion_rule = TaskCompletionRule(task)
        result = self._rule_engine.evaluate(completion_rule)

        if not result:
            raise InvalidStateTransitionException(
                task.task_id, task.status.name, TaskStatus.COMPLETED.name
            )

        self.transition_status(task, TaskStatus.COMPLETED)
        task.completed_at = datetime.now()
        self._statistics.completed_tasks += 1
        logger.info(
            f"Task {task.task_id} completed successfully: "
            f"{task.completed_shards}/{task.total_shards} shards"
        )

    def fail_task(self, task: TranscodeTask, error: str) -> None:
        self.transition_status(task, TaskStatus.FAILED)
        task.failed_at = datetime.now()
        task.errors.append(error)
        self._statistics.failed_tasks += 1
        logger.error(
            f"Task {task.task_id} failed: {error}"
        )

    def list_tasks(self) -> List[TranscodeTask]:
        return list(self._tasks.values())

    def get_task_count(self) -> int:
        return len(self._tasks)


class TranscodeService:
    def __init__(
        self,
        executor: Optional[TranscodeExecutor] = None,
    ):
        self._rule_engine = RuleEngine()
        self._statistics = TranscodeStatistics()
        self._shard_manager = ShardManager(self._rule_engine, self._statistics)
        self._retry_scheduler = RetryScheduler(self._rule_engine, self._statistics)
        self._task_manager = TaskManager(
            self._rule_engine, self._shard_manager, self._statistics
        )
        self._executor = executor or MockTranscodeExecutor()

        self._register_rules()

    def _register_rules(self) -> None:
        sample_task = TranscodeTask.create("input", ["1080p"], {"1080p": 8000000})
        sample_shard = ResolutionShard.create(
            "task_id", "1080p", 8000000, "input"
        )
        sample_retry_policy = RetryPolicy()

        rules_to_register = [
            TaskStatusRule(TaskStatus.PENDING, TaskStatus.INITIALIZING),
            ShardStatusRule(ShardStatus.PENDING, ShardStatus.QUEUED),
            RetryRule(sample_shard, sample_retry_policy),
            RetryTimingRule(sample_shard, sample_retry_policy),
            TaskCompletionRule(sample_task),
            RollbackRule(sample_task),
        ]

        for rule in rules_to_register:
            self._rule_engine.register_rule(rule)

    def submit_transcode_task(
        self,
        input_path: str,
        resolutions: List[str],
        bitrates: Dict[str, int],
        retry_policy: Optional[RetryPolicy] = None,
    ) -> TranscodeTask:
        logger.info(
            f"Submitting transcode task: "
            f"input={input_path}, resolutions={resolutions}"
        )

        task = self._task_manager.create_task(
            input_path=input_path,
            resolutions=resolutions,
            bitrates=bitrates,
            retry_policy=retry_policy,
        )

        self._task_manager.initialize_task(task)
        self._task_manager.shard_task(task)
        self._task_manager.start_processing(task)

        return task

    def process_shard(
        self,
        shard: ResolutionShard,
        task: TranscodeTask,
    ) -> bool:
        logger.info(f"Processing shard {shard.shard_id}")
        self._shard_manager.mark_processing(shard)

        output_path = f"{shard.input_path}.{shard.resolution}.transcoded"

        try:
            success = self._executor.transcode(
                shard, shard.input_path, output_path
            )

            if success:
                validation_result = self.validate_product(shard, output_path)
                task.validation_results[shard.shard_id] = validation_result

                if validation_result.passed:
                    self._shard_manager.mark_success(shard, output_path)
                    return True
                else:
                    raise ValidationFailedException(
                        shard.shard_id,
                        ", ".join(validation_result.errors),
                    )
            else:
                raise RuntimeError("Transcode execution failed")

        except ValidationFailedException as e:
            logger.warning(f"Validation failed for shard {shard.shard_id}: {e}")
            self._handle_shard_failure(shard, task, RetryType.VALIDATION, str(e))
            return False
        except Exception as e:
            logger.error(f"Error processing shard {shard.shard_id}: {e}")
            self._handle_shard_failure(shard, task, RetryType.TRANSIENT, str(e))
            return False

    def _handle_shard_failure(
        self,
        shard: ResolutionShard,
        task: TranscodeTask,
        error_type: RetryType,
        error_message: str,
    ) -> None:
        try:
            self._shard_manager.schedule_retry(
                shard=shard,
                retry_policy=task.retry_policy,
                error_type=error_type,
                error_message=error_message,
            )
            self._retry_scheduler.queue_for_retry(
                shard=shard,
                error_type=error_type,
                reason=error_message,
            )
        except MaxRetriesExceededException:
            logger.error(
                f"Max retries exceeded for shard {shard.shard_id}, "
                f"triggering rollback"
            )
            self.rollback_task(task, f"Shard {shard.shard_id} exceeded max retries")

    def validate_product(
        self,
        shard: ResolutionShard,
        output_path: str,
    ) -> ProductValidationResult:
        file_info = self._executor.get_file_info(output_path)
        rule = ProductValidationRule(shard, file_info)
        result = self._rule_engine.evaluate_product_validation(rule)

        self._statistics.total_validation_checks += len(result.all_checks)
        self._statistics.passed_validations += len(result.passed_checks)
        self._statistics.failed_validations += len(result.failed_checks)

        if result.passed:
            logger.info(
                f"Product validation passed for shard {shard.shard_id}: "
                f"{len(result.passed_checks)}/{len(result.all_checks)} checks"
            )
        else:
            logger.warning(
                f"Product validation failed for shard {shard.shard_id}: "
                f"errors={result.errors}"
            )

        return result

    def rollback_task(
        self,
        task: TranscodeTask,
        reason: str,
    ) -> None:
        logger.warning(
            f"Starting rollback for task {task.task_id}: {reason}"
        )

        rollback_rule = RollbackRule(task, reason)
        result = self._rule_engine.evaluate(rollback_rule)

        if not result:
            raise RollbackFailedException(task.task_id, result.reason)

        self._task_manager.transition_status(task, TaskStatus.ROLLING_BACK)
        self._statistics.rollback_attempts += 1

        try:
            for shard in task.shards.values():
                if shard.status == ShardStatus.SUCCESS:
                    self._shard_manager.mark_rollback(shard)
                    logger.info(
                        f"Rolled back shard {shard.shard_id} "
                        f"(output={shard.output_path})"
                    )
                elif shard.status in [ShardStatus.QUEUED, ShardStatus.PROCESSING]:
                    self._shard_manager.mark_skipped(shard, "Task rollback")

            self._task_manager.fail_task(task, reason)
            self._statistics.successful_rollbacks += 1
            logger.info(
                f"Rollback completed successfully for task {task.task_id}"
            )
        except Exception as e:
            self._statistics.failed_rollbacks += 1
            raise RollbackFailedException(task.task_id, str(e)) from e

    def check_task_completion(self, task: TranscodeTask) -> bool:
        if task.all_shards_completed:
            self._task_manager.start_validation(task)
            self._task_manager.complete_task(task)
            return True
        return False

    def process_ready_retries(self) -> int:
        ready_entries = self._retry_scheduler.get_ready_entries()
        processed_count = 0

        for entry in ready_entries:
            try:
                task = self._task_manager.get_task(entry.task_id)
                shard = task.shards.get(entry.shard_id)

                if shard is None:
                    raise ShardNotFoundException(entry.shard_id)

                if shard.status != ShardStatus.QUEUED:
                    logger.info(
                        f"Skipping retry entry {entry.queue_id}: "
                        f"shard {shard.shard_id} is not in QUEUED state "
                        f"(current={shard.status.name})"
                    )
                    continue

                self._shard_manager.mark_processing(shard)

                success = self._retry_scheduler.execute_retry(
                    entry=entry,
                    shard=shard,
                    retry_policy=task.retry_policy,
                    executor=self._executor,
                )

                if success:
                    output_path = f"{shard.input_path}.{shard.resolution}.transcoded"
                    validation_result = self.validate_product(shard, output_path)

                    if validation_result.passed:
                        task.validation_results[shard.shard_id] = validation_result
                        self._shard_manager.mark_success(shard, output_path)
                    else:
                        self._handle_shard_failure(
                            shard, task, RetryType.VALIDATION,
                            ", ".join(validation_result.errors),
                        )
                else:
                    self._handle_shard_failure(
                        shard, task, entry.error_type,
                        entry.reason,
                    )

                processed_count += 1
            except Exception as e:
                logger.error(
                    f"Error processing retry entry {entry.queue_id}: {e}"
                )

        return processed_count

    def get_task(self, task_id: str) -> TranscodeTask:
        return self._task_manager.get_task(task_id)

    def list_tasks(self) -> List[TranscodeTask]:
        return self._task_manager.list_tasks()

    def get_statistics(self) -> TranscodeStatistics:
        return self._statistics

    def get_rule_history(self) -> List[Dict[str, Any]]:
        return self._rule_engine.get_history()

    def get_rule_definitions(self) -> Dict[str, Dict[str, Any]]:
        return self._rule_engine.get_rule_definitions()

    def get_queue_size(self) -> int:
        return self._retry_scheduler.get_queue_size()

    def get_pending_retry_count(self) -> int:
        return self._retry_scheduler.get_pending_count()
