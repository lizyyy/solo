package com.tokenexchange.service;

import com.tokenexchange.entity.TimelineEvent;
import com.tokenexchange.repository.TimelineEventRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class TimelineService {
    private final TimelineEventRepository timelineEventRepository;
    private final ObjectMapper objectMapper;

    public void recordEvent(String eventType, String entityId, String entityType, 
                            String description, Object eventData, String operatorId, 
                            String operatorType, String requestId) {
        TimelineEvent event = new TimelineEvent();
        event.setEventType(eventType);
        event.setEntityId(entityId);
        event.setEntityType(entityType);
        event.setDescription(description);
        event.setOperatorId(operatorId);
        event.setOperatorType(operatorType);
        event.setRequestId(requestId);

        if (eventData != null) {
            try {
                event.setEventData(objectMapper.writeValueAsString(eventData));
            } catch (JsonProcessingException e) {
                log.warn("Failed to serialize event data", e);
                event.setEventData(eventData.toString());
            }
        }

        timelineEventRepository.save(event);
        log.info("Timeline event recorded: {} - {} - {}", eventType, entityType, entityId);
    }

    public void recordTokenIssued(String token, String userId, String tokenType, 
                                  String requestId, Object details) {
        recordEvent("TOKEN_ISSUED", token, tokenType, 
                    "令牌已签发", details, 
                    userId, "USER", requestId);
    }

    public void recordTokenValidated(String token, String userId, String tokenType,
                                     boolean success, String requestId, Object details) {
        recordEvent(success ? "TOKEN_VALIDATED" : "TOKEN_VALIDATION_FAILED", 
                    token, tokenType, 
                    success ? "令牌验证成功" : "令牌验证失败", 
                    details, userId, "USER", requestId);
    }

    public void recordTokenRevoked(String token, String userId, String tokenType,
                                   String reason, String operatorId, String requestId, Object details) {
        recordEvent("TOKEN_REVOKED", token, tokenType,
                    "令牌已撤销: " + reason, details,
                    operatorId != null ? operatorId : userId, 
                    operatorId != null ? "ADMIN" : "USER", requestId);
    }

    public void recordTokenExchanged(String sourceToken, String targetToken, 
                                     String userId, String requestId, Object details) {
        recordEvent("TOKEN_EXCHANGED", sourceToken, "USER_TOKEN",
                    "令牌交换成功，生成短期令牌: " + targetToken, details,
                    userId, "USER", requestId);
    }

    public void recordTokenUsed(String token, String userId, String tokenType,
                                String serviceId, String operation, String requestId, Object details) {
        recordEvent("TOKEN_USED", token, tokenType,
                    "令牌已使用: " + operation + " @ " + serviceId, details,
                    userId, "SERVICE", requestId);
    }

    public List<TimelineEvent> getEntityTimeline(String entityId) {
        return timelineEventRepository.findByEntityIdOrderByTimestampDesc(entityId);
    }

    public List<TimelineEvent> getEntityTimeline(String entityId, String entityType) {
        return timelineEventRepository.findByEntityIdAndEntityTypeOrderByTimestampDesc(entityId, entityType);
    }

    public List<TimelineEvent> getTimeRangeTimeline(LocalDateTime start, LocalDateTime end) {
        return timelineEventRepository.findByTimestampBetweenOrderByTimestampDesc(start, end);
    }
}
