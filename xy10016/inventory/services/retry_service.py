import time
import logging
from typing import Callable, Any, Tuple, Optional
from functools import wraps

from inventory.config import MAX_RETRY_ATTEMPTS, RETRY_DELAY

logger = logging.getLogger(__name__)


class RetryPolicy:
    def __init__(
        self,
        max_attempts: int = MAX_RETRY_ATTEMPTS,
        delay: float = RETRY_DELAY,
        backoff: bool = True,
        exceptions: Tuple[type, ...] = (Exception,)
    ):
        self.max_attempts = max_attempts
        self.delay = delay
        self.backoff = backoff
        self.exceptions = exceptions

    def execute(
        self,
        func: Callable,
        *args,
        on_retry: Optional[Callable[[int, Exception], None]] = None,
        **kwargs
    ) -> Any:
        last_exception = None

        for attempt in range(1, self.max_attempts + 1):
            try:
                return func(*args, **kwargs)
            except self.exceptions as e:
                last_exception = e
                if attempt >= self.max_attempts:
                    logger.error(f"Max retries ({self.max_attempts}) exceeded. Final error: {e}")
                    raise

                wait_time = self.delay * (2 ** (attempt - 1)) if self.backoff else self.delay

                logger.warning(
                    f"Attempt {attempt}/{self.max_attempts} failed. "
                    f"Retrying in {wait_time}s. Error: {e}"
                )

                if on_retry:
                    on_retry(attempt, e)

                time.sleep(wait_time)

        raise last_exception


def with_retry(
    max_attempts: int = MAX_RETRY_ATTEMPTS,
    delay: float = RETRY_DELAY,
    backoff: bool = True,
    exceptions: Tuple[type, ...] = (Exception,)
):
    def decorator(func: Callable):
        @wraps(func)
        def wrapper(*args, **kwargs):
            policy = RetryPolicy(max_attempts, delay, backoff, exceptions)
            return policy.execute(func, *args, **kwargs)
        return wrapper
    return decorator


class RecoveryService:
    def __init__(self, audit_service=None):
        self.audit_service = audit_service
        self.failed_operations = []

    def record_failure(
        self,
        operation_id: str,
        operation_type: str,
        data: dict,
        error: str,
        step: str = None
    ):
        failure = {
            'operation_id': operation_id,
            'operation_type': operation_type,
            'data': data,
            'error': error,
            'step': step,
            'timestamp': time.time()
        }
        self.failed_operations.append(failure)

        if self.audit_service:
            self.audit_service.log_error(
                action='OPERATION_FAILED',
                resource_type=operation_type,
                resource_id=operation_id,
                error_message=f"{step}: {error}" if step else error
            )

        return failure

    def get_failed_operations(self, operation_type: str = None):
        if operation_type:
            return [f for f in self.failed_operations if f['operation_type'] == operation_type]
        return self.failed_operations

    def recover(self, operation_id: str, retry_func: Callable) -> Tuple[bool, Any]:
        failure = next(
            (f for f in self.failed_operations if f['operation_id'] == operation_id),
            None
        )

        if not failure:
            return False, "Operation not found in failure list"

        try:
            result = retry_func(failure['data'])
            self.failed_operations = [
                f for f in self.failed_operations
                if f['operation_id'] != operation_id
            ]
            return True, result
        except Exception as e:
            failure['error'] = str(e)
            failure['retry_count'] = failure.get('retry_count', 0) + 1
            return False, str(e)

    def recover_all(self, operation_type: str, retry_func: Callable) -> dict:
        failures = self.get_failed_operations(operation_type)
        results = {
            'total': len(failures),
            'success': 0,
            'failed': 0,
            'details': []
        }

        for failure in failures[:]:
            success, result = self.recover(failure['operation_id'], retry_func)
            if success:
                results['success'] += 1
            else:
                results['failed'] += 1
            results['details'].append({
                'operation_id': failure['operation_id'],
                'success': success,
                'result': result
            })

        return results
