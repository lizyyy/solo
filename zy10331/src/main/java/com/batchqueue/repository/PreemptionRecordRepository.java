package com.batchqueue.repository;

import com.batchqueue.model.entity.PreemptionRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface PreemptionRecordRepository extends JpaRepository<PreemptionRecord, Long> {
    List<PreemptionRecord> findByPreemptedTaskId(Long preemptedTaskId);
    List<PreemptionRecord> findByPreemptingTaskId(Long preemptingTaskId);
    
    @Query("SELECT COUNT(p) FROM PreemptionRecord p WHERE p.preemptedAt >= :startTime")
    long countPreemptionsSince(@Param("startTime") LocalDateTime startTime);
    
    List<PreemptionRecord> findAllByOrderByPreemptedAtDesc();
}
