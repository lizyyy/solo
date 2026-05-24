package com.port.reefer.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.port.reefer.entity.AuditLog;
import com.port.reefer.repository.AuditLogRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

    @Transactional
    public AuditLog logOperation(String operation, String entityType, Long entityId,
                            Long inspectorId, Object beforeState, Object afterState,
                            String remark, boolean isDuplicate) {
        AuditLog auditLog = new AuditLog();
        auditLog.setOperation(operation);
        auditLog.setEntityType(entityType);
        auditLog.setEntityId(entityId);
        auditLog.setInspectorId(inspectorId);
        auditLog.setRemark(remark);
        auditLog.setIsDuplicate(isDuplicate);

        try {
            if (beforeState != null) {
                auditLog.setBeforeState(objectMapper.writeValueAsString(beforeState));
            }
            if (afterState != null) {
                auditLog.setAfterState(objectMapper.writeValueAsString(afterState));
            }
        } catch (JsonProcessingException e) {
            log.warn("序列化审计日志状态失败", e);
        }

        return auditLogRepository.save(auditLog);
    }

    @Transactional
    public AuditLog logOperation(String operation, String entityType, Long entityId,
                                Long inspectorId, Object beforeState, Object afterState,
                                String remark) {
        return logOperation(operation, entityType, entityId, inspectorId,
                beforeState, afterState, remark, false);
    }

    @Transactional
    public AuditLog logDuplicateOperation(String operation, String entityType, Long entityId,
                                          Long inspectorId, String remark) {
        return logOperation(operation, entityType, entityId, inspectorId,
                null, null, remark, true);
    }

    public List<AuditLog> getEntityAuditLogs(String entityType, Long entityId) {
        return auditLogRepository.findByEntityTypeAndEntityIdOrderByCreatedAtDesc(entityType, entityId);
    }

    public List<AuditLog> getInspectorAuditLogs(Long inspectorId) {
        return auditLogRepository.findByInspectorIdOrderByCreatedAtDesc(inspectorId);
    }

    public boolean isOperationDuplicate(String operation, String entityType, Long entityId) {
        List<AuditLog> logs = auditLogRepository.findByOperationAndEntityTypeAndEntityId(
                operation, entityType, entityId);
        return logs.stream().anyMatch(l -> l.getIsDuplicate() != null && !l.getIsDuplicate());
    }
}
