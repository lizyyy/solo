package com.paymentguard.idempotency.service;

import com.paymentguard.common.util.JsonUtil;
import com.paymentguard.tracing.util.TraceContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class IdempotencyService {

    private final RedisTemplate<String, Object> redisTemplate;
    private final DistributedLockService lockService;

    @Value("${paymentguard.idempotency.cache-prefix:idempotency:}")
    private String cachePrefix;

    @Value("${paymentguard.idempotency.default-ttl:86400}")
    private int defaultTtlSeconds;

    public boolean checkAndSetProcessing(String idempotencyKey) {
        String key = buildKey(idempotencyKey);
        
        String lockKey = key + ":processing";
        if (!lockService.tryLock(lockKey, 10, TimeUnit.SECONDS)) {
            log.info("Another request is processing for key: {}", idempotencyKey);
            return false;
        }
        
        try {
            if (Boolean.TRUE.equals(redisTemplate.hasKey(key))) {
                log.info("Idempotency check: duplicate request detected for key: {}", idempotencyKey);
                return false;
            }
            
            IdempotencyRecord record = IdempotencyRecord.builder()
                    .idempotencyKey(idempotencyKey)
                    .status("PROCESSING")
                    .traceId(TraceContext.getTraceId())
                    .createdAt(System.currentTimeMillis())
                    .build();
            
            redisTemplate.opsForValue().set(key, record, Duration.ofSeconds(defaultTtlSeconds));
            log.info("Idempotency record created: key={}, traceId={}", idempotencyKey, TraceContext.getTraceId());
            return true;
        } finally {
            lockService.releaseLock(lockKey);
        }
    }

    public void markSuccess(String idempotencyKey, Object result) {
        String key = buildKey(idempotencyKey);
        
        IdempotencyRecord record = (IdempotencyRecord) redisTemplate.opsForValue().get(key);
        if (record != null) {
            record.setStatus("SUCCESS");
            record.setResult(JsonUtil.toJson(result));
            record.setCompletedAt(System.currentTimeMillis());
            redisTemplate.opsForValue().set(key, record, Duration.ofSeconds(defaultTtlSeconds));
            log.info("Idempotency record marked as success: key={}", idempotencyKey);
        }
    }

    public void markFailed(String idempotencyKey, String errorMessage) {
        String key = buildKey(idempotencyKey);
        
        IdempotencyRecord record = (IdempotencyRecord) redisTemplate.opsForValue().get(key);
        if (record != null) {
            record.setStatus("FAILED");
            record.setErrorMessage(errorMessage);
            record.setCompletedAt(System.currentTimeMillis());
            redisTemplate.opsForValue().set(key, record, Duration.ofSeconds(60));
            log.info("Idempotency record marked as failed: key={}, error={}", idempotencyKey, errorMessage);
        }
    }

    public IdempotencyRecord getRecord(String idempotencyKey) {
        String key = buildKey(idempotencyKey);
        Object value = redisTemplate.opsForValue().get(key);
        if (value instanceof IdempotencyRecord) {
            return (IdempotencyRecord) value;
        }
        return null;
    }

    public boolean isProcessed(String idempotencyKey) {
        IdempotencyRecord record = getRecord(idempotencyKey);
        return record != null && "SUCCESS".equals(record.getStatus());
    }

    public void removeRecord(String idempotencyKey) {
        String key = buildKey(idempotencyKey);
        redisTemplate.delete(key);
        log.info("Idempotency record removed: key={}", idempotencyKey);
    }

    public <T> T executeIdempotent(String idempotencyKey, IdempotentCallback<T> callback) {
        IdempotencyRecord existingRecord = getRecord(idempotencyKey);
        if (existingRecord != null && "SUCCESS".equals(existingRecord.getStatus())) {
            log.info("Returning cached result for idempotency key: {}", idempotencyKey);
            return null;
        }
        
        if (!checkAndSetProcessing(idempotencyKey)) {
            log.warn("Idempotency check failed: another request in progress or already processed");
            return null;
        }
        
        try {
            T result = callback.execute();
            markSuccess(idempotencyKey, result);
            return result;
        } catch (Exception e) {
            markFailed(idempotencyKey, e.getMessage());
            throw e;
        }
    }

    private String buildKey(String idempotencyKey) {
        return cachePrefix + idempotencyKey;
    }

    @FunctionalInterface
    public interface IdempotentCallback<T> {
        T execute();
    }
}
