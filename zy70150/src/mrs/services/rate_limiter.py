import time
import threading
from collections import deque
from typing import Optional

from ..exceptions import RateLimitExceededError


class TokenBucket:
    def __init__(self, rate: float, capacity: int):
        self.rate = rate
        self.capacity = capacity
        self.tokens = capacity
        self.last_update = time.time()
        self._lock = threading.Lock()

    def consume(self, tokens: int = 1) -> bool:
        with self._lock:
            now = time.time()
            elapsed = now - self.last_update
            self.tokens = min(self.capacity, self.tokens + elapsed * self.rate)
            self.last_update = now

            if self.tokens >= tokens:
                self.tokens -= tokens
                return True
            return False


class RateLimiter:
    def __init__(
        self,
        per_second: int = 10,
        per_minute: int = 300,
        per_hour: int = 10000,
    ):
        self.per_second = per_second
        self.per_minute = per_minute
        self.per_hour = per_hour

        self._second_bucket = TokenBucket(rate=per_second, capacity=per_second)
        self._minute_bucket = TokenBucket(rate=per_minute / 60, capacity=per_minute)
        self._hour_bucket = TokenBucket(rate=per_hour / 3600, capacity=per_hour)

        self._second_window = deque(maxlen=per_second)
        self._minute_window = deque(maxlen=per_minute)
        self._hour_window = deque(maxlen=per_hour)

        self._lock = threading.Lock()

    def acquire(self) -> bool:
        with self._lock:
            now = time.time()

            if not self._second_bucket.consume(1):
                raise RateLimitExceededError("每秒", self.per_second)

            if not self._minute_bucket.consume(1):
                raise RateLimitExceededError("每分钟", self.per_minute)

            if not self._hour_bucket.consume(1):
                raise RateLimitExceededError("每小时", self.per_hour)

            self._second_window.append(now)
            self._minute_window.append(now)
            self._hour_window.append(now)

            return True

    def wait(self) -> None:
        while True:
            try:
                self.acquire()
                return
            except RateLimitExceededError:
                time.sleep(0.1)

    def get_stats(self) -> dict:
        with self._lock:
            now = time.time()

            def count_in_window(window: deque, seconds: int) -> int:
                cutoff = now - seconds
                count = 0
                for ts in reversed(window):
                    if ts >= cutoff:
                        count += 1
                    else:
                        break
                return count

            return {
                "config": {
                    "per_second": self.per_second,
                    "per_minute": self.per_minute,
                    "per_hour": self.per_hour,
                },
                "current": {
                    "last_second": count_in_window(self._second_window, 1),
                    "last_minute": count_in_window(self._minute_window, 60),
                    "last_hour": count_in_window(self._hour_window, 3600),
                },
            }
