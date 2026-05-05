from datetime import datetime, timedelta

import pytest

from cache_forensics.cache import BloomFilter, Database, LocalCache, MutexLock, RedisCache
from cache_forensics.models import CachePolicy


class TestBloomFilter:
    def test_add_and_check(self):
        bf = BloomFilter(size=1000, hash_count=3)
        bf.add("test-key")
        assert bf.might_contain("test-key") is True
        assert bf.might_contain("non-existent-key") is False

    def test_multiple_keys(self):
        bf = BloomFilter(size=1000, hash_count=3)
        keys = [f"key-{i}" for i in range(100)]
        for key in keys:
            bf.add(key)
        for key in keys:
            assert bf.might_contain(key) is True


class TestMutexLock:
    def test_acquire_and_release(self):
        lock = MutexLock()
        assert lock.acquire("key-1") is True
        assert lock.acquire("key-1") is False
        lock.release("key-1")
        assert lock.acquire("key-1") is True

    def test_multiple_keys(self):
        lock = MutexLock()
        assert lock.acquire("key-1") is True
        assert lock.acquire("key-2") is True
        assert lock.acquire("key-1") is False


class TestLocalCache:
    def test_set_and_get(self):
        policy = CachePolicy(name="test", ttl_seconds=300)
        cache = LocalCache(policy=policy)
        now = datetime.now()

        cache.set("key-1", "value-1", now)
        entry, hit = cache.get("key-1", now)

        assert hit is True
        assert entry is not None
        assert entry.value == "value-1"

    def test_get_miss(self):
        policy = CachePolicy(name="test", ttl_seconds=300)
        cache = LocalCache(policy=policy)
        now = datetime.now()

        entry, hit = cache.get("non-existent", now)
        assert hit is False
        assert entry is None

    def test_expired_entry(self):
        policy = CachePolicy(name="test", ttl_seconds=1)
        cache = LocalCache(policy=policy)
        past = datetime.now() - timedelta(hours=1)
        now = datetime.now()

        cache.set("key-1", "value-1", past)
        entry, hit = cache.get("key-1", now)

        assert hit is False
        assert entry is None

    def test_delete(self):
        policy = CachePolicy(name="test", ttl_seconds=300)
        cache = LocalCache(policy=policy)
        now = datetime.now()

        cache.set("key-1", "value-1", now)
        assert cache.delete("key-1") is True
        entry, hit = cache.get("key-1", now)
        assert hit is False

    def test_delete_nonexistent(self):
        policy = CachePolicy(name="test", ttl_seconds=300)
        cache = LocalCache(policy=policy)
        assert cache.delete("non-existent") is False

    def test_with_bloom_filter(self):
        policy = CachePolicy(name="test", ttl_seconds=300, bloom_filter_enabled=True)
        cache = LocalCache(policy=policy)
        now = datetime.now()

        cache.set("key-1", "value-1", now)
        entry, hit = cache.get("key-1", now)
        assert hit is True

        entry, hit = cache.get("non-existent", now)
        assert hit is False

    def test_access_count(self):
        policy = CachePolicy(name="test", ttl_seconds=300)
        cache = LocalCache(policy=policy)
        now = datetime.now()

        cache.set("key-1", "value-1", now)
        cache.get("key-1", now)
        cache.get("key-1", now)
        entry, hit = cache.get("key-1", now)

        assert entry is not None
        assert entry.access_count == 3


class TestRedisCache:
    def test_set_and_get(self):
        policy = CachePolicy(name="test", ttl_seconds=300)
        cache = RedisCache(policy=policy)
        now = datetime.now()

        cache.set("key-1", "value-1", now)
        entry, hit = cache.get("key-1", now)

        assert hit is True
        assert entry is not None
        assert entry.value == "value-1"

    def test_ttl_jitter(self):
        policy = CachePolicy(name="test", ttl_seconds=300, ttl_jitter_seconds=60)
        cache = RedisCache(policy=policy)
        now = datetime.now()

        entry = cache.set("key-1", "value-1", now)
        min_expiry = now + timedelta(seconds=300)
        max_expiry = now + timedelta(seconds=360)

        assert entry.expires_at is not None
        assert min_expiry <= entry.expires_at <= max_expiry


class TestDatabase:
    def test_set_and_get(self):
        db = Database()
        now = datetime.now()

        version = db.set("key-1", "value-1", now)
        value, got_version = db.get("key-1")

        assert value == "value-1"
        assert got_version == version

    def test_get_miss(self):
        db = Database()
        value, version = db.get("non-existent")
        assert value is None
        assert version == 0

    def test_delete(self):
        db = Database()
        now = datetime.now()

        db.set("key-1", "value-1", now)
        assert db.delete("key-1") is True
        value, _ = db.get("key-1")
        assert value is None

    def test_version_increment(self):
        db = Database()
        now = datetime.now()

        v1 = db.set("key-1", "value-1", now)
        v2 = db.set("key-1", "value-2", now)

        assert v2 > v1

    def test_get_version(self):
        db = Database()
        now = datetime.now()

        assert db.get_version("non-existent") == 0
        version = db.set("key-1", "value-1", now)
        assert db.get_version("key-1") == version
