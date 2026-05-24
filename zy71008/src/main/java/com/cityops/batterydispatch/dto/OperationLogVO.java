package com.cityops.batterydispatch.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class OperationLogVO {
    private String operationType;
    private String operationTypeDescription;
    private String fromStatus;
    private String toStatus;
    private String operationReason;
    private String operationDetail;
    private String operator;
    private LocalDateTime operationTime;
}
