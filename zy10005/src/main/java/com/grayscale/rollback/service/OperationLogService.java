package com.grayscale.rollback.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.grayscale.rollback.entity.OperationLog;
import com.grayscale.rollback.entity.Release;
import com.grayscale.rollback.enums.OperationType;
import com.grayscale.rollback.enums.ReleaseStatus;
import com.grayscale.rollback.repository.OperationLogRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@Slf4j
public class OperationLogService {
    
    private final OperationLogRepository repository;
    private final ObjectMapper objectMapper;
    
    public OperationLogService(OperationLogRepository repository, ObjectMapper objectMapper) {
        this.repository = repository;
        this.objectMapper = objectMapper;
    }
    
    @Transactional(propagation = Propagation.REQUIRED)
    public OperationLog logOperation(String releaseId, OperationType operationType,
                                      Release beforeRelease, Release afterRelease,
                                      boolean success, String errorMessage,
                                      String operator, String requestDetails, long durationMs) {
        OperationLog logEntry = OperationLog.builder()
                .operationId(UUID.randomUUID().toString())
                .releaseId(releaseId)
                .operationType(operationType)
                .beforeState(serializeRelease(beforeRelease))
                .afterState(serializeRelease(afterRelease))
                .statusBefore(beforeRelease != null ? beforeRelease.getStatus() : null)
                .statusAfter(afterRelease != null ? afterRelease.getStatus() : null)
                .success(success)
                .errorMessage(errorMessage)
                .operator(operator != null ? operator : "system")
                .requestDetails(requestDetails)
                .durationMs(durationMs)
                .createdAt(LocalDateTime.now())
                .build();
        
        log.info("Logging operation: releaseId={}, type={}, success={}", releaseId, operationType, success);
        return repository.save(logEntry);
    }
    
    @Transactional(propagation = Propagation.REQUIRED)
    public OperationLog logSuccess(String releaseId, OperationType operationType,
                                    Release beforeRelease, Release afterRelease,
                                    String operator, String requestDetails, long durationMs) {
        return logOperation(releaseId, operationType, beforeRelease, afterRelease,
                true, null, operator, requestDetails, durationMs);
    }
    
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public OperationLog logFailure(String releaseId, OperationType operationType,
                                    Release beforeRelease, Release afterRelease,
                                    String errorMessage, String operator,
                                    String requestDetails, long durationMs) {
        log.info("Logging failure in NEW transaction: releaseId={}, type={}, error={}", 
                releaseId, operationType, errorMessage);
        
        OperationLog logEntry = OperationLog.builder()
                .operationId(UUID.randomUUID().toString())
                .releaseId(releaseId)
                .operationType(operationType)
                .beforeState(serializeRelease(beforeRelease))
                .afterState(serializeRelease(afterRelease))
                .statusBefore(beforeRelease != null ? beforeRelease.getStatus() : null)
                .statusAfter(afterRelease != null ? afterRelease.getStatus() : null)
                .success(false)
                .errorMessage(errorMessage)
                .operator(operator != null ? operator : "system")
                .requestDetails(requestDetails)
                .durationMs(durationMs)
                .createdAt(LocalDateTime.now())
                .build();
        
        OperationLog saved = repository.save(logEntry);
        log.info("Failure log persisted in NEW transaction: logId={}", saved.getId());
        return saved;
    }
    
    public List<OperationLog> getLogsForRelease(String releaseId) {
        return repository.findByReleaseIdOrderByCreatedAtAsc(releaseId);
    }
    
    public List<OperationLog> getFailedOperations(String releaseId) {
        return repository.findFailedOperations(releaseId);
    }
    
    public List<OperationLog> getLogsByTypeBetween(OperationType type, LocalDateTime start, LocalDateTime end) {
        return repository.findByOperationTypeInAndCreatedAtBetween(List.of(type), start, end);
    }
    
    private String serializeRelease(Release release) {
        if (release == null) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(release);
        } catch (JsonProcessingException e) {
            log.warn("Failed to serialize release for logging", e);
            return release.toString();
        }
    }
    
    public Release deserializeRelease(String json) {
        if (json == null) {
            return null;
        }
        try {
            return objectMapper.readValue(json, Release.class);
        } catch (JsonProcessingException e) {
            log.warn("Failed to deserialize release from log", e);
            return null;
        }
    }
}
