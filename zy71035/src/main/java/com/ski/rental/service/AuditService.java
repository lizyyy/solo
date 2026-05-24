package com.ski.rental.service;

import com.ski.rental.enums.AuditAction;
import com.ski.rental.model.AuditLog;
import com.ski.rental.repository.AuditLogRepository;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
public class AuditService {
    private final AuditLogRepository auditLogRepository;

    public AuditService(AuditLogRepository auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }

    public void logAudit(String orderNo, String batchNo, AuditAction action,
                         String operator, String beforeState, String afterState,
                         String note, boolean isDuplicate) {
        AuditLog log = new AuditLog();
        log.setOrderNo(orderNo);
        log.setBatchNo(batchNo);
        log.setAction(action);
        log.setOperator(operator);
        log.setBeforeState(beforeState);
        log.setAfterState(afterState);
        log.setNote(note);
        log.setIsDuplicate(isDuplicate);
        auditLogRepository.save(log);
    }

    public void logAudit(String orderNo, String batchNo, AuditAction action,
                         String operator, String beforeState, String afterState, String note) {
        logAudit(orderNo, batchNo, action, operator, beforeState, afterState, note, false);
    }

    public void logDuplicateAttempt(String orderNo, String batchNo, AuditAction action,
                                    String operator, String note) {
        logAudit(orderNo, batchNo, action, operator, null, null, note, true);
    }

    public List<AuditLog> getOrderAuditLogs(String orderNo) {
        return auditLogRepository.findByOrderNoOrderByCreatedAtDesc(orderNo);
    }

    public List<AuditLog> getBatchAuditLogs(String batchNo) {
        return auditLogRepository.findByBatchNoOrderByCreatedAtDesc(batchNo);
    }
}
