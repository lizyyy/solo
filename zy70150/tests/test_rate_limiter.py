import time
import threading

from mrs.services import RateLimiter, TokenBucket
from mrs.exceptions import RateLimitExceededError


class TestTokenBucket:
    def test_bucket_initial_state(self):
        bucket = TokenBucket(rate=10, capacity=10)
        
        assert bucket.rate == 10
        assert bucket.capacity == 10
        assert bucket.tokens == 10

    def test_consume_sufficient_tokens(self):
        bucket = TokenBucket(rate=10, capacity=10)
        
        assert bucket.consume(5) is True
        assert bucket.tokens == 5

    def test_consume_insufficient_tokens(self):
        bucket = TokenBucket(rate=1, capacity=1)
        
        assert bucket.consume(1) is True
        assert bucket.consume(1) is False

    def test_token_refill_over_time(self):
        bucket = TokenBucket(rate=10, capacity=10)
        bucket.tokens = 0
        bucket.last_update = time.time() - 1
        
        assert bucket.consume(1) is True
        assert bucket.tokens > 0


class TestRateLimiter:
    def test_initialization(self):
        limiter = RateLimiter(per_second=5, per_minute=300, per_hour=10000)
        
        assert limiter.per_second == 5
        assert limiter.per_minute == 300
        assert limiter.per_hour == 10000

    def test_acquire_success(self):
        limiter = RateLimiter(per_second=100, per_minute=1000, per_hour=10000)
        
        for _ in range(10):
            assert limiter.acquire() is True

    def test_wait_method(self):
        limiter = RateLimiter(per_second=100, per_minute=1000, per_hour=10000)
        
        limiter.wait()

    def test_get_stats(self):
        limiter = RateLimiter(per_second=10, per_minute=100, per_hour=1000)
        
        for _ in range(5):
            limiter.acquire()
        
        stats = limiter.get_stats()
        
        assert stats["config"]["per_second"] == 10
        assert stats["config"]["per_minute"] == 100
        assert stats["current"]["last_second"] >= 0
        assert stats["current"]["last_minute"] >= 0
        assert stats["current"]["last_hour"] >= 0

    def test_thread_safety(self):
        limiter = RateLimiter(per_second=100, per_minute=1000, per_hour=10000)
        
        errors = []
        
        def worker():
            try:
                for _ in range(10):
                    limiter.acquire()
            except Exception as e:
                errors.append(e)
        
        threads = [threading.Thread(target=worker) for _ in range(3)]
        
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        
        assert len(errors) == 0
