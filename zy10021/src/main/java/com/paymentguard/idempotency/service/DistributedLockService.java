package com.paymentguard.idempotency.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class DistributedLockService {

    private final RedisTemplate<String, Object> redisTemplate;

    private static final String LOCK_PREFIX = "lock:";
    private static final String LOCK_VALUE = "LOCKED";

    public boolean tryLock(String key, long timeout, TimeUnit unit) {
        String lockKey = LOCK_PREFIX + key;
        Boolean acquired = redisTemplate.opsForValue()
                .setIfAbsent(lockKey, LOCK_VALUE, Duration.ofMillis(unit.toMillis(timeout)));
        
        if (Boolean.TRUE.equals(acquired)) {
            log.debug("Lock acquired: key={}", lockKey);
            return true;
        } else {
            log.debug("Lock acquisition failed: key={}", lockKey);
            return false;
        }
    }

    public boolean tryLock(String key) {
        return tryLock(key, 30, TimeUnit.SECONDS);
    }

    public boolean tryLockWithRetry(String key, long timeout, TimeUnit unit, int retryCount, long retryDelayMs) {
        for (int i = 0; i < retryCount; i++) {
            if (tryLock(key, timeout, unit)) {
                return true;
            }
            try {
                Thread.sleep(retryDelayMs);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return false;
            }
        }
        return false;
    }

    public void releaseLock(String key) {
        String lockKey = LOCK_PREFIX + key;
        redisTemplate.delete(lockKey);
        log.debug("Lock released: key={}", lockKey);
    }

    public boolean isLocked(String key) {
        String lockKey = LOCK_PREFIX + key;
        return Boolean.TRUE.equals(redisTemplate.hasKey(lockKey));
    }

    public <T> T executeWithLock(String key, long timeout, TimeUnit unit, LockCallback<T> callback) {
        if (!tryLock(key, timeout, unit)) {
            throw new RuntimeException("Failed to acquire lock for key: " + key);
        }
        try {
            return callback.execute();
        } finally {
            releaseLock(key);
        }
    }

    @FunctionalInterface
    public interface LockCallback<T> {
        T execute();
    }
}
