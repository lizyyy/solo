package com.datarepair.approval.service;

import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

@Service
public class IdempotencyService {

    private static final long CACHE_DURATION_MINUTES = 60;

    private final Map<String, CacheEntry> requestCache = new ConcurrentHashMap<>();

    public boolean isProcessed(String requestId) {
        if (requestId == null || requestId.trim().isEmpty()) {
            return false;
        }
        CacheEntry entry = requestCache.get(requestId);
        if (entry == null) {
            return false;
        }
        if (System.currentTimeMillis() - entry.timestamp > TimeUnit.MINUTES.toMillis(CACHE_DURATION_MINUTES)) {
            requestCache.remove(requestId);
            return false;
        }
        return true;
    }

    public void markAsProcessed(String requestId, Object result) {
        if (requestId == null || requestId.trim().isEmpty()) {
            return;
        }
        requestCache.put(requestId, new CacheEntry(result, System.currentTimeMillis()));
    }

    public Object getResult(String requestId) {
        CacheEntry entry = requestCache.get(requestId);
        return entry != null ? entry.result : null;
    }

    public void clearExpired() {
        long threshold = System.currentTimeMillis() - TimeUnit.MINUTES.toMillis(CACHE_DURATION_MINUTES);
        requestCache.entrySet().removeIf(entry -> entry.getValue().timestamp < threshold);
    }

    private static class CacheEntry {
        Object result;
        long timestamp;

        CacheEntry(Object result, long timestamp) {
            this.result = result;
            this.timestamp = timestamp;
        }
    }
}
