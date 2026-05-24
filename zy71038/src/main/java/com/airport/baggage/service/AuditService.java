package com.airport.baggage.service;

import com.airport.baggage.entity.AuditLog;
import com.airport.baggage.repository.AuditLogRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class AuditService {
    private static final Logger log = LoggerFactory.getLogger(AuditService.class);
    
    private final AuditLogRepository auditLogRepository;
    private final ObjectMapper objectMapper;

    public AuditService(AuditLogRepository auditLogRepository, ObjectMapper objectMapper) {
        this.auditLogRepository = auditLogRepository;
        this.objectMapper = objectMapper;
    }

    public void logChange(String entityType, Long entityId, String operation,
                          Object beforeValue, Object afterValue, String changeReason, String operator) {
        try {
            AuditLog auditLog = new AuditLog();
            auditLog.setEntityType(entityType);
            auditLog.setEntityId(entityId);
            auditLog.setOperation(operation);
            auditLog.setBeforeValue(beforeValue != null ? objectMapper.writeValueAsString(beforeValue) : null);
            auditLog.setAfterValue(afterValue != null ? objectMapper.writeValueAsString(afterValue) : null);
            auditLog.setChangeReason(changeReason);
            auditLog.setOperator(operator);
            auditLogRepository.save(auditLog);
        } catch (JsonProcessingException e) {
            log.error("序列化审计日志失败", e);
        }
    }

    public List<AuditLog> getEntityAuditLogs(String entityType, Long entityId) {
        return auditLogRepository.findByEntityTypeAndEntityIdOrderByCreatedAtDesc(entityType, entityId);
    }

    public List<AuditLog> getEntityTypeAuditLogs(String entityType) {
        return auditLogRepository.findByEntityTypeOrderByCreatedAtDesc(entityType);
    }
}
