package com.business.recalculate.repository;

import com.business.recalculate.model.StatusHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface StatusHistoryRepository extends JpaRepository<StatusHistory, Long> {
    
    List<StatusHistory> findByBatchIdOrderByCreatedAtDesc(Long batchId);
    
    List<StatusHistory> findByBatchNoOrderByCreatedAtDesc(String batchNo);
}
