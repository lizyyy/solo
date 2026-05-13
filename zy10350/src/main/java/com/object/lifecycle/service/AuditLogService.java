package com.object.lifecycle.service;

import com.object.lifecycle.entity.AuditLog;
import com.object.lifecycle.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuditLogService {

    private final AuditLogRepository auditLogRepository;

    public void logAction(String entityType, String entityId, String action, String fieldName,
                          String oldValue, String newValue) {
        AuditLog auditLog = new AuditLog();
        auditLog.setEntityType(entityType);
        auditLog.setEntityId(entityId);
        auditLog.setAction(action);
        auditLog.setFieldName(fieldName);
        auditLog.setOldValue(oldValue);
        auditLog.setNewValue(newValue);
        auditLog.setOperator("system");
        auditLogRepository.save(auditLog);
        log.debug("记录审计日志: entityType={}, entityId={}, action={}", entityType, entityId, action);
    }

    public void logAction(String entityType, String entityId, String action) {
        logAction(entityType, entityId, action, null, null, null);
    }

    public List<AuditLog> getAuditLogs(String entityType, String entityId) {
        if (entityId != null) {
            return auditLogRepository.findByEntityTypeAndEntityIdOrderByCreatedAtDesc(entityType, entityId);
        }
        return auditLogRepository.findByEntityTypeOrderByCreatedAtDesc(entityType);
    }
}
