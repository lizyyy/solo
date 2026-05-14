package com.infrastructure.drain.repository;

import com.infrastructure.drain.model.RecoveryAction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RecoveryActionRepository extends JpaRepository<RecoveryAction, Long> {
    
    List<RecoveryAction> findByBatchId(String batchId);
    
    List<RecoveryAction> findByInstanceId(String instanceId);
}
