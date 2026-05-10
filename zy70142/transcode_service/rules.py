from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Callable, Set
from datetime import datetime, timedelta

from .models import (
    TaskStatus,
    ShardStatus,
    RetryType,
    RetryPolicy,
    ResolutionShard,
    TranscodeTask,
    ProductValidationResult,
)


@dataclass
class RuleResult:
    passed: bool
    reason: str
    evidence: Dict[str, Any]
    rule_name: str

    def __bool__(self) -> bool:
        return self.passed


class BusinessRule(ABC):
    name: str = "unnamed_rule"

    @abstractmethod
    def evaluate(self, *args, **kwargs) -> RuleResult:
        pass

    @abstractmethod
    def get_description(self) -> str:
        pass

    @property
    def metadata(self) -> Dict[str, Any]:
        return {
            "rule_name": self.name,
            "description": self.get_description(),
        }


class TaskStatusRule(BusinessRule):
    name = "task_status_transition_rule"

    def __init__(
        self,
        from_status: TaskStatus,
        to_status: TaskStatus,
        task: Optional[TranscodeTask] = None,
    ):
        self.from_status = from_status
        self.to_status = to_status
        self.task = task

    def get_description(self) -> str:
        return (
            f"Validates that a task can transition from {self.from_status.name} "
            f"to {self.to_status.name} based on the state machine rules."
        )

    def evaluate(self, *args, **kwargs) -> RuleResult:
        evidence = {
            "from_status": self.from_status.name,
            "to_status": self.to_status.name,
            "valid_transitions": [
                s.name for s in TaskStatus.valid_transitions().get(self.from_status, [])
            ],
        }

        if self.from_status.can_transition_to(self.to_status):
            return RuleResult(
                passed=True,
                reason=f"Valid transition: {self.from_status.name} -> {self.to_status.name}",
                evidence=evidence,
                rule_name=self.name,
            )

        return RuleResult(
            passed=False,
            reason=(
                f"Invalid state transition: {self.from_status.name} cannot "
                f"transition to {self.to_status.name}"
            ),
            evidence=evidence,
            rule_name=self.name,
        )


class ShardStatusRule(BusinessRule):
    name = "shard_status_transition_rule"

    def __init__(
        self,
        from_status: ShardStatus,
        to_status: ShardStatus,
        shard: Optional[ResolutionShard] = None,
    ):
        self.from_status = from_status
        self.to_status = to_status
        self.shard = shard

    def get_description(self) -> str:
        return (
            f"Validates that a shard can transition from {self.from_status.name} "
            f"to {self.to_status.name} based on the state machine rules."
        )

    def evaluate(self, *args, **kwargs) -> RuleResult:
        evidence = {
            "from_status": self.from_status.name,
            "to_status": self.to_status.name,
            "valid_transitions": [
                s.name for s in ShardStatus.valid_transitions().get(self.from_status, [])
            ],
        }

        if self.from_status.can_transition_to(self.to_status):
            return RuleResult(
                passed=True,
                reason=f"Valid transition: {self.from_status.name} -> {self.to_status.name}",
                evidence=evidence,
                rule_name=self.name,
            )

        return RuleResult(
            passed=False,
            reason=(
                f"Invalid state transition: {self.from_status.name} cannot "
                f"transition to {self.to_status.name}"
            ),
            evidence=evidence,
            rule_name=self.name,
        )


class RetryRule(BusinessRule):
    name = "shard_retry_rule"

    def __init__(
        self,
        shard: ResolutionShard,
        retry_policy: RetryPolicy,
    ):
        self.shard = shard
        self.retry_policy = retry_policy

    def get_description(self) -> str:
        return (
            "Validates that a shard can be retried based on: "
            "1. Retry count hasn't exceeded max_retries, "
            "2. Error type is in the list of retryable error types."
        )

    def evaluate(self, *args, **kwargs) -> RuleResult:
        evidence = {
            "shard_id": self.shard.shard_id,
            "current_retry_count": self.shard.retry_count,
            "max_retries": self.shard.max_retries,
            "error_type": self.shard.error_type.name if self.shard.error_type else None,
            "retryable_error_types": [
                t.name for t in self.retry_policy.retryable_error_types
            ],
        }

        if self.shard.retry_count >= self.shard.max_retries:
            return RuleResult(
                passed=False,
                reason=(
                    f"Retry count ({self.shard.retry_count}) has exceeded "
                    f"max retries ({self.shard.max_retries})"
                ),
                evidence=evidence,
                rule_name=self.name,
            )

        if self.shard.error_type and self.shard.error_type not in self.retry_policy.retryable_error_types:
            return RuleResult(
                passed=False,
                reason=(
                    f"Error type {self.shard.error_type.name} is not in "
                    f"retryable error types"
                ),
                evidence=evidence,
                rule_name=self.name,
            )

        return RuleResult(
            passed=True,
            reason="Shard is eligible for retry",
            evidence=evidence,
            rule_name=self.name,
        )


class RetryTimingRule(BusinessRule):
    name = "retry_timing_rule"

    def __init__(
        self,
        shard: ResolutionShard,
        retry_policy: RetryPolicy,
        current_time: Optional[datetime] = None,
    ):
        self.shard = shard
        self.retry_policy = retry_policy
        self.current_time = current_time or datetime.now()

    def get_description(self) -> str:
        return (
            "Validates that a scheduled retry can be executed based on the "
            "exponential backoff schedule. The retry can only be executed "
            "when current time is >= next_retry_at."
        )

    def evaluate(self, *args, **kwargs) -> RuleResult:
        if self.shard.next_retry_at is None:
            return RuleResult(
                passed=True,
                reason="No retry scheduled, can retry immediately",
                evidence={
                    "shard_id": self.shard.shard_id,
                    "next_retry_at": None,
                    "current_time": self.current_time.isoformat(),
                },
                rule_name=self.name,
            )

        evidence = {
            "shard_id": self.shard.shard_id,
            "next_retry_at": self.shard.next_retry_at.isoformat(),
            "current_time": self.current_time.isoformat(),
            "backoff_seconds": self.retry_policy.calculate_backoff(
                self.shard.retry_count + 1
            ),
        }

        if self.current_time >= self.shard.next_retry_at:
            return RuleResult(
                passed=True,
                reason="Retry scheduled time has passed, can execute retry",
                evidence=evidence,
                rule_name=self.name,
            )

        wait_seconds = (self.shard.next_retry_at - self.current_time).total_seconds()
        return RuleResult(
            passed=False,
            reason=f"Retry not yet scheduled. Wait {wait_seconds:.1f} seconds",
            evidence={
                **evidence,
                "wait_seconds": wait_seconds,
            },
            rule_name=self.name,
        )


class ProductValidationRule(BusinessRule):
    name = "product_validation_rule"

    REQUIRED_CHECKS = {
        "file_exists": "输出文件必须存在",
        "min_file_size": "输出文件大小必须大于 0",
        "can_open": "输出文件必须可以被打开读取",
    }

    OPTIONAL_CHECKS = {
        "metadata_valid": "元数据校验（可选）",
        "duration_match": "时长匹配校验（可选）",
        "resolution_match": "分辨率匹配校验（可选）",
    }

    def __init__(
        self,
        shard: ResolutionShard,
        file_info: Dict[str, Any],
        required_checks: Optional[Set[str]] = None,
    ):
        self.shard = shard
        self.file_info = file_info
        self.required_checks = required_checks or set(self.REQUIRED_CHECKS.keys())

    def get_description(self) -> str:
        return (
            "Validates that the transcoded output product meets quality "
            "standards. Required checks: file existence, minimum file size, "
            "and file accessibility."
        )

    def _check_file_exists(self) -> bool:
        return self.file_info.get("exists", False)

    def _check_min_file_size(self) -> bool:
        size = self.file_info.get("size", 0)
        return size > 0

    def _check_can_open(self) -> bool:
        return self.file_info.get("can_open", False)

    def _check_metadata_valid(self) -> bool:
        return self.file_info.get("metadata_valid", True)

    def _check_duration_match(self) -> bool:
        expected = self.file_info.get("expected_duration")
        actual = self.file_info.get("actual_duration")
        if expected is None or actual is None:
            return True
        tolerance = self.file_info.get("duration_tolerance", 0.5)
        return abs(expected - actual) <= tolerance

    def _check_resolution_match(self) -> bool:
        expected = self.file_info.get("expected_resolution")
        actual = self.file_info.get("actual_resolution")
        if expected is None or actual is None:
            return True
        return expected == actual

    def evaluate(self, *args, **kwargs) -> ProductValidationResult:
        checks: Dict[str, bool] = {}
        errors: List[str] = []
        warnings: List[str] = []

        check_methods = {
            "file_exists": self._check_file_exists,
            "min_file_size": self._check_min_file_size,
            "can_open": self._check_can_open,
            "metadata_valid": self._check_metadata_valid,
            "duration_match": self._check_duration_match,
            "resolution_match": self._check_resolution_match,
        }

        all_checks = {**self.REQUIRED_CHECKS, **self.OPTIONAL_CHECKS}
        for check_name, check_method in check_methods.items():
            if check_name not in all_checks:
                continue

            result = check_method()
            checks[check_name] = result

            if check_name in self.required_checks:
                if not result:
                    check_desc = self.REQUIRED_CHECKS.get(
                        check_name,
                        self.OPTIONAL_CHECKS.get(check_name, check_name),
                    )
                    errors.append(f"[{check_name}] {check_desc}: FAILED")
            elif check_name in self.OPTIONAL_CHECKS:
                if not result:
                    warnings.append(
                        f"[{check_name}] {self.OPTIONAL_CHECKS[check_name]}: FAILED"
                    )

        all_required_passed = all(
            checks.get(name, False) for name in self.required_checks
        )

        return ProductValidationResult(
            shard_id=self.shard.shard_id,
            passed=all_required_passed,
            checks=checks,
            errors=errors,
            warnings=warnings,
        )


class TaskCompletionRule(BusinessRule):
    name = "task_completion_rule"

    def __init__(self, task: TranscodeTask):
        self.task = task

    def get_description(self) -> str:
        return (
            "Validates that a task can be marked as complete. A task can only "
            "complete when ALL shards have status SUCCESS."
        )

    def evaluate(self, *args, **kwargs) -> RuleResult:
        shard_statuses = {
            s.shard_id: s.status.name for s in self.task.shards.values()
        }

        evidence = {
            "task_id": self.task.task_id,
            "total_shards": self.task.total_shards,
            "completed_shards": self.task.completed_shards,
            "failed_shards": self.task.failed_shards,
            "processing_shards": self.task.processing_shards,
            "all_shard_statuses": shard_statuses,
        }

        if self.task.total_shards == 0:
            return RuleResult(
                passed=False,
                reason="Task has no shards - cannot complete an empty task",
                evidence=evidence,
                rule_name=self.name,
            )

        if self.task.any_shard_failed:
            return RuleResult(
                passed=False,
                reason=f"Task has {self.task.failed_shards} failed shard(s)",
                evidence=evidence,
                rule_name=self.name,
            )

        if self.task.processing_shards > 0:
            return RuleResult(
                passed=False,
                reason=f"Task has {self.task.processing_shards} shard(s) still processing",
                evidence=evidence,
                rule_name=self.name,
            )

        if self.task.all_shards_completed:
            return RuleResult(
                passed=True,
                reason="All shards completed successfully",
                evidence=evidence,
                rule_name=self.name,
            )

        return RuleResult(
            passed=False,
            reason="Not all shards are in SUCCESS state",
            evidence=evidence,
            rule_name=self.name,
        )


class RollbackRule(BusinessRule):
    name = "rollback_rule"

    def __init__(
        self,
        task: TranscodeTask,
        error_context: Optional[str] = None,
    ):
        self.task = task
        self.error_context = error_context

    def get_description(self) -> str:
        return (
            "Validates that a task can enter rollback state. A task can only "
            "rollback from PROCESSING or VALIDATING states when any shard "
            "has failed or validation has failed."
        )

    def evaluate(self, *args, **kwargs) -> RuleResult:
        evidence = {
            "task_id": self.task.task_id,
            "current_status": self.task.status.name,
            "can_transition_to_rolling_back": (
                self.task.status.can_transition_to(TaskStatus.ROLLING_BACK)
            ),
            "any_shard_failed": self.task.any_shard_failed,
            "failed_shards": self.task.failed_shards,
            "error_context": self.error_context,
        }

        if not self.task.status.can_transition_to(TaskStatus.ROLLING_BACK):
            return RuleResult(
                passed=False,
                reason=f"Task in {self.task.status.name} cannot transition to ROLLING_BACK",
                evidence=evidence,
                rule_name=self.name,
            )

        if self.task.any_shard_failed:
            return RuleResult(
                passed=True,
                reason=f"Rollback triggered: {self.task.failed_shards} shard(s) failed",
                evidence=evidence,
                rule_name=self.name,
            )

        if self.error_context:
            return RuleResult(
                passed=True,
                reason=f"Rollback triggered: {self.error_context}",
                evidence=evidence,
                rule_name=self.name,
            )

        return RuleResult(
            passed=False,
            reason="No valid reason to trigger rollback",
            evidence=evidence,
            rule_name=self.name,
        )


class RuleEngine:
    def __init__(self):
        self._history: List[Dict[str, Any]] = []
        self._rule_definitions: Dict[str, Dict[str, Any]] = {}

    def register_rule(self, rule: BusinessRule) -> None:
        self._rule_definitions[rule.name] = rule.metadata

    def evaluate(
        self,
        rule: BusinessRule,
        record_history: bool = True,
    ) -> RuleResult:
        result = rule.evaluate()

        if record_history:
            history_entry = {
                "timestamp": datetime.now().isoformat(),
                "rule_name": rule.name,
                "rule_metadata": rule.metadata,
                "result": {
                    "passed": bool(result),
                    "reason": result.reason,
                    "evidence": result.evidence,
                },
            }
            self._history.append(history_entry)

        return result

    def evaluate_product_validation(
        self,
        rule: ProductValidationRule,
        record_history: bool = True,
    ) -> ProductValidationResult:
        result = rule.evaluate()

        if record_history:
            history_entry = {
                "timestamp": datetime.now().isoformat(),
                "rule_name": rule.name,
                "rule_metadata": rule.metadata,
                "result": {
                    "passed": result.passed,
                    "checks": result.checks,
                    "errors": result.errors,
                    "warnings": result.warnings,
                },
            }
            self._history.append(history_entry)

        return result

    def get_history(self, rule_name: Optional[str] = None) -> List[Dict[str, Any]]:
        if rule_name:
            return [
                h for h in self._history if h.get("rule_name") == rule_name
            ]
        return self._history

    def get_rule_definitions(self) -> Dict[str, Dict[str, Any]]:
        return self._rule_definitions

    def clear_history(self) -> None:
        self._history.clear()
