package com.ci.cache.repository;

import com.ci.cache.model.ProcessingException;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProcessingExceptionRepository extends JpaRepository<ProcessingException, Long> {
    List<ProcessingException> findByOperationType(String operationType);
    List<ProcessingException> findByRelatedApplicationId(String applicationId);
    List<ProcessingException> findByRelatedCacheKey(String cacheKey);
}
