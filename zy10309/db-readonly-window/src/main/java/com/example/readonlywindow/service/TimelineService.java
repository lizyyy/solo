package com.example.readonlywindow.service;

import com.example.readonlywindow.entity.EventType;
import com.example.readonlywindow.entity.TimelineEvent;
import com.example.readonlywindow.repository.TimelineEventRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class TimelineService {
    private final TimelineEventRepository eventRepository;

    @Transactional
    public TimelineEvent createEvent(EventType eventType, Long windowId, Long requestId,
                                     Long credentialId, Long conflictId, String operator,
                                     String description, String details) {
        TimelineEvent event = new TimelineEvent();
        event.setEventCode("EVT-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        event.setEventType(eventType);
        event.setWindowId(windowId);
        event.setRequestId(requestId);
        event.setCredentialId(credentialId);
        event.setConflictId(conflictId);
        event.setEventTime(LocalDateTime.now());
        event.setOperator(operator);
        event.setDescription(description);
        event.setDetails(details);

        return eventRepository.save(event);
    }

    public List<TimelineEvent> getWindowTimeline(Long windowId) {
        return eventRepository.findByWindowIdOrderByEventTimeDesc(windowId);
    }

    public List<TimelineEvent> getRequestTimeline(Long requestId) {
        return eventRepository.findByRequestIdOrderByEventTimeDesc(requestId);
    }

    public List<TimelineEvent> getCredentialTimeline(Long credentialId) {
        return eventRepository.findByCredentialIdOrderByEventTimeDesc(credentialId);
    }

    public List<TimelineEvent> getConflictTimeline(Long conflictId) {
        return eventRepository.findByConflictIdOrderByEventTimeDesc(conflictId);
    }

    public List<TimelineEvent> getEventsByTimeRange(LocalDateTime startTime, LocalDateTime endTime) {
        return eventRepository.findByEventTimeBetweenOrderByEventTimeDesc(startTime, endTime);
    }
}
