package com.hospital.oxygen.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hospital.oxygen.entity.AuditLog;
import com.hospital.oxygen.repository.AuditLogRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
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

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void logOperation(String operationType, String resourceType, String resourceId,
                             Object beforeState, Object afterState, String operator, String reason) {
        try {
            AuditLog auditLog = new AuditLog();
            auditLog.setOperationType(operationType);
            auditLog.setResourceType(resourceType);
            auditLog.setResourceId(resourceId);
            auditLog.setBeforeState(beforeState != null ? String.valueOf(beforeState) : null);
            auditLog.setAfterState(afterState != null ? String.valueOf(afterState) : null);
            auditLog.setOperator(operator);
            auditLog.setReason(reason);
            auditLog.setIsDuplicate(false);
            auditLogRepository.save(auditLog);
            log.debug("审计日志已记录: {} {} {}", operationType, resourceType, resourceId);
        } catch (Exception e) {
            log.error("记录审计日志失败", e);
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void logDuplicateOperation(String operationType, String resourceType, String resourceId,
                                      String duplicateOf, String operator) {
        try {
            AuditLog auditLog = new AuditLog();
            auditLog.setOperationType(operationType);
            auditLog.setResourceType(resourceType);
            auditLog.setResourceId(resourceId);
            auditLog.setOperator(operator);
            auditLog.setIsDuplicate(true);
            auditLog.setDuplicateOf(duplicateOf);
            auditLog.setReason("重复操作拦截");
            auditLogRepository.save(auditLog);
            log.info("重复操作已记录审计: {} {} {}, 重复于: {}", operationType, resourceType, resourceId, duplicateOf);
        } catch (Exception e) {
            log.error("记录重复操作审计失败", e);
        }
    }

    public List<AuditLog> getLogsByResource(String resourceType, String resourceId) {
        if (resourceId != null) {
            return auditLogRepository.findByResourceId(resourceId);
        }
        return auditLogRepository.findByResourceType(resourceType);
    }

    public List<AuditLog> getDuplicateLogs() {
        return auditLogRepository.findByIsDuplicateTrue();
    }
}
