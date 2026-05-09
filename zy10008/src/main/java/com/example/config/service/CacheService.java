package com.example.config.service;

import com.example.config.domain.ConfigItem;
import com.example.config.repository.ConfigItemRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import java.util.Optional;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class CacheService {

    private final ConfigItemRepository configItemRepository;
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;
    private final EventLogService eventLogService;

    @Value("${config.hot-update.cache.enabled:true}")
    private boolean cacheEnabled;

    @Value("${config.hot-update.cache.local-cache-size:1000}")
    private int localCacheSize;

    @Value("${config.hot-update.cache.local-cache-expire-seconds:300}")
    private int localCacheExpireSeconds;

    @Value("${config.hot-update.cache.redis-ttl-seconds:600}")
    private int redisTtlSeconds;

    private Cache<String, CacheEntry> localCache;

    private static final String CACHE_KEY_PREFIX = "config:item:";

    @PostConstruct
    public void init() {
        this.localCache = Caffeine.newBuilder()
                .maximumSize(localCacheSize)
                .expireAfterWrite(localCacheExpireSeconds, TimeUnit.SECONDS)
                .recordStats()
                .build();
    }

    public Optional<ConfigItem> getConfigWithCache(String namespace, String key) {
        if (!cacheEnabled) {
            return configItemRepository.findByNamespaceAndConfigKey(namespace, key);
        }

        String cacheKey = buildCacheKey(namespace, key);

        CacheEntry localEntry = localCache.getIfPresent(cacheKey);
        if (localEntry != null && localEntry.configItem != null) {
            log.debug("本地缓存命中: {}", cacheKey);
            return Optional.of(localEntry.configItem);
        }

        String redisValue = null;
        try {
            redisValue = redisTemplate.opsForValue().get(cacheKey);
        } catch (Exception e) {
            log.warn("Redis读取失败，回退到数据库: {}", e.getMessage());
        }

        if (redisValue != null) {
            try {
                ConfigItem configItem = objectMapper.readValue(redisValue, ConfigItem.class);
                localCache.put(cacheKey, new CacheEntry(configItem));
                log.debug("Redis缓存命中: {}", cacheKey);
                return Optional.of(configItem);
            } catch (JsonProcessingException e) {
                log.warn("Redis缓存反序列化失败: {}", e.getMessage());
            }
        }

        Optional<ConfigItem> dbResult = configItemRepository.findByNamespaceAndConfigKey(namespace, key);
        dbResult.ifPresent(configItem -> {
            try {
                String json = objectMapper.writeValueAsString(configItem);
                redisTemplate.opsForValue().set(cacheKey, json, redisTtlSeconds, TimeUnit.SECONDS);
            } catch (JsonProcessingException e) {
                log.warn("Redis缓存序列化失败: {}", e.getMessage());
            }
            localCache.put(cacheKey, new CacheEntry(configItem));
            eventLogService.logCacheUpdate(cacheKey, configItem.getVersion());
        });

        return dbResult;
    }

    public void invalidateConfig(String namespace, String key) {
        String cacheKey = buildCacheKey(namespace, key);

        localCache.invalidate(cacheKey);
        log.debug("本地缓存已失效: {}", cacheKey);

        try {
            redisTemplate.delete(cacheKey);
            log.debug("Redis缓存已删除: {}", cacheKey);
        } catch (Exception e) {
            log.warn("Redis缓存删除失败: {}", e.getMessage());
        }

        eventLogService.logCacheInvalidate(cacheKey);
    }

    public void invalidateNamespace(String namespace) {
        log.info("开始失效命名空间缓存: {}", namespace);

        localCache.asMap().keySet().stream()
                .filter(key -> key.startsWith(CACHE_KEY_PREFIX + namespace + ":"))
                .forEach(localCache::invalidate);

        try {
            String pattern = CACHE_KEY_PREFIX + namespace + ":*";
            redisTemplate.delete(redisTemplate.keys(pattern));
        } catch (Exception e) {
            log.warn("Redis命名空间缓存删除失败: {}", e.getMessage());
        }
    }

    public void invalidateAll() {
        log.warn("开始失效所有缓存");
        localCache.invalidateAll();
        try {
            String pattern = CACHE_KEY_PREFIX + "*";
            redisTemplate.delete(redisTemplate.keys(pattern));
        } catch (Exception e) {
            log.warn("Redis全部缓存删除失败: {}", e.getMessage());
        }
    }

    private String buildCacheKey(String namespace, String key) {
        return CACHE_KEY_PREFIX + namespace + ":" + key;
    }

    private static class CacheEntry {
        final ConfigItem configItem;
        final long cachedAt;

        CacheEntry(ConfigItem configItem) {
            this.configItem = configItem;
            this.cachedAt = System.currentTimeMillis();
        }
    }
}
