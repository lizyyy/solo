package com.dormitory.maintenance.service;

import com.dormitory.maintenance.entity.AuditLog;
import com.dormitory.maintenance.repository.AuditLogRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class AuditLogService {

    @Autowired
    private AuditLogRepository auditLogRepository;

    @Transactional
    public AuditLog log(String entityType, Long entityId, String entityNo,
                        String action, String oldValue, String newValue,
                        String changeReason, String operator) {
        AuditLog log = new AuditLog();
        log.setEntityType(entityType);
        log.setEntityId(entityId);
        log.setEntityNo(entityNo);
        log.setAction(action);
        log.setOldValue(oldValue);
        log.setNewValue(newValue);
        log.setChangeReason(changeReason);
        log.setOperator(operator);
        return auditLogRepository.save(log);
    }

    @Transactional
    public AuditLog logOrderChange(Long orderId, String orderNo, String action,
                                   String oldValue, String newValue, String changeReason, String operator) {
        return log("MaintenanceOrder", orderId, orderNo, action, oldValue, newValue, changeReason, operator);
    }

    public List<AuditLog> getOrderAuditTrail(Long orderId) {
        return auditLogRepository.findByEntityTypeAndEntityIdOrderByOperatedAtDesc("MaintenanceOrder", orderId);
    }

    public List<AuditLog> getOrderAuditTrail(String orderNo) {
        return auditLogRepository.findByEntityTypeAndEntityNoOrderByOperatedAtDesc("MaintenanceOrder", orderNo);
    }

    public List<AuditLog> getApprovalAuditTrail(Long approvalId) {
        return auditLogRepository.findByEntityTypeAndEntityIdOrderByOperatedAtDesc("ApprovalRecord", approvalId);
    }

    public List<AuditLog> getComplaintAuditTrail(Long complaintId) {
        return auditLogRepository.findByEntityTypeAndEntityIdOrderByOperatedAtDesc("Complaint", complaintId);
    }

    public List<AuditLog> getOperatorLog(String operator) {
        return auditLogRepository.findByOperatorOrderByOperatedAtDesc(operator);
    }
}
