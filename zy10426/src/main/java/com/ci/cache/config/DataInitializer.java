package com.ci.cache.config;

import com.ci.cache.model.CacheEntry;
import com.ci.cache.repository.CacheEntryRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Component
public class DataInitializer implements CommandLineRunner {
    private static final Logger logger = LoggerFactory.getLogger(DataInitializer.class);

    @Autowired
    private CacheEntryRepository cacheEntryRepository;

    @Override
    public void run(String... args) {
        if (cacheEntryRepository.count() == 0) {
            logger.info("Initializing sample cache data...");

            createCacheEntry("cache:frontend:build:v1.0.0", "frontend-project",
                    512 * 1024 * 1024L, "Frontend production build cache", 2345);
            createCacheEntry("cache:frontend:build:v0.9.0", "frontend-project",
                    480 * 1024 * 1024L, "Old frontend build cache (can be evicted)", 56);
            createCacheEntry("cache:backend:dependencies:2024", "backend-service",
                    1024 * 1024 * 1024L, "Backend dependency cache", 5678);
            createCacheEntry("cache:backend:test:reports", "backend-service",
                    50 * 1024 * 1024L, "Test report cache (low usage)", 23);
            createCacheEntry("cache:mobile:ios:sdk:v2", "mobile-app",
                    768 * 1024 * 1024L, "iOS SDK compilation cache", 1234);
            createCacheEntry("cache:mobile:android:ndk:r25", "mobile-app",
                    896 * 1024 * 1024L, "Android NDK build cache", 876);
            createCacheEntry("cache:data:etl:snapshot:2024-01", "data-pipeline",
                    2048 * 1024 * 1024L, "ETL pipeline snapshot (rarely used)", 12);
            createCacheEntry("cache:infra:docker:image:base", "infra-tools",
                    1536 * 1024 * 1024L, "Base Docker image cache", 3456);
            createCacheEntry("cache:docs:site:build:archive", "documentation",
                    256 * 1024 * 1024L, "Documentation site build archive", 78);
            createCacheEntry("cache:ml:model:resnet50:v3", "ml-platform",
                    4096 * 1024 * 1024L, "ML model weights (large, low usage)", 45);

            logger.info("Sample data initialization completed");
        } else {
            logger.info("Database already contains data, skipping initialization");
        }
    }

    private void createCacheEntry(String cacheKey, String projectName,
                                   long sizeInBytes, String description, long hitCount) {
        CacheEntry entry = new CacheEntry();
        entry.setCacheKey(cacheKey);
        entry.setProjectName(projectName);
        entry.setSizeInBytes(sizeInBytes);
        entry.setDescription(description);
        entry.setHitCount(hitCount);
        entry.setCreatedAt(LocalDateTime.now().minusDays((long) (Math.random() * 30)));
        entry.setLastAccessedAt(LocalDateTime.now().minusHours((long) (Math.random() * 168)));
        entry.setActive(true);
        cacheEntryRepository.save(entry);
    }
}
