package com.pottery.kilnqueue.repository;

import com.pottery.kilnqueue.entity.ProcessingLog;
import com.pottery.kilnqueue.enums.DecisionType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProcessingLogRepository extends JpaRepository<ProcessingLog, Long> {
    List<ProcessingLog> findByQueueRecordIdOrderByCreatedAtDesc(Long queueRecordId);
    List<ProcessingLog> findByQueueRecordIdAndDecisionType(Long queueRecordId, DecisionType decisionType);
    List<ProcessingLog> findByOperatorOrderByCreatedAtDesc(String operator);
}
