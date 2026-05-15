package com.tokenexchange.repository;

import com.tokenexchange.entity.TimelineEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface TimelineEventRepository extends JpaRepository<TimelineEvent, Long> {
    List<TimelineEvent> findByEntityIdOrderByTimestampDesc(String entityId);
    List<TimelineEvent> findByEntityIdAndEntityTypeOrderByTimestampDesc(String entityId, String entityType);
    List<TimelineEvent> findByTimestampBetweenOrderByTimestampDesc(LocalDateTime start, LocalDateTime end);
    
    @Query("SELECT t FROM TimelineEvent t WHERE t.entityId = ?1 AND t.timestamp BETWEEN ?2 AND ?3 ORDER BY t.timestamp DESC")
    List<TimelineEvent> findByEntityIdAndTimeRange(String entityId, LocalDateTime start, LocalDateTime end);
}
