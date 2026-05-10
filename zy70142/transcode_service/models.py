from dataclasses import dataclass, field, asdict
from enum import Enum, auto
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import uuid4


class TaskStatus(Enum):
    PENDING = auto()
    INITIALIZING = auto()
    SHARDING = auto()
    PROCESSING = auto()
    VALIDATING = auto()
    ROLLING_BACK = auto()
    COMPLETED = auto()
    FAILED = auto()
    CANCELLED = auto()

    @classmethod
    def valid_transitions(cls) -> Dict["TaskStatus", List["TaskStatus"]]:
        return {
            cls.PENDING: [cls.INITIALIZING],
            cls.INITIALIZING: [cls.SHARDING],
            cls.SHARDING: [cls.PROCESSING],
            cls.PROCESSING: [cls.VALIDATING, cls.ROLLING_BACK, cls.FAILED],
            cls.VALIDATING: [cls.COMPLETED, cls.ROLLING_BACK, cls.FAILED],
            cls.ROLLING_BACK: [cls.FAILED, cls.CANCELLED],
            cls.COMPLETED: [],
            cls.FAILED: [],
            cls.CANCELLED: [],
        }

    def can_transition_to(self, target: "TaskStatus") -> bool:
        return target in self.valid_transitions().get(self, [])


class ShardStatus(Enum):
    PENDING = auto()
    QUEUED = auto()
    PROCESSING = auto()
    SUCCESS = auto()
    FAILED = auto()
    ROLLBACK = auto()
    SKIPPED = auto()

    @classmethod
    def valid_transitions(cls) -> Dict["ShardStatus", List["ShardStatus"]]:
        return {
            cls.PENDING: [cls.QUEUED],
            cls.QUEUED: [cls.PROCESSING, cls.SKIPPED],
            cls.PROCESSING: [cls.SUCCESS, cls.FAILED],
            cls.FAILED: [cls.QUEUED, cls.ROLLBACK, cls.SKIPPED],
            cls.SUCCESS: [cls.ROLLBACK],
            cls.ROLLBACK: [],
            cls.SKIPPED: [],
        }

    def can_transition_to(self, target: "ShardStatus") -> bool:
        return target in self.valid_transitions().get(self, [])


class RetryType(Enum):
    TRANSIENT = auto()
    NETWORK = auto()
    RESOURCE = auto()
    VALIDATION = auto()
    UNKNOWN = auto()


@dataclass
class RetryPolicy:
    max_retries: int = 3
    initial_delay_seconds: int = 5
    max_delay_seconds: int = 300
    backoff_multiplier: float = 2.0
    jitter_seconds: int = 1
    retryable_error_types: List[RetryType] = field(
        default_factory=lambda: [
            RetryType.TRANSIENT,
            RetryType.NETWORK,
            RetryType.RESOURCE,
        ]
    )

    def calculate_backoff(self, attempt_number: int) -> float:
        delay = self.initial_delay_seconds * (
            self.backoff_multiplier ** (attempt_number - 1)
        )
        return min(delay, self.max_delay_seconds)


@dataclass
class ResolutionShard:
    shard_id: str
    task_id: str
    resolution: str
    bitrate: int
    input_path: str
    output_path: Optional[str] = None
    status: ShardStatus = ShardStatus.PENDING
    retry_count: int = 0
    max_retries: int = 3
    last_error: Optional[str] = None
    error_type: Optional[RetryType] = None
    created_at: datetime = field(default_factory=datetime.now)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    failed_at: Optional[datetime] = None
    next_retry_at: Optional[datetime] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def can_retry(self, retry_policy: RetryPolicy) -> bool:
        if self.retry_count >= self.max_retries:
            return False
        if self.error_type and self.error_type not in retry_policy.retryable_error_types:
            return False
        return True

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["status"] = self.status.name
        if self.error_type:
            data["error_type"] = self.error_type.name
        return data

    @classmethod
    def create(
        cls,
        task_id: str,
        resolution: str,
        bitrate: int,
        input_path: str,
        max_retries: int = 3,
    ) -> "ResolutionShard":
        return cls(
            shard_id=str(uuid4()),
            task_id=task_id,
            resolution=resolution,
            bitrate=bitrate,
            input_path=input_path,
            max_retries=max_retries,
        )


@dataclass
class RetryQueueEntry:
    queue_id: str
    shard_id: str
    task_id: str
    attempt: int
    scheduled_at: datetime
    error_type: RetryType
    reason: str
    status: str = "PENDING"
    executed_at: Optional[datetime] = None

    @classmethod
    def create(
        cls,
        shard_id: str,
        task_id: str,
        attempt: int,
        scheduled_at: datetime,
        error_type: RetryType,
        reason: str,
    ) -> "RetryQueueEntry":
        return cls(
            queue_id=str(uuid4()),
            shard_id=shard_id,
            task_id=task_id,
            attempt=attempt,
            scheduled_at=scheduled_at,
            error_type=error_type,
            reason=reason,
        )


@dataclass
class ProductValidationResult:
    shard_id: str
    passed: bool
    checks: Dict[str, bool]
    errors: List[str]
    warnings: List[str]
    validated_at: datetime = field(default_factory=datetime.now)

    @property
    def all_checks(self) -> List[str]:
        return list(self.checks.keys())

    @property
    def failed_checks(self) -> List[str]:
        return [k for k, v in self.checks.items() if not v]

    @property
    def passed_checks(self) -> List[str]:
        return [k for k, v in self.checks.items() if v]


@dataclass
class TranscodeTask:
    task_id: str
    input_path: str
    resolutions: List[str]
    bitrates: Dict[str, int]
    status: TaskStatus = TaskStatus.PENDING
    shards: Dict[str, ResolutionShard] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    failed_at: Optional[datetime] = None
    last_updated_at: datetime = field(default_factory=datetime.now)
    retry_policy: RetryPolicy = field(default_factory=RetryPolicy)
    validation_results: Dict[str, ProductValidationResult] = field(default_factory=dict)
    errors: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    @property
    def total_shards(self) -> int:
        return len(self.shards)

    @property
    def completed_shards(self) -> int:
        return sum(
            1 for s in self.shards.values() if s.status == ShardStatus.SUCCESS
        )

    @property
    def failed_shards(self) -> int:
        return sum(
            1 for s in self.shards.values() if s.status == ShardStatus.FAILED
        )

    @property
    def processing_shards(self) -> int:
        return sum(
            1 for s in self.shards.values()
            if s.status in [ShardStatus.QUEUED, ShardStatus.PROCESSING]
        )

    @property
    def progress_percentage(self) -> float:
        if self.total_shards == 0:
            return 0.0
        return (self.completed_shards / self.total_shards) * 100

    @property
    def all_shards_completed(self) -> bool:
        return all(
            s.status == ShardStatus.SUCCESS for s in self.shards.values()
        )

    @property
    def any_shard_failed(self) -> bool:
        return any(
            s.status == ShardStatus.FAILED for s in self.shards.values()
        )

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["status"] = self.status.name
        data["shards"] = {k: v.to_dict() for k, v in self.shards.items()}
        data["progress_percentage"] = self.progress_percentage
        data["total_shards"] = self.total_shards
        data["completed_shards"] = self.completed_shards
        data["failed_shards"] = self.failed_shards
        return data

    @classmethod
    def create(
        cls,
        input_path: str,
        resolutions: List[str],
        bitrates: Dict[str, int],
        retry_policy: Optional[RetryPolicy] = None,
    ) -> "TranscodeTask":
        return cls(
            task_id=str(uuid4()),
            input_path=input_path,
            resolutions=resolutions,
            bitrates=bitrates,
            retry_policy=retry_policy or RetryPolicy(),
        )


@dataclass
class TranscodeStatistics:
    total_tasks: int = 0
    completed_tasks: int = 0
    failed_tasks: int = 0
    cancelled_tasks: int = 0
    total_shards: int = 0
    successful_shards: int = 0
    failed_shards: int = 0
    retried_shards: int = 0
    total_validation_checks: int = 0
    passed_validations: int = 0
    failed_validations: int = 0
    rollback_attempts: int = 0
    successful_rollbacks: int = 0
    failed_rollbacks: int = 0

    @property
    def task_success_rate(self) -> float:
        if self.total_tasks == 0:
            return 0.0
        return (self.completed_tasks / self.total_tasks) * 100

    @property
    def shard_success_rate(self) -> float:
        if self.total_shards == 0:
            return 0.0
        return (self.successful_shards / self.total_shards) * 100

    @property
    def validation_success_rate(self) -> float:
        if self.total_validation_checks == 0:
            return 0.0
        return (self.passed_validations / self.total_validation_checks) * 100

    def to_dict(self) -> Dict[str, Any]:
        return {
            **asdict(self),
            "task_success_rate": self.task_success_rate,
            "shard_success_rate": self.shard_success_rate,
            "validation_success_rate": self.validation_success_rate,
        }
