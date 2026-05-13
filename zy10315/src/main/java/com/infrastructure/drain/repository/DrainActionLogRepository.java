package com.infrastructure.drain.repository;

import com.infrastructure.drain.model.DrainActionLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DrainActionLogRepository extends JpaRepository<DrainActionLog, Long> {
    
    List<DrainActionLog> findByBatchIdOrderByActionTimeAsc(String batchId);
    
    List<DrainActionLog> findByInstanceIdOrderByActionTimeAsc(String instanceId);
}
