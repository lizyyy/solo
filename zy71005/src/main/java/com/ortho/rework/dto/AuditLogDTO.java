package com.ortho.rework.dto;

import com.ortho.rework.enums.OperationType;
import com.ortho.rework.enums.ReworkStatus;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AuditLogDTO {
    private Long id;
    private OperationType operationType;
    private ReworkStatus fromStatus;
    private ReworkStatus toStatus;
    private String remark;
    private String operator;
    private LocalDateTime createdAt;
}
