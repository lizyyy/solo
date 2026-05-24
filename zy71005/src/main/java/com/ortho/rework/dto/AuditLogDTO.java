package com.ortho.rework.dto;

import com.ortho.rework.entity.AuditLog;
import com.ortho.rework.enums.OperationType;
import lombok.Data;
import java.time.LocalDateTime;

@Data
public class AuditLogDTO {
    private OperationType operationType;
    private String operationDescription;
    private String reworkNo;
    private String batchNo;
    private String patientNo;
    private String operator;
    private String remark;
    private String beforeStatus;
    private String afterStatus;
    private Boolean isDuplicateAttempt;
    private LocalDateTime operationTime;

    public static AuditLogDTO fromEntity(AuditLog log) {
        AuditLogDTO dto = new AuditLogDTO();
        dto.setOperationType(log.getOperationType());
        dto.setOperationDescription(log.getOperationType().getDescription());
        dto.setReworkNo(log.getReworkNo());
        dto.setBatchNo(log.getBatchNo());
        dto.setPatientNo(log.getPatientNo());
        dto.setOperator(log.getOperator());
        dto.setRemark(log.getRemark());
        dto.setBeforeStatus(log.getBeforeStatus());
        dto.setAfterStatus(log.getAfterStatus());
        dto.setIsDuplicateAttempt(log.getIsDuplicateAttempt());
        dto.setOperationTime(log.getOperationTime());
        return dto;
    }
}
