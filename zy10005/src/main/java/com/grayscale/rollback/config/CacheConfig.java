package com.grayscale.rollback.config;

import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import java.util.concurrent.TimeUnit;

@Configuration
@EnableCaching
public class CacheConfig {
    
    private final RollbackSystemConfig config;
    
    public CacheConfig(RollbackSystemConfig config) {
        this.config = config;
    }
    
    @Bean
    @Primary
    public CacheManager caffeineCacheManager() {
        CaffeineCacheManager cacheManager = new CaffeineCacheManager();
        cacheManager.setCaffeine(Caffeine.newBuilder()
                .expireAfterWrite(config.getCacheTtlSeconds(), TimeUnit.SECONDS)
                .maximumSize(1000)
                .recordStats());
        return cacheManager;
    }
}
