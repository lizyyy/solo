package com.ci.cache.repository;

import com.ci.cache.model.CacheEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CacheEntryRepository extends JpaRepository<CacheEntry, Long> {
    Optional<CacheEntry> findByCacheKey(String cacheKey);
    List<CacheEntry> findByProjectName(String projectName);
    List<CacheEntry> findByProjectNameAndActiveTrue(String projectName);
    List<CacheEntry> findByActiveTrue();

    @Query("SELECT c FROM CacheEntry c WHERE c.active = true ORDER BY c.sizeInBytes DESC")
    List<CacheEntry> findAllActiveOrderBySizeDesc();

    @Query("SELECT c FROM CacheEntry c WHERE c.active = true ORDER BY c.hitCount ASC")
    List<CacheEntry> findAllActiveOrderByHitCountAsc();

    @Query("SELECT c FROM CacheEntry c WHERE c.active = true ORDER BY c.lastAccessedAt ASC")
    List<CacheEntry> findAllActiveOrderByLastAccessedAtAsc();

    @Query("SELECT SUM(c.sizeInBytes) FROM CacheEntry c WHERE c.active = true")
    Long sumTotalActiveSize();

    boolean existsByCacheKey(String cacheKey);

    @Query("SELECT c FROM CacheEntry c WHERE c.cacheKey IN :cacheKeys AND c.active = true")
    List<CacheEntry> findByCacheKeysInAndActiveTrue(List<String> cacheKeys);
}
