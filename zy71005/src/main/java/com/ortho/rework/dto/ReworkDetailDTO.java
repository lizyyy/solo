package com.ortho.rework.dto;

import com.ortho.rework.enums.ReworkStatus;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ReworkDetailDTO {
    private Long id;
    private String orderNumber;
    private String batchNumber;
    private String patientId;
    private String patientName;
    private ReworkStatus status;
    private String reworkReason;
    private String technicianNote;
    private String doctorNote;
    private String trackingNumber;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private List<AuditLogDTO> auditLogs;
}
