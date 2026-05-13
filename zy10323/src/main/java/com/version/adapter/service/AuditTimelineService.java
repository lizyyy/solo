package com.version.adapter.service;

import com.version.adapter.entity.AuditTimeline;
import com.version.adapter.repository.AuditTimelineRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuditTimelineService {

    private final AuditTimelineRepository auditTimelineRepository;
    private final ObjectMapper objectMapper;

    @Transactional
    public void recordAction(String entityType, Long entityId, String action,
                             Object previousState, Object newState,
                             String performedBy, String remarks) {
        try {
            AuditTimeline timeline = AuditTimeline.builder()
                    .entityType(entityType)
                    .entityId(entityId)
                    .action(action)
                    .previousState(previousState != null ? objectMapper.writeValueAsString(previousState) : null)
                    .newState(newState != null ? objectMapper.writeValueAsString(newState) : null)
                    .performedBy(performedBy != null ? performedBy : "system")
                    .remarks(remarks)
                    .performedAt(LocalDateTime.now())
                    .build();

            auditTimelineRepository.save(timeline);
            log.info("记录审计时间线: {} - {} - {} - {}", entityType, entityId, action, performedBy);
        } catch (JsonProcessingException e) {
            log.error("序列化审计状态失败", e);
        }
    }

    public List<AuditTimeline> getEntityTimeline(String entityType, Long entityId) {
        return auditTimelineRepository.findByEntityTypeAndEntityIdOrderByPerformedAtDesc(entityType, entityId);
    }

    public List<AuditTimeline> getTimelineByTimeRange(LocalDateTime start, LocalDateTime end) {
        return auditTimelineRepository.findByPerformedAtBetweenOrderByPerformedAtDesc(start, end);
    }

    public List<AuditTimeline> getAllTimelineByEntityType(String entityType) {
        return auditTimelineRepository.findByEntityTypeOrderByPerformedAtDesc(entityType);
    }
}
