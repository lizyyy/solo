package com.example.readonlywindow.repository;

import com.example.readonlywindow.entity.EventType;
import com.example.readonlywindow.entity.TimelineEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface TimelineEventRepository extends JpaRepository<TimelineEvent, Long> {
    List<TimelineEvent> findByWindowIdOrderByEventTimeDesc(Long windowId);
    List<TimelineEvent> findByRequestIdOrderByEventTimeDesc(Long requestId);
    List<TimelineEvent> findByCredentialIdOrderByEventTimeDesc(Long credentialId);
    List<TimelineEvent> findByConflictIdOrderByEventTimeDesc(Long conflictId);
    List<TimelineEvent> findByEventTypeOrderByEventTimeDesc(EventType eventType);
    List<TimelineEvent> findByEventTimeBetweenOrderByEventTimeDesc(
            LocalDateTime startTime, LocalDateTime endTime);
    List<TimelineEvent> findByOperatorOrderByEventTimeDesc(String operator);
}
