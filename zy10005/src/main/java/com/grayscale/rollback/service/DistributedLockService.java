package com.grayscale.rollback.service;

import lombok.extern.slf4j.Slf4j;
import org.redisson.api.RLock;
import org.redisson.api.RedissonClient;
import org.springframework.stereotype.Service;

import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;

@Service
@Slf4j
public class DistributedLockService {
    
    private final RedissonClient redissonClient;
    private static final String LOCK_PREFIX = "rollback:lock:";
    
    public DistributedLockService(RedissonClient redissonClient) {
        this.redissonClient = redissonClient;
    }
    
    public boolean tryLock(String key, long waitTime, long leaseTime, TimeUnit unit) {
        String lockKey = LOCK_PREFIX + key;
        RLock lock = redissonClient.getLock(lockKey);
        try {
            boolean acquired = lock.tryLock(waitTime, leaseTime, unit);
            log.debug("Lock attempt for {}: acquired={}", lockKey, acquired);
            return acquired;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.warn("Lock attempt interrupted for {}", lockKey);
            return false;
        }
    }
    
    public void unlock(String key) {
        String lockKey = LOCK_PREFIX + key;
        RLock lock = redissonClient.getLock(lockKey);
        if (lock.isHeldByCurrentThread()) {
            lock.unlock();
            log.debug("Lock released for {}", lockKey);
        }
    }
    
    public <T> T executeWithLock(String key, long waitTime, long leaseTime, TimeUnit unit,
                                  Supplier<T> action, Supplier<T> fallback) {
        if (tryLock(key, waitTime, leaseTime, unit)) {
            try {
                return action.get();
            } finally {
                unlock(key);
            }
        } else {
            log.warn("Failed to acquire lock for {}", key);
            return fallback.get();
        }
    }
    
    public void executeWithLock(String key, long waitTime, long leaseTime, TimeUnit unit,
                                Runnable action, Runnable fallback) {
        if (tryLock(key, waitTime, leaseTime, unit)) {
            try {
                action.run();
            } finally {
                unlock(key);
            }
        } else {
            log.warn("Failed to acquire lock for {}", key);
            fallback.run();
        }
    }
}
