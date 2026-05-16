package com.dependency.license.service;

import com.dependency.license.model.AuditLog;
import com.dependency.license.repository.AuditLogRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuditService {
    private final AuditLogRepository auditLogRepository;
    private final ObjectMapper objectMapper;

    @Transactional
    public void logSuccess(String operation, String entityType, Long entityId, Object originalInput, Object result) {
        AuditLog auditLog = new AuditLog();
        auditLog.setOperation(operation);
        auditLog.setEntityType(entityType);
        auditLog.setEntityId(entityId);
        auditLog.setSuccess(true);
        auditLog.setOperator("system");

        try {
            if (originalInput != null) {
                auditLog.setOriginalInput(objectMapper.writeValueAsString(originalInput));
            }
            if (result != null) {
                auditLog.setProcessingResult(objectMapper.writeValueAsString(result));
            }
        } catch (Exception e) {
            log.warn("序列化审计日志数据失败", e);
        }

        auditLogRepository.save(auditLog);
    }

    @Transactional
    public void logFailure(String operation, String entityType, Long entityId, Object originalInput, String errorMessage) {
        AuditLog auditLog = new AuditLog();
        auditLog.setOperation(operation);
        auditLog.setEntityType(entityType);
        auditLog.setEntityId(entityId);
        auditLog.setSuccess(false);
        auditLog.setErrorMessage(errorMessage);
        auditLog.setOperator("system");

        try {
            if (originalInput != null) {
                auditLog.setOriginalInput(objectMapper.writeValueAsString(originalInput));
            }
        } catch (Exception e) {
            log.warn("序列化审计日志数据失败", e);
        }

        auditLogRepository.save(auditLog);
    }
}