package com.approval.coordinator.service;

import com.approval.coordinator.model.entity.ApprovalBatch;
import com.approval.coordinator.model.entity.TimelineEvent;
import com.approval.coordinator.repository.TimelineEventRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class TimelineService {

    private final TimelineEventRepository timelineEventRepository;

    @Transactional
    public void addEvent(ApprovalBatch batch, String eventType, String description) {
        addEvent(batch, null, eventType, description, null, null, null);
    }

    @Transactional
    public void addEvent(ApprovalBatch batch, String eventType, String description, String operator) {
        addEvent(batch, null, eventType, description, operator, null, null);
    }

    @Transactional
    public void addStatusChangeEvent(ApprovalBatch batch, String previousStatus, String newStatus, String operator) {
        addEvent(batch, null, "STATUS_CHANGE", "批次状态从 " + previousStatus + " 变更为 " + newStatus, operator, previousStatus, newStatus);
    }

    @Transactional
    public void addItemEvent(ApprovalBatch batch, String itemId, String eventType, String description, String operator) {
        addEvent(batch, itemId, eventType, description, operator, null, null);
    }

    @Transactional
    public void addEvent(ApprovalBatch batch, String itemId, String eventType, String description, String operator, String previousStatus, String newStatus) {
        TimelineEvent event = TimelineEvent.builder()
                .batch(batch)
                .itemId(itemId)
                .eventType(eventType)
                .eventTime(LocalDateTime.now())
                .operator(operator)
                .source("SYSTEM")
                .description(description)
                .previousStatus(previousStatus)
                .newStatus(newStatus)
                .build();
        timelineEventRepository.save(event);
        log.debug("添加时间线事件: batchId={}, itemId={}, eventType={}, description={}", batch.getBatchId(), itemId, eventType, description);
    }

    public List<TimelineEvent> getBatchTimeline(String batchId) {
        return timelineEventRepository.findByBatch_BatchIdOrderByEventTimeAsc(batchId);
    }

    public List<TimelineEvent> getItemTimeline(String batchId, String itemId) {
        return timelineEventRepository.findByBatch_BatchIdAndItemIdOrderByEventTimeAsc(batchId, itemId);
    }

    public List<TimelineEvent> getTimelineByTimeRange(String batchId, LocalDateTime startTime, LocalDateTime endTime) {
        return timelineEventRepository.findByBatch_BatchIdAndTimeRange(batchId, startTime, endTime);
    }
}
