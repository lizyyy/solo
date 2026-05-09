package com.example.config.repository;

import com.example.config.domain.ConfigEventLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface ConfigEventLogRepository extends JpaRepository<ConfigEventLog, Long> {

    List<ConfigEventLog> findByTraceIdOrderByCreatedAtAsc(String traceId);

    List<ConfigEventLog> findByEntityIdOrderByCreatedAtAsc(String entityId);

    @Query("SELECT e FROM ConfigEventLog e WHERE e.eventType = :eventType AND e.createdAt >= :from AND e.createdAt <= :to ORDER BY e.createdAt ASC")
    List<ConfigEventLog> findByEventTypeAndTimeRange(
            @Param("eventType") ConfigEventLog.EventType eventType,
            @Param("from") LocalDateTime from,
            @Param("to") LocalDateTime to);

    @Query("SELECT e FROM ConfigEventLog e WHERE e.entityId = :entityId AND e.createdAt >= :from AND e.createdAt <= :to ORDER BY e.createdAt ASC")
    List<ConfigEventLog> findByEntityIdAndTimeRange(
            @Param("entityId") String entityId,
            @Param("from") LocalDateTime from,
            @Param("to") LocalDateTime to);

    @Query("SELECT e FROM ConfigEventLog e WHERE e.createdAt < :before")
    List<ConfigEventLog> findOldEvents(@Param("before") LocalDateTime before);

    @Query("SELECT e FROM ConfigEventLog e WHERE e.createdAt >= :from AND e.createdAt <= :to ORDER BY e.createdAt ASC")
    List<ConfigEventLog> findByTimeRange(
            @Param("from") LocalDateTime from,
            @Param("to") LocalDateTime to);

    @Query("SELECT e FROM ConfigEventLog e WHERE e.level IN :levels AND e.createdAt >= :from ORDER BY e.createdAt DESC")
    List<ConfigEventLog> findRecentErrors(
            @Param("levels") List<ConfigEventLog.EventLevel> levels,
            @Param("from") LocalDateTime from);
}
