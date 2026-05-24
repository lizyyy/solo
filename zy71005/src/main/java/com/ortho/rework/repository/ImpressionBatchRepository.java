package com.ortho.rework.repository;

import com.ortho.rework.entity.ImpressionBatch;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface ImpressionBatchRepository extends JpaRepository<ImpressionBatch, Long> {
    Optional<ImpressionBatch> findByBatchNo(String batchNo);
    Optional<ImpressionBatch> findByOriginalBatchNo(String originalBatchNo);
}
