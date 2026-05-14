package com.infrastructure.drain.repository;

import com.infrastructure.drain.model.TrafficOffloadResult;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TrafficOffloadResultRepository extends JpaRepository<TrafficOffloadResult, Long> {
    
    List<TrafficOffloadResult> findByBatchId(String batchId);
    
    List<TrafficOffloadResult> findByInstanceId(String instanceId);
}
