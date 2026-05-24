package com.ortho.rework.service;

import com.ortho.rework.entity.AuditLog;
import com.ortho.rework.enums.OperationType;
import com.ortho.rework.enums.ReworkStatus;
import com.ortho.rework.repository.AuditLogRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class AuditService {

    @Autowired
    private AuditLogRepository auditLogRepository;

    @Transactional
    public AuditLog logOperation(Long reworkOrderId, OperationType operationType, 
                                  ReworkStatus fromStatus, ReworkStatus toStatus, 
                                  String remark, String operator) {
        AuditLog auditLog = new AuditLog();
        auditLog.setReworkOrderId(reworkOrderId);
        auditLog.setOperationType(operationType);
        auditLog.setFromStatus(fromStatus);
        auditLog.setToStatus(toStatus);
        auditLog.setRemark(remark);
        auditLog.setOperator(operator);
        return auditLogRepository.save(auditLog);
    }

    @Transactional
    public AuditLog logCreate(Long reworkOrderId, String operator) {
        return logOperation(reworkOrderId, OperationType.CREATE, null, ReworkStatus.PENDING_REVIEW, "Create rework order", operator);
    }

    @Transactional
    public AuditLog logStatusChange(Long reworkOrderId, ReworkStatus fromStatus, ReworkStatus toStatus, String remark, String operator) {
        return logOperation(reworkOrderId, OperationType.STATUS_CHANGE, fromStatus, toStatus, remark, operator);
    }

    public List<AuditLog> getAuditLogsByReworkOrderId(Long reworkOrderId) {
        return auditLogRepository.findByReworkOrderIdOrderByCreatedAtDesc(reworkOrderId);
    }
}
