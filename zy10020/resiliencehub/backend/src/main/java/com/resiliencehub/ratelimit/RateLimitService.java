package com.resiliencehub.ratelimit;

import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class RateLimitService {
    
    private final RedisTemplate<String, Object> redisTemplate;
    private final Map<String, TokenBucket> localBuckets = new ConcurrentHashMap<>();
    
    public RateLimitService(RedisTemplate<String, Object> redisTemplate) {
        this.redisTemplate = redisTemplate;
    }
    
    public boolean tryAcquire(String key, int limit, int window) {
        return tryAcquireTokenBucket(key, limit, window);
    }
    
    public boolean tryAcquireTokenBucket(String key, int limit, int window) {
        String redisKey = "rate_limit:token:" + key;
        String luaScript = 
            "local tokens_key = KEYS[1]\n" +
            "local timestamp_key = KEYS[1] .. ':ts'\n" +
            "local rate = tonumber(ARGV[1])\n" +
            "local capacity = tonumber(ARGV[2])\n" +
            "local now = redis.call('TIME')[1]\n" +
            "local last_refreshed = redis.call('GET', timestamp_key) or now\n" +
            "local tokens = tonumber(redis.call('GET', tokens_key) or capacity)\n" +
            "local delta = math.max(0, now - last_refreshed)\n" +
            "local filled_tokens = math.min(capacity, tokens + delta * (rate / 1))\n" +
            "local allowed = filled_tokens >= 1\n" +
            "if allowed then\n" +
            "  redis.call('SET', tokens_key, filled_tokens - 1)\n" +
            "  redis.call('SET', timestamp_key, now)\n" +
            "end\n" +
            "return allowed";
        
        DefaultRedisScript<Boolean> script = new DefaultRedisScript<>();
        script.setScriptText(luaScript);
        script.setResultType(Boolean.class);
        
        try {
            return redisTemplate.execute(script, Collections.singletonList(redisKey), limit, limit);
        } catch (Exception e) {
            return tryLocalAcquire(key, limit, window);
        }
    }
    
    private boolean tryLocalAcquire(String key, int limit, int window) {
        TokenBucket bucket = localBuckets.computeIfAbsent(key, k -> 
            new TokenBucket(limit, window * 1000L));
        return bucket.tryConsume(1);
    }
    
    public boolean tryAcquireFixedWindow(String key, int limit, int window) {
        String redisKey = "rate_limit:fixed:" + key;
        String luaScript = 
            "local key = KEYS[1]\n" +
            "local limit = tonumber(ARGV[1])\n" +
            "local window = tonumber(ARGV[2])\n" +
            "local count = redis.call('INCR', key)\n" +
            "if count == 1 then\n" +
            "  redis.call('EXPIRE', key, window)\n" +
            "end\n" +
            "return count <= limit";
        
        DefaultRedisScript<Boolean> script = new DefaultRedisScript<>();
        script.setScriptText(luaScript);
        script.setResultType(Boolean.class);
        
        try {
            return redisTemplate.execute(script, Collections.singletonList(redisKey), limit, window);
        } catch (Exception e) {
            return tryLocalAcquire(key, limit, window);
        }
    }
    
    public boolean tryAcquireSlidingWindow(String key, int limit, int window) {
        String redisKey = "rate_limit:sliding:" + key;
        long now = System.currentTimeMillis();
        long windowStart = now - window * 1000L;
        
        try {
            redisTemplate.opsForZSet().removeRangeByScore(redisKey, 0, windowStart);
            Long current = redisTemplate.opsForZSet().zCard(redisKey);
            
            if (current != null && current < limit) {
                String value = "req:" + now + ":" + Thread.currentThread().getId();
                redisTemplate.opsForZSet().add(redisKey, value, now);
                redisTemplate.expire(redisKey, java.time.Duration.ofSeconds(window));
                return true;
            }
            return false;
        } catch (Exception e) {
            return tryLocalAcquire(key, limit, window);
        }
    }
    
    public void reset(String key) {
        localBuckets.remove(key);
        redisTemplate.delete("rate_limit:token:" + key);
        redisTemplate.delete("rate_limit:fixed:" + key);
        redisTemplate.delete("rate_limit:sliding:" + key);
    }
    
    public RateLimitMetrics getMetrics(String key) {
        String tokenKey = "rate_limit:token:" + key;
        String fixedKey = "rate_limit:fixed:" + key;
        String slidingKey = "rate_limit:sliding:" + key;
        
        RateLimitMetrics metrics = new RateLimitMetrics();
        metrics.setKey(key);
        
        try {
            Object tokenCount = redisTemplate.opsForValue().get(tokenKey);
            if (tokenCount != null) {
                metrics.setRemainingTokens(Integer.parseInt(tokenCount.toString()));
            }
            
            Object fixedCount = redisTemplate.opsForValue().get(fixedKey);
            if (fixedCount != null) {
                metrics.setFixedWindowCount(Integer.parseInt(fixedCount.toString()));
            }
            
            Long slidingCount = redisTemplate.opsForZSet().zCard(slidingKey);
            if (slidingCount != null) {
                metrics.setSlidingWindowCount(slidingCount.intValue());
            }
        } catch (Exception e) {
            TokenBucket bucket = localBuckets.get(key);
            if (bucket != null) {
                metrics.setRemainingTokens((int) bucket.currentTokens);
            }
        }
        
        return metrics;
    }
    
    public static class TokenBucket {
        private final long capacity;
        private final long refillInterval;
        private long currentTokens;
        private long lastRefillTime;
        
        public TokenBucket(long capacity, long refillInterval) {
            this.capacity = capacity;
            this.refillInterval = refillInterval;
            this.currentTokens = capacity;
            this.lastRefillTime = System.currentTimeMillis();
        }
        
        public synchronized boolean tryConsume(long tokens) {
            refill();
            if (currentTokens >= tokens) {
                currentTokens -= tokens;
                return true;
            }
            return false;
        }
        
        private void refill() {
            long now = System.currentTimeMillis();
            long elapsed = now - lastRefillTime;
            if (elapsed >= refillInterval) {
                long tokensToAdd = (elapsed / refillInterval) * (capacity / 1);
                currentTokens = Math.min(capacity, currentTokens + tokensToAdd);
                lastRefillTime = now;
            }
        }
    }
    
    public static class RateLimitMetrics {
        private String key;
        private int remainingTokens;
        private int fixedWindowCount;
        private int slidingWindowCount;
        
        public String getKey() { return key; }
        public void setKey(String key) { this.key = key; }
        public int getRemainingTokens() { return remainingTokens; }
        public void setRemainingTokens(int remainingTokens) { this.remainingTokens = remainingTokens; }
        public int getFixedWindowCount() { return fixedWindowCount; }
        public void setFixedWindowCount(int fixedWindowCount) { this.fixedWindowCount = fixedWindowCount; }
        public int getSlidingWindowCount() { return slidingWindowCount; }
        public void setSlidingWindowCount(int slidingWindowCount) { this.slidingWindowCount = slidingWindowCount; }
    }
}
