package com.mold.service.domain.repository;

import com.mold.service.domain.entity.OperationHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface OperationHistoryRepository extends JpaRepository<OperationHistory, Long> {
    
    List<OperationHistory> findByEntityTypeAndEntityIdOrderByOperationTimeDesc(String entityType, Long entityId);
    
    List<OperationHistory> findByEntityTypeAndEntityCodeOrderByOperationTimeDesc(String entityType, String entityCode);
    
    List<OperationHistory> findByOperationTypeOrderByOperationTimeDesc(OperationHistory.OperationType operationType);
    
    List<OperationHistory> findByOperationTimeBetweenOrderByOperationTimeDesc(LocalDateTime startTime, LocalDateTime endTime);
    
    List<OperationHistory> findByOperatorOrderByOperationTimeDesc(String operator);
}
