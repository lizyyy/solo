package com.ci.cache.service;

import com.ci.cache.model.CacheEntry;
import com.ci.cache.repository.CacheEntryRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class CacheEntryService {
    private static final Logger logger = LoggerFactory.getLogger(CacheEntryService.class);

    @Autowired
    private CacheEntryRepository cacheEntryRepository;

    public List<CacheEntry> getAllCacheEntries() {
        return cacheEntryRepository.findAll();
    }

    public List<CacheEntry> getActiveCacheEntries() {
        return cacheEntryRepository.findByActiveTrue();
    }

    public Optional<CacheEntry> getCacheEntryByKey(String cacheKey) {
        return cacheEntryRepository.findByCacheKey(cacheKey);
    }

    public List<CacheEntry> getCacheEntriesByProject(String projectName) {
        return cacheEntryRepository.findByProjectNameAndActiveTrue(projectName);
    }

    public List<CacheEntry> getCacheEntriesSortedBySize() {
        return cacheEntryRepository.findAllActiveOrderBySizeDesc();
    }

    public List<CacheEntry> getCacheEntriesSortedByHitCount() {
        return cacheEntryRepository.findAllActiveOrderByHitCountAsc();
    }

    public List<CacheEntry> getCacheEntriesSortedByLastAccess() {
        return cacheEntryRepository.findAllActiveOrderByLastAccessedAtAsc();
    }

    public Long getTotalActiveCacheSize() {
        Long size = cacheEntryRepository.sumTotalActiveSize();
        return size != null ? size : 0L;
    }

    @Transactional
    public CacheEntry createCacheEntry(String cacheKey, String projectName, Long sizeInBytes, String description) {
        if (cacheEntryRepository.existsByCacheKey(cacheKey)) {
            throw new IllegalArgumentException("Cache key already exists: " + cacheKey);
        }

        CacheEntry entry = new CacheEntry();
        entry.setCacheKey(cacheKey);
        entry.setProjectName(projectName);
        entry.setSizeInBytes(sizeInBytes);
        entry.setDescription(description);
        entry.setHitCount(0L);
        entry.setCreatedAt(LocalDateTime.now());
        entry.setLastAccessedAt(LocalDateTime.now());
        entry.setActive(true);

        return cacheEntryRepository.save(entry);
    }

    @Transactional
    public void recordCacheHit(String cacheKey) {
        cacheEntryRepository.findByCacheKey(cacheKey).ifPresent(entry -> {
            entry.incrementHitCount();
            cacheEntryRepository.save(entry);
            logger.debug("Recorded cache hit for: {}", cacheKey);
        });
    }

    @Transactional
    public void deactivateCacheEntry(String cacheKey) {
        cacheEntryRepository.findByCacheKey(cacheKey).ifPresent(entry -> {
            entry.setActive(false);
            cacheEntryRepository.save(entry);
            logger.info("Deactivated cache entry: {}", cacheKey);
        });
    }

    @Transactional
    public void activateCacheEntry(String cacheKey) {
        cacheEntryRepository.findByCacheKey(cacheKey).ifPresent(entry -> {
            entry.setActive(true);
            cacheEntryRepository.save(entry);
            logger.info("Activated cache entry: {}", cacheKey);
        });
    }

    public List<CacheEntry> getCacheEntriesByKeys(List<String> cacheKeys) {
        return cacheEntryRepository.findByCacheKeysInAndActiveTrue(cacheKeys);
    }
}
