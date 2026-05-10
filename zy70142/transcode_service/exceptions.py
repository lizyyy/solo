class TranscodeException(Exception):
    pass


class TaskNotFoundException(TranscodeException):
    def __init__(self, task_id: str):
        super().__init__(f"Task not found: {task_id}")
        self.task_id = task_id


class ShardNotFoundException(TranscodeException):
    def __init__(self, shard_id: str):
        super().__init__(f"Shard not found: {shard_id}")
        self.shard_id = shard_id


class ValidationFailedException(TranscodeException):
    def __init__(self, shard_id: str, reason: str):
        super().__init__(f"Validation failed for shard {shard_id}: {reason}")
        self.shard_id = shard_id
        self.reason = reason


class RollbackFailedException(TranscodeException):
    def __init__(self, task_id: str, reason: str):
        super().__init__(f"Rollback failed for task {task_id}: {reason}")
        self.task_id = task_id
        self.reason = reason


class MaxRetriesExceededException(TranscodeException):
    def __init__(self, shard_id: str, max_retries: int):
        super().__init__(f"Max retries exceeded for shard {shard_id}: {max_retries}")
        self.shard_id = shard_id
        self.max_retries = max_retries


class InvalidStateTransitionException(TranscodeException):
    def __init__(self, entity_id: str, from_state: str, to_state: str):
        super().__init__(
            f"Invalid state transition for {entity_id}: {from_state} -> {to_state}"
        )
        self.entity_id = entity_id
        self.from_state = from_state
        self.to_state = to_state
