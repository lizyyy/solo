package com.approval.coordinator.repository;

import com.approval.coordinator.model.entity.TimelineEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface TimelineEventRepository extends JpaRepository<TimelineEvent, Long> {

    List<TimelineEvent> findByBatch_BatchIdOrderByEventTimeAsc(String batchId);

    List<TimelineEvent> findByBatch_BatchIdAndItemIdOrderByEventTimeAsc(String batchId, String itemId);

    @Query("SELECT t FROM TimelineEvent t WHERE t.batch.batchId = :batchId AND t.eventTime BETWEEN :startTime AND :endTime ORDER BY t.eventTime ASC")
    List<TimelineEvent> findByBatch_BatchIdAndTimeRange(@Param("batchId") String batchId, @Param("startTime") LocalDateTime startTime, @Param("endTime") LocalDateTime endTime);

    List<TimelineEvent> findByEventType(String eventType);
}
