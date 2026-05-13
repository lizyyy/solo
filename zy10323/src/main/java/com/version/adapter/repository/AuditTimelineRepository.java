package com.version.adapter.repository;

import com.version.adapter.entity.AuditTimeline;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface AuditTimelineRepository extends JpaRepository<AuditTimeline, Long> {

    List<AuditTimeline> findByEntityTypeAndEntityIdOrderByPerformedAtDesc(String entityType, Long entityId);

    List<AuditTimeline> findByPerformedByOrderByPerformedAtDesc(String performedBy);

    List<AuditTimeline> findByPerformedAtBetweenOrderByPerformedAtDesc(LocalDateTime start, LocalDateTime end);

    List<AuditTimeline> findByEntityTypeOrderByPerformedAtDesc(String entityType);

    List<AuditTimeline> findByActionOrderByPerformedAtDesc(String action);
}
