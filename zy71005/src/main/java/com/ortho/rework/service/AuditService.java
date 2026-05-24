package com.ortho.rework.service;

import com.ortho.rework.entity.AuditLog;
import com.ortho.rework.entity.ReworkOrder;
import com.ortho.rework.enums.OperationType;
import com.ortho.rework.enums.ReworkStatus;
import com.ortho.rework.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuditService {
    private final AuditLogRepository auditLogRepository;

    @Transactional
    public AuditLog logOperation(OperationType operationType,
                                  ReworkOrder order,
                                  String operator,
                                  String remark,
                                  ReworkStatus beforeStatus,
                                  ReworkStatus afterStatus) {
        AuditLog log = new AuditLog();
        log.setOperationType(operationType);
        log.setReworkNo(order.getReworkNo());
        log.setBatchNo(order.getBatch().getBatchNo());
        log.setPatientNo(order.getPatient().getPatientNo());
        log.setOperator(operator);
        log.setRemark(remark);
        log.setBeforeStatus(beforeStatus != null ? beforeStatus.name() : null);
        log.setAfterStatus(afterStatus != null ? afterStatus.name() : null);
        return auditLogRepository.save(log);
    }

    @Transactional
    public AuditLog logDuplicateAttempt(OperationType operationType,
                                         String reworkNo,
                                         String batchNo,
                                         String patientNo,
                                         String operator,
                                         String remark) {
        AuditLog log = new AuditLog();
        log.setOperationType(operationType);
        log.setReworkNo(reworkNo);
        log.setBatchNo(batchNo);
        log.setPatientNo(patientNo);
        log.setOperator(operator);
        log.setRemark(remark);
        log.setIsDuplicateAttempt(true);
        return auditLogRepository.save(log);
    }
}
